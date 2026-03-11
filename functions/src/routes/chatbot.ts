/**
 * Endpoint principal del chatbot
 * Procesa mensajes de usuarios y retorna respuestas
 */

import { HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { sanitizeMessage, validateTenantId, validateSessionId } from '../utils/validator';
import { checkRateLimit } from '../utils/rateLimiter';
import { detectIntent, detectFollowUpIntent, sortIntentsByPriority } from '../services/detectIntent';
import { shouldUseFollowUp } from '../services/contextEngine';
import { selectBestResponse } from '../services/responseSelector';
import { getAllIntents } from '../repositories/chatbotRepository';
import { getSession, createSession, updateSession } from '../repositories/sessionRepository';
import { incrementMessageCount, incrementSessionCount } from '../services/metricsService';
import { logChatInteraction } from '../services/logService';
import { logUnansweredQuestion } from '../services/unansweredQuestionsService';
import { extractKeywords, isQuestion } from '../services/normalize';

const db = admin.firestore();

export interface ChatbotRequest {
  tenantId: string;
  sessionId: string;
  message: string;
}

export interface ChatbotResponse {
  response: string;
  sessionId: string;
  intent: string | null;
  confidence?: number;
}

/**
 * Handler principal del chatbot
 */
export async function handleChatbotMessage(data: any): Promise<ChatbotResponse> {
  try {
    // 1. Validar datos
    const tenantId = validateTenantId(data.tenantId);
    const sessionId = validateSessionId(data.sessionId);
    const userMessage = sanitizeMessage(data.message);

    // 2. Verificar que el chatbot esté habilitado para el tenant
    const tenantRef = db.collection('tenants').doc(tenantId);
    const tenantDoc = await tenantRef.get();

    if (!tenantDoc.exists) {
      throw new HttpsError('not-found', 'Tenant no encontrado');
    }

    const tenantData = tenantDoc.data();
    
    if (!tenantData?.chatbotEnabled) {
      throw new HttpsError('failed-precondition', 'En éste momento estoy actualizando el sistema. Por favor, intenta nuevamente más tarde.');
    }

    // 3. Rate limiting (30 mensajes por minuto por sesión)
    const rateLimitResult = checkRateLimit(`session_${sessionId}`, {
      maxRequests: 30,
      windowMs: 60000
    });

    if (!rateLimitResult.allowed) {
      throw new HttpsError(
        'resource-exhausted',
        `Demasiados mensajes. Intenta nuevamente en ${Math.ceil(rateLimitResult.resetIn / 1000)} segundos.`
      );
    }

    // 4. Cargar intents del tenant
    const intents = await getAllIntents(tenantId);

    if (intents.length === 0) {
      // No hay intents configurados
      await logChatInteraction(tenantId, {
        sessionId,
        userMessage,
        detectedIntent: null,
        botResponse: 'Lo siento, aún no estoy configurado para responder preguntas.',
        responseType: 'fallback'
      });

      return {
        response: 'Lo siento, aún no estoy configurado para responder preguntas.',
        sessionId,
        intent: null
      };
    }

    // 5. Ordenar intents por prioridad
    const sortedIntents = sortIntentsByPriority(intents);

    // 6. Cargar sesión
    let session = await getSession(tenantId, sessionId);
    const isNewSession = session === null;

    // 7. Determinar si usar contexto de follow-up
    const maxSessionIdleMinutes = tenantData?.chatbotConfig?.maxSessionIdleMinutes || 5;
    const contextDecision = shouldUseFollowUp(userMessage, session, maxSessionIdleMinutes);

    // 8. Detectar intención principal
    const intentMatch = detectIntent(userMessage, sortedIntents);

    let finalIntent = intentMatch?.intent || null;
    let isFollowUp = false;

    // 9. Si hay contexto válido, verificar follow-up
    if (contextDecision.shouldUseFollowUp && session && session.lastIntent && finalIntent) {
      const previousIntent = sortedIntents.find(i => i.intent === session!.lastIntent);
      
      if (previousIntent) {
        const isFollowUpDetected = detectFollowUpIntent(userMessage, previousIntent);
        
        if (isFollowUpDetected) {
          finalIntent = previousIntent;
          isFollowUp = true;
        }
      }
    }

    // 10. Seleccionar mejor respuesta
    const fallbackMessage = tenantData?.chatbotConfig?.fallbackMessage || undefined;
    const responseSelection = selectBestResponse(finalIntent, isFollowUp, fallbackMessage);

    // 10.5. Si no se detectó intención, registrar como pregunta sin respuesta
    if (!finalIntent && responseSelection.responseType === 'fallback') {
      const keywords = extractKeywords(userMessage);
      const isQuestionType = isQuestion(userMessage);
      
      // Registrar pregunta sin respuesta (sin await para no bloquear)
      logUnansweredQuestion(
        tenantId,
        sessionId,
        userMessage,
        keywords,
        userMessage.length,
        isQuestionType
      ).catch(err => console.error('Error logging unanswered question:', err));
    }

    // 11. Actualizar o crear sesión
    if (isNewSession && finalIntent) {
      session = await createSession(tenantId, sessionId, finalIntent.intent);
      await incrementSessionCount(tenantId);
    } else if (session && finalIntent) {
      await updateSession(tenantId, sessionId, finalIntent.intent, true);
    } else if (session) {
      // Sin intent detectado, solo incrementar contador
      await updateSession(tenantId, sessionId, session.lastIntent, true);
    }

    // 12. Registrar log
    await logChatInteraction(tenantId, {
      sessionId,
      userMessage,
      detectedIntent: finalIntent?.intent || null,
      botResponse: responseSelection.response,
      responseType: responseSelection.responseType,
      confidence: intentMatch?.confidence
    });

    // 13. Actualizar métricas
    await incrementMessageCount(tenantId, finalIntent?.intent || null);

    // 14. Retornar respuesta
    return {
      response: responseSelection.response,
      sessionId,
      intent: finalIntent?.intent || null,
      confidence: intentMatch?.confidence
    };

  } catch (error: any) {
    // Si es un HttpsError, relanzarlo
    if (error instanceof HttpsError) {
      throw error;
    }

    // Logging del error
    console.error('Error en handleChatbotMessage:', error);
    console.error('Stack:', error.stack);
    console.error('Data:', JSON.stringify(data));

    // En lugar de lanzar error, retornar respuesta de fallback
    // Esto evita que el usuario vea "Error procesando mensaje"
    return {
      response: 'Lo siento, hubo un problema técnico. Por favor, intenta de nuevo en un momento.',
      sessionId: data.sessionId || 'error-session',
      intent: null,
      confidence: 0
    };
  }
}

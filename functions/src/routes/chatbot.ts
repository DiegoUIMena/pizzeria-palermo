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

const ACTIVE_ORDER_STATUSES = new Set([
  'Pago Pendiente',
  'Pendiente',
  'En preparación',
  'En camino',
  'Pedido Listo',
]);

function normalizeForSearch(message: string): string {
  return sanitizeMessage(message)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isOrderStatusQuestion(message: string): boolean {
  const normalized = normalizeForSearch(message);
  const asksForOrder = /pedido|orden|compra/.test(normalized);
  const asksForStatus = /estado|donde|va|viene|llega|listo|seguimiento|tracking|tiempo|demora|falta|cuanto/.test(normalized);
  return asksForOrder && asksForStatus;
}

function parseCreatedDateMs(orderData: any): number {
  const created = orderData?.timestamps?.created;

  if (!created) {
    return 0;
  }

  if (typeof created === 'string') {
    const parsed = Date.parse(created);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  if (typeof created?.toDate === 'function') {
    try {
      return created.toDate().getTime();
    } catch {
      return 0;
    }
  }

  return 0;
}

function parseTimestampMs(value: any): number {
  if (!value) {
    return 0;
  }

  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  if (typeof value?.toDate === 'function') {
    try {
      return value.toDate().getTime();
    } catch {
      return 0;
    }
  }

  return 0;
}

function getElapsedMinutes(orderData: any): number {
  const createdMs = parseCreatedDateMs(orderData);
  if (!createdMs) {
    return 0;
  }

  return Math.max(0, Math.round((Date.now() - createdMs) / 60000));
}

function formatCurrency(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `$${Math.round(safe).toLocaleString('es-CL')}`;
}

function summarizeOrderItems(orderData: any): string {
  const items = Array.isArray(orderData?.items) ? orderData.items : [];

  if (items.length === 0) {
    return 'No tengo el detalle de productos en este pedido.';
  }

  const topItems = items.slice(0, 3).map((item: any) => {
    const qty = Number(item?.cantidad || 1);
    const name = String(item?.nombre || 'Producto').trim();
    return `${qty}x ${name}`;
  });

  const extraCount = Math.max(0, items.length - topItems.length);
  const extraText = extraCount > 0 ? ` y ${extraCount} producto(s) más` : '';
  return `${topItems.join(', ')}${extraText}.`;
}

function getEtaWindowByStatus(status: string, deliveryType: string | undefined): { min: number; max: number } | null {
  if (status === 'En camino') {
    return { min: 8, max: 15 };
  }

  if (status === 'En preparación') {
    return { min: 18, max: 30 };
  }

  if (status === 'Pendiente' || status === 'Pago Pendiente') {
    return { min: 28, max: 45 };
  }

  if (status === 'Pedido Listo' && deliveryType !== 'Retiro') {
    return { min: 5, max: 10 };
  }

  return null;
}

function buildOrderEtaDetail(orderData: any): string {
  const status = String(orderData?.estado || '').trim();
  const deliveryType = String(orderData?.tipoEntrega || '').trim() || undefined;
  const elapsedMinutes = getElapsedMinutes(orderData);

  if (status === 'Entregado') {
    const deliveredMs = parseTimestampMs(orderData?.timestamps?.delivered);
    if (deliveredMs) {
      const deliveredAt = new Date(deliveredMs).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
      return `Ya fue entregado a las ${deliveredAt}.`;
    }
    return 'Tu pedido ya fue entregado.';
  }

  if (status === 'Cancelado' || status === 'Pago Rechazado') {
    return 'Este pedido no está activo actualmente.';
  }

  if (status === 'Pedido Listo' && deliveryType === 'Retiro') {
    return 'Ya está listo para retiro en local.';
  }

  const configuredEstimate = Number(orderData?.tiempoEstimadoMinutos || 0);
  if (configuredEstimate > 0) {
    const remaining = Math.max(0, configuredEstimate - elapsedMinutes);
    if (remaining <= 3) {
      return `Está en tramo final, faltan aproximadamente ${remaining} minuto(s).`;
    }

    const min = Math.max(1, remaining - 5);
    const max = remaining + 5;
    return `Tiempo restante estimado: ${min}-${max} minutos.`;
  }

  const statusWindow = getEtaWindowByStatus(status, deliveryType);
  if (statusWindow) {
    const min = Math.max(1, statusWindow.min);
    const max = Math.max(min, statusWindow.max);
    return `Tiempo restante estimado: ${min}-${max} minutos.`;
  }

  if (typeof orderData?.tiempoEstimado === 'string' && orderData.tiempoEstimado.trim()) {
    return `Tiempo estimado informado: ${orderData.tiempoEstimado.trim()}.`;
  }

  return 'Estamos procesando tu pedido. Te recomiendo revisar nuevamente en unos minutos.';
}

async function getLatestOrderForUser(userId: string): Promise<any | null> {
  const ordersRef = db.collection('orders');

  try {
    const orderedSnapshot = await ordersRef
      .where('userId', '==', userId)
      .orderBy('timestamps.created', 'desc')
      .limit(5)
      .get();

    if (!orderedSnapshot.empty) {
      const docs: any[] = orderedSnapshot.docs.map((d) => ({id: d.id, ...d.data()}));
      const active = docs.find((o) => ACTIVE_ORDER_STATUSES.has(String(o['estado'] || '')));
      return active || docs[0];
    }
  } catch {
    // Fallback sin orderBy si existe alguna limitación de índice.
  }

  const fallbackSnapshot = await ordersRef
    .where('userId', '==', userId)
    .limit(25)
    .get();

  if (fallbackSnapshot.empty) {
    return null;
  }

  const docs: any[] = fallbackSnapshot.docs
    .map((d) => ({id: d.id, ...d.data()}))
    .sort((a, b) => parseCreatedDateMs(b) - parseCreatedDateMs(a));

  const active = docs.find((o) => ACTIVE_ORDER_STATUSES.has(String(o['estado'] || '')));
  return active || docs[0];
}

export interface ChatbotRequest {
  tenantId: string;
  sessionId: string;
  message: string;
  userId?: string | null;
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

    // 3.5 Respuesta dinámica para consultas de estado del pedido
    if (isOrderStatusQuestion(userMessage)) {
      if (!data.userId) {
        const guestResponse = 'Para revisar el estado de tu pedido necesito que inicies sesión. Luego pregúntame nuevamente por tu pedido y te diré su estado y tiempo estimado.';

        await logChatInteraction(tenantId, {
          sessionId,
          userMessage,
          detectedIntent: 'estado_pedido',
          botResponse: guestResponse,
          responseType: 'fallback',
          confidence: 1,
        });

        await incrementMessageCount(tenantId, 'estado_pedido');

        return {
          response: guestResponse,
          sessionId,
          intent: 'estado_pedido',
          confidence: 1,
        };
      }

      const latestOrder = await getLatestOrderForUser(String(data.userId));

      if (!latestOrder) {
        const noOrdersResponse = 'No encontré pedidos recientes asociados a tu cuenta. Si acabas de comprar, espera un momento y vuelve a consultarme.';

        await logChatInteraction(tenantId, {
          sessionId,
          userMessage,
          detectedIntent: 'estado_pedido',
          botResponse: noOrdersResponse,
          responseType: 'fallback',
          confidence: 1,
        });

        await incrementMessageCount(tenantId, 'estado_pedido');

        return {
          response: noOrdersResponse,
          sessionId,
          intent: 'estado_pedido',
          confidence: 1,
        };
      }

      const orderNumber = latestOrder.orderNumber || latestOrder.id || 'N/A';
      const status = String(latestOrder.estado || 'Pendiente');
      const elapsedMinutes = getElapsedMinutes(latestOrder);
      const etaText = buildOrderEtaDetail(latestOrder);
      const deliveryType = latestOrder.tipoEntrega ? String(latestOrder.tipoEntrega) : 'No especificado';
      const paymentMethod = latestOrder.metodoPago ? String(latestOrder.metodoPago) : 'No especificado';
      const total = formatCurrency(Number(latestOrder.total || 0));
      const itemsSummary = summarizeOrderItems(latestOrder);
      const elapsedText = elapsedMinutes > 0
        ? `Han pasado ${elapsedMinutes} minuto(s) desde que se creó.`
        : 'Pedido recién creado.';
      const dynamicResponse = [
        `Pedido #${orderNumber}`,
        `Estado actual: ${status}.`,
        `${etaText}`,
        `${elapsedText}`,
        `Entrega: ${deliveryType}. Pago: ${paymentMethod}.`,
        `Productos: ${itemsSummary}`,
        `Total: ${total}.`,
      ].join(' ');

      await logChatInteraction(tenantId, {
        sessionId,
        userMessage,
        detectedIntent: 'estado_pedido',
        botResponse: dynamicResponse,
        responseType: 'normal',
        confidence: 1,
      });

      await incrementMessageCount(tenantId, 'estado_pedido');

      return {
        response: dynamicResponse,
        sessionId,
        intent: 'estado_pedido',
        confidence: 1,
      };
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

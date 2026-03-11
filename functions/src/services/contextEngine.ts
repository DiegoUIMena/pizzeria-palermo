/**
 * Motor de contexto de conversación
 * Maneja el estado y flujo de la conversación
 */

import { getMessageLength } from './normalize';

export interface ConversationContext {
  sessionId: string;
  lastIntent: string | null;
  conversationCount: number;
  startedAt: Date;
  updatedAt: Date;
}

export interface ContextDecision {
  shouldUseFollowUp: boolean;
  shouldResetContext: boolean;
  contextAge: number; // milisegundos
}

/**
 * Decide si usar respuesta de follow-up basado en contexto
 */
export function shouldUseFollowUp(
  message: string,
  context: ConversationContext | null,
  maxSessionIdleMinutes: number = 5
): ContextDecision {
  if (!context || !context.lastIntent) {
    return {
      shouldUseFollowUp: false,
      shouldResetContext: false,
      contextAge: 0
    };
  }

  const now = new Date();
  const contextAge = now.getTime() - context.updatedAt.getTime();
  const maxAge = maxSessionIdleMinutes * 60 * 1000; // Convertir a ms

  // Si el contexto es muy viejo, resetear
  if (contextAge > maxAge) {
    return {
      shouldUseFollowUp: false,
      shouldResetContext: true,
      contextAge
    };
  }

  const messageLength = getMessageLength(message);

  // Si el mensaje es muy largo, probablemente es un nuevo tema
  if (messageLength === 'long') {
    return {
      shouldUseFollowUp: false,
      shouldResetContext: false,
      contextAge
    };
  }

  // Mensajes cortos y medianos pueden ser follow-ups
  return {
    shouldUseFollowUp: true,
    shouldResetContext: false,
    contextAge
  };
}

/**
 * Actualiza el contexto de conversación
 */
export function updateContext(
  context: ConversationContext | null,
  intentName: string,
  sessionId: string
): ConversationContext {
  const now = new Date();

  if (!context) {
    return {
      sessionId,
      lastIntent: intentName,
      conversationCount: 1,
      startedAt: now,
      updatedAt: now
    };
  }

  return {
    ...context,
    lastIntent: intentName,
    conversationCount: context.conversationCount + 1,
    updatedAt: now
  };
}

/**
 * Resetea el contexto manteniendo algunos datos
 */
export function resetContext(context: ConversationContext): ConversationContext {
  return {
    ...context,
    lastIntent: null,
    updatedAt: new Date()
  };
}

/**
 * Verifica si una sesión está expirada
 */
export function isSessionExpired(
  context: ConversationContext,
  maxSessionIdleMinutes: number = 5
): boolean {
  const now = new Date();
  const age = now.getTime() - context.updatedAt.getTime();
  const maxAge = maxSessionIdleMinutes * 60 * 1000;

  return age > maxAge;
}

/**
 * Genera ID de sesión único
 */
export function generateSessionId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `session_${timestamp}_${random}`;
}

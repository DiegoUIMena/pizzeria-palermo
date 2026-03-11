/**
 * Selector de respuestas del chatbot
 * Escoge la mejor respuesta basada en intent y contexto
 */

import { Intent } from './detectIntent';

/**
 * Selecciona una respuesta aleatoria del array
 */
function selectRandomResponse(responses: string[]): string {
  if (responses.length === 0) {
    return 'Lo siento, no tengo respuesta para eso.';
  }

  if (responses.length === 1) {
    return responses[0];
  }

  const randomIndex = Math.floor(Math.random() * responses.length);
  return responses[randomIndex];
}

/**
 * Selecciona respuesta de follow-up
 */
export function selectFollowUpResponse(intent: Intent): string {
  if (!intent.followUpResponses || intent.followUpResponses.length === 0) {
    // Fallback a respuesta normal si no hay follow-up
    return selectRandomResponse(intent.responses);
  }

  return selectRandomResponse(intent.followUpResponses);
}

/**
 * Selecciona respuesta normal basada en intent
 */
export function selectNormalResponse(intent: Intent): string {
  return selectRandomResponse(intent.responses);
}

/**
 * Genera mensaje de fallback
 */
export function getFallbackMessage(customFallback?: string): string {
  const defaultFallbacks = [
    'Lo siento, no entendí tu mensaje. ¿Podrías reformularlo?',
    'No estoy seguro de entender. ¿Podrías ser más específico?',
    'Disculpa, no tengo información sobre eso. ¿En qué más puedo ayudarte?',
    'No encontré una respuesta para eso. ¿Puedes hacer otra pregunta?'
  ];

  if (customFallback && customFallback.trim().length > 0) {
    return customFallback;
  }

  return selectRandomResponse(defaultFallbacks);
}

/**
 * Selecciona la mejor respuesta considerando todo el contexto
 */
export interface ResponseSelection {
  response: string;
  responseType: 'normal' | 'followup' | 'fallback';
  intent: Intent | null;
}

export function selectBestResponse(
  intent: Intent | null,
  isFollowUp: boolean,
  fallbackMessage?: string
): ResponseSelection {
  // No se detectó intención
  if (!intent) {
    return {
      response: getFallbackMessage(fallbackMessage),
      responseType: 'fallback',
      intent: null
    };
  }

  // Follow-up
  if (isFollowUp && intent.followUpResponses && intent.followUpResponses.length > 0) {
    return {
      response: selectFollowUpResponse(intent),
      responseType: 'followup',
      intent
    };
  }

  // Respuesta normal
  return {
    response: selectNormalResponse(intent),
    responseType: 'normal',
    intent
  };
}

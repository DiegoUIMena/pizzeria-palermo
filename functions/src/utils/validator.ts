/**
 * Utilidades de validación y sanitización para chatbot
 */

/**
 * Sanitiza el mensaje del usuario
 */
export function sanitizeMessage(message: string): string {
  if (!message || typeof message !== 'string') {
    throw new Error('Mensaje inválido');
  }

  // Remover espacios extra
  let sanitized = message.trim();

  // Limitar longitud máxima
  if (sanitized.length > 500) {
    sanitized = sanitized.substring(0, 500);
  }

  // Remover caracteres de control y especiales peligrosos
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
  
  // Escapar HTML básico
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

  return sanitized;
}

/**
 * Valida el tenantId
 */
export function validateTenantId(tenantId: unknown): string {
  if (!tenantId || typeof tenantId !== 'string') {
    throw new Error('TenantId inválido');
  }

  // Debe ser alfanumérico, guiones o underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(tenantId)) {
    throw new Error('TenantId contiene caracteres inválidos');
  }

  if (tenantId.length > 100) {
    throw new Error('TenantId demasiado largo');
  }

  return tenantId;
}

/**
 * Valida el sessionId
 */
export function validateSessionId(sessionId: unknown): string {
  if (!sessionId || typeof sessionId !== 'string') {
    throw new Error('SessionId inválido');
  }

  // Formato UUID o alfanumérico
  if (!/^[a-zA-Z0-9_-]+$/.test(sessionId) || sessionId.length > 1000) {
    throw new Error('SessionId inválido');
  }

  return sessionId;
}

/**
 * Valida configuración de intent
 */
export interface IntentData {
  intent: string;
  priority: number;
  keywords: string[];
  responses: string[];
  followUpKeywords?: string[];
  followUpResponses?: string[];
}

export function validateIntentData(data: any): IntentData {
  if (!data || typeof data !== 'object') {
    throw new Error('Datos de intent inválidos');
  }

  const { intent, priority, keywords, responses } = data;

  // Validar intent
  if (!intent || typeof intent !== 'string' || intent.trim().length === 0) {
    throw new Error('Intent name es requerido');
  }

  // Validar priority
  if (typeof priority !== 'number' || priority < 1 || priority > 100) {
    throw new Error('Priority debe ser un número entre 1 y 100');
  }

  // Validar keywords
  if (!Array.isArray(keywords) || keywords.length === 0) {
    throw new Error('Keywords es requerido y debe ser un array');
  }

  for (const keyword of keywords) {
    if (typeof keyword !== 'string' || keyword.trim().length === 0) {
      throw new Error('Cada keyword debe ser un string no vacío');
    }
  }

  // Validar responses
  if (!Array.isArray(responses) || responses.length === 0) {
    throw new Error('Responses es requerido y debe ser un array');
  }

  for (const response of responses) {
    if (typeof response !== 'string' || response.trim().length === 0) {
      throw new Error('Cada response debe ser un string no vacío');
    }
  }

  // Validar opcionales
  const followUpKeywords = data.followUpKeywords || [];
  const followUpResponses = data.followUpResponses || [];

  if (!Array.isArray(followUpKeywords)) {
    throw new Error('followUpKeywords debe ser un array');
  }

  if (!Array.isArray(followUpResponses)) {
    throw new Error('followUpResponses debe ser un array');
  }

  return {
    intent: intent.trim(),
    priority,
    keywords: keywords.map(k => k.trim().toLowerCase()),
    responses: responses.map(r => r.trim()),
    followUpKeywords: followUpKeywords.map(k => k.trim().toLowerCase()),
    followUpResponses: followUpResponses.map(r => r.trim())
  };
}

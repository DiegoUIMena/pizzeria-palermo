/**
 * Rate Limiter para Chatbot
 * Controla la cantidad de mensajes por sesión/IP
 */

interface RateLimitRecord {
  count: number;
  firstRequestTime: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();

// Limpiar registros antiguos cada 5 minutos
setInterval(() => {
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;
  
  for (const [key, record] of rateLimitMap.entries()) {
    if (now - record.firstRequestTime > fiveMinutes) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number;
}

/**
 * Verifica si una request excede el rate limit
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = { maxRequests: 30, windowMs: 60000 }
): RateLimitResult {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record) {
    // Primera request
    rateLimitMap.set(identifier, {
      count: 1,
      firstRequestTime: now
    });

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetIn: config.windowMs
    };
  }

  const timeElapsed = now - record.firstRequestTime;

  // Si ya pasó la ventana, resetear contador
  if (timeElapsed > config.windowMs) {
    rateLimitMap.set(identifier, {
      count: 1,
      firstRequestTime: now
    });

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetIn: config.windowMs
    };
  }

  // Incrementar contador
  record.count++;

  const allowed = record.count <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - record.count);
  const resetIn = config.windowMs - timeElapsed;

  return {
    allowed,
    remaining,
    resetIn
  };
}

/**
 * Resetea manualmente el rate limit de un identificador
 */
export function resetRateLimit(identifier: string): void {
  rateLimitMap.delete(identifier);
}

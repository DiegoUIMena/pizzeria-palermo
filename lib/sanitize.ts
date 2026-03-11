/**
 * Utilidades de sanitización de inputs
 * Protege contra XSS y otros ataques de inyección
 */

/**
 * Escapa caracteres HTML peligrosos
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    "/": '&#x2F;',
  };
  
  return text.replace(/[&<>"'/]/g, (char) => map[char] || char);
}

/**
 * Limpia y valida un nombre (2-100 caracteres)
 */
export function sanitizeName(name: string): string {
  if (!name || typeof name !== 'string') {
    throw new Error('Nombre inválido');
  }
  
  const trimmed = name.trim();
  
  if (trimmed.length < 2 || trimmed.length > 100) {
    throw new Error('Nombre debe tener entre 2 y 100 caracteres');
  }
  
  // Permitir solo letras, espacios, acentos y caracteres comunes
  if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s\-'.]+$/.test(trimmed)) {
    throw new Error('Nombre contiene caracteres inválidos');
  }
  
  return escapeHtml(trimmed);
}

/**
 * Limpia y valida un teléfono
 */
export function sanitizePhone(phone: string): string {
  if (!phone || typeof phone !== 'string') {
    throw new Error('Teléfono inválido');
  }
  
  // Eliminar todo excepto números, + y espacios
  const cleaned = phone.replace(/[^\d+\s]/g, '');
  
  // Eliminar espacios
  const final = cleaned.replace(/\s/g, '');
  
  if (final.length < 9 || final.length > 15) {
    throw new Error('Teléfono debe tener entre 9 y 15 dígitos');
  }
  
  return final;
}

/**
 * Limpia y valida un email
 */
export function sanitizeEmail(email: string): string {
  if (!email || typeof email !== 'string') {
    return '';
  }
  
  const trimmed = email.trim().toLowerCase();
  
  // Validación básica de email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(trimmed)) {
    throw new Error('Email inválido');
  }
  
  return escapeHtml(trimmed);
}

/**
 * Limpia texto libre (notas, comentarios, etc)
 */
export function sanitizeText(text: string, maxLength: number = 500): string {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  const trimmed = text.trim();
  
  if (trimmed.length > maxLength) {
    return escapeHtml(trimmed.substring(0, maxLength));
  }
  
  return escapeHtml(trimmed);
}

/**
 * Limpia una dirección (calle, número, referencia)
 */
export function sanitizeAddress(address: string, maxLength: number = 200): string {
  if (!address || typeof address !== 'string') {
    throw new Error('Dirección inválida');
  }
  
  const trimmed = address.trim();
  
  if (trimmed.length === 0) {
    throw new Error('Dirección no puede estar vacía');
  }
  
  if (trimmed.length > maxLength) {
    return escapeHtml(trimmed.substring(0, maxLength));
  }
  
  return escapeHtml(trimmed);
}

/**
 * Sanitiza datos completos de un pedido
 */
export interface SanitizedOrderData {
  cliente: {
    nombre: string;
    telefono: string;
    email: string;
  };
  direccion?: {
    calle: string;
    numero: string;
    comuna: string;
    referencia?: string;
  };
  notas?: string;
}

export function sanitizeOrderData(data: any): SanitizedOrderData {
  // Validar y sanitizar cliente
  if (!data.cliente) {
    throw new Error('Datos del cliente son requeridos');
  }
  
  const sanitized: SanitizedOrderData = {
    cliente: {
      nombre: sanitizeName(data.cliente.nombre),
      telefono: sanitizePhone(data.cliente.telefono),
      email: data.cliente.email ? sanitizeEmail(data.cliente.email) : ''
    }
  };
  
  // Sanitizar dirección si existe
  if (data.direccion && data.tipoEntrega === 'Delivery') {
    if (!data.direccion.calle || !data.direccion.numero || !data.direccion.comuna) {
      throw new Error('Dirección incompleta para delivery');
    }
    
    sanitized.direccion = {
      calle: sanitizeAddress(data.direccion.calle, 200),
      numero: sanitizeAddress(data.direccion.numero, 20),
      comuna: sanitizeAddress(data.direccion.comuna, 100),
      referencia: data.direccion.referencia 
        ? sanitizeText(data.direccion.referencia, 500) 
        : undefined
    };
  }
  
  // Sanitizar notas si existen
  if (data.notas) {
    sanitized.notas = sanitizeText(data.notas, 1000);
  }
  
  return sanitized;
}

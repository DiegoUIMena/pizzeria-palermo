import * as crypto from 'crypto'

/**
 * Genera un token seguro para que invitados puedan ver sus pedidos (BACKEND)
 * El token contiene: email + teléfono + timestamp + firma HMAC
 * Válido por 90 días por defecto
 */
export function generateGuestTrackingToken(
  email: string,
  phone: string,
  validityDays: number = 90
): string {
  const expiryTimestamp = Date.now() + (validityDays * 24 * 60 * 60 * 1000)
  const data = `${email}|${phone}|${expiryTimestamp}`

  // Usar variable de entorno o valor por defecto
  const secret = process.env.GUEST_TOKEN_SECRET || 'default-secret-change-in-production'
  const signature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex')

  // Codificar en base64 para URL-safe
  const token = Buffer.from(`${data}|${signature}`).toString('base64')
  return token
}

/**
 * Valida un token de seguimiento de invitado (BACKEND)
 * Retorna { valid: boolean, email?: string, phone?: string, error?: string }
 */
export function validateGuestTrackingToken(token: string): {
  valid: boolean
  email?: string
  phone?: string
  error?: string
} {
  try {
    // Decodificar base64
    const decoded = Buffer.from(token, 'base64').toString('utf-8')
    const [email, phone, expiryTimestampStr, signature] = decoded.split('|')

    if (!email || !phone || !expiryTimestampStr || !signature) {
      return { valid: false, error: 'Token inválido' }
    }

    // Validar expiración
    const expiryTimestamp = parseInt(expiryTimestampStr, 10)
    if (Date.now() > expiryTimestamp) {
      return { valid: false, error: 'Token expirado' }
    }

    // Validar firma HMAC
    const secret = process.env.GUEST_TOKEN_SECRET || 'default-secret-change-in-production'
    const data = `${email}|${phone}|${expiryTimestampStr}`
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex')

    // Comparación segura contra timing attacks
    if (signature !== expectedSignature) {
      return { valid: false, error: 'Firma inválida' }
    }

    return { valid: true, email, phone }
  } catch (err) {
    return { valid: false, error: 'Error al validar token' }
  }
}

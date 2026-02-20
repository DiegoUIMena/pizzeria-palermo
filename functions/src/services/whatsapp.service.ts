/**
 * Servicio de WhatsApp con Twilio
 * Pizzería Palermo
 */

import * as logger from "firebase-functions/logger";
import {defineString} from "firebase-functions/params";

// Definir parámetros de configuración
const twilioAccountSid = defineString("TWILIO_ACCOUNT_SID");
const twilioAuthToken = defineString("TWILIO_AUTH_TOKEN");
const twilioWhatsAppNumber = defineString("TWILIO_WHATSAPP_NUMBER", {default: "+14155238886"});
const appUrl = defineString("APP_URL", {default: "http://localhost:3000"});

// Twilio client
let twilioClient: any = null;

/**
 * Inicializar cliente de Twilio
 */
function getTwilioClient() {
  if (twilioClient) {
    return twilioClient;
  }

  const accountSid = twilioAccountSid.value();
  const authToken = twilioAuthToken.value();

  if (!accountSid || !authToken) {
    logger.warn("Credenciales de Twilio no configuradas");
    throw new Error("Twilio credentials not configured");
  }

  // Importación dinámica de Twilio
  const twilio = require("twilio");
  twilioClient = twilio(accountSid, authToken);

  return twilioClient;
}

/**
 * Limpiar número de teléfono (remover espacios, guiones, etc.)
 * Asegura formato internacional +56912345678
 */
function cleanPhoneNumber(phone: string): string {
  // Remover caracteres no numéricos excepto +
  let cleaned = phone.replace(/[^\d+]/g, "");

  // Si empieza con 56 pero no tiene +, agregarlo
  if (cleaned.startsWith("56") && !cleaned.startsWith("+")) {
    cleaned = "+" + cleaned;
  }

  // Si empieza con 9 (número chileno sin código de país), agregar +56
  if (cleaned.startsWith("9") && cleaned.length === 9) {
    cleaned = "+56" + cleaned;
  }

  return cleaned;
}

/**
 * Enviar WhatsApp de bienvenida a nuevo usuario
 */
export async function sendWelcomeWhatsApp(
  recipientPhone: string,
  recipientName: string,
  recipientEmail: string,
  password: string
): Promise<boolean> {
  try {
    const client = getTwilioClient();
    const whatsappNumber = twilioWhatsAppNumber.value();

    if (!whatsappNumber) {
      throw new Error("Twilio WhatsApp number not configured");
    }

    // Limpiar número de teléfono
    const cleanedPhone = cleanPhoneNumber(recipientPhone);

    // Mensaje de bienvenida
    const message = `🍕 *¡Bienvenido a Pizzería Palermo!*

Hola *${recipientName}*,

Tu cuenta ha sido creada exitosamente. ✅

📝 *Tus datos de acceso:*
📧 Correo: ${recipientEmail}
🔑 Contraseña: ${password}

⚠️ *Importante:* Guarda esta información en un lugar seguro.

Puedes iniciar sesión en:
${appUrl.value()}/auth

¡Gracias por elegirnos! 🎉

_Pizzería Palermo - Las mejores pizzas artesanales_`;

    const result = await client.messages.create({
      from: `whatsapp:${whatsappNumber}`,
      to: `whatsapp:${cleanedPhone}`,
      body: message,
    });

    logger.info("WhatsApp de bienvenida enviado", {
      messageSid: result.sid,
      recipient: cleanedPhone,
      status: result.status,
    });

    return true;
  } catch (error) {
    logger.error("Error enviando WhatsApp de bienvenida:", error);
    throw error;
  }
}

/**
 * Validar que un número de teléfono sea válido
 */
export function isValidPhoneNumber(phone: string): boolean {
  try {
    const cleaned = cleanPhoneNumber(phone);
    // Verificar que tenga formato internacional y longitud razonable
    return cleaned.startsWith("+") && cleaned.length >= 11 && cleaned.length <= 15;
  } catch {
    return false;
  }
}

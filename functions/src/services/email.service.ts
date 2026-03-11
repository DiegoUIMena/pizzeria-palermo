/**
 * Servicio de Email con Nodemailer + Gmail
 * Pizzería Palermo
 */

import * as nodemailer from "nodemailer";
import * as logger from "firebase-functions/logger";
import {defineString} from "firebase-functions/params";

// Definir parámetros de configuración
const gmailUser = defineString("GMAIL_USER", {default: "palermopizzas.cl@gmail.com"});
const gmailPassword = defineString("GMAIL_APP_PASSWORD");
const appUrl = defineString("APP_URL", {default: "http://localhost:3000"});

/**
 * Configuración del transporter de Nodemailer
 * Usa variables de entorno de Firebase Functions
 */
function createEmailTransporter() {
  const emailUser = gmailUser.value();
  const emailPassword = gmailPassword.value();

  if (!emailUser || !emailPassword) {
    logger.warn("Credenciales de email no configuradas");
    throw new Error("Email credentials not configured");
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: emailUser,
      pass: emailPassword,
    },
  });
}

/**
 * Enviar email de bienvenida a nuevo usuario
 */
export async function sendWelcomeEmail(
  recipientEmail: string,
  recipientName: string,
  password: string
): Promise<boolean> {
  try {
    const transporter = createEmailTransporter();

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #ec4899 0%, #db2777 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background: #ffffff;
            padding: 30px;
            border: 1px solid #e5e7eb;
            border-top: none;
          }
          .credentials {
            background: #f9fafb;
            border-left: 4px solid #ec4899;
            padding: 15px;
            margin: 20px 0;
          }
          .credentials strong {
            color: #ec4899;
          }
          .button {
            display: inline-block;
            background: #ec4899;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            padding: 20px;
            color: #6b7280;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🍕 ¡Bienvenido a Pizzería Palermo!</h1>
        </div>
        <div class="content">
          <p>Hola <strong>${recipientName}</strong>,</p>
          
          <p>¡Gracias por registrarte en Pizzería Palermo! Tu cuenta ha sido creada exitosamente.</p>
          
          <div class="credentials">
            <h3>📝 Tus datos de acceso:</h3>
            <p><strong>📧 Correo:</strong> ${recipientEmail}</p>
            <p><strong>🔑 Contraseña:</strong> ${password}</p>
          </div>
          
          <p><strong>⚠️ Importante:</strong> Te recomendamos guardar esta información en un lugar seguro. 
          Puedes cambiar tu contraseña en cualquier momento desde tu perfil.</p>
          
          <div style="text-align: center;">
            <a href="${appUrl.value()}/auth" class="button">
              Iniciar Sesión Ahora
            </a>
          </div>
          
          <p>Ahora puedes disfrutar de nuestras deliciosas pizzas artesanales, hacer pedidos online 
          y aprovechar nuestras promociones exclusivas.</p>
          
          <p>¡Gracias por elegirnos!</p>
          
          <p>Atentamente,<br>
          <strong>El equipo de Pizzería Palermo</strong></p>
        </div>
        <div class="footer">
          <p>Este es un correo automático, por favor no responder.</p>
          <p>© ${new Date().getFullYear()} Pizzería Palermo. Todos los derechos reservados.</p>
        </div>
      </body>
      </html>
    `;

    const textContent = `
Hola ${recipientName},

¡Bienvenido a Pizzería Palermo! Tu cuenta ha sido creada exitosamente.

Tus datos de acceso son:
📧 Correo: ${recipientEmail}
🔑 Contraseña: ${password}

Te recomendamos guardar esta información en un lugar seguro.

Puedes iniciar sesión en cualquier momento en:
${appUrl.value()}/auth

¡Disfruta de nuestras deliciosas pizzas!

Atentamente,
El equipo de Pizzería Palermo
    `;

    const mailOptions = {
      from: `"Pizzería Palermo" <${gmailUser.value()}>`,
      to: recipientEmail,
      subject: "🍕 ¡Bienvenido a Pizzería Palermo!",
      text: textContent,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);

    logger.info("Email de bienvenida enviado", {
      messageId: info.messageId,
      recipient: recipientEmail,
    });

    return true;
  } catch (error) {
    logger.error("Error enviando email de bienvenida:", error);
    throw error;
  }
}

/**
 * Enviar notificación de reembolso por email
 */
export async function sendRefundNotificationEmail(
  recipientEmail: string,
  recipientName: string,
  orderNumber: number,
  refundAmount: number,
  refundToken: string,
  refundType: string
): Promise<boolean> {
  try {
    const transporter = createEmailTransporter();

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background: #ffffff;
            padding: 30px;
            border: 1px solid #e5e7eb;
            border-top: none;
          }
          .alert {
            background: #dbeafe;
            border-left: 4px solid #3b82f6;
            padding: 15px;
            margin: 20px 0;
          }
          .refund-details {
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            padding: 20px;
            margin: 20px 0;
            border-radius: 5px;
          }
          .refund-details h3 {
            color: #3b82f6;
            margin-top: 0;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .detail-row:last-child {
            border-bottom: none;
          }
          .amount {
            font-size: 24px;
            color: #3b82f6;
            font-weight: bold;
            text-align: center;
            margin: 20px 0;
          }
          .timeline {
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 15px;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            padding: 20px;
            color: #6b7280;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>💳 Reembolso Procesado</h1>
        </div>
        <div class="content">
          <p>Hola <strong>${recipientName}</strong>,</p>
          
          <div class="alert">
            <p><strong>ℹ️ Tu pedido #${orderNumber} ha sido cancelado y se ha procesado el reembolso automáticamente.</strong></p>
          </div>

          <div class="refund-details">
            <h3>📋 Detalles del Reembolso</h3>
            <div class="detail-row">
              <span><strong>Número de Pedido:</strong></span>
              <span>#${orderNumber}</span>
            </div>
            <div class="detail-row">
              <span><strong>Monto Reembolsado:</strong></span>
              <span>$${refundAmount.toLocaleString("es-CL")}</span>
            </div>
            <div class="detail-row">
              <span><strong>Transacción:</strong></span>
              <span style="font-family: monospace; font-size: 11px;">${refundToken}</span>
            </div>
            <div class="detail-row">
              <span><strong>Tipo de Reembolso:</strong></span>
              <span>${refundType === "production" ? "Transbank" : "Desarrollo"}</span>
            </div>
            <div class="detail-row">
              <span><strong>Fecha:</strong></span>
              <span>${new Date().toLocaleString("es-CL", {
    dateStyle: "long",
    timeStyle: "short",
  })}</span>
            </div>
          </div>

          <div class="amount">
            💰 $${refundAmount.toLocaleString("es-CL")}
          </div>

          <div class="timeline">
            <h4 style="margin-top: 0;">⏱️ Tiempos de Devolución Estimados</h4>
            <p><strong>Tarjetas de Crédito:</strong> El monto se verá reflejado en 1 a 3 días hábiles.</p>
            <p><strong>Tarjetas de Débito:</strong> El monto se verá reflejado en 1 a 2 días hábiles.</p>
            <p style="margin-bottom: 0;"><em>Los plazos pueden variar según tu institución financiera.</em></p>
          </div>

          <p>Lamentamos los inconvenientes que esto pueda haber causado. Si tienes alguna consulta 
          sobre este reembolso, no dudes en contactarnos.</p>
          
          <p>Esperamos poder servirte en una próxima oportunidad.</p>
          
          <p>Atentamente,<br>
          <strong>El equipo de Pizzería Palermo</strong></p>
        </div>
        <div class="footer">
          <p>Este es un correo automático, por favor no responder.</p>
          <p>© ${new Date().getFullYear()} Pizzería Palermo. Todos los derechos reservados.</p>
        </div>
      </body>
      </html>
    `;

    const textContent = `
Hola ${recipientName},

Tu pedido #${orderNumber} ha sido cancelado y se ha procesado el reembolso automáticamente.

DETALLES DEL REEMBOLSO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 Número de Pedido: #${orderNumber}
💰 Monto Reembolsado: $${refundAmount.toLocaleString("es-CL")}
🔑 Transacción: ${refundToken}
📅 Fecha: ${new Date().toLocaleString("es-CL", {
    dateStyle: "long",
    timeStyle: "short",
  })}

TIEMPOS DE DEVOLUCIÓN ESTIMADOS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💳 Tarjetas de Crédito: 1-3 días hábiles
💳 Tarjetas de Débito: 1-2 días hábiles

Los plazos pueden variar según tu institución financiera.

Lamentamos los inconvenientes. Si tienes consultas, no dudes en contactarnos.

Atentamente,
El equipo de Pizzería Palermo
    `;

    const mailOptions = {
      from: `"Pizzería Palermo" <${gmailUser.value()}>`,
      to: recipientEmail,
      subject: `💳 Reembolso Procesado - Pedido #${orderNumber}`,
      text: textContent,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);

    logger.info("Email de reembolso enviado", {
      messageId: info.messageId,
      recipient: recipientEmail,
      orderNumber,
      amount: refundAmount,
    });

    return true;
  } catch (error) {
    logger.error("Error enviando email de reembolso:", error);
    // No lanzar error para no bloquear el reembolso
    return false;
  }
}

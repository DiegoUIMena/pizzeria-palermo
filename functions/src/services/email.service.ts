/**
 * Servicio de Email con Nodemailer + Gmail
 * Pizzería Palermo
 */

import * as nodemailer from "nodemailer";
import * as logger from "firebase-functions/logger";
import {defineString} from "firebase-functions/params";
import * as path from "path";
import * as fs from "fs";

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

/**
 * Enviar correo de respuesta a una solicitud de contacto
 */
export async function sendContactResponseEmail(
  recipientEmail: string,
  recipientName: string,
  originalSubject: string,
  originalMessage: string,
  adminResponse: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
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
            border-radius: 0 0 10px 10px;
          }
          .original-message {
            background: #f9fafb;
            border-left: 4px solid #db2777;
            padding: 15px;
            margin: 20px 0;
            font-style: italic;
            color: #4b5563;
          }
          .response-container {
            background: #fff9fb;
            border: 1px solid #fbcfe8;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            line-height: 1.6;
            color: #111827;
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
          <h1>🍕 Pizzería Palermo</h1>
          <h2>Respuesta a tu solicitud</h2>
        </div>
        <div class="content">
          <p>Hola <strong>${recipientName}</strong>,</p>
          
          <p>Hemos revisado el mensaje que nos enviaste y nuestro equipo de atención al cliente te entrega la siguiente respuesta:</p>
          
          <div class="response-container">
            ${adminResponse.replace(/\n/g, "<br>")}
          </div>

          <div class="original-message">
            <p style="margin: 0 0 5px 0; font-weight: bold; font-style: normal; color: #111827;">Resumen de tu mensaje:</p>
            <strong>Asunto:</strong> ${originalSubject}<br>
            <strong>Mensaje original:</strong> "${originalMessage}"
          </div>
          
          <p>Si tienes alguna otra duda o consulta adicional, puedes responder directamente a este correo o escribirnos por medio de nuestro sitio web.</p>
          
          <p>¡Gracias por comunicarte con nosotros!</p>
          
          <p>Atentamente,<br>
          <strong>El equipo de Pizzería Palermo</strong></p>
        </div>
        <div class="footer">
          <p>Este es un correo automático de seguimiento, por favor no respondas si tu caso ya fue aclarado.</p>
          <p>© ${new Date().getFullYear()} Pizzería Palermo. Todos los derechos reservados.</p>
        </div>
      </body>
      </html>
    `;

    const textContent = `
Hola ${recipientName},

Hemos recibido tu solicitud y nuestro equipo te ha respondido:

--------------------------------------------------
RESPUESTA:
${adminResponse}
--------------------------------------------------

RESUMEN DE TU MENSAJE ORIGINAL:
Asunto: ${originalSubject}
Mensaje: "${originalMessage}"

Si tienes más preguntas, no dudes en escribirnos de nuevo.

Atentamente,
El equipo de Pizzería Palermo
    `;

    const mailOptions = {
      from: `"Pizzería Palermo" <${gmailUser.value()}>`,
      to: recipientEmail,
      subject: `Respuesta a tu mensaje enviado a Pizzería Palermo`,
      text: textContent,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error: any) {
    logger.error("Error al enviar email de respuesta de contacto:", error);
    return {
      success: false,
      error: error.message || String(error),
    };
  }
}

export interface DriverSettlementEmailItem {
  numeroPedido: string | number;
  fechaHora: string;
  cliente: string;
  direccion: string;
  montoDelivery: number;
}

export interface DriverSettlementEmailData {
  repartidorNombre: string;
  repartidorIniciales: string;
  fechaEmision: string;
  estadoLiquidacion: string;
  totalPedidos: number;
  totalMonto: number;
  pedidos: DriverSettlementEmailItem[];
  notas?: string;
  liquidadoPor?: string;
}

/**
 * Enviar planilla de liquidación de repartidor por email
 */
export async function sendDriverSettlementEmail(
  recipientEmail: string,
  data: DriverSettlementEmailData
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const transporter = createEmailTransporter();

    const pedidosRows = (data.pedidos || [])
      .map(
        (p) => `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 10px 8px; font-weight: bold; font-family: monospace; color: #111827;">#${p.numeroPedido}</td>
          <td style="padding: 10px 8px; color: #4b5563; font-size: 13px;">${p.fechaHora}</td>
          <td style="padding: 10px 8px; color: #1f2937; font-size: 13px;">
            <div style="font-weight: 600;">${p.cliente || "Cliente"}</div>
            <div style="font-size: 11px; color: #6b7280;">${p.direccion || "Sin dirección"}</div>
          </td>
          <td style="padding: 10px 8px; text-align: right; font-weight: bold; color: #111827;">
            $${Math.round(p.montoDelivery || 0).toLocaleString("es-CL")}
          </td>
        </tr>
      `
      )
      .join("");

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Planilla de Liquidación - Pizzería Palermo</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.5;
            color: #333333;
            max-width: 680px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f3f4f6;
          }
          .container {
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            border: 1px solid #e5e7eb;
          }
          .header {
            background: linear-gradient(135deg, #ec4899 0%, #db2777 100%);
            color: white;
            padding: 24px;
            text-align: center;
          }
          .header h1 {
            margin: 0 0 6px 0;
            font-size: 22px;
            letter-spacing: 0.5px;
          }
          .header p {
            margin: 0;
            opacity: 0.9;
            font-size: 14px;
          }
          .content {
            padding: 24px;
          }
          .driver-badge {
            display: inline-block;
            background: #be185d;
            color: white;
            font-weight: bold;
            font-family: monospace;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 14px;
            margin-right: 8px;
          }
          .total-box {
            background: #ecfdf5;
            border: 1px solid #a7f3d0;
            border-radius: 8px;
            padding: 16px;
            text-align: center;
            margin: 16px 0 24px 0;
          }
          .total-amount {
            font-size: 28px;
            font-weight: 800;
            color: #065f46;
            margin: 4px 0 0 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
          }
          th {
            background-color: #f9fafb;
            color: #4b5563;
            font-weight: bold;
            text-align: left;
            padding: 10px 8px;
            border-bottom: 2px solid #e5e7eb;
          }
          .footer {
            background-color: #f9fafb;
            border-top: 1px solid #e5e7eb;
            padding: 16px 24px;
            text-align: center;
            font-size: 12px;
            color: #6b7280;
          }
          .notes-box {
            background: #fffbeb;
            border-left: 4px solid #f59e0b;
            padding: 12px 16px;
            margin: 16px 0;
            border-radius: 0 6px 6px 0;
            font-size: 13px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="cid:palermo_logo" alt="Palermo Pizzas" style="max-height: 70px; width: auto; max-width: 220px; display: block; margin: 0 auto 10px auto; object-fit: contain;" />
            <p style="margin: 0; font-size: 13px; font-weight: 600; opacity: 0.95; letter-spacing: 0.5px;">Comprobante de Liquidación de Repartos</p>
          </div>
          <div class="content">
            <div style="margin-bottom: 16px;">
              <div style="font-size: 18px; font-weight: bold; color: #111827; margin-bottom: 4px;">
                <span class="driver-badge">${data.repartidorIniciales}</span>
                ${data.repartidorNombre}
              </div>
              <div style="font-size: 13px; color: #6b7280;">
                Fecha de Emisión: <strong>${data.fechaEmision}</strong> &bull; Estado: <strong style="color: #059669;">${data.estadoLiquidacion}</strong>
              </div>
            </div>

            <div class="total-box">
              <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #047857; font-weight: bold;">
                Total Liquidación (${data.totalPedidos} ${data.totalPedidos === 1 ? "reparto" : "repartos"})
              </div>
              <div class="total-amount">
                $${Math.round(data.totalMonto || 0).toLocaleString("es-CL")}
              </div>
            </div>

            ${
              data.notas
                ? `
              <div class="notes-box">
                <strong>Observaciones:</strong><br>
                ${data.notas.replace(/\n/g, "<br>")}
              </div>
            `
                : ""
            }

            <div style="margin-top: 20px;">
              <h3 style="font-size: 14px; text-transform: uppercase; color: #374151; margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px;">
                Detalle de Repartos
              </h3>
              <table>
                <thead>
                  <tr>
                    <th>N° Pedido</th>
                    <th>Fecha / Hora</th>
                    <th>Cliente y Dirección</th>
                    <th style="text-align: right;">Tarifa Delivery</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    pedidosRows ||
                    `<tr><td colspan="4" style="text-align: center; padding: 20px; color: #9ca3af;">Sin pedidos detallados</td></tr>`
                  }
                </tbody>
              </table>
            </div>
          </div>
          <div class="footer">
            <p style="margin: 0 0 4px 0;">Este documento acredita la liquidación de servicios de delivery para Pizzería Palermo.</p>
            <p style="margin: 0;">© ${new Date().getFullYear()} Pizzería Palermo &bull; Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
Palermo Pizzas - Planilla de Liquidación de Repartos
=====================================================
Repartidor: [${data.repartidorIniciales}] ${data.repartidorNombre}
Fecha de Emisión: ${data.fechaEmision}
Estado: ${data.estadoLiquidacion}
Total de Repartos: ${data.totalPedidos}
TOTAL LIQUIDACIÓN: $${Math.round(data.totalMonto || 0).toLocaleString("es-CL")}

${data.notas ? `OBSERVACIONES:\n${data.notas}\n\n` : ""}
DETALLE DE REPARTOS:
-----------------------------------------------------
${(data.pedidos || [])
  .map(
    (p) =>
      `#${p.numeroPedido} | ${p.fechaHora} | ${p.cliente} | ${p.direccion} | $${Math.round(p.montoDelivery || 0).toLocaleString("es-CL")}`
  )
  .join("\n")}
-----------------------------------------------------
© ${new Date().getFullYear()} Pizzería Palermo
    `;

    // Buscar la ruta del logo de la pizzería para adjuntarlo como CID
    const candidateLogoPaths = [
      path.join(__dirname, "../../assets/logo.png"),
      path.join(__dirname, "../assets/logo.png"),
      path.join(__dirname, "assets/logo.png"),
      path.join(process.cwd(), "assets/logo.png"),
      path.join(process.cwd(), "functions/assets/logo.png"),
      "C:\\Users\\Diego\\Desktop\\pizzeria-palermo\\public\\iconos\\logo.png",
    ];

    let logoBuffer: Buffer | null = null;
    for (const p of candidateLogoPaths) {
      if (fs.existsSync(p)) {
        try {
          logoBuffer = fs.readFileSync(p);
          break;
        } catch {
          // continue
        }
      }
    }

    const attachments: Array<{
      filename: string;
      content: Buffer;
      cid: string;
    }> = [];

    if (logoBuffer) {
      attachments.push({
        filename: "logo.png",
        content: logoBuffer,
        cid: "palermo_logo",
      });
    }

    const mailOptions = {
      from: `"Pizzería Palermo" <${gmailUser.value()}>`,
      to: recipientEmail,
      subject: `Planilla de Liquidación - ${data.repartidorNombre} (${data.repartidorIniciales}) - $${Math.round(data.totalMonto || 0).toLocaleString("es-CL")}`,
      text: textContent,
      html: htmlContent,
      attachments,
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info("Planilla de liquidación enviada por email", {
      messageId: info.messageId,
      recipient: recipientEmail,
      repartidor: data.repartidorIniciales,
      monto: data.totalMonto,
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error: any) {
    logger.error("Error al enviar liquidación por email:", error);
    return {
      success: false,
      error: error.message || String(error),
    };
  }
}



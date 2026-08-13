import * as admin from "firebase-admin";
import * as crypto from "crypto";
import * as logger from "firebase-functions/logger";
import { HttpsError } from "firebase-functions/v2/https";
import {
  Contacto,
  CrearContactoPayload,
  ResponderContactoPayload,
  CambiarEstadoPayload,
  MarcarLeidoPayload,
  ArchivarPayload,
  ObtenerContactosPaginadosPayload,
  RespuestaContacto,
  AuditoriaContacto,
} from "../types/contact";
import { sendContactResponseEmail } from "./email.service";

const db = admin.firestore();

/**
 * Sanitiza un string para prevenir HTML, Scripts, CSS, XSS, Inyección, etc.
 * Remueve espacios repetidos y caracteres de control.
 */
export function sanitizeText(text: string, maxLength: number): string {
  if (!text || typeof text !== "string") {
    return "";
  }

  // 1. Eliminar caracteres de control (rango ASCII 0-31, excepto saltos de línea \n y \r)
  let sanitized = text.replace(/[\x00-\x09\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, "");

  // 2. Eliminar espacios y tabulaciones repetidos
  sanitized = sanitized.replace(/[ \t]+/g, " ");

  // 3. Eliminar etiquetas HTML rudimentarias para evitar XSS
  sanitized = sanitized.replace(/<[^>]*>/g, "");

  // 4. Eliminar keywords sospechosas de JS/CSS/XSS (alert, javascript, onclick, etc.)
  sanitized = sanitized.replace(
    /(javascript|onload|onclick|onerror|onmouseover|onfocus|alert|console|<script|<\/script>)/gi,
    ""
  );

  // 5. Truncar a la longitud máxima especificada
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized.trim();
}

/**
 * Registra una acción de auditoría para un contacto determinado.
 */
export async function registrarAuditoria(
  contactoId: string,
  accion: string,
  usuarioId: string,
  usuarioNombre: string,
  detalles: string
): Promise<void> {
  try {
    const auditoriaRef = db
      .collection("contactos")
      .doc(contactoId)
      .collection("auditoria")
      .doc();

    const registro: AuditoriaContacto = {
      id: auditoriaRef.id,
      accion,
      fecha: new Date().toISOString(),
      usuarioId,
      usuarioNombre,
      detalles,
    };

    await auditoriaRef.set(registro);
  } catch (error) {
    logger.error("Error al registrar auditoría de contacto:", error);
  }
}

/**
 * Crea un contacto desde el cliente aplicando validaciones y rate limiting
 */
export async function crearContacto(
  payload: CrearContactoPayload,
  clientIp: string,
  authUserId: string | null
): Promise<{ success: boolean; messageId: string }> {
  const { nombre, correo, telefono = "", tipo, asunto, mensaje, cargadoEn, honeypot } = payload;
  const now = Date.now();

  // 1. Validar Honeypot
  if (honeypot && honeypot.trim() !== "") {
    logger.warn("Honeypot activado. Rechazando solicitud.", { clientIp });
    throw new HttpsError("already-exists", "Solicitud rechazada");
  }

  // 2. Validar Tiempo Mínimo (3 segundos)
  if (!cargadoEn || now - cargadoEn < 3000) {
    logger.warn("Envío extremadamente rápido. Rechazando solicitud.", {
      clientIp,
      duration: cargadoEn ? now - cargadoEn : null,
    });
    throw new HttpsError("failed-precondition", "Envío demasiado rápido. Intenta nuevamente.");
  }

  // 3. Validaciones básicas de campos obligatorios
  if (!nombre || nombre.trim() === "") {
    throw new HttpsError("invalid-argument", "El nombre es obligatorio");
  }
  if (!correo || correo.trim() === "") {
    throw new HttpsError("invalid-argument", "El correo es obligatorio");
  }
  if (!asunto || asunto.trim() === "") {
    throw new HttpsError("invalid-argument", "El asunto es obligatorio");
  }
  if (!mensaje || mensaje.trim() === "") {
    throw new HttpsError("invalid-argument", "El mensaje es obligatorio");
  }

  // Validar longitud del mensaje
  if (mensaje.length < 20) {
    throw new HttpsError("invalid-argument", "El mensaje debe tener al menos 20 caracteres");
  }
  if (mensaje.length > 3000) {
    throw new HttpsError("invalid-argument", "El mensaje no debe exceder los 3000 caracteres");
  }

  // Validar longitud del asunto
  if (asunto.length > 120) {
    throw new HttpsError("invalid-argument", "El asunto no debe exceder los 120 caracteres");
  }

  // Validar formato de email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(correo.trim())) {
    throw new HttpsError("invalid-argument", "El correo electrónico no es válido");
  }

  // 4. Sanitizar entradas
  const sanitizedNombre = sanitizeText(nombre, 100);
  const sanitizedCorreo = correo.trim().toLowerCase();
  const sanitizedTelefono = sanitizeText(telefono, 30);
  const sanitizedAsunto = sanitizeText(asunto, 120);
  const sanitizedMensaje = sanitizeText(mensaje, 3000);

  // 5. Hash de IP para Rate Limiting
  const ipHash = crypto.createHash("sha256").update(clientIp).digest("hex");
  const diezMinutosAtras = new Date(now - 10 * 60 * 1000).toISOString();

  // 6. Rate Limit por IP (Máximo 3 en 10 min) - Filtrado en memoria para evitar índices compuestos en clientes
  const queryIp = await db
    .collection("contactos")
    .where("direccionIPHash", "==", ipHash)
    .get();

  const ipRecentMsgs = queryIp.docs.filter((doc) => {
    const data = doc.data() as Contacto;
    return data.fechaCreacion >= diezMinutosAtras;
  });

  if (ipRecentMsgs.length >= 3) {
    logger.warn("Rate limit por IP excedido.", { clientIp });
    throw new HttpsError(
      "resource-exhausted",
      "Has enviado demasiados mensajes. Por favor espera 10 minutos."
    );
  }

  // 7. Rate Limit por Usuario Autenticado (Máximo 3 en 10 min) - Filtrado en memoria para evitar índices compuestos
  if (authUserId) {
    const queryUser = await db
      .collection("contactos")
      .where("usuarioId", "==", authUserId)
      .get();

    const userRecentMsgs = queryUser.docs.filter((doc) => {
      const data = doc.data() as Contacto;
      return data.fechaCreacion >= diezMinutosAtras;
    });

    if (userRecentMsgs.length >= 3) {
      logger.warn("Rate limit por usuario autenticado excedido.", { authUserId });
      throw new HttpsError(
        "resource-exhausted",
        "Has enviado demasiados mensajes. Por favor espera 10 minutos."
      );
    }
  }

  // 8. Crear documento
  const contactoRef = db.collection("contactos").doc();
  const nuevoContacto: Contacto = {
    id: contactoRef.id,
    nombre: sanitizedNombre,
    correo: sanitizedCorreo,
    telefono: sanitizedTelefono,
    tipo,
    asunto: sanitizedAsunto,
    mensajeOriginal: sanitizedMensaje,
    estado: "Pendiente",
    prioridad: "Normal",
    fechaCreacion: new Date(now).toISOString(),
    fechaActualizacion: new Date(now).toISOString(),
    usuarioId: authUserId,
    usuarioRegistrado: !!authUserId,
    direccionIPHash: ipHash,
    userAgent: payload.honeypot ? "bot" : "user", // Nota: Honeypot se valida antes, este campo almacena info general
    leido: false,
    archivado: false,
    ultimaRespuesta: null,
    cantidadRespuestas: 0,
    ultimoCambioEstado: null,
    ultimaActividad: new Date(now).toISOString(),
    ultimaRespuestaPor: null,
    version: 1,
  };

  await contactoRef.set(nuevoContacto);

  // Registrar auditoría
  const auditUser = authUserId ? `Usuario (${authUserId})` : "Invitado";
  await registrarAuditoria(
    contactoRef.id,
    "Mensaje creado",
    authUserId || "sistema",
    sanitizedNombre,
    `Contacto de tipo ${tipo} creado por ${auditUser}.`
  );

  return { success: true, messageId: contactoRef.id };
}

/**
 * Obtener listado de contactos paginados
 */
export async function obtenerContactosPaginados(
  payload: ObtenerContactosPaginadosPayload,
  requesterRole: string
): Promise<{ contactos: Contacto[]; hasMore: boolean }> {
  // Solo admin o staff pueden listar
  if (requesterRole !== "admin" && requesterRole !== "staff") {
    throw new HttpsError("permission-denied", "No tienes permisos para ver los contactos.");
  }

  const { pageSize = 20, lastDocId = null, filtros = {} } = payload;
  let q = db.collection("contactos").orderBy("fechaCreacion", "desc");

  // Aplicar filtros exactos en orden de los índices de Firestore
  if (filtros.estado) {
    q = q.where("estado", "==", filtros.estado);
  }
  if (filtros.tipo) {
    q = q.where("tipo", "==", filtros.tipo);
  }
  if (typeof filtros.leido === "boolean") {
    q = q.where("leido", "==", filtros.leido);
  }
  if (typeof filtros.archivado === "boolean") {
    q = q.where("archivado", "==", filtros.archivado);
  }
  if (filtros.correo) {
    q = q.where("correo", "==", filtros.correo.trim().toLowerCase());
  }
  if (filtros.usuarioId) {
    q = q.where("usuarioId", "==", filtros.usuarioId);
  }

  // Traer 1 elemento más para saber si hay "hasMore"
  let queryLimit = pageSize + 1;
  let cursorDoc = null;

  if (lastDocId) {
    cursorDoc = await db.collection("contactos").doc(lastDocId).get();
    if (cursorDoc.exists) {
      q = q.startAfter(cursorDoc);
    }
  }

  q = q.limit(queryLimit);
  const snap = await q.get();

  const contactos: Contacto[] = [];
  snap.forEach((doc) => {
    contactos.push(doc.data() as Contacto);
  });

  // Filtros de cliente en memoria si son búsquedas parciales de texto (nombre y asunto)
  let filtered = contactos;
  if (filtros.nombre && filtros.nombre.trim() !== "") {
    const searchName = filtros.nombre.toLowerCase();
    filtered = filtered.filter((c) => c.nombre.toLowerCase().includes(searchName));
  }
  if (filtros.asunto && filtros.asunto.trim() !== "") {
    const searchSubject = filtros.asunto.toLowerCase();
    filtered = filtered.filter((c) => c.asunto.toLowerCase().includes(searchSubject));
  }

  const hasMore = filtered.length > pageSize;
  if (hasMore) {
    filtered.pop(); // quitar el sobrante utilizado para hasMore
  }

  return {
    contactos: filtered,
    hasMore,
  };
}

/**
 * Obtener detalle de contacto (con subcolecciones)
 */
export async function obtenerDetalleContacto(
  contactoId: string,
  requesterRole: string
): Promise<{
  contacto: Contacto;
  respuestas: RespuestaContacto[];
  auditoria: AuditoriaContacto[];
}> {
  if (requesterRole !== "admin" && requesterRole !== "staff") {
    throw new HttpsError("permission-denied", "No tienes permisos para ver el detalle de contactos.");
  }

  const contactoDoc = await db.collection("contactos").doc(contactoId).get();
  if (!contactoDoc.exists) {
    throw new HttpsError("not-found", "Contacto no encontrado");
  }

  const contacto = contactoDoc.data() as Contacto;

  // Obtener respuestas en orden cronológico
  const respuestasSnap = await db
    .collection("contactos")
    .doc(contactoId)
    .collection("respuestas")
    .orderBy("fecha", "asc")
    .get();

  const respuestas: RespuestaContacto[] = [];
  respuestasSnap.forEach((doc) => {
    respuestas.push(doc.data() as RespuestaContacto);
  });

  // Obtener logs de auditoría en orden cronológico
  const auditoriaSnap = await db
    .collection("contactos")
    .doc(contactoId)
    .collection("auditoria")
    .orderBy("fecha", "asc")
    .get();

  const auditoria: AuditoriaContacto[] = [];
  auditoriaSnap.forEach((doc) => {
    auditoria.push(doc.data() as AuditoriaContacto);
  });

  return {
    contacto,
    respuestas,
    auditoria,
  };
}

/**
 * Cambiar el estado de un contacto
 */
export async function cambiarEstadoContacto(
  payload: CambiarEstadoPayload,
  adminId: string,
  adminName: string
): Promise<void> {
  const { contactoId, nuevoEstado } = payload;
  const contactoRef = db.collection("contactos").doc(contactoId);
  const now = new Date().toISOString();

  await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(contactoRef);
    if (!doc.exists) {
      throw new HttpsError("not-found", "Contacto no encontrado");
    }

    transaction.update(contactoRef, {
      estado: nuevoEstado,
      ultimoCambioEstado: now,
      fechaActualizacion: now,
      ultimaActividad: now,
    });
  });

  await registrarAuditoria(
    contactoId,
    "Cambio de estado",
    adminId,
    adminName,
    `Estado cambiado a: ${nuevoEstado}.`
  );
}

/**
 * Marcar contacto como leído
 */
export async function marcarLeidoContacto(
  payload: MarcarLeidoPayload,
  adminId: string,
  adminName: string
): Promise<void> {
  const { contactoId, leido } = payload;
  const contactoRef = db.collection("contactos").doc(contactoId);
  const now = new Date().toISOString();

  await contactoRef.update({
    leido,
    fechaActualizacion: now,
    ultimaActividad: now,
  });

  await registrarAuditoria(
    contactoId,
    leido ? "Mensaje leído" : "Mensaje marcado como no leído",
    adminId,
    adminName,
    leido ? "Mensaje leído por el administrador." : "Mensaje marcado como no leído por el administrador."
  );
}

/**
 * Archivar/Desarchivar contacto
 */
export async function archivarContacto(
  payload: ArchivarPayload,
  adminId: string,
  adminName: string
): Promise<void> {
  const { contactoId, archivado } = payload;
  const contactoRef = db.collection("contactos").doc(contactoId);
  const now = new Date().toISOString();

  await contactoRef.update({
    archivado,
    fechaActualizacion: now,
    ultimaActividad: now,
  });

  await registrarAuditoria(
    contactoId,
    archivado ? "Mensaje archivado" : "Mensaje desarchivado",
    adminId,
    adminName,
    archivado ? "Mensaje movido al archivo." : "Mensaje restaurado del archivo."
  );
}

/**
 * Responder a un contacto enviando un correo electrónico al cliente
 */
export async function responderContacto(
  payload: ResponderContactoPayload,
  adminId: string,
  adminName: string,
  adminEmail: string
): Promise<{ success: boolean; emailEnviado: boolean; errorSMTP?: string }> {
  const { contactoId, mensaje, observacionesInternas = "" } = payload;

  if (!mensaje || mensaje.trim() === "") {
    throw new HttpsError("invalid-argument", "El mensaje de respuesta no puede estar vacío.");
  }

  const contactoRef = db.collection("contactos").doc(contactoId);
  const now = new Date().toISOString();

  // 1. Obtener datos del contacto original
  const doc = await db.collection("contactos").doc(contactoId).get();
  if (!doc.exists) {
    throw new HttpsError("not-found", "Contacto no encontrado");
  }

  const contactoData = doc.data() as Contacto;
  const recipientEmail = contactoData.correo;
  const recipientName = contactoData.nombre;
  const originalSubject = contactoData.asunto;
  const originalMessage = contactoData.mensajeOriginal;

  // 2. Intentar enviar correo SMTP
  let emailEnviado = false;
  let messageIdSMTP: string | null = null;
  let resultadoSMTP: string | null = null;
  let errorSMTP: string | null = null;

  try {
    const sendResult = await sendContactResponseEmail(
      recipientEmail,
      recipientName,
      originalSubject,
      originalMessage,
      mensaje
    );

    if (sendResult.success) {
      emailEnviado = true;
      messageIdSMTP = sendResult.messageId || null;
      resultadoSMTP = "Enviado con éxito a través de Nodemailer (Gmail)";
    } else {
      errorSMTP = sendResult.error || "Error desconocido en el transporte SMTP";
    }
  } catch (error: any) {
    logger.error("Error SMTP al enviar respuesta de contacto:", error);
    errorSMTP = error.message || String(error);
  }

  // 3. Crear documento de respuesta en la subcolección respuestas
  const respuestaRef = db
    .collection("contactos")
    .doc(contactoId)
    .collection("respuestas")
    .doc();

  const nuevaRespuesta: RespuestaContacto = {
    id: respuestaRef.id,
    mensaje,
    fecha: now,
    administradorId: adminId,
    administradorNombre: adminName,
    administradorCorreo: adminEmail,
    emailDestino: recipientEmail,
    emailEnviado,
    messageIdSMTP,
    resultadoSMTP,
    errorSMTP,
    tipoRespuesta: "email",
    observacionesInternas: sanitizeText(observacionesInternas, 2000),
  };

  await respuestaRef.set(nuevaRespuesta);

  // 4. Actualizar agregaciones en el contacto principal de forma transaccional
  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(contactoRef);
    if (!snap.exists) return;

    const data = snap.data() as Contacto;
    const currentCount = data.cantidadRespuestas || 0;

    transaction.update(contactoRef, {
      estado: "Respondido",
      ultimaRespuesta: mensaje.substring(0, 150) + (mensaje.length > 150 ? "..." : ""),
      cantidadRespuestas: currentCount + 1,
      fechaActualizacion: now,
      ultimaActividad: now,
      ultimaRespuestaPor: adminName,
    });
  });

  // 5. Registrar logs de auditoría
  if (emailEnviado) {
    await registrarAuditoria(
      contactoId,
      "Respuesta enviada",
      adminId,
      adminName,
      `Respuesta enviada al correo ${recipientEmail}. SMTP Message ID: ${messageIdSMTP}`
    );
  } else {
    await registrarAuditoria(
      contactoId,
      "Respuesta fallida",
      adminId,
      adminName,
      `Respuesta guardada pero falló el envío de correo. Error SMTP: ${errorSMTP}`
    );
  }

  return {
    success: true,
    emailEnviado,
    errorSMTP: errorSMTP || undefined,
  };
}

/**
 * Obtener conteo de contactos pendientes
 */
export async function obtenerConteoPendientes(requesterRole: string): Promise<{ count: number }> {
  if (requesterRole !== "admin" && requesterRole !== "staff") {
    throw new HttpsError("permission-denied", "No tienes permisos para ver el conteo de contactos.");
  }

  const q = db.collection("contactos").where("estado", "==", "Pendiente");
  const snap = await q.count().get();
  return { count: snap.data().count };
}

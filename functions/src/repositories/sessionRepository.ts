/**
 * Repository para gestionar sesiones de chat en Firestore
 */

import * as admin from 'firebase-admin';
import { ConversationContext } from '../services/contextEngine';

const db = admin.firestore();

export interface SessionDocument {
  lastIntent: string | null;
  conversationCount: number;
  startedAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

/**
 * Convierte SessionDocument a ConversationContext
 */
function toConversationContext(
  sessionId: string,
  data: SessionDocument
): ConversationContext {
  return {
    sessionId,
    lastIntent: data.lastIntent,
    conversationCount: data.conversationCount,
    startedAt: data.startedAt.toDate(),
    updatedAt: data.updatedAt.toDate()
  };
}

/**
 * Obtiene una sesión por ID
 */
export async function getSession(
  tenantId: string,
  sessionId: string
): Promise<ConversationContext | null> {
  const sessionRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('chat_sessions')
    .doc(sessionId);

  const doc = await sessionRef.get();

  if (!doc.exists) {
    return null;
  }

  return toConversationContext(sessionId, doc.data() as SessionDocument);
}

/**
 * Crea una nueva sesión
 */
export async function createSession(
  tenantId: string,
  sessionId: string,
  intentName: string
): Promise<ConversationContext> {
  const sessionRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('chat_sessions')
    .doc(sessionId);

  const now = admin.firestore.FieldValue.serverTimestamp();

  const sessionData: Omit<SessionDocument, 'startedAt' | 'updatedAt'> = {
    lastIntent: intentName,
    conversationCount: 1
  };

  await sessionRef.set({
    ...sessionData,
    startedAt: now,
    updatedAt: now
  });

  // Retornar contexto con timestamp actual
  const nowDate = new Date();
  return {
    sessionId,
    lastIntent: intentName,
    conversationCount: 1,
    startedAt: nowDate,
    updatedAt: nowDate
  };
}

/**
 * Actualiza una sesión existente
 */
export async function updateSession(
  tenantId: string,
  sessionId: string,
  intentName: string | null,
  incrementCount: boolean = true
): Promise<void> {
  const sessionRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('chat_sessions')
    .doc(sessionId);

  const updates: any = {
    lastIntent: intentName,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  if (incrementCount) {
    updates.conversationCount = admin.firestore.FieldValue.increment(1);
  }

  await sessionRef.update(updates);
}

/**
 * Elimina sesiones expiradas
 */
export async function cleanupExpiredSessions(
  tenantId: string,
  maxIdleMinutes: number = 30
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setMinutes(cutoffDate.getMinutes() - maxIdleMinutes);

  const sessionsRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('chat_sessions')
    .where('updatedAt', '<', admin.firestore.Timestamp.fromDate(cutoffDate));

  const snapshot = await sessionsRef.get();

  if (snapshot.empty) {
    return 0;
  }

  // Eliminar en batch
  const batch = db.batch();
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });

  await batch.commit();

  return snapshot.size;
}

/**
 * Obtiene estadísticas de sesiones activas
 */
export async function getActiveSessionsCount(
  tenantId: string,
  maxIdleMinutes: number = 30
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setMinutes(cutoffDate.getMinutes() - maxIdleMinutes);

  const sessionsRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('chat_sessions')
    .where('updatedAt', '>=', admin.firestore.Timestamp.fromDate(cutoffDate));

  const snapshot = await sessionsRef.get();

  return snapshot.size;
}

/**
 * Servicio de logging para chatbot
 * Registra todas las conversaciones
 */

import * as admin from 'firebase-admin';

const db = admin.firestore();

export interface ChatLog {
  sessionId: string;
  userMessage: string;
  detectedIntent: string | null;
  botResponse: string;
  timestamp: admin.firestore.Timestamp;
  responseType: 'normal' | 'followup' | 'fallback';
  confidence?: number;
}

/**
 * Registra una interacci\u00f3n del chatbot
 */
export async function logChatInteraction(
  tenantId: string,
  logData: Omit<ChatLog, 'timestamp'>
): Promise<string> {
  const logsRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('chat_logs');

  const logDoc = await logsRef.add({
    ...logData,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });

  return logDoc.id;
}

/**
 * Obtiene logs de una sesi\u00f3n espec\u00edfica
 */
export async function getSessionLogs(
  tenantId: string,
  sessionId: string
): Promise<ChatLog[]> {
  const logsRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('chat_logs')
    .where('sessionId', '==', sessionId)
    .orderBy('timestamp', 'asc');

  const snapshot = await logsRef.get();

  return snapshot.docs.map(doc => ({
    ...doc.data(),
    timestamp: doc.data().timestamp
  })) as ChatLog[];
}

/**
 * Obtiene logs recientes del chatbot
 */
export async function getRecentLogs(
  tenantId: string,
  limit: number = 100
): Promise<Array<ChatLog & { id: string }>> {
  const logsRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('chat_logs')
    .orderBy('timestamp', 'desc')
    .limit(limit);

  const snapshot = await logsRef.get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Array<ChatLog & { id: string }>;
}

/**
 * Elimina logs antiguos (mant\u00e9n solo \u00faltimos 30 d\u00edas)
 */
export async function cleanupOldLogs(tenantId: string, daysToKeep: number = 30): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const logsRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('chat_logs')
    .where('timestamp', '<', admin.firestore.Timestamp.fromDate(cutoffDate));

  const snapshot = await logsRef.get();

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
 * Exporta logs a formato CSV (simple)
 */
export interface ExportedLog {
  timestamp: string;
  sessionId: string;
  userMessage: string;
  botResponse: string;
  intent: string;
}

export async function exportLogsToCSV(
  tenantId: string,
  fromDate?: Date,
  toDate?: Date
): Promise<ExportedLog[]> {
  let query = db
    .collection('tenants')
    .doc(tenantId)
    .collection('chat_logs')
    .orderBy('timestamp', 'desc');

  if (fromDate) {
    query = query.where('timestamp', '>=', admin.firestore.Timestamp.fromDate(fromDate));
  }

  if (toDate) {
    query = query.where('timestamp', '<=', admin.firestore.Timestamp.fromDate(toDate));
  }

  const snapshot = await query.get();

  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      timestamp: data.timestamp?.toDate().toISOString() || '',
      sessionId: data.sessionId || '',
      userMessage: data.userMessage || '',
      botResponse: data.botResponse || '',
      intent: data.detectedIntent || 'none'
    };
  });
}

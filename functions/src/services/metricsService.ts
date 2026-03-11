/**
 * Servicio de métricas del chatbot
 * Actualiza contadores y estadísticas
 */

import * as admin from 'firebase-admin';

const db = admin.firestore();

export interface IntentMetrics {
  [intentName: string]: number;
}

export interface ChatbotMetrics {
  totalMessages: number;
  totalSessions: number;
  intentCounters: IntentMetrics;
  lastUpdated: Date;
}

/**
 * Incrementa contador de mensajes
 */
export async function incrementMessageCount(
  tenantId: string,
  intentName: string | null
): Promise<void> {
  const metricsRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('chatbot_metrics')
    .doc('general');

  const updates: any = {
    totalMessages: admin.firestore.FieldValue.increment(1),
    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
  };

  // Incrementar contador de intent si existe
  if (intentName) {
    updates[`intentCounters.${intentName}`] = admin.firestore.FieldValue.increment(1);
  }

  await metricsRef.set(updates, { merge: true });
}

/**
 * Incrementa contador de sesiones
 */
export async function incrementSessionCount(tenantId: string): Promise<void> {
  const metricsRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('chatbot_metrics')
    .doc('general');

  await metricsRef.set(
    {
      totalSessions: admin.firestore.FieldValue.increment(1),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );
}

/**
 * Obtiene métricas generales
 */
export async function getMetrics(tenantId: string): Promise<ChatbotMetrics | null> {
  const metricsRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('chatbot_metrics')
    .doc('general');

  const doc = await metricsRef.get();

  if (!doc.exists) {
    return null;
  }

  const data = doc.data();
  
  return {
    totalMessages: data?.totalMessages || 0,
    totalSessions: data?.totalSessions || 0,
    intentCounters: data?.intentCounters || {},
    lastUpdated: data?.lastUpdated?.toDate() || new Date()
  };
}

/**
 * Obtiene top intents
 */
export function getTopIntents(metrics: ChatbotMetrics, limit: number = 5): Array<{intent: string, count: number}> {
  const intentArray = Object.entries(metrics.intentCounters)
    .map(([intent, count]) => ({ intent, count: count as number }))
    .sort((a, b) => b.count - a.count);

  return intentArray.slice(0, limit);
}

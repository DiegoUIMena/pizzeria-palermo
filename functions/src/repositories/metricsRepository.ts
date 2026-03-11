/**
 * Repository para métricas del chatbot
 */

import * as admin from 'firebase-admin';

const db = admin.firestore();

export interface MetricsData {
  totalMessages: number;
  totalSessions: number;
  intentCounters: { [key: string]: number };
  lastUpdated: Date;
}

/**
 * Obtiene las métricas generales
 */
export async function getGeneralMetrics(tenantId: string): Promise<MetricsData | null> {
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
 * Inicializa métricas si no existen
 */
export async function initializeMetrics(tenantId: string): Promise<void> {
  const metricsRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('chatbot_metrics')
    .doc('general');

  const doc = await metricsRef.get();

  if (!doc.exists) {
    await metricsRef.set({
      totalMessages: 0,
      totalSessions: 0,
      intentCounters: {},
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });
  }
}

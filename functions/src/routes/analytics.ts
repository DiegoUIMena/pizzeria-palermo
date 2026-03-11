/**
 * Endpoints de analytics y m\u00e9tricas del chatbot
 */

import { HttpsError } from 'firebase-functions/v2/https';
import { validateTenantId } from '../utils/validator';
import { getMetrics, getTopIntents } from '../services/metricsService';
import { getRecentLogs, exportLogsToCSV } from '../services/logService';
import { getActiveSessionsCount } from '../repositories/sessionRepository';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * Verifica acceso admin
 */
async function verifyAdminAccess(userId: string, tenantId: string): Promise<void> {
  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    throw new HttpsError('not-found', 'Usuario no encontrado');
  }

  const userData = userDoc.data();

  if (userData?.role !== 'admin' && userData?.role !== 'superadmin') {
    throw new HttpsError('permission-denied', 'Solo administradores pueden ver m\u00e9tricas');
  }
}

/**
 * Obtener m\u00e9tricas generales
 */
export async function getChatbotMetrics(userId: string, tenantId: string) {
  await verifyAdminAccess(userId, tenantId);
  
  const validatedTenantId = validateTenantId(tenantId);
  const metrics = await getMetrics(validatedTenantId);

  if (!metrics) {
    return {
      totalMessages: 0,
      totalSessions: 0,
      topIntents: [],
      activeSessions: 0
    };
  }

  const topIntents = getTopIntents(metrics, 5);
  const activeSessions = await getActiveSessionsCount(validatedTenantId, 30);

  return {
    totalMessages: metrics.totalMessages,
    totalSessions: metrics.totalSessions,
    topIntents,
    activeSessions
  };
}

/**
 * Obtener logs recientes
 */
export async function getChatbotLogs(userId: string, tenantId: string, limit: number = 100) {
  await verifyAdminAccess(userId, tenantId);
  
  const validatedTenantId = validateTenantId(tenantId);
  const logs = await getRecentLogs(validatedTenantId, limit);

  return { logs };
}

/**
 * Exportar logs a CSV
 */
export async function exportChatbotLogs(
  userId: string, 
  tenantId: string,
  fromDate?: string,
  toDate?: string
) {
  await verifyAdminAccess(userId, tenantId);
  
  const validatedTenantId = validateTenantId(tenantId);
  
  const from = fromDate ? new Date(fromDate) : undefined;
  const to = toDate ? new Date(toDate) : undefined;

  const logs = await exportLogsToCSV(validatedTenantId, from, to);

  return { logs };
}

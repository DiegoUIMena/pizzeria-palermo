/**
 * Endpoints de analytics y m\u00e9tricas del chatbot
 */

import { validateTenantId } from '../utils/validator';
import { verifyAdminAccess } from '../utils/admin-access';
import { getMetrics, getTopIntents } from '../services/metricsService';
import { getRecentLogs, exportLogsToCSV } from '../services/logService';
import { getActiveSessionsCount } from '../repositories/sessionRepository';

/**
 * Obtener m\u00e9tricas generales
 */
export async function getChatbotMetrics(userId: string, tenantId: string) {
  await verifyAdminAccess(userId, 'Solo administradores pueden ver métricas');
  
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
  await verifyAdminAccess(userId, 'Solo administradores pueden ver métricas');
  
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
  await verifyAdminAccess(userId, 'Solo administradores pueden ver métricas');
  
  const validatedTenantId = validateTenantId(tenantId);
  
  const from = fromDate ? new Date(fromDate) : undefined;
  const to = toDate ? new Date(toDate) : undefined;

  const logs = await exportLogsToCSV(validatedTenantId, from, to);

  return { logs };
}

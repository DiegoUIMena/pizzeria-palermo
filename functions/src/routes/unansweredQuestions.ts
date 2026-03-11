/**
 * Rutas para gestionar preguntas sin respuesta
 */

import { HttpsError } from 'firebase-functions/v2/https';
import { validateTenantId } from '../utils/validator';
import {
  getUnansweredQuestions,
  updateQuestionStatus,
  getUnansweredStats
} from '../services/unansweredQuestionsService';

/**
 * Obtiene lista de preguntas sin respuesta
 */
export async function handleGetUnansweredQuestions(data: any): Promise<any> {
  try {
    const tenantId = validateTenantId(data.tenantId);
    const status = data.status; // 'pending' | 'reviewed' | 'answered' | undefined
    const limit = data.limit || 50;

    const questions = await getUnansweredQuestions(tenantId, status, limit);

    return {
      questions,
      count: questions.length
    };
  } catch (error: any) {
    console.error('Error en handleGetUnansweredQuestions:', error);
    throw new HttpsError('internal', error.message || 'Error obteniendo preguntas sin respuesta');
  }
}

/**
 * Actualiza el estado de una pregunta
 */
export async function handleUpdateQuestionStatus(data: any): Promise<any> {
  try {
    const tenantId = validateTenantId(data.tenantId);
    const questionId = data.questionId;
    const status = data.status;

    if (!questionId) {
      throw new HttpsError('invalid-argument', 'questionId es requerido');
    }

    if (!['pending', 'reviewed', 'answered'].includes(status)) {
      throw new HttpsError('invalid-argument', 'Estado inválido');
    }

    await updateQuestionStatus(tenantId, questionId, status);

    return {
      success: true,
      message: 'Estado actualizado correctamente'
    };
  } catch (error: any) {
    console.error('Error en handleUpdateQuestionStatus:', error);
    throw new HttpsError('internal', error.message || 'Error actualizando estado');
  }
}

/**
 * Obtiene estadísticas de preguntas sin respuesta
 */
export async function handleGetUnansweredStats(data: any): Promise<any> {
  try {
    const tenantId = validateTenantId(data.tenantId);

    const stats = await getUnansweredStats(tenantId);

    return stats;
  } catch (error: any) {
    console.error('Error en handleGetUnansweredStats:', error);
    throw new HttpsError('internal', error.message || 'Error obteniendo estadísticas');
  }
}

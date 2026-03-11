/**
 * Servicio para registrar preguntas sin respuesta
 * Ayuda a identificar gaps en el conocimiento del chatbot
 */

import * as admin from 'firebase-admin';

const db = admin.firestore();

export interface UnansweredQuestion {
  sessionId: string;
  userMessage: string;
  timestamp: admin.firestore.Timestamp;
  attemptedKeywords?: string[];
  messageLength?: number;
  isQuestion?: boolean;
  status: 'pending' | 'reviewed' | 'answered';
}

/**
 * Registra una pregunta sin respuesta adecuada
 */
export async function logUnansweredQuestion(
  tenantId: string,
  sessionId: string,
  userMessage: string,
  attemptedKeywords?: string[],
  messageLength?: number,
  isQuestion?: boolean
): Promise<void> {
  try {
    const questionRef = db
      .collection('tenants')
      .doc(tenantId)
      .collection('unanswered_questions');

    await questionRef.add({
      sessionId,
      userMessage,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      attemptedKeywords: attemptedKeywords || [],
      messageLength: messageLength || 0,
      isQuestion: isQuestion || false,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`[UnansweredQuestion] Registrada para tenant ${tenantId}: "${userMessage}"`);
  } catch (error) {
    console.error('[UnansweredQuestion] Error registrando pregunta:', error);
    // No lanzar error para no afectar el flujo principal
  }
}

/**
 * Obtiene preguntas sin respuesta con filtros
 */
export async function getUnansweredQuestions(
  tenantId: string,
  status?: 'pending' | 'reviewed' | 'answered',
  limit: number = 50
): Promise<any[]> {
  try {
    let query: any = db
      .collection('tenants')
      .doc(tenantId)
      .collection('unanswered_questions');

    // IMPORTANTE: where() debe ir ANTES de orderBy()
    if (status) {
      query = query.where('status', '==', status);
    }

    query = query
      .orderBy('timestamp', 'desc')
      .limit(limit);

    const snapshot = await query.get();
    
    return snapshot.docs.map((doc: admin.firestore.QueryDocumentSnapshot) => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate()
    }));
  } catch (error) {
    console.error('[UnansweredQuestion] Error obteniendo preguntas:', error);
    throw error;
  }
}

/**
 * Marca una pregunta como revisada o respondida
 */
export async function updateQuestionStatus(
  tenantId: string,
  questionId: string,
  status: 'pending' | 'reviewed' | 'answered'
): Promise<void> {
  try {
    await db
      .collection('tenants')
      .doc(tenantId)
      .collection('unanswered_questions')
      .doc(questionId)
      .update({
        status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

    console.log(`[UnansweredQuestion] Estado actualizado: ${questionId} -> ${status}`);
  } catch (error) {
    console.error('[UnansweredQuestion] Error actualizando estado:', error);
    throw error;
  }
}

/**
 * Obtiene estadísticas de preguntas sin respuesta
 */
export async function getUnansweredStats(tenantId: string): Promise<{
  total: number;
  pending: number;
  reviewed: number;
  answered: number;
}> {
  try {
    const collectionRef = db
      .collection('tenants')
      .doc(tenantId)
      .collection('unanswered_questions');

    const [totalSnap, pendingSnap, reviewedSnap, answeredSnap] = await Promise.all([
      collectionRef.count().get(),
      collectionRef.where('status', '==', 'pending').count().get(),
      collectionRef.where('status', '==', 'reviewed').count().get(),
      collectionRef.where('status', '==', 'answered').count().get()
    ]);

    return {
      total: totalSnap.data().count,
      pending: pendingSnap.data().count,
      reviewed: reviewedSnap.data().count,
      answered: answeredSnap.data().count
    };
  } catch (error) {
    console.error('[UnansweredQuestion] Error obteniendo estadísticas:', error);
    return { total: 0, pending: 0, reviewed: 0, answered: 0 };
  }
}

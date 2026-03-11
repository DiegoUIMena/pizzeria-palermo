/**
 * Repository para gestionar intents del chatbot en Firestore
 */

import * as admin from 'firebase-admin';
import { Intent } from '../services/detectIntent';

const db = admin.firestore();

export interface IntentDocument extends Omit<Intent, 'id'> {
  createdAt?: admin.firestore.Timestamp;
  updatedAt?: admin.firestore.Timestamp;
}

/**
 * Obtiene todos los intents de un tenant
 */
export async function getAllIntents(tenantId: string): Promise<Intent[]> {
  const intentsRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('chatbot_intents')
    .orderBy('priority', 'asc');

  const snapshot = await intentsRef.get();

  if (snapshot.empty) {
    return [];
  }

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Intent[];
}

/**
 * Obtiene un intent por ID
 */
export async function getIntentById(
  tenantId: string,
  intentId: string
): Promise<Intent | null> {
  const intentRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('chatbot_intents')
    .doc(intentId);

  const doc = await intentRef.get();

  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    ...doc.data()
  } as Intent;
}

/**
 * Crea un nuevo intent
 */
export async function createIntent(
  tenantId: string,
  intentData: Omit<IntentDocument, 'createdAt' | 'updatedAt'>
): Promise<string> {
  const intentsRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('chatbot_intents');

  const newIntent = await intentsRef.add({
    ...intentData,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return newIntent.id;
}

/**
 * Actualiza un intent existente
 */
export async function updateIntent(
  tenantId: string,
  intentId: string,
  updates: Partial<Omit<IntentDocument, 'createdAt'>>
): Promise<void> {
  const intentRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('chatbot_intents')
    .doc(intentId);

  await intentRef.update({
    ...updates,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

/**
 * Elimina un intent
 */
export async function deleteIntent(
  tenantId: string,
  intentId: string
): Promise<void> {
  const intentRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('chatbot_intents')
    .doc(intentId);

  await intentRef.delete();
}

/**
 * Verifica si existe un intent con el mismo nombre
 */
export async function intentNameExists(
  tenantId: string,
  intentName: string,
  excludeId?: string
): Promise<boolean> {
  let query = db
    .collection('tenants')
    .doc(tenantId)
    .collection('chatbot_intents')
    .where('intent', '==', intentName);

  const snapshot = await query.get();

  if (snapshot.empty) {
    return false;
  }

  // Si estamos actualizando, permitir el mismo nombre si es el mismo doc
  if (excludeId) {
    return snapshot.docs.some(doc => doc.id !== excludeId);
  }

  return true;
}

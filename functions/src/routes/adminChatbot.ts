/**
 * Endpoints de administraci\u00f3n del chatbot
 * CRUD de intents y configuraci\u00f3n
 */

import { HttpsError } from 'firebase-functions/v2/https';
import { validateTenantId, validateIntentData } from '../utils/validator';
import { verifyAdminAccess } from '../utils/admin-access';
import * as chatbotRepo from '../repositories/chatbotRepository';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * Listar todos los intents
 */
export async function listIntents(userId: string, tenantId: string) {
  await verifyAdminAccess(userId, 'Solo administradores pueden gestionar el chatbot');
  
  const validatedTenantId = validateTenantId(tenantId);
  const intents = await chatbotRepo.getAllIntents(validatedTenantId);

  return { intents };
}

/**
 * Crear un intent
 */
export async function createIntent(userId: string, tenantId: string, intentData: any) {
  await verifyAdminAccess(userId, 'Solo administradores pueden gestionar el chatbot');
  
  const validatedTenantId = validateTenantId(tenantId);
  const validatedData = validateIntentData(intentData);

  // Verificar que no exista intent con el mismo nombre
  const exists = await chatbotRepo.intentNameExists(validatedTenantId, validatedData.intent);
  
  if (exists) {
    throw new HttpsError('already-exists', `Intent '${validatedData.intent}' ya existe`);
  }

  const intentId = await chatbotRepo.createIntent(validatedTenantId, validatedData);

  return { intentId, intent: { id: intentId, ...validatedData } };
}

/**
 * Actualizar un intent
 */
export async function updateIntent(userId: string, tenantId: string, intentId: string, updates: any) {
  await verifyAdminAccess(userId, 'Solo administradores pueden gestionar el chatbot');
  
  const validatedTenantId = validateTenantId(tenantId);
  const validatedData = validateIntentData(updates);

  // Verificar que el intent existe
  const existingIntent = await chatbotRepo.getIntentById(validatedTenantId, intentId);
  
  if (!existingIntent) {
    throw new HttpsError('not-found', 'Intent no encontrado');
  }

  // Si cambiaron el nombre, verificar que no exista otro con ese nombre
  if (validatedData.intent !== existingIntent.intent) {
    const nameExists = await chatbotRepo.intentNameExists(
      validatedTenantId, 
      validatedData.intent,
      intentId
    );
    
    if (nameExists) {
      throw new HttpsError('already-exists', `Intent '${validatedData.intent}' ya existe`);
    }
  }

  await chatbotRepo.updateIntent(validatedTenantId, intentId, validatedData);

  return { success: true };
}

/**
 * Eliminar un intent
 */
export async function deleteIntent(userId: string, tenantId: string, intentId: string) {
  await verifyAdminAccess(userId, 'Solo administradores pueden gestionar el chatbot');
  
  const validatedTenantId = validateTenantId(tenantId);

  // Verificar que existe
  const existingIntent = await chatbotRepo.getIntentById(validatedTenantId, intentId);
  
  if (!existingIntent) {
    throw new HttpsError('not-found', 'Intent no encontrado');
  }

  await chatbotRepo.deleteIntent(validatedTenantId, intentId);

  return { success: true };
}

/**
 * Actualizar configuraci\u00f3n del chatbot
 */
export async function updateChatbotConfig(
  userId: string, 
  tenantId: string, 
  config: {
    enabled?: boolean;
    fallbackMessage?: string;
    maxSessionIdleMinutes?: number;
  }
) {
  await verifyAdminAccess(userId, 'Solo administradores pueden gestionar el chatbot');
  
  const validatedTenantId = validateTenantId(tenantId);
  const tenantRef = db.collection('tenants').doc(validatedTenantId);

  const updates: any = {};

  if (typeof config.enabled === 'boolean') {
    updates.chatbotEnabled = config.enabled;
  }

  if (config.fallbackMessage !== undefined) {
    updates['chatbotConfig.fallbackMessage'] = config.fallbackMessage;
  }

  if (config.maxSessionIdleMinutes !== undefined) {
    if (config.maxSessionIdleMinutes < 1 || config.maxSessionIdleMinutes > 60) {
      throw new HttpsError('invalid-argument', 'maxSessionIdleMinutes debe estar entre 1 y 60');
    }
    updates['chatbotConfig.maxSessionIdleMinutes'] = config.maxSessionIdleMinutes;
  }

  await tenantRef.update(updates);

  return { success: true };
}

/**
 * Obtener configuraci\u00f3n del chatbot
 */
export async function getChatbotConfig(userId: string, tenantId: string) {
  await verifyAdminAccess(userId, 'Solo administradores pueden gestionar el chatbot');
  
  const validatedTenantId = validateTenantId(tenantId);
  const tenantRef = db.collection('tenants').doc(validatedTenantId);
  const tenantDoc = await tenantRef.get();

  if (!tenantDoc.exists) {
    throw new HttpsError('not-found', 'Tenant no encontrado');
  }

  const data = tenantDoc.data();

  return {
    enabled: data?.chatbotEnabled || false,
    fallbackMessage: data?.chatbotConfig?.fallbackMessage || '',
    maxSessionIdleMinutes: data?.chatbotConfig?.maxSessionIdleMinutes || 5
  };
}

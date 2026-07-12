import * as admin from 'firebase-admin'
import { logger } from 'firebase-functions'

/**
 * Configuración de Puntos Palermo
 * Versión optimizada para rentabilidad sostenible
 */

type RewardType = 'fixed_discount' | 'pizza_cap'

interface RedemptionTier {
  points: number
  rewardType: RewardType
  discountAmount: number
  minimumOrderAmount: number
  label: string
}

export const POINTS_CONFIG = {
  pointsPerPeso: 0.001, // 1 punto por cada $1000 (0.001 puntos por peso)
  voucherExpiryDays: 15,
  pointsExpiryDays: 90,
  redemptionTiers: [] as RedemptionTier[],
}





/**
 * Suma puntos a un usuario registrado cuando realiza un pago exitoso
 * Crea entrada en historial de transacciones
 */
export async function addPointsToUser(
  userId: string,
  amount: number,
  orderId: string
): Promise<void> {
  try {
    const db = admin.firestore()
    const pointsEarned = Math.floor(amount * POINTS_CONFIG.pointsPerPeso)

    if (pointsEarned <= 0) {
      logger.info('Order amount too small for points', { userId, amount })
      return
    }

    // Actualizar usuario: agregar puntos al total
    const userRef = db.collection('users').doc(userId)
    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef)
      const userData = userDoc.data()

      // Los puntos solo se generan si el cliente activó su cuenta con su RUT
      if (!userData?.rut) {
        logger.info('User has not activated points account (missing RUT). Skipping points addition.', { userId, orderId })
        return
      }

      // Evitar doble acumulación (idempotencia): verificar si ya existen puntos asignados para esta orden
      const historyRef = db.collection('users').doc(userId).collection('points_history')
      const existingTxSnapshot = await transaction.get(
        historyRef.where('type', '==', 'earned').where('orderId', '==', orderId)
      )

      if (!existingTxSnapshot.empty) {
        logger.info('Points already added for this order. Skipping duplicate addition.', { userId, orderId })
        return
      }

      const currentPoints = userData?.totalPoints || 0

      transaction.update(userRef, {
        totalPoints: currentPoints + pointsEarned,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      // Crear entrada en historial de puntos
      const pointsHistoryRef = db.collection('users').doc(userId).collection('points_history').doc()
      transaction.set(pointsHistoryRef, {
        type: 'earned', // earned | redeemed | refunded
        points: pointsEarned,
        remainingPoints: pointsEarned,
        amount: amount,
        orderId: orderId,
        description: `Puntos ganados por compra de $${amount.toLocaleString('es-CL')}`,
        expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + POINTS_CONFIG.pointsExpiryDays * 24 * 60 * 60 * 1000)),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    })

    logger.info('Points added to user', {
      userId,
      pointsEarned,
      orderId,
    })
  } catch (error) {
    logger.error('Error adding points to user:', error)
    // No lanzamos error para no romper el flujo de pago
    // Solo registramos
  }
}

/**
 * Canjea puntos por pizza
 * Valida que el usuario tenga suficientes puntos
 */
export async function redeemPointsForPizza(
  userId: string,
  pointsToRedeem: number
): Promise<{
  success: boolean
  error?: string
  voucherId?: string
  voucherCode?: string
}> {
  return {
    success: false,
    error: 'El canje de puntos por vouchers o cupones de descuento ya no está disponible.',
  }
}

export async function expirePointsForUser(
  userId: string,
  now: FirebaseFirestore.Timestamp,
  transaction: FirebaseFirestore.Transaction
): Promise<number> {
  const db = admin.firestore()
  const userRef = db.collection('users').doc(userId)
  const historyRef = db.collection('users').doc(userId).collection('points_history')

  let pointsToExpire = 0
  const earnedSnapshot = await transaction.get(
    historyRef.where('type', '==', 'earned')
  )

  earnedSnapshot.docs
    .map((docSnap) => {
      const data = docSnap.data()
      const expiresAtTs = data.expiresAt as FirebaseFirestore.Timestamp | undefined
      return {
        docSnap,
        expiresAtMs: expiresAtTs?.toMillis?.() ?? 0,
      }
    })
    .filter(({expiresAtMs}) => expiresAtMs > 0 && expiresAtMs <= now.toMillis())
    .sort((a, b) => a.expiresAtMs - b.expiresAtMs)
    .forEach(({docSnap}) => {
    const data = docSnap.data()
    const remaining = Number(data.remainingPoints || 0)
    if (remaining > 0) {
      pointsToExpire += remaining
      transaction.update(docSnap.ref, {
        remainingPoints: 0,
        expiredAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    }
  })

  if (pointsToExpire <= 0) {
    return 0
  }

  const userDoc = await transaction.get(userRef)
  const currentPoints = Number(userDoc.data()?.totalPoints || 0)
  const nextPoints = Math.max(0, currentPoints - pointsToExpire)

  transaction.update(userRef, {
    totalPoints: nextPoints,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  })

  const expirationHistoryRef = historyRef.doc()
  transaction.set(expirationHistoryRef, {
    type: 'expired',
    points: pointsToExpire,
    description: `Vencimiento automático de ${pointsToExpire} punto(s)`,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  })

  return pointsToExpire
}

/**
 * Calcula cuántas pizzas se obtienen con X puntos
 */
export function calculatePizzasFromPoints(points: number): number {
  if (points >= 2400) return 1
  if (points >= 2000) return 1
  return 0
}

export function calculateVoucherDiscountForSubtotal(
  voucher: FirebaseFirestore.DocumentData,
  subtotal: number
): {
  success: boolean
  error?: string
  discount?: number
  rewardLabel?: string
} {
  const rewardType = String(voucher?.rewardType || 'fixed_discount') as RewardType
  const minimumOrderAmount = Number(voucher?.minimumOrderAmount || 0)
  const discountAmount = Number(voucher?.discountAmount || 0)

  if (minimumOrderAmount > 0 && subtotal < minimumOrderAmount) {
    return {
      success: false,
      error: `Este voucher requiere una compra mínima de $${minimumOrderAmount.toLocaleString('es-CL')}`,
    }
  }

  if (discountAmount <= 0) {
    return {
      success: false,
      error: 'El voucher no tiene un descuento válido.',
    }
  }

  if (rewardType === 'pizza_cap') {
    return {
      success: true,
      discount: Math.min(subtotal, discountAmount),
      rewardLabel: voucher?.rewardLabel || `Pizza gratis hasta $${discountAmount.toLocaleString('es-CL')}`,
    }
  }

  return {
    success: true,
    discount: Math.min(subtotal, discountAmount),
    rewardLabel: voucher?.rewardLabel || `$${discountAmount.toLocaleString('es-CL')} de descuento`,
  }
}

/**
 * Obtiene información de puntos del usuario
 */
export async function getUserPoints(userId: string): Promise<{
  totalPoints: number
  pizzasAvailable: number
  lastEarned?: Date
}> {
  try {
    const db = admin.firestore()
    const userDoc = await db.collection('users').doc(userId).get()

    if (!userDoc.exists) {
      return {
        totalPoints: 0,
        pizzasAvailable: 0,
      }
    }

    const userData = userDoc.data()
    const totalPoints = userData?.totalPoints || 0

    return {
      totalPoints,
      pizzasAvailable: calculatePizzasFromPoints(totalPoints),
      lastEarned: userData?.lastEarned?.toDate?.(),
    }
  } catch (error) {
    logger.error('Error getting user points:', error)
    return {
      totalPoints: 0,
      pizzasAvailable: 0,
    }
  }
}

/**
 * VALIDA un voucher sin marcarlo como usado
 * Se llama cuando se crea la orden para verificar que es válido
 * Se ejecuta DENTRO de una transacción
 */
export async function validateVoucher(
  userId: string,
  voucherId: string,
  transaction: FirebaseFirestore.Transaction
): Promise<{
  success: boolean
  error?: string
  voucher?: FirebaseFirestore.DocumentData
}> {
  try {
    const db = admin.firestore()
    const voucherRef = db.collection('users').doc(userId).collection('vouchers').doc(voucherId)

    // Leer el voucher usando la transacción
    const voucherDoc = await transaction.get(voucherRef)

    if (!voucherDoc.exists) {
      logger.warn('Voucher not found', { userId, voucherId })
      return {
        success: false,
        error: 'Voucher no encontrado',
      }
    }

    const voucher = voucherDoc.data()

    // Validar que no está usado
    if (voucher?.status === 'used') {
      logger.warn('Voucher already used', { userId, voucherId })
      return {
        success: false,
        error: 'Este voucher ya ha sido utilizado',
      }
    }

    // Validar que no está expirado
    if (voucher?.status === 'expired') {
      logger.warn('Voucher expired', { userId, voucherId })
      return {
        success: false,
        error: 'Este voucher ha expirado',
      }
    }

    // Validar fecha de expiración
    const expiresAt = voucher?.expiresAt?.toDate?.() || voucher?.expiresAt
    if (expiresAt && new Date(expiresAt) < new Date()) {
      logger.warn('Voucher date expired', { userId, voucherId, expiresAt })
      // NO actualizamos el status aquí - solo validamos
      return {
        success: false,
        error: 'Este voucher ha expirado',
      }
    }

    logger.info('Voucher valid', { userId, voucherId })

    return {
      success: true,
      voucher,
    }
  } catch (error) {
    logger.error('Error validating voucher:', error)
    return {
      success: false,
      error: 'Error procesando el voucher',
    }
  }
}

/**
 * MARCA un voucher como usado
 * Se llama DESPUÉS de confirmar el pago exitoso
 * Se ejecuta DENTRO de una transacción
 */
export async function markVoucherAsUsed(
  userId: string,
  voucherId: string,
  transaction: FirebaseFirestore.Transaction
): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const db = admin.firestore()
    const voucherRef = db.collection('users').doc(userId).collection('vouchers').doc(voucherId)

    // Leer el voucher usando la transacción para verificar que sigue siendo válido
    const voucherDoc = await transaction.get(voucherRef)

    if (!voucherDoc.exists) {
      logger.error('Voucher not found when marking as used', { userId, voucherId })
      return {
        success: false,
        error: 'Voucher no encontrado',
      }
    }

    const voucher = voucherDoc.data()

    // Validaciones finales antes de marcar como usado
    if (voucher?.status === 'used') {
      logger.warn('Voucher already marked as used', { userId, voucherId })
      return {
        success: false,
        error: 'Este voucher ya ha sido utilizado',
      }
    }

    // Marcar como usado dentro de la transacción
    transaction.update(voucherRef, {
      status: 'used',
      usedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    logger.info('Voucher marked as used', { userId, voucherId })

    return {
      success: true,
    }
  } catch (error) {
    logger.error('Error marking voucher as used:', error)
    return {
      success: false,
      error: 'Error procesando el voucher',
    }
  }
}

/**
 * VALIDA y marca un voucher como usado (función antigua - DEPRECADA)
 * Se queda aquí por compatibilidad pero NO debería usarse
 */
export async function validateAndMarkVoucherAsUsed(
  userId: string,
  voucherId: string,
  transaction: FirebaseFirestore.Transaction
): Promise<{
  success: boolean
  error?: string
}> {
  logger.warn('validateAndMarkVoucherAsUsed is deprecated, use validateVoucher and markVoucherAsUsed separately')
  // Simplemente validar por ahora
  return validateVoucher(userId, voucherId, transaction)
}

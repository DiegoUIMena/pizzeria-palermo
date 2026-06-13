/**
 * Cloud Functions para Pizzería Palermo
 * Fase 2: Backend Básico con Validaciones
 * Fase 3: Integración Webpay Plus con transacciones atómicas
 * Fase 4: Validación de vouchers y sistema de puntos
 *
 * Funciones implementadas:
 * - calculatePrice: Calcular precio de pedido
 * - createOrder: Crear pedido con validaciones (TRANSACCIÓN ATÓMICA)
 * - updateOrderStatus: Actualizar estado de pedido (solo admin)
 * - initWebpayTransaction: Iniciar transacción de pago Webpay
 * - confirmWebpayTransaction: Confirmar pago Webpay (TRANSACCIÓN ATÓMICA)
 * - cleanupAbandonedOrders: Limpiar pedidos huérfanos (SCHEDULED)
 * - refundOrder: Reembolsar pedido Webpay (Solo admin)
 * - Fase 4: Validación y aplicación de vouchers en órdenes
 */

import * as admin from "firebase-admin";
import {onCall, HttpsError, onRequest} from "firebase-functions/v2/https";
import {onSchedule} from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import * as crypto from "crypto";

// Importar servicios
import {
  validateInventoryForOrder,
  consumeInventoryForOrder,
  restoreInventoryForOrder,
} from "./services/inventory.service";
import {
  calculateOrderTotal,
} from "./services/pricing.service";
import {
  createWebpayTransaction,
  confirmWebpayTransaction as confirmWebpayService,
  refundWebpayTransaction,
} from "./services/webpay.service";
import {sendWelcomeEmail, sendRefundNotificationEmail} from "./services/email.service";
import {
  sendWelcomeWhatsApp,
  sendRefundNotificationWhatsApp,
  sendOrderReadyNotificationWhatsApp,
  sendCustomWhatsAppMessage,
  isValidPhoneNumber,
} from "./services/whatsapp.service";
import {CreateOrderData} from "./types/orders";

// Inicializar Firebase Admin (solo una vez)
if (!admin.apps.length) {
  admin.initializeApp();
}

const GUEST_WEBPAY_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutos para validar vouchers
const GUEST_WEBPAY_MAX_INIT_ATTEMPTS = 3;
const ACTIVE_GUEST_TRACKING_STATUSES = new Set([
  "Pago Pendiente",
  "Pendiente",
  "En preparación",
  "En camino",
  "Pedido Listo",
]);

const RATE_LIMIT_CONFIG = {
  createOrder: {
    windowMs: 10 * 60 * 1000,
    maxRequests: 12,
    blockMs: 15 * 60 * 1000,
  },
  initWebpayTransaction: {
    windowMs: 10 * 60 * 1000,
    maxRequests: 8,
    blockMs: 20 * 60 * 1000,
  },
} as const;

function getClientIp(request: any): string {
  const rawRequest = request?.rawRequest;
  const forwarded = rawRequest?.headers?.["x-forwarded-for"];

  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }

  if (Array.isArray(forwarded) && forwarded.length > 0) {
    const first = String(forwarded[0] || "").trim();
    if (first) {
      return first;
    }
  }

  return rawRequest?.ip || rawRequest?.socket?.remoteAddress || "unknown";
}

async function enforceIpRateLimit(
  request: any,
  endpoint: keyof typeof RATE_LIMIT_CONFIG
): Promise<void> {
  const ip = getClientIp(request);
  if (!ip || ip === "unknown") {
    return;
  }

  const config = RATE_LIMIT_CONFIG[endpoint];
  const db = admin.firestore();
  const now = Date.now();
  const ipHash = crypto.createHash("sha256").update(ip).digest("hex");
  const ref = db.collection("security_rate_limits").doc(`${endpoint}_${ipHash}`);

  let blockedUntil = 0;

  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);

    if (!snap.exists) {
      transaction.set(ref, {
        endpoint,
        ipHash,
        count: 1,
        windowStart: now,
        blockUntil: 0,
        updatedAt: new Date(now).toISOString(),
      });
      return;
    }

    const data = snap.data() || {};
    const windowStart = Number(data.windowStart || now);
    const count = Number(data.count || 0);
    const currentBlockUntil = Number(data.blockUntil || 0);

    if (currentBlockUntil > now) {
      blockedUntil = currentBlockUntil;
      transaction.update(ref, {
        updatedAt: new Date(now).toISOString(),
      });
      return;
    }

    const isWindowExpired = now - windowStart >= config.windowMs;
    const nextWindowStart = isWindowExpired ? now : windowStart;
    const nextCount = isWindowExpired ? 1 : count + 1;

    const shouldBlock = nextCount > config.maxRequests;
    const nextBlockUntil = shouldBlock ? now + config.blockMs : 0;

    if (shouldBlock) {
      blockedUntil = nextBlockUntil;
    }

    transaction.update(ref, {
      count: nextCount,
      windowStart: nextWindowStart,
      blockUntil: nextBlockUntil,
      updatedAt: new Date(now).toISOString(),
    });
  });

  if (blockedUntil > now) {
    const retryAfterSeconds = Math.max(1, Math.ceil((blockedUntil - now) / 1000));
    throw new HttpsError(
      "resource-exhausted",
      `Demasiados intentos desde tu red. Intenta nuevamente en ${retryAfterSeconds} segundos.`
    );
  }
}

function hashGuestAccessToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function safeCompareHash(a: string, b: string): boolean {
  try {
    const aBuffer = Buffer.from(a, "hex");
    const bBuffer = Buffer.from(b, "hex");
    if (aBuffer.length !== bBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(aBuffer, bBuffer);
  } catch {
    return false;
  }
}

function isValidReturnUrl(returnUrl: string): boolean {
  try {
    const parsed = new URL(returnUrl);
    const isHttps = parsed.protocol === "https:";
    const isLocalhost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    return isHttps || isLocalhost;
  } catch {
    return false;
  }
}

function normalizePhoneForLookup(value: string): string {
  return String(value || "").replace(/\D/g, "");
}

// ==================================================
// FUNCION AUXILIAR: Procesar cajas de empaque
// ==================================================
function processBoxesInventory(
  db: admin.firestore.Firestore,
  items: any[],
  transactionOrBatch: admin.firestore.Transaction | admin.firestore.WriteBatch,
  isRestore: boolean = false
) {
  let familiar = 0, mediana = 0, individual = 0;
  items.forEach((item: any) => {
    const nombre = String(item.nombre || "").toLowerCase();
    const size = String(item.size || "").toLowerCase();
    const cantidad = Number(item.cantidad || 1);
    
    if (nombre.includes("gauchito")) {
      individual += cantidad;
    } else if (size === "mediana" || nombre.includes("mediana")) {
      mediana += cantidad;
    } else if (size === "familiar" || nombre.includes("familiar")) {
      familiar += cantidad;
    } else {
      // Si el producto viene del menú principal y no trae la propiedad "size",
      // verificamos que no sea un acompañamiento o bebida. Si no lo es, asumimos Pizza Familiar.
      const isAgregadoOBebida = 
        nombre.includes("lata") || nombre.includes("botella") || 
        nombre.includes("lipton") || nombre.includes("coca cola") || 
        nombre.includes("salsa") || nombre.includes("bbq") || 
        nombre.includes("ajo") || nombre.includes("pesto") || 
        nombre.includes("chimichurri") || nombre.includes("rollito") || 
        nombre.includes("canela");

      if (!isAgregadoOBebida) {
        familiar += cantidad;
      }
    }
  });

  if (familiar === 0 && mediana === 0 && individual === 0) return;

  const cajasRef = db.collection("settings").doc("cajas_config");
  const multiplier = isRestore ? 1 : -1;
  const tOrB = transactionOrBatch as any; // Typecast para evitar TS2349 por incompatibilidad de firmas en union type

  const updates: any = {
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  if (familiar > 0) updates.stockFamiliar = admin.firestore.FieldValue.increment(familiar * multiplier);
  if (mediana > 0) updates.stockMediana = admin.firestore.FieldValue.increment(mediana * multiplier);
  if (individual > 0) updates.stockIndividual = admin.firestore.FieldValue.increment(individual * multiplier);

  tOrB.set(cajasRef, updates, { merge: true });
}

// ==================================================
// FUNCTION 1: Calcular Precio de Pedido
// ==================================================
export const calculatePrice = onCall(async (request) => {
  const {items, tipoEntrega, direccion, discountCode} = request.data;

  logger.info("calculatePrice called", {
    itemsCount: items?.length,
    tipoEntrega,
  });

  // Validar datos de entrada
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new HttpsError("invalid-argument", "Items vacíos o inválidos");
  }

  if (!tipoEntrega || !["Delivery", "Retiro"].includes(tipoEntrega)) {
    throw new HttpsError(
      "invalid-argument",
      "Tipo de entrega inválido"
    );
  }

  try {
    const calculation = await calculateOrderTotal(
      items,
      tipoEntrega,
      direccion
    );

    let discountAmount = 0;
    let discountError = undefined;

    if (discountCode) {
      const db = admin.firestore();
      const normalizedCode = String(discountCode).trim().toUpperCase();
      const codesSnap = await db.collection("promociones").where("code", "==", normalizedCode).get();

      if (!codesSnap.empty) {
        const promo = codesSnap.docs[0].data();
        if (!promo.active) {
          discountError = "Este código está inactivo";
        } else if (promo.expirationDate && new Date(promo.expirationDate) < new Date()) {
          discountError = "Este código ha expirado";
        } else if (promo.minAmount && calculation.subtotal < promo.minAmount) {
          discountError = `Requiere compra mínima de $${promo.minAmount.toLocaleString('es-CL')}`;
        } else if (promo.maxUses && (promo.currentUses || 0) >= promo.maxUses) {
          discountError = "Límite de usos alcanzado para este código";
        } else {
          // Código totalmente válido
          if (promo.type === 'percentage') {
            discountAmount = Math.round((calculation.subtotal * (promo.value || 0)) / 100);
          } else {
            discountAmount = promo.value || 0;
          }
        }
      } else {
        discountError = "Código promocional no válido o no existe";
      }
    }

    return {
      success: true,
      ...calculation,
      total: calculation.total,
      discountAmount,
      discountError
    };
  } catch (error) {
    logger.error("Error calculating price:", error);
    throw new HttpsError(
      "internal",
      "Error al calcular precio"
    );
  }
});

// Versión HTTP para pruebas externas/controladas con CORS
export const calculatePriceHttp = onRequest(
  {
    cors: true,
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({success: false, error: "Método no permitido"});
      return;
    }

    try {
      const payload = req.body?.data || req.body || {};
      const {items, tipoEntrega, direccion} = payload;

      if (!items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({success: false, error: "Items vacíos o inválidos"});
        return;
      }

      if (!tipoEntrega || !["Delivery", "Retiro"].includes(tipoEntrega)) {
        res.status(400).json({success: false, error: "Tipo de entrega inválido"});
        return;
      }

      const calculation = await calculateOrderTotal(items, tipoEntrega, direccion);
      res.status(200).json({
        success: true,
        ...calculation,
      });
    } catch (error) {
      logger.error("Error in calculatePriceHttp:", error);
      res.status(500).json({success: false, error: "Error al calcular precio"});
    }
  }
);

// ==================================================
// FUNCTION 2: Crear Pedido con Validaciones
// ==================================================
export const createOrder = onCall(async (request) => {
  await enforceIpRateLimit(request, "createOrder");

  const orderData: CreateOrderData = request.data;
  const isGuestOrder = orderData?.customerType === "guest";
  const guestAccessToken = isGuestOrder ? crypto.randomBytes(32).toString("hex") : undefined;
  const guestAccessTokenHash = guestAccessToken ? hashGuestAccessToken(guestAccessToken) : undefined;
  const guestTokenExpiresAt = guestAccessToken ? new Date(Date.now() + GUEST_WEBPAY_TOKEN_TTL_MS).toISOString() : undefined;

  // 1. Verificar autenticación o flujo de invitado explícito
  if (!request.auth && !isGuestOrder) {
    throw new HttpsError("unauthenticated", "Usuario no autenticado");
  }

  const requestUserId = request.auth?.uid;
  const normalizedUserId = requestUserId || orderData.userId || `guest_${Date.now()}`;
  const isSyntheticGuestId = normalizedUserId.startsWith("guest_");

  logger.info("createOrder called", {
    userId: requestUserId || normalizedUserId,
    customerType: isGuestOrder ? "guest" : "registered",
    itemsCount: orderData.items?.length,
  });

  // 2. VALIDACIÓN CRÍTICA: Verificar horario comercial
  try {
    const db = admin.firestore();
    const businessHoursRef = db.collection("settings").doc("businessHours");
    const businessHoursDoc = await businessHoursRef.get();

    if (businessHoursDoc.exists) {
      const businessHours = businessHoursDoc.data();
      
      // PRIMERO: Verificar si está cerrado manualmente (control del administrador)
      if (businessHours?.isOpen === false) {
        logger.warn("Order rejected - manually closed by admin");
        
        throw new HttpsError(
          "failed-precondition",
          "El local está cerrado temporalmente. Por favor intenta más tarde."
        );
      }
      
      // SEGUNDO: Verificar horario configurado (solo si está abierto manualmente)
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTimeInMinutes = currentHour * 60 + currentMinute;

      const [openHour, openMinute] = (businessHours?.openingTime || "18:00")
        .split(":")
        .map(Number);
      const [closeHour, closeMinute] = (businessHours?.closingTime || "23:30")
        .split(":")
        .map(Number);

      const openingTime = openHour * 60 + openMinute;
      const closingTime = closeHour * 60 + closeMinute;

      let isOpen = false;

      if (closingTime > openingTime) {
        // Horario normal (no cruza medianoche)
        isOpen =
          currentTimeInMinutes >= openingTime &&
          currentTimeInMinutes < closingTime;
      } else {
        // Horario que cruza medianoche
        isOpen =
          currentTimeInMinutes >= openingTime ||
          currentTimeInMinutes < closingTime;
      }

      if (!isOpen) {
        logger.warn("Order rejected - outside business hours", {
          currentTime: `${currentHour}:${currentMinute}`,
          businessHours: `${businessHours?.openingTime} - ${businessHours?.closingTime}`,
        });

        throw new HttpsError(
          "failed-precondition",
          `Fuera de horario comercial. Horario de atención: ${businessHours?.openingTime} - ${businessHours?.closingTime}`
        );
      }
    }
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error; // Re-throw si ya es un HttpsError
    }
    logger.error("Error checking business hours:", error);
    // Si hay error leyendo horarios, permitir el pedido (fail-safe)
  }

  // 3. Validar datos básicos
  if (!orderData.items || orderData.items.length === 0) {
    throw new HttpsError("invalid-argument", "El pedido no tiene items");
  }

  if (!orderData.cliente?.nombre || !orderData.cliente?.telefono) {
    throw new HttpsError(
      "invalid-argument",
      "Datos del cliente incompletos"
    );
  }

  // 4. Validar ownership solo para usuarios autenticados no guest
  if (requestUserId && !isGuestOrder && orderData.userId && orderData.userId !== requestUserId) {
    throw new HttpsError(
      "permission-denied",
      "No puedes crear pedidos para otro usuario"
    );
  }

  try {
    const db = admin.firestore();

    // ✅ MEJORA: Usar transacción atómica para garantizar consistencia
    const result = await db.runTransaction(async (transaction) => {
      logger.info("Starting atomic transaction for order creation...");

      // 5. PRIMERO: Hacer todas las lecturas necesarias
      // Validar inventario DENTRO de la transacción
      // Esto asegura que nadie más pueda modificar el stock mientras validamos
      const inventoryValidation = await validateInventoryForOrder(
        orderData.items,
        transaction // Pasar la transacción para lecturas consistentes
      );

      if (!inventoryValidation.success) {
        // Si no hay stock, la transacción se cancela automáticamente
        throw new HttpsError(
          "failed-precondition",
          "INVENTORY_UNAVAILABLE",
          inventoryValidation.insufficientItems
        );
      }

      // 5.4 Resolver voucherId desde voucherCode si viene solo código
      // Esto blinda el flujo ante payloads incompletos del frontend.
      if (
        !orderData.voucherId &&
        orderData.voucherCode &&
        !isGuestOrder &&
        !isSyntheticGuestId
      ) {
        const normalizedCode = String(orderData.voucherCode).trim().toUpperCase();
        if (normalizedCode) {
          const vouchersSnap = await transaction.get(
            db.collection("users").doc(normalizedUserId).collection("vouchers")
          );

          const matched = vouchersSnap.docs.find((d) => {
            const data = d.data();
            const code = String(
              data.code || d.id.replace(/[^a-zA-Z0-9]/g, "").slice(-8).toUpperCase()
            ).toUpperCase();
            return code === normalizedCode;
          });

          if (matched) {
            orderData.voucherId = matched.id;
            logger.info("Resolved voucherId from voucherCode", {
              userId: normalizedUserId,
              voucherCode: normalizedCode,
              voucherId: matched.id,
            });
          } else {
            logger.warn("Voucher code sent but not found for user", {
              userId: normalizedUserId,
              voucherCode: normalizedCode,
            });
          }
        }
      }

      // 5.6 Calcular precio real en el servidor
      logger.info("Calculating server-side price...");
      const priceCalculation = await calculateOrderTotal(
        orderData.items,
        orderData.tipoEntrega,
        orderData.direccion
      );

      let voucherDiscount = 0;
      let voucherRewardLabel: string | undefined;

      const orderHasPromoOrCombo = orderData.items.some((item) => {
        const itemName = String(item.nombre || "").toLowerCase();
        const pizzaType = String(item.pizzaType || "").toLowerCase();
        return itemName.includes("promo") || itemName.includes("combo") || pizzaType === "promo";
      });

      let discountCode: string | undefined;
      let discountFromCode = 0;
      let promoRefToUpdate: admin.firestore.DocumentReference | undefined;
      let promoCurrentUses = 0;

      if (orderData.discountCode) {
        const normalizedDiscountCode = String(orderData.discountCode).trim().toUpperCase();
        const codesSnap = await transaction.get(db.collection("promociones").where("code", "==", normalizedDiscountCode));

        if (codesSnap.empty) {
          throw new HttpsError(
            "failed-precondition",
            "Código de descuento inválido o no existe"
          );
        }

        const promoDoc = codesSnap.docs[0];
        const promoData = promoDoc.data();
        promoRefToUpdate = promoDoc.ref;
        promoCurrentUses = promoData.currentUses || 0;

        if (!promoData.active) {
          throw new HttpsError("failed-precondition", "Este código de descuento está inactivo");
        }

        if (promoData.expirationDate && new Date(promoData.expirationDate) < new Date()) {
          throw new HttpsError("failed-precondition", "Este código de descuento ha expirado");
        }

        if (promoData.minAmount && priceCalculation.subtotal < promoData.minAmount) {
          throw new HttpsError("failed-precondition", `Este código requiere una compra mínima de $${promoData.minAmount.toLocaleString('es-CL')}`);
        }

        if (promoData.maxUses && promoCurrentUses >= promoData.maxUses) {
          throw new HttpsError("failed-precondition", "Este código ha alcanzado su límite de usos");
        }

        if (orderData.voucherId || orderData.voucherCode) {
          throw new HttpsError(
            "failed-precondition",
            "No puedes combinar códigos de descuento con vouchers"
          );
        }

        discountCode = normalizedDiscountCode;
        orderData.discountCode = normalizedDiscountCode;
        if (promoData.type === 'percentage') {
          discountFromCode = Math.round((priceCalculation.subtotal * (promoData.value || 0)) / 100);
        } else if (promoData.type === 'amount') {
          discountFromCode = promoData.value || 0;
        }
      }

      // 5.7 Validar voucher si está presente (solo para usuarios autenticados)
      // ⚠️ IMPORTANTE: Solo VALIDAMOS aquí, NO marcamos como usado
      // El voucher se marcará como usado DESPUÉS de confirmar el pago exitosamente
      if (orderData.voucherId && !isGuestOrder && !isSyntheticGuestId) {
        if (orderHasPromoOrCombo) {
          throw new HttpsError(
            "failed-precondition",
            "Los vouchers de Puntos Palermo no aplican junto a promociones o combos con descuento"
          );
        }

        logger.info("Validating voucher (NOT marking as used yet)", { userId: normalizedUserId, voucherId: orderData.voucherId });
        
        const { validateVoucher, markVoucherAsUsed, calculateVoucherDiscountForSubtotal } = await import('./utils/points-system.js');
        const voucherValidation = await validateVoucher(
          normalizedUserId,
          orderData.voucherId,
          transaction
        );
        
        if (!voucherValidation.success) {
          logger.warn("Voucher validation failed", { 
            userId: normalizedUserId, 
            voucherId: orderData.voucherId,
            error: voucherValidation.error 
          });
          throw new HttpsError(
            "failed-precondition",
            voucherValidation.error || "Voucher no válido"
          );
        }

        if (!voucherValidation.voucher) {
          throw new HttpsError(
            "failed-precondition",
            "No se pudo leer la configuración del voucher"
          );
        }

        const voucherDiscountResult = calculateVoucherDiscountForSubtotal(
          voucherValidation.voucher,
          priceCalculation.subtotal
        );

        if (!voucherDiscountResult.success) {
          throw new HttpsError(
            "failed-precondition",
            voucherDiscountResult.error || "El voucher no aplica para este pedido"
          );
        }

        voucherDiscount = Math.max(0, Math.round(voucherDiscountResult.discount || 0));
        voucherRewardLabel = voucherDiscountResult.rewardLabel;

        // Para métodos no-Webpay, bloquear reutilización de inmediato.
        // En Webpay se marca en confirmWebpayTransaction al aprobar pago.
        const isWebpayOrder = orderData.metodoPago === "Webpay Plus";
        if (!isWebpayOrder) {
          const voucherMarkResult = await markVoucherAsUsed(
            normalizedUserId,
            orderData.voucherId,
            transaction
          );

          if (!voucherMarkResult.success) {
            throw new HttpsError(
              "failed-precondition",
              voucherMarkResult.error || "No se pudo reservar el voucher"
            );
          }

          logger.info("Voucher marked as used in createOrder for non-webpay", {
            userId: normalizedUserId,
            voucherId: orderData.voucherId,
            metodoPago: orderData.metodoPago,
          });
        }
      }

      const finalTotal = Math.max(0, priceCalculation.total - voucherDiscount - discountFromCode);

      // 6. Generar número de pedido único
      const orderNumber = Math.floor(10000 + Math.random() * 90000);

      // 7. Determinar el estado inicial según el método de pago
      const initialEstado = orderData.metodoPago === "Webpay Plus" 
        ? "Pago Pendiente" 
        : "Pendiente";

      // Para Webpay, el consumo se hace al confirmar el pago.
      // Para otros métodos, se descuenta inmediatamente al vender.
      const shouldConsumeInventoryOnCreate = orderData.metodoPago !== "Webpay Plus";

      // 8. AHORA: Hacer todas las escrituras
      const now = new Date();
      const orderRef = db.collection("orders").doc(); // Generar ID primero

      if (shouldConsumeInventoryOnCreate) {
        logger.info("Consuming inventory at order creation for non-webpay order", {
          orderId: orderRef.id,
          orderNumber,
          metodoPago: orderData.metodoPago,
        });

        const consumeResult = await consumeInventoryForOrder(
          orderData.items,
          orderRef.id,
          orderNumber,
          transaction
        );

        if (!consumeResult.success) {
          logger.error("Error consuming inventory in createOrder:", consumeResult.error);
          throw new HttpsError(
            "failed-precondition",
            consumeResult.error || "Error al consumir inventario"
          );
        }
        
        // 📦 Novedad: Descontar cajas de forma segura en la misma transacción
        processBoxesInventory(db, orderData.items, transaction, false);
      }
      
      const newOrder = {
        ...orderData,
        userId: normalizedUserId,
        customerType: isGuestOrder ? "guest" : "registered",
        ...(
          orderData.voucherId &&
          orderData.metodoPago !== "Webpay Plus" && {
            voucherProcessed: true,
            voucherProcessedAt: now.toISOString(),
          }
        ),
        ...(isGuestOrder && {
          guestCheckout: {
            webpayTokenHash: guestAccessTokenHash,
            webpayTokenExpiresAt: guestTokenExpiresAt,
            webpayInitAttempts: 0,
            webpayTokenCreatedAt: now.toISOString(),
          }
        }),
        orderNumber,
        total: finalTotal,
        estado: initialEstado,
        fechaCreacion: now.toLocaleString("es-CL", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "America/Santiago",
        }),
        timestamps: {
          created: now.toISOString(),
        },
        inventoryProcessed: shouldConsumeInventoryOnCreate,
        inventoryStatus: shouldConsumeInventoryOnCreate ? "processed" : "pending",
        priceCalculation: {
          subtotal: priceCalculation.subtotal,
          deliveryFee: priceCalculation.deliveryFee,
          voucherDiscount,
          ...(discountCode ? {discountCode} : {}),
          ...(discountFromCode ? {discountAmount: discountFromCode} : {}),
          ...(voucherRewardLabel ? {voucherRewardLabel} : {}),
          total: finalTotal,
        },
      };

      // En no-Webpay, el inventario ya se consumió en esta transacción.
      // En Webpay, se consumirá al confirmar pago en confirmWebpayTransaction.

      // ✅ CRÍTICO: Actualizar contador de uso del código si se aplicó uno exitosamente
      if (promoRefToUpdate) {
        transaction.update(promoRefToUpdate, {
          currentUses: promoCurrentUses + 1,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      // ✅ CRÍTICO: Escribir pedido en la transacción AL FINAL
      transaction.set(orderRef, newOrder);

      logger.info("Transaction prepared successfully", {orderId: orderRef.id});

      return {
        orderId: orderRef.id,
        orderNumber,
        total: finalTotal,
        guestAccessToken,
        guestTokenExpiresAt,
      };
    });

    // Si llegamos aquí, la transacción fue exitosa
    logger.info("Order created successfully (atomic)", {orderId: result.orderId});

    return {
      success: true,
      id: result.orderId,
      orderNumber: result.orderNumber,
      total: result.total,
      guestAccessToken: result.guestAccessToken,
      guestTokenExpiresAt: result.guestTokenExpiresAt,
    };
  } catch (error) {
    logger.error("Error creating order:", error);
    
    // Propagar errores específicos de inventario
    if (error instanceof HttpsError && error.code === "failed-precondition") {
      if (error.message === "INVENTORY_UNAVAILABLE") {
        return {
          success: false,
          error: "INVENTORY_UNAVAILABLE",
          details: error.details,
        };
      }

      return {
        success: false,
        error: error.message || "FAILED_PRECONDITION",
        details: error.details,
      };
    }
    
    throw new HttpsError(
      "internal",
      "Error al crear el pedido"
    );
  }
});

// ==================================================
// FUNCTION 3: Actualizar Estado de Pedido (Solo Admin)
// ==================================================
export const updateOrderStatus = onCall(async (request) => {
  // 1. Verificar autenticación
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuario no autenticado");
  }

  const {orderId, newStatus} = request.data;

  logger.info("updateOrderStatus called", {
    orderId,
    newStatus,
    userId: request.auth.uid,
  });

  // 2. Validar que sea admin
  const db = admin.firestore();
  const userDoc = await db
    .collection("users")
    .doc(request.auth.uid)
    .get();

  const userData = userDoc.data();
  if (!userData || (userData.role !== "admin" && userData.role !== "staff")) {
    throw new HttpsError(
      "permission-denied",
      "Solo administradores pueden actualizar pedidos"
    );
  }

  // 3. Validar datos
  if (!orderId || !newStatus) {
    throw new HttpsError(
      "invalid-argument",
      "orderId y newStatus son requeridos"
    );
  }

  const validStatuses = [
    "Pendiente",
    "En preparación",
    "En camino",
    "Pedido Listo",
    "Entregado",
    "Cancelado",
  ];
  if (!validStatuses.includes(newStatus)) {
    throw new HttpsError("invalid-argument", "Estado inválido");
  }

  try {
    const orderRef = db.collection("orders").doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      throw new HttpsError("not-found", "Pedido no encontrado");
    }

    const orderData = orderDoc.data();

    // 4. Actualizar estado
    const now = new Date();
    const updates: any = {
      estado: newStatus,
    };

    // Agregar timestamps según el estado
    switch (newStatus) {
    case "En preparación":
      updates["timestamps.preparing"] = now.toISOString();
      break;
    case "En camino":
      updates["timestamps.ready"] = now.toISOString();
      break;
    case "Pedido Listo":
      updates["timestamps.ready"] = now.toISOString();
      break;
    case "Entregado":
      updates["timestamps.delivered"] = now.toISOString();
      break;
    }

    // 5. ✅ CONSUMIR INVENTARIO cuando el admin ACEPTA el pedido
    // Esto sucede cuando:
    // - Se hace clic en "Aceptar" (cambia a "En preparación")
    // - O cuando se confirma un pago de Webpay
    if (
      newStatus === "En preparación" &&
      !orderData?.inventoryProcessed
    ) {
      logger.info("🍕 Admin aceptó el pedido - Consumiendo inventario...", {orderId});

      const consumeResult = await consumeInventoryForOrder(
        orderData?.items || [],
        orderId,
        orderData?.orderNumber
      );

      if (!consumeResult.success) {
        logger.error("❌ Error al consumir inventario:", consumeResult.error);
        throw new HttpsError(
          "failed-precondition",
          "Error al consumir inventario: " + (consumeResult.error || "Error desconocido")
        );
      }

      // 📦 Descontar cajas en el mismo flujo de aceptación manual
      const boxesBatch = db.batch();
      processBoxesInventory(db, orderData?.items || [], boxesBatch, false);
      await boxesBatch.commit();
      
      // Marcar inventario como procesado
      updates["inventoryProcessed"] = true;
      updates["inventoryStatus"] = "processed";
      logger.info("✅ Inventario consumido exitosamente");

      // ✅ SUMAR PUNTOS para órdenes NO Webpay cuando se ACEPTAN (para cash/transfer/etc)
      // Si es Webpay, los puntos ya se sumaron en confirmWebpayTransaction
      // Solo sumamos puntos si:
      // 1. No es una orden Webpay
      // 2. Es un cliente registrado (no guest)
      // 3. Los puntos aún no han sido sumados
      if (
        !orderData?.webpay?.token &&
        orderData?.userId &&
        orderData?.customerType !== 'guest' &&
        !orderData?.pointsAdded
      ) {
        logger.info("💰 Sumando puntos para orden de cash/transfer", {
          orderId,
          userId: orderData.userId,
          orderTotal: orderData.total
        });

        try {
          const { addPointsToUser } = await import('./utils/points-system.js');
          await addPointsToUser(orderData.userId, orderData.total, orderId);
          updates["pointsAdded"] = true;
          updates["pointsAddedAt"] = new Date().toISOString();
          logger.info("✅ Puntos sumados exitosamente para orden cash/transfer", {
            orderId,
            userId: orderData.userId
          });
        } catch (pointsError) {
          logger.error("❌ Error sumando puntos (no crítico):", pointsError);
          // No lanzamos error porque el admin ya aceptó la orden
        }
      }

      // ✅ MARCAR VOUCHER COMO USADO para órdenes NO Webpay (transferencia/efectivo)
      if (
        !orderData?.webpay?.token &&
        orderData?.userId &&
        orderData?.voucherId &&
        !orderData?.voucherProcessed
      ) {
        try {
          const voucherRef = db
            .collection('users')
            .doc(orderData.userId)
            .collection('vouchers')
            .doc(orderData.voucherId);

          const voucherDoc = await voucherRef.get();
          if (!voucherDoc.exists) {
            logger.warn('Voucher no encontrado al procesar orden no-webpay', {
              orderId,
              userId: orderData.userId,
              voucherId: orderData.voucherId,
            });
          } else {
            const voucherData = voucherDoc.data();
            if (voucherData?.status !== 'used') {
              await voucherRef.update({
                status: 'used',
                usedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              });
            }

            updates['voucherProcessed'] = true;
            updates['voucherProcessedAt'] = new Date().toISOString();
            logger.info('✅ Voucher marcado como usado en flujo no-webpay', {
              orderId,
              userId: orderData.userId,
              voucherId: orderData.voucherId,
            });
          }
        } catch (voucherError) {
          logger.error('❌ Error marcando voucher en flujo no-webpay', {
            orderId,
            userId: orderData.userId,
            voucherId: orderData.voucherId,
            error: voucherError,
          });
        }
      }
    }
    
    // 6. Si se CANCELA el pedido, marcar inventario como cancelado (sin consumir)
    if (newStatus === "Cancelado" && !orderData?.inventoryProcessed) {
      updates["inventoryStatus"] = "cancelled_before_processing";
      logger.info("❌ Pedido cancelado - Inventario NO consumido");
    }

    // 6.1 Si se CANCELA un pedido con inventario ya consumido, restaurar stock
    if (
      newStatus === "Cancelado" &&
      orderData?.inventoryProcessed &&
      orderData?.inventoryStatus !== "restored_on_cancel"
    ) {
      logger.info("🔄 Pedido cancelado con inventario procesado - restaurando stock", {
        orderId,
        previousStatus: orderData?.estado,
      });

      const restoreResult = await restoreInventoryForOrder(orderData?.items || []);
      if (!restoreResult.success) {
        throw new HttpsError(
          "failed-precondition",
          "No se pudo restaurar inventario al cancelar"
        );
      }
      
      // 📦 Restaurar cajas al cancelar un pedido procesado
      const boxesBatchRestore = db.batch();
      processBoxesInventory(db, orderData?.items || [], boxesBatchRestore, true);
      await boxesBatchRestore.commit();

      updates["inventoryProcessed"] = false;
      updates["inventoryStatus"] = "restored_on_cancel";
      updates["inventoryRestoredAt"] = now.toISOString();
      logger.info("✅ Inventario restaurado por cancelación de pedido", {orderId});
    }

    // Al cancelar un pedido pagado CON WEBPAY, ejecutar reembolso antes de cambiar estado
    if (
      newStatus === "Cancelado" && 
      orderData?.paymentStatus === "paid" &&
      orderData?.webpay?.token // ✅ SOLO reembolsar si fue pagado con Webpay
    ) {
      // Ejecutar reembolso
      // (Solo admin puede cancelar)
      try {
        const {refundType, response} = await refundWebpayTransaction(
          orderData.webpay.token,
          orderData.orderNumber.toString(),
          orderData.webpay.amount || orderData.total
        );
        updates["webpay.refund"] = {
          refundType,
          response,
          refundedAt: new Date().toISOString(),
          refundedBy: request.auth.uid,
        };
        updates["paymentStatus"] = "refunded";

        // 📧 ENVIAR NOTIFICACIÓN DE REEMBOLSO AL CLIENTE
        if (orderData.cliente?.email && orderData.cliente?.nombre) {
          // Enviar email de reembolso (no bloqueante)
          sendRefundNotificationEmail(
            orderData.cliente.email,
            orderData.cliente.nombre,
            orderData.orderNumber,
            orderData.total,
            orderData.webpay.token,
            refundType
          ).catch((err) => {
            logger.error("Error enviando email de reembolso:", err);
          });

          // Enviar WhatsApp de reembolso (no bloqueante)
          if (orderData.cliente?.telefono && isValidPhoneNumber(orderData.cliente.telefono)) {
            sendRefundNotificationWhatsApp(
              orderData.cliente.telefono,
              orderData.cliente.nombre,
              orderData.orderNumber,
              orderData.total,
              orderData.webpay.token,
              refundType
            ).catch((err) => {
              logger.error("Error enviando WhatsApp de reembolso:", err);
            });
          }
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        throw new HttpsError("internal", "Error al reembolsar: " + errMsg);
      }
    }

    await orderRef.update(updates);

    const tipoEntrega = orderData?.tipoEntrega === "Delivery" ? "Delivery" : "Retiro";
    const shouldSendReadyMessage =
      (tipoEntrega === "Retiro" && newStatus === "Pedido Listo" && orderData?.estado !== "Pedido Listo") ||
      (tipoEntrega === "Delivery" && newStatus === "En camino" && orderData?.estado !== "En camino");

    if (
      shouldSendReadyMessage &&
      orderData?.cliente?.telefono &&
      isValidPhoneNumber(orderData.cliente.telefono)
    ) {
      sendOrderReadyNotificationWhatsApp(orderData.cliente.telefono, tipoEntrega).catch((err) => {
        logger.error("Error enviando WhatsApp de pedido listo:", err);
      });
    }

    logger.info("Order status updated successfully", {orderId, newStatus});

    return {
      success: true,
      orderId,
      newStatus,
    };
  } catch (error) {
    logger.error("Error updating order status:", error);

    if (error instanceof HttpsError) {
      throw error;
    }

    const errMsg = error instanceof Error ? error.message : String(error);
    throw new HttpsError(
      "internal",
      "Error al actualizar el pedido: " + errMsg
    );
  }
});

// ==================================================
// FUNCTION 4: Iniciar Transacción Webpay Plus
// ==================================================
export const initWebpayTransaction = onCall(async (request) => {
  await enforceIpRateLimit(request, "initWebpayTransaction");

  const {orderId, returnUrl, guestAccessToken} = request.data;
  const isAuthenticatedRequest = !!request.auth?.uid;

  logger.info("initWebpayTransaction called", {
    orderId,
    userId: request.auth?.uid || null,
    isAuthenticatedRequest,
  });

  // 2. Validar parámetros
  if (!orderId || !returnUrl) {
    throw new HttpsError(
      "invalid-argument",
      "orderId y returnUrl son requeridos"
    );
  }

  if (!isValidReturnUrl(returnUrl)) {
    throw new HttpsError("invalid-argument", "returnUrl inválida");
  }

  try {
    const db = admin.firestore();

    // 3. Verificar que el pedido existe y pertenece al usuario
    const orderRef = db.collection("orders").doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      throw new HttpsError("not-found", "Pedido no encontrado");
    }

    const orderData = orderDoc.data();

    if (!orderData) {
      throw new HttpsError("not-found", "Pedido no encontrado");
    }

    const isGuestOrder = orderData.customerType === "guest";

    if (isAuthenticatedRequest) {
      if (orderData.userId !== request.auth?.uid) {
        throw new HttpsError(
          "permission-denied",
          "No tienes permiso para pagar este pedido"
        );
      }
    } else {
      if (!isGuestOrder) {
        throw new HttpsError("unauthenticated", "Usuario no autenticado");
      }

      const guestCheckout = orderData.guestCheckout || {};
      const attempts = Number(guestCheckout.webpayInitAttempts || 0);

      if (attempts >= GUEST_WEBPAY_MAX_INIT_ATTEMPTS) {
        throw new HttpsError(
          "resource-exhausted",
          "Se alcanzó el máximo de intentos para iniciar pago"
        );
      }

      if (!guestAccessToken || typeof guestAccessToken !== "string") {
        await orderRef.update({
          "guestCheckout.webpayInitAttempts": admin.firestore.FieldValue.increment(1),
          "guestCheckout.lastFailedAttemptAt": new Date().toISOString(),
        });
        throw new HttpsError("permission-denied", "Token de acceso inválido");
      }

      const tokenExpiresAt = guestCheckout.webpayTokenExpiresAt;
      const tokenHash = guestCheckout.webpayTokenHash;

      if (!tokenExpiresAt || !tokenHash) {
        throw new HttpsError("permission-denied", "Checkout invitado no válido");
      }

      const isExpired = Date.now() > new Date(tokenExpiresAt).getTime();
      if (isExpired) {
        throw new HttpsError("permission-denied", "Token de invitado expirado");
      }

      const receivedHash = hashGuestAccessToken(guestAccessToken);
      const isValidToken = safeCompareHash(receivedHash, tokenHash);

      if (!isValidToken) {
        await orderRef.update({
          "guestCheckout.webpayInitAttempts": admin.firestore.FieldValue.increment(1),
          "guestCheckout.lastFailedAttemptAt": new Date().toISOString(),
        });
        throw new HttpsError("permission-denied", "Token de acceso inválido");
      }
    }

    // 4. Verificar que el pedido no esté ya pagado
    if (orderData.paymentStatus === "paid") {
      throw new HttpsError(
        "failed-precondition",
        "Este pedido ya fue pagado"
      );
    }

    if (orderData.webpay?.status === "pending" && orderData.webpay?.token) {
      throw new HttpsError(
        "failed-precondition",
        "Ya existe una transacción Webpay en curso para este pedido"
      );
    }

    // 5. Crear transacción con Webpay
    const buyOrder = orderData.orderNumber.toString();
    const sessionId = orderId;
    const amountToCharge = Math.round(Number(orderData.total || 0));

    if (!Number.isFinite(amountToCharge) || amountToCharge <= 0) {
      throw new HttpsError("failed-precondition", "Monto de pedido inválido");
    }

    const transaction = await createWebpayTransaction(
      buyOrder,
      sessionId,
      amountToCharge,
      returnUrl
    );

    // 6. Guardar información de la transacción en el pedido
    const webpayUpdate: Record<string, any> = {
      "webpay.token": transaction.token,
      "webpay.status": "pending",
      "webpay.createdAt": admin.firestore.FieldValue.serverTimestamp(),
      paymentStatus: "pending",
    };

    if (isGuestOrder) {
      webpayUpdate["guestCheckout.webpayInitAttempts"] = admin.firestore.FieldValue.increment(1);
      webpayUpdate["guestCheckout.lastSuccessfulInitAt"] = new Date().toISOString();
    }

    await orderRef.update(webpayUpdate);

    logger.info("Webpay transaction created", {
      orderId,
      token: transaction.token,
    });

    return {
      success: true,
      token: transaction.token,
      url: transaction.url,
    };
  } catch (error) {
    logger.error("Error creating Webpay transaction:", error);

    if (error instanceof HttpsError) {
      throw error;
    }

    throw new HttpsError(
      "internal",
      "Error al iniciar transacción con Webpay"
    );
  }
});

// ==================================================
// FUNCTION 5: Confirmar Transacción Webpay Plus
// ==================================================
export const confirmWebpayTransaction = onCall(async (request) => {
  const {token} = request.data;

  logger.info("confirmWebpayTransaction called", {token});

  // 1. Validar parámetros
  if (!token) {
    throw new HttpsError("invalid-argument", "Token es requerido");
  }

  try {
    // 2. Confirmar transacción con Webpay
    const transactionResult = await confirmWebpayService(token);

    logger.info("Webpay transaction result", {
      token,
      success: transactionResult.success,
      responseCode: transactionResult.responseCode,
    });

    // 3. Buscar el pedido por sessionId (orderId)
    const db = admin.firestore();
    const orderId = transactionResult.sessionId;
    const orderRef = db.collection("orders").doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      logger.error("Order not found for transaction", {token, orderId});
      throw new HttpsError("not-found", "Pedido no encontrado");
    }

    const orderData = orderDoc.data();

    // Verificar si el pedido ya fue procesado (evitar doble confirmación)
    if (orderData && orderData.paymentStatus === "paid") {
      logger.info("Order already confirmed, skipping update", {orderId});
      
      // Aún así, generar token de seguimiento si es guest (por si lo necesita)
      let trackingToken: string | undefined
      if (orderData && orderData.customerType === 'guest' && orderData.cliente?.email && orderData.cliente?.telefono) {
        const { generateGuestTrackingToken } = await import('./utils/guest-token.js')
        trackingToken = generateGuestTrackingToken(
          orderData.cliente.email,
          orderData.cliente.telefono,
          90
        )
      }
      
      return {
        success: true,
        orderId,
        responseCode: transactionResult.responseCode,
        authorizationCode: transactionResult.authorizationCode,
        amount: transactionResult.amount,
        cardDetail: transactionResult.cardDetail,
        trackingToken: trackingToken,
        isGuestOrder: orderData ? orderData.customerType === 'guest' : false,
      };
    }

    // 4. Actualizar estado del pedido Y consumir inventario (si exitoso) en transacción atómica
    await db.runTransaction(async (transaction) => {
      // ✅ PASO 1: TODAS LAS LECTURAS PRIMERO (antes de cualquier escritura)
      
      // Re-read order dentro de la transacción para evitar condiciones de carrera
      const freshOrderDoc = await transaction.get(orderRef);
      
      if (!freshOrderDoc.exists) {
        throw new HttpsError("not-found", "Pedido no encontrado");
      }

      const freshOrderData = freshOrderDoc.data();

      // Double-check: evitar doble procesamiento
      if (freshOrderData && freshOrderData.paymentStatus === "paid") {
        logger.warn("Order already paid within transaction", {orderId});
        return;
      }

      // Si el pago fue exitoso, leer ingredientes e items_menu AHORA (antes de writes)
      let inventorySnapshot: any = null;
      let itemsMenuSnapshot: any = null;
      let agregadosConfigSnapshot: any = null;
      let voucherDoc: any = null;
      
      if (transactionResult.success && freshOrderData && freshOrderData.items) {
        logger.info("Reading inventory and menu items for consumption...");
        inventorySnapshot = await transaction.get(db.collection("ingredientes"));
        itemsMenuSnapshot = await transaction.get(db.collection("items_menu"));
        agregadosConfigSnapshot = await transaction.get(
          db.collection("settings").doc("agregados_config")
        );
      }

      // ✅ LEER VOUCHER AL PRINCIPIO si existe (ANTES de cualquier escritura)
      if (freshOrderData?.voucherId && freshOrderData?.userId) {
        logger.info("📱 Reading voucher at start of transaction", { 
          userId: freshOrderData.userId, 
          voucherId: freshOrderData.voucherId
        });
        const voucherRef = db.collection('users').doc(freshOrderData.userId).collection('vouchers').doc(freshOrderData.voucherId);
        voucherDoc = await transaction.get(voucherRef);
      }

      const now = new Date();
      const updateData: any = {
        "webpay.confirmedAt": now.toISOString(),
        "webpay.status": transactionResult.success ? "approved" : "rejected",
        "webpay.responseCode": transactionResult.responseCode,
        "webpay.authorizationCode": transactionResult.authorizationCode,
        "webpay.amount": transactionResult.amount,
        "webpay.cardDetail": transactionResult.cardDetail,
        "webpay.transactionDate": transactionResult.transactionDate,
        "webpay.paymentTypeCode": transactionResult.paymentTypeCode,
      };

      // ✅ PASO 2: TODAS LAS ESCRITURAS DESPUÉS
      
      if (transactionResult.success) {
        // ✅ Pago exitoso - actualizar estado Y consumir inventario ATÓMICAMENTE
        updateData.paymentStatus = "paid";
        updateData["timestamps.paid"] = now.toISOString();
        updateData.estado = "Pendiente";
        updateData.inventoryProcessed = true;
        updateData.inventoryStatus = "processed";

        // ✅ MARCAR VOUCHER COMO USADO (si existe)
        // Usamos el voucherDoc que ya fue leído al inicio
        if (voucherDoc && voucherDoc.exists && freshOrderData?.voucherId && freshOrderData?.userId) {
          logger.info("📱 Marking voucher as used after successful payment", { 
            userId: freshOrderData.userId, 
            voucherId: freshOrderData.voucherId,
            orderId 
          });
          
          const voucher = voucherDoc.data();
          
          // Validar que no está usado ya
          if (voucher?.status === 'used') {
            logger.warn('Voucher already used', { userId: freshOrderData.userId, voucherId: freshOrderData.voucherId })
          } else {
            // Marcar como usado
            const voucherRef = db.collection('users').doc(freshOrderData.userId).collection('vouchers').doc(freshOrderData.voucherId);
            transaction.update(voucherRef, {
              status: 'used',
              usedAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            })
            updateData.voucherProcessed = true;
            updateData["voucherProcessedAt"] = now.toISOString();
            
            logger.info("✅ Voucher marked as used in transaction", {
              userId: freshOrderData.userId,
              voucherId: freshOrderData.voucherId,
              orderId
            })
          }
        }

        // Actualizar pedido
        transaction.update(orderRef, updateData);

        // Consumir inventario usando los datos ya leídos
        if (freshOrderData && freshOrderData.items && inventorySnapshot && itemsMenuSnapshot) {
          logger.info("Processing inventory consumption with pre-read data...");
          
          // Procesar inventario sin hacer más lecturas
          const inventory: Record<string, any> = {};
          inventorySnapshot.forEach((doc: any) => {
            const data = doc.data();
            inventory[data.nombre.toLowerCase()] = {
              ref: doc.ref,
              stockActual: data.stockActual || 0,
            };
          });

          const pizzasConReceta: Record<string, any> = {};
          itemsMenuSnapshot.forEach((doc: any) => {
            const data = doc.data();
            const nombrePizza = (data.nombre || "").toLowerCase();
            pizzasConReceta[nombrePizza] = {
              nombre: data.nombre,
              receta: data.receta || [],
              recetaMediana: data.recetaMediana || data.receta || [],
            };
          });

          // Calcular y aplicar consumo (lógica extraída de consumeInventoryForOrder)
          const consumption: Record<string, number> = {};
          let rollitosPacksToConsume = 0;
          const agregadosConfigData = agregadosConfigSnapshot?.exists
            ? (agregadosConfigSnapshot.data() || {})
            : {};
          const currentRollitosPackStock = Number.isFinite(Number(agregadosConfigData.rollitosPackStock))
            ? Math.max(0, Math.floor(Number(agregadosConfigData.rollitosPackStock)))
            : 99;

          const normalizeText = (text: string) =>
            (text || "")
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .trim();

          const isRollitosLikeItem = (name: string) => {
            const normalized = normalizeText(name);
            return normalized.includes("rollito") && normalized.includes("canela");
          };
          
          logger.info(`🍕 Processing ${freshOrderData.items.length} items for inventory consumption`);
          
          for (const item of freshOrderData.items) {
            const itemNombreOriginal = item.nombre || "";
            const cantidad = item.cantidad || 1;

            if (isRollitosLikeItem(itemNombreOriginal)) {
              rollitosPacksToConsume += cantidad;
              logger.info(`🧁 Rollitos detected by name. Accounting ${cantidad} pack(s) and skipping ingredient recipe consumption.`);
              continue;
            }

            // Limpiar el nombre quitando el tamaño entre paréntesis si existe
            // Ejemplo: "amalfitana (familiar)" -> "amalfitana"
            let itemNombre = (item.nombre || "").toLowerCase();
            itemNombre = itemNombre.replace(/\s*\([^)]*\)\s*$/g, '').trim();
            
            const size = (item.size || "Familiar").toLowerCase();
            
            logger.info(`📦 Processing item: ${item.nombre} -> cleaned: "${itemNombre}", size: ${size}, cantidad: ${cantidad}, pizzaType: ${item.pizzaType}`);
            
            const isDuoPizza = item.pizzaType === 'duo' && item.pizza1 && item.pizza2;
            
            if (isDuoPizza) {
              // Pizza Dúo: procesar ambas mitades al 50%
              const pizza1Nombre = item.pizza1.toLowerCase();
              const pizza2Nombre = item.pizza2.toLowerCase();
              const pizza1 = pizzasConReceta[pizza1Nombre];
              const pizza2 = pizzasConReceta[pizza2Nombre];
              
              if (pizza1 && pizza2) {
                const receta1 = size === "mediana" ? pizza1.recetaMediana : pizza1.receta;
                const receta2 = size === "mediana" ? pizza2.recetaMediana : pizza2.receta;
                
                if (receta1) {
                  receta1.forEach((ing: any) => {
                    const nombreIngrediente = ing.nombre.toLowerCase();
                    const cantidadPorPizza = (ing.cantidad || 0) * 0.5;
                    consumption[nombreIngrediente] = (consumption[nombreIngrediente] || 0) + (cantidadPorPizza * cantidad);
                  });
                }
                
                if (receta2) {
                  receta2.forEach((ing: any) => {
                    const nombreIngrediente = ing.nombre.toLowerCase();
                    const cantidadPorPizza = (ing.cantidad || 0) * 0.5;
                    consumption[nombreIngrediente] = (consumption[nombreIngrediente] || 0) + (cantidadPorPizza * cantidad);
                  });
                }
              }
            } else {
              // Pizza normal
              const pizzaEncontrada = pizzasConReceta[itemNombre];

              const isRollitosOrderItem =
                isRollitosLikeItem(itemNombreOriginal) ||
                isRollitosLikeItem(String(pizzaEncontrada?.nombre || ""));

              if (isRollitosOrderItem) {
                rollitosPacksToConsume += cantidad;
                logger.info(`🧁 Rollitos detected by menu/name match. Accounting ${cantidad} pack(s) and skipping ingredient recipe consumption.`);
                continue;
              }
              
              logger.info(`🔍 Buscando pizza "${itemNombre}" en menú. Encontrada: ${!!pizzaEncontrada}`);
              
              if (pizzaEncontrada) {
                const receta = size === "mediana" ? pizzaEncontrada.recetaMediana : pizzaEncontrada.receta;
                
                logger.info(`📋 Receta para ${pizzaEncontrada.nombre} (${size}): ${receta ? receta.length : 0} ingredientes`);
                
                if (receta) {
                  receta.forEach((ing: any) => {
                    const nombreIngrediente = ing.nombre.toLowerCase();
                    const cantidadPorPizza = ing.cantidad || 0;
                    consumption[nombreIngrediente] = (consumption[nombreIngrediente] || 0) + (cantidadPorPizza * cantidad);
                    logger.info(`  ➕ ${nombreIngrediente}: +${cantidadPorPizza * cantidad}gr`);
                  });
                } else {
                  logger.warn(`⚠️ Pizza ${pizzaEncontrada.nombre} no tiene receta para tamaño ${size}`);
                }
              } else {
                logger.warn(`⚠️ Pizza "${itemNombre}" no encontrada en menú. Pizzas disponibles: ${Object.keys(pizzasConReceta).join(', ')}`);
              }
            }
          }

          logger.info(`📊 Total consumption calculated: ${JSON.stringify(consumption)}`);
          logger.info(`📊 Total unique ingredients to update: ${Object.keys(consumption).length}`);

          // Aplicar actualizaciones de inventario
          Object.entries(consumption).forEach(([ingredientName, quantity]) => {
            const invItem = inventory[ingredientName];
            if (invItem) {
              const newStock = invItem.stockActual - quantity;
              logger.info(`Updating ${ingredientName}: ${invItem.stockActual}gr -> ${newStock}gr (-${quantity}gr)`);
              
              transaction.update(invItem.ref, {
                stockActual: newStock,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              });
            } else {
              logger.warn(`Ingredient not found in inventory: ${ingredientName}`);
            }
          });

          if (rollitosPacksToConsume > 0) {
            if (currentRollitosPackStock < rollitosPacksToConsume) {
              throw new HttpsError(
                "failed-precondition",
                `Stock insuficiente de Rollitos de Canela: requerido ${rollitosPacksToConsume}, disponible ${currentRollitosPackStock}`
              );
            }

            const newRollitosStock = currentRollitosPackStock - rollitosPacksToConsume;
            const agregadosRef = db.collection("settings").doc("agregados_config");
            transaction.set(
              agregadosRef,
              {
                rollitosPackStock: newRollitosStock,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              },
              {merge: true}
            );

            logger.info(`✅ Rollitos packs updated in Webpay flow: ${currentRollitosPackStock} -> ${newRollitosStock} (-${rollitosPacksToConsume})`);
          }

          // 📦 Descontar cajas al procesar pago webpay exitoso en transacción atómica
          processBoxesInventory(db, freshOrderData.items, transaction, false);

          logger.info("✅ Inventory consumption processed successfully");
        }
      } else {
        // Pago rechazado
        updateData.paymentStatus = "failed";
        updateData.estado = "Pago Rechazado";
        transaction.update(orderRef, updateData);
      }
    });

    logger.info("Order payment and inventory updated atomically", {
      orderId,
      success: transactionResult.success,
    });

    // Sumar puntos si es un usuario registrado (no guest) y el pago fue exitoso
    if (transactionResult.success && orderData && orderData.customerType !== 'guest' && orderData.userId) {
      try {
        const { addPointsToUser } = await import('./utils/points-system.js')
        // Usar el total guardado en la orden (incluye descuentos de voucher)
        const orderTotal = orderData.total || transactionResult.amount || 0
        logger.info('📊 Adding points to user after successful payment', { 
          userId: orderData.userId, 
          orderId,
          orderTotal,
          source: orderData.total ? 'order.total' : 'webpay.amount'
        })
        await addPointsToUser(orderData.userId, orderTotal, orderId)
        
        // ✅ Marcar en la orden que puntos ya fueron sumados
        await orderRef.update({
          pointsAdded: true,
          pointsAddedAt: new Date().toISOString()
        })
        
        logger.info('✅ Points added to user account', { 
          userId: orderData.userId, 
          orderId,
          amount: orderTotal
        })
      } catch (error) {
        logger.error('❌ Error adding points to user (non-critical):', error)
        // No lanzamos error porque el pago ya se procesó exitosamente
      }
    }

    // Generar token de seguimiento si es un pedido guest
    let trackingToken: string | undefined
    if (orderData && orderData.customerType === 'guest' && orderData.cliente?.email && orderData.cliente?.telefono) {
      const { generateGuestTrackingToken } = await import('./utils/guest-token.js')
      trackingToken = generateGuestTrackingToken(
        orderData.cliente.email,
        orderData.cliente.telefono,
        90 // válido por 90 días
      )
      logger.info('Generated guest tracking token', { orderId, email: orderData.cliente.email })
    }

    return {
      success: transactionResult.success,
      orderId,
      responseCode: transactionResult.responseCode,
      authorizationCode: transactionResult.authorizationCode,
      amount: transactionResult.amount,
      cardDetail: transactionResult.cardDetail,
      trackingToken: trackingToken, // Token para seguimiento invitado
      isGuestOrder: orderData ? orderData.customerType === 'guest' : false, // Flag para saber si mostrar otro flujo
    };
  } catch (error) {
    logger.error("Error confirming Webpay transaction:", error);

    if (error instanceof HttpsError) {
      throw error;
    }

    throw new HttpsError(
      "internal",
      "Error al confirmar transacción con Webpay"
    );
  }
});

// ==================================================
// FUNCTION 6: Canjear Puntos por Pizza
// ==================================================
/**
 * Permite a usuarios registrados canjear puntos acumulados por pizzas gratis
 * - Valida que el usuario tenga suficientes puntos
 * - Crea un voucher canjeado
 * - Descuenta los puntos de la cuenta
 * - Registra la transacción en el historial
 */
export const redeemPointsForPizza = onCall(async (request) => {
  const { pointsToRedeem } = request.data

  logger.info("redeemPointsForPizza called", {
    userId: request.auth?.uid,
    pointsToRedeem,
  })

  // Validar autenticación
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Debes estar autenticado")
  }

  const userId = request.auth.uid

  // Validar parámetros
  if (!pointsToRedeem || pointsToRedeem <= 0) {
    throw new HttpsError("invalid-argument", "Cantidad de puntos inválida")
  }

  try {
    const { redeemPointsForPizza: redeemPointsService } = await import('./utils/points-system.js')
    const result = await redeemPointsService(userId, pointsToRedeem)

    if (!result.success) {
      throw new HttpsError("permission-denied", result.error || "Error al canjear puntos")
    }

    logger.info("Points redeemed successfully", {
      userId,
      pointsRedeemed: pointsToRedeem,
      voucherId: result.voucherId,
      voucherCode: result.voucherCode,
    })

    return {
      success: true,
      voucherId: result.voucherId,
      voucherCode: result.voucherCode,
      message: "Voucher creado exitosamente. Úsalo en tu próximo pedido según su tramo de canje.",
    }
  } catch (error) {
    logger.error("Error redeeming points:", error)

    if (error instanceof HttpsError) {
      throw error
    }

    throw new HttpsError(
      "internal",
      "Error al procesar el canje de puntos"
    )
  }
})

// ===VERSION ALTERNATIVA CON CORS MANUAL ===
// Esta función usa onRequest en lugar de onCall para tener control explícito de CORS
export const redeemPointsForPizzaHttp = onRequest(
  {
    cors: true, // Permitir cualquier origen (más permisivo pero funciona)
  },
  async (req, res) => {
    // Verificar método
    if (req.method !== "POST") {
      res.status(405).json({ error: "Método no permitido" });
      return;
    }

    try {
      // Obtener el token de autenticación del header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ error: "Token no proporcionado" });
        return;
      }

      const idToken = authHeader.substring(7);

      // Verificar el token
      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } catch (error) {
        res.status(401).json({ error: "Token inválido o expirado" });
        return;
      }

      const userId = decodedToken.uid;
      const { pointsToRedeem } = req.body;

      logger.info("redeemPointsForPizzaHttp called", {
        userId,
        pointsToRedeem,
      });

      // Validar parámetros
      if (!pointsToRedeem || pointsToRedeem <= 0) {
        res.status(400).json({ error: "Cantidad de puntos inválida" });
        return;
      }

      // Llamar a la lógica de puntos
      const { redeemPointsForPizza: redeemPointsService } = await import(
        "./utils/points-system.js"
      );
      const result = await redeemPointsService(userId, pointsToRedeem);

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error || "Error al canjear puntos",
        });
        return;
      }

      logger.info("Points redeemed successfully via HTTP", {
        userId,
        pointsRedeemed: pointsToRedeem,
        voucherId: result.voucherId,
        voucherCode: result.voucherCode,
      });

      res.status(200).json({
        success: true,
        voucherId: result.voucherId,
        voucherCode: result.voucherCode,
        message: "Voucher creado exitosamente. Úsalo en tu próximo pedido según su tramo de canje.",
      });
    } catch (error) {
      logger.error("Error redeeming points via HTTP:", error);
      res.status(500).json({
        success: false,
        error: "Error al procesar el canje de puntos",
      });
    }
  }
);

// ==================================================
// FUNCTION 6A: Expiración Automática de Puntos
// ==================================================
/**
 * Ejecuta una vez al día y descuenta puntos vencidos del saldo total.
 * Los puntos se vencen por "bolsas" de acumulación según expiresAt.
 */
export const expirePointsDaily = onSchedule(
  {
    schedule: "every day 04:15",
    timeZone: "America/Santiago",
    region: "us-central1",
  },
  async () => {
    logger.info("Starting daily points expiration job...");

    try {
      const db = admin.firestore();
      const now = admin.firestore.Timestamp.now();
      const expiredBucketsSnapshot = await db
        .collectionGroup("points_history")
        .where("type", "==", "earned")
        .where("expiresAt", "<=", now)
        .get();

      if (expiredBucketsSnapshot.empty) {
        logger.info("No expired points buckets found");
        return;
      }

      const expiredBucketsByUser = new Map<string, FirebaseFirestore.DocumentReference[]>();

      expiredBucketsSnapshot.docs.forEach((docSnap) => {
        const data = docSnap.data() as any;
        const remainingPoints = Number(data?.remainingPoints || 0);
        if (remainingPoints <= 0) return;

        const userRef = docSnap.ref.parent.parent;
        if (!userRef) return;

        const userId = userRef.id;
        if (!expiredBucketsByUser.has(userId)) {
          expiredBucketsByUser.set(userId, []);
        }
        expiredBucketsByUser.get(userId)!.push(docSnap.ref);
      });

      let usersWithExpiredPoints = 0;
      let totalExpiredPoints = 0;
      let processedBuckets = 0;

      for (const [userId, bucketRefs] of expiredBucketsByUser.entries()) {
        const userRef = db.collection("users").doc(userId);
        const historyRef = userRef.collection("points_history");

        const expiredForUser = await db.runTransaction(async (transaction) => {
          const userDoc = await transaction.get(userRef);
          if (!userDoc.exists) return 0;

          let pointsToExpire = 0;

          for (const bucketRef of bucketRefs) {
            const bucketDoc = await transaction.get(bucketRef);
            if (!bucketDoc.exists) continue;

            const bucketData = bucketDoc.data() as any;
            const remaining = Number(bucketData?.remainingPoints || 0);
            if (remaining <= 0) continue;

            pointsToExpire += remaining;
            transaction.update(bucketRef, {
              remainingPoints: 0,
              expiredAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }

          if (pointsToExpire <= 0) return 0;

          const currentPoints = Number(userDoc.data()?.totalPoints || 0);
          const nextPoints = Math.max(0, currentPoints - pointsToExpire);
          transaction.update(userRef, {
            totalPoints: nextPoints,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          transaction.set(historyRef.doc(), {
            type: "expired",
            points: pointsToExpire,
            description: `Vencimiento automático de ${pointsToExpire} punto(s)`,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          return pointsToExpire;
        });

        if (expiredForUser > 0) {
          usersWithExpiredPoints += 1;
          totalExpiredPoints += expiredForUser;
          processedBuckets += bucketRefs.length;
          logger.info("Expired points for user", {userId, expiredForUser, buckets: bucketRefs.length});
        }
      }

      logger.info("Daily points expiration completed", {
        usersWithExpiredBuckets: expiredBucketsByUser.size,
        bucketsScanned: expiredBucketsSnapshot.size,
        bucketsProcessed: processedBuckets,
        usersWithExpiredPoints,
        totalExpiredPoints,
      });
    } catch (error) {
      logger.error("Error running daily points expiration:", error);
    }
  }
);

// ==================================================
// FUNCTION 7: Limpieza Automática de Pedidos Huérfanos
// ==================================================
/**
 * Función programada que se ejecuta cada 10 minutos
 * Limpia pedidos en "Pago Pendiente" con más de 30 minutos de antigüedad
 * 
 * ✅ ROBUSTEZ: Evita acumulación de pedidos abandonados
 * ✅ COSTO: Reduce lecturas innecesarias en Firestore
 */
export const cleanupAbandonedOrders = onSchedule({
  schedule: "every 10 minutes",
  timeZone: "America/Santiago", // Zona horaria de Chile
  region: "us-central1",
}, async (event) => {
  logger.info("Starting cleanup of abandoned orders...");

  try {
    const db = admin.firestore();
    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

    // Buscar pedidos en "Pago Pendiente" con más de 30 minutos
    const abandonedOrdersQuery = db
      .collection("orders")
      .where("estado", "==", "Pago Pendiente")
      .where("timestamps.created", "<", thirtyMinutesAgo.toISOString());

    const snapshot = await abandonedOrdersQuery.get();

    if (snapshot.empty) {
      logger.info("No abandoned orders found");
      return;
    }

    logger.info(`Found ${snapshot.size} abandoned orders to clean up`);

    // Actualizar en batch para eficiencia
    const batch = db.batch();
    let count = 0;

    snapshot.docs.forEach((doc) => {
      const orderData = doc.data();
      
      // Marcar como cancelado por timeout
      batch.update(doc.ref, {
        estado: "Cancelado",
        cancelReason: "Pago no completado en 30 minutos",
        canceledAt: now.toISOString(),
        canceledBy: "system",
      });

      count++;

      logger.info(`Marking order as abandoned: ${doc.id}`, {
        orderNumber: orderData.orderNumber,
        createdAt: orderData.timestamps?.created,
      });
    });

    // Ejecutar batch (máximo 500 operaciones)
    await batch.commit();

    logger.info(`Successfully cleaned up ${count} abandoned orders`);
  } catch (error) {
    logger.error("Error cleaning up abandoned orders:", error);
  }
});

// ==================================================
// FUNCTION 6B: Limpieza Automática de Rate Limits
// ==================================================
/**
 * Función programada que se ejecuta cada día
 * Elimina documentos antiguos de rate-limit para mantener bajo costo
 */
export const cleanupRateLimits = onSchedule({
  schedule: "every day 03:30",
  timeZone: "America/Santiago",
  region: "us-central1",
}, async (_event) => {
  logger.info("Starting cleanup of stale rate-limit records...");

  try {
    const db = admin.firestore();
    const now = Date.now();
    const retentionMs = 7 * 24 * 60 * 60 * 1000; // 7 dias
    const cutoffIso = new Date(now - retentionMs).toISOString();

    let totalDeleted = 0;
    let hasMore = true;

    while (hasMore) {
      const snapshot = await db
        .collection("security_rate_limits")
        .where("updatedAt", "<", cutoffIso)
        .limit(400)
        .get();

      if (snapshot.empty) {
        hasMore = false;
        break;
      }

      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      totalDeleted += snapshot.size;

      // Si trae menos que el limite, ya no quedan mas docs viejos.
      if (snapshot.size < 400) {
        hasMore = false;
      }
    }

    logger.info("Rate-limit cleanup completed", {totalDeleted, cutoffIso});
  } catch (error) {
    logger.error("Error cleaning stale rate-limit records:", error);
  }
});

// ==================================================
// FUNCTION 6C: Seguimiento de pedidos para invitados
// ==================================================
export const getGuestOrderTracking = onCall(async (request) => {
  const {token, email, phone} = request.data || {};

  let lookupEmail = String(email || "").trim().toLowerCase();
  let lookupPhone = normalizePhoneForLookup(phone);

  if (token && typeof token === "string") {
    const {validateGuestTrackingToken} = await import("./utils/guest-token.js");
    const tokenValidation = validateGuestTrackingToken(token);

    if (!tokenValidation.valid || !tokenValidation.email || !tokenValidation.phone) {
      throw new HttpsError("permission-denied", tokenValidation.error || "Token inválido");
    }

    lookupEmail = tokenValidation.email.trim().toLowerCase();
    lookupPhone = normalizePhoneForLookup(tokenValidation.phone);
  }

  if (!lookupEmail || !lookupPhone) {
    throw new HttpsError("invalid-argument", "Email y teléfono son requeridos para seguimiento");
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(lookupEmail)) {
    throw new HttpsError("invalid-argument", "Email inválido");
  }

  if (lookupPhone.length < 8) {
    throw new HttpsError("invalid-argument", "Teléfono inválido");
  }

  const db = admin.firestore();
  const ordersSnapshot = await db
    .collection("orders")
    .where("customerType", "==", "guest")
    .where("cliente.email", "==", lookupEmail)
    .limit(25)
    .get();

  const orders = ordersSnapshot.docs
    .map((doc) => ({id: doc.id, ...doc.data()} as any))
    .filter((order) => normalizePhoneForLookup(order?.cliente?.telefono) === lookupPhone)
    .filter((order) => ACTIVE_GUEST_TRACKING_STATUSES.has(String(order?.estado || "")))
    .sort((a, b) => {
      const aTime = Date.parse(String(a?.timestamps?.created || "")) || 0;
      const bTime = Date.parse(String(b?.timestamps?.created || "")) || 0;
      return bTime - aTime;
    })
    .map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber || 0,
      total: Number(order.total || 0),
      estado: order.estado || "Pendiente",
      tipoEntrega: order.tipoEntrega || "Retiro",
      paymentStatus: order.paymentStatus || "pending",
      metodoPago: order.metodoPago || "No especificado",
      cliente: {
        nombre: order?.cliente?.nombre || "",
        email: order?.cliente?.email || "",
        telefono: order?.cliente?.telefono || "",
      },
      createdAt: order?.timestamps?.created || null,
      confirmedAt: order?.webpay?.confirmedAt || null,
      inventoryStatus: order?.inventoryStatus || null,
    }));

  return {
    success: true,
    orders,
  };
});

// ==================================================
// FUNCTION 7: Enviar Email de Bienvenida
// ==================================================
export const sendWelcomeEmailToUser = onCall(async (request) => {
  const {email, name, password} = request.data;

  logger.info("sendWelcomeEmailToUser called", {email, name});

  // Validar datos de entrada
  if (!email || !name || !password) {
    throw new HttpsError(
      "invalid-argument",
      "Email, nombre y contraseña son requeridos"
    );
  }

  // Validar formato de email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new HttpsError("invalid-argument", "Email inválido");
  }

  try {
    await sendWelcomeEmail(email, name, password);

    return {
      success: true,
      message: "Email de bienvenida enviado correctamente",
    };
  } catch (error: any) {
    logger.error("Error enviando email de bienvenida:", error);

    // Si las credenciales no están configuradas, devolver error amigable
    if (error.message.includes("not configured")) {
      throw new HttpsError(
        "failed-precondition",
        "Servicio de email no configurado. Contacta al administrador."
      );
    }

    throw new HttpsError(
      "internal",
      "Error al enviar email de bienvenida"
    );
  }
});

// ==================================================
// FUNCTION 8: Enviar WhatsApp de Bienvenida
// ==================================================
export const sendWelcomeWhatsAppToUser = onCall(async (request) => {
  const {phone, name, email, password} = request.data;

  logger.info("sendWelcomeWhatsAppToUser called", {phone, name, email});

  // Validar datos de entrada
  if (!phone || !name || !email || !password) {
    throw new HttpsError(
      "invalid-argument",
      "Teléfono, nombre, email y contraseña son requeridos"
    );
  }

  // Validar formato de teléfono
  if (!isValidPhoneNumber(phone)) {
    throw new HttpsError(
      "invalid-argument",
      "Número de teléfono inválido. Debe incluir código de país (+56)"
    );
  }

  try {
    await sendWelcomeWhatsApp(phone, name, email, password);

    return {
      success: true,
      message: "WhatsApp de bienvenida enviado correctamente",
    };
  } catch (error: any) {
    logger.error("Error enviando WhatsApp de bienvenida:", error);

    // Si las credenciales no están configuradas, devolver error amigable
    if (error.message.includes("not configured")) {
      throw new HttpsError(
        "failed-precondition",
        "Servicio de WhatsApp no configurado. Contacta al administrador."
      );
    }

    throw new HttpsError(
      "internal",
      "Error al enviar WhatsApp de bienvenida"
    );
  }
});

// ==================================================
// FUNCTION 9: Enviar datos de delivery al repartidor por WhatsApp
// ==================================================
export const sendDeliveryDataWhatsApp = onCall(async (request) => {
  const {phone, message} = request.data;

  logger.info("sendDeliveryDataWhatsApp called", {
    phone,
    messageLength: typeof message === "string" ? message.length : 0,
  });

  if (!phone || !message) {
    throw new HttpsError(
      "invalid-argument",
      "Teléfono y mensaje son requeridos"
    );
  }

  if (!isValidPhoneNumber(phone)) {
    throw new HttpsError(
      "invalid-argument",
      "Número de teléfono inválido. Debe incluir código de país (+56)"
    );
  }

  try {
    const ok = await sendCustomWhatsAppMessage(phone, message);

    if (!ok) {
      throw new Error("No se pudo enviar el WhatsApp personalizado");
    }

    return {
      success: true,
      message: "Datos de delivery enviados correctamente",
    };
  } catch (error: any) {
    logger.error("Error enviando datos de delivery por WhatsApp:", error);

    if (error.message.includes("not configured")) {
      throw new HttpsError(
        "failed-precondition",
        "Servicio de WhatsApp no configurado. Contacta al administrador."
      );
    }

    throw new HttpsError(
      "internal",
      "Error al enviar datos de delivery por WhatsApp"
    );
  }
});

// ==================================================
// CHATBOT FUNCTIONS
// ==================================================

import { handleChatbotMessage } from './routes/chatbot';
import * as adminChatbot from './routes/adminChatbot';
import * as analytics from './routes/analytics';
import * as unansweredQuestions from './routes/unansweredQuestions';

/**
 * Endpoint principal del chatbot
 * Procesa mensajes de usuarios
 */
export const chatbot = onCall(async (request) => {
  const { tenantId, sessionId, message } = request.data;
  const userId = request.auth?.uid || null;

  return await handleChatbotMessage({ tenantId, sessionId, message, userId });
});

/**
 * Listar intents del chatbot
 */
export const chatbotListIntents = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Usuario no autenticado');
  }

  const { tenantId } = request.data;
  return await adminChatbot.listIntents(request.auth.uid, tenantId);
});

/**
 * Crear intent
 */
export const chatbotCreateIntent = onCall(
  { memory: '256MiB', timeoutSeconds: 30, maxInstances: 10 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Usuario no autenticado');
    }

    const { tenantId, intentData } = request.data;
    return await adminChatbot.createIntent(request.auth.uid, tenantId, intentData);
  }
);

/**
 * Actualizar intent
 */
export const chatbotUpdateIntent = onCall(
  { memory: '256MiB', timeoutSeconds: 30, maxInstances: 10 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Usuario no autenticado');
    }

    const { tenantId, intentId, updates } = request.data;
    return await adminChatbot.updateIntent(request.auth.uid, tenantId, intentId, updates);
  }
);

/**
 * Eliminar intent
 */
export const chatbotDeleteIntent = onCall(
  { memory: '256MiB', timeoutSeconds: 30, maxInstances: 10 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Usuario no autenticado');
    }

    const { tenantId, intentId } = request.data;
    return await adminChatbot.deleteIntent(request.auth.uid, tenantId, intentId);
  }
);

/**
 * Actualizar configuración del chatbot
 */
export const chatbotUpdateConfig = onCall(
  { memory: '256MiB', timeoutSeconds: 30, maxInstances: 10 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Usuario no autenticado');
    }

    const { tenantId } = request.data;
    const config = request.data?.config || {
      enabled: request.data?.enabled,
      fallbackMessage: request.data?.fallbackMessage,
      maxSessionIdleMinutes: request.data?.maxSessionIdleMinutes,
    };
    return await adminChatbot.updateChatbotConfig(request.auth.uid, tenantId, config);
  }
);

/**
 * Obtener configuración del chatbot
 */
export const chatbotGetConfig = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Usuario no autenticado');
  }

  const { tenantId } = request.data;
  return await adminChatbot.getChatbotConfig(request.auth.uid, tenantId);
});

/**
 * Obtener métricas del chatbot
 */
export const chatbotGetMetrics = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Usuario no autenticado');
  }

  const { tenantId } = request.data;
  return await analytics.getChatbotMetrics(request.auth.uid, tenantId);
});

/**
 * Obtener logs del chatbot
 */
export const chatbotGetLogs = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Usuario no autenticado');
  }

  const { tenantId, limit } = request.data;
  return await analytics.getChatbotLogs(request.auth.uid, tenantId, limit);
});

/**
 * Exportar logs del chatbot
 */
export const chatbotExportLogs = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Usuario no autenticado');
  }

  const { tenantId, fromDate, toDate } = request.data;
  return await analytics.exportChatbotLogs(request.auth.uid, tenantId, fromDate, toDate);
});

/**
 * Obtener preguntas sin respuesta
 */
export const chatbotGetUnansweredQuestions = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Usuario no autenticado');
  }

  const { tenantId, status, limit } = request.data;
  return await unansweredQuestions.handleGetUnansweredQuestions({ tenantId, status, limit });
});

/**
 * Actualizar estado de pregunta sin respuesta
 */
export const chatbotUpdateQuestionStatus = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Usuario no autenticado');
  }

  const { tenantId, questionId, status } = request.data;
  return await unansweredQuestions.handleUpdateQuestionStatus({ tenantId, questionId, status });
});

/**
 * Obtener estadísticas de preguntas sin respuesta
 */
export const chatbotGetUnansweredStats = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Usuario no autenticado');
  }

  const { tenantId } = request.data;
  return await unansweredQuestions.handleGetUnansweredStats({ tenantId });
});

/**
 * Cloud Function para reembolsar pedido Webpay
 * Solo admin puede ejecutar
 * Guarda tipo de reembolso y detalles en el pedido
 */
export const refundOrder = onCall(async (request) => {
  // 1. Verificar autenticación y permisos
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuario no autenticado");
  }
  const db = admin.firestore();
  const userDoc = await db.collection("users").doc(request.auth.uid).get();
  const userData = userDoc.data();
  if (!userData || (userData.role !== "admin" && userData.role !== "staff")) {
    throw new HttpsError("permission-denied", "Solo admin puede reembolsar pedidos");
  }

  const {orderId} = request.data;
  if (!orderId) {
    throw new HttpsError("invalid-argument", "orderId requerido");
  }

  // 2. Buscar pedido
  const orderRef = db.collection("orders").doc(orderId);
  const orderDoc = await orderRef.get();
  if (!orderDoc.exists) {
    throw new HttpsError("not-found", "Pedido no encontrado");
  }
  const orderData = orderDoc.data();
  if (!orderData?.webpay?.token) {
    throw new HttpsError("failed-precondition", "Pedido no tiene transacción Webpay");
  }

  // 3. Ejecutar reembolso
  try {
    const {refundType, response} = await refundWebpayTransaction(
      orderData.webpay.token,
      orderData.orderNumber.toString(),
      orderData.webpay.amount || orderData.total
    );
    // 4. Guardar resultado en pedido
    await orderRef.update({
      "webpay.refund": {
        refundType,
        response,
        refundedAt: new Date().toISOString(),
        refundedBy: request.auth.uid,
      },
      paymentStatus: "refunded",
      estado: "Cancelado",
      // Añadimos estas dos líneas para evitar una doble-restauración accidental
      inventoryProcessed: false,
      inventoryStatus: "restored_on_cancel",
    });
    // 5. Restaurar inventario si corresponde
    // (Solo si inventoryProcessed)
    if (orderData.inventoryProcessed) {
      try {
        await restoreInventoryForOrder(orderData.items);
        
        // 📦 Restaurar cajas al hacer un reembolso
        const refundBoxesBatch = db.batch();
        processBoxesInventory(db, orderData.items, refundBoxesBatch, true);
        await refundBoxesBatch.commit();
      } catch (err) {
        logger.error("Error restaurando inventario:", err);
      }
    }

    // 6. 📧 ENVIAR NOTIFICACIÓN DE REEMBOLSO AL CLIENTE
    if (orderData.cliente?.email && orderData.cliente?.nombre) {
      // Enviar email de reembolso (no bloqueante)
      sendRefundNotificationEmail(
        orderData.cliente.email,
        orderData.cliente.nombre,
        orderData.orderNumber,
        orderData.total,
        orderData.webpay.token,
        refundType
      ).catch((err) => {
        logger.error("Error enviando email de reembolso:", err);
      });

      // Enviar WhatsApp de reembolso (no bloqueante)
      if (orderData.cliente?.telefono && isValidPhoneNumber(orderData.cliente.telefono)) {
        sendRefundNotificationWhatsApp(
          orderData.cliente.telefono,
          orderData.cliente.nombre,
          orderData.orderNumber,
          orderData.total,
          orderData.webpay.token,
          refundType
        ).catch((err) => {
          logger.error("Error enviando WhatsApp de reembolso:", err);
        });
      }
    }

    return {
      success: true,
      refundType,
      response,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    throw new HttpsError("internal", "Error al reembolsar: " + errMsg);
  }
});

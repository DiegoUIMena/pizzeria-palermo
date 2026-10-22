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

// Inicializar Firebase Admin inmediatamente (requerido para imports de submódulos)
if (!admin.apps.length) {
  admin.initializeApp();
}

import {onCall, HttpsError, onRequest} from "firebase-functions/v2/https";
import {onSchedule} from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import * as crypto from "crypto";

// Importar utilidades y servicios de contacto
import { verifyAdminAccess } from "./utils/admin-access";
import * as contactService from "./services/contact.service";

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
import {addPointsToUser} from "./utils/points-system";
import { OrderProcessingService } from "./services/order.service";
import { WebpayProvider } from "./services/payment/webpay-provider";
import { KhipuProvider } from "./services/payment/khipu-provider";


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

// Helper para aplanar los items de promociones y combos en sus subproductos constituyentes
export function flattenOrderItems(items: any[]): any[] {
  if (!items) return [];
  const flattened: any[] = [];
  items.forEach((item: any) => {
    if (item.isPromo && Array.isArray(item.productos)) {
      item.productos.forEach((subProd: any) => {
        flattened.push({
          ...subProd,
          nombre: subProd.nombre || subProd.name || "",
          cantidad: (subProd.cantidad || 1) * (item.cantidad || item.quantity || 1),
          size: subProd.size,
          variant: subProd.variant,
          pizzaType: subProd.categoria?.toLowerCase() === "pizzas" ? "normal" : undefined,
        });
      });
    } else {
      flattened.push(item);
    }
  });
  return flattened;
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
  const flattenedItems = flattenOrderItems(items);
  flattenedItems.forEach((item: any) => {
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

      // 5.6 Calcular precio real en el servidor
      logger.info("Calculating server-side price...");
      const priceCalculation = await calculateOrderTotal(
        orderData.items,
        orderData.tipoEntrega,
        orderData.direccion
      );
      
      // ✅ MEJORA: Para POS (Venta Presencial), permitir incorporar el valor de delivery ingresado manualmente
      if ((orderData as any).orderChannel === "POS" && (orderData as any).delivery > 0) {
        priceCalculation.deliveryFee = (orderData as any).delivery;
        priceCalculation.total = priceCalculation.subtotal + priceCalculation.deliveryFee;
      }

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

        discountCode = normalizedDiscountCode;
        orderData.discountCode = normalizedDiscountCode;
        if (promoData.type === 'percentage') {
          discountFromCode = Math.round((priceCalculation.subtotal * (promoData.value || 0)) / 100);
        } else if (promoData.type === 'amount') {
          discountFromCode = promoData.value || 0;
        }
      }

      const finalTotal = Math.max(0, priceCalculation.total - discountFromCode);

      // 6. Generar número de pedido único consecutivo (Atómico)
      const countersRef = db.collection('settings').doc('counters');
      const countersDoc = await transaction.get(countersRef);
      
      let orderNumber = 100;
      if (countersDoc.exists) {
        const data = countersDoc.data();
        if (data && typeof data.orderNumber === 'number') {
          orderNumber = data.orderNumber + 1;
        }
      }

      // 7. Determinar el estado inicial según el método de pago (Webpay y Khipu son pasarelas en línea)
      const isOnlinePayment = orderData.metodoPago === "Webpay Plus" || 
        (orderData.metodoPago === "Transferencia" && orderData.isKhipu === true);

      const initialEstado = isOnlinePayment 
        ? "Pago Pendiente" 
        : "Pendiente";

      // Para pasarelas en línea, el consumo del inventario se difiere hasta que el pago es confirmado con éxito.
      const shouldConsumeInventoryOnCreate = !isOnlinePayment;

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
          ...(discountCode ? {discountCode} : {}),
          ...(discountFromCode ? {discountAmount: discountFromCode} : {}),
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
      transaction.set(countersRef, { orderNumber }, { merge: true });
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
    }

    // ✅ SUMAR PUNTOS para órdenes NO Webpay cuando se ACEPTAN (para cash/transfer/etc)
    // Si es Webpay, los puntos ya se sumaron en confirmWebpayTransaction
    // Solo sumamos puntos si:
    // 1. El nuevo estado es "En preparación"
    // 2. No es una orden Webpay
    // 3. Es un cliente registrado (no guest)
    // 4. Los puntos aún no han sido sumados
    if (
      newStatus === "En preparación" &&
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
    // Solo marcamos el voucher si:
    // 1. El nuevo estado es "En preparación"
    // 2. No es una orden Webpay
    // 3. Es un cliente registrado (no guest)
    // 4. Tiene un voucherId asociado y no ha sido procesado aún
    if (
      newStatus === "En preparación" &&
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
    const amountToCharge = Math.round(Number(orderData.total || 0));

    if (!Number.isFinite(amountToCharge) || amountToCharge <= 0) {
      throw new HttpsError("failed-precondition", "Monto de pedido inválido");
    }

    const provider = new WebpayProvider();
    const paymentReference = buyOrder;
    const transaction = await provider.createPayment(
      orderId,
      amountToCharge,
      returnUrl,
      paymentReference
    );

    // 6. Guardar información de la transacción en el pedido
    const now = new Date();
    const webpayUpdate: Record<string, any> = {
      "webpay.token": transaction.providerPaymentId,
      "webpay.status": "pending",
      "webpay.createdAt": admin.firestore.FieldValue.serverTimestamp(),
      paymentStatus: "pending",
      paymentDetailsData: {
        provider: "webpay",
        providerPaymentId: transaction.providerPaymentId,
        paymentReference,
        providerStatus: "INITIALIZED",
        updatedAt: now.toISOString(),
        paymentExpiresAt: new Date(now.getTime() + GUEST_WEBPAY_TOKEN_TTL_MS).toISOString()
      }
    };

    if (isGuestOrder) {
      webpayUpdate["guestCheckout.webpayInitAttempts"] = admin.firestore.FieldValue.increment(1);
      webpayUpdate["guestCheckout.lastSuccessfulInitAt"] = new Date().toISOString();
    }

    await orderRef.update(webpayUpdate);

    logger.info("Webpay transaction created with new provider structure", {
      orderId,
      token: transaction.providerPaymentId,
    });

    return {
      success: true,
      token: transaction.providerPaymentId,
      url: transaction.redirectUrl,
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
// FUNCTION: Cancelar Transacción Webpay Plus (Abortada por el usuario)
// ==================================================
export const cancelWebpayTransaction = onCall(async (request) => {
  const { token, orderId } = request.data;

  logger.info("cancelWebpayTransaction called", { token, orderId });

  if (!token || !orderId) {
    throw new HttpsError("invalid-argument", "Token y orderId son requeridos");
  }

  try {
    const db = admin.firestore();
    const orderRef = db.collection("orders").doc(orderId);
    
    await db.runTransaction(async (transaction) => {
      const orderDoc = await transaction.get(orderRef);

      if (!orderDoc.exists) {
        throw new HttpsError("not-found", "Pedido no encontrado");
      }

      const orderData = orderDoc.data();

      // Verificar que este sea realmente el pedido correspondiente al token (medida de seguridad)
      if (orderData?.webpay?.token !== token) {
        logger.warn("Intento de cancelar un pedido con un token que no coincide", {
          expectedToken: orderData?.webpay?.token,
          receivedToken: token,
          orderId
        });
        throw new HttpsError("permission-denied", "Token no coincide con el pedido");
      }

      // Si el pedido ya está pagado o cancelado, no hacemos nada
      if (orderData?.paymentStatus === "paid" || orderData?.estado === "Cancelado") {
        logger.info("El pedido ya está pagado o cancelado, ignorando", { orderId, estado: orderData?.estado });
        return;
      }

      const now = new Date();
      
      // Marcar como cancelado
      transaction.update(orderRef, {
        "webpay.status": "aborted",
        "webpay.canceledAt": now.toISOString(),
        paymentStatus: "failed",
        estado: "Cancelado",
        cancelReason: "Cancelado por el usuario en pasarela de pago",
        canceledAt: now.toISOString(),
        canceledBy: "user",
      });

      logger.info("Pedido cancelado exitosamente por abandono en Webpay", { orderId });
    });

    return { success: true };
  } catch (error) {
    logger.error("Error al cancelar transacción Webpay:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "Error interno al cancelar el pedido");
  }
});

// ==================================================
// FUNCTION 5: Confirmar Transacción Webpay Plus
// ==================================================
export const confirmWebpayTransaction = onCall(async (request) => {
  const {token} = request.data;

  logger.info("confirmWebpayTransaction called", {token});

  if (!token) {
    throw new HttpsError("invalid-argument", "Token es requerido");
  }

  try {
    const provider = new WebpayProvider();
    const verification = await provider.verifyPayment(token);

    logger.info("Webpay verification result", {
      token,
      success: verification.success,
      status: verification.providerStatus,
    });

    const db = admin.firestore();
    const orderId = String(verification.rawResponse.sessionId || '');
    
    if (!orderId) {
      throw new HttpsError("not-found", "ID de sesión no encontrado en la respuesta del pago");
    }

    const orderRef = db.collection("orders").doc(orderId);
    const orderDoc = await orderRef.get();
    
    if (!orderDoc.exists) {
      throw new HttpsError("not-found", "Pedido no encontrado");
    }

    // Si la transacción no fue exitosa
    if (!verification.success) {
      await orderRef.update({
        paymentStatus: "failed",
        estado: "Pago Rechazado",
        "webpay.status": "rejected",
        "webpay.responseCode": verification.rawResponse.responseCode,
        "webpay.confirmedAt": new Date().toISOString()
      });
      
      return {
        success: false,
        orderId,
        responseCode: verification.rawResponse.responseCode,
      };
    }

    // Ejecutar la lógica de negocio post-pago unificada
    const metadata = {
      authorizationCode: String(verification.rawResponse.authorizationCode || ''),
      cardDetail: String((verification.rawResponse.cardDetail as any)?.card_number || ''),
      paymentTypeCode: String(verification.rawResponse.paymentTypeCode || '')
    };

    const processResult = await OrderProcessingService.processPaymentSuccess(
      orderId,
      'webpay',
      token,
      String(verification.rawResponse.buyOrder || ''),
      verification.providerStatus,
      metadata,
      verification.rawResponse
    );

    // Retornar misma estructura esperada por el frontend para retrocompatibilidad
    return {
      success: true,
      orderId,
      responseCode: verification.rawResponse.responseCode,
      authorizationCode: verification.rawResponse.authorizationCode,
      amount: verification.amount,
      cardDetail: verification.rawResponse.cardDetail,
      trackingToken: processResult.trackingToken,
      isGuestOrder: processResult.isGuestOrder
    };
  } catch (error) {
    logger.error("Error confirming Webpay transaction:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "Error al confirmar transacción con Webpay");
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
  throw new HttpsError(
    "unimplemented",
    "El canje de puntos por cupones de descuento ya no está disponible."
  )
})

// ===VERSION ALTERNATIVA CON CORS MANUAL ===
// Esta función usa onRequest en lugar de onCall para tener control explícito de CORS
export const redeemPointsForPizzaHttp = onRequest(
  {
    cors: true, // Permitir cualquier origen (más permisivo pero funciona)
  },
  async (req, res) => {
    res.status(501).json({
      success: false,
      error: "El canje de puntos por cupones de descuento ya no está disponible."
    });
  }
)


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

/**
 * Cloud Function para canjear un producto del catálogo de puntos palermo de forma segura en el servidor
 */
export const redeemCatalogProduct = onCall({ cors: true }, async (request) => {
  // 1. Verificar autenticación
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuario no autenticado");
  }

  const { productId } = request.data;
  if (!productId) {
    throw new HttpsError("invalid-argument", "productId es requerido");
  }

  const userId = request.auth.uid;
  const db = admin.firestore();

  logger.info("redeemCatalogProduct called", { userId, productId });

  try {
    const result = await db.runTransaction(async (transaction) => {
      // 1. Leer el producto del catálogo
      const productRef = db.collection("puntos_palermo_catalogo").doc(productId);
      const productDoc = await transaction.get(productRef);

      if (!productDoc.exists) {
        throw new HttpsError("not-found", "El producto no existe en el catálogo");
      }

      const productData = productDoc.data();
      if (!productData) {
        throw new HttpsError("not-found", "Producto inválido");
      }

      const pointsCost = Number(productData.puntos || 0);
      const productName = String(productData.nombre || "");
      const productImg = String(productData.imagenUrl || "");

      // 2. Leer el usuario
      const userRef = db.collection("users").doc(userId);
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists) {
        throw new HttpsError("not-found", "El usuario no existe");
      }

      const userData = userDoc.data();
      if (!userData?.rut) {
        throw new HttpsError("failed-precondition", "Debes activar tu cuenta ingresando tu RUT para realizar canjes.");
      }

      const currentPoints = Number(userData.totalPoints || 0);

      // 3. Validar puntos
      if (currentPoints < pointsCost) {
        throw new HttpsError("failed-precondition", `Puntos insuficientes. Tienes ${currentPoints} y necesitas ${pointsCost}.`);
      }

      // 4. Descontar puntos
      const newPoints = currentPoints - pointsCost;
      transaction.update(userRef, {
        totalPoints: newPoints,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 5. Registrar el canje en la colección "canjes" (historial global de canjes)
      const canjeRef = db.collection("canjes").doc();
      const canjeData = {
        userId,
        productId,
        nombre: productName,
        puntos: pointsCost,
        imagenUrl: productImg,
        fechaCanje: admin.firestore.FieldValue.serverTimestamp(),
        estado: "canjeado",
      };
      transaction.set(canjeRef, canjeData);

      // 6. Registrar en el historial de puntos del usuario
      const historyRef = db.collection("users").doc(userId).collection("points_history").doc();
      transaction.set(historyRef, {
        type: "redeemed",
        points: pointsCost,
        description: `Canje de producto: ${productName}`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        nombre: productName,
        puntosCost: pointsCost,
        imagenUrl: productImg,
        newPoints: newPoints,
      };
    });

    return result;
  } catch (error) {
    logger.error("Error al canjear producto:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    const errMsg = error instanceof Error ? error.message : String(error);
    throw new HttpsError("internal", "Error al procesar el canje de puntos: " + errMsg);
  }
});

// ==================================================
// FUNCTION: Iniciar Transacción Khipu
// ==================================================
export const initKhipuTransaction = onCall(async (request) => {
  await enforceIpRateLimit(request, "initWebpayTransaction");

  const {orderId, returnUrl, guestAccessToken} = request.data;
  const isAuthenticatedRequest = !!request.auth?.uid;

  logger.info("initKhipuTransaction called", {
    orderId,
    userId: request.auth?.uid || null,
    isAuthenticatedRequest,
  });

  if (!orderId || !returnUrl) {
    throw new HttpsError("invalid-argument", "orderId y returnUrl son requeridos");
  }

  if (!isValidReturnUrl(returnUrl)) {
    throw new HttpsError("invalid-argument", "returnUrl inválida");
  }

  try {
    const db = admin.firestore();
    const orderRef = db.collection("orders").doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      throw new HttpsError("not-found", "Pedido no encontrado");
    }

    const orderData = orderDoc.data() as any;
    const isGuestOrder = orderData.customerType === "guest";

    if (!isAuthenticatedRequest) {
      if (!isGuestOrder) {
        throw new HttpsError("unauthenticated", "Usuario no autenticado");
      }
      
      const guestCheckout = orderData.guestCheckout || {};
      if (!guestAccessToken || typeof guestAccessToken !== "string") {
        throw new HttpsError("permission-denied", "Token de acceso inválido");
      }
      const tokenHash = guestCheckout.webpayTokenHash;
      const receivedHash = hashGuestAccessToken(guestAccessToken);
      const isValidToken = safeCompareHash(receivedHash, tokenHash || '');
      if (!isValidToken) {
        throw new HttpsError("permission-denied", "Token de acceso inválido");
      }
    }

    if (orderData.paymentStatus === "paid") {
      throw new HttpsError("failed-precondition", "Este pedido ya fue pagado");
    }

    // Reutilizar transacciones activas de Khipu no expiradas
    const now = new Date();
    if (
      orderData.paymentDetailsData?.provider === "khipu" &&
      orderData.paymentStatus === "pending" &&
      orderData.paymentDetailsData.paymentExpiresAt &&
      new Date(orderData.paymentDetailsData.paymentExpiresAt) > now &&
      orderData.paymentDetailsData.providerPaymentId
    ) {
      logger.info("initKhipuTransaction: Reutilizando pago Khipu existente no expirado", {
        orderId,
        paymentId: orderData.paymentDetailsData.providerPaymentId
      });

      return {
        success: true,
        token: orderData.paymentDetailsData.providerPaymentId,
        url: `https://khipu.com/payment/show/${orderData.paymentDetailsData.providerPaymentId}`
      };
    }

    const amountToCharge = Math.round(Number(orderData.total || 0));
    if (!Number.isFinite(amountToCharge) || amountToCharge <= 0) {
      throw new HttpsError("failed-precondition", "Monto de pedido inválido");
    }

    const provider = new KhipuProvider();
    const paymentReference = orderData.orderNumber.toString();
    const transaction = await provider.createPayment(
      orderId,
      amountToCharge,
      returnUrl,
      paymentReference
    );

    const khipuUpdate: Record<string, any> = {
      paymentStatus: "pending",
      paymentDetailsData: {
        provider: "khipu",
        providerPaymentId: transaction.providerPaymentId,
        paymentReference,
        providerStatus: "INITIALIZED",
        updatedAt: now.toISOString(),
        paymentExpiresAt: new Date(now.getTime() + GUEST_WEBPAY_TOKEN_TTL_MS).toISOString()
      }
    };

    await orderRef.update(khipuUpdate);

    logger.info("Khipu transaction created", {
      orderId,
      paymentId: transaction.providerPaymentId,
    });

    return {
      success: true,
      token: transaction.providerPaymentId,
      url: transaction.redirectUrl,
    };
  } catch (error) {
    logger.error("Error creating Khipu transaction:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "Error al iniciar transacción con Khipu");
  }
});

// ==================================================
// FUNCTION: Webhook de Notificación Khipu (Público)
// ==================================================
export const khipuWebhook = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const payload = req.body || {};
  const headers: Record<string, string> = {};
  Object.entries(req.headers).forEach(([k, v]) => {
    headers[k] = String(v);
  });

  logger.info("khipuWebhook: Recibida notificacion de Khipu", { payload });

  try {
    const provider = new KhipuProvider();
    const validation = await provider.validateWebhook(payload, headers);

    if (!validation.isValid) {
      logger.warn("khipuWebhook: Notificacion invalida o sin firma valida", { payload });
      res.status(400).send("Invalid notification signature or payload");
      return;
    }

    if (validation.status === "paid") {
      const db = admin.firestore();
      const orderQuery = db.collection("orders").where("orderNumber", "==", Number(validation.orderId)).limit(1);
      const orderSnap = await orderQuery.get();

      if (orderSnap.empty) {
        logger.error("khipuWebhook: Orden no encontrada por orderNumber", { orderNumber: validation.orderId });
        res.status(404).send("Order not found");
        return;
      }

      const orderDoc = orderSnap.docs[0];
      const orderId = orderDoc.id;

      await OrderProcessingService.processPaymentSuccess(
        orderId,
        "khipu",
        validation.providerPaymentId,
        validation.orderId,
        "APPROVED",
        {},
        validation.rawEvent
      );

      logger.info("khipuWebhook: Pago procesado exitosamente por webhook", { orderId, orderNumber: validation.orderId });
    } else {
      logger.info("khipuWebhook: Notificacion recibida con estado no aprobado", { status: validation.status });
    }

    res.status(200).send("OK");
  } catch (error) {
    logger.error("khipuWebhook: Error procesando notificacion de Khipu", { error });
    res.status(500).send("Internal Server Error");
  }
});

// ==================================================
// FUNCTION: Verificar Transacción Khipu manualmente en retorno
// ==================================================
export const verifyKhipuPayment = onCall(async (request) => {
  const {paymentId, orderId: requestOrderId} = request.data;

  logger.info("verifyKhipuPayment called", {paymentId, orderId: requestOrderId});

  if (!paymentId) {
    throw new HttpsError("invalid-argument", "paymentId es requerido");
  }

  try {
    const provider = new KhipuProvider();

    // Un solo intento rápido — el polling lo maneja el frontend.
    // Así cada llamada responde en ~1-2s en vez de ~10s.
    const verification = await provider.verifyPayment(paymentId);
    logger.info("verifyKhipuPayment: Estado de Khipu", { status: verification.providerStatus, success: verification.success });

    if (!verification) {
      throw new HttpsError("internal", "No se pudo obtener el estado de verificación del pago");
    }

    const db = admin.firestore();
    let orderDoc;
    let orderId = requestOrderId;
    let orderData: any;

    if (requestOrderId) {
      const docRef = db.collection("orders").doc(requestOrderId);
      const docSnap = await docRef.get();
      if (!docSnap.exists) {
        throw new HttpsError("not-found", "Orden asociada al pago no encontrada por ID");
      }
      orderDoc = docSnap;
      orderData = docSnap.data();
    } else {
      const orderQuery = db.collection("orders")
        .where("paymentDetailsData.providerPaymentId", "==", paymentId)
        .limit(1);
      
      const orderSnap = await orderQuery.get();
      if (orderSnap.empty) {
        throw new HttpsError("not-found", "Orden asociada al pago no encontrada");
      }
      orderDoc = orderSnap.docs[0];
      orderId = orderDoc.id;
      orderData = orderDoc.data();
    }

    if (!verification.success) {
      if (verification.providerStatus.toLowerCase() === 'rejected' || verification.providerStatus.toLowerCase() === 'failed') {
        await orderDoc.ref.update({
          paymentStatus: "failed",
          estado: "Pago Rechazado",
          "paymentDetailsData.providerStatus": verification.providerStatus,
          "paymentDetailsData.updatedAt": new Date().toISOString()
        });
      }
      return {
        success: false,
        orderId,
        status: verification.providerStatus
      };
    }

    const processResult = await OrderProcessingService.processPaymentSuccess(
      orderId,
      "khipu",
      paymentId,
      orderData.orderNumber.toString(),
      verification.providerStatus,
      {},
      verification.rawResponse
    );

    return {
      success: true,
      orderId,
      orderNumber: orderData.orderNumber,
      amount: orderData.total,
      email: orderData.cliente?.email || "",
      phone: orderData.cliente?.telefono || orderData.cliente?.phone || "",
      trackingToken: processResult.trackingToken,
      isGuestOrder: processResult.isGuestOrder
    };
  } catch (error) {
    logger.error("Error verifying Khipu transaction:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "Error al verificar transacción con Khipu");
  }
});

// ==================================================
// FUNCTION: Cancelar Transacción Khipu (Abortada por el usuario)
// ==================================================
export const cancelKhipuTransaction = onCall(async (request) => {
  const { paymentId, orderId } = request.data;

  logger.info("cancelKhipuTransaction called", { paymentId, orderId });

  if (!orderId) {
    throw new HttpsError("invalid-argument", "orderId es requerido");
  }

  try {
    const db = admin.firestore();
    const orderRef = db.collection("orders").doc(orderId);
    
    await db.runTransaction(async (transaction) => {
      const orderDoc = await transaction.get(orderRef);

      if (!orderDoc.exists) {
        throw new HttpsError("not-found", "Pedido no encontrado");
      }

      const orderData = orderDoc.data();

      // Si el pedido ya está pagado o cancelado, no hacemos nada
      if (orderData?.paymentStatus === "paid" || orderData?.estado === "Cancelado") {
        logger.info("El pedido ya está pagado o cancelado, ignorando", { orderId, estado: orderData?.estado });
        return;
      }

      const now = new Date();
      // Marcar como cancelado
      transaction.update(orderRef, {
        paymentStatus: "failed",
        estado: "Cancelado",
        cancelReason: "Cancelado por el usuario (retorno sin pagar)",
        canceledAt: now.toISOString(),
        canceledBy: "user",
        "paymentDetailsData.providerStatus": "CANCELED",
        "paymentDetailsData.updatedAt": now.toISOString()
      });
    });

    logger.info("Pedido cancelado exitosamente por abandono en Khipu", { orderId });
    return { success: true };
  } catch (error) {
    logger.error("Error al cancelar transacción Khipu:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Error interno al cancelar el pedido");
  }
});



// ==================================================
// FUNCTION: Conciliación Automática Programada (Cada 10 minutos)
// ==================================================
export const cleanupAndVerifyPayments = onSchedule({
  schedule: "every 10 minutes",
  timeZone: "America/Santiago",
  region: "us-central1",
}, async (event) => {
  logger.info("cleanupAndVerifyPayments: Iniciando conciliacion automatica...");

  try {
    const db = admin.firestore();
    const now = new Date();
    const threeMinutesAgo = new Date(now.getTime() - 3 * 60 * 1000);
    const twentyFiveMinutesAgo = new Date(now.getTime() - 25 * 60 * 1000);

    const pendingOrdersQuery = db
      .collection("orders")
      .where("paymentStatus", "==", "pending")
      .where("timestamps.created", ">=", twentyFiveMinutesAgo.toISOString())
      .where("timestamps.created", "<=", threeMinutesAgo.toISOString());

    const snapshot = await pendingOrdersQuery.get();

    if (snapshot.empty) {
      logger.info("cleanupAndVerifyPayments: No hay pagos pendientes para conciliar");
      return;
    }

    logger.info(`cleanupAndVerifyPayments: Encontradas ${snapshot.size} ordenes pendientes para verificar`);

    const khipu = new KhipuProvider();
    const webpay = new WebpayProvider();

    for (const doc of snapshot.docs) {
      const orderId = doc.id;
      const orderData = doc.data() as any;
      
      const paymentDetails = orderData.paymentDetailsData;
      if (!paymentDetails || !paymentDetails.providerPaymentId) {
        continue;
      }

      try {
        logger.info(`cleanupAndVerifyPayments: Conciliando orden ${orderId}`, {
          provider: paymentDetails.provider,
          paymentId: paymentDetails.providerPaymentId
        });

        if (paymentDetails.provider === "khipu") {
          const verification = await khipu.verifyPayment(paymentDetails.providerPaymentId);
          if (verification.success) {
            await OrderProcessingService.processPaymentSuccess(
              orderId,
              "khipu",
              paymentDetails.providerPaymentId,
              paymentDetails.paymentReference,
              verification.providerStatus,
              {},
              verification.rawResponse
            );
            logger.info(`cleanupAndVerifyPayments: Orden ${orderId} conciliada con EXITO (Khipu)`);
          } else if (verification.providerStatus.toLowerCase() === 'expired' || verification.providerStatus.toLowerCase() === 'rejected') {
            await doc.ref.update({
              paymentStatus: verification.providerStatus.toLowerCase() === 'expired' ? 'expired' : 'failed',
              estado: "Cancelado",
              cancelReason: `Conciliacion: Pago ${verification.providerStatus}`
            });
            logger.info(`cleanupAndVerifyPayments: Orden ${orderId} marcada como expirada/fallida por conciliacion`);
          }
        } else if (paymentDetails.provider === "webpay") {
          const verification = await webpay.verifyPayment(paymentDetails.providerPaymentId);
          if (verification.success) {
            await OrderProcessingService.processPaymentSuccess(
              orderId,
              "webpay",
              paymentDetails.providerPaymentId,
              paymentDetails.paymentReference,
              verification.providerStatus,
              {},
              verification.rawResponse
            );
            logger.info(`cleanupAndVerifyPayments: Orden ${orderId} conciliada con EXITO (Webpay)`);
          }
        }
      } catch (err) {
        logger.error(`cleanupAndVerifyPayments: Error al conciliar orden ${orderId}`, { err });
      }
    }
  } catch (error) {
    logger.error("cleanupAndVerifyPayments: Error en conciliacion", { error });
  }
});

// ==================================================
// MÓDULO: Contacto y Solicitudes
// ==================================================

/**
 * Cloud Function para crear un contacto (público)
 */
export const crearContacto = onCall({ cors: true }, async (request) => {
  const ip = getClientIp(request);
  const authUserId = request.auth ? request.auth.uid : null;

  try {
    return await contactService.crearContacto(request.data, ip, authUserId);
  } catch (error: any) {
    logger.error("Error en crearContacto:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", error.message || "Error al procesar tu mensaje");
  }
});

/**
 * Auxiliar para verificar rol del usuario invocador
 */
async function getRequesterRole(auth: any): Promise<string> {
  if (!auth) {
    throw new HttpsError("unauthenticated", "No estás autenticado.");
  }
  const userDoc = await admin.firestore().collection("users").doc(auth.uid).get();
  if (!userDoc.exists) {
    throw new HttpsError("not-found", "Usuario no encontrado.");
  }
  return userDoc.data()?.role || "customer";
}

/**
 * Cloud Function para obtener listado de contactos paginados (admin/staff)
 */
export const obtenerContactosPaginados = onCall({ cors: true }, async (request) => {
  const role = await getRequesterRole(request.auth);
  try {
    return await contactService.obtenerContactosPaginados(request.data, role);
  } catch (error: any) {
    logger.error("Error en obtenerContactosPaginados:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", error.message || "Error al listar contactos");
  }
});

/**
 * Cloud Function para obtener el detalle de un contacto (admin/staff)
 */
export const obtenerDetalleContacto = onCall({ cors: true }, async (request) => {
  const role = await getRequesterRole(request.auth);
  const { contactoId } = request.data;
  if (!contactoId) {
    throw new HttpsError("invalid-argument", "El contactoId es requerido.");
  }

  try {
    return await contactService.obtenerDetalleContacto(contactoId, role);
  } catch (error: any) {
    logger.error("Error en obtenerDetalleContacto:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", error.message || "Error al obtener detalle del contacto");
  }
});

/**
 * Cloud Function para cambiar el estado de un contacto (admin/staff)
 */
export const cambiarEstadoContacto = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "No estás autenticado.");
  }
  await verifyAdminAccess(request.auth.uid, "Solo los administradores pueden cambiar el estado de los contactos.");

  const db = admin.firestore();
  const adminDoc = await db.collection("users").doc(request.auth.uid).get();
  const adminName = adminDoc.data()?.name || "Administrador";

  try {
    await contactService.cambiarEstadoContacto(request.data, request.auth.uid, adminName);
    return { success: true };
  } catch (error: any) {
    logger.error("Error en cambiarEstadoContacto:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", error.message || "Error al cambiar el estado");
  }
});

/**
 * Cloud Function para marcar un contacto como leído/no leído (admin/staff)
 */
export const marcarLeidoContacto = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "No estás autenticado.");
  }
  await verifyAdminAccess(request.auth.uid, "Solo los administradores pueden marcar contactos como leídos.");

  const db = admin.firestore();
  const adminDoc = await db.collection("users").doc(request.auth.uid).get();
  const adminName = adminDoc.data()?.name || "Administrador";

  try {
    await contactService.marcarLeidoContacto(request.data, request.auth.uid, adminName);
    return { success: true };
  } catch (error: any) {
    logger.error("Error en marcarLeidoContacto:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", error.message || "Error al marcar como leído");
  }
});

/**
 * Cloud Function para archivar/desarchivar un contacto (admin/staff)
 */
export const archivarContacto = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "No estás autenticado.");
  }
  await verifyAdminAccess(request.auth.uid, "Solo los administradores pueden archivar contactos.");

  const db = admin.firestore();
  const adminDoc = await db.collection("users").doc(request.auth.uid).get();
  const adminName = adminDoc.data()?.name || "Administrador";

  try {
    await contactService.archivarContacto(request.data, request.auth.uid, adminName);
    return { success: true };
  } catch (error: any) {
    logger.error("Error en archivarContacto:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", error.message || "Error al archivar el contacto");
  }
});

/**
 * Cloud Function para responder a un contacto (admin/staff)
 */
export const responderContacto = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "No estás autenticado.");
  }
  await verifyAdminAccess(request.auth.uid, "Solo los administradores pueden responder a los contactos.");

  const db = admin.firestore();
  const adminDoc = await db.collection("users").doc(request.auth.uid).get();
  const adminData = adminDoc.data();
  const adminName = adminData?.name || "Administrador";
  const adminEmail = adminData?.email || "contacto@palermopizzas.cl";

  try {
    return await contactService.responderContacto(
      request.data,
      request.auth.uid,
      adminName,
      adminEmail
    );
  } catch (error: any) {
    logger.error("Error en responderContacto:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", error.message || "Error al enviar la respuesta");
  }
});

/**
 * Cloud Function para obtener el conteo de contactos pendientes (admin/staff)
 */
export const obtenerConteoPendientes = onCall({ cors: true }, async (request) => {
  const role = await getRequesterRole(request.auth);
  try {
    return await contactService.obtenerConteoPendientes(role);
  } catch (error: any) {
    logger.error("Error en obtenerConteoPendientes:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", error.message || "Error al obtener conteo");
  }
});


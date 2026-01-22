/**
 * Cloud Functions para Pizzería Palermo
 * Fase 2: Backend Básico con Validaciones
 * Fase 3: Integración Webpay Plus con transacciones atómicas
 *
 * Funciones implementadas:
 * - calculatePrice: Calcular precio de pedido
 * - createOrder: Crear pedido con validaciones (TRANSACCIÓN ATÓMICA)
 * - updateOrderStatus: Actualizar estado de pedido (solo admin)
 * - initWebpayTransaction: Iniciar transacción de pago Webpay
 * - confirmWebpayTransaction: Confirmar pago Webpay (TRANSACCIÓN ATÓMICA)
 * - cleanupAbandonedOrders: Limpiar pedidos huérfanos (SCHEDULED)
 */

import * as admin from "firebase-admin";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {onSchedule} from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";

// Importar servicios
import {
  validateInventoryForOrder,
  consumeInventoryForOrder,
} from "./services/inventory.service";
import {
  calculateOrderTotal,
} from "./services/pricing.service";
import {
  createWebpayTransaction,
  confirmWebpayTransaction as confirmWebpayService,
} from "./services/webpay.service";
import {CreateOrderData} from "./types/orders";

// Inicializar Firebase Admin (solo una vez)
if (!admin.apps.length) {
  admin.initializeApp();
}

// ==================================================
// FUNCTION 1: Calcular Precio de Pedido
// ==================================================
export const calculatePrice = onCall(async (request) => {
  const {items, tipoEntrega, direccion} = request.data;

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

    return {
      success: true,
      ...calculation,
    };
  } catch (error) {
    logger.error("Error calculating price:", error);
    throw new HttpsError(
      "internal",
      "Error al calcular precio"
    );
  }
});

// ==================================================
// FUNCTION 2: Crear Pedido con Validaciones
// ==================================================
export const createOrder = onCall(async (request) => {
  // 1. Verificar autenticación
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuario no autenticado");
  }

  const orderData: CreateOrderData = request.data;

  logger.info("createOrder called", {
    userId: request.auth.uid,
    itemsCount: orderData.items?.length,
  });

  // 2. Validar datos básicos
  if (!orderData.items || orderData.items.length === 0) {
    throw new HttpsError("invalid-argument", "El pedido no tiene items");
  }

  if (!orderData.cliente?.nombre || !orderData.cliente?.telefono) {
    throw new HttpsError(
      "invalid-argument",
      "Datos del cliente incompletos"
    );
  }

  // 3. Validar que el userId coincida con el autenticado
  if (orderData.userId !== request.auth.uid) {
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

      // 4. PRIMERO: Hacer todas las lecturas necesarias
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

      // 5. Calcular precio real en el servidor (NO requiere transaction)
      logger.info("Calculating server-side price...");
      const priceCalculation = await calculateOrderTotal(
        orderData.items,
        orderData.tipoEntrega,
        orderData.direccion
      );

      // 6. Generar número de pedido único
      const orderNumber = Math.floor(10000 + Math.random() * 90000);

      // 7. Determinar el estado inicial según el método de pago
      const initialEstado = orderData.metodoPago === "Webpay Plus" 
        ? "Pago Pendiente" 
        : "Pendiente";

      // 8. AHORA: Hacer todas las escrituras
      const now = new Date();
      const orderRef = db.collection("orders").doc(); // Generar ID primero
      
      const newOrder = {
        ...orderData,
        orderNumber,
        total: priceCalculation.total,
        estado: initialEstado,
        fechaCreacion: now.toLocaleString("es-CL", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }),
        timestamps: {
          created: now.toISOString(),
        },
        inventoryProcessed: initialEstado === "Pendiente", // Procesado si es pago inmediato
        inventoryStatus: initialEstado === "Pendiente" ? "processed" : "pending",
        priceCalculation: {
          subtotal: priceCalculation.subtotal,
          deliveryFee: priceCalculation.deliveryFee,
          total: priceCalculation.total,
        },
      };

      // 9. Si no es Webpay, consumir inventario INMEDIATAMENTE en la transacción
      // Si es Webpay, el inventario se consumirá cuando se confirme el pago
      if (initialEstado === "Pendiente") {
        logger.info("Consuming inventory within transaction...");
        // Pasar también los datos leídos para evitar nuevas lecturas
        await consumeInventoryForOrder(orderData.items, transaction);
      }

      // ✅ CRÍTICO: Escribir pedido en la transacción AL FINAL
      transaction.set(orderRef, newOrder);

      logger.info("Transaction prepared successfully", {orderId: orderRef.id});

      return {
        orderId: orderRef.id,
        orderNumber,
        total: priceCalculation.total,
      };
    });

    // Si llegamos aquí, la transacción fue exitosa
    logger.info("Order created successfully (atomic)", {orderId: result.orderId});

    return {
      success: true,
      id: result.orderId,
      orderNumber: result.orderNumber,
      total: result.total,
    };
  } catch (error) {
    logger.error("Error creating order:", error);
    
    // Propagar errores específicos de inventario
    if (error instanceof HttpsError && error.code === "failed-precondition") {
      return {
        success: false,
        error: "INVENTORY_UNAVAILABLE",
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

  const {orderId, newStatus, consumeInventory} = request.data;

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

    // 5. Si se confirma el pedido y se debe consumir inventario
    if (
      consumeInventory &&
      newStatus === "En preparación" &&
      !orderData?.inventoryProcessed
    ) {
      logger.info("Consuming inventory for order...", {orderId});

      const consumeResult = await consumeInventoryForOrder(
        orderId,
        orderData?.items || []
      );

      if (!consumeResult.success) {
        throw new HttpsError(
          "failed-precondition",
          "Error al consumir inventario"
        );
      }
    }

    await orderRef.update(updates);

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

    throw new HttpsError(
      "internal",
      "Error al actualizar el pedido"
    );
  }
});

// ==================================================
// FUNCTION 4: Iniciar Transacción Webpay Plus
// ==================================================
export const initWebpayTransaction = onCall(async (request) => {
  // 1. Verificar autenticación
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuario no autenticado");
  }

  const {orderId, amount, returnUrl} = request.data;

  logger.info("initWebpayTransaction called", {
    orderId,
    amount,
    userId: request.auth.uid,
  });

  // 2. Validar parámetros
  if (!orderId || !amount || !returnUrl) {
    throw new HttpsError(
      "invalid-argument",
      "orderId, amount y returnUrl son requeridos"
    );
  }

  if (amount <= 0) {
    throw new HttpsError("invalid-argument", "El monto debe ser mayor a 0");
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

    if (orderData?.userId !== request.auth.uid) {
      throw new HttpsError(
        "permission-denied",
        "No tienes permiso para pagar este pedido"
      );
    }

    // 4. Verificar que el pedido no esté ya pagado
    if (orderData?.paymentStatus === "paid") {
      throw new HttpsError(
        "failed-precondition",
        "Este pedido ya fue pagado"
      );
    }

    // 5. Crear transacción con Webpay
    const buyOrder = orderData.orderNumber.toString();
    const sessionId = orderId;

    const transaction = await createWebpayTransaction(
      buyOrder,
      sessionId,
      amount,
      returnUrl
    );

    // 6. Guardar información de la transacción en el pedido
    await orderRef.update({
      "webpay.token": transaction.token,
      "webpay.status": "pending",
      "webpay.createdAt": admin.firestore.FieldValue.serverTimestamp(),
      paymentStatus: "pending",
    });

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
      return {
        success: true,
        orderId,
        responseCode: transactionResult.responseCode,
        authorizationCode: transactionResult.authorizationCode,
        amount: transactionResult.amount,
        cardDetail: transactionResult.cardDetail,
      };
    }

    // 4. Actualizar estado del pedido Y consumir inventario (si exitoso) en transacción atómica
    await db.runTransaction(async (transaction) => {
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

      if (transactionResult.success) {
        // ✅ Pago exitoso - actualizar estado Y consumir inventario ATÓMICAMENTE
        updateData.paymentStatus = "paid";
        updateData["timestamps.paid"] = now.toISOString();
        updateData.estado = "Pendiente";
        updateData.inventoryProcessed = true;
        updateData.inventoryStatus = "processed";

        // Actualizar pedido primero
        transaction.update(orderRef, updateData);

        // Consumir inventario DENTRO de la misma transacción
        logger.info("Consuming inventory for paid order within transaction...");
        if (freshOrderData && freshOrderData.items) {
          await consumeInventoryForOrder(freshOrderData.items, transaction);
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

    return {
      success: transactionResult.success,
      orderId,
      responseCode: transactionResult.responseCode,
      authorizationCode: transactionResult.authorizationCode,
      amount: transactionResult.amount,
      cardDetail: transactionResult.cardDetail,
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
// FUNCTION 6: Limpieza Automática de Pedidos Huérfanos
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

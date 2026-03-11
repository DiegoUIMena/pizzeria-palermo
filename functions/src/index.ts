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
 * - refundOrder: Reembolsar pedido Webpay (Solo admin)
 */

import * as admin from "firebase-admin";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {onSchedule} from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";

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
import {sendWelcomeWhatsApp, sendRefundNotificationWhatsApp, isValidPhoneNumber} from "./services/whatsapp.service";
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

  // 4. Validar que el userId coincida con el autenticado
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

      // 6. Calcular precio real en el servidor (NO requiere transaction)
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
        // ✅ NUEVO: Inventario NO se procesa al crear el pedido
        // Se procesará cuando el admin ACEPTE el pedido (click en "Aceptar")
        inventoryProcessed: false,
        inventoryStatus: "pending",
        priceCalculation: {
          subtotal: priceCalculation.subtotal,
          deliveryFee: priceCalculation.deliveryFee,
          total: priceCalculation.total,
        },
      };

      // ✅ CAMBIO IMPORTANTE: Ya NO consumimos inventario aquí
      // El inventario se consumirá cuando el admin haga clic en "Aceptar"
      // Esto permite rechazar pedidos sin afectar el stock

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
      
      // Marcar inventario como procesado
      updates["inventoryProcessed"] = true;
      updates["inventoryStatus"] = "processed";
      logger.info("✅ Inventario consumido exitosamente");
    }
    
    // 6. Si se CANCELA el pedido, marcar inventario como cancelado (sin consumir)
    if (newStatus === "Cancelado" && !orderData?.inventoryProcessed) {
      updates["inventoryStatus"] = "cancelled_before_processing";
      logger.info("❌ Pedido cancelado - Inventario NO consumido");
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
      
      if (transactionResult.success && freshOrderData && freshOrderData.items) {
        logger.info("Reading inventory and menu items for consumption...");
        inventorySnapshot = await transaction.get(db.collection("ingredientes"));
        itemsMenuSnapshot = await transaction.get(db.collection("items_menu"));
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
          
          logger.info(`🍕 Processing ${freshOrderData.items.length} items for inventory consumption`);
          
          for (const item of freshOrderData.items) {
            // Limpiar el nombre quitando el tamaño entre paréntesis si existe
            // Ejemplo: "amalfitana (familiar)" -> "amalfitana"
            let itemNombre = (item.nombre || "").toLowerCase();
            itemNombre = itemNombre.replace(/\s*\([^)]*\)\s*$/g, '').trim();
            
            const cantidad = item.cantidad || 1;
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

  return await handleChatbotMessage({ tenantId, sessionId, message });
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

    const { tenantId, config } = request.data;
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
    });
    // 5. Restaurar inventario si corresponde
    // (Solo si inventoryProcessed)
    if (orderData.inventoryProcessed) {
      try {
        await restoreInventoryForOrder(orderData.items);
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

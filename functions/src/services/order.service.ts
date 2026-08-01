import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { HttpsError } from 'firebase-functions/v2/https';
import { PaymentProviderType, PaymentDetails, Order } from '../types/orders';
import { addPointsToUser } from '../utils/points-system';

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

/**
 * Procesa el inventario de cajas de empaque de forma similar al flujo original
 */
export function processBoxesInventory(
  db: admin.firestore.Firestore,
  items: any[],
  transactionOrBatch: admin.firestore.Transaction | admin.firestore.WriteBatch,
  isRestore: boolean = false
): void {
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
  const tOrB = transactionOrBatch as any;

  const updates: any = {
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  if (familiar > 0) updates.stockFamiliar = admin.firestore.FieldValue.increment(familiar * multiplier);
  if (mediana > 0) updates.stockMediana = admin.firestore.FieldValue.increment(mediana * multiplier);
  if (individual > 0) updates.stockIndividual = admin.firestore.FieldValue.increment(individual * multiplier);

  tOrB.set(cajasRef, updates, { merge: true });
}

/**
 * Servicio encargado de procesar la lógica de negocio post-pago unificada
 */
export class OrderProcessingService {
  /**
   * Confirma y procesa el pago exitoso de una orden de forma atómica y segura
   */
  public static async processPaymentSuccess(
    orderId: string,
    provider: PaymentProviderType,
    providerPaymentId: string,
    paymentReference: string,
    providerStatus: string,
    metadata: Record<string, string | number | boolean>,
    rawResponse?: Record<string, unknown>
  ): Promise<{ success: boolean; trackingToken?: string; isGuestOrder: boolean }> {
    const db = admin.firestore();
    const orderRef = db.collection("orders").doc(orderId);
    
    logger.info("processPaymentSuccess: Iniciando procesamiento de pago aprobado", {
      orderId,
      provider,
      paymentReference
    });

    const orderDoc = await orderRef.get();
    if (!orderDoc.exists) {
      logger.error("processPaymentSuccess: Orden no encontrada", { orderId });
      throw new HttpsError("not-found", "Pedido no encontrado");
    }

    const orderData = orderDoc.data() as Order;

    // 1. Evitar doble procesamiento si la orden ya está marcada como pagada
    if (orderData.paymentStatus === "paid") {
      logger.info("processPaymentSuccess: Orden ya confirmada anteriormente, saltando actualizacion", { orderId });
      
      let trackingToken: string | undefined;
      if (orderData.customerType === 'guest' && orderData.cliente?.email && orderData.cliente?.telefono) {
        const { generateGuestTrackingToken } = await import('../utils/guest-token.js');
        trackingToken = generateGuestTrackingToken(
          orderData.cliente.email,
          orderData.cliente.telefono,
          90
        );
      }
      
      return {
        success: true,
        trackingToken,
        isGuestOrder: orderData.customerType === 'guest'
      };
    }

    // 2. Ejecutar la transacción Firestore atómica para operaciones críticas
    await db.runTransaction(async (transaction) => {
      // Re-leer documento fresco dentro de la transacción para consistencia
      const freshOrderDoc = await transaction.get(orderRef);
      if (!freshOrderDoc.exists) {
        throw new HttpsError("not-found", "Pedido no encontrado");
      }
      
      const freshOrderData = freshOrderDoc.data() as Order;
      if (freshOrderData.paymentStatus === "paid") {
        logger.warn("processPaymentSuccess: Pago ya procesado por otro hilo concurrente", { orderId });
        return;
      }

      // Leer colecciones necesarias para inventario y códigos promocionales
      const inventorySnapshot = await transaction.get(db.collection("ingredientes"));
      const itemsMenuSnapshot = await transaction.get(db.collection("items_menu"));
      const agregadosConfigSnapshot = await transaction.get(db.collection("settings").doc("agregados_config"));

      // Revalidación en caliente del código promocional si existe en la orden
      let promoRefToUpdate: admin.firestore.DocumentReference | undefined;
      let newPromoUses = 0;
      
      if (freshOrderData.discountCode) {
        const normalizedCode = String(freshOrderData.discountCode).trim().toUpperCase();
        const promoQuery = db.collection("promociones").where("code", "==", normalizedCode).limit(1);
        const promoSnap = await transaction.get(promoQuery);
        
        if (!promoSnap.empty) {
          const promoDoc = promoSnap.docs[0];
          const promoData = promoDoc.data();
          promoRefToUpdate = promoDoc.ref;
          newPromoUses = (promoData.currentUses || 0) + 1;
          
          // Revalidar vigencia y límites
          const isPromoActive = promoData.active !== false;
          const isNotExpired = !promoData.expirationDate || new Date(promoData.expirationDate) >= new Date();
          const hasRemainingUses = !promoData.maxUses || (promoData.currentUses || 0) < promoData.maxUses;
          
          if (!isPromoActive || !isNotExpired || !hasRemainingUses) {
            logger.warn("processPaymentSuccess: Código promocional ya no cumple reglas al confirmar pago", {
              orderId,
              discountCode: normalizedCode,
              active: isPromoActive,
              notExpired: isNotExpired,
              hasRemainingUses
            });
            // Marcamos una advertencia pero no bloqueamos el pago ya cobrado
            freshOrderData.notas = (freshOrderData.notas || "") + "\n[ALERTA: Código promocional inválido post-pago]";
          }
        }
      }

      // Estructurar los datos de actualización del pago
      const now = new Date();
      const paymentDetails: PaymentDetails = {
        provider,
        providerPaymentId,
        paymentReference,
        providerStatus,
        updatedAt: now.toISOString(),
        providerMetadata: {
          ...metadata
        }
      };

      const updateData: Partial<Order> & Record<string, any> = {
        paymentStatus: "paid",
        estado: "Pendiente",
        "timestamps.paid": now.toISOString(),
        paymentDetailsData: paymentDetails,
        inventoryProcessed: true,
        inventoryStatus: "processed",
        notas: freshOrderData.notas || ""
      };

      // Si hay código promocional válido, incrementar sus usos en la transacción
      if (promoRefToUpdate) {
        transaction.update(promoRefToUpdate, {
          currentUses: newPromoUses,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        updateData.promoCodeProcessed = true;
        updateData.promoCodeProcessedAt = now.toISOString();
      }

      // Guardar la orden actualizada
      transaction.update(orderRef, updateData);

      // Descontar inventario de ingredientes
      if (freshOrderData.items && inventorySnapshot && itemsMenuSnapshot) {
        const inventory: Record<string, any> = {};
        inventorySnapshot.forEach((doc) => {
          const data = doc.data();
          inventory[data.nombre.toLowerCase()] = {
            ref: doc.ref,
            stockActual: data.stockActual || 0,
          };
        });

        const pizzasConReceta: Record<string, any> = {};
        itemsMenuSnapshot.forEach((doc) => {
          const data = doc.data();
          pizzasConReceta[(data.nombre || "").toLowerCase()] = {
            nombre: data.nombre,
            receta: data.receta || [],
            recetaMediana: data.recetaMediana || data.receta || [],
          };
        });

        const consumption: Record<string, number> = {};
        let rollitosPacksToConsume = 0;
        const agregadosConfigData = agregadosConfigSnapshot?.exists ? (agregadosConfigSnapshot.data() || {}) : {};
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
          return normalized.includes("canela") && (normalized.includes("roll") || normalized.includes("rol"));
        };

        const flattenedItems = flattenOrderItems(freshOrderData.items);

        for (const item of flattenedItems) {
          const itemNombreOriginal = item.nombre || "";
          const cantidad = item.cantidad || 1;

          if (isRollitosLikeItem(itemNombreOriginal)) {
            rollitosPacksToConsume += cantidad;
            continue;
          }

          let itemNombre = (item.nombre || "").toLowerCase();
          itemNombre = itemNombre.replace(/\s*\([^)]*\)\s*$/g, '').trim();
          const size = (item.size || "Familiar").toLowerCase();

          const isDuoPizza = item.pizzaType === 'duo' && item.pizza1 && item.pizza2;

          if (isDuoPizza) {
            const pizza1Nombre = String(item.pizza1 || '').toLowerCase();
            const pizza2Nombre = String(item.pizza2 || '').toLowerCase();
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
            const pizzaEncontrada = pizzasConReceta[itemNombre];
            const isRollitosOrderItem = isRollitosLikeItem(itemNombreOriginal) || isRollitosLikeItem(String(pizzaEncontrada?.nombre || ""));

            if (isRollitosOrderItem) {
              rollitosPacksToConsume += cantidad;
              continue;
            }

            if (pizzaEncontrada) {
              const receta = size === "mediana" ? pizzaEncontrada.recetaMediana : pizzaEncontrada.receta;
              if (receta) {
                receta.forEach((ing: any) => {
                  const nombreIngrediente = ing.nombre.toLowerCase();
                  const cantidadPorPizza = ing.cantidad || 0;
                  consumption[nombreIngrediente] = (consumption[nombreIngrediente] || 0) + (cantidadPorPizza * cantidad);
                });
              }
            }
          }
        }

        // Aplicar actualizaciones de inventario en Firestore
        Object.entries(consumption).forEach(([ingredientName, quantity]) => {
          const invItem = inventory[ingredientName];
          if (invItem) {
            const newStock = invItem.stockActual - quantity;
            transaction.update(invItem.ref, {
              stockActual: newStock,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
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
          transaction.set(agregadosRef, {
            rollitosPackStock: newRollitosStock,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });
        }

        // Descontar cajas de empaque
        processBoxesInventory(db, freshOrderData.items, transaction, false);
      }
    });

    // 3. Ejecutar operaciones secundarias fuera de la transacción (Recuperables)
    if (orderData.customerType !== 'guest' && orderData.userId) {
      try {
        const orderTotal = orderData.total || 0;
        logger.info('processPaymentSuccess: Otorgando puntos de fidelidad Palermo', {
          userId: orderData.userId,
          orderId,
          orderTotal
        });
        await addPointsToUser(orderData.userId, orderTotal, orderId);
        
        await orderRef.update({
          pointsAdded: true,
          pointsAddedAt: new Date().toISOString()
        });
      } catch (error) {
        logger.error('processPaymentSuccess: Error al otorgar puntos (no critico)', { orderId, error });
      }
    }

    // Generar token de seguimiento para invitados si aplica
    let trackingToken: string | undefined;
    if (orderData.customerType === 'guest' && orderData.cliente?.email && orderData.cliente?.telefono) {
      try {
        const { generateGuestTrackingToken } = await import('../utils/guest-token.js');
        trackingToken = generateGuestTrackingToken(
          orderData.cliente.email,
          orderData.cliente.telefono,
          90
        );
      } catch (error) {
        logger.error('processPaymentSuccess: Error al generar guest tracking token', { orderId, error });
      }
    }

    return {
      success: true,
      trackingToken,
      isGuestOrder: orderData.customerType === 'guest'
    };
  }
}

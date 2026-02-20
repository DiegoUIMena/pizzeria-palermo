/**
 * Servicio de Validación de Inventario
 * Verifica disponibilidad de ingredientes antes de crear pedidos
 */

import * as admin from "firebase-admin";
import {logger} from "firebase-functions/v2";
import {OrderItem} from "../types/orders";

interface InventoryItem {
  id: string;
  nombre: string;
  stockActual: number;
  stockMinimo: number;
  unidad: string;
}

interface ValidationResult {
  success: boolean;
  insufficientItems?: Array<{
    ingrediente: string;
    requerido: number;
    disponible: number;
  }>;
  error?: string;
}

/**
 * Validar disponibilidad de inventario para un pedido
 * @param items - Items del pedido
 * @param transaction - Transacción de Firestore (opcional, para lecturas consistentes)
 */
export async function validateInventoryForOrder(
  items: OrderItem[],
  transaction?: admin.firestore.Transaction
): Promise<ValidationResult> {
  try {
    const db = admin.firestore();

    // ✅ MEJORA: Usar transacción si se proporciona para lecturas consistentes
    const inventorySnapshot = transaction
      ? await transaction.get(db.collection("ingredientes"))
      : await db.collection("ingredientes").get();

    const inventory: Record<string, InventoryItem> = {};
    inventorySnapshot.forEach((doc) => {
      const data = doc.data();
      inventory[data.nombre.toLowerCase()] = {
        id: doc.id,
        nombre: data.nombre,
        stockActual: data.stockActual || 0,
        stockMinimo: data.stockMinimo || 0,
        unidad: data.unidad || "",
      };
    });

    // Obtener recetas desde items_menu
    const itemsMenuSnapshot = transaction
      ? await transaction.get(db.collection("items_menu"))
      : await db.collection("items_menu").get();

    const pizzasConReceta: Record<string, any> = {};
    itemsMenuSnapshot.forEach((doc) => {
      const data = doc.data();
      const nombrePizza = (data.nombre || "").toLowerCase();
      pizzasConReceta[nombrePizza] = {
        nombre: data.nombre,
        receta: data.receta || [], // Array de ingredientes para tamaño familiar
        recetaMediana: data.recetaMediana || data.receta || [], // Array para tamaño mediano
      };
    });

    // Calcular ingredientes necesarios del pedido
    const required: Record<string, number> = {};

    for (const item of items) {
      const itemNombre = (item.nombre || "").toLowerCase();
      const cantidad = item.cantidad || 1;
      const size = (item.size || "Familiar").toLowerCase();

      // Buscar la pizza en items_menu
      let pizzaEncontrada = null;
      for (const [nombrePizza, pizza] of Object.entries(pizzasConReceta)) {
        if (itemNombre.includes(nombrePizza)) {
          pizzaEncontrada = pizza;
          break;
        }
      }

      if (pizzaEncontrada) {
        // Usar receta para calcular ingredientes necesarios
        const recetaArray = size.includes("mediana") 
          ? pizzaEncontrada.recetaMediana 
          : pizzaEncontrada.receta;

        if (recetaArray && Array.isArray(recetaArray) && recetaArray.length > 0) {
          recetaArray.forEach((ing: any) => {
            const nombreIngrediente = (ing.nombre || "").toLowerCase();
            const cantidadPorPizza = parseFloat(ing.cantidad || 0);
            
            if (nombreIngrediente && cantidadPorPizza > 0) {
              required[nombreIngrediente] =
                (required[nombreIngrediente] || 0) + (cantidadPorPizza * cantidad);
            }
          });
        } else {
          // Si no hay receta, usar fallback
          console.warn(`Pizza ${itemNombre} no tiene receta definida`);
          useFallback(item, cantidad, required);
        }
      } else {
        // Fallback: usar lista de ingredientes del item
        useFallback(item, cantidad, required);
      }
    }

    // Función auxiliar para fallback
    function useFallback(item: OrderItem, cantidad: number, required: Record<string, number>) {
      if (item.ingredients) {
        item.ingredients.forEach((ing) => {
          const cleanName = ing.replace(/\s*\(\+\$\d+\)/, "").toLowerCase();
          required[cleanName] = (required[cleanName] || 0) + cantidad;
        });
      }

      if (item.premiumIngredients) {
        item.premiumIngredients.forEach((ing) => {
          const cleanName = ing.replace(/\s*\(\+\$\d+\)/, "").toLowerCase();
          required[cleanName] = (required[cleanName] || 0) + cantidad;
        });
      }

      if (item.sauces) {
        item.sauces.forEach((sauce) => {
          const cleanName = sauce.toLowerCase();
          required[cleanName] = (required[cleanName] || 0) + cantidad;
        });
      }

      if (item.drinks) {
        item.drinks.forEach((drink) => {
          const cleanName = drink.toLowerCase();
          required[cleanName] = (required[cleanName] || 0) + cantidad;
        });
      }
    }

    // Verificar disponibilidad
    const insufficientItems: Array<{
      ingrediente: string;
      requerido: number;
      disponible: number;
    }> = [];

    Object.entries(required).forEach(([ingredientName, quantityNeeded]) => {
      const inventoryItem = inventory[ingredientName];

      if (!inventoryItem) {
        // Ingrediente no encontrado en inventario (puede ser normal para algunos items)
        console.warn(`Ingrediente no encontrado en inventario: ${ingredientName}`);
        return;
      }

      if (inventoryItem.stockActual < quantityNeeded) {
        insufficientItems.push({
          ingrediente: inventoryItem.nombre,
          requerido: quantityNeeded,
          disponible: inventoryItem.stockActual,
        });
      }
    });

    if (insufficientItems.length > 0) {
      return {
        success: false,
        insufficientItems,
      };
    }

    return {success: true};
  } catch (error) {
    console.error("Error validating inventory:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}

/**
 * Consumir inventario para un pedido
 * @param items - Items del pedido
 * @param transaction - Transacción de Firestore (opcional, si ya hay una en curso)
 */
export async function consumeInventoryForOrder(
  items: OrderItem[],
  transaction?: admin.firestore.Transaction
): Promise<{success: boolean; error?: string}> {
  try {
    const db = admin.firestore();

    // ✅ MEJORA: Si ya hay una transacción, usarla. Si no, crear una nueva
    const executeConsumption = async (t: admin.firestore.Transaction) => {
      // 1. Obtener todos los ingredientes
      const inventorySnapshot = await t.get(
        db.collection("ingredientes")
      );

      const inventory: Record<string, any> = {};
      inventorySnapshot.forEach((doc) => {
        const data = doc.data();
        inventory[data.nombre.toLowerCase()] = {
          ref: doc.ref,
          stockActual: data.stockActual || 0,
        };
      });

      // 2. Obtener todas las pizzas con sus recetas desde items_menu
      const itemsMenuSnapshot = await t.get(
        db.collection("items_menu")
      );

      const pizzasConReceta: Record<string, any> = {};
      itemsMenuSnapshot.forEach((doc) => {
        const data = doc.data();
        const nombrePizza = (data.nombre || "").toLowerCase();
        pizzasConReceta[nombrePizza] = {
          nombre: data.nombre,
          receta: data.receta || [], // Array de ingredientes para tamaño familiar
          recetaMediana: data.recetaMediana || data.receta || [], // Array para tamaño mediano
        };
      });

      logger.info(`Loaded ${itemsMenuSnapshot.size} pizzas from items_menu`);

      // 3. Calcular consumo necesario por ingrediente
      const consumption: Record<string, number> = {};

      for (const item of items) {
        const itemNombre = (item.nombre || "").toLowerCase();
        const cantidad = item.cantidad || 1;
        const size = (item.size || "Familiar").toLowerCase();
        
        logger.info(`Processing item: ${itemNombre}, size: ${size}, cantidad: ${cantidad}`);
        
        // 🔴 LOG RAW ITEM DATA
        logger.info('🔴 RAW ITEM DATA:', JSON.stringify({
          nombre: item.nombre,
          pizzaType: item.pizzaType,
          pizza1: item.pizza1,
          pizza2: item.pizza2,
          typeofPizzaType: typeof item.pizzaType,
          typeofPizza1: typeof item.pizza1,
          typeofPizza2: typeof item.pizza2
        }, null, 2));
        
        // 🔴 VERIFICAR SI ES PIZZA DÚO
        const isDuoPizza = item.pizzaType === 'duo' && item.pizza1 && item.pizza2;
        logger.info('🔴 isDuoPizza CHECK:', {
          pizzaType: item.pizzaType,
          pizza1: item.pizza1,
          pizza2: item.pizza2,
          result: isDuoPizza
        });
        
        // SI ES PIZZA DÚO, procesar ambas pizzas al 50%
        if (isDuoPizza) {
          logger.info(`🍕 PIZZA DÚO DETECTADA: ${item.pizza1} / ${item.pizza2}`);
          
          // Normalizar nombres de pizzas
          const pizza1Name = (item.pizza1 || "").toLowerCase().trim();
          const pizza2Name = (item.pizza2 || "").toLowerCase().trim();
          
          // Buscar ambas pizzas
          let pizza1Encontrada: any = null;
          let pizza2Encontrada: any = null;
          
          for (const [nombrePizza, pizza] of Object.entries(pizzasConReceta)) {
            if (nombrePizza.includes(pizza1Name) || pizza1Name.includes(nombrePizza)) {
              pizza1Encontrada = pizza;
            }
            if (nombrePizza.includes(pizza2Name) || pizza2Name.includes(nombrePizza)) {
              pizza2Encontrada = pizza;
            }
          }
          
          if (pizza1Encontrada && pizza2Encontrada) {
            logger.info(`✅ Ambas pizzas encontradas: ${pizza1Encontrada.nombre} + ${pizza2Encontrada.nombre}`);
            
            // Obtener recetas según tamaño
            const receta1 = size.includes("mediana") 
              ? pizza1Encontrada.recetaMediana 
              : pizza1Encontrada.receta;
              
            const receta2 = size.includes("mediana") 
              ? pizza2Encontrada.recetaMediana 
              : pizza2Encontrada.receta;
            
            // Procesar ingredientes de pizza 1 al 50%
            if (receta1 && Array.isArray(receta1)) {
              receta1.forEach((ing: any) => {
                const nombreIngrediente = (ing.nombre || "").toLowerCase();
                const cantidadPorPizza = parseFloat(ing.cantidad || 0) * 0.5; // 50%
                
                if (nombreIngrediente && cantidadPorPizza > 0) {
                  consumption[nombreIngrediente] =
                    (consumption[nombreIngrediente] || 0) + (cantidadPorPizza * cantidad);
                  
                  logger.info(`  [50% ${pizza1Encontrada.nombre}] ${nombreIngrediente}: +${cantidadPorPizza * cantidad}${ing.unidad || "gr"}`);
                }
              });
            }
            
            // Procesar ingredientes de pizza 2 al 50%
            if (receta2 && Array.isArray(receta2)) {
              receta2.forEach((ing: any) => {
                const nombreIngrediente = (ing.nombre || "").toLowerCase();
                const cantidadPorPizza = parseFloat(ing.cantidad || 0) * 0.5; // 50%
                
                if (nombreIngrediente && cantidadPorPizza > 0) {
                  consumption[nombreIngrediente] =
                    (consumption[nombreIngrediente] || 0) + (cantidadPorPizza * cantidad);
                  
                  logger.info(`  [50% ${pizza2Encontrada.nombre}] ${nombreIngrediente}: +${cantidadPorPizza * cantidad}${ing.unidad || "gr"}`);
                }
              });
            }
            
            logger.info(`✅ Pizza Dúo procesada correctamente, saltando lógica normal`);
            continue; // Saltar TODA la lógica normal
          } else {
            logger.error(`❌ No se encontraron las pizzas para el Dúo: ${pizza1Name} / ${pizza2Name}`);
            // Si no encuentra las pizzas del dúo, continuar con lógica normal como fallback
          }
        }

        // ⚠️ ESTA LÓGICA SOLO SE EJECUTA SI NO ES PIZZA DÚO O SI FALLÓ LA BÚSQUEDA
        logger.info(`🔵 Procesando con lógica normal (no es Pizza Dúo)`);
        
        // Buscar la pizza en items_menu
        let pizzaEncontrada = null;
        for (const [nombrePizza, pizza] of Object.entries(pizzasConReceta)) {
          if (itemNombre.includes(nombrePizza)) {
            pizzaEncontrada = pizza;
            break;
          }
        }

        if (pizzaEncontrada) {
          logger.info(`Found pizza: ${pizzaEncontrada.nombre}`);
          
          // Determinar qué receta usar según el tamaño
          const recetaArray = size.includes("mediana") 
            ? pizzaEncontrada.recetaMediana 
            : pizzaEncontrada.receta;

          if (recetaArray && Array.isArray(recetaArray) && recetaArray.length > 0) {
            // Sumar las cantidades de cada ingrediente
            recetaArray.forEach((ing: any) => {
              const nombreIngrediente = (ing.nombre || "").toLowerCase();
              const cantidadPorPizza = parseFloat(ing.cantidad || 0);
              
              if (nombreIngrediente && cantidadPorPizza > 0) {
                consumption[nombreIngrediente] =
                  (consumption[nombreIngrediente] || 0) + (cantidadPorPizza * cantidad);
                
                logger.info(`  ${nombreIngrediente}: +${cantidadPorPizza * cantidad}${ing.unidad || "gr"} (${cantidadPorPizza}${ing.unidad || "gr"} x ${cantidad} pizzas)`);
              }
            });
          } else {
            logger.warn(`Pizza ${pizzaEncontrada.nombre} found but no recipe defined for size ${size}`);
            // Fallback
            useFallbackConsumption(item, cantidad, consumption);
          }
        } else {
          logger.warn(`No pizza found for: ${itemNombre}. Using fallback.`);
          // Fallback: si no hay receta, usar la lista de ingredientes del pedido
          useFallbackConsumption(item, cantidad, consumption);
        }
      }

      // Función auxiliar para fallback
      function useFallbackConsumption(item: OrderItem, cantidad: number, consumption: Record<string, number>) {
        [
          ...(item.ingredients || []),
          ...(item.premiumIngredients || []),
          ...(item.sauces || []),
          ...(item.drinks || []),
        ].forEach((ing) => {
          const cleanName = ing
            .replace(/\s*\(\+\$\d+\)/, "")
            .toLowerCase();
          consumption[cleanName] =
            (consumption[cleanName] || 0) + cantidad;
        });
      }

      logger.info("Total consumption calculated:", consumption);

      // 4. Actualizar stocks en la transacción
      Object.entries(consumption).forEach(([ingredientName, quantity]) => {
        const invItem = inventory[ingredientName];
        if (invItem) {
          const newStock = invItem.stockActual - quantity;
          logger.info(`Updating ${ingredientName}: ${invItem.stockActual}gr -> ${newStock}gr (-${quantity}gr)`);
          
          t.update(invItem.ref, {
            stockActual: newStock,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } else {
          logger.warn(`Ingredient not found in inventory: ${ingredientName}`);
        }
      });
    };

    // Si se proporcionó una transacción, usarla. Si no, crear una nueva
    if (transaction) {
      await executeConsumption(transaction);
    } else {
      await db.runTransaction(executeConsumption);
    }

    return {success: true};
  } catch (error) {
    logger.error("Error consuming inventory:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}

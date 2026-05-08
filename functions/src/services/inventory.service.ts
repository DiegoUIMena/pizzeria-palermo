/**
 * Servicio de Validación de Inventario
 * Verifica disponibilidad de ingredientes antes de crear pedidos
 */

import * as admin from "firebase-admin";
import {logger} from "firebase-functions/v2";
import {OrderItem} from "../types/orders";

// Función auxiliar para parsear strings de ingredientes (ej: "Queso (x2)")
function parseItemString(s: string): { name: string; quantity: number } {
  const match = s.match(/^(.+?)\s*\(x(\d+)\)$/);
  if (match) {
    return { name: match[1].trim(), quantity: parseInt(match[2], 10) };
  }
  return { name: s.trim(), quantity: 1 };
}

// Función auxiliar para normalizar texto
function normalizeText(text: string): string {
  return text.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Eliminar acentos
    .trim();
}

interface AgregadosConfig {
  rollitosPackStock: number;
  gauchitosDisponible: boolean;
  salsasDisponibles: {
    ajo: boolean;
    chimichurri: boolean;
    bbq: boolean;
    pesto: boolean;
  };
}

const DEFAULT_AGREGADOS_CONFIG: AgregadosConfig = {
  rollitosPackStock: 99,
  gauchitosDisponible: true,
  salsasDisponibles: {
    ajo: true,
    chimichurri: true,
    bbq: true,
    pesto: true,
  },
};

type SalsaKey = keyof AgregadosConfig["salsasDisponibles"];

function detectSalsaKey(value: string): SalsaKey | null {
  const normalized = normalizeText(value || "");

  if (normalized.includes("chimichurri")) {
    return "chimichurri";
  }
  if (normalized.includes("pesto")) {
    return "pesto";
  }
  if (normalized.includes("bbq") || normalized.includes("barbecue")) {
    return "bbq";
  }
  if (normalized.includes("ajo")) {
    return "ajo";
  }

  return null;
}

function detectStandaloneSalsaKey(value: string): SalsaKey | null {
  const normalized = normalizeText(value || "");
  if (!normalized.includes("salsa")) {
    return null;
  }

  return detectSalsaKey(value);
}

function getUnavailableSauceLabel(
  key: SalsaKey,
  config: AgregadosConfig
): string | null {
  if (config.salsasDisponibles[key]) {
    return null;
  }

  const labels: Record<SalsaKey, string> = {
    ajo: "Salsa de Ajo",
    chimichurri: "Salsa Chimichurri",
    bbq: "Salsa BBQ",
    pesto: "Salsa Pesto",
  };

  return labels[key];
}

function isGauchitosLikeItem(name: string): boolean {
  const normalizedName = normalizeText(name || "");
  return normalizedName.includes("gauchito") || normalizedName.includes("cauchito");
}

function isRollitosLikeItem(name: string): boolean {
  const normalizedName = normalizeText(name || "");
  return normalizedName.includes("rollito") && normalizedName.includes("canela");
}

async function getAgregadosConfig(
  transaction?: admin.firestore.Transaction
): Promise<AgregadosConfig> {
  try {
    const db = admin.firestore();
    const ref = db.collection("settings").doc("agregados_config");
    const snap = transaction ? await transaction.get(ref) : await ref.get();

    if (!snap.exists) {
      return DEFAULT_AGREGADOS_CONFIG;
    }

    const data = snap.data() || {};
    const rollitosRaw = Number(data.rollitosPackStock);
    const salsasData = data.salsasDisponibles || {};

    return {
      rollitosPackStock:
        Number.isFinite(rollitosRaw) && rollitosRaw >= 0
          ? Math.floor(rollitosRaw)
          : DEFAULT_AGREGADOS_CONFIG.rollitosPackStock,
      gauchitosDisponible:
        typeof data.gauchitosDisponible === "boolean"
          ? data.gauchitosDisponible
          : DEFAULT_AGREGADOS_CONFIG.gauchitosDisponible,
      salsasDisponibles: {
        ajo:
          typeof salsasData.ajo === "boolean"
            ? salsasData.ajo
            : DEFAULT_AGREGADOS_CONFIG.salsasDisponibles.ajo,
        chimichurri:
          typeof salsasData.chimichurri === "boolean"
            ? salsasData.chimichurri
            : DEFAULT_AGREGADOS_CONFIG.salsasDisponibles.chimichurri,
        bbq:
          typeof salsasData.bbq === "boolean"
            ? salsasData.bbq
            : DEFAULT_AGREGADOS_CONFIG.salsasDisponibles.bbq,
        pesto:
          typeof salsasData.pesto === "boolean"
            ? salsasData.pesto
            : DEFAULT_AGREGADOS_CONFIG.salsasDisponibles.pesto,
      },
    };
  } catch (error) {
    logger.error("Error reading agregados_config, using defaults", error);
    return DEFAULT_AGREGADOS_CONFIG;
  }
}

/**
 * Procesar ingredientes extras de un item con cantidades estándar
 * Similar a buildRecipeLinesFromIngredients del frontend
 */
async function processExtrasForItem(
  item: OrderItem,
  ingredientesMap: Record<string, any>,
  consumption: Record<string, number>,
  cantidad: number,
  agregadosConfig: AgregadosConfig
): Promise<void> {
  const pizzaSize = (item.size || 'Familiar').toLowerCase();
  const isMediana = pizzaSize === 'mediana';
  
  logger.info(`🔧 [processExtrasForItem] Entrada:`, {
    itemName: item.nombre,
    pizzaSize,
    isMediana,
    cantidad,
    ingredients: item.ingredients,
    premiumIngredients: item.premiumIngredients,
    extras: item.extras,
    sauces: item.sauces,
    drinks: item.drinks,
    totalIngredientesDisponibles: Object.keys(ingredientesMap).length
  });
  
  const processArray = (arr?: string[], arrayName?: string) => {
    if (!arr || arr.length === 0) {
      logger.info(`   ⏭️ ${arrayName || 'Array'}: vacío, saltando`);
      return;
    }
    
    logger.info(`   📋 Procesando ${arrayName || 'array'}: ${arr.length} items`);
    
    arr.forEach(s => {
      const parsed = parseItemString(s);
      const normalizedName = normalizeText(parsed.name);
      
      // 🔧 IMPORTANTE: Si es una salsa disponible por configuración, saltarla
      if (arrayName === 'sauces') {
        const sauceKey = detectSalsaKey(normalizedName);
        if (sauceKey && agregadosConfig.salsasDisponibles[sauceKey]) {
          logger.info(`      🔍 Salsa ${parsed.name} disponible por configuración, saltando consumo`);
          return;
        }
      }
      
      logger.info(`      🔍 Procesando: "${s}"`);
      logger.info(`         Parseado: name="${parsed.name}", quantity=${parsed.quantity}`);
      logger.info(`         Normalizado: "${normalizedName}"`);
      
      const ingDoc = ingredientesMap[normalizedName];
      
      if (ingDoc) {
        logger.info(`         ✅ Encontrado en ingredientesMap: ${ingDoc.nombre}`);
        logger.info(`         Cantidades estándar: mediana=${ingDoc.cantidadPorPizzaMediana}, familiar=${ingDoc.cantidadPorPizzaFamiliar}`);
        
        let cantidadPorIngrediente: number;
        
        // Usar cantidades estándar según tamaño
        if (isMediana && ingDoc.cantidadPorPizzaMediana) {
          cantidadPorIngrediente = ingDoc.cantidadPorPizzaMediana * parsed.quantity;
          logger.info(`✅ Extra "${parsed.name}": ${cantidadPorIngrediente}${ingDoc.unidad || 'g'} (${ingDoc.cantidadPorPizzaMediana}${ingDoc.unidad || 'g'} × ${parsed.quantity}) - MEDIANA`);
        } else if (!isMediana && ingDoc.cantidadPorPizzaFamiliar) {
          cantidadPorIngrediente = ingDoc.cantidadPorPizzaFamiliar * parsed.quantity;
          logger.info(`✅ Extra "${parsed.name}": ${cantidadPorIngrediente}${ingDoc.unidad || 'g'} (${ingDoc.cantidadPorPizzaFamiliar}${ingDoc.unidad || 'g'} × ${parsed.quantity}) - FAMILIAR`);
        } else {
          // Fallback: usar cantidad parseada
          cantidadPorIngrediente = parsed.quantity;
          logger.info(`⚠️ Extra "${parsed.name}": ${cantidadPorIngrediente}${ingDoc.unidad || 'u'} (sin cantidad estándar, usando fallback)`);
        }
        
        consumption[normalizedName] = (consumption[normalizedName] || 0) + (cantidadPorIngrediente * cantidad);
      } else {
        logger.warn(`         ❌ NO encontrado en ingredientesMap con nombre normalizado: "${normalizedName}"`);
        logger.info(`         🔍 Intentando búsqueda parcial...`);
        
        // Búsqueda alternativa por nombre parcial
        const matchingEntry = Object.entries(ingredientesMap).find(([key, _]) =>
          normalizedName.includes(key) || key.includes(normalizedName)
        );
        
        if (matchingEntry) {
          const [matchedKey, ingData] = matchingEntry;
          logger.info(`         ✅ Match parcial encontrado: "${ingData.nombre}" (key: "${matchedKey}")`);
          
          let cantidadPorIngrediente: number;
          
          if (isMediana && ingData.cantidadPorPizzaMediana) {
            cantidadPorIngrediente = ingData.cantidadPorPizzaMediana * parsed.quantity;
          } else if (!isMediana && ingData.cantidadPorPizzaFamiliar) {
            cantidadPorIngrediente = ingData.cantidadPorPizzaFamiliar * parsed.quantity;
          } else {
            cantidadPorIngrediente = parsed.quantity;
          }
          
          consumption[matchedKey] = (consumption[matchedKey] || 0) + (cantidadPorIngrediente * cantidad);
          logger.info(`✅ Extra similar encontrado: "${ingData.nombre}" para "${parsed.name}"`);
        } else {
          logger.error(`❌ No se encontró ingrediente para extra: "${parsed.name}"`);
          logger.error(`   Nombre normalizado buscado: "${normalizedName}"`);
          logger.error(`   Ingredientes disponibles (primeros 10):`, Object.keys(ingredientesMap).slice(0, 10));
          logger.error(`   Total de ingredientes en el sistema: ${Object.keys(ingredientesMap).length}`);
        }
      }
    });
  };

  // Procesar todos los arrays de ingredientes
  processArray(item.ingredients, 'ingredients');
  processArray(item.premiumIngredients, 'premiumIngredients');
  processArray(item.sauces, 'sauces');
  processArray(item.drinks, 'drinks');
  processArray(item.extras, 'extras');
  
  logger.info(`✅ [processExtrasForItem] Completado. Consumption actualizado:`, consumption);
}

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
    const agregadosConfig = await getAgregadosConfig(transaction);

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
      const itemNombreOriginal = item.nombre || "";
      const cantidad = item.cantidad || 1;

      const standaloneSauceKey = detectStandaloneSalsaKey(itemNombreOriginal);
      if (standaloneSauceKey) {
        const unavailableSauce = getUnavailableSauceLabel(standaloneSauceKey, agregadosConfig);
        if (unavailableSauce) {
          return {
            success: false,
            insufficientItems: [{
              ingrediente: unavailableSauce,
              requerido: cantidad,
              disponible: 0,
            }],
          };
        }

        logger.info(`Skipping recipe validation for standalone sauce item ${itemNombreOriginal} by config`);
        continue;
      }

      for (const sauce of item.sauces || []) {
        const sauceKey = detectSalsaKey(sauce);
        if (!sauceKey) {
          continue;
        }

        const unavailableSauce = getUnavailableSauceLabel(sauceKey, agregadosConfig);
        if (unavailableSauce) {
          return {
            success: false,
            insufficientItems: [{
              ingrediente: unavailableSauce,
              requerido: cantidad,
              disponible: 0,
            }],
          };
        }
      }

      if (isRollitosLikeItem(itemNombreOriginal)) {
        if (agregadosConfig.rollitosPackStock >= cantidad) {
          logger.info(`Skipping recipe validation for ${itemNombreOriginal} by config packs`);
          continue;
        }

        return {
          success: false,
          insufficientItems: [{
            ingrediente: "Rollitos de Canela (packs)",
            requerido: cantidad,
            disponible: Math.max(0, agregadosConfig.rollitosPackStock),
          }],
        };
      }

      if (isGauchitosLikeItem(itemNombreOriginal)) {
        if (agregadosConfig.gauchitosDisponible) {
          logger.info(`Skipping inventory validation for ${itemNombreOriginal} by config`);
          continue;
        }

        return {
          success: false,
          insufficientItems: [{
            ingrediente: "Gauchitos",
            requerido: cantidad,
            disponible: 0,
          }],
        };
      }

      // Limpiar el nombre quitando el tamaño entre paréntesis si existe
      let itemNombre = (item.nombre || "").toLowerCase();
      itemNombre = itemNombre.replace(/\s*\([^)]*\)\s*$/g, '').trim();

      const size = (item.size || "Familiar").toLowerCase();

      // Buscar la pizza en items_menu
      let pizzaEncontrada = null;
      for (const [nombrePizza, pizza] of Object.entries(pizzasConReceta)) {
        if (itemNombre.includes(nombrePizza)) {
          pizzaEncontrada = pizza;
          break;
        }
      }

      const isGauchitosOrderItem =
        isGauchitosLikeItem(itemNombreOriginal) ||
        isGauchitosLikeItem(String((pizzaEncontrada as any)?.nombre || ""));

      const isRollitosOrderItem =
        isRollitosLikeItem(itemNombreOriginal) ||
        isRollitosLikeItem(String((pizzaEncontrada as any)?.nombre || ""));

      if (isRollitosOrderItem) {
        if (agregadosConfig.rollitosPackStock >= cantidad) {
          logger.info(`Skipping recipe validation for ${itemNombreOriginal} by config packs (matched by menu/name)`);
          continue;
        }

        return {
          success: false,
          insufficientItems: [{
            ingrediente: "Rollitos de Canela (packs)",
            requerido: cantidad,
            disponible: Math.max(0, agregadosConfig.rollitosPackStock),
          }],
        };
      }

      if (isGauchitosOrderItem) {
        if (agregadosConfig.gauchitosDisponible) {
          logger.info(`Skipping inventory validation for ${itemNombreOriginal} by config (matched by menu/name)`);
          continue;
        }

        return {
          success: false,
          insufficientItems: [{
            ingrediente: "Gauchitos",
            requerido: cantidad,
            disponible: 0,
          }],
        };
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
          // ❌ RECETA NO DEFINIDA - RECHAZAR PEDIDO
          console.error(`❌ RECETA NO DEFINIDA: ${pizzaEncontrada.nombre} (${size})`);
          return {
            success: false,
            error: `La pizza "${pizzaEncontrada.nombre}" no tiene receta definida para tamaño ${size}. Por favor contacte al administrador.`,
            insufficientItems: [{
              ingrediente: `Receta de ${pizzaEncontrada.nombre}`,
              requerido: 1,
              disponible: 0
            }]
          };
        }
      } else {
        // ❌ PIZZA NO ENCONTRADA - Intentar fallback solo para items personalizados
        console.warn(`Pizza no encontrada en menú: ${itemNombre}`);
        
        // Solo permitir fallback si el item tiene ingredientes explícitos (pizza personalizada)
        const hasExplicitIngredients = 
          (item.ingredients && item.ingredients.length > 0) ||
          (item.premiumIngredients && item.premiumIngredients.length > 0);
        
        if (hasExplicitIngredients) {
          // Pizza personalizada con ingredientes definidos
          useFallback(item, cantidad, required);
        } else {
          // Pizza del menú sin receta - RECHAZAR
          console.error(`❌ PIZZA SIN RECETA: ${item.nombre}`);
          return {
            success: false,
            error: `La pizza "${item.nombre}" no tiene receta definida. Por favor contacte al administrador.`,
            insufficientItems: [{
              ingrediente: `Receta de ${item.nombre}`,
              requerido: 1,
              disponible: 0
            }]
          };
        }
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
      // 🔧 IMPORTANTE: Las salsas se controlan por configuración, no por inventario
      const sauceKey = detectSalsaKey(ingredientName);
      if (sauceKey) {
        // Si la salsa está disponible en la configuración, no validar inventario
        if (agregadosConfig.salsasDisponibles[sauceKey]) {
          logger.info(`✅ Salsa ${ingredientName} disponible por configuración, saltando validación de inventario`);
          return;
        }
        // Si la salsa NO está disponible, reportar error
        const unavailableSauce = getUnavailableSauceLabel(sauceKey, agregadosConfig);
        if (unavailableSauce) {
          insufficientItems.push({
            ingrediente: unavailableSauce,
            requerido: quantityNeeded,
            disponible: 0,
          });
          return;
        }
      }

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
 * @param orderId - ID del pedido
 * @param orderNumber - Número del pedido
 * @param transaction - Transacción de Firestore (opcional, si ya hay una en curso)
 */
export async function consumeInventoryForOrder(
  items: OrderItem[],
  orderId?: string,
  orderNumber?: number,
  transaction?: admin.firestore.Transaction
): Promise<{success: boolean; error?: string}> {
  try {
    const db = admin.firestore();

    // ⚠️ VALIDACIÓN CRÍTICA: Verificar que hay items que procesar
    if (!items || items.length === 0) {
      logger.error("❌ CRITICAL: consumeInventoryForOrder called with empty items array");
      return {
        success: false,
        error: "No hay items para procesar en el pedido"
      };
    }

    logger.info(`🍕 Procesando inventario para ${items.length} item(s)`);
    items.forEach((item, idx) => {
      logger.info(`Item ${idx + 1}: ${item.nombre} (tipo: ${item.pizzaType || 'normal'}, size: ${item.size}, qty: ${item.cantidad})`);
    });

    // ✅ MEJORA: Si ya hay una transacción, usarla. Si no, crear una nueva
    const executeConsumption = async (t: admin.firestore.Transaction) => {
      const agregadosConfig = await getAgregadosConfig(t);

      // 1. Obtener todos los ingredientes (INCLUYENDO cantidades estándar)
      const inventorySnapshot = await t.get(
        db.collection("ingredientes")
      );

      const inventory: Record<string, any> = {};
      const ingredientesMap: Record<string, any> = {}; // Para búsqueda por nombre
      
      inventorySnapshot.forEach((doc) => {
        const data = doc.data();
        const normalizedName = normalizeText(data.nombre);
        
        inventory[normalizedName] = {
          ref: doc.ref,
          stockActual: data.stockActual || 0,
        };
        
        // Almacenar datos completos del ingrediente (incluyendo cantidades estándar)
        ingredientesMap[normalizedName] = {
          id: doc.id,
          nombre: data.nombre,
          unidad: data.unidad || 'g',
          cantidadPorPizzaMediana: data.cantidadPorPizzaMediana,
          cantidadPorPizzaFamiliar: data.cantidadPorPizzaFamiliar
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
      let rollitosPacksToConsume = 0;
      let gauchitosUnitsProcessed = 0;
      let standaloneSaucesProcessed = 0;

      for (const item of items) {
        const itemNombreOriginal = item.nombre || "";
        const cantidad = item.cantidad || 1;

        const standaloneSauceKey = detectStandaloneSalsaKey(itemNombreOriginal);
        if (standaloneSauceKey) {
          const unavailableSauce = getUnavailableSauceLabel(standaloneSauceKey, agregadosConfig);
          if (unavailableSauce) {
            throw new Error(`${unavailableSauce} no disponible`);
          }

          standaloneSaucesProcessed += cantidad;
          logger.info(`Skipping ingredient consumption for standalone sauce item ${itemNombreOriginal} by config`);
          continue;
        }

        for (const sauce of item.sauces || []) {
          const sauceKey = detectSalsaKey(sauce);
          if (!sauceKey) {
            continue;
          }

          const unavailableSauce = getUnavailableSauceLabel(sauceKey, agregadosConfig);
          if (unavailableSauce) {
            throw new Error(`${unavailableSauce} no disponible`);
          }
        }

        if (isRollitosLikeItem(itemNombreOriginal)) {
          rollitosPacksToConsume += cantidad;
          logger.info(`Skipping ingredient consumption for ${itemNombreOriginal} and accounting ${cantidad} rollitos pack(s)`);
          continue;
        }

        if (isGauchitosLikeItem(itemNombreOriginal)) {
          if (!agregadosConfig.gauchitosDisponible) {
            logger.warn(`Gauchitos disabled in config while consuming order ${orderId || "unknown-order"}, skipping inventory discount`);
          }
          logger.info(`Skipping inventory consumption for ${itemNombreOriginal} by config`);
          gauchitosUnitsProcessed += cantidad;
          continue;
        }

        // Limpiar el nombre quitando el tamaño entre paréntesis si existe
        // Ejemplo: "amalfitana (familiar)" -> "amalfitana"
        let itemNombre = (item.nombre || "").toLowerCase();
        itemNombre = itemNombre.replace(/\s*\([^)]*\)\s*$/g, '').trim();
        
        const size = (item.size || "Familiar").toLowerCase();
        
        logger.info(`Processing item: ${item.nombre} -> cleaned: "${itemNombre}", size: ${size}, cantidad: ${cantidad}`);
        
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
        
        // ✅ NUEVO: Detectar pizzas tipo "premium" o "promo" (Armar Pizza)
        // Estas NO están en items_menu como pizzas individuales
        const isPremiumOrPromo = item.pizzaType === 'premium' || item.pizzaType === 'promo';
        
        if (isPremiumOrPromo) {
          logger.info(`🍕 PIZZA PREMIUM/PROMO DETECTADA: ${item.nombre}`);
          logger.info(`   Tipo: ${item.pizzaType}, Tamaño: ${size}`);
          logger.info(`   Item completo:`, JSON.stringify(item, null, 2));
          
          // Determinar si es mediana o familiar
          const isMediana = size === 'mediana';
          
          // ⭐ NUEVO: Verificar si tiene una pizza base seleccionada (ej: Napolitana)
          const selectedMenuPizza = (item as any).selectedMenuPizza;
          
          if (selectedMenuPizza && selectedMenuPizza !== 'base' && selectedMenuPizza !== '') {
            logger.info(`   🎯 PIZZA BASE DETECTADA: ${selectedMenuPizza}`);
            
            // Buscar la pizza base en items_menu
            const pizzaBaseNormalizada = normalizeText(selectedMenuPizza);
            let pizzaBaseEncontrada = null;
            
            for (const [nombrePizza, pizza] of Object.entries(pizzasConReceta)) {
              if (normalizeText(nombrePizza) === pizzaBaseNormalizada || 
                  normalizeText(pizza.nombre).includes(pizzaBaseNormalizada)) {
                pizzaBaseEncontrada = pizza;
                logger.info(`   ✅ Pizza base encontrada en items_menu: ${pizza.nombre}`);
                break;
              }
            }
            
            if (pizzaBaseEncontrada) {
              // Determinar qué receta usar según el tamaño
              const recetaBase = isMediana 
                ? (pizzaBaseEncontrada.recetaMediana || pizzaBaseEncontrada.receta)
                : pizzaBaseEncontrada.receta;
              
              if (recetaBase && Array.isArray(recetaBase)) {
                logger.info(`   📋 Procesando receta base (${recetaBase.length} ingredientes)`);
                
                // Procesar cada ingrediente de la receta base
                recetaBase.forEach((ing: any) => {
                  const nombreIngrediente = (ing.nombre || "").toLowerCase();
                  const cantidadPorPizza = parseFloat(ing.cantidad || 0);
                  
                  if (nombreIngrediente && cantidadPorPizza > 0) {
                    consumption[nombreIngrediente] =
                      (consumption[nombreIngrediente] || 0) + (cantidadPorPizza * cantidad);
                    
                    logger.info(`      [Base] ${nombreIngrediente}: +${cantidadPorPizza * cantidad}${ing.unidad || "gr"}`);
                  }
                });
              } else {
                logger.warn(`   ⚠️ Pizza base "${selectedMenuPizza}" no tiene receta definida`);
              }
            } else {
              logger.warn(`   ⚠️ No se encontró la pizza base "${selectedMenuPizza}" en items_menu`);
            }
          } else {
            logger.info(`   ℹ️ Sin pizza base seleccionada (base estándar: masa + salsa + queso + orégano)`);
          }
          
          // Verificar que tenga ingredientes extras/adicionales
          const hasIngredients = 
            (item.ingredients && item.ingredients.length > 0) ||
            (item.premiumIngredients && item.premiumIngredients.length > 0) ||
            (item.extras && item.extras.length > 0) ||
            (item.sauces && item.sauces.length > 0) ||
            (item.drinks && item.drinks.length > 0);
          
          if (hasIngredients) {
            logger.info(`   📊 Consumption ANTES de procesar extras:`, consumption);
            
            // Procesar ingredientes EXTRAS adicionales con cantidades estándar
            await processExtrasForItem(item, ingredientesMap, consumption, cantidad, agregadosConfig);
            
            logger.info(`   📊 Consumption DESPUÉS de procesar extras:`, consumption);
          } else {
            logger.info(`   ℹ️ Sin ingredientes extras adicionales`);
          }
          
          logger.info(`✅ Pizza ${item.pizzaType} procesada completa (base + extras)`);
          continue; // Saltar a siguiente item
        }
        
        // Buscar la pizza en items_menu (para pizzas del menú tradicional)
        let pizzaEncontrada = null;
        for (const [nombrePizza, pizza] of Object.entries(pizzasConReceta)) {
          if (itemNombre.includes(nombrePizza)) {
            pizzaEncontrada = pizza;
            break;
          }
        }

        const isGauchitosOrderItem =
          isGauchitosLikeItem(itemNombreOriginal) ||
          isGauchitosLikeItem(String((pizzaEncontrada as any)?.nombre || ""));

        const isRollitosOrderItem =
          isRollitosLikeItem(itemNombreOriginal) ||
          isRollitosLikeItem(String((pizzaEncontrada as any)?.nombre || ""));

        if (isRollitosOrderItem) {
          rollitosPacksToConsume += cantidad;
          logger.info(`Skipping ingredient consumption for ${itemNombreOriginal} and accounting ${cantidad} rollitos pack(s) (matched by menu/name)`);
          continue;
        }

        if (isGauchitosOrderItem) {
          logger.info(`Skipping inventory consumption for ${itemNombreOriginal} by config (matched by menu/name)`);
          gauchitosUnitsProcessed += cantidad;
          continue;
        }

        if (pizzaEncontrada) {
          logger.info(`Found pizza: ${pizzaEncontrada.nombre}`);
          
          // Determinar qué receta usar según el tamaño
          const recetaArray = size.includes("mediana") 
            ? pizzaEncontrada.recetaMediana 
            : pizzaEncontrada.receta;

          if (recetaArray && Array.isArray(recetaArray) && recetaArray.length > 0) {
            // Sumar las cantidades de cada ingrediente DE LA RECETA BASE
            recetaArray.forEach((ing: any) => {
              const nombreIngrediente = normalizeText(ing.nombre || "");
              const cantidadPorPizza = parseFloat(ing.cantidad || 0);
              
              if (nombreIngrediente && cantidadPorPizza > 0) {
                consumption[nombreIngrediente] =
                  (consumption[nombreIngrediente] || 0) + (cantidadPorPizza * cantidad);
                
                logger.info(`  [RECETA] ${nombreIngrediente}: +${cantidadPorPizza * cantidad}${ing.unidad || "gr"} (${cantidadPorPizza}${ing.unidad || "gr"} x ${cantidad} pizzas)`);
              }
            });
            
            // ✅ AHORA PROCESAR EXTRAS ADICIONALES (SI EXISTEN)
            await processExtrasForItem(item, ingredientesMap, consumption, cantidad, agregadosConfig);
            
          } else {
            // ❌ RECETA NO DEFINIDA - ERROR CRÍTICO
            logger.error(`❌ CRITICAL: Pizza ${pizzaEncontrada.nombre} no tiene receta definida para tamaño ${size}`);
            throw new Error(`La pizza "${pizzaEncontrada.nombre}" no tiene receta definida para tamaño ${size}. No se puede procesar el pedido.`);
          }
        } else {
          // ❌ PIZZA NO ENCONTRADA
          logger.error(`❌ CRITICAL: Pizza no encontrada en menú: ${itemNombre}`);
          
          // Solo permitir fallback si tiene ingredientes explícitos (pizza personalizada)
          const hasExplicitIngredients = 
            (item.ingredients && item.ingredients.length > 0) ||
            (item.premiumIngredients && item.premiumIngredients.length > 0);
          
          if (hasExplicitIngredients) {
            logger.warn(`Using fallback for custom pizza: ${itemNombre}`);
            useFallbackConsumption(item, cantidad, consumption);
          } else {
            // Pizza del menú sin receta - ERROR CRÍTICO
            throw new Error(`La pizza "${item.nombre}" no tiene receta definida. No se puede procesar el pedido.`);
          }
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

      // ⚠️ VALIDACIÓN CRÍTICA: Verificar que se calculó algún consumo
      const totalItemsConsumed = Object.keys(consumption).length;
      const hasRollitosConsumption = rollitosPacksToConsume > 0;
      const hasGauchitosProcessed = gauchitosUnitsProcessed > 0;
      const hasStandaloneSaucesProcessed = standaloneSaucesProcessed > 0;
      if (
        totalItemsConsumed === 0 &&
        !hasRollitosConsumption &&
        !hasGauchitosProcessed &&
        !hasStandaloneSaucesProcessed
      ) {
        logger.error("❌ CRITICAL: No se calculó consumo para ningún ingrediente");
        logger.error("Items recibidos:", JSON.stringify(items, null, 2));
        throw new Error("No se pudo calcular el consumo de inventario. Verifica que las pizzas tengan recetas definidas.");
      }

      if (totalItemsConsumed > 0) {
        logger.info(`✅ Se calculó consumo para ${totalItemsConsumed} ingrediente(s)`);
      } else if (hasRollitosConsumption) {
        logger.info(`✅ Pedido sin ingredientes tradicionales; consumo válido de Rollitos packs: ${rollitosPacksToConsume}`);
      } else if (hasStandaloneSaucesProcessed) {
        logger.info(`✅ Pedido sin ingredientes tradicionales; consumo válido de salsas procesadas: ${standaloneSaucesProcessed}`);
      } else {
        logger.info(`✅ Pedido sin ingredientes tradicionales; consumo válido de Gauchitos procesados: ${gauchitosUnitsProcessed}`);
      }

      const transactionItems: any[] = [];

      // 4.1 Consumir stock de Rollitos (packs) en la misma transacción
      if (rollitosPacksToConsume > 0) {
        if (agregadosConfig.rollitosPackStock < rollitosPacksToConsume) {
          throw new Error(
            `Stock insuficiente de Rollitos de Canela: requerido ${rollitosPacksToConsume}, disponible ${agregadosConfig.rollitosPackStock}`
          );
        }

        const agregadosRef = db.collection("settings").doc("agregados_config");
        const newRollitosStock = agregadosConfig.rollitosPackStock - rollitosPacksToConsume;
        t.set(
          agregadosRef,
          {
            rollitosPackStock: newRollitosStock,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          {merge: true}
        );

        logger.info(
          `✅ Rollitos packs updated: ${agregadosConfig.rollitosPackStock} -> ${newRollitosStock} (-${rollitosPacksToConsume})`
        );

        transactionItems.push({
          ingredienteId: "agregados_config.rollitosPackStock",
          nombre: "Rollitos de Canela (packs)",
          cantidadConsumida: rollitosPacksToConsume,
          unidad: "pack",
          stockAnterior: agregadosConfig.rollitosPackStock,
          stockNuevo: newRollitosStock,
        });
      }

      // 4.2 Actualizar stocks de ingredientes en la transacción
      Object.entries(consumption).forEach(([ingredientName, quantity]) => {
        const invItem = inventory[ingredientName];
        if (invItem) {
          const newStock = invItem.stockActual - quantity;
          logger.info(`Updating ${ingredientName}: ${invItem.stockActual}gr -> ${newStock}gr (-${quantity}gr)`);
          
          t.update(invItem.ref, {
            stockActual: newStock,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          
          // Agregar a la lista de items para el registro de transacción
          transactionItems.push({
            ingredienteId: ingredientesMap[ingredientName]?.id || ingredientName,
            nombre: ingredientesMap[ingredientName]?.nombre || ingredientName,
            cantidadConsumida: quantity,
            unidad: ingredientesMap[ingredientName]?.unidad || 'g',
            stockAnterior: invItem.stockActual,
            stockNuevo: newStock
          });
        } else {
          logger.warn(`Ingredient not found in inventory: ${ingredientName}`);
        }
      });

      // 5. Crear registro de transacción de inventario
      const transactionRef = db.collection('inventory_transactions').doc();
      t.set(transactionRef, {
        orderId: orderId || 'unknown',
        orderNumber: orderNumber || 0,
        status: 'success',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        items: transactionItems,
        totalIngredientes: transactionItems.length,
        tipo: 'consumo'
      });
      
      logger.info(`✅ Registro de transacción creado: Pedido #${orderNumber || 'N/A'} con ${transactionItems.length} ingrediente(s)`);
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

/**
 * Restaurar inventario para pedido reembolsado
 * (Solo si inventoryProcessed)
 */
export async function restoreInventoryForOrder(items: any[]) {
  const db = admin.firestore();
  logger.info("🔄 Restaurando inventario para pedido reembolsado...");

  // 1. Obtener todos los ingredientes
  const inventorySnapshot = await db.collection("ingredientes").get();
  const inventory: Record<string, any> = {};
  inventorySnapshot.forEach((doc) => {
    const data = doc.data();
    inventory[data.nombre.toLowerCase()] = {
      ref: doc.ref,
      stockActual: data.stockActual || 0,
    };
  });

  // 2. Obtener todas las pizzas con sus recetas desde items_menu
  const itemsMenuSnapshot = await db.collection("items_menu").get();
  const pizzasConReceta: Record<string, any> = {};
  itemsMenuSnapshot.forEach((doc) => {
    const data = doc.data();
    const nombrePizza = (data.nombre || "").toLowerCase();
    pizzasConReceta[nombrePizza] = {
      nombre: data.nombre,
      receta: data.receta || [],
      recetaMediana: data.recetaMediana || data.receta || [],
    };
  });

  logger.info(`Loaded ${itemsMenuSnapshot.size} pizzas from items_menu for restoration`);

  // 3. Calcular restauración necesaria por ingrediente
  const restoration: Record<string, number> = {};
  let rollitosPacksToRestore = 0;

  for (const item of items) {
    // Limpiar el nombre quitando el tamaño entre paréntesis si existe
    let itemNombre = (item.nombre || "").toLowerCase();
    itemNombre = itemNombre.replace(/\s*\([^)]*\)\s*$/g, '').trim();
    
    const cantidad = item.cantidad || 1;
    const size = (item.size || "Familiar").toLowerCase();

    if (isRollitosLikeItem(item.nombre || "")) {
      rollitosPacksToRestore += cantidad;
      logger.info(`Skipping ingredient restoration for ${item.nombre} and restoring ${cantidad} rollitos pack(s)`);
      continue;
    }

    logger.info(`Restoring item: ${item.nombre} -> cleaned: "${itemNombre}", size: ${size}, cantidad: ${cantidad}`);

    // Verificar si es pizza DÚO
    const isDuoPizza = item.pizzaType === "duo" && item.pizza1 && item.pizza2;

    if (isDuoPizza) {
      logger.info(`🍕 PIZZA DÚO DETECTADA para restaurar: ${item.pizza1} / ${item.pizza2}`);

      const pizza1Name = (item.pizza1 || "").toLowerCase().trim();
      const pizza2Name = (item.pizza2 || "").toLowerCase().trim();

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
        logger.info(`✅ Ambas pizzas encontradas para restaurar: ${pizza1Encontrada.nombre} + ${pizza2Encontrada.nombre}`);

        const receta1 = size.includes("mediana") ? pizza1Encontrada.recetaMediana : pizza1Encontrada.receta;
        const receta2 = size.includes("mediana") ? pizza2Encontrada.recetaMediana : pizza2Encontrada.receta;

        // Restaurar ingredientes de pizza 1 al 50%
        if (receta1 && Array.isArray(receta1)) {
          receta1.forEach((ing: any) => {
            const nombreIngrediente = (ing.nombre || "").toLowerCase();
            const cantidadPorPizza = parseFloat(ing.cantidad || 0) * 0.5;
            if (nombreIngrediente && cantidadPorPizza > 0) {
              restoration[nombreIngrediente] =
                (restoration[nombreIngrediente] || 0) + cantidadPorPizza * cantidad;
              logger.info(`  [50% ${pizza1Encontrada.nombre}] ${nombreIngrediente}: +${cantidadPorPizza * cantidad}${ing.unidad || "gr"}`);
            }
          });
        }

        // Restaurar ingredientes de pizza 2 al 50%
        if (receta2 && Array.isArray(receta2)) {
          receta2.forEach((ing: any) => {
            const nombreIngrediente = (ing.nombre || "").toLowerCase();
            const cantidadPorPizza = parseFloat(ing.cantidad || 0) * 0.5;
            if (nombreIngrediente && cantidadPorPizza > 0) {
              restoration[nombreIngrediente] =
                (restoration[nombreIngrediente] || 0) + cantidadPorPizza * cantidad;
              logger.info(`  [50% ${pizza2Encontrada.nombre}] ${nombreIngrediente}: +${cantidadPorPizza * cantidad}${ing.unidad || "gr"}`);
            }
          });
        }

        logger.info(`✅ Pizza Dúo restaurada correctamente`);
        continue;
      } else {
        logger.error(`❌ No se encontraron las pizzas para restaurar el Dúo: ${pizza1Name} / ${pizza2Name}`);
      }
    }

    // Lógica normal para pizzas no-DUO
    let pizzaEncontrada = null;
    for (const [nombrePizza, pizza] of Object.entries(pizzasConReceta)) {
      if (itemNombre.includes(nombrePizza)) {
        pizzaEncontrada = pizza;
        break;
      }
    }

    if (pizzaEncontrada) {
      const isRollitosOrderItem =
        isRollitosLikeItem(item.nombre || "") ||
        isRollitosLikeItem(String((pizzaEncontrada as any)?.nombre || ""));

      if (isRollitosOrderItem) {
        rollitosPacksToRestore += cantidad;
        logger.info(`Skipping ingredient restoration for ${item.nombre} and restoring ${cantidad} rollitos pack(s) (matched by menu/name)`);
        continue;
      }

      logger.info(`Found pizza for restoration: ${pizzaEncontrada.nombre}`);

      const recetaArray = size.includes("mediana") ? pizzaEncontrada.recetaMediana : pizzaEncontrada.receta;

      if (recetaArray && Array.isArray(recetaArray) && recetaArray.length > 0) {
        recetaArray.forEach((ing: any) => {
          const nombreIngrediente = (ing.nombre || "").toLowerCase();
          const cantidadPorPizza = parseFloat(ing.cantidad || 0);

          if (nombreIngrediente && cantidadPorPizza > 0) {
            restoration[nombreIngrediente] =
              (restoration[nombreIngrediente] || 0) + cantidadPorPizza * cantidad;
            logger.info(`  ${nombreIngrediente}: +${cantidadPorPizza * cantidad}${ing.unidad || "gr"}`);
          }
        });
      } else {
        logger.warn(`Pizza ${pizzaEncontrada.nombre} no tiene receta, usando fallback`);
        useFallbackRestoration(item, cantidad, restoration);
      }
    } else {
      logger.warn(`Pizza no encontrada en menú para restaurar: ${itemNombre}, usando fallback`);
      useFallbackRestoration(item, cantidad, restoration);
    }
  }

  function useFallbackRestoration(item: any, cantidad: number, restoration: Record<string, number>) {
    [
      ...(item.ingredients || []),
      ...(item.premiumIngredients || []),
      ...(item.sauces || []),
      ...(item.drinks || []),
    ].forEach((ing: string) => {
      const cleanName = ing.replace(/\s*\(\+\$\d+\)/, "").toLowerCase();
      restoration[cleanName] = (restoration[cleanName] || 0) + cantidad;
    });
  }

  logger.info("Total restoration calculated:", restoration);

  // 4. Actualizar stocks en batch
  const batch = db.batch();
  for (const [ingredientName, quantity] of Object.entries(restoration)) {
    const invItem = inventory[ingredientName];
    if (invItem) {
      const newStock = invItem.stockActual + quantity;
      logger.info(`Restoring ${ingredientName}: ${invItem.stockActual}gr -> ${newStock}gr (+${quantity}gr)`);
      batch.update(invItem.ref, {
        stockActual: newStock,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      logger.warn(`Ingredient not found in inventory: ${ingredientName}`);
    }
  }

  if (rollitosPacksToRestore > 0) {
    const agregadosRef = db.collection("settings").doc("agregados_config");
    batch.set(
      agregadosRef,
      {
        rollitosPackStock: admin.firestore.FieldValue.increment(rollitosPacksToRestore),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {merge: true}
    );
    logger.info(`✅ Restoring rollitos packs: +${rollitosPacksToRestore}`);
  }

  await batch.commit();
  logger.info("✅ Inventario restaurado exitosamente");
  return {success: true};
}

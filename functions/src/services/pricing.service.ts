/**
 * Servicio de Validación y Cálculo de Precios
 * Calcula precios desde el servidor para evitar manipulación
 */

import * as admin from "firebase-admin";
import {OrderItem} from "../types/orders";

interface PriceConfig {
  pizzaSizes: {
    mediana: {
      simpleBasePrice: number;
      premiumBasePrice: number;
      simpleExtraPrice: number;
      premiumExtraPrice: number;
    };
    familiar: {
      simpleBasePrice: number;
      premiumBasePrice: number;
      simpleExtraPrice: number;
      premiumExtraPrice: number;
    };
  };
  extras: Record<string, number>;
}

interface MenuPizzaPrice {
  familiar: number;
  mediana: number;
  fetchedAt: number;
}

interface DeliveryZoneDoc {
  tarifa: number;
  polygon: Array<[number, number]>;
}

// Cache de configuración de precios (se actualiza desde Firebase)
let CACHED_PRICE_CONFIG: PriceConfig | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 15 * 60 * 1000; // 15 minutos

const MENU_PRICE_CACHE_TTL = 15 * 60 * 1000;
const DELIVERY_ZONES_CACHE_TTL = 5 * 60 * 1000;

const MENU_PRICE_CACHE = new Map<string, MenuPizzaPrice>();
let CACHED_DELIVERY_ZONES: DeliveryZoneDoc[] | null = null;
let lastDeliveryZonesFetchTime = 0;

/**
 * Obtener configuración de precios desde Firebase
 * Con cache de 15 minutos para evitar lecturas excesivas
 */
async function getPriceConfig(): Promise<PriceConfig> {
  const now = Date.now();
  
  // Si tenemos cache válido, usarlo
  if (CACHED_PRICE_CONFIG && (now - lastFetchTime) < CACHE_TTL) {
    return CACHED_PRICE_CONFIG;
  }

  try {
    const db = admin.firestore();
    const docRef = db.collection("settings").doc("precios_configuracion");
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      const data = docSnap.data() as any;
      
      CACHED_PRICE_CONFIG = {
        pizzaSizes: {
          mediana: data.pizzaSizes.mediana,
          familiar: data.pizzaSizes.familiar,
        },
        extras: data.extras || {},
      };
      
      lastFetchTime = now;
      console.log("✅ Precios cargados desde Firebase:", CACHED_PRICE_CONFIG);
      return CACHED_PRICE_CONFIG;
    }
  } catch (error) {
    console.error("❌ Error cargando precios desde Firebase:", error);
  }

  // Fallback a valores por defecto si falla la carga
  console.warn("⚠️ Usando precios por defecto (fallback)");
  const fallbackConfig: PriceConfig = {
    pizzaSizes: {
      mediana: {
        simpleBasePrice: 8000,
        premiumBasePrice: 8000,
        simpleExtraPrice: 700,
        premiumExtraPrice: 2500,
      },
      familiar: {
        simpleBasePrice: 10000,
        premiumBasePrice: 10000,
        simpleExtraPrice: 1000,
        premiumExtraPrice: 3500,
      },
    },
    extras: {
      ajo: 700,
      chimichurri: 700,
      pesto: 1000,
      "coca cola lata": 1500,
      "coca cola 1.5l": 2900,
      "rollitos de canela": 4900,
      gauchitos: 4000,
    },
  };

  CACHED_PRICE_CONFIG = fallbackConfig;
  lastFetchTime = now;
  return fallbackConfig;
}

/**
 * Calcular precio de un ítem del pedido
 */
async function calculateItemPrice(item: OrderItem): Promise<number> {
  const PRICE_CONFIG = await getPriceConfig();
  let totalPrice = 0;

  // Si el item ya tiene precio y no es una pizza personalizable, usar ese precio
  if (
    item.precio &&
    !item.pizzaType &&
    !item.ingredients &&
    !item.premiumIngredients
  ) {
    return item.precio * item.cantidad;
  }

  // Calcular precio de pizzas personalizables
  if (item.pizzaType) {
    const size = (item.size || "familiar").toLowerCase();
    const sizeConfig =
      size === "mediana"
        ? PRICE_CONFIG.pizzaSizes.mediana
        : PRICE_CONFIG.pizzaSizes.familiar;

    if (item.pizzaType === "promo") {
      // Pizza Promo: base + extras simples después de los 2 primeros
      totalPrice = sizeConfig.simpleBasePrice;

      const simpleCount = item.ingredients?.length || 0;
      if (simpleCount > 2) {
        const extraSimple = simpleCount - 2;
        totalPrice += extraSimple * sizeConfig.simpleExtraPrice;
      }
    } else if (item.pizzaType === "premium") {
      // ⭐ NUEVO: Si hay pizza base seleccionada, usar su precio
      if (item.selectedMenuPizza && item.selectedMenuPizza !== "base") {
        try {
          const selectedPizzaPrice = await getMenuPizzaPriceByName(item.selectedMenuPizza);
          if (selectedPizzaPrice) {
            totalPrice = size === "mediana"
              ? selectedPizzaPrice.mediana
              : selectedPizzaPrice.familiar;
            console.log(`✅ Usando precio de pizza base "${item.selectedMenuPizza}": $${totalPrice}`);
          } else {
            console.warn(`⚠️ No se encontró la pizza "${item.selectedMenuPizza}", usando precio base genérico`);
            totalPrice = sizeConfig.premiumBasePrice;
          }
        } catch (error) {
          console.error(`❌ Error buscando pizza base "${item.selectedMenuPizza}":`, error);
          totalPrice = sizeConfig.premiumBasePrice;
        }
      } else {
        // Sin pizza base seleccionada, usar precio genérico
        totalPrice = sizeConfig.premiumBasePrice;
      }

      const simpleCount = item.ingredients?.length || 0;
      const premiumCount = item.premiumIngredients?.length || 0;

      totalPrice += simpleCount * sizeConfig.simpleExtraPrice;
      totalPrice += premiumCount * sizeConfig.premiumExtraPrice;
    } else if (item.pizzaType === "duo") {
      // Pizza Duo: precio del más caro de las dos pizzas
      // Por simplicidad, usar el precio base premium
      totalPrice = sizeConfig.premiumBasePrice;
    }

    // Agregar costo de extras (salsas, bebidas, etc)
    if (item.extras) {
      item.extras.forEach((extra) => {
        const extraName = extra.toLowerCase().replace(/\s*\(\+\$\d+\)/, "");
        const extraPrice = PRICE_CONFIG.extras[extraName] || 0;
        totalPrice += extraPrice;
      });
    }
  } else if (item.precio) {
    // Items del menú con precio fijo
    totalPrice = item.precio;
  }

  return totalPrice * item.cantidad;
}

/**
 * Calcular tarifa de delivery según zona
 */
async function calculateDeliveryFee(
  lat?: number,
  lng?: number
): Promise<number> {
  if (!lat || !lng) {
    return 0; // Sin coordenadas, sin delivery
  }

  try {
    const db = admin.firestore();
    const zones = await getActiveDeliveryZones(db);

    // Función para verificar si un punto está dentro de un polígono
    function pointInPolygon(
      point: [number, number],
      polygon: Array<[number, number]>
    ): boolean {
      let inside = false;
      for (
        let i = 0, j = polygon.length - 1;
        i < polygon.length;
        j = i++
      ) {
        const xi = polygon[i][0];
        const yi = polygon[i][1];
        const xj = polygon[j][0];
        const yj = polygon[j][1];

        const intersect =
          yi > point[1] !== yj > point[1] &&
          point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;
        if (intersect) inside = !inside;
      }
      return inside;
    }

    // Buscar la zona que contiene el punto
    for (const zone of zones) {
      if (zone.polygon.length >= 3) {
        const isInside = pointInPolygon([lat, lng], zone.polygon);
        if (isInside) {
          return zone.tarifa || 0;
        }
      }
    }

    // Si no está en ninguna zona, retornar 0 (sin servicio)
    return 0;
  } catch (error) {
    console.error("Error calculating delivery fee:", error);
    return 0;
  }
}

async function getMenuPizzaPriceByName(name: string): Promise<{ familiar: number; mediana: number } | null> {
  const normalizedName = String(name || "").trim();
  if (!normalizedName) return null;

  const cacheKey = normalizedName.toLowerCase();
  const cached = MENU_PRICE_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < MENU_PRICE_CACHE_TTL) {
    return { familiar: cached.familiar, mediana: cached.mediana };
  }

  try {
    const db = admin.firestore();
    const snapshot = await db
      .collection("items_menu")
      .where("nombre", "==", normalizedName)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const data = snapshot.docs[0].data() as any;
    const familiar = Number(data?.precio ?? 0);
    const mediana = Number(data?.precioMediana ?? data?.precio ?? 0);

    if (familiar <= 0 && mediana <= 0) {
      return null;
    }

    MENU_PRICE_CACHE.set(cacheKey, {
      familiar,
      mediana,
      fetchedAt: Date.now(),
    });

    return { familiar, mediana };
  } catch (error) {
    console.error("❌ Error obteniendo precio de pizza base:", error);
    return null;
  }
}

function parsePolygon(raw: any): Array<[number, number]> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((point: any) => {
      if (Array.isArray(point) && point.length >= 2) {
        return [Number(point[0]), Number(point[1])] as [number, number];
      }
      if (point && typeof point === "object" && typeof point.lat === "number" && typeof point.lng === "number") {
        return [point.lat, point.lng] as [number, number];
      }
      return null;
    })
    .filter((point): point is [number, number] => Array.isArray(point));
}

async function getActiveDeliveryZones(db: FirebaseFirestore.Firestore): Promise<DeliveryZoneDoc[]> {
  const now = Date.now();
  if (CACHED_DELIVERY_ZONES && now - lastDeliveryZonesFetchTime < DELIVERY_ZONES_CACHE_TTL) {
    return CACHED_DELIVERY_ZONES;
  }

  const zonesSnapshot = await db
    .collection("delivery-zones")
    .where("disponible", "==", true)
    .get();

  const zones = zonesSnapshot.docs.map((docSnap) => {
    const data = docSnap.data() as any;
    const polygon = parsePolygon(data.poligono ?? data.coordenadas);
    return {
      tarifa: Number(data.tarifa ?? 0),
      polygon,
    } as DeliveryZoneDoc;
  }).filter((zone) => zone.polygon.length >= 3);

  CACHED_DELIVERY_ZONES = zones;
  lastDeliveryZonesFetchTime = now;
  return zones;
}

/**
 * Calcular precio total del pedido con validación
 */
export async function calculateOrderTotal(
  items: OrderItem[],
  tipoEntrega: "Delivery" | "Retiro",
  direccion?: {lat?: number; lng?: number}
): Promise<{
  subtotal: number;
  deliveryFee: number;
  total: number;
  breakdown: Array<{
    nombre: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
  }>;
}> {
  // Calcular subtotal de items
  let subtotal = 0;
  const breakdown: Array<{
    nombre: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
  }> = [];

  for (const item of items) {
    const itemTotal = await calculateItemPrice(item);
    const precioUnitario = itemTotal / item.cantidad;

    subtotal += itemTotal;

    breakdown.push({
      nombre: item.nombre,
      cantidad: item.cantidad,
      precioUnitario: Math.round(precioUnitario),
      subtotal: Math.round(itemTotal),
    });
  }

  // Calcular tarifa de delivery
  let deliveryFee = 0;
  if (tipoEntrega === "Delivery" && direccion) {
    deliveryFee = await calculateDeliveryFee(direccion.lat, direccion.lng);
  }

  const total = subtotal + deliveryFee;

  return {
    subtotal: Math.round(subtotal),
    deliveryFee: Math.round(deliveryFee),
    total: Math.round(total),
    breakdown,
  };
}

/**
 * Validar que el precio enviado por el cliente coincida con el calculado
 */
export async function validateOrderPrice(
  items: OrderItem[],
  clientTotal: number,
  tipoEntrega: "Delivery" | "Retiro",
  direccion?: {lat?: number; lng?: number}
): Promise<{valid: boolean; serverTotal: number; clientTotal: number; difference: number}> {
  const calculation = await calculateOrderTotal(items, tipoEntrega, direccion);

  const difference = Math.abs(calculation.total - clientTotal);

  // Permitir diferencia de máximo $100 (por redondeos)
  const valid = difference <= 100;

  return {
    valid,
    serverTotal: calculation.total,
    clientTotal,
    difference,
  };
}

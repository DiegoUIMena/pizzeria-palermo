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

interface DuoHalfPriceInput {
  baseType: "menu" | "custom";
  variety?: string | null;
  simpleIngredients?: string[];
  premiumIngredients?: string[];
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

interface IngredientPriceInfo {
  nombre: string;
  tipo?: string;
  clase?: string;
  esPrecioEspecial?: boolean;
  precioPorcionFamiliar?: number;
  precioPorcionMediana?: number;
}

let CACHED_INGREDIENTS_MAP: Map<string, IngredientPriceInfo> | null = null;
let lastIngredientsFetchTime = 0;
const INGREDIENTS_CACHE_TTL = 15 * 60 * 1000;

function normalizeIngredientName(text: string): string {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s*\(\+\$\d+(\.\d+)?\)/, "")
    .trim();
}

async function getIngredientsPriceMap(): Promise<Map<string, IngredientPriceInfo>> {
  const now = Date.now();
  if (CACHED_INGREDIENTS_MAP && (now - lastIngredientsFetchTime) < INGREDIENTS_CACHE_TTL) {
    return CACHED_INGREDIENTS_MAP;
  }

  const map = new Map<string, IngredientPriceInfo>();
  try {
    const db = admin.firestore();
    const snap = await db.collection("ingredientes").get();
    snap.docs.forEach((doc) => {
      const data = doc.data() as any;
      if (data.nombre) {
        const norm = normalizeIngredientName(data.nombre);
        map.set(norm, {
          nombre: data.nombre,
          tipo: data.tipo || data.clase,
          clase: data.clase || data.tipo,
          esPrecioEspecial: Boolean(data.esPrecioEspecial),
          precioPorcionFamiliar: Number(data.precioPorcionFamiliar) || 0,
          precioPorcionMediana: Number(data.precioPorcionMediana) || 0,
        });
      }
    });
    CACHED_INGREDIENTS_MAP = map;
    lastIngredientsFetchTime = now;
  } catch (error) {
    console.error("❌ Error cargando mapa de ingredientes en pricing:", error);
  }

  return map;
}

function getIngredientUnitPrice(
  ingName: string,
  size: string,
  isPremiumDefault: boolean,
  sizeConfig: { simpleExtraPrice: number; premiumExtraPrice: number },
  ingMap: Map<string, IngredientPriceInfo>
): number {
  const norm = normalizeIngredientName(ingName);
  const info = ingMap.get(norm);

  if (info && info.esPrecioEspecial) {
    const specialPrice = size === "mediana"
      ? (info.precioPorcionMediana || info.precioPorcionFamiliar)
      : info.precioPorcionFamiliar;
    if (specialPrice && specialPrice > 0) {
      return specialPrice;
    }
  }

  const isPrem = info ? (info.tipo === "premium" || info.clase === "premium") : isPremiumDefault;
  return isPrem ? sizeConfig.premiumExtraPrice : sizeConfig.simpleExtraPrice;
}

/**
 * Calcular precio de un ítem del pedido
 */
async function calculateItemPrice(item: OrderItem): Promise<number> {
  // Si es un producto de canje de Puntos Palermo, su precio comercial es $0
  if (item.isCanje) {
    return 0;
  }

  const PRICE_CONFIG = await getPriceConfig();
  const ingMap = await getIngredientsPriceMap();
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
        const extraSimples = (item.ingredients || []).slice(2);
        extraSimples.forEach((ing) => {
          totalPrice += getIngredientUnitPrice(ing, size, false, sizeConfig, ingMap);
        });
      }
    } else if (item.pizzaType === "premium" || item.pizzaType === "custom" || item.pizzaType === "normal") {
      if (item.pizzaType === "custom") {
        totalPrice = sizeConfig.simpleBasePrice;
      } else if (item.selectedMenuPizza && item.selectedMenuPizza !== "base") {
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
        totalPrice = sizeConfig.premiumBasePrice;
      }

      (item.ingredients || []).forEach((ing) => {
        totalPrice += getIngredientUnitPrice(ing, size, false, sizeConfig, ingMap);
      });
      (item.premiumIngredients || []).forEach((ing) => {
        totalPrice += getIngredientUnitPrice(ing, size, true, sizeConfig, ingMap);
      });
    } else if (item.pizzaType === "duo") {
      const calculateDuoHalfPrice = async (half?: DuoHalfPriceInput | null): Promise<number> => {
        if (!half) {
          return 0;
        }

        let halfTotal = 0;

        if (half.baseType === "custom") {
          halfTotal = sizeConfig.simpleBasePrice;
        } else if (half.variety) {
          try {
            const menuPizzaPrice = await getMenuPizzaPriceByName(half.variety);
            if (menuPizzaPrice) {
              halfTotal = size === "mediana"
                ? menuPizzaPrice.mediana
                : menuPizzaPrice.familiar;
            } else {
              console.warn(`⚠️ No se encontró la pizza de menú "${half.variety}" para DUO, usando base premium`);
              halfTotal = sizeConfig.premiumBasePrice;
            }
          } catch (error) {
            console.error(`❌ Error calculando mitad DUO "${half.variety}":`, error);
            halfTotal = sizeConfig.premiumBasePrice;
          }
        } else {
          halfTotal = sizeConfig.premiumBasePrice;
        }

        (half.simpleIngredients || []).forEach((ing) => {
          halfTotal += getIngredientUnitPrice(ing, size, false, sizeConfig, ingMap);
        });
        (half.premiumIngredients || []).forEach((ing) => {
          halfTotal += getIngredientUnitPrice(ing, size, true, sizeConfig, ingMap);
        });

        return halfTotal;
      };

      const half1Price = await calculateDuoHalfPrice(item.half1 as DuoHalfPriceInput | undefined);
      const half2Price = await calculateDuoHalfPrice(item.half2 as DuoHalfPriceInput | undefined);
      totalPrice = Math.max(half1Price, half2Price);

      // Sumar ingredientes extras seleccionados para TODA la pizza (simples y premium)
      const h1Simple = item.half1?.simpleIngredients || [];
      const h1Premium = item.half1?.premiumIngredients || [];
      const h2Simple = item.half2?.simpleIngredients || [];
      const h2Premium = item.half2?.premiumIngredients || [];

      const duoExtraSimple = Array.isArray(item.extraSimple)
        ? item.extraSimple
        : (Array.isArray(item.ingredients)
            ? item.ingredients.filter((x: string) => !h1Simple.includes(x) && !h2Simple.includes(x))
            : []);
      const duoExtraPremium = Array.isArray(item.extraPremium)
        ? item.extraPremium
        : (Array.isArray(item.premiumIngredients)
            ? item.premiumIngredients.filter((x: string) => !h1Premium.includes(x) && !h2Premium.includes(x))
            : []);

      duoExtraSimple.forEach((ing) => {
        totalPrice += getIngredientUnitPrice(ing, size, false, sizeConfig, ingMap);
      });
      duoExtraPremium.forEach((ing) => {
        totalPrice += getIngredientUnitPrice(ing, size, true, sizeConfig, ingMap);
      });

      if (!item.half1 || !item.half2) {
        console.warn("⚠️ DUO recibido sin detalle de mitades completo, usando el precio calculado con lo disponible");
      }

      if (totalPrice <= 0) {
        totalPrice = sizeConfig.premiumBasePrice;
      }
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

function normalizeMenuName(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

async function getMenuPizzaPriceByName(name: string): Promise<{ familiar: number; mediana: number } | null> {
  const rawName = String(name || "").trim();
  if (!rawName) return null;

  const cacheKey = normalizeMenuName(rawName);
  const cached = MENU_PRICE_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < MENU_PRICE_CACHE_TTL) {
    return { familiar: cached.familiar, mediana: cached.mediana };
  }

  try {
    const db = admin.firestore();
    const snapshot = await db
      .collection("items_menu")
      .where("nombre", "==", rawName)
      .limit(1)
      .get();

    let data: any = null;

    if (!snapshot.empty) {
      data = snapshot.docs[0].data();
    } else {
      const allSnapshot = await db.collection("items_menu").get();
      const match = allSnapshot.docs.find((doc) => {
        const docName = normalizeMenuName(String(doc.data()?.nombre || ""));
        return docName === cacheKey;
      });
      data = match ? match.data() : null;
    }

    if (!data) {
      return null;
    }
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

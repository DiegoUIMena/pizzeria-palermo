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

// Configuración de precios (fuente de verdad)
const PRICE_CONFIG: PriceConfig = {
  pizzaSizes: {
    mediana: {
      simpleBasePrice: 8000,
      premiumBasePrice: 9000,
      simpleExtraPrice: 1000,
      premiumExtraPrice: 1500,
    },
    familiar: {
      simpleBasePrice: 10000,
      premiumBasePrice: 13000,
      simpleExtraPrice: 1500,
      premiumExtraPrice: 2000,
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

/**
 * Calcular precio de un ítem del pedido
 */
function calculateItemPrice(item: OrderItem): number {
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
      // Pizza Premium: base premium + extras
      totalPrice = sizeConfig.premiumBasePrice;

      const simpleCount = item.ingredients?.length || 0;
      const premiumCount = item.premiumIngredients?.length || 0;

      totalPrice += simpleCount * sizeConfig.simpleExtraPrice;

      if (premiumCount > 1) {
        const extraPremium = premiumCount - 1;
        totalPrice += extraPremium * sizeConfig.premiumExtraPrice;
      }
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

    // Obtener zonas de delivery
    const zonesSnapshot = await db
      .collection("delivery-zones")
      .where("activa", "==", true)
      .get();

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
    for (const doc of zonesSnapshot.docs) {
      const zone = doc.data();
      if (zone.coordenadas && Array.isArray(zone.coordenadas)) {
        const isInside = pointInPolygon([lat, lng], zone.coordenadas);
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
    const itemTotal = calculateItemPrice(item);
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

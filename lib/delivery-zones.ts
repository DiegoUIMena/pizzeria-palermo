// 1. Definición de zonas geográficas para Los Andes, Chile
export interface DeliveryZone {
  id: string
  nombre: string
  tarifa: number
  disponible: boolean
  tiempoEstimado: string
  poligono: [number, number][] // [lat, lng]
  color: string // Para visualización en el mapa
  descripcion?: string
}

// Zonas de delivery para Los Andes, Chile (coordenadas reales)
export const deliveryZones: DeliveryZone[] = [
  {
    id: "centro-los-andes",
    nombre: "Centro Los Andes",
    tarifa: 1500,
    disponible: true,
    tiempoEstimado: "15-25 min",
    color: "#10b981", // Verde
    descripcion: "Plaza de Armas, Esmeralda, O'Higgins",
    poligono: [
      [-32.83, -70.605], // Norte
      [-32.84, -70.605], // Sur
      [-32.84, -70.59], // Sureste
      [-32.83, -70.59], // Noreste
    ],
  },
  {
    id: "centenario",
    nombre: "Centenario",
    tarifa: 2000,
    disponible: true,
    tiempoEstimado: "20-30 min",
    color: "#3b82f6", // Azul
    descripcion: "Av. Argentina, Centenario, Santa Teresa",
    poligono: [
      [-32.825, -70.61], // Norte
      [-32.835, -70.61], // Sur
      [-32.835, -70.595], // Sureste
      [-32.825, -70.595], // Noreste
    ],
  },
  {
    id: "ambrosio-ohiggins",
    nombre: "Ambrosio O'Higgins",
    tarifa: 2200,
    disponible: true,
    tiempoEstimado: "25-35 min",
    color: "#8b5cf6", // Púrpura
    descripcion: "Av. Independencia, Ambrosio O'Higgins",
    poligono: [
      [-32.82, -70.615], // Norte
      [-32.83, -70.615], // Sur
      [-32.83, -70.6], // Sureste
      [-32.82, -70.6], // Noreste
    ],
  },
  {
    id: "santa-rosa",
    nombre: "Santa Rosa",
    tarifa: 2500,
    disponible: true,
    tiempoEstimado: "25-35 min",
    color: "#f59e0b", // Amarillo
    descripcion: "Santa Rosa, Av. Chile, Los Villares",
    poligono: [
      [-32.84, -70.61], // Norte
      [-32.85, -70.61], // Sur
      [-32.85, -70.595], // Sureste
      [-32.84, -70.595], // Noreste
    ],
  },
  {
    id: "coquimbito",
    nombre: "Coquimbito",
    tarifa: 2800,
    disponible: true,
    tiempoEstimado: "30-40 min",
    color: "#ef4444", // Rojo
    descripcion: "Coquimbito, Camino Internacional",
    poligono: [
      [-32.815, -70.62], // Norte
      [-32.825, -70.62], // Sur
      [-32.825, -70.605], // Sureste
      [-32.815, -70.605], // Noreste
    ],
  },
  {
    id: "tres-esquinas",
    nombre: "Tres Esquinas",
    tarifa: 3000,
    disponible: true,
    tiempoEstimado: "30-40 min",
    color: "#06b6d4", // Cian
    descripcion: "Tres Esquinas, Camino Internacional",
    poligono: [
      [-32.85, -70.615], // Norte
      [-32.86, -70.615], // Sur
      [-32.86, -70.6], // Sureste
      [-32.85, -70.6], // Noreste
    ],
  },
  {
    id: "san-esteban",
    nombre: "San Esteban",
    tarifa: 3500,
    disponible: true,
    tiempoEstimado: "35-45 min",
    color: "#8b5cf6", // Púrpura claro
    descripcion: "San Esteban, Los Acacios",
    poligono: [
      [-32.79, -70.63], // Norte
      [-32.81, -70.63], // Sur
      [-32.81, -70.61], // Sureste
      [-32.79, -70.61], // Noreste
    ],
  },
  {
    id: "rio-blanco",
    nombre: "Río Blanco",
    tarifa: 0,
    disponible: false,
    tiempoEstimado: "No disponible",
    color: "#6b7280", // Gris
    descripcion: "Zona fuera de cobertura",
    poligono: [
      [-32.75, -70.65], // Norte
      [-32.78, -70.65], // Sur
      [-32.78, -70.62], // Sureste
      [-32.75, -70.62], // Noreste
    ],
  },
]

// 2. Algoritmo de detección de zona (Point-in-Polygon)
export function isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [lat, lng] = point
  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [latI, lngI] = polygon[i]
    const [latJ, lngJ] = polygon[j]

    if (lngI > lng !== lngJ > lng && lat < ((latJ - latI) * (lng - lngI)) / (lngJ - lngI) + latI) {
      inside = !inside
    }
  }

  return inside
}

// 3. Función principal para detectar zona del cliente
export function detectarZonaCliente(
  lat: number,
  lng: number,
): {
  zona: DeliveryZone | null
  disponible: boolean
  tarifa: number
  mensaje: string
} {
  const punto: [number, number] = [lat, lng]

  console.log(`🔍 Verificando ubicación: ${lat}, ${lng}`)

  // Buscar en qué zona está el punto
  for (const zona of deliveryZones) {
    console.log(`📍 Verificando zona: ${zona.nombre}`)
    console.log(`🔢 Polígono:`, zona.poligono)

    if (isPointInPolygon(punto, zona.poligono)) {
      console.log(`✅ Punto encontrado en zona: ${zona.nombre}`)

      if (zona.disponible) {
        return {
          zona,
          disponible: true,
          tarifa: zona.tarifa,
          mensaje: `Delivery disponible en ${zona.nombre}. Costo: $${zona.tarifa.toLocaleString()}. Tiempo estimado: ${zona.tiempoEstimado}.`,
        }
      } else {
        return {
          zona,
          disponible: false,
          tarifa: 0,
          mensaje: `Lo sentimos, el servicio de delivery no está disponible en ${zona.nombre}.`,
        }
      }
    }
  }

  console.log(`❌ Punto no encontrado en ninguna zona`)

  // Si no está en ninguna zona definida
  return {
    zona: null,
    disponible: false,
    tarifa: 0,
    mensaje: "Lo sentimos, tu ubicación está fuera de nuestra zona de cobertura de delivery.",
  }
}

// Función para calcular distancia aproximada (opcional, para validación adicional)
export function calcularDistancia(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371 // Radio de la Tierra en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c // Distancia en km
}

// Coordenadas de la pizzería en Los Andes, Chile
export const PIZZERIA_LOCATION = {
  lat: -32.835,
  lng: -70.5983,
  nombre: "Pizzería Palermo - Los Andes",
}

// Función para validar distancia máxima (backup de seguridad)
export function validarDistanciaMaxima(lat: number, lng: number, maxDistanciaKm = 15): boolean {
  const distancia = calcularDistancia(PIZZERIA_LOCATION.lat, PIZZERIA_LOCATION.lng, lat, lng)
  console.log(`📏 Distancia calculada: ${distancia.toFixed(2)} km`)
  return distancia <= maxDistanciaKm
}

// Función auxiliar para verificar zona (para compatibilidad)
export function checkDeliveryZone(lat: number, lng: number) {
  const resultado = detectarZonaCliente(lat, lng)
  return {
    zone: resultado.zona,
    fee: resultado.tarifa,
    available: resultado.disponible,
    message: resultado.mensaje,
  }
}

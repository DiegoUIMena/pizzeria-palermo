// 1. Definición de zonas geográficas
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

// Zonas de delivery para Santiago (ejemplo con coordenadas reales)
export const deliveryZones: DeliveryZone[] = [
  {
    id: "centro",
    nombre: "Centro Histórico",
    tarifa: 1500,
    disponible: true,
    tiempoEstimado: "20-30 min",
    color: "#10b981", // Verde
    descripcion: "Plaza de Armas, Moneda, Universidad de Chile",
    poligono: [
      [-33.4372, -70.6506], // Plaza de Armas
      [-33.4419, -70.6506], // Sur del centro
      [-33.4419, -70.64], // Sureste
      [-33.435, -70.64], // Noreste
      [-33.435, -70.6506], // Noroeste
    ],
  },
  {
    id: "providencia",
    nombre: "Providencia",
    tarifa: 2000,
    disponible: true,
    tiempoEstimado: "25-35 min",
    color: "#3b82f6", // Azul
    descripcion: "Metro Manuel Montt, Los Leones, Tobalaba",
    poligono: [
      [-33.42, -70.62], // Norte
      [-33.435, -70.62], // Sur
      [-33.435, -70.59], // Sureste
      [-33.42, -70.59], // Noreste
    ],
  },
  {
    id: "las-condes",
    nombre: "Las Condes",
    tarifa: 2500,
    disponible: true,
    tiempoEstimado: "30-40 min",
    color: "#8b5cf6", // Púrpura
    descripcion: "Escuela Militar, Tobalaba, El Golf",
    poligono: [
      [-33.4, -70.58], // Norte
      [-33.42, -70.58], // Sur
      [-33.42, -70.54], // Sureste
      [-33.4, -70.54], // Noreste
    ],
  },
  {
    id: "nunoa",
    nombre: "Ñuñoa",
    tarifa: 2200,
    disponible: true,
    tiempoEstimado: "25-35 min",
    color: "#f59e0b", // Amarillo
    descripcion: "Plaza Ñuñoa, Irarrázaval, Grecia",
    poligono: [
      [-33.44, -70.6], // Norte
      [-33.46, -70.6], // Sur
      [-33.46, -70.57], // Sureste
      [-33.44, -70.57], // Noreste
    ],
  },
  {
    id: "san-miguel",
    nombre: "San Miguel",
    tarifa: 2800,
    disponible: true,
    tiempoEstimado: "35-45 min",
    color: "#ef4444", // Rojo
    descripcion: "Gran Avenida, Metro San Miguel",
    poligono: [
      [-33.48, -70.65], // Norte
      [-33.5, -70.65], // Sur
      [-33.5, -70.62], // Sureste
      [-33.48, -70.62], // Noreste
    ],
  },
  {
    id: "maipu",
    nombre: "Maipú",
    tarifa: 3500,
    disponible: true,
    tiempoEstimado: "40-50 min",
    color: "#06b6d4", // Cian
    descripcion: "Centro de Maipú, Metro Maipú",
    poligono: [
      [-33.48, -70.75], // Norte
      [-33.52, -70.75], // Sur
      [-33.52, -70.7], // Sureste
      [-33.48, -70.7], // Noreste
    ],
  },
  {
    id: "periferia-norte",
    nombre: "Periferia Norte",
    tarifa: 0,
    disponible: false,
    tiempoEstimado: "No disponible",
    color: "#6b7280", // Gris
    descripcion: "Zona fuera de cobertura",
    poligono: [
      [-33.35, -70.7], // Norte
      [-33.4, -70.7], // Sur
      [-33.4, -70.5], // Sureste
      [-33.35, -70.5], // Noreste
    ],
  },
  {
    id: "periferia-sur",
    nombre: "Periferia Sur",
    tarifa: 0,
    disponible: false,
    tiempoEstimado: "No disponible",
    color: "#6b7280", // Gris
    descripcion: "Zona fuera de cobertura",
    poligono: [
      [-33.55, -70.7], // Norte
      [-33.6, -70.7], // Sur
      [-33.6, -70.5], // Sureste
      [-33.55, -70.5], // Noreste
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

  // Buscar en qué zona está el punto
  for (const zona of deliveryZones) {
    if (isPointInPolygon(punto, zona.poligono)) {
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

// Coordenadas de la pizzería (ejemplo: centro de Santiago)
export const PIZZERIA_LOCATION = {
  lat: -33.4489,
  lng: -70.6693,
  nombre: "Pizzería Palermo - Local Principal",
}

// Función para validar distancia máxima (backup de seguridad)
export function validarDistanciaMaxima(lat: number, lng: number, maxDistanciaKm = 15): boolean {
  const distancia = calcularDistancia(PIZZERIA_LOCATION.lat, PIZZERIA_LOCATION.lng, lat, lng)
  return distancia <= maxDistanciaKm
}

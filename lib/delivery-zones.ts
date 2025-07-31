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

// 2. Algoritmo de detección de zona (Point-in-Polygon) - Ray Casting Algorithm
export function isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  // Algoritmo de punto en polígono mejorado
  if (polygon.length < 3) return false; // Un polígono necesita al menos 3 puntos
  
  const [lat, lng] = point;
  
  console.log(`🔎 Verificando punto [${lat.toFixed(6)}, ${lng.toFixed(6)}] en polígono`);
  
  // Convertir coordenadas para mejorar precisión
  // En coordenadas geográficas, 1 grado de latitud ≈ 111 km, 1 grado de longitud varía con la latitud
  // Normalizamos para trabajar con valores más consistentes
  const scaledPoint = [lat * 1000, lng * 1000]; // Multiplicamos por 1000 para trabajar con valores más grandes
  const scaledPolygon = polygon.map(p => [p[0] * 1000, p[1] * 1000]);
  
  let inside = false;
  
  // Implementación del algoritmo "ray casting" para determinar si un punto está dentro de un polígono
  for (let i = 0, j = scaledPolygon.length - 1; i < scaledPolygon.length; j = i++) {
    const [lat1, lng1] = scaledPolygon[i];
    const [lat2, lng2] = scaledPolygon[j];
    
    // Verificar si el rayo horizontal que parte del punto cruza este segmento
    const intersect = 
      ((lng1 > scaledPoint[1]) !== (lng2 > scaledPoint[1])) && // El segmento cruza la longitud del punto
      (scaledPoint[0] < (lat2 - lat1) * (scaledPoint[1] - lng1) / (lng2 - lng1) + lat1); // El punto está debajo del segmento
    
    if (intersect) {
      inside = !inside;
    }
  }
  
  // Verificar si el punto está cerca del borde (margen de tolerancia)
  if (!inside) {
    // Verificar si el punto está muy cerca de algún borde del polígono
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [lat1, lng1] = polygon[i];
      const [lat2, lng2] = polygon[j];
      
      // Calcular la distancia del punto al segmento (en grados)
      const distance = distanceToSegment(lat, lng, lat1, lng1, lat2, lng2);
      
      // Aproximadamente 100-200 metros en grados (depende de la latitud)
      // En la latitud de Los Andes, 0.001 grados ≈ 100 metros
      const TOLERANCE = 0.001;
      
      if (distance < TOLERANCE) {
        console.log(`🔍 Punto muy cercano al borde (${distance.toFixed(6)}), considerando DENTRO`);
        inside = true;
        break;
      }
    }
  }
  
  console.log(`🔍 Resultado para punto [${lat.toFixed(6)}, ${lng.toFixed(6)}]: ${inside ? 'DENTRO ✅' : 'FUERA ❌'} del polígono`);
  return inside;
}

// Función auxiliar para calcular la distancia de un punto a un segmento de línea
function distanceToSegment(
  lat: number, lng: number,
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  // Calcular la longitud del segmento al cuadrado
  const l2 = (lat2 - lat1) * (lat2 - lat1) + (lng2 - lng1) * (lng2 - lng1);
  if (l2 === 0) return distanceBetweenPoints(lat, lng, lat1, lng1);
  
  // Calcular la proyección del punto en el segmento
  const t = Math.max(0, Math.min(1, ((lat - lat1) * (lat2 - lat1) + (lng - lng1) * (lng2 - lng1)) / l2));
  
  // Calcular el punto más cercano en el segmento
  const projLat = lat1 + t * (lat2 - lat1);
  const projLng = lng1 + t * (lng2 - lng1);
  
  // Calcular la distancia entre el punto y su proyección
  return distanceBetweenPoints(lat, lng, projLat, projLng);
}

// Función auxiliar para calcular la distancia entre dos puntos
function distanceBetweenPoints(lat1: number, lng1: number, lat2: number, lng2: number): number {
  // Usamos la distancia euclidiana (simplificada para coordenadas cercanas)
  return Math.sqrt((lat2 - lat1) * (lat2 - lat1) + (lng2 - lng1) * (lng2 - lng1));
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
  // Validación de coordenadas básica
  if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
    console.error("❌ Coordenadas inválidas:", lat, lng);
    return {
      zona: null,
      disponible: false,
      tarifa: 0,
      mensaje: "Coordenadas inválidas. Por favor intenta seleccionar nuevamente."
    };
  }

  // Redondear coordenadas a 6 decimales para estabilidad
  lat = parseFloat(lat.toFixed(6));
  lng = parseFloat(lng.toFixed(6));
  
  const punto: [number, number] = [lat, lng];
  console.log(`🔍 Verificando ubicación exacta: [${lat}, ${lng}]`);

  // Expandimos ligeramente las coordenadas para crear puntos adicionales
  // Esto ayuda con la detección de bordes y pequeñas imprecisiones
  const puntosAVerificar: [number, number][] = [
    punto, // Punto original
    [lat + 0.0001, lng], // Ligeramente al norte
    [lat - 0.0001, lng], // Ligeramente al sur
    [lat, lng + 0.0001], // Ligeramente al este
    [lat, lng - 0.0001], // Ligeramente al oeste
  ];

  // Para cada zona, verificamos los puntos
  for (const zona of deliveryZones) {
    console.log(`📍 Verificando zona: ${zona.nombre} (${zona.id})`);
    
    // Verificamos si alguno de los puntos está en la zona
    let puntoEncontrado = false;
    for (const p of puntosAVerificar) {
      if (isPointInPolygon(p, zona.poligono)) {
        puntoEncontrado = true;
        break;
      }
    }
    
    if (puntoEncontrado) {
      console.log(`✅ Punto encontrado en zona: ${zona.nombre}`);

      if (zona.disponible) {
        return {
          zona,
          disponible: true,
          tarifa: zona.tarifa,
          mensaje: `Delivery disponible en ${zona.nombre}. Costo: $${zona.tarifa.toLocaleString()}. Tiempo estimado: ${zona.tiempoEstimado}.`,
        };
      } else {
        return {
          zona,
          disponible: false,
          tarifa: 0,
          mensaje: `Lo sentimos, el servicio de delivery no está disponible en ${zona.nombre}.`,
        };
      }
    }
  }

  console.log(`❌ Punto [${lat}, ${lng}] no encontrado en ninguna zona`);

  // Si está cerca de Los Andes pero no en una zona específica, 
  // verificamos la distancia total para ofrecer servicio especial
  if (validarDistanciaMaxima(lat, lng, 7)) { // Dentro de 7km de la pizzería
    return {
      zona: null,
      disponible: true, // Ofrecemos servicio aunque no esté en una zona definida
      tarifa: 3500, // Tarifa especial para zonas no definidas pero cercanas
      mensaje: "Estás fuera de nuestras zonas regulares, pero podemos entregarte con una tarifa especial.",
    };
  }

  // Si no está en ninguna zona definida y está lejos
  return {
    zona: null,
    disponible: false,
    tarifa: 0,
    mensaje: "Lo sentimos, tu ubicación está fuera de nuestra zona de cobertura de delivery.",
  };
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

"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { ZoomIn, ZoomOut } from "lucide-react"
import type { DeliveryZone } from "../../lib/delivery-zones"

interface SimulatedMapProps {
  center: { lat: number; lng: number }
  zoom: number
  onMapClick: (lat: number, lng: number) => void
  marker?: { lat: number; lng: number } | null
  onZoomChange?: (zoom: number) => void
  onMapLoaded?: () => void
  showDeliveryZones?: boolean
  deliveryZones?: DeliveryZone[]
}

// Coordenadas base de Los Andes
const LOS_ANDES_CENTER = { lat: -32.8347, lng: -70.5983 }

// Calles principales de Los Andes para simular el mapa
const STREETS = [
  {
    name: "Av. Argentina",
    points: [
      [-32.8347, -70.6083],
      [-32.8347, -70.5883],
    ],
  },
  {
    name: "Calle Esmeralda",
    points: [
      [-32.8447, -70.5983],
      [-32.8247, -70.5983],
    ],
  },
  {
    name: "Av. Santa Teresa",
    points: [
      [-32.8397, -70.6053],
      [-32.8297, -70.5913],
    ],
  },
  {
    name: "Calle Maipú",
    points: [
      [-32.8317, -70.6043],
      [-32.8317, -70.5913],
    ],
  },
  {
    name: "Av. O'Higgins",
    points: [
      [-32.8387, -70.6043],
      [-32.8387, -70.5913],
    ],
  },
  {
    name: "Calle Membrillar",
    points: [
      [-32.8327, -70.6023],
      [-32.8427, -70.5923],
    ],
  },
]

// Puntos de interés en Los Andes
const POINTS_OF_INTEREST = [
  { name: "Plaza de Armas", lat: -32.8347, lng: -70.5983 },
  { name: "Municipalidad", lat: -32.8337, lng: -70.5973 },
  { name: "Terminal de Buses", lat: -32.8367, lng: -70.6013 },
  { name: "Hospital", lat: -32.8307, lng: -70.5953 },
  { name: "Centro Comercial", lat: -32.8357, lng: -70.6003 },
]

// Valores predeterminados para el tamaño del mapa
const DEFAULT_MAP_WIDTH = 600
const DEFAULT_MAP_HEIGHT = 400

export default function SimulatedMap({
  center = LOS_ANDES_CENTER,
  zoom = 15,
  onMapClick,
  marker,
  onZoomChange,
  onMapLoaded,
  showDeliveryZones = false,
  deliveryZones = [],
}: SimulatedMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [mapCenter, setMapCenter] = useState(center)
  const [mapZoom, setMapZoom] = useState(zoom)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [mapOffset, setMapOffset] = useState({ x: 0, y: 0 })
  const [hoveredZone, setHoveredZone] = useState<DeliveryZone | null>(null)
  const [mapDimensions, setMapDimensions] = useState({ width: DEFAULT_MAP_WIDTH, height: DEFAULT_MAP_HEIGHT })
  const [isMapReady, setIsMapReady] = useState(false)

  // Notificar que el mapa está cargado y actualizar dimensiones
  useEffect(() => {
    if (mapRef.current) {
      setMapDimensions({
        width: mapRef.current.clientWidth,
        height: mapRef.current.clientHeight,
      })
      setIsMapReady(true)
      if (onMapLoaded) {
        onMapLoaded()
      }
    }
  }, [onMapLoaded])

  // Actualizar dimensiones del mapa cuando cambia el tamaño de la ventana
  useEffect(() => {
    const handleResize = () => {
      if (mapRef.current) {
        setMapDimensions({
          width: mapRef.current.clientWidth,
          height: mapRef.current.clientHeight,
        })
      }
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Actualizar centro y zoom cuando cambian las props
  useEffect(() => {
    setMapCenter(center)
  }, [center])

  useEffect(() => {
    setMapZoom(zoom)
    if (onZoomChange) {
      onZoomChange(zoom)
    }
  }, [zoom, onZoomChange])

  // Convertir coordenadas geográficas a coordenadas de píxeles en el mapa
  const geoToPixel = (lat: number, lng: number) => {
    if (!isMapReady) {
      // Valores predeterminados si el mapa aún no está listo
      const centerOffsetX = (lng - mapCenter.lng) * 10000
      const centerOffsetY = (mapCenter.lat - lat) * 10000
      return {
        x: DEFAULT_MAP_WIDTH / 2 + centerOffsetX,
        y: DEFAULT_MAP_HEIGHT / 2 + centerOffsetY,
      }
    }

    const zoomFactor = Math.pow(2, mapZoom - 10)
    const centerOffsetX = (lng - mapCenter.lng) * 10000 * zoomFactor
    const centerOffsetY = (mapCenter.lat - lat) * 10000 * zoomFactor

    return {
      x: mapDimensions.width / 2 + centerOffsetX + mapOffset.x,
      y: mapDimensions.height / 2 + centerOffsetY + mapOffset.y,
    }
  }

  // Convertir coordenadas de píxeles a coordenadas geográficas
  const pixelToGeo = (x: number, y: number) => {
    if (!isMapReady) {
      // Valores predeterminados si el mapa aún no está listo
      const centerOffsetX = (x - DEFAULT_MAP_WIDTH / 2) / 10000
      const centerOffsetY = (y - DEFAULT_MAP_HEIGHT / 2) / 10000
      return {
        lat: mapCenter.lat - centerOffsetY,
        lng: mapCenter.lng + centerOffsetX,
      }
    }

    const zoomFactor = Math.pow(2, mapZoom - 10)
    const centerOffsetX = (x - mapDimensions.width / 2 - mapOffset.x) / (10000 * zoomFactor)
    const centerOffsetY = (y - mapDimensions.height / 2 - mapOffset.y) / (10000 * zoomFactor)

    return {
      lat: mapCenter.lat - centerOffsetY,
      lng: mapCenter.lng + centerOffsetX,
    }
  }

  // Manejar clic en el mapa
  const handleMapClick = (e: React.MouseEvent) => {
    if (isDragging || !mapRef.current) return

    const rect = mapRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const geoCoords = pixelToGeo(x, y)
    onMapClick(geoCoords.lat, geoCoords.lng)
  }

  // Manejar inicio de arrastre
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY })
  }

  // Manejar arrastre
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return

    const dx = e.clientX - dragStart.x
    const dy = e.clientY - dragStart.y

    setMapOffset({
      x: mapOffset.x + dx,
      y: mapOffset.y + dy,
    })

    setDragStart({ x: e.clientX, y: e.clientY })
  }

  // Manejar fin de arrastre
  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // Manejar zoom
  const handleZoom = (delta: number) => {
    const newZoom = Math.max(10, Math.min(18, mapZoom + delta))
    setMapZoom(newZoom)
    if (onZoomChange) {
      onZoomChange(newZoom)
    }
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-blue-50">
      {/* Mapa base */}
      <div
        ref={mapRef}
        className="absolute inset-0 bg-[#f2eee1] cursor-grab active:cursor-grabbing"
        onClick={handleMapClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Cuadrícula del mapa */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)",
            backgroundSize: `${10 * Math.pow(2, mapZoom - 10)}px ${10 * Math.pow(2, mapZoom - 10)}px`,
          }}
        />

        {/* Imagen de fondo del mapa */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: "url('/andes-chile-map.png')" }}
        />

        {/* Calles */}
        {isMapReady &&
          STREETS.map((street, index) => {
            const start = geoToPixel(street.points[0][0], street.points[0][1])
            const end = geoToPixel(street.points[1][0], street.points[1][1])

            return (
              <div key={`street-${index}`} className="absolute">
                <div
                  className="absolute bg-white border border-gray-300"
                  style={{
                    left: Math.min(start.x, end.x),
                    top: Math.min(start.y, end.y),
                    width: Math.abs(end.x - start.x) || 4,
                    height: Math.abs(end.y - start.y) || 4,
                    transform: "translate(-50%, -50%)",
                  }}
                />
                <div
                  className="absolute text-xs text-gray-700 font-medium bg-white px-1 rounded shadow-sm"
                  style={{
                    left: (start.x + end.x) / 2,
                    top: (start.y + end.y) / 2,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  {street.name}
                </div>
              </div>
            )
          })}

        {/* Puntos de interés */}
        {isMapReady &&
          POINTS_OF_INTEREST.map((poi, index) => {
            const position = geoToPixel(poi.lat, poi.lng)

            return (
              <div
                key={`poi-${index}`}
                className="absolute flex flex-col items-center"
                style={{
                  left: position.x,
                  top: position.y,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <div className="w-3 h-3 bg-blue-500 rounded-full border border-white shadow-md" />
                <div className="text-xs font-medium bg-white px-1 py-0.5 rounded shadow-sm mt-1">{poi.name}</div>
              </div>
            )
          })}

        {/* Zonas de delivery */}
        {isMapReady &&
          showDeliveryZones &&
          deliveryZones.map((zone) => {
            if (!zone.poligono || zone.poligono.length < 3) return null

            // Convertir puntos del polígono a coordenadas de píxeles
            const points = zone.poligono
              .map(([lat, lng]) => {
                const pixel = geoToPixel(lat, lng)
                return `${pixel.x},${pixel.y}`
              })
              .join(" ")

            return (
              <div key={`zone-${zone.id}`} className="absolute inset-0 pointer-events-none">
                <svg className="absolute inset-0 w-full h-full">
                  <polygon
                    points={points}
                    fill={zone.color}
                    fillOpacity={hoveredZone?.id === zone.id ? "0.4" : "0.2"}
                    stroke={zone.color}
                    strokeWidth="2"
                    className="pointer-events-auto"
                    onMouseEnter={() => setHoveredZone(zone)}
                    onMouseLeave={() => setHoveredZone(null)}
                  />
                </svg>

                {/* Etiqueta de la zona */}
                {hoveredZone?.id === zone.id && (
                  <div
                    className="absolute bg-white p-2 rounded shadow-lg z-10 pointer-events-none"
                    style={{
                      left: geoToPixel(
                        zone.poligono.reduce((sum, point) => sum + point[0], 0) / zone.poligono.length,
                        zone.poligono.reduce((sum, point) => sum + point[1], 0) / zone.poligono.length,
                      ).x,
                      top: geoToPixel(
                        zone.poligono.reduce((sum, point) => sum + point[0], 0) / zone.poligono.length,
                        zone.poligono.reduce((sum, point) => sum + point[1], 0) / zone.poligono.length,
                      ).y,
                      transform: "translate(-50%, -120%)",
                    }}
                  >
                    <div className="font-bold text-sm">{zone.nombre}</div>
                    <div className="text-xs">Tarifa: ${zone.tarifa.toLocaleString()}</div>
                    <div className="text-xs">Tiempo: {zone.tiempoEstimado}</div>
                  </div>
                )}
              </div>
            )
          })}

        {/* Marcador de ubicación seleccionada */}
        {isMapReady && marker && (
          <div
            className="absolute"
            style={{
              left: geoToPixel(marker.lat, marker.lng).x,
              top: geoToPixel(marker.lat, marker.lng).y,
              transform: "translate(-50%, -100%)",
              zIndex: 1000,
            }}
          >
            <div className="w-8 h-8 bg-pink-600 rounded-full flex items-center justify-center animate-bounce shadow-lg border-2 border-white">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-white"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="w-2 h-2 bg-pink-600 rounded-full mx-auto -mt-1" />
          </div>
        )}

        {/* Marca de la pizzería */}
        {isMapReady && (
          <div
            className="absolute"
            style={{
              left: geoToPixel(LOS_ANDES_CENTER.lat, LOS_ANDES_CENTER.lng).x,
              top: geoToPixel(LOS_ANDES_CENTER.lat, LOS_ANDES_CENTER.lng).y,
              transform: "translate(-50%, -50%)",
              zIndex: 900,
            }}
          >
            <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
              <span className="text-lg">🍕</span>
            </div>
            <div className="text-xs font-bold bg-white px-1 py-0.5 rounded shadow-sm mt-1 text-center">
              Pizzería Palermo
            </div>
          </div>
        )}
      </div>

      {/* Controles de zoom */}
      <div className="absolute top-2 right-2 flex flex-col space-y-1">
        <button className="bg-white p-2 rounded-md shadow-md hover:bg-gray-100" onClick={() => handleZoom(1)}>
          <ZoomIn className="h-5 w-5" />
        </button>
        <button className="bg-white p-2 rounded-md shadow-md hover:bg-gray-100" onClick={() => handleZoom(-1)}>
          <ZoomOut className="h-5 w-5" />
        </button>
      </div>

      {/* Información del mapa */}
      <div className="absolute bottom-2 left-2 bg-white px-2 py-1 rounded-md shadow-md text-xs">
        <div>Los Andes, Chile</div>
        <div>Zoom: {mapZoom}</div>
      </div>

      {/* Brújula */}
      <div className="absolute top-2 left-2 bg-white p-2 rounded-full shadow-md">
        <div className="relative w-6 h-6">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-1 h-1 bg-gray-400 rounded-full" />
          </div>
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-0 text-xs font-bold text-blue-600">
            N
          </div>
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 text-xs font-bold text-blue-600">S</div>
          <div className="absolute left-0 top-1/2 transform -translate-y-1/2 text-xs font-bold text-blue-600">O</div>
          <div className="absolute right-0 top-1/2 transform -translate-y-1/2 text-xs font-bold text-blue-600">E</div>
        </div>
      </div>

      {/* Indicador de carga */}
      {!isMapReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80 z-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando mapa de Los Andes...</p>
          </div>
        </div>
      )}
    </div>
  )
}

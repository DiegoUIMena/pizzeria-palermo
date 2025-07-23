"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { MapPin, ZoomIn, ZoomOut } from "lucide-react"

interface MapModalProps {
  isOpen: boolean
  onClose: () => void
  onLocationSelect: (lat: number, lng: number) => void
  initialLocation?: { lat: number; lng: number }
  address?: string
}

export default function MapModal({ isOpen, onClose, onLocationSelect, initialLocation, address }: MapModalProps) {
  const [zoom, setZoom] = useState(16)
  const [center, setCenter] = useState(initialLocation || { lat: -33.4489, lng: -70.6693 }) // Santiago por defecto
  const [markerPosition, setMarkerPosition] = useState(initialLocation || center)
  const mapRef = useRef<HTMLDivElement>(null)

  // Actualizar centro y marcador cuando cambie la ubicación inicial o cuando se abra el modal
  useEffect(() => {
    if (initialLocation && isOpen) {
      console.log("Actualizando posición inicial:", initialLocation)
      setCenter(initialLocation)
      setMarkerPosition(initialLocation)
    }
  }, [initialLocation, isOpen])

  // Reset cuando se cierra el modal para asegurar que la próxima vez se use la ubicación correcta
  useEffect(() => {
    if (!isOpen && initialLocation) {
      setCenter(initialLocation)
      setMarkerPosition(initialLocation)
    }
  }, [isOpen, initialLocation])

  // Función para obtener la URL del tile de OpenStreetMap
  const getTileUrl = (x: number, y: number, z: number) => {
    return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`
  }

  // Convertir coordenadas geográficas a coordenadas de tile
  const deg2num = (lat: number, lon: number, zoom: number) => {
    const latRad = (lat * Math.PI) / 180
    const n = Math.pow(2, zoom)
    const x = Math.floor(((lon + 180) / 360) * n)
    const y = Math.floor(((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n)
    return { x, y }
  }

  // Manejar clic en el mapa con cálculo más preciso
  const handleMapClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!mapRef.current) return

    const rect = mapRef.current.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    // Dimensiones del mapa
    const mapWidth = rect.width
    const mapHeight = rect.height

    // Calcular offset desde el centro en píxeles
    const offsetX = x - mapWidth / 2
    const offsetY = y - mapHeight / 2

    // Convertir píxeles a grados usando la resolución del zoom
    const metersPerPixel = (156543.03392 * Math.cos((center.lat * Math.PI) / 180)) / Math.pow(2, zoom)
    const degreesPerPixel = metersPerPixel / 111320 // Aproximadamente 111320 metros por grado

    // Calcular nuevas coordenadas
    const newLat = center.lat - offsetY * degreesPerPixel
    const newLng = center.lng + offsetX * degreesPerPixel

    console.log("Nueva posición del marcador:", { lat: newLat, lng: newLng })
    setMarkerPosition({ lat: newLat, lng: newLng })
  }

  const handleZoomIn = () => {
    if (zoom < 18) setZoom(zoom + 1)
  }

  const handleZoomOut = () => {
    if (zoom > 10) setZoom(zoom - 1)
  }

  const handleConfirm = () => {
    console.log("Confirmando posición:", markerPosition)
    onLocationSelect(markerPosition.lat, markerPosition.lng)
    onClose()
  }

  // Generar tiles para mostrar
  const generateTiles = () => {
    const centerTile = deg2num(center.lat, center.lng, zoom)
    const tiles = []
    const tilesRadius = 2 // Mostrar 5x5 tiles

    for (let x = centerTile.x - tilesRadius; x <= centerTile.x + tilesRadius; x++) {
      for (let y = centerTile.y - tilesRadius; y <= centerTile.y + tilesRadius; y++) {
        if (x >= 0 && y >= 0 && x < Math.pow(2, zoom) && y < Math.pow(2, zoom)) {
          tiles.push({ x, y, url: getTileUrl(x, y, zoom) })
        }
      }
    }
    return tiles
  }

  // Calcular posición del marcador en píxeles de manera más precisa
  const getMarkerPosition = () => {
    const mapElement = mapRef.current
    if (!mapElement) return { x: 0, y: 0 }

    const mapWidth = mapElement.clientWidth
    const mapHeight = mapElement.clientHeight

    // Calcular diferencia en grados
    const latDiff = center.lat - markerPosition.lat
    const lngDiff = markerPosition.lng - center.lng

    // Convertir grados a píxeles
    const metersPerPixel = (156543.03392 * Math.cos((center.lat * Math.PI) / 180)) / Math.pow(2, zoom)
    const degreesPerPixel = metersPerPixel / 111320

    const offsetX = lngDiff / degreesPerPixel
    const offsetY = latDiff / degreesPerPixel

    const markerX = mapWidth / 2 + offsetX
    const markerY = mapHeight / 2 + offsetY

    return { x: markerX, y: markerY }
  }

  const tiles = generateTiles()
  const markerPixelPos = getMarkerPosition()

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl lg:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <MapPin className="w-5 h-5 mr-2 text-pink-600" />
            Ajustar Ubicación de Entrega
          </DialogTitle>
          {address && <p className="text-sm text-gray-600 mt-2">Dirección: {address}</p>}
        </DialogHeader>

        <div className="space-y-4">
          {/* Controles de zoom */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <p className="text-sm text-gray-600">Haz clic en el mapa para ajustar la ubicación exacta</p>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm" onClick={handleZoomOut} disabled={zoom <= 10}>
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="px-3 py-1 bg-gray-100 rounded text-sm">Zoom: {zoom}</span>
              <Button variant="outline" size="sm" onClick={handleZoomIn} disabled={zoom >= 18}>
                <ZoomIn className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Mapa con dimensiones responsivas */}
          <div className="relative border border-gray-300 rounded-lg overflow-hidden bg-gray-100">
            <div
              ref={mapRef}
              className="relative cursor-crosshair bg-gray-100 mx-auto"
              style={{
                width: "100%",
                maxWidth: "640px",
                height: "300px",
                aspectRatio: "16/10",
              }}
              onClick={handleMapClick}
            >
              {/* Tiles del mapa */}
              {tiles.map((tile) => {
                const mapElement = mapRef.current
                if (!mapElement) return null

                const mapWidth = mapElement.clientWidth
                const mapHeight = mapElement.clientHeight
                const centerTile = deg2num(center.lat, center.lng, zoom)
                const offsetX = (tile.x - centerTile.x) * 256 + mapWidth / 2 - 128
                const offsetY = (tile.y - centerTile.y) * 256 + mapHeight / 2 - 128

                return (
                  <img
                    key={`${tile.x}-${tile.y}`}
                    src={tile.url || "/placeholder.svg"}
                    alt="Map tile"
                    className="absolute w-64 h-64 pointer-events-none"
                    style={{
                      left: offsetX,
                      top: offsetY,
                    }}
                    onError={(e) => {
                      // Ocultar tiles que fallan al cargar
                      e.currentTarget.style.display = "none"
                    }}
                  />
                )
              })}

              {/* Marcador con posición precisa */}
              <div
                className="absolute transform -translate-x-1/2 -translate-y-full pointer-events-none z-10"
                style={{
                  left: markerPixelPos.x,
                  top: markerPixelPos.y,
                }}
              >
                <div className="relative">
                  <div className="w-8 h-8 bg-pink-600 rounded-full border-3 border-white shadow-lg flex items-center justify-center">
                    <div className="w-3 h-3 bg-white rounded-full"></div>
                  </div>
                  <div className="absolute top-8 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-6 border-transparent border-t-pink-600"></div>
                </div>
              </div>

              {/* Crosshair mejorado */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                <div className="w-6 h-6 border-2 border-gray-500 rounded-full bg-white bg-opacity-70 flex items-center justify-center">
                  <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Información de coordenadas */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm text-gray-700 break-all">
              <strong>Coordenadas:</strong> {markerPosition.lat.toFixed(6)}, {markerPosition.lng.toFixed(6)}
            </p>
            {/* Debug info - remover en producción */}
            <p className="text-xs text-gray-500 mt-1 break-all">
              Centro: {center.lat.toFixed(6)}, {center.lng.toFixed(6)}
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button onClick={handleConfirm} className="bg-pink-600 text-white hover:bg-pink-700 w-full sm:w-auto">
            Confirmar Ubicación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

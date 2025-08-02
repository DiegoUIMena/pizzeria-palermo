"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trash2, Save, Plus, X, MapPin, ZoomIn, ZoomOut, Move, Lock, Unlock } from "lucide-react"
import { defaultDeliveryZones, type DeliveryZone } from "../../lib/delivery-zones"

interface DeliveryZoneMapProps {
  isOpen: boolean
  onClose: () => void
  onSaveZones: (zones: DeliveryZone[]) => void
  initialZones?: DeliveryZone[]
}

export default function DeliveryZoneMapV2({ isOpen, onClose, onSaveZones, initialZones }: DeliveryZoneMapProps) {
  // Estados principales
  const [zones, setZones] = useState<DeliveryZone[]>([])
  const [selectedZone, setSelectedZone] = useState<DeliveryZone | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawingPoints, setDrawingPoints] = useState<{ x: number; y: number; lat: number; lng: number }[]>([])
  const [editingZone, setEditingZone] = useState<Partial<DeliveryZone>>({})
  
  // Estados del mapa - SISTEMA INTERACTIVO CON COORDENADAS REALES
  const [mapCenter, setMapCenter] = useState({ lat: -32.8347, lng: -70.5983 })
  const [zoom, setZoom] = useState(14)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [overlaysLocked, setOverlaysLocked] = useState(true) // Iniciamos con navegación libre
  const [mapBounds, setMapBounds] = useState<{north: number, south: number, east: number, west: number} | null>(null)
  const [mapInstance, setMapInstance] = useState<any>(null)
  
  // Referencias
  const mapRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Coordenadas y dimensiones DINÁMICAS para cálculos basados en el estado real del mapa
  const MAP_WIDTH = 800
  const MAP_HEIGHT = 600
  
  // Sistema mejorado: Usar coordenadas geográficas directamente en el almacenamiento
  // y recalcular las posiciones de píxeles cada vez que se renderiza
  
  // Función para detectar cambios en el mapa usando postMessage
  useEffect(() => {
    // Sistema de actualización automática cada segundo cuando no está dibujando
    const updateInterval = setInterval(() => {
      if (!isDrawing && mapLoaded) {
        // Forzar re-renderizado para mantener posiciones actualizadas
        setZones(prev => [...prev])
      }
    }, 1000)

    return () => clearInterval(updateInterval)
  }, [isDrawing, mapLoaded])

  // Calcular bounds dinámicamente basado en el estado actual estimado
  const calculateCurrentBounds = () => {
    // Estimación más precisa basada en el zoom actual
    const latRadian = (mapCenter.lat * Math.PI) / 180
    const n = Math.pow(2, zoom)
    const metersPerPixel = (156543.03392 * Math.cos(latRadian)) / n
    
    const mapWidthMeters = MAP_WIDTH * metersPerPixel
    const mapHeightMeters = MAP_HEIGHT * metersPerPixel
    
    // Convertir metros a grados (aproximación)
    const latDegreesPerMeter = 1 / 111000 // Aproximación: 1 grado ≈ 111km
    const lngDegreesPerMeter = 1 / (111000 * Math.cos(latRadian))
    
    const latRange = (mapHeightMeters / 2) * latDegreesPerMeter
    const lngRange = (mapWidthMeters / 2) * lngDegreesPerMeter

    return {
      north: mapCenter.lat + latRange,
      south: mapCenter.lat - latRange,
      west: mapCenter.lng - lngRange,
      east: mapCenter.lng + lngRange,
    }
  }

  // Conversión geográfica a píxeles - SISTEMA DINÁMICO
  const geoToPixel = (lat: number, lng: number) => {
    const bounds = calculateCurrentBounds()
    
    const x = ((lng - bounds.west) / (bounds.east - bounds.west)) * MAP_WIDTH
    const y = ((bounds.north - lat) / (bounds.north - bounds.south)) * MAP_HEIGHT

    return { 
      x: Math.max(0, Math.min(MAP_WIDTH, x)), 
      y: Math.max(0, Math.min(MAP_HEIGHT, y)) 
    }
  }

  // Conversión píxeles a geográfica - SISTEMA DINÁMICO
  const pixelToGeo = (x: number, y: number) => {
    const bounds = calculateCurrentBounds()
    
    const lng = bounds.west + (x / MAP_WIDTH) * (bounds.east - bounds.west)
    const lat = bounds.north - (y / MAP_HEIGHT) * (bounds.north - bounds.south)

    return { lat, lng }
  }

  // Inicializar zonas
  useEffect(() => {
    if (isOpen) {
      if (initialZones && initialZones.length > 0) {
        setZones([...initialZones])
      } else {
        setZones([])
      }
      setMapLoaded(false)
      setMapBounds(null) // Reset bounds
    }
  }, [isOpen, initialZones])

  // Cargar mapa y configurar detección de cambios
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        setMapLoaded(true)
        console.log('✅ Mapa marcado como cargado')
      }, 2000)

      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // URL del mapa con parámetros controlados - INTERACTIVO
  const getGoogleMapsUrl = () => {
    return `https://maps.google.com/maps?q=${mapCenter.lat},${mapCenter.lng}&t=roadmap&z=${zoom}&output=embed&iwloc=near&hl=es&gestureHandling=auto`
  }

  // Manejo de clics en overlay
  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || overlaysLocked) return

    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    const geo = pixelToGeo(x, y)
    setDrawingPoints(prev => [...prev, { x, y, lat: geo.lat, lng: geo.lng }])
  }

  // Iniciar dibujo
  const startDrawing = () => {
    setIsDrawing(true)
    setDrawingPoints([])
    setSelectedZone(null)
    setEditingZone({})
    setOverlaysLocked(false) // Permitir interacción para dibujar
  }

  // Finalizar dibujo
  const finishDrawing = () => {
    if (drawingPoints.length < 3) {
      alert("Necesitas al menos 3 puntos para crear una zona")
      return
    }

    const newZone: DeliveryZone = {
      id: `zona-${Date.now()}`,
      nombre: `Nueva Zona ${zones.length + 1}`,
      poligono: drawingPoints.map(p => [p.lat, p.lng] as [number, number]),
      tarifa: 2000,
      disponible: true,
      tiempoEstimado: "30-40 min",
      color: "#3B82F6",
      descripcion: "Nueva zona de delivery"
    }

    setZones([...zones, newZone])
    setSelectedZone(newZone)
    setEditingZone(newZone)
    setIsDrawing(false)
    setDrawingPoints([])
    setOverlaysLocked(true) // Bloquear overlays después de crear zona
  }

  // Cancelar dibujo
  const cancelDrawing = () => {
    setIsDrawing(false)
    setDrawingPoints([])
    setOverlaysLocked(true) // Bloquear overlays para permitir navegación libre
  }

  // Seleccionar zona
  const selectZone = (zone: DeliveryZone) => {
    setSelectedZone(zone)
    setEditingZone({ ...zone })
  }

  // Guardar zona editada
  const handleSaveZone = () => {
    if (!editingZone.nombre || !editingZone.tarifa) {
      alert("Por favor completa el nombre y la tarifa de la zona")
      return
    }

    if (selectedZone) {
      const updatedZones = zones.map(zone => 
        zone.id === selectedZone.id 
          ? { ...zone, ...editingZone }
          : zone
      )
      setZones(updatedZones)
    }

    setSelectedZone(null)
    setEditingZone({})
  }

  // Eliminar zona
  const handleDeleteZone = () => {
    if (!selectedZone) return

    if (confirm(`¿Estás seguro de eliminar la zona "${selectedZone.nombre}"?`)) {
      const updatedZones = zones.filter(zone => zone.id !== selectedZone.id)
      setZones(updatedZones)
      setSelectedZone(null)
      setEditingZone({})
    }
  }

  // Guardar todas las zonas
  const handleSaveAll = () => {
    onSaveZones(zones)
    onClose()
  }

  // Renderizar zona en overlay - SISTEMA FIJO Y ESTABLE
  const renderZoneOverlay = (zone: DeliveryZone) => {
    if (!mapLoaded || overlaysLocked) return null

    if (!zone.poligono || zone.poligono.length < 3) return null

    const pixelPoints = zone.poligono.map(point => {
      let lat: number, lng: number
      if (Array.isArray(point)) {
        [lat, lng] = point
      } else {
        lat = point.lat
        lng = point.lng
      }
      return geoToPixel(lat, lng)
    })

    const pathString = pixelPoints.map(p => `${p.x},${p.y}`).join(" ")

    return (
      <g key={zone.id}>
        <polygon
          points={pathString}
          fill={zone.color || "#10B981"}
          fillOpacity={selectedZone?.id === zone.id ? 0.7 : 0.5}
          stroke={zone.color || "#10B981"}
          strokeWidth={selectedZone?.id === zone.id ? 3 : 2}
          strokeOpacity={0.9}
          className="cursor-pointer hover:fill-opacity-70 transition-all duration-200"
          onClick={(e) => {
            e.stopPropagation()
            selectZone(zone)
          }}
        />
        {/* Etiqueta */}
        {pixelPoints.length > 0 && (
          <text
            x={pixelPoints[0].x}
            y={pixelPoints[0].y - 10}
            fill={zone.color || "#10B981"}
            fontSize="12"
            fontWeight="bold"
            className="pointer-events-none"
          >
            {zone.nombre}
          </text>
        )}
      </g>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <MapPin className="w-5 h-5 mr-2 text-pink-600" />
            Editor de Zonas de Delivery - Mapa Interactivo
            <Badge variant="outline" className="ml-2">
              Navegación Libre
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex h-[75vh] gap-4">
          {/* Mapa */}
          <div className="flex-1 relative">
            {/* Contenedor del mapa */}
            <div ref={mapRef} className="w-full h-full border-2 border-gray-300 rounded-lg overflow-hidden relative">
              {/* Iframe del mapa - INTERACTIVO */}
              <iframe
                src={getGoogleMapsUrl()}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Mapa interactivo de zonas de delivery"
              />

              {/* Controles de zona */}
              <div className="absolute top-2 right-2 z-30 flex gap-2">
                {!isDrawing ? (
                  <Button onClick={startDrawing} className="bg-green-600 hover:bg-green-700 text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Nueva Zona
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      onClick={finishDrawing}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      disabled={drawingPoints.length < 3}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Finalizar ({drawingPoints.length})
                    </Button>
                    <Button onClick={cancelDrawing} variant="outline">
                      <X className="w-4 h-4 mr-2" />
                      Cancelar
                    </Button>
                  </div>
                )}
              </div>

              {/* Control de bloqueo de overlays - Minimalista */}
              <div className="absolute bottom-4 left-4 z-30">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOverlaysLocked(!overlaysLocked)}
                  title={overlaysLocked ? "🗺️ Activar modo dibujo" : "🖱️ Activar navegación libre"}
                  className={`backdrop-blur-sm hover:bg-white ${overlaysLocked ? 'bg-blue-50 border-blue-300' : 'bg-green-50 border-green-300'}`}
                >
                  {overlaysLocked ? (
                    <><Move className="w-4 h-4 mr-1" /><span className="text-xs">NAV</span></>
                  ) : (
                    <><Plus className="w-4 h-4 mr-1" /><span className="text-xs">DRAW</span></>
                  )}
                </Button>
              </div>

              {/* Overlay para zonas */}
              {mapLoaded && (
                <div
                  ref={overlayRef}
                  className={`absolute inset-0 ${overlaysLocked ? 'pointer-events-none' : 'pointer-events-auto'}`}
                  onClick={handleOverlayClick}
                  style={{ 
                    cursor: isDrawing && !overlaysLocked ? "crosshair" : "default",
                    backgroundColor: isDrawing && !overlaysLocked ? "rgba(0,255,0,0.05)" : "transparent"
                  }}
                >
                  <svg
                    width={MAP_WIDTH}
                    height={MAP_HEIGHT}
                    className="absolute inset-0"
                    style={{ maxWidth: "100%", maxHeight: "100%" }}
                  >
                    {/* Zonas existentes */}
                    {zones.map(zone => renderZoneOverlay(zone))}

                    {/* Polígono en construcción */}
                    {isDrawing && drawingPoints.length > 0 && !overlaysLocked && (
                      <g>
                        {/* Polígono temporal */}
                        {drawingPoints.length > 2 && (
                          <polygon
                            points={drawingPoints.map(p => `${p.x},${p.y}`).join(" ")}
                            fill="rgba(59, 130, 246, 0.2)"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            strokeDasharray="5,5"
                          />
                        )}
                        
                        {/* Puntos de dibujo */}
                        {drawingPoints.map((point, i) => (
                          <circle
                            key={i}
                            cx={point.x}
                            cy={point.y}
                            r={4}
                            fill="#3b82f6"
                            stroke="white"
                            strokeWidth={2}
                          />
                        ))}
                      </g>
                    )}
                  </svg>
                </div>
              )}

              {/* Indicador de carga */}
              {!mapLoaded && (
                <div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-10">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-gray-600">Cargando mapa estable...</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Panel lateral */}
          <div className="w-80 space-y-4">
            {/* Lista de zonas */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Zonas de Delivery ({zones.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-40 overflow-auto">
                {zones.length === 0 ? (
                  <p className="text-gray-500 text-sm">No hay zonas creadas</p>
                ) : (
                  zones.map((zone) => (
                    <div
                      key={zone.id}
                      className={`p-2 border rounded cursor-pointer transition-colors ${
                        selectedZone?.id === zone.id ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"
                      }`}
                      onClick={() => selectZone(zone)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{zone.nombre}</span>
                        <span className="text-sm text-gray-500">${zone.tarifa}</span>
                      </div>
                      <div className="text-xs text-gray-400">
                        {zone.poligono.length} puntos
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Editor de zona */}
            {selectedZone && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Editar Zona</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="zone-name">Nombre</Label>
                    <Input
                      id="zone-name"
                      value={editingZone.nombre || ""}
                      onChange={(e) => setEditingZone({ ...editingZone, nombre: e.target.value })}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="zone-price">Tarifa</Label>
                    <Input
                      id="zone-price"
                      type="number"
                      value={editingZone.tarifa || 0}
                      onChange={(e) => setEditingZone({ ...editingZone, tarifa: Number(e.target.value) })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="zone-time">Tiempo Estimado</Label>
                    <Input
                      id="zone-time"
                      value={editingZone.tiempoEstimado || ""}
                      onChange={(e) => setEditingZone({ ...editingZone, tiempoEstimado: e.target.value })}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="zone-active"
                      checked={editingZone.disponible ?? true}
                      onCheckedChange={(checked) => setEditingZone({ ...editingZone, disponible: checked })}
                    />
                    <Label htmlFor="zone-active">Zona activa</Label>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleSaveZone} className="flex-1">
                      <Save className="w-4 h-4 mr-2" />
                      Guardar
                    </Button>
                    <Button onClick={handleDeleteZone} variant="destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Acciones */}
            <div className="flex gap-2">
              <Button onClick={handleSaveAll} className="flex-1 bg-green-600 hover:bg-green-700">
                Guardar Todo
              </Button>
              <Button onClick={onClose} variant="outline">
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

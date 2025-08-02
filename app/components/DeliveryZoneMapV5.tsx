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
import { Trash2, Save, Plus, X, MapPin, Target } from "lucide-react"
import { type DeliveryZone } from "../../lib/delivery-zones"

interface DeliveryZoneMapProps {
  isOpen: boolean
  onClose: () => void
  onSaveZones: (zones: DeliveryZone[]) => void
  initialZones?: DeliveryZone[]
}

export default function DeliveryZoneMapV5({ isOpen, onClose, onSaveZones, initialZones }: DeliveryZoneMapProps) {
  // Estados principales
  const [zones, setZones] = useState<DeliveryZone[]>([])
  const [selectedZone, setSelectedZone] = useState<DeliveryZone | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawingPoints, setDrawingPoints] = useState<{ x: number; y: number; lat: number; lng: number }[]>([])
  const [editingZone, setEditingZone] = useState<Partial<DeliveryZone>>({})
  
  // Estados del mapa - COORDENADAS ABSOLUTAMENTE FIJAS
  const [mapLoaded, setMapLoaded] = useState(false)
  const [drawingMode, setDrawingMode] = useState(false)
  
  // Centro fijo de Los Andes, Chile (EXACTO)
  const MAP_CENTER = { lat: -32.8347, lng: -70.5983 }
  const MAP_ZOOM = 14
  
  // Bounds calculados basándose en el centro real y zoom de Google Maps
  const latRange = 0.015  // Aproximadamente 1.5km en latitud
  const lngRange = 0.020  // Aproximadamente 1.5km en longitud
  
  const FIXED_BOUNDS = {
    north: MAP_CENTER.lat - latRange / 2,  // -32.8197
    south: MAP_CENTER.lat + latRange / 2,  // -32.8497
    west: MAP_CENTER.lng - lngRange / 2,   // -70.6083
    east: MAP_CENTER.lng + lngRange / 2    // -70.5883
  }
  
  // Referencias
  const mapRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Dimensiones del mapa (fijas)
  const MAP_WIDTH = 800
  const MAP_HEIGHT = 600

  // CONVERSIÓN DE COORDENADAS - SISTEMA SIMPLE SIN LOGS
  const geoToPixel = (lat: number, lng: number) => {
    const x = ((lng - FIXED_BOUNDS.west) / (FIXED_BOUNDS.east - FIXED_BOUNDS.west)) * MAP_WIDTH
    const y = ((FIXED_BOUNDS.north - lat) / (FIXED_BOUNDS.north - FIXED_BOUNDS.south)) * MAP_HEIGHT

    return { 
      x: Math.max(0, Math.min(MAP_WIDTH, x)), 
      y: Math.max(0, Math.min(MAP_HEIGHT, y)) 
    }
  }

  const pixelToGeo = (x: number, y: number) => {
    // Conversión inversa desde píxeles a coordenadas geográficas
    // Usando bounds absolutamente fijos
    const lng = FIXED_BOUNDS.west + (x / MAP_WIDTH) * (FIXED_BOUNDS.east - FIXED_BOUNDS.west)
    const lat = FIXED_BOUNDS.north - (y / MAP_HEIGHT) * (FIXED_BOUNDS.north - FIXED_BOUNDS.south)

    return { lat, lng }
  }

  // URL del mapa - SIEMPRE LA MISMA
  const getMapUrl = () => {
    return `https://maps.google.com/maps?q=${MAP_CENTER.lat},${MAP_CENTER.lng}&t=roadmap&z=${MAP_ZOOM}&output=embed&iwloc=near&hl=es`
  }

  // Inicializar zonas
  useEffect(() => {
    if (isOpen) {
      if (initialZones && initialZones.length > 0) {
        setZones([...initialZones])
      } else {
        setZones([]) // No crear zona automática por ahora
      }
      setMapLoaded(false)
    }
  }, [isOpen, initialZones])

  // Cargar mapa con delay normal
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        setMapLoaded(true)
      }, 2000)

      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Manejo de clics en overlay
  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing) return

    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    const geo = pixelToGeo(x, y)
    setDrawingPoints(prev => {
      const newPoints = [...prev, { x, y, lat: geo.lat, lng: geo.lng }]
      console.log('🎯 Punto agregado (coordenadas fijas):', { pixel: { x, y }, geo, totalPoints: newPoints.length })
      return newPoints
    })
  }

  // Iniciar dibujo
  const startDrawing = () => {
    setIsDrawing(true)
    setDrawingMode(true)
    setDrawingPoints([])
    setSelectedZone(null)
    setEditingZone({})
    console.log('🚀 Iniciando modo dibujo con coordenadas fijas')
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
    setDrawingMode(false)
    setDrawingPoints([])
    
    console.log('✅ Zona creada con coordenadas fijas:', newZone.poligono)
  }

  // Cancelar dibujo
  const cancelDrawing = () => {
    setIsDrawing(false)
    setDrawingMode(false)
    setDrawingPoints([])
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

  // Renderizar zona en overlay - SIMPLE
  const renderZoneOverlay = (zone: DeliveryZone) => {
    if (!mapLoaded) return null
    if (!zone.poligono || zone.poligono.length < 3) return null

    const pixelPoints = zone.poligono.map(point => {
      let lat: number, lng: number
      if (Array.isArray(point)) {
        [lat, lng] = point
      } else if (typeof point === 'object' && 'lat' in point && 'lng' in point) {
        lat = point.lat
        lng = point.lng
      } else {
        return { x: 0, y: 0 }
      }

      return geoToPixel(lat, lng)
    })

    const pathString = pixelPoints.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ")

    return (
      <>
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
        <text
          x={pixelPoints[0]?.x || 0}
          y={(pixelPoints[0]?.y || 0) - 10}
          fill={zone.color || "#10B981"}
          fontSize="12"
          fontWeight="bold"
          className="pointer-events-none"
          textAnchor="middle"
        >
          {zone.nombre}
        </text>
      </>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <MapPin className="w-5 h-5 mr-2 text-pink-600" />
            Editor de Zonas de Delivery - V5 Coordenadas Fijas
            <Badge variant="outline" className="ml-2">
              Sistema Estable
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex h-[75vh] gap-4">
          {/* Mapa */}
          <div className="flex-1 relative">
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

            {/* Indicador de modo */}
            {drawingMode && (
              <div className="absolute top-14 left-2 right-2 z-30 bg-green-100 border-2 border-green-400 rounded-lg p-3 text-sm shadow-lg">
                <div className="flex items-center justify-center text-green-800">
                  <Target className="w-5 h-5 mr-2 animate-pulse" />
                  <strong>MODO DIBUJO:</strong> Haz clic en el mapa para agregar puntos (Coordenadas Fijas)
                  {drawingPoints.length > 0 && (
                    <span className="ml-2 bg-green-200 px-2 py-1 rounded">
                      {drawingPoints.length} puntos
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Panel de información */}
            <div className="absolute bottom-2 right-2 z-30 bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs max-w-64">
              <div><strong>Sistema:</strong> V5 - Coordenadas Fijas</div>
              <div><strong>Centro:</strong> {MAP_CENTER.lat}, {MAP_CENTER.lng}</div>
              <div><strong>Zoom:</strong> {MAP_ZOOM} (fijo)</div>
              <div><strong>Bounds:</strong>
                <div className="text-[10px] mt-1">
                  <div>N: {FIXED_BOUNDS.north}</div>
                  <div>S: {FIXED_BOUNDS.south}</div>
                  <div>W: {FIXED_BOUNDS.west}</div>
                  <div>E: {FIXED_BOUNDS.east}</div>
                </div>
              </div>
              <div><strong>Modo:</strong> {isDrawing ? '🟢 DIBUJO' : '🔴 NAVEGACIÓN'}</div>
              <div><strong>Puntos:</strong> {drawingPoints.length}</div>
              <div><strong>Zonas:</strong> {zones.length}</div>
            </div>

            {/* Contenedor del mapa */}
            <div ref={mapRef} className="w-full h-full border-2 border-gray-300 rounded-lg overflow-hidden relative">
              {/* Iframe del mapa - URL FIJA */}
              <iframe
                src={getMapUrl()}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                title="Mapa fijo de Los Andes"
              />

              {/* Overlay para polígonos */}
              {mapLoaded && (
                <div
                  ref={overlayRef}
                  className={`absolute inset-0 ${isDrawing ? 'pointer-events-auto' : 'pointer-events-none'}`}
                  onClick={handleOverlayClick}
                  style={{ 
                    cursor: isDrawing ? "crosshair" : "default",
                    backgroundColor: isDrawing ? "rgba(0,255,0,0.1)" : "transparent",
                    zIndex: isDrawing ? 10 : 5
                  }}
                >
                  <svg
                    width={MAP_WIDTH}
                    height={MAP_HEIGHT}
                    className="absolute inset-0 w-full h-full"
                    style={{ 
                      maxWidth: "100%", 
                      maxHeight: "100%",
                      pointerEvents: isDrawing ? 'auto' : 'none'
                    }}
                  >
                    {/* Zonas existentes */}
                    {zones.map(zone => (
                      <g key={zone.id} style={{ pointerEvents: 'auto' }}>
                        {renderZoneOverlay(zone)}
                      </g>
                    ))}

                    {/* Polígono en construcción */}
                    {isDrawing && drawingPoints.length > 0 && (
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
                    <p className="text-gray-600">Cargando mapa con coordenadas fijas...</p>
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
                        {zone.poligono.length} puntos - Coords fijas
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

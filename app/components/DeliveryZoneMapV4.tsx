"use client"

import type React from "react"
imp  // Inicializar zonas con datos de prueba
  useEffect(() => {
    if (isOpen) {
      if (initialZones && initialZones.length > 0) {
        setZones([...initialZones])
        console.log('🔄 Zonas cargadas:', initialZones.length)
      } else {
        // Crear zona de prueba automáticamente si no hay zonas
        const testZone: DeliveryZone = {
          id: 'test-zone-fixed',
          nombre: 'Zona Centro Los Andes',
          poligono: [
            [-32.83, -70.605],   // Esquina noroeste
            [-32.84, -70.605],   // Esquina suroeste  
            [-32.84, -70.59],    // Esquina sureste
            [-32.83, -70.59]     // Esquina noreste
          ],
          tarifa: 2000,
          disponible: true,
          tiempoEstimado: "20-30 min",
          color: "#10B981",
          descripcion: "Zona de prueba con coordenadas fijas"
        }
        setZones([testZone])
        console.log('✅ Zona de prueba creada automáticamente')
      }
      setMapLoaded(false)
    }
  }, [isOpen, initialZones])te, useRef, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trash2, Save, Plus, X, MapPin, Move, Target } from "lucide-react"
import { defaultDeliveryZones, type DeliveryZone } from "../../lib/delivery-zones"

interface DeliveryZoneMapProps {
  isOpen: boolean
  onClose: () => void
  onSaveZones: (zones: DeliveryZone[]) => void
  initialZones?: DeliveryZone[]
}

export default function DeliveryZoneMapV4({ isOpen, onClose, onSaveZones, initialZones }: DeliveryZoneMapProps) {
  // Estados principales
  const [zones, setZones] = useState<DeliveryZone[]>([])
  const [selectedZone, setSelectedZone] = useState<DeliveryZone | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawingPoints, setDrawingPoints] = useState<{ x: number; y: number; lat: number; lng: number }[]>([])
  const [editingZone, setEditingZone] = useState<Partial<DeliveryZone>>({})
  
  // Estados del mapa - SISTEMA COORDENADAS FIJAS GEOGRÁFICAS
  const [mapCenter] = useState({ lat: -32.8347, lng: -70.5983 }) // Centro fijo
  const [zoom] = useState(14) // Zoom fijo
  const [mapLoaded, setMapLoaded] = useState(false)
  const [drawingMode, setDrawingMode] = useState(false)
  
  // Bounds fijos basados en Los Andes, Chile
  const FIXED_BOUNDS = {
    north: -32.825,  // Norte de Los Andes
    south: -32.845,  // Sur de Los Andes  
    west: -70.610,   // Oeste de Los Andes
    east: -70.585    // Este de Los Andes
  }
  
  // Referencias
  const mapRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Dimensiones del mapa FIJAS
  const MAP_WIDTH = 800
  const MAP_HEIGHT = 600

  // Inicializar zonas
  useEffect(() => {
    if (isOpen) {
      if (initialZones && initialZones.length > 0) {
        setZones([...initialZones])
        console.log('� Zonas cargadas:', initialZones.length)
      } else {
        setZones([])
      }
      setMapLoaded(false)
    }
  }, [isOpen, initialZones])

  // Cargar mapa
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        setMapLoaded(true)
        console.log('✅ Mapa cargado con coordenadas fijas')
      }, 2000)

      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // CONVERSIÓN DE COORDENADAS FIJAS - SISTEMA ROBUSTO
  const geoToPixel = (lat: number, lng: number) => {
    // Usar bounds fijos para conversión precisa
    const bounds = FIXED_BOUNDS
    
    // Conversión lineal desde coordenadas geográficas a píxeles
    const x = ((lng - bounds.west) / (bounds.east - bounds.west)) * MAP_WIDTH
    const y = ((bounds.north - lat) / (bounds.north - bounds.south)) * MAP_HEIGHT

    return { 
      x: Math.max(0, Math.min(MAP_WIDTH, x)), 
      y: Math.max(0, Math.min(MAP_HEIGHT, y)) 
    }
  }

  const pixelToGeo = (x: number, y: number) => {
    // Usar bounds fijos para conversión precisa
    const bounds = FIXED_BOUNDS
    
    // Conversión inversa desde píxeles a coordenadas geográficas
    const lng = bounds.west + (x / MAP_WIDTH) * (bounds.east - bounds.west)
    const lat = bounds.north - (y / MAP_HEIGHT) * (bounds.north - bounds.south)

    return { lat, lng }
  }

  // URL del mapa - Google Maps con centro fijo
  const getMapUrl = () => {
    // Usar coordenadas fijas para mantener consistencia
    const centerLat = mapCenter.lat
    const centerLng = mapCenter.lng
    const zoomLevel = zoom
    
    return `https://maps.google.com/maps?q=${centerLat},${centerLng}&t=roadmap&z=${zoomLevel}&output=embed&iwloc=near&hl=es`
  }

  // Manejo de clics en overlay
  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    console.log('🖱️ Clic detectado en overlay, isDrawing:', isDrawing)
    
    if (!isDrawing) {
      console.log('⚠️ No está en modo dibujo, ignorando clic')
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    console.log('📍 Posición del clic:', { x, y, rect })

    const geo = pixelToGeo(x, y)
    setDrawingPoints(prev => {
      const newPoints = [...prev, { x, y, lat: geo.lat, lng: geo.lng }]
      console.log('🎯 Punto agregado:', { pixel: { x, y }, geo, totalPoints: newPoints.length })
      return newPoints
    })
  }

  // Iniciar dibujo
  const startDrawing = () => {
    console.log('🚀 Iniciando modo dibujo')
    setIsDrawing(true)
    setDrawingMode(true)
    setDrawingPoints([])
    setSelectedZone(null)
    setEditingZone({})
    console.log('✅ Modo dibujo activado')
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
    
    console.log('✅ Zona creada con coordenadas:', newZone.poligono)
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

  // Renderizar zona en overlay - SISTEMA COORDENADAS FIJAS
  const renderZoneOverlay = (zone: DeliveryZone) => {
    if (!mapLoaded) return null

    if (!zone.poligono || zone.poligono.length < 3) return null

    // Convertir coordenadas geográficas a píxeles usando sistema fijo
    const pixelPoints = zone.poligono.map(point => {
      let lat: number, lng: number
      if (Array.isArray(point)) {
        [lat, lng] = point
      } else if (typeof point === 'object' && 'lat' in point && 'lng' in point) {
        lat = point.lat
        lng = point.lng
      } else {
        console.error('Formato de punto inválido:', point)
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
        {/* Etiqueta con posición fija */}
        {pixelPoints.length > 0 && (
          <text
            x={pixelPoints[0].x}
            y={pixelPoints[0].y - 10}
            fill={zone.color || "#10B981"}
            fontSize="12"
            fontWeight="bold"
            className="pointer-events-none drop-shadow-sm"
            textAnchor="middle"
          >
            {zone.nombre}
          </text>
        )}
        {/* Debug: mostrar puntos cuando seleccionado */}
        {selectedZone?.id === zone.id && pixelPoints.map((point, i) => (
          <circle
            key={i}
            cx={point.x}
            cy={point.y}
            r={3}
            fill="#FF0000"
            stroke="#FFFFFF"
            strokeWidth={1}
            className="pointer-events-none"
          />
        ))}
      </>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <MapPin className="w-5 h-5 mr-2 text-pink-600" />
            Editor de Zonas de Delivery - Coordenadas Fijas
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

            {/* Indicador de modo - SISTEMA DINÁMICO */}
            {drawingMode && (
              <div className="absolute top-14 left-2 right-2 z-30 bg-green-100 border-2 border-green-400 rounded-lg p-3 text-sm shadow-lg">
                <div className="flex items-center justify-center text-green-800">
                  <Target className="w-5 h-5 mr-2 animate-pulse" />
                  <strong>MODO DIBUJO ACTIVO:</strong> Haz clic en el mapa para agregar puntos (Sistema Dinámico)
                  {drawingPoints.length > 0 && (
                    <span className="ml-2 bg-green-200 px-2 py-1 rounded">
                      {drawingPoints.length} puntos
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Información del sistema - CON COORDENADAS FIJAS */}
            <div className="absolute bottom-2 right-2 z-30 bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs max-w-64">
              <div><strong>Sistema:</strong> Coordenadas Fijas</div>
              <div><strong>Centro:</strong> {mapCenter.lat.toFixed(6)}, {mapCenter.lng.toFixed(6)}</div>
              <div><strong>Zoom:</strong> {zoom}</div>
              <div><strong>Bounds Fijos:</strong>
                <div className="text-[10px] mt-1">
                  <div>N: {FIXED_BOUNDS.north.toFixed(4)}</div>
                  <div>S: {FIXED_BOUNDS.south.toFixed(4)}</div>
                  <div>W: {FIXED_BOUNDS.west.toFixed(4)}</div>
                  <div>E: {FIXED_BOUNDS.east.toFixed(4)}</div>
                </div>
              </div>
              <div><strong>Modo:</strong> {isDrawing ? '🟢 DIBUJO' : '🔴 NAVEGACIÓN'}</div>
              <div><strong>Puntos:</strong> {drawingPoints.length}</div>
              <div><strong>Zonas:</strong> {zones.length}</div>
            </div>

            {/* Contenedor del mapa */}
            <div ref={mapRef} className="w-full h-full border-2 border-gray-300 rounded-lg overflow-hidden relative">
              {/* Iframe del mapa - OpenStreetMap */}
              <iframe
                src={getMapUrl()}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                title="Mapa de Google Maps para zonas de delivery"
              />

              {/* Overlay para zonas - SOLO ACTIVO CUANDO DIBUJA */}
              {mapLoaded && (
                <div
                  ref={overlayRef}
                  className={`absolute inset-0 ${isDrawing ? 'pointer-events-auto' : 'pointer-events-none'}`}
                  onClick={handleOverlayClick}
                  onMouseMove={(e) => {
                    if (isDrawing) {
                      const rect = e.currentTarget.getBoundingClientRect()
                      const x = e.clientX - rect.left
                      const y = e.clientY - rect.top
                      console.log('🖱️ Mouse move en modo dibujo:', { x, y })
                    }
                  }}
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
                    {/* Zonas existentes - SE ACTUALIZAN CON BOUNDS DINÁMICOS */}
                    {zones.map(zone => (
                      <g key={`${zone.id}-fixed`} style={{ pointerEvents: 'auto' }}>
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
                        {zone.poligono.length} puntos - Geo fijo ({zone.poligono[0] ? `${Array.isArray(zone.poligono[0]) ? zone.poligono[0][0].toFixed(4) : zone.poligono[0].lat?.toFixed(4)}, ${Array.isArray(zone.poligono[0]) ? zone.poligono[0][1].toFixed(4) : zone.poligono[0].lng?.toFixed(4)}` : 'Sin coords'})
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

"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Trash2, Save, Plus, X, MapPin, Target, AlertCircle, Anchor } from "lucide-react"
import { type DeliveryZone } from "../../lib/delivery-zones"
import { saveDeliveryZones, deleteDeliveryZone } from "../../lib/delivery-zones-service"
import { toast } from "@/hooks/use-toast"

interface DeliveryZoneMapProps {
  isOpen: boolean
  onClose: () => void
  onSaveZones: (zones: DeliveryZone[]) => void
  initialZones?: DeliveryZone[]
}

// NUEVO ENFOQUE: COORDENADAS RELATIVAS AL CONTENEDOR (NO AL MAPA)
// Los polígonos se guardan como PORCENTAJES del contenedor (0-100%)
// Esto hace que sean independientes del movimiento del mapa

interface RelativePoint {
  x: number  // Porcentaje (0-100) del ancho del contenedor
  y: number  // Porcentaje (0-100) del alto del contenedor
}

export default function DeliveryZoneMapRelative({ isOpen, onClose, onSaveZones, initialZones }: DeliveryZoneMapProps) {
  // Estados
  const [zones, setZones] = useState<DeliveryZone[]>([])
  const [selectedZone, setSelectedZone] = useState<DeliveryZone | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawingPoints, setDrawingPoints] = useState<RelativePoint[]>([])
  const [editingZone, setEditingZone] = useState<Partial<DeliveryZone>>({})
  const [visibleZones, setVisibleZones] = useState<Set<string>>(new Set())
  const [mapLoaded, setMapLoaded] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })

  // Referencias
  const containerRef = useRef<HTMLDivElement>(null)

  // FUNCIONES DE CONVERSIÓN RELATIVA
  const clickToRelative = useCallback((clientX: number, clientY: number, rect: DOMRect): RelativePoint => {
    // Posición relativa al contenedor como porcentaje
    const relativeX = ((clientX - rect.left) / rect.width) * 100
    const relativeY = ((clientY - rect.top) / rect.height) * 100
    
    // Limitar a 0-100%
    const x = Math.max(0, Math.min(100, relativeX))
    const y = Math.max(0, Math.min(100, relativeY))
    
    console.log(`🎯 CLICK RELATIVO: [${clientX - rect.left}, ${clientY - rect.top}] → [${x.toFixed(2)}%, ${y.toFixed(2)}%]`)
    
    return { x, y }
  }, [])

  const relativeToPixel = useCallback((point: RelativePoint, width: number, height: number) => {
    const pixelX = (point.x / 100) * width
    const pixelY = (point.y / 100) * height
    
    return { x: Math.round(pixelX), y: Math.round(pixelY) }
  }, [])

  // CONVERTIR COORDENADAS LAT/LNG A RELATIVAS (para zonas existentes)
  const convertLatLngToRelative = useCallback((zones: DeliveryZone[]): DeliveryZone[] => {
    return zones.map(zone => {
      if (!zone.poligono || zone.poligono.length === 0) return zone

      // Si ya tiene coordenadas relativas (números entre 0-100), mantenerlas
      const firstPoint = zone.poligono[0]
      let isAlreadyRelative = false
      
      if (Array.isArray(firstPoint)) {
        const [val1, val2] = firstPoint
        // Si ambos valores están entre 0-100, asumimos que son relativos
        isAlreadyRelative = val1 >= 0 && val1 <= 100 && val2 >= 0 && val2 <= 100
      }
      
      if (isAlreadyRelative) {
        console.log(`✅ Zona "${zone.nombre}" ya tiene coordenadas relativas`)
        return zone
      }

      console.log(`🔄 Convirtiendo zona "${zone.nombre}" a coordenadas relativas`)
      
      // Convertir coordenadas lat/lng a posiciones relativas del centro
      const relativePolygon = zone.poligono.map((point, i) => {
        let lat: number, lng: number
        
        if (Array.isArray(point)) {
          [lat, lng] = point
        } else if (typeof point === 'object' && 'lat' in point && 'lng' in point) {
          ({ lat, lng } = point)
        } else {
          console.warn(`Punto inválido en zona "${zone.nombre}":`, point)
          return [50, 50] // Centro por defecto
        }

        // Convertir lat/lng a posición relativa aproximada
        // Los Andes: centro aproximado -32.8347, -70.5983
        const centerLat = -32.8347
        const centerLng = -70.5983
        const range = 0.02 // Rango de ±0.02 grados (aprox 2km)
        
        // Calcular posición relativa basada en la distancia al centro
        const relativeX = 50 + ((lng - centerLng) / range) * 25 // 50% ± 25%
        const relativeY = 50 + ((centerLat - lat) / range) * 25 // 50% ± 25%
        
        // Limitar a 10-90% para evitar bordes
        const x = Math.max(10, Math.min(90, relativeX))
        const y = Math.max(10, Math.min(90, relativeY))
        
        console.log(`   Punto ${i + 1}: [${lat}, ${lng}] → [${x.toFixed(1)}%, ${y.toFixed(1)}%]`)
        
        return [x, y] as [number, number]
      })

      return {
        ...zone,
        poligono: relativePolygon
      }
    })
  }, [])

  // INICIALIZACIÓN
  useEffect(() => {
    if (isOpen) {
      console.log("🚀 MAPA RELATIVO INICIALIZADO")
      
      // Convertir zonas existentes a coordenadas relativas
      const zonesData = initialZones || []
      const convertedZones = convertLatLngToRelative(zonesData)
      
      setZones(convertedZones)
      setVisibleZones(new Set(convertedZones.map(z => z.id)))
      
      console.log(`📊 Cargadas ${convertedZones.length} zonas con coordenadas relativas`)

      // Reset estados
      setSelectedZone(null)
      setEditingZone({})
      setIsDrawing(false)
      setDrawingPoints([])
      setMapLoaded(false)

      // Observer para el tamaño del contenedor
      const updateSize = () => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect()
          setContainerSize({ width: rect.width, height: rect.height })
          console.log(`📐 Tamaño contenedor: ${rect.width}x${rect.height}`)
        }
      }

      // Cargar mapa
      setTimeout(() => {
        setMapLoaded(true)
        updateSize()
        console.log("✅ Mapa relativo cargado")
      }, 1500)

      // Listener para cambios de tamaño
      window.addEventListener('resize', updateSize)
      return () => window.removeEventListener('resize', updateSize)
    }
  }, [isOpen, initialZones, convertLatLngToRelative])

  // MANEJO DE CLICS
  const handleMapClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !mapLoaded || !containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const relativePoint = clickToRelative(event.clientX, event.clientY, rect)
    
    console.log(`🖱️ CLICK: Cliente=[${event.clientX}, ${event.clientY}], Contenedor=[${rect.left}, ${rect.top}], Relativo=[${relativePoint.x}%, ${relativePoint.y}%]`)
    
    setDrawingPoints(prev => [...prev, relativePoint])
  }, [isDrawing, mapLoaded, clickToRelative])

  // INICIAR DIBUJO
  const startDrawing = () => {
    setIsDrawing(true)
    setDrawingPoints([])
    setSelectedZone(null)
    setEditingZone({
      nombre: `Zona ${zones.length + 1}`,
      tarifa: 2000,
      tiempoEstimado: "30-40 min",
      disponible: true,
      color: "#3B82F6",
      descripcion: "Nueva zona de delivery"
    })
    console.log("🎨 INICIANDO DIBUJO RELATIVO")
  }

  // FINALIZAR DIBUJO
  const finishDrawing = async () => {
    if (drawingPoints.length < 3) {
      toast({
        title: "Error",
        description: "Necesitas al menos 3 puntos para crear una zona",
        variant: "destructive"
      })
      return
    }

    if (!editingZone.nombre || !editingZone.tarifa) {
      toast({
        title: "Error", 
        description: "Por favor completa el nombre y la tarifa",
        variant: "destructive"
      })
      return
    }

    try {
      setIsSaving(true)

      // Crear zona con coordenadas RELATIVAS
      const newZone: DeliveryZone = {
        id: `zona-${Date.now()}`,
        nombre: editingZone.nombre,
        poligono: drawingPoints.map(p => [p.x, p.y] as [number, number]), // Guardar como porcentajes
        tarifa: editingZone.tarifa,
        disponible: editingZone.disponible ?? true,
        tiempoEstimado: editingZone.tiempoEstimado || "30-40 min",
        color: editingZone.color || "#3B82F6",
        descripcion: editingZone.descripcion || "Nueva zona de delivery"
      }

      console.log("💾 GUARDANDO ZONA RELATIVA:", newZone.nombre)
      console.log("📍 Polígono RELATIVO:", newZone.poligono)

      // Guardar en Firebase
      const allZones = [...zones, newZone]
      await saveDeliveryZones(allZones)

      // Actualizar estado LOCAL
      setZones(allZones)
      setVisibleZones(prev => new Set([...prev, newZone.id]))
      setSelectedZone(newZone)
      setIsDrawing(false)
      setDrawingPoints([])
      
      toast({
        title: "✅ Zona creada",
        description: `"${newZone.nombre}" guardada con posición relativa`,
        variant: "default"
      })

      // Notificar al padre
      onSaveZones(allZones)

    } catch (error) {
      console.error("❌ Error guardando zona:", error)
      toast({
        title: "Error",
        description: "No se pudo guardar la zona",
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }

  // CANCELAR DIBUJO
  const cancelDrawing = () => {
    setIsDrawing(false)
    setDrawingPoints([])
    setEditingZone({})
  }

  // SELECCIONAR ZONA
  const selectZone = (zone: DeliveryZone) => {
    if (isDrawing) return
    setSelectedZone(zone)
    setEditingZone({ ...zone })
  }

  // TOGGLE VISIBILIDAD
  const toggleZoneVisibility = (zoneId: string) => {
    setVisibleZones(prev => {
      const newSet = new Set(prev)
      if (newSet.has(zoneId)) {
        newSet.delete(zoneId)
      } else {
        newSet.add(zoneId)
      }
      return newSet
    })
  }

  // RENDERIZAR ZONA CON COORDENADAS RELATIVAS
  const renderZoneRelative = useCallback((zone: DeliveryZone) => {
    if (!mapLoaded || !zone.poligono || zone.poligono.length < 3) return null
    if (!visibleZones.has(zone.id)) return null

    console.log(`🎨 RENDERIZANDO RELATIVO: "${zone.nombre}"`)
    
    // Convertir porcentajes a píxeles del contenedor actual
    const points = zone.poligono.map((point, i) => {
      let x: number, y: number
      
      if (Array.isArray(point)) {
        [x, y] = point
      } else if (typeof point === 'object' && 'x' in point && 'y' in point) {
        ({ x, y } = point)
      } else {
        console.error("❌ Punto inválido:", point)
        return { x: 0, y: 0 }
      }

      const pixel = relativeToPixel({ x, y }, containerSize.width, containerSize.height)
      console.log(`   Punto ${i + 1}: [${x}%, ${y}%] → [${pixel.x}px, ${pixel.y}px]`)
      return pixel
    })

    const pathString = points.map(p => `${p.x},${p.y}`).join(" ")
    console.log(`   SVG Path: "${pathString}"`)

    const isSelected = selectedZone?.id === zone.id

    return (
      <g key={zone.id}>
        <polygon
          points={pathString}
          fill={zone.color || "#10B981"}
          fillOpacity={isSelected ? 0.7 : 0.5}
          stroke={zone.color || "#10B981"}
          strokeWidth={isSelected ? 3 : 2}
          strokeOpacity={0.9}
          className="cursor-pointer hover:fill-opacity-70 transition-all duration-200"
          onClick={(e) => {
            e.stopPropagation()
            selectZone(zone)
          }}
        />
        <text
          x={points[0]?.x || 0}
          y={(points[0]?.y || 0) - 10}
          fill={zone.color || "#10B981"}
          fontSize="12"
          fontWeight="bold"
          className="pointer-events-none"
          textAnchor="middle"
        >
          {zone.nombre}
        </text>
      </g>
    )
  }, [mapLoaded, selectedZone, relativeToPixel, visibleZones, containerSize])

  // RENDERIZAR POLÍGONO EN CONSTRUCCIÓN
  const renderDrawingPolygon = useCallback(() => {
    if (!isDrawing || drawingPoints.length === 0) return null

    const points = drawingPoints.map(p => relativeToPixel(p, containerSize.width, containerSize.height))
    
    return (
      <g>
        {/* Polígono temporal */}
        {points.length > 2 && (
          <polygon
            points={points.map(p => `${p.x},${p.y}`).join(" ")}
            fill="rgba(59, 130, 246, 0.3)"
            stroke="#3b82f6"
            strokeWidth={3}
            strokeDasharray="5,5"
          />
        )}
        
        {/* Líneas de conexión */}
        {points.length > 1 && (
          <polyline
            points={points.map(p => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={3}
            strokeDasharray="3,3"
          />
        )}
        
        {/* Puntos */}
        {points.map((point, i) => (
          <g key={i}>
            <circle
              cx={point.x}
              cy={point.y}
              r={7}
              fill="#3b82f6"
              stroke="white"
              strokeWidth={3}
            />
            <text
              x={point.x + 12}
              y={point.y + 5}
              fontSize="12"
              fill="#3b82f6"
              fontWeight="bold"
            >
              {i + 1}
            </text>
          </g>
        ))}
      </g>
    )
  }, [isDrawing, drawingPoints, relativeToPixel, containerSize])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <MapPin className="w-5 h-5 mr-2 text-pink-600" />
            Editor de Zonas - Coordenadas Relativas
            <Badge variant="outline" className="ml-2 bg-orange-50 text-orange-700">
              <Anchor className="w-3 h-3 mr-1" />
              Independiente del Mapa
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex h-[75vh] gap-4">
          {/* Mapa */}
          <div className="flex-1 relative">
            
            {/* Información del sistema */}
            <div className="absolute top-2 left-2 z-30 bg-orange-100 rounded-lg border border-orange-200 p-3 shadow-sm">
              <div className="text-xs font-semibold mb-2 flex items-center">
                <Anchor className="w-4 h-4 mr-1" />
                Sistema Relativo
              </div>
              <div className="text-xs text-orange-800 space-y-1">
                <div><strong>Contenedor:</strong> {containerSize.width}x{containerSize.height}</div>
                <div><strong>Zonas:</strong> {zones.length}</div>
                <div><strong>Tipo:</strong> Porcentajes (0-100%)</div>
                <div className="text-orange-600 font-semibold">⚓ Independiente del Mapa</div>
              </div>
            </div>

            {/* Controles */}
            <div className="absolute top-2 right-2 z-30 flex gap-2">
              {!isDrawing ? (
                <Button 
                  onClick={startDrawing} 
                  className="bg-green-600 hover:bg-green-700 text-white"
                  disabled={isSaving || !mapLoaded}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nueva Zona
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    onClick={finishDrawing}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={drawingPoints.length < 3 || isSaving}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Finalizar ({drawingPoints.length})
                  </Button>
                  <Button onClick={cancelDrawing} variant="outline" disabled={isSaving}>
                    <X className="w-4 h-4 mr-2" />
                    Cancelar
                  </Button>
                </div>
              )}
            </div>

            {/* Indicador de modo */}
            {isDrawing && (
              <div className="absolute top-14 left-2 right-2 z-30 bg-blue-100 border-2 border-blue-400 rounded-lg p-3 text-sm shadow-lg">
                <div className="flex items-center justify-center text-blue-800">
                  <Target className="w-5 h-5 mr-2 animate-pulse" />
                  <strong>🎯 DIBUJO RELATIVO:</strong> Independiente del movimiento del mapa
                  {drawingPoints.length > 0 && (
                    <span className="ml-2 bg-blue-200 px-2 py-1 rounded">
                      {drawingPoints.length} puntos
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Contenedor del mapa */}
            <div 
              ref={containerRef}
              className="w-full h-full border-2 border-gray-300 rounded-lg overflow-hidden relative"
            >
              <iframe
                src="https://www.openstreetmap.org/export/embed.html?bbox=-70.6050,-32.8450,-70.5850,-32.8250&layer=mapnik&marker=-32.8347,-70.5983"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                title="Mapa Los Andes - Sistema Relativo"
              />

              {/* Overlay RELATIVO */}
              {mapLoaded && (
                <div
                  className={`absolute inset-0 ${isDrawing ? 'pointer-events-auto cursor-crosshair' : 'pointer-events-none'}`}
                  onClick={handleMapClick}
                  style={{ 
                    backgroundColor: isDrawing ? "rgba(255,165,0,0.05)" : "transparent",
                    zIndex: isDrawing ? 10 : 5
                  }}
                >
                  <svg
                    width="100%"
                    height="100%"
                    className="absolute inset-0"
                    viewBox={`0 0 ${containerSize.width} ${containerSize.height}`}
                    style={{ pointerEvents: isDrawing ? 'auto' : 'none' }}
                  >
                    {/* Zonas guardadas */}
                    {zones.map(zone => renderZoneRelative(zone))}
                    
                    {/* Polígono en construcción */}
                    {renderDrawingPolygon()}
                  </svg>
                </div>
              )}

              {/* Indicador de carga */}
              {!mapLoaded && (
                <div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-10">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-2"></div>
                    <p className="text-gray-600">Cargando Sistema Relativo...</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Panel lateral */}
          <div className="w-80 flex flex-col h-full">
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              
              {/* Lista de zonas */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>Zonas Relativas ({zones.length})</span>
                    <div className="flex items-center gap-2">
                      {zones.length > 0 && (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setVisibleZones(new Set(zones.map(z => z.id)))}
                            className="text-xs h-6 px-2"
                          >
                            Mostrar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setVisibleZones(new Set())}
                            className="text-xs h-6 px-2"
                          >
                            Ocultar
                          </Button>
                        </div>
                      )}
                      {isSaving && (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 max-h-32 overflow-auto">
                  {zones.length === 0 ? (
                    <div className="text-center p-4 text-gray-500">
                      <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-sm">No hay zonas creadas</p>
                      <p className="text-xs">Crea zonas independientes del mapa</p>
                    </div>
                  ) : (
                    zones.map((zone) => (
                      <div
                        key={zone.id}
                        className={`p-2 border rounded transition-colors ${
                          selectedZone?.id === zone.id ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={visibleZones.has(zone.id)}
                            onCheckedChange={() => toggleZoneVisibility(zone.id)}
                            className="flex-shrink-0"
                          />
                          <div 
                            className="flex-1 cursor-pointer"
                            onClick={() => selectZone(zone)}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{zone.nombre}</span>
                              <span className="text-sm text-gray-500">${zone.tarifa}</span>
                            </div>
                            <div className="text-xs text-gray-400">
                              ⚓ {zone.poligono?.length || 0} puntos relativos
                              {!visibleZones.has(zone.id) && (
                                <span className="ml-2 text-orange-500">• Oculto</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Editor de zona */}
              {(selectedZone || isDrawing) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      {isDrawing ? "Nueva Zona" : "Editar Zona"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="zone-name">Nombre</Label>
                      <Input
                        id="zone-name"
                        value={editingZone.nombre || ""}
                        onChange={(e) => setEditingZone({ ...editingZone, nombre: e.target.value })}
                        placeholder="Nombre de la zona"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="zone-price">Tarifa</Label>
                      <Input
                        id="zone-price"
                        type="number"
                        value={editingZone.tarifa || 0}
                        onChange={(e) => setEditingZone({ ...editingZone, tarifa: Number(e.target.value) })}
                        placeholder="2000"
                      />
                    </div>

                    <div>
                      <Label htmlFor="zone-time">Tiempo Estimado</Label>
                      <Input
                        id="zone-time"
                        value={editingZone.tiempoEstimado || ""}
                        onChange={(e) => setEditingZone({ ...editingZone, tiempoEstimado: e.target.value })}
                        placeholder="30-40 min"
                      />
                    </div>

                    <div>
                      <Label htmlFor="zone-color">Color</Label>
                      <Input
                        id="zone-color"
                        type="color"
                        value={editingZone.color || "#3B82F6"}
                        onChange={(e) => setEditingZone({ ...editingZone, color: e.target.value })}
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
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Botones de acción */}
            <div className="flex gap-2 pt-4 border-t border-gray-200 mt-4">
              <Button 
                onClick={onClose} 
                className="flex-1 bg-green-600 hover:bg-green-700"
                disabled={isSaving}
              >
                {isSaving ? "Guardando..." : "Cerrar"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

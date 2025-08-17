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
import { Trash2, Save, Plus, X, MapPin, Target, AlertCircle } from "lucide-react"
import { type DeliveryZone } from "../../lib/delivery-zones"
import { saveDeliveryZones, deleteDeliveryZone } from "../../lib/delivery-zones-service"
import { toast } from "@/hooks/use-toast"

interface DeliveryZoneMapProps {
  isOpen: boolean
  onClose: () => void
  onSaveZones: (zones: DeliveryZone[]) => void
  initialZones?: DeliveryZone[]
}

export default function DeliveryZoneMapStable({ isOpen, onClose, onSaveZones, initialZones }: DeliveryZoneMapProps) {
  // Estados principales
  const [zones, setZones] = useState<DeliveryZone[]>([])
  const [selectedZone, setSelectedZone] = useState<DeliveryZone | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawingPoints, setDrawingPoints] = useState<{ lat: number; lng: number }[]>([])
  const [editingZone, setEditingZone] = useState<Partial<DeliveryZone>>({})
  const [visibleZones, setVisibleZones] = useState<Set<string>>(new Set())
  const [mapLoaded, setMapLoaded] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // CRÍTICO: Estados fijos para coordenadas estables
  const [fixedMapCenter] = useState({ lat: -32.8347, lng: -70.5983 })
  const [fixedMapZoom] = useState(15)
  const [stableMapKey] = useState(0) // NO cambiar nunca para mantener referencia fija

  // Referencias
  const mapRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Dimensiones fijas del mapa
  const MAP_WIDTH = 800
  const MAP_HEIGHT = 600

  // SISTEMA DE COORDENADAS FIJO - NO CAMBIAR NUNCA
  const calculateFixedBounds = useCallback(() => {
    // Bounds fijos basados en Los Andes, Chile
    const latSpan = 0.015 // Span fijo
    const lngSpan = 0.015 // Span fijo
    
    return {
      north: fixedMapCenter.lat + latSpan,
      south: fixedMapCenter.lat - latSpan,
      west: fixedMapCenter.lng - lngSpan,
      east: fixedMapCenter.lng + lngSpan
    }
  }, [fixedMapCenter])

  // CONVERSIÓN DE COORDENADAS CON PRECISIÓN MEJORADA
  const geoToPixel = useCallback((lat: number, lng: number) => {
    const bounds = calculateFixedBounds()
    
    // Conversión más precisa con validación
    const x = ((lng - bounds.west) / (bounds.east - bounds.west)) * MAP_WIDTH
    const y = ((bounds.north - lat) / (bounds.north - bounds.south)) * MAP_HEIGHT

    return { 
      x: Math.round(Math.max(0, Math.min(MAP_WIDTH, x))), 
      y: Math.round(Math.max(0, Math.min(MAP_HEIGHT, y))) 
    }
  }, [calculateFixedBounds])

  const pixelToGeo = useCallback((x: number, y: number) => {
    const bounds = calculateFixedBounds()
    
    // Conversión inversa más precisa
    const lng = bounds.west + (x / MAP_WIDTH) * (bounds.east - bounds.west)
    const lat = bounds.north - (y / MAP_HEIGHT) * (bounds.north - bounds.south)

    return { 
      lat: Number(lat.toFixed(6)), 
      lng: Number(lng.toFixed(6)) 
    }
  }, [calculateFixedBounds])

  // URL fija del mapa - NUNCA cambiar
  const getFixedMapUrl = useCallback(() => {
    const bounds = calculateFixedBounds()
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bounds.west},${bounds.south},${bounds.east},${bounds.north}&layer=mapnik&marker=${fixedMapCenter.lat},${fixedMapCenter.lng}`
  }, [calculateFixedBounds, fixedMapCenter])

  // Inicializar zonas - MANTENER ESTABILIDAD
  useEffect(() => {
    if (isOpen) {
      console.log("Mapa Estable: Inicializando con coordenadas fijas...")
      const initialZonesList = initialZones ? [...initialZones] : []
      setZones(initialZonesList)
      
      const allZoneIds = new Set(initialZonesList.map(zone => zone.id))
      setVisibleZones(allZoneIds)
      
      setMapLoaded(false)
      setSelectedZone(null)
      setEditingZone({})
      setIsDrawing(false)
      setDrawingPoints([])

      // Cargar mapa con referencia fija
      setTimeout(() => {
        setMapLoaded(true)
        console.log("Mapa Estable: Sistema de coordenadas fijas activado")
        console.log("Bounds fijos:", calculateFixedBounds())
      }, 1000)
    }
  }, [isOpen, initialZones, calculateFixedBounds])

  // MANEJO DE CLICS CON MÁXIMA PRECISIÓN
  const handleOverlayClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !mapLoaded) return

    const rect = event.currentTarget.getBoundingClientRect()
    
    // Calcular posición exacta con compensación de bordes
    const clickX = event.clientX - rect.left
    const clickY = event.clientY - rect.top
    
    // Aplicar factor de corrección para iframe
    const correctionFactor = 1.0
    const normalizedX = (clickX / rect.width) * MAP_WIDTH * correctionFactor
    const normalizedY = (clickY / rect.height) * MAP_HEIGHT * correctionFactor
    
    // Convertir a coordenadas geográficas con el sistema fijo
    const geo = pixelToGeo(normalizedX, normalizedY)
    
    console.log("Mapa Estable: Click ultra-preciso:", {
      click: { x: Math.round(clickX), y: Math.round(clickY) },
      rect: { width: Math.round(rect.width), height: Math.round(rect.height) },
      normalized: { x: Math.round(normalizedX), y: Math.round(normalizedY) },
      geo,
      boundsActuales: calculateFixedBounds()
    })
    
    setDrawingPoints(prev => {
      const updated = [...prev, geo]
      console.log(`Punto ${updated.length} - Coordenadas exactas:`, geo)
      return updated
    })
  }, [isDrawing, mapLoaded, pixelToGeo, calculateFixedBounds])

  // Iniciar dibujo
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
    console.log("Mapa Estable: Iniciando dibujo con sistema fijo")
  }

  // Finalizar dibujo - SIN AFECTAR ZONAS EXISTENTES
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
        description: "Por favor completa el nombre y la tarifa de la zona",
        variant: "destructive"
      })
      return
    }

    try {
      setIsSaving(true)

      const newZone: DeliveryZone = {
        id: `zona-${Date.now()}`,
        nombre: editingZone.nombre,
        poligono: drawingPoints.map(p => [p.lat, p.lng] as [number, number]),
        tarifa: editingZone.tarifa,
        disponible: editingZone.disponible ?? true,
        tiempoEstimado: editingZone.tiempoEstimado || "30-40 min",
        color: editingZone.color || "#3B82F6",
        descripcion: editingZone.descripcion || "Nueva zona de delivery"
      }

      console.log("Mapa Estable: Guardando zona sin afectar existentes:", newZone)

      // Guardar TODAS las zonas (existentes + nueva) para mantener referencias
      const allZones = [...zones, newZone]
      await saveDeliveryZones(allZones)

      // Actualizar estado local
      setZones(allZones)
      setVisibleZones(prev => new Set([...prev, newZone.id]))
      setSelectedZone(newZone)
      setIsDrawing(false)
      setDrawingPoints([])
      
      toast({
        title: "✅ Zona creada y estabilizada",
        description: `"${newZone.nombre}" creada sin afectar zonas existentes`,
        variant: "default"
      })

      onSaveZones(allZones)

      console.log("Mapa Estable: Zona guardada - Sistema estable mantenido")

    } catch (error) {
      console.error("Mapa Estable: Error creando zona:", error)
      toast({
        title: "Error",
        description: "No se pudo guardar la zona en la base de datos",
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Cancelar dibujo
  const cancelDrawing = () => {
    setIsDrawing(false)
    setDrawingPoints([])
    setEditingZone({})
  }

  // Seleccionar zona
  const selectZone = (zone: DeliveryZone) => {
    if (isDrawing) return
    setSelectedZone(zone)
    setEditingZone({ ...zone })
  }

  // Toggle visibilidad de zona
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

  // Guardar zona editada - SIN AFECTAR OTRAS ZONAS
  const handleSaveZone = async () => {
    if (!editingZone.nombre || !editingZone.tarifa || !selectedZone) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos",
        variant: "destructive"
      })
      return
    }

    try {
      setIsSaving(true)
      
      const updatedZones = zones.map(zone => 
        zone.id === selectedZone.id 
          ? { ...zone, ...editingZone }
          : zone
      )
      
      await saveDeliveryZones(updatedZones)
      setZones(updatedZones)
      
      toast({
        title: "Zona actualizada",
        description: `Se ha actualizado la zona "${editingZone.nombre}"`,
        variant: "default"
      })
      
      onSaveZones(updatedZones)
      
    } catch (error) {
      console.error("Mapa Estable: Error actualizando zona:", error)
      toast({
        title: "Error",
        description: "No se pudo actualizar la zona",
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }

    setSelectedZone(null)
    setEditingZone({})
  }

  // Eliminar zona - SIN AFECTAR OTRAS
  const handleDeleteZone = async () => {
    if (!selectedZone) return

    const zoneName = selectedZone.nombre
    
    if (!confirm(`¿Estás seguro de eliminar la zona "${zoneName}"?`)) {
      return
    }

    try {
      setIsSaving(true)
      
      await deleteDeliveryZone(selectedZone.id)
      
      const updatedZones = zones.filter(zone => zone.id !== selectedZone.id)
      setZones(updatedZones)
      
      setSelectedZone(null)
      setEditingZone({})
      
      toast({
        title: "Zona eliminada",
        description: `Se ha eliminado la zona "${zoneName}"`,
        variant: "default"
      })
      
      onSaveZones(updatedZones)
      
    } catch (error) {
      console.error("Mapa Estable: Error eliminando zona:", error)
      toast({
        title: "Error",
        description: "No se pudo eliminar la zona",
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Guardar todas las zonas
  const handleSaveAll = async () => {
    try {
      setIsSaving(true)
      
      if (zones.length === 0) {
        toast({
          title: "Error",
          description: "No hay zonas para guardar",
          variant: "destructive"
        })
        return
      }
      
      await saveDeliveryZones(zones)
      onSaveZones(zones)
      
      toast({
        title: "Zonas guardadas",
        description: `${zones.length} zonas guardadas con sistema estable`,
        variant: "default"
      })
      
      onClose()
      
    } catch (error) {
      console.error("Mapa Estable: Error guardando zonas:", error)
      toast({
        title: "Error",
        description: "No se pudieron guardar las zonas",
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }

  // RENDERIZAR ZONA CON COORDENADAS ESTABLES
  const renderZoneOverlay = useCallback((zone: DeliveryZone) => {
    if (!mapLoaded || !zone.poligono || zone.poligono.length < 3) return null
    if (!visibleZones.has(zone.id)) return null

    // Usar sistema de coordenadas fijo para mantener estabilidad
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

    const pathString = pixelPoints.map(p => `${p.x},${p.y}`).join(" ")

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
  }, [mapLoaded, selectedZone, geoToPixel, visibleZones])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <MapPin className="w-5 h-5 mr-2 text-pink-600" />
            Editor de Zonas de Delivery - Sistema Estable
            <Badge variant="outline" className="ml-2 bg-green-50 text-green-700">
              Coordenadas Fijas
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex h-[75vh] gap-4">
          {/* Mapa */}
          <div className="flex-1 relative">
            {/* Información del sistema */}
            <div className="absolute top-2 left-2 z-30 bg-blue-100 rounded-lg border border-blue-200 p-2 shadow-sm">
              <div className="text-xs font-semibold mb-1">Sistema Estable</div>
              <div className="text-xs text-blue-800">
                Centro: {fixedMapCenter.lat.toFixed(4)}, {fixedMapCenter.lng.toFixed(4)}
              </div>
              <div className="text-xs text-blue-800">
                Zoom: {fixedMapZoom} (Fijo)
              </div>
            </div>

            {/* Controles principales */}
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
              <div className="absolute top-14 left-2 right-2 z-30 bg-green-100 border-2 border-green-400 rounded-lg p-3 text-sm shadow-lg">
                <div className="flex items-center justify-center text-green-800">
                  <Target className="w-5 h-5 mr-2 animate-pulse" />
                  <strong>MODO DIBUJO ESTABLE:</strong> Coordenadas fijas - Clics ultra-precisos
                  {drawingPoints.length > 0 && (
                    <span className="ml-2 bg-green-200 px-2 py-1 rounded">
                      {drawingPoints.length} puntos
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Contenedor del mapa con referencia fija */}
            <div className="w-full h-full border-2 border-gray-300 rounded-lg overflow-hidden relative">
              <iframe
                key={stableMapKey}
                src={getFixedMapUrl()}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                title="Mapa Estable Los Andes - Referencia Fija"
              />

              {/* Overlay con coordenadas estables */}
              {mapLoaded && (
                <div
                  ref={overlayRef}
                  className={`absolute inset-0 ${isDrawing ? 'pointer-events-auto cursor-crosshair' : 'pointer-events-none'}`}
                  onClick={handleOverlayClick}
                  style={{ 
                    backgroundColor: isDrawing ? "rgba(0,255,0,0.05)" : "transparent",
                    zIndex: isDrawing ? 10 : 5
                  }}
                >
                  <svg
                    width="100%"
                    height="100%"
                    className="absolute inset-0 w-full h-full"
                    viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
                    style={{ pointerEvents: isDrawing ? 'auto' : 'none' }}
                  >
                    {/* Zonas existentes con coordenadas estables */}
                    {zones.map(zone => (
                      <g key={zone.id} style={{ pointerEvents: 'auto' }}>
                        {renderZoneOverlay(zone)}
                      </g>
                    ))}

                    {/* Polígono en construcción */}
                    {isDrawing && drawingPoints.length > 0 && (
                      <g>
                        {(() => {
                          const pixelPoints = drawingPoints.map(point => geoToPixel(point.lat, point.lng))
                          
                          return (
                            <>
                              {pixelPoints.length > 2 && (
                                <polygon
                                  points={pixelPoints.map(p => `${p.x},${p.y}`).join(" ")}
                                  fill="rgba(59, 130, 246, 0.3)"
                                  stroke="#3b82f6"
                                  strokeWidth={2}
                                  strokeDasharray="5,5"
                                />
                              )}
                              
                              {pixelPoints.length > 1 && (
                                <polyline
                                  points={pixelPoints.map(p => `${p.x},${p.y}`).join(" ")}
                                  fill="none"
                                  stroke="#3b82f6"
                                  strokeWidth={2}
                                  strokeDasharray="3,3"
                                />
                              )}
                              
                              {pixelPoints.map((point, i) => (
                                <g key={i}>
                                  <circle
                                    cx={point.x}
                                    cy={point.y}
                                    r={6}
                                    fill="#3b82f6"
                                    stroke="white"
                                    strokeWidth={2}
                                  />
                                  <text
                                    x={point.x + 10}
                                    y={point.y + 4}
                                    fontSize="11"
                                    fill="#3b82f6"
                                    fontWeight="bold"
                                  >
                                    {i + 1}
                                  </text>
                                </g>
                              ))}
                            </>
                          )
                        })()}
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
                    <p className="text-gray-600">Cargando Sistema Estable...</p>
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
                    <span>Zonas de Delivery ({zones.length})</span>
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
                      <p className="text-xs">Haz clic en "Nueva Zona"</p>
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
                              {zone.poligono.length} puntos
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

                    {!isDrawing && (
                      <div className="flex gap-2">
                        <Button onClick={handleSaveZone} className="flex-1" disabled={isSaving}>
                          <Save className="w-4 h-4 mr-2" />
                          Guardar
                        </Button>
                        <Button onClick={handleDeleteZone} variant="destructive" disabled={isSaving}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Botones de acción */}
            <div className="flex gap-2 pt-4 border-t border-gray-200 mt-4">
              <Button 
                onClick={handleSaveAll} 
                className="flex-1 bg-green-600 hover:bg-green-700"
                disabled={isSaving || zones.length === 0}
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Guardar Todo
                  </>
                )}
              </Button>
              <Button onClick={onClose} variant="outline" disabled={isSaving}>
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

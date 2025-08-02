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

export default function DeliveryZoneMapV6({ isOpen, onClose, onSaveZones, initialZones }: DeliveryZoneMapProps) {
  // Estados principales
  const [zones, setZones] = useState<DeliveryZone[]>([])
  const [selectedZone, setSelectedZone] = useState<DeliveryZone | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawingPoints, setDrawingPoints] = useState<{ x: number; y: number; lat: number; lng: number }[]>([])
  const [editingZone, setEditingZone] = useState<Partial<DeliveryZone>>({})
  
  // Estados del mapa y persistencia
  const [mapLoaded, setMapLoaded] = useState(false)
  const [drawingMode, setDrawingMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  // SOLUCIÓN DEFINITIVA: Sistema híbrido Google Maps + coordenadas precisas
  const MAP_CENTER = { lat: -32.8347, lng: -70.5983 }
  const MAP_ZOOM = 14
  
  // Referencias
  const mapRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Dimensiones del mapa
  const MAP_WIDTH = 800
  const MAP_HEIGHT = 600

  // SISTEMA DE CONVERSIÓN CORREGIDO PARA GOOGLE MAPS
  const calculateRealBounds = () => {
    // Los Andes coordenadas específicas para zoom 14
    // Estas coordenadas están calibradas manualmente para máxima precisión
    return {
      north: -32.820,  // Límite norte
      south: -32.850,  // Límite sur
      west: -70.610,   // Límite oeste
      east: -70.580    // Límite este
    }
  }

  // CONVERSIÓN DE COORDENADAS PRECISA CON DEBUG
  const geoToPixel = (lat: number, lng: number) => {
    const bounds = calculateRealBounds()
    
    const x = ((lng - bounds.west) / (bounds.east - bounds.west)) * MAP_WIDTH
    const y = ((bounds.north - lat) / (bounds.north - bounds.south)) * MAP_HEIGHT

    const result = { 
      x: Math.max(0, Math.min(MAP_WIDTH, x)), 
      y: Math.max(0, Math.min(MAP_HEIGHT, y)) 
    }
    
    // Debug para verificar conversiones
    if (isDrawing) {
      console.log("V6 geoToPixel:", { input: { lat, lng }, bounds, output: result })
    }
    
    return result
  }

  const pixelToGeo = (x: number, y: number) => {
    const bounds = calculateRealBounds()
    
    const lng = bounds.west + (x / MAP_WIDTH) * (bounds.east - bounds.west)
    const lat = bounds.north - (y / MAP_HEIGHT) * (bounds.north - bounds.south)

    const result = { lat, lng }
    
    // Debug para verificar conversiones
    if (isDrawing) {
      console.log("V6 pixelToGeo:", { input: { x, y }, bounds, output: result })
    }

    return result
  }

  // URL del mapa Google Maps
  const getMapUrl = () => {
    return `https://maps.google.com/maps?q=${MAP_CENTER.lat},${MAP_CENTER.lng}&t=roadmap&z=${MAP_ZOOM}&output=embed&iwloc=near&hl=es`
  }

  // Inicializar zonas y configuración
  useEffect(() => {
    if (isOpen) {
      console.log("V6: Inicializando con zonas:", initialZones)
      setZones(initialZones ? [...initialZones] : [])
      setMapLoaded(false)
      setSelectedZone(null)
      setEditingZone({})
      setIsDrawing(false)
      setDrawingMode(false)
      setDrawingPoints([])
    }
  }, [isOpen, initialZones])

  // Cargar mapa
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        setMapLoaded(true)
        console.log("V6: Mapa cargado con sistema híbrido")
      }, 2000)

      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Manejo de clics en overlay - PRECISIÓN MEJORADA
  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !mapLoaded) return

    const rect = event.currentTarget.getBoundingClientRect()
    
    // Calcular las coordenadas relativas al overlay
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    
    // Obtener las dimensiones reales del overlay
    const actualWidth = rect.width
    const actualHeight = rect.height
    
    // Normalizar las coordenadas al rango del mapa
    const normalizedX = (x / actualWidth) * MAP_WIDTH
    const normalizedY = (y / actualHeight) * MAP_HEIGHT
    
    console.log("V6: Click details:", { 
      click: { x, y }, 
      rect: { width: actualWidth, height: actualHeight },
      normalized: { x: normalizedX, y: normalizedY }
    })

    const geo = pixelToGeo(normalizedX, normalizedY)
    const newPoint = { x: normalizedX, y: normalizedY, lat: geo.lat, lng: geo.lng }
    
    setDrawingPoints(prev => {
      const updated = [...prev, newPoint]
      console.log(`V6: Punto agregado ${updated.length}:`, { 
        pixel: { x: normalizedX, y: normalizedY }, 
        geo,
        click: { x, y }
      })
      return updated
    })
  }

  // Iniciar dibujo
  const startDrawing = () => {
    setIsDrawing(true)
    setDrawingMode(true)
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
    console.log("V6: Iniciando modo dibujo")
  }

  // Finalizar dibujo y guardar automáticamente
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

      console.log("V6: Guardando nueva zona:", newZone)

      // Guardar en la base de datos inmediatamente
      await saveDeliveryZones([...zones, newZone])

      // Actualizar estado local
      setZones(prev => [...prev, newZone])
      setSelectedZone(newZone)
      setIsDrawing(false)
      setDrawingMode(false)
      setDrawingPoints([])
      
      console.log("V6: Zona creada y guardada:", newZone)
      
      toast({
        title: "Zona creada y guardada",
        description: `Se ha creado y guardado la zona "${newZone.nombre}" en la base de datos`,
        variant: "default"
      })

      // Notificar al componente padre para refrescar la lista
      onSaveZones([...zones, newZone])

    } catch (error) {
      console.error("V6: Error creando zona:", error)
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
    setDrawingMode(false)
    setDrawingPoints([])
    setEditingZone({})
  }

  // Seleccionar zona
  const selectZone = (zone: DeliveryZone) => {
    if (isDrawing) return
    setSelectedZone(zone)
    setEditingZone({ ...zone })
  }

  // Guardar zona editada
  const handleSaveZone = async () => {
    if (!editingZone.nombre || !editingZone.tarifa) {
      toast({
        title: "Error",
        description: "Por favor completa el nombre y la tarifa de la zona",
        variant: "destructive"
      })
      return
    }

    if (selectedZone) {
      const updatedZones = zones.map(zone => 
        zone.id === selectedZone.id 
          ? { ...zone, ...editingZone }
          : zone
      )
      setZones(updatedZones)
      
      toast({
        title: "Zona actualizada",
        description: `Se ha actualizado la zona "${editingZone.nombre}"`,
        variant: "default"
      })
    }

    setSelectedZone(null)
    setEditingZone({})
  }

  // Eliminar zona
  const handleDeleteZone = async () => {
    if (!selectedZone) return

    const zoneName = selectedZone.nombre
    
    if (!confirm(`¿Estás seguro de eliminar la zona "${zoneName}"?\n\nEsta acción también la eliminará de la base de datos.`)) {
      return
    }

    try {
      setIsSaving(true)
      
      // Eliminar de la base de datos
      await deleteDeliveryZone(selectedZone.id)
      
      // Eliminar del estado local
      const updatedZones = zones.filter(zone => zone.id !== selectedZone.id)
      setZones(updatedZones)
      
      setSelectedZone(null)
      setEditingZone({})
      
      toast({
        title: "Zona eliminada",
        description: `Se ha eliminado la zona "${zoneName}" de la base de datos`,
        variant: "default"
      })
      
      console.log("V6: Zona eliminada:", selectedZone.id)
      
    } catch (error) {
      console.error("V6: Error eliminando zona:", error)
      toast({
        title: "Error",
        description: "No se pudo eliminar la zona de la base de datos",
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
      
      console.log("V6: Guardando todas las zonas:", zones)
      
      // Validar zonas
      const validZones = zones.filter(zone => 
        zone.nombre && 
        zone.tarifa && 
        zone.poligono && 
        zone.poligono.length >= 3
      )
      
      if (validZones.length === 0) {
        toast({
          title: "Error",
          description: "No hay zonas válidas para guardar",
          variant: "destructive"
        })
        return
      }
      
      if (validZones.length < zones.length) {
        toast({
          title: "Advertencia",
          description: `Se guardarán ${validZones.length} de ${zones.length} zonas (algunas tienen datos incompletos)`,
          variant: "default"
        })
      }
      
      // Guardar en la base de datos
      await saveDeliveryZones(validZones)
      
      // Notificar al componente padre
      onSaveZones(validZones)
      
      toast({
        title: "Zonas guardadas",
        description: `Se han guardado ${validZones.length} zonas en la base de datos`,
        variant: "default"
      })
      
      console.log("V6: Zonas guardadas exitosamente")
      
      // Cerrar el editor
      onClose()
      
    } catch (error) {
      console.error("V6: Error guardando zonas:", error)
      toast({
        title: "Error",
        description: "No se pudieron guardar las zonas en la base de datos",
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Renderizar zona en overlay
  const renderZoneOverlay = (zone: DeliveryZone) => {
    if (!mapLoaded || !zone.poligono || zone.poligono.length < 3) return null

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
            Editor de Zonas de Delivery - V6 SOLUCIÓN DEFINITIVA
            <Badge variant="outline" className="ml-2 bg-green-50 text-green-700">
              Sistema Híbrido + BD
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex h-[75vh] gap-4">
          {/* Mapa */}
          <div className="flex-1 relative">
            {/* Controles */}
            <div className="absolute top-2 right-2 z-30 flex gap-2">
              {!isDrawing ? (
                <Button 
                  onClick={startDrawing} 
                  className="bg-green-600 hover:bg-green-700 text-white"
                  disabled={isSaving}
                >
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
                  <strong>MODO DIBUJO:</strong> Haz clic en el mapa para agregar puntos
                  {drawingPoints.length > 0 && (
                    <span className="ml-2 bg-green-200 px-2 py-1 rounded">
                      {drawingPoints.length} puntos
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Panel de información mejorado */}
            <div className="absolute bottom-2 left-2 z-30 bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs max-w-72">
              <div><strong>Sistema:</strong> V6 - Coordinación Calibrada</div>
              <div><strong>Centro:</strong> {MAP_CENTER.lat}, {MAP_CENTER.lng}</div>
              <div><strong>Estado:</strong> 
                <span className={`ml-1 ${mapLoaded ? 'text-green-600' : 'text-orange-600'}`}>
                  {mapLoaded ? '✅ Cargado' : '⏳ Cargando'}
                </span>
              </div>
              <div><strong>Modo:</strong> {isDrawing ? '🟢 DIBUJO' : '🔴 NAVEGACIÓN'}</div>
              <div><strong>Zonas:</strong> {zones.length}</div>
              {drawingPoints.length > 0 && (
                <div><strong>Puntos:</strong> {drawingPoints.length}</div>
              )}
              <div className="text-[10px] mt-1 bg-white p-1 rounded">
                <div><strong>Bounds:</strong></div>
                <div>N: {calculateRealBounds().north}</div>
                <div>S: {calculateRealBounds().south}</div>
                <div>W: {calculateRealBounds().west}</div>
                <div>E: {calculateRealBounds().east}</div>
              </div>
            </div>

            {/* Contenedor del mapa */}
            <div ref={mapRef} className="w-full h-full border-2 border-gray-300 rounded-lg overflow-hidden relative">
              {/* Iframe de Google Maps */}
              <iframe
                ref={iframeRef}
                src={getMapUrl()}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                title="Mapa de Los Andes - V6"
              />

              {/* Overlay para polígonos */}
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
                            fill="rgba(59, 130, 246, 0.3)"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            strokeDasharray="5,5"
                          />
                        )}
                        
                        {/* Líneas de conexión */}
                        {drawingPoints.length > 1 && (
                          <polyline
                            points={drawingPoints.map(p => `${p.x},${p.y}`).join(" ")}
                            fill="none"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            strokeDasharray="3,3"
                          />
                        )}
                        
                        {/* Puntos de dibujo */}
                        {drawingPoints.map((point, i) => (
                          <g key={i}>
                            <circle
                              cx={point.x}
                              cy={point.y}
                              r={5}
                              fill="#3b82f6"
                              stroke="white"
                              strokeWidth={2}
                            />
                            <text
                              x={point.x + 8}
                              y={point.y + 4}
                              fontSize="10"
                              fill="#3b82f6"
                              fontWeight="bold"
                            >
                              {i + 1}
                            </text>
                          </g>
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
                    <p className="text-gray-600">Cargando mapa V6...</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Panel lateral con scroll */}
          <div className="w-80 flex flex-col h-full">
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {/* Lista de zonas */}
              <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  Zonas de Delivery ({zones.length})
                  {isSaving && (
                    <div className="ml-2 animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  )}
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
                        {zone.poligono.length} puntos • V6
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

            {/* Botones de acción fijos en la parte inferior */}
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

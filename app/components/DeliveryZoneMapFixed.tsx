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
import { Trash2, Save, Plus, X, MapPin, Target, AlertCircle, Crosshair } from "lucide-react"
import { type DeliveryZone } from "../../lib/delivery-zones"
import { saveDeliveryZones, deleteDeliveryZone } from "../../lib/delivery-zones-service"
import { toast } from "@/hooks/use-toast"

interface DeliveryZoneMapProps {
  isOpen: boolean
  onClose: () => void
  onSaveZones: (zones: DeliveryZone[]) => void
  initialZones?: DeliveryZone[]
}

// SISTEMA DE COORDENADAS FIJO Y ABSOLUTO PARA LOS ANDES, CHILE
const COORDINATE_SYSTEM = {
  // Centro fijo de Los Andes, Chile
  CENTER: { lat: -32.8347, lng: -70.5983 },
  
  // Área geográfica FIJA (NUNCA cambia)
  BOUNDS: {
    NORTH: -32.8200,
    SOUTH: -32.8500, 
    WEST: -70.6150,
    EAST: -70.5800
  },
  
  // Dimensiones del canvas FIJAS
  CANVAS: {
    WIDTH: 800,
    HEIGHT: 600
  },
  
  // Zoom level FIJO
  ZOOM: 15
}

export default function DeliveryZoneMapFixed({ isOpen, onClose, onSaveZones, initialZones }: DeliveryZoneMapProps) {
  // Estados
  const [zones, setZones] = useState<DeliveryZone[]>([])
  const [selectedZone, setSelectedZone] = useState<DeliveryZone | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawingPoints, setDrawingPoints] = useState<{ lat: number; lng: number }[]>([])
  const [editingZone, setEditingZone] = useState<Partial<DeliveryZone>>({})
  const [visibleZones, setVisibleZones] = useState<Set<string>>(new Set())
  const [mapLoaded, setMapLoaded] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Referencias
  const mapRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // CONVERSIÓN DE COORDENADAS CON SISTEMA FIJO
  const convertGeoToPixel = useCallback((lat: number, lng: number) => {
    const { BOUNDS, CANVAS } = COORDINATE_SYSTEM
    
    // Log para debugging
    console.log("🔄 Convirtiendo coordenadas:", { lat, lng })
    
    // Validar que las coordenadas estén en el rango esperado
    if (lat > BOUNDS.NORTH || lat < BOUNDS.SOUTH || lng < BOUNDS.WEST || lng > BOUNDS.EAST) {
      console.warn("⚠️ Coordenadas fuera del rango:", { lat, lng, bounds: BOUNDS })
    }
    
    // Cálculo de conversión usando las dimensiones FIJAS
    const x = ((lng - BOUNDS.WEST) / (BOUNDS.EAST - BOUNDS.WEST)) * CANVAS.WIDTH
    const y = ((BOUNDS.NORTH - lat) / (BOUNDS.NORTH - BOUNDS.SOUTH)) * CANVAS.HEIGHT
    
    // Asegurar que esté dentro del canvas
    const pixelX = Math.max(0, Math.min(CANVAS.WIDTH, Math.round(x)))
    const pixelY = Math.max(0, Math.min(CANVAS.HEIGHT, Math.round(y)))
    
    console.log("📍 Resultado conversión:", { 
      geo: { lat, lng }, 
      pixel: { x: pixelX, y: pixelY },
      bounds: BOUNDS,
      canvas: CANVAS
    })
    
    return { x: pixelX, y: pixelY }
  }, [])

  const convertPixelToGeo = useCallback((x: number, y: number) => {
    const { BOUNDS, CANVAS } = COORDINATE_SYSTEM
    
    // Conversión inversa con precisión
    const lng = BOUNDS.WEST + (x / CANVAS.WIDTH) * (BOUNDS.EAST - BOUNDS.WEST)
    const lat = BOUNDS.NORTH - (y / CANVAS.HEIGHT) * (BOUNDS.NORTH - BOUNDS.SOUTH)
    
    // Redondear para mantener precisión consistente (6 decimales)
    const preciseLat = Math.round(lat * 1000000) / 1000000
    const preciseLng = Math.round(lng * 1000000) / 1000000
    
    console.log("🎯 Click convertido:", {
      pixel: { x, y },
      geo: { lat: preciseLat, lng: preciseLng }
    })
    
    return { lat: preciseLat, lng: preciseLng }
  }, [])

  // URL del mapa FIJA
  const getFixedMapUrl = useCallback(() => {
    const { CENTER, ZOOM } = COORDINATE_SYSTEM
    const { BOUNDS } = COORDINATE_SYSTEM
    
    return `https://www.openstreetmap.org/export/embed.html?bbox=${BOUNDS.WEST},${BOUNDS.SOUTH},${BOUNDS.EAST},${BOUNDS.NORTH}&layer=mapnik&marker=${CENTER.lat},${CENTER.lng}`
  }, [])

  // Inicialización FIJA
  useEffect(() => {
    if (isOpen) {
      console.log("🚀 INICIALIZANDO SISTEMA DE COORDENADAS FIJO")
      console.log("📊 Sistema:", COORDINATE_SYSTEM)
      
      // Cargar zonas iniciales y procesar coordenadas
      const initialZonesList = initialZones ? [...initialZones] : []
      
      // Validar y mostrar coordenadas de zonas existentes
      initialZonesList.forEach((zone, index) => {
        console.log(`🗺️ Zona ${index + 1}: "${zone.nombre}"`)
        
        if (zone.poligono && zone.poligono.length > 0) {
          zone.poligono.forEach((point, pointIndex) => {
            let lat: number, lng: number
            
            if (Array.isArray(point)) {
              [lat, lng] = point
            } else if (typeof point === 'object' && 'lat' in point && 'lng' in point) {
              lat = point.lat
              lng = point.lng
            } else {
              console.error("❌ Formato de punto inválido:", point)
              return
            }
            
            // Convertir a píxeles para verificar
            const pixel = convertGeoToPixel(lat, lng)
            console.log(`   Punto ${pointIndex + 1}: lat=${lat}, lng=${lng} → x=${pixel.x}, y=${pixel.y}`)
          })
        }
      })
      
      setZones(initialZonesList)
      setVisibleZones(new Set(initialZonesList.map(zone => zone.id)))
      
      // Reset otros estados
      setSelectedZone(null)
      setEditingZone({})
      setIsDrawing(false)
      setDrawingPoints([])
      setMapLoaded(false)

      // Cargar mapa
      setTimeout(() => {
        setMapLoaded(true)
        console.log("✅ Mapa cargado con sistema de coordenadas fijo")
      }, 1000)
    }
  }, [isOpen, initialZones, convertGeoToPixel])

  // MANEJO DE CLICS CON SISTEMA FIJO
  const handleMapClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !mapLoaded) return

    const rect = event.currentTarget.getBoundingClientRect()
    
    // Calcular posición relativa al canvas
    const clickX = event.clientX - rect.left
    const clickY = event.clientY - rect.top
    
    // Normalizar a las dimensiones del sistema fijo
    const normalizedX = (clickX / rect.width) * COORDINATE_SYSTEM.CANVAS.WIDTH
    const normalizedY = (clickY / rect.height) * COORDINATE_SYSTEM.CANVAS.HEIGHT
    
    // Convertir a coordenadas geográficas
    const geoPoint = convertPixelToGeo(normalizedX, normalizedY)
    
    console.log("🎯 CLICK PROCESADO:", {
      raw: { x: Math.round(clickX), y: Math.round(clickY) },
      normalized: { x: Math.round(normalizedX), y: Math.round(normalizedY) },
      geo: geoPoint
    })
    
    setDrawingPoints(prev => {
      const updated = [...prev, geoPoint]
      console.log(`📍 Total puntos: ${updated.length}`)
      return updated
    })
  }, [isDrawing, mapLoaded, convertPixelToGeo])

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
    console.log("🎨 INICIANDO DIBUJO")
  }

  // Finalizar dibujo con PRESERVACIÓN EXACTA de coordenadas
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

      // PRESERVAR EXACTAMENTE las coordenadas como [lat, lng]
      const exactPolygon = drawingPoints.map(p => [p.lat, p.lng] as [number, number])
      
      const newZone: DeliveryZone = {
        id: `zona-${Date.now()}`,
        nombre: editingZone.nombre,
        poligono: exactPolygon,  // EXACTAMENTE como se creó
        tarifa: editingZone.tarifa,
        disponible: editingZone.disponible ?? true,
        tiempoEstimado: editingZone.tiempoEstimado || "30-40 min",
        color: editingZone.color || "#3B82F6",
        descripcion: editingZone.descripcion || "Nueva zona de delivery"
      }

      console.log("💾 GUARDANDO ZONA CON COORDENADAS EXACTAS:")
      console.log("📋 Zona:", newZone.nombre)
      console.log("📍 Polígono exacto:", newZone.poligono)
      
      // Verificar conversión de vuelta
      newZone.poligono.forEach((point, i) => {
        const [lat, lng] = point
        const pixel = convertGeoToPixel(lat, lng)
        console.log(`   Punto ${i + 1}: [${lat}, ${lng}] → pixel [${pixel.x}, ${pixel.y}]`)
      })

      // Guardar en Firestore
      const allZones = [...zones, newZone]
      await saveDeliveryZones(allZones)

      // Actualizar estado
      setZones(allZones)
      setVisibleZones(prev => new Set([...prev, newZone.id]))
      setSelectedZone(newZone)
      setIsDrawing(false)
      setDrawingPoints([])
      
      toast({
        title: "✅ Zona creada",
        description: `"${newZone.nombre}" guardada con coordenadas exactas`,
        variant: "default"
      })

      // NO RECARGAR LA PÁGINA - mantener estado actual
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

  // Toggle visibilidad
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

  // Guardar zona editada
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
        description: `"${editingZone.nombre}" actualizada correctamente`,
        variant: "default"
      })
      
      onSaveZones(updatedZones)
      
    } catch (error) {
      console.error("Error actualizando zona:", error)
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

  // Eliminar zona
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
        description: `"${zoneName}" eliminada correctamente`,
        variant: "default"
      })
      
      onSaveZones(updatedZones)
      
    } catch (error) {
      console.error("Error eliminando zona:", error)
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
        description: `${zones.length} zonas guardadas con coordenadas exactas`,
        variant: "default"
      })
      
      onClose()
      
    } catch (error) {
      console.error("Error guardando zonas:", error)
      toast({
        title: "Error",
        description: "No se pudieron guardar las zonas",
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }

  // RENDERIZAR ZONA CON COORDENADAS EXACTAS
  const renderZoneWithExactCoordinates = useCallback((zone: DeliveryZone) => {
    if (!mapLoaded || !zone.poligono || zone.poligono.length < 3) {
      console.warn(`⚠️ No se puede renderizar zona "${zone.nombre}":`, {
        mapLoaded,
        poligono: zone.poligono?.length || 0
      })
      return null
    }
    
    if (!visibleZones.has(zone.id)) return null

    console.log(`🎨 RENDERIZANDO ZONA "${zone.nombre}":`)
    
    // Convertir EXACTAMENTE las coordenadas guardadas
    const pixelPoints = zone.poligono.map((point, index) => {
      let lat: number, lng: number
      
      if (Array.isArray(point)) {
        [lat, lng] = point
      } else if (typeof point === 'object' && 'lat' in point && 'lng' in point) {
        lat = point.lat
        lng = point.lng
      } else {
        console.error(`❌ Punto inválido en zona "${zone.nombre}":`, point)
        return { x: 0, y: 0 }
      }

      const pixel = convertGeoToPixel(lat, lng)
      console.log(`   Punto ${index + 1}: [${lat}, ${lng}] → [${pixel.x}, ${pixel.y}]`)
      
      return pixel
    })

    const pathString = pixelPoints.map(p => `${p.x},${p.y}`).join(" ")
    console.log(`   Path SVG: "${pathString}"`)

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
  }, [mapLoaded, selectedZone, convertGeoToPixel, visibleZones])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <MapPin className="w-5 h-5 mr-2 text-pink-600" />
            Editor de Zonas - Sistema de Coordenadas Fijo
            <Badge variant="outline" className="ml-2 bg-green-50 text-green-700">
              🔒 Coordenadas Exactas
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex h-[75vh] gap-4">
          {/* Mapa */}
          <div className="flex-1 relative">
            {/* Información del sistema */}
            <div className="absolute top-2 left-2 z-30 bg-green-100 rounded-lg border border-green-200 p-3 shadow-sm">
              <div className="text-xs font-semibold mb-2 flex items-center">
                <Crosshair className="w-4 h-4 mr-1" />
                Sistema Fijo
              </div>
              <div className="text-xs text-green-800 space-y-1">
                <div><strong>Centro:</strong> {COORDINATE_SYSTEM.CENTER.lat}, {COORDINATE_SYSTEM.CENTER.lng}</div>
                <div><strong>Canvas:</strong> {COORDINATE_SYSTEM.CANVAS.WIDTH}x{COORDINATE_SYSTEM.CANVAS.HEIGHT}</div>
                <div><strong>Zonas:</strong> {zones.length}</div>
                <div className="text-green-600 font-semibold">🔒 Coordenadas Exactas</div>
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
              <div className="absolute top-14 left-2 right-2 z-30 bg-blue-100 border-2 border-blue-400 rounded-lg p-3 text-sm shadow-lg">
                <div className="flex items-center justify-center text-blue-800">
                  <Target className="w-5 h-5 mr-2 animate-pulse" />
                  <strong>🎯 MODO DIBUJO:</strong> Sistema de coordenadas fijo activo
                  {drawingPoints.length > 0 && (
                    <span className="ml-2 bg-blue-200 px-2 py-1 rounded">
                      {drawingPoints.length} puntos
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Contenedor del mapa */}
            <div className="w-full h-full border-2 border-gray-300 rounded-lg overflow-hidden relative">
              <iframe
                src={getFixedMapUrl()}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                title="Mapa Fijo Los Andes - Coordenadas Exactas"
              />

              {/* Overlay con sistema fijo */}
              {mapLoaded && (
                <div
                  ref={overlayRef}
                  className={`absolute inset-0 ${isDrawing ? 'pointer-events-auto cursor-crosshair' : 'pointer-events-none'}`}
                  onClick={handleMapClick}
                  style={{ 
                    backgroundColor: isDrawing ? "rgba(0,255,0,0.05)" : "transparent",
                    zIndex: isDrawing ? 10 : 5
                  }}
                >
                  <svg
                    width="100%"
                    height="100%"
                    className="absolute inset-0 w-full h-full"
                    viewBox={`0 0 ${COORDINATE_SYSTEM.CANVAS.WIDTH} ${COORDINATE_SYSTEM.CANVAS.HEIGHT}`}
                    style={{ pointerEvents: isDrawing ? 'auto' : 'none' }}
                  >
                    {/* Zonas con coordenadas exactas */}
                    {zones.map(zone => (
                      <g key={zone.id} style={{ pointerEvents: 'auto' }}>
                        {renderZoneWithExactCoordinates(zone)}
                      </g>
                    ))}

                    {/* Polígono en construcción */}
                    {isDrawing && drawingPoints.length > 0 && (
                      <g>
                        {(() => {
                          const pixelPoints = drawingPoints.map(point => convertGeoToPixel(point.lat, point.lng))
                          
                          return (
                            <>
                              {pixelPoints.length > 2 && (
                                <polygon
                                  points={pixelPoints.map(p => `${p.x},${p.y}`).join(" ")}
                                  fill="rgba(59, 130, 246, 0.3)"
                                  stroke="#3b82f6"
                                  strokeWidth={3}
                                  strokeDasharray="5,5"
                                />
                              )}
                              
                              {pixelPoints.length > 1 && (
                                <polyline
                                  points={pixelPoints.map(p => `${p.x},${p.y}`).join(" ")}
                                  fill="none"
                                  stroke="#3b82f6"
                                  strokeWidth={3}
                                  strokeDasharray="3,3"
                                />
                              )}
                              
                              {pixelPoints.map((point, i) => (
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
                    <p className="text-gray-600">Cargando Sistema Fijo...</p>
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
                    <span>Zonas Exactas ({zones.length})</span>
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
                      <p className="text-xs">Crea zonas con coordenadas exactas</p>
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
                              🔒 {zone.poligono.length} puntos exactos
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

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
import { Trash2, Save, Plus, X, MapPin, Target, AlertCircle, RotateCw } from "lucide-react"
import { type DeliveryZone } from "../../lib/delivery-zones"
import { saveDeliveryZones, deleteDeliveryZone } from "../../lib/delivery-zones-service"
import { toast } from "@/hooks/use-toast"

interface DeliveryZoneMapProps {
  isOpen: boolean
  onClose: () => void
  onSaveZones: (zones: DeliveryZone[]) => void
  initialZones?: DeliveryZone[]
}

export default function DeliveryZoneMapV9({ isOpen, onClose, onSaveZones, initialZones }: DeliveryZoneMapProps) {
  // Constantes iniciales
  const INITIAL_CENTER = { lat: -32.8347, lng: -70.5983 }
  const INITIAL_ZOOM = 15
  
  // Estados principales
  const [zones, setZones] = useState<DeliveryZone[]>([])
  const [selectedZone, setSelectedZone] = useState<DeliveryZone | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawingPoints, setDrawingPoints] = useState<{ lat: number; lng: number }[]>([])
  const [editingZone, setEditingZone] = useState<Partial<DeliveryZone>>({})
  const [visibleZones, setVisibleZones] = useState<Set<string>>(new Set()) // IDs de zonas visibles
  
  // Estados del mapa
  const [mapLoaded, setMapLoaded] = useState(false)
  const [drawingMode, setDrawingMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [mapKey, setMapKey] = useState(0) // Para forzar re-renderizado del mapa
  const [lastMapUpdate, setLastMapUpdate] = useState(0)
  const [currentMapBounds, setCurrentMapBounds] = useState({
    north: -32.820,
    south: -32.850,
    west: -70.610,
    east: -70.580
  })
  const [mapCenter, setMapCenter] = useState(INITIAL_CENTER)
  const [mapZoom, setMapZoom] = useState(INITIAL_ZOOM)
  
  // Referencias
  const mapRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Dimensiones del mapa
  const MAP_WIDTH = 800
  const MAP_HEIGHT = 600

  // SISTEMA DE COORDENADAS DINÁMICO - BOUNDS BASADOS EN VISTA ACTUAL
  const calculateCurrentBounds = useCallback(() => {
    // Usar los bounds actuales del mapa en lugar de valores fijos
    return currentMapBounds
  }, [currentMapBounds])

  // Función para actualizar los bounds del mapa basado en el centro y zoom actuales
  const updateMapBounds = useCallback((center: {lat: number, lng: number}, zoom: number) => {
    // Calcular bounds dinámicos basados en el zoom y centro actuales
    const zoomFactor = Math.pow(2, zoom - 14) // Factor relativo al zoom base 14
    const baseLatSpan = 0.030 // Span base en latitud
    const baseLngSpan = 0.030 // Span base en longitud
    
    const latSpan = baseLatSpan / zoomFactor
    const lngSpan = baseLngSpan / zoomFactor
    
    const newBounds = {
      north: center.lat + latSpan / 2,
      south: center.lat - latSpan / 2,
      west: center.lng - lngSpan / 2,
      east: center.lng + lngSpan / 2
    }
    
    setCurrentMapBounds(newBounds)
    console.log("V9: Bounds actualizados:", newBounds)
    return newBounds
  }, [])

  // Función para calcular el centro óptimo para mostrar todas las zonas visibles
  const calculateOptimalCenter = useCallback(() => {
    const visibleZonesList = zones.filter(zone => visibleZones.has(zone.id))
    
    if (visibleZonesList.length === 0) {
      return INITIAL_CENTER
    }

    // Calcular bounds que contengan todas las zonas visibles
    let minLat = Infinity, maxLat = -Infinity
    let minLng = Infinity, maxLng = -Infinity

    visibleZonesList.forEach(zone => {
      zone.poligono.forEach(point => {
        let lat: number, lng: number
        if (Array.isArray(point)) {
          [lat, lng] = point
        } else if (typeof point === 'object' && 'lat' in point && 'lng' in point) {
          lat = point.lat
          lng = point.lng
        } else {
          return
        }

        minLat = Math.min(minLat, lat)
        maxLat = Math.max(maxLat, lat)
        minLng = Math.min(minLng, lng)
        maxLng = Math.max(maxLng, lng)
      })
    })

    // Centro óptimo
    const centerLat = (minLat + maxLat) / 2
    const centerLng = (minLng + maxLng) / 2

    return { lat: centerLat, lng: centerLng }
  }, [zones, visibleZones, INITIAL_CENTER])

  // CONVERSIÓN DE COORDENADAS DINÁMICA (SE ADAPTA A LA VISTA ACTUAL)
  const geoToPixel = useCallback((lat: number, lng: number) => {
    const bounds = calculateCurrentBounds()
    
    const x = ((lng - bounds.west) / (bounds.east - bounds.west)) * MAP_WIDTH
    const y = ((bounds.north - lat) / (bounds.north - bounds.south)) * MAP_HEIGHT

    return { 
      x: Math.max(0, Math.min(MAP_WIDTH, x)), 
      y: Math.max(0, Math.min(MAP_HEIGHT, y)) 
    }
  }, [calculateCurrentBounds])

  const pixelToGeo = useCallback((x: number, y: number) => {
    const bounds = calculateCurrentBounds()
    
    const lng = bounds.west + (x / MAP_WIDTH) * (bounds.east - bounds.west)
    const lat = bounds.north - (y / MAP_HEIGHT) * (bounds.north - bounds.south)

    return { lat, lng }
  }, [calculateCurrentBounds])

  // URL del mapa con parámetros dinámicos actuales
  const getMapUrl = useCallback(() => {
    return `https://maps.google.com/maps?q=${mapCenter.lat},${mapCenter.lng}&t=roadmap&z=${mapZoom}&output=embed&iwloc=near&hl=es&key=${mapKey}`
  }, [mapCenter, mapZoom, mapKey])

  // Actualizar vista del mapa
  const updateMapView = useCallback((newCenter: {lat: number, lng: number}, newZoom?: number) => {
    const zoom = newZoom || mapZoom
    setMapCenter(newCenter)
    setMapZoom(zoom)
    updateMapBounds(newCenter, zoom)
    console.log("V9: Vista actualizada - Centro:", newCenter, "Zoom:", zoom)
  }, [mapZoom, updateMapBounds])

  // Forzar actualización del mapa
  const forceMapUpdate = useCallback(() => {
    setMapKey(prev => prev + 1)
    setLastMapUpdate(Date.now())
    console.log("V9: Mapa actualizado con vista actual")
  }, [])

  // Auto-actualización del mapa DESACTIVADA - solo manual
  useEffect(() => {
    if (!mapLoaded || !isOpen) return

    // NO hay auto-actualización para evitar parpadeo
    // Solo actualización manual con el botón

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current)
      }
    }
  }, [mapLoaded, isOpen, forceMapUpdate])

  // Inicializar zonas
  useEffect(() => {
    if (isOpen) {
      console.log("V9: Inicializando con sistema de coordenadas dinámico...")
      const initialZonesList = initialZones ? [...initialZones] : []
      setZones(initialZonesList)
      
      // Hacer todas las zonas visibles por defecto
      const allZoneIds = new Set(initialZonesList.map(zone => zone.id))
      setVisibleZones(allZoneIds)
      
      setMapLoaded(false)
      setSelectedZone(null)
      setEditingZone({})
      setIsDrawing(false)
      setDrawingMode(false)
      setDrawingPoints([])
      setMapKey(0)
      setLastMapUpdate(0)
      
      // Resetear vista del mapa al centro inicial
      setMapCenter(INITIAL_CENTER)
      setMapZoom(INITIAL_ZOOM)
      updateMapBounds(INITIAL_CENTER, INITIAL_ZOOM)
    }
  }, [isOpen, initialZones, updateMapBounds])

  // Cargar mapa
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        setMapLoaded(true)
        console.log("V9: Mapa cargado - Sistema de coordenadas fijas activado")
      }, 1500) // Reducido a 1.5 segundos

      return () => clearTimeout(timer)
    }
  }, [isOpen, mapKey]) // Agregado mapKey para recargar después de updates

  // Manejo de clics en overlay - COORDENADAS GEOGRÁFICAS ABSOLUTAS
  const handleOverlayClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !mapLoaded) return

    const rect = event.currentTarget.getBoundingClientRect()
    
    // Coordenadas relativas al overlay
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    
    // Normalizar al tamaño del sistema de coordenadas
    const normalizedX = (x / rect.width) * MAP_WIDTH
    const normalizedY = (y / rect.height) * MAP_HEIGHT
    
    // Convertir directamente a coordenadas geográficas ABSOLUTAS
    const geo = pixelToGeo(normalizedX, normalizedY)
    
    setDrawingPoints(prev => {
      const updated = [...prev, geo]
      console.log(`V9: Punto geográfico ${updated.length}:`, {
        click: { x, y },
        normalized: { x: normalizedX, y: normalizedY },
        geo,
        bounds: calculateCurrentBounds(),
        mapCenter,
        mapZoom
      })
      return updated
    })
  }, [isDrawing, mapLoaded, pixelToGeo, calculateCurrentBounds, mapCenter, mapZoom])

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
    console.log("V9: Iniciando modo dibujo con coordenadas dinámicas - Vista actual:", mapCenter, mapZoom)
  }

  // Finalizar dibujo y guardar
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

      console.log("V9: Guardando zona con coordenadas geográficas dinámicas:", newZone, "Vista:", mapCenter, mapZoom)

      // Guardar en la base de datos
      await saveDeliveryZones([...zones, newZone])

      // Actualizar estado local
      const updatedZones = [...zones, newZone]
      setZones(updatedZones)
      
      // Hacer visible la nueva zona
      setVisibleZones(prev => new Set([...prev, newZone.id]))
      
      setSelectedZone(newZone)
      setIsDrawing(false)
      setDrawingMode(false)
      setDrawingPoints([])
      
      // IMPORTANTE: Forzar re-renderizado del mapa para evitar quedarse en "cargando"
      setTimeout(() => {
        forceMapUpdate()
      }, 500)
      
      toast({
        title: "Zona creada con coordenadas fijas",
        description: `"${newZone.nombre}" mantendrá su posición geográfica al mover el mapa`,
        variant: "default"
      })

      // Notificar al componente padre
      onSaveZones(updatedZones)

    } catch (error) {
      console.error("V9: Error creando zona:", error)
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

  // Función para centrar el mapa en una zona específica
  const centerOnZone = useCallback((zone: DeliveryZone) => {
    if (!zone.poligono || zone.poligono.length === 0) return

    // Calcular el centro de la zona
    let sumLat = 0, sumLng = 0
    let pointCount = 0

    zone.poligono.forEach(point => {
      let lat: number, lng: number
      if (Array.isArray(point)) {
        [lat, lng] = point
      } else if (typeof point === 'object' && 'lat' in point && 'lng' in point) {
        lat = point.lat
        lng = point.lng
      } else {
        return
      }

      sumLat += lat
      sumLng += lng
      pointCount++
    })

    if (pointCount > 0) {
      const zoneCenter = {
        lat: sumLat / pointCount,
        lng: sumLng / pointCount
      }
      
      updateMapView(zoneCenter, mapZoom)
      console.log("V9: Centrando en zona:", zone.nombre, zoneCenter)
    }
  }, [updateMapView, mapZoom])

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
        console.error("V9: Error actualizando zona:", error)
        toast({
          title: "Error",
          description: "No se pudo actualizar la zona",
          variant: "destructive"
        })
      } finally {
        setIsSaving(false)
      }
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
      
      await deleteDeliveryZone(selectedZone.id)
      
      const updatedZones = zones.filter(zone => zone.id !== selectedZone.id)
      setZones(updatedZones)
      
      setSelectedZone(null)
      setEditingZone({})
      
      toast({
        title: "Zona eliminada",
        description: `Se ha eliminado la zona "${zoneName}" de la base de datos`,
        variant: "default"
      })
      
      onSaveZones(updatedZones)
      
    } catch (error) {
      console.error("V9: Error eliminando zona:", error)
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
        title: "Zonas guardadas con posición fija",
        description: `${zones.length} zonas guardadas. Mantendrán su ubicación geográfica.`,
        variant: "default"
      })
      
      onClose()
      
    } catch (error) {
      console.error("V9: Error guardando zonas:", error)
      toast({
        title: "Error",
        description: "No se pudieron guardar las zonas en la base de datos",
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Renderizar zona en overlay - RECALCULO AUTOMÁTICO + VISIBILIDAD
  const renderZoneOverlay = useCallback((zone: DeliveryZone) => {
    if (!mapLoaded || !zone.poligono || zone.poligono.length < 3) return null
    
    // Solo renderizar si la zona es visible
    if (!visibleZones.has(zone.id)) return null

    // Convertir coordenadas geográficas a pixels usando sistema fijo
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
  }, [mapLoaded, selectedZone, geoToPixel, visibleZones])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <MapPin className="w-5 h-5 mr-2 text-pink-600" />
            Editor de Zonas de Delivery
            <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-700">
              Vista Ajustable
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex h-[75vh] gap-4">
          {/* Mapa */}
          <div className="flex-1 relative">
            {/* Controles */}
            <div className="absolute top-2 right-2 z-30 flex gap-2">
              <Button 
                onClick={forceMapUpdate}
                variant="outline"
                size="sm"
                className="bg-yellow-50 border-yellow-200 text-yellow-800"
                disabled={isSaving}
                title="Actualizar vista del mapa"
              >
                <RotateCw className="w-4 h-4 mr-1" />
                Actualizar
              </Button>
              
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

            {/* Controles de vista del mapa */}
            <div className="absolute top-2 left-2 z-30 bg-white rounded-lg border border-gray-200 p-2 shadow-sm">
              <div className="text-xs font-semibold mb-2">Vista del Mapa</div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs w-8">Lat:</label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={mapCenter.lat}
                    onChange={(e) => updateMapView({...mapCenter, lat: parseFloat(e.target.value) || mapCenter.lat})}
                    className="h-6 text-xs w-20"
                    disabled={isSaving}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs w-8">Lng:</label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={mapCenter.lng}
                    onChange={(e) => updateMapView({...mapCenter, lng: parseFloat(e.target.value) || mapCenter.lng})}
                    className="h-6 text-xs w-20"
                    disabled={isSaving}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs w-8">Zoom:</label>
                  <Input
                    type="number"
                    min="10"
                    max="18"
                    value={mapZoom}
                    onChange={(e) => updateMapView(mapCenter, parseInt(e.target.value) || mapZoom)}
                    className="h-6 text-xs w-16"
                    disabled={isSaving}
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateMapView(INITIAL_CENTER, INITIAL_ZOOM)}
                  className="w-full h-6 text-xs"
                  disabled={isSaving}
                >
                  Reset
                </Button>
              </div>
            </div>

            {/* Indicador de modo */}
            {drawingMode && (
              <div className="absolute top-14 left-2 right-2 z-30 bg-green-100 border-2 border-green-400 rounded-lg p-3 text-sm shadow-lg">
                <div className="flex items-center justify-center text-green-800">
                  <Target className="w-5 h-5 mr-2 animate-pulse" />
                  <strong>MODO DIBUJO:</strong> Ajusta la vista del mapa y dibuja en la ubicación correcta
                  {drawingPoints.length > 0 && (
                    <span className="ml-2 bg-green-200 px-2 py-1 rounded">
                      {drawingPoints.length} puntos
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Contenedor del mapa */}
            <div className="w-full h-full border-2 border-gray-300 rounded-lg overflow-hidden relative">
              {/* Iframe de Google Maps - SE ACTUALIZA PERO MANTIENE MISMA VISTA */}
              <iframe
                ref={iframeRef}
                key={mapKey} // Esto fuerza re-renderizado
                src={getMapUrl()}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                title={`Mapa de Los Andes V9 - Update ${mapKey}`}
              />

              {/* Overlay para polígonos - SE RECALCULA AUTOMÁTICAMENTE */}
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
                    {/* Zonas existentes - SE RECALCULAN EN CADA RENDER */}
                    {zones.map(zone => (
                      <g key={`${zone.id}-${mapKey}`} style={{ pointerEvents: 'auto' }}>
                        {renderZoneOverlay(zone)}
                      </g>
                    ))}

                    {/* Polígono en construcción */}
                    {isDrawing && drawingPoints.length > 0 && (
                      <g>
                        {/* Convertir puntos de dibujo a pixels */}
                        {(() => {
                          const pixelPoints = drawingPoints.map(point => geoToPixel(point.lat, point.lng))
                          
                          return (
                            <>
                              {/* Polígono temporal */}
                              {pixelPoints.length > 2 && (
                                <polygon
                                  points={pixelPoints.map(p => `${p.x},${p.y}`).join(" ")}
                                  fill="rgba(59, 130, 246, 0.3)"
                                  stroke="#3b82f6"
                                  strokeWidth={2}
                                  strokeDasharray="5,5"
                                />
                              )}
                              
                              {/* Líneas de conexión */}
                              {pixelPoints.length > 1 && (
                                <polyline
                                  points={pixelPoints.map(p => `${p.x},${p.y}`).join(" ")}
                                  fill="none"
                                  stroke="#3b82f6"
                                  strokeWidth={2}
                                  strokeDasharray="3,3"
                                />
                              )}
                              
                              {/* Puntos de dibujo */}
                              {pixelPoints.map((point, i) => (
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
                    <p className="text-gray-600">Cargando sistema V9 de coordenadas fijas...</p>
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
                            Mostrar Todas
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setVisibleZones(new Set())}
                            className="text-xs h-6 px-2"
                          >
                            Ocultar Todas
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const optimalCenter = calculateOptimalCenter()
                              updateMapView(optimalCenter, mapZoom)
                            }}
                            className="text-xs h-6 px-2 bg-blue-50"
                            title="Centrar en zonas visibles"
                          >
                            🎯 Centrar
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
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              centerOnZone(zone)
                            }}
                            className="text-xs h-6 px-2 flex-shrink-0"
                            title="Centrar mapa en esta zona"
                          >
                            📍
                          </Button>
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

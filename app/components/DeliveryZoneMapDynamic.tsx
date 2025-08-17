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
import { Trash2, Save, Plus, X, MapPin, Target, AlertCircle, Navigation } from "lucide-react"
import { type DeliveryZone } from "../../lib/delivery-zones"
import { saveDeliveryZones, deleteDeliveryZone } from "../../lib/delivery-zones-service"
import { toast } from "@/hooks/use-toast"

interface DeliveryZoneMapProps {
  isOpen: boolean
  onClose: () => void
  onSaveZones: (zones: DeliveryZone[]) => void
  initialZones?: DeliveryZone[]
}

// CONFIGURACIÓN DEL MAPA BASE PARA LOS ANDES, CHILE
const MAP_BASE_CONFIG = {
  // Área inicial del mapa (bbox base)
  initialBbox: {
    west: -70.6050,
    south: -32.8450,
    east: -70.5850,
    north: -32.8250
  },
  
  // Centro del mapa
  center: { lat: -32.8347, lng: -70.5983 },
  
  // Dimensiones del iframe
  width: 800,
  height: 600
}

// PUNTO CON COORDENADAS GEOGRÁFICAS REALES
interface GeoPoint {
  lat: number  // Latitud real del mapa
  lng: number  // Longitud real del mapa
  x: number    // Posición en píxeles para renderizado
  y: number    // Posición en píxeles para renderizado
}

export default function DeliveryZoneMapDynamic({ isOpen, onClose, onSaveZones, initialZones }: DeliveryZoneMapProps) {
  // Estados
  const [zones, setZones] = useState<DeliveryZone[]>([])
  const [selectedZone, setSelectedZone] = useState<DeliveryZone | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawingPoints, setDrawingPoints] = useState<GeoPoint[]>([])
  const [editingZone, setEditingZone] = useState<Partial<DeliveryZone>>({})
  const [visibleZones, setVisibleZones] = useState<Set<string>>(new Set())
  const [mapLoaded, setMapLoaded] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  // ESTADO PARA BOUNDS DINÁMICOS DEL MAPA
  const [mapBounds, setMapBounds] = useState(MAP_BASE_CONFIG.initialBbox)
  const [isMapMoving, setIsMapMoving] = useState(false)
  const [lastBoundsUpdate, setLastBoundsUpdate] = useState(Date.now())

  // Referencias
  const containerRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  
  // POLLING PARA DETECTAR CAMBIOS EN EL MAPA
  const boundCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // FUNCIÓN PRINCIPAL: CONVERTIR CLIC A COORDENADAS GEOGRÁFICAS REALES
  const clickToRealCoordinates = useCallback((clientX: number, clientY: number, rect: DOMRect): GeoPoint => {
    // Posición relativa dentro del iframe
    const relativeX = (clientX - rect.left) / rect.width
    const relativeY = (clientY - rect.top) / rect.height
    
    // Convertir a coordenadas geográficas REALES usando el bbox actual del mapa
    const lng = mapBounds.west + (relativeX * (mapBounds.east - mapBounds.west))
    const lat = mapBounds.north - (relativeY * (mapBounds.north - mapBounds.south))
    
    // Posición en píxeles para renderizado
    const pixelX = relativeX * MAP_BASE_CONFIG.width
    const pixelY = relativeY * MAP_BASE_CONFIG.height
    
    const result: GeoPoint = {
      lat: parseFloat(lat.toFixed(8)),
      lng: parseFloat(lng.toFixed(8)),
      x: Math.round(pixelX),
      y: Math.round(pixelY)
    }
    
    console.log("🗺️ COORDENADAS REALES CAPTURADAS:")
    console.log(`   Click: [${clientX - rect.left}, ${clientY - rect.top}]`)
    console.log(`   Relativo: [${(relativeX * 100).toFixed(1)}%, ${(relativeY * 100).toFixed(1)}%]`)
    console.log(`   Geo REAL: [${result.lat}, ${result.lng}]`)
    console.log(`   Pixel: [${result.x}, ${result.y}]`)
    
    return result
  }, [mapBounds])

  // FUNCIÓN PRINCIPAL: CONVERTIR COORDENADAS REALES A PÍXELES (DINÁMICO)
  const realCoordsToPixels = useCallback((lat: number, lng: number) => {
    // Usar el bbox ACTUAL para convertir coordenadas reales a píxeles
    const relativeX = (lng - mapBounds.west) / (mapBounds.east - mapBounds.west)
    const relativeY = (mapBounds.north - lat) / (mapBounds.north - mapBounds.south)
    
    const pixelX = relativeX * MAP_BASE_CONFIG.width
    const pixelY = relativeY * MAP_BASE_CONFIG.height
    
    const result = {
      x: Math.max(0, Math.min(MAP_BASE_CONFIG.width, Math.round(pixelX))),
      y: Math.max(0, Math.min(MAP_BASE_CONFIG.height, Math.round(pixelY)))
    }
    
    // Solo log detallado cuando hay cambios recientes
    if (Date.now() - lastBoundsUpdate < 2000) {
      console.log(`🔄 CONVERSIÓN DINÁMICA REAL→PIXEL: [${lat}, ${lng}] → [${result.x}, ${result.y}]`)
    }
    
    return result
  }, [mapBounds, lastBoundsUpdate])

  // FUNCIÓN: DETECTAR BOUNDS DEL MAPA ACTUAL
  const detectMapBounds = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe) return mapBounds
    
    try {
      console.log("🎯 Detectando bounds del mapa...")
      
      // Intentar extraer bounds de la URL del iframe
      const currentSrc = iframe.src
      if (currentSrc && currentSrc.includes('bbox=')) {
        const bboxMatch = currentSrc.match(/bbox=([^&]+)/)
        if (bboxMatch) {
          const [west, south, east, north] = bboxMatch[1].split(',').map(Number)
          const newBounds = { west, south, east, north }
          
          // Solo actualizar si hay cambios significativos
          const threshold = 0.00001
          const hasChanged = Math.abs(newBounds.west - mapBounds.west) > threshold ||
                           Math.abs(newBounds.east - mapBounds.east) > threshold ||
                           Math.abs(newBounds.north - mapBounds.north) > threshold ||
                           Math.abs(newBounds.south - mapBounds.south) > threshold
          
          if (hasChanged) {
            console.log("🗺️ BOUNDS ACTUALIZADOS:")
            console.log("   Anteriores:", mapBounds)
            console.log("   Nuevos:", newBounds)
            setMapBounds(newBounds)
            setLastBoundsUpdate(Date.now())
            return newBounds
          }
        }
      }
    } catch (error) {
      console.warn("Error detectando bounds:", error)
    }
    
    return mapBounds
  }, [mapBounds])

  // FUNCIÓN: DETECTAR MOVIMIENTO DEL MAPA
  const detectMapMovement = useCallback(() => {
    if (!isOpen || isDrawing || !mapLoaded) return
    
    const iframe = iframeRef.current
    if (!iframe) return
    
    try {
      const currentSrc = iframe.src
      const expectedSrc = getMapUrl()
      
      // Si la URL cambió, el usuario navegó el mapa
      if (currentSrc !== expectedSrc) {
        console.log("🔄 MOVIMIENTO DEL MAPA DETECTADO")
        setIsMapMoving(true)
        
        // Detectar nuevos bounds
        detectMapBounds()
        
        // Resetear el indicador después de un breve delay
        setTimeout(() => {
          setIsMapMoving(false)
        }, 300)
      }
    } catch (error) {
      console.warn("Error detectando movimiento:", error)
    }
  }, [isOpen, isDrawing, mapLoaded, detectMapBounds])

  // FUNCIÓN: MANEJAR INTERACCIONES CON EL MAPA
  const handleMapInteraction = useCallback((event: Event) => {
    if (isDrawing) return
    
    console.log("👆 INTERACCIÓN CON MAPA:", event.type)
    
    // Delay para permitir que el mapa se actualice
    setTimeout(() => {
      detectMapMovement()
    }, 100)
  }, [isDrawing, detectMapMovement])

  // URL DEL MAPA (basada en bounds actuales)
  const getMapUrl = useCallback(() => {
    const { west, south, east, north } = mapBounds
    return `https://www.openstreetmap.org/export/embed.html?bbox=${west},${south},${east},${north}&layer=mapnik&marker=${MAP_BASE_CONFIG.center.lat},${MAP_BASE_CONFIG.center.lng}`
  }, [mapBounds])

  // FUNCIÓN: INICIAR POLLING DE BOUNDS
  const startBoundsPolling = useCallback(() => {
    if (boundCheckIntervalRef.current) {
      clearInterval(boundCheckIntervalRef.current)
    }
    
    console.log("🔍 INICIANDO DETECCIÓN DINÁMICA DE CAMBIOS EN EL MAPA")
    
    boundCheckIntervalRef.current = setInterval(() => {
      detectMapMovement()
    }, 250) // Verificación cada 250ms para alta responsividad
  }, [detectMapMovement])

  // FUNCIÓN: DETENER POLLING DE BOUNDS
  const stopBoundsPolling = useCallback(() => {
    if (boundCheckIntervalRef.current) {
      clearInterval(boundCheckIntervalRef.current)
      boundCheckIntervalRef.current = null
    }
    console.log("⏹️ DETENIENDO DETECCIÓN DE CAMBIOS EN EL MAPA")
  }, [])

  // INICIALIZACIÓN Y POLLING DINÁMICO
  useEffect(() => {
    if (isOpen) {
      console.log("🚀 MAPA DINÁMICO CON COORDENADAS REALES INICIALIZADO")
      console.log("📊 Configuración base:", MAP_BASE_CONFIG)
      console.log("🗺️ Bounds iniciales:", mapBounds)
      
      const zonesData = initialZones || []
      setZones(zonesData)
      setVisibleZones(new Set(zonesData.map(z => z.id)))
      
      // Log de zonas existentes
      zonesData.forEach((zone, i) => {
        console.log(`📍 Zona ${i + 1}: "${zone.nombre}"`)
        if (zone.poligono && zone.poligono.length > 0) {
          zone.poligono.forEach((point, j) => {
            if (Array.isArray(point) && point.length >= 2) {
              const [lat, lng] = point
              console.log(`     Punto ${j + 1}: [${lat}, ${lng}] (coordenadas reales)`)
            }
          })
        }
      })

      // Reset estados
      setSelectedZone(null)
      setEditingZone({})
      setIsDrawing(false)
      setDrawingPoints([])
      setMapLoaded(false)

      // Cargar mapa y iniciar polling dinámico
      setTimeout(() => {
        detectMapBounds()
        setMapLoaded(true)
        console.log("✅ Mapa dinámico con coordenadas reales cargado")
        
        // Iniciar detección continua de cambios
        startBoundsPolling()
      }, 1500)
    } else {
      // Limpiar polling cuando se cierre
      stopBoundsPolling()
    }

    // Cleanup al desmontar
    return () => {
      stopBoundsPolling()
    }
  }, [isOpen, initialZones, detectMapBounds, startBoundsPolling, stopBoundsPolling])

  // EFECTO PARA RERENDER CUANDO CAMBIEN LOS BOUNDS
  useEffect(() => {
    if (mapLoaded && zones.length > 0) {
      console.log("🔄 BOUNDS ACTUALIZADOS - RECALCULANDO POSICIONES DINÁMICAS DE POLÍGONOS")
    }
  }, [mapBounds, mapLoaded, zones.length])

  // MANEJO DE CLICS
  const handleMapClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !mapLoaded || !containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const realPoint = clickToRealCoordinates(event.clientX, event.clientY, rect)
    
    console.log(`🖱️ CLICK EN MAPA:`)
    console.log(`   Coordenada REAL capturada: [${realPoint.lat}, ${realPoint.lng}]`)
    console.log(`   Esta coordenada está ANCLADA al mapa geográfico`)
    
    setDrawingPoints(prev => {
      const updated = [...prev, realPoint]
      console.log(`📍 Total puntos con coordenadas reales: ${updated.length}`)
      return updated
    })
  }, [isDrawing, mapLoaded, clickToRealCoordinates])

  // INICIAR DIBUJO
  const startDrawing = () => {
    setIsDrawing(true)
    setDrawingPoints([])
    setSelectedZone(null)
    console.log("🎨 INICIANDO DIBUJO CON COORDENADAS REALES DINÁMICAS")
    console.log("📍 Cada clic capturará coordenadas geográficas exactas del mapa")
  }

  // COMPLETAR POLÍGONO
  const completePolygon = () => {
    if (drawingPoints.length < 3) {
      toast({
        title: "Error",
        description: "Necesitas al menos 3 puntos para crear una zona",
        variant: "destructive"
      })
      return
    }

    // Crear zona con coordenadas reales
    const realCoordinatesPolygon = drawingPoints.map(point => [point.lat, point.lng] as [number, number])
    
    console.log("💾 GUARDANDO ZONA CON COORDENADAS REALES DINÁMICAS:")
    console.log("📍 Zona:", editingZone.nombre || "Nueva Zona")
    console.log("🗺️ Polígono con coordenadas geográficas REALES:")
    realCoordinatesPolygon.forEach((coord, i) => {
      console.log(`     Punto ${i + 1}: [${coord[0]}, ${coord[1]}] (lat, lng real)`)
    })

    const newZone: DeliveryZone = {
      id: editingZone.id || `zona-${Date.now()}`,
      nombre: editingZone.nombre || `Zona ${zones.length + 1}`,
      tarifa: editingZone.tarifa || 3000,
      disponible: editingZone.disponible ?? true,
      poligono: realCoordinatesPolygon,
      color: editingZone.color || `#${Math.floor(Math.random()*16777215).toString(16)}`,
      tiempoEstimado: "30 min" // Tiempo estimado por defecto
    }

    const updatedZones = editingZone.id 
      ? zones.map(z => z.id === editingZone.id ? newZone : z)
      : [...zones, newZone]

    setZones(updatedZones)
    setVisibleZones(new Set(updatedZones.map(z => z.id)))
    setIsDrawing(false)
    setDrawingPoints([])
    setEditingZone({})
    
    onSaveZones(updatedZones)
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
    setEditingZone(zone)
  }

  // ELIMINAR ZONA
  const removeZone = async (zoneId: string) => {
    try {
      await deleteDeliveryZone(zoneId)
      const updatedZones = zones.filter(z => z.id !== zoneId)
      setZones(updatedZones)
      setVisibleZones(new Set(updatedZones.map(z => z.id)))
      setSelectedZone(null)
      setEditingZone({})
      onSaveZones(updatedZones)
      
      toast({
        title: "Zona eliminada",
        description: "La zona de delivery ha sido eliminada correctamente"
      })
    } catch (error) {
      console.error("Error eliminando zona:", error)
      toast({
        title: "Error",
        description: "No se pudo eliminar la zona",
        variant: "destructive"
      })
    }
  }

  // RENDERIZAR ZONA CON COORDENADAS REALES DINÁMICAS
  const renderZoneWithRealCoords = useCallback((zone: DeliveryZone) => {
    if (!visibleZones.has(zone.id) || !zone.poligono || zone.poligono.length === 0) {
      return null
    }

    console.log(`🎨 RENDERIZANDO ZONA DINÁMICA CON COORDENADAS REALES: "${zone.nombre}"`)
    
    // Convertir coordenadas reales a píxeles usando bounds actuales
    const pixelPoints = zone.poligono.map((point) => {
      if (Array.isArray(point) && point.length >= 2) {
        const [lat, lng] = point
        const pixelCoord = realCoordsToPixels(lat, lng)
        console.log(`     Punto: [${lat}, ${lng}] → [${pixelCoord.x}, ${pixelCoord.y}] (dinámico)`)
        return pixelCoord
      }
      return { x: 0, y: 0 }
    }).filter(p => p.x >= 0 && p.y >= 0)

    if (pixelPoints.length === 0) return null

    const pathString = pixelPoints.map(p => `${p.x},${p.y}`).join(" ")
    console.log(`     SVG Path dinámico: "${pathString}"`)

    return (
      <g key={zone.id}>
        <polygon
          points={pathString}
          fill={`${zone.color || "#10B981"}33`}
          stroke={zone.color || "#10B981"}
          strokeWidth={selectedZone?.id === zone.id ? 4 : 2}
          className="cursor-pointer transition-all duration-200 hover:fill-opacity-50"
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
      </g>
    )
  }, [mapLoaded, selectedZone, realCoordsToPixels, visibleZones])

  // RENDERIZAR POLÍGONO EN CONSTRUCCIÓN
  const renderDrawingPolygon = useCallback(() => {
    if (!isDrawing || drawingPoints.length === 0) return null

    console.log(`🎨 Renderizando polígono dinámico en construcción con ${drawingPoints.length} puntos`)
    
    return (
      <g>
        {/* Polígono temporal */}
        {drawingPoints.length > 2 && (
          <polygon
            points={drawingPoints.map(p => `${p.x},${p.y}`).join(" ")}
            fill="rgba(59, 130, 246, 0.3)"
            stroke="#3b82f6"
            strokeWidth={3}
            strokeDasharray="5,5"
          />
        )}
        
        {/* Líneas de conexión */}
        {drawingPoints.length > 1 && (
          <polyline
            points={drawingPoints.map(p => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={3}
            strokeDasharray="3,3"
          />
        )}
        
        {/* Puntos con coordenadas reales */}
        {drawingPoints.map((point, i) => (
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
              x={point.x}
              y={point.y - 12}
              fill="#3b82f6"
              fontSize="10"
              fontWeight="bold"
              textAnchor="middle"
              className="pointer-events-none"
            >
              {i + 1}
            </text>
          </g>
        ))}
      </g>
    )
  }, [isDrawing, drawingPoints])

  // GUARDAR ZONAS
  const handleSaveZones = async () => {
    if (zones.length === 0) {
      toast({
        title: "No hay zonas",
        description: "Crea al menos una zona antes de guardar",
        variant: "destructive"
      })
      return
    }

    setIsSaving(true)
    try {
      await saveDeliveryZones(zones)
      onSaveZones(zones)
      onClose()
      
      toast({
        title: "Zonas guardadas",
        description: `Se han guardado ${zones.length} zonas de delivery correctamente`
      })
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Editor de Zonas de Delivery - Mapa Dinámico con Coordenadas Reales
            {isMapMoving && (
              <Badge variant="secondary" className="ml-2 animate-pulse">
                <Navigation className="w-3 h-3 mr-1" />
                Sincronizando...
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[80vh]">
          {/* Panel de control */}
          <div className="lg:col-span-1 space-y-4 overflow-y-auto">
            {/* Controles de dibujo */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Controles Dinámicos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isDrawing ? (
                  <Button
                    onClick={startDrawing}
                    className="w-full"
                    variant="default"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Nueva Zona
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Haz clic en el mapa para agregar puntos. 
                      Mínimo 3 puntos requeridos.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        onClick={completePolygon}
                        disabled={drawingPoints.length < 3}
                        size="sm"
                        className="flex-1"
                      >
                        <Save className="w-3 h-3 mr-1" />
                        Completar
                      </Button>
                      <Button
                        onClick={cancelDrawing}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        <X className="w-3 h-3 mr-1" />
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}

                {isDrawing && (
                  <div className="space-y-2">
                    <Label htmlFor="zone-name">Nombre de la zona</Label>
                    <Input
                      id="zone-name"
                      value={editingZone.nombre || ""}
                      onChange={(e) => setEditingZone(prev => ({ ...prev, nombre: e.target.value }))}
                      placeholder="Ej: Centro, Las Condes..."
                    />
                    
                    <Label htmlFor="zone-tariff">Tarifa de delivery</Label>
                    <Input
                      id="zone-tariff"
                      type="number"
                      value={editingZone.tarifa || 3000}
                      onChange={(e) => setEditingZone(prev => ({ ...prev, tarifa: parseInt(e.target.value) || 3000 }))}
                      placeholder="3000"
                    />

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="zone-available"
                        checked={editingZone.disponible ?? true}
                        onCheckedChange={(checked) => setEditingZone(prev => ({ ...prev, disponible: checked as boolean }))}
                      />
                      <Label htmlFor="zone-available">Zona disponible</Label>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Lista de zonas */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Zonas Creadas ({zones.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-64 overflow-y-auto">
                {zones.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No hay zonas creadas
                  </p>
                ) : (
                  zones.map((zone) => (
                    <div
                      key={zone.id}
                      className={`p-2 rounded border cursor-pointer transition-colors ${
                        selectedZone?.id === zone.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => selectZone(zone)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded"
                            style={{ backgroundColor: zone.color }}
                          />
                          <div>
                            <p className="text-sm font-medium">{zone.nombre}</p>
                            <p className="text-xs text-muted-foreground">
                              ${zone.tarifa?.toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={visibleZones.has(zone.id)}
                            onCheckedChange={(checked) => {
                              const newVisible = new Set(visibleZones)
                              if (checked) {
                                newVisible.add(zone.id)
                              } else {
                                newVisible.delete(zone.id)
                              }
                              setVisibleZones(newVisible)
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeZone(zone.id)
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Status del mapa */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Estado del Mapa</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <div className={`w-2 h-2 rounded-full ${mapLoaded ? 'bg-green-500' : 'bg-yellow-500'}`} />
                  {mapLoaded ? 'Mapa cargado' : 'Cargando mapa...'}
                </div>
                {isMapMoving && (
                  <div className="flex items-center gap-2 text-xs text-blue-600">
                    <Navigation className="w-3 h-3 animate-pulse" />
                    Polígonos sincronizándose...
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  Bounds: {mapBounds.west.toFixed(4)}, {mapBounds.south.toFixed(4)}, {mapBounds.east.toFixed(4)}, {mapBounds.north.toFixed(4)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Mapa */}
          <div className="lg:col-span-3 relative">
            {!isDrawing && (
              <div className="absolute top-4 left-4 z-20 bg-white rounded-lg shadow-lg p-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-green-600 font-medium">✅ Mapa Dinámico Activo</span>
                  {zones.length > 0 && (
                    <span className="text-blue-600">
                      {zones.length} zona{zones.length !== 1 ? 's' : ''} con coordenadas reales
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
                ref={iframeRef}
                src={getMapUrl()}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                title="Mapa Los Andes - Dinámico con Coordenadas Reales"
                onLoad={() => {
                  console.log("🗺️ IFRAME DEL MAPA DINÁMICO CARGADO")
                  // Agregar listeners de interacción
                  const iframe = iframeRef.current
                  if (iframe) {
                    iframe.addEventListener('mouseenter', handleMapInteraction)
                    iframe.addEventListener('mouseleave', handleMapInteraction)
                    iframe.addEventListener('wheel', handleMapInteraction, { passive: true })
                    iframe.addEventListener('touchstart', handleMapInteraction, { passive: true })
                  }
                }}
              />

              {/* Overlay CON COORDENADAS REALES DINÁMICAS */}
              {mapLoaded && (
                <div
                  className={`absolute inset-0 ${isDrawing ? 'pointer-events-auto cursor-crosshair' : 'pointer-events-none'}`}
                  onClick={handleMapClick}
                  style={{ 
                    backgroundColor: isDrawing ? "rgba(0,100,255,0.05)" : "transparent",
                    zIndex: isDrawing ? 10 : 5
                  }}
                >
                  <svg
                    width="100%"
                    height="100%"
                    className="absolute inset-0"
                    viewBox={`0 0 ${MAP_BASE_CONFIG.width} ${MAP_BASE_CONFIG.height}`}
                    style={{ pointerEvents: isDrawing ? 'auto' : 'none' }}
                  >
                    {/* Zonas con coordenadas reales dinámicas */}
                    {zones.map(zone => renderZoneWithRealCoords(zone))}
                    
                    {/* Polígono en construcción */}
                    {renderDrawingPolygon()}
                  </svg>
                </div>
              )}

              {/* Indicador de sincronización dinámica */}
              {isMapMoving && (
                <div className="absolute top-2 right-2 bg-blue-500 text-white px-3 py-1 rounded-full text-sm z-20 flex items-center gap-2">
                  <Navigation className="w-4 h-4 animate-pulse" />
                  Sincronizando polígonos dinámicamente...
                </div>
              )}

              {/* Indicador de carga */}
              {!mapLoaded && (
                <div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-10">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-gray-600">Cargando Mapa Dinámico con Coordenadas Reales...</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex justify-between pt-4 border-t">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="w-4 h-4" />
            Los polígonos se mueven dinámicamente con el mapa manteniendo sus coordenadas reales
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveZones}
              disabled={zones.length === 0 || isSaving}
            >
              {isSaving ? "Guardando..." : `Guardar ${zones.length} zona${zones.length !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

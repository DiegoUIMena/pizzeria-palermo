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

// Tipos para Google Maps
declare global {
  interface Window {
    google: any
    initMap: () => void
  }
}

export default function DeliveryZoneMapDirect({ isOpen, onClose, onSaveZones, initialZones }: DeliveryZoneMapProps) {
  // Estados principales
  const [zones, setZones] = useState<DeliveryZone[]>([])
  const [selectedZone, setSelectedZone] = useState<DeliveryZone | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawingPoints, setDrawingPoints] = useState<google.maps.LatLng[]>([])
  const [editingZone, setEditingZone] = useState<Partial<DeliveryZone>>({})
  const [visibleZones, setVisibleZones] = useState<Set<string>>(new Set())
  const [mapLoaded, setMapLoaded] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Referencias
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const polygonsRef = useRef<Map<string, google.maps.Polygon>>(new Map())
  const drawingPolygonRef = useRef<google.maps.Polygon | null>(null)

  // Coordenadas de Los Andes, Chile
  const LOS_ANDES_CENTER = { lat: -32.8347, lng: -70.5983 }

  // Cargar Google Maps API
  useEffect(() => {
    if (!isOpen) return

    const loadGoogleMaps = () => {
      if (window.google) {
        initializeMap()
        return
      }

      // Verificar si ya existe el script
      if (document.getElementById('google-maps-script')) {
        return
      }

      const script = document.createElement('script')
      script.id = 'google-maps-script'
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=drawing,geometry&callback=initMap`
      script.async = true
      script.defer = true
      
      window.initMap = initializeMap
      
      script.onerror = () => {
        console.error('Error cargando Google Maps API')
        toast({
          title: "Error",
          description: "No se pudo cargar Google Maps. Revisa la API key.",
          variant: "destructive"
        })
      }

      document.head.appendChild(script)
    }

    loadGoogleMaps()
  }, [isOpen])

  // Inicializar mapa
  const initializeMap = useCallback(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    try {
      const map = new window.google.maps.Map(mapRef.current, {
        zoom: 15,
        center: LOS_ANDES_CENTER,
        mapTypeId: 'roadmap',
        streetViewControl: false,
        mapTypeControl: true,
        fullscreenControl: true,
        zoomControl: true,
      })

      mapInstanceRef.current = map
      setMapLoaded(true)

      console.log("Google Maps inicializado correctamente")

      // Cargar zonas existentes
      if (initialZones && initialZones.length > 0) {
        loadExistingZones(map)
      }

    } catch (error) {
      console.error('Error inicializando mapa:', error)
      toast({
        title: "Error",
        description: "Error al inicializar el mapa",
        variant: "destructive"
      })
    }
  }, [initialZones])

  // Cargar zonas existentes en el mapa
  const loadExistingZones = useCallback((map: google.maps.Map) => {
    if (!initialZones) return

    setZones(initialZones)
    const allZoneIds = new Set(initialZones.map(zone => zone.id))
    setVisibleZones(allZoneIds)

    initialZones.forEach(zone => {
      createPolygonOnMap(map, zone)
    })
  }, [initialZones])

  // Crear polígono en el mapa
  const createPolygonOnMap = useCallback((map: google.maps.Map, zone: DeliveryZone) => {
    if (!zone.poligono || zone.poligono.length < 3) return

    const paths = zone.poligono.map(point => {
      if (Array.isArray(point)) {
        return { lat: point[0], lng: point[1] }
      }
      return point
    })

    const polygon = new window.google.maps.Polygon({
      paths: paths,
      strokeColor: zone.color || '#3B82F6',
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: zone.color || '#3B82F6',
      fillOpacity: 0.35,
      map: visibleZones.has(zone.id) ? map : null,
      clickable: true,
      editable: false,
      draggable: false
    })

    // Agregar listener para seleccionar zona
    polygon.addListener('click', () => {
      selectZone(zone)
    })

    polygonsRef.current.set(zone.id, polygon)
  }, [visibleZones])

  // Iniciar modo dibujo
  const startDrawing = useCallback(() => {
    if (!mapInstanceRef.current) return

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

    const map = mapInstanceRef.current
    
    // Cambiar cursor
    map.setOptions({ draggableCursor: 'crosshair' })

    // Agregar listener para clics
    const clickListener = map.addListener('click', (event: google.maps.MapMouseEvent) => {
      if (!event.latLng) return

      const newPoint = event.latLng
      const updatedPoints = [...drawingPoints, newPoint]
      setDrawingPoints(updatedPoints)

      console.log("Punto agregado:", {
        lat: newPoint.lat(),
        lng: newPoint.lng(),
        total: updatedPoints.length
      })

      // Actualizar polígono de dibujo
      updateDrawingPolygon(map, updatedPoints)
    })

    // Guardar listener para limpiarlo después
    map.set('drawingClickListener', clickListener)

    toast({
      title: "Modo dibujo activado",
      description: "Haz clic en el mapa para crear puntos del polígono",
      variant: "default"
    })
  }, [drawingPoints, zones.length])

  // Actualizar polígono en construcción
  const updateDrawingPolygon = useCallback((map: google.maps.Map, points: google.maps.LatLng[]) => {
    // Limpiar polígono anterior
    if (drawingPolygonRef.current) {
      drawingPolygonRef.current.setMap(null)
    }

    if (points.length < 2) return

    const paths = points.map(point => ({
      lat: point.lat(),
      lng: point.lng()
    }))

    const polygon = new window.google.maps.Polygon({
      paths: paths,
      strokeColor: '#3B82F6',
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: '#3B82F6',
      fillOpacity: 0.2,
      map: map,
      clickable: false,
      editable: false,
      draggable: false
    })

    drawingPolygonRef.current = polygon
  }, [])

  // Finalizar dibujo
  const finishDrawing = useCallback(async () => {
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
        poligono: drawingPoints.map(point => [point.lat(), point.lng()] as [number, number]),
        tarifa: editingZone.tarifa,
        disponible: editingZone.disponible ?? true,
        tiempoEstimado: editingZone.tiempoEstimado || "30-40 min",
        color: editingZone.color || "#3B82F6",
        descripcion: editingZone.descripcion || "Nueva zona de delivery"
      }

      // Guardar en base de datos
      const updatedZones = [...zones, newZone]
      await saveDeliveryZones(updatedZones)

      // Actualizar estado
      setZones(updatedZones)
      setVisibleZones(prev => new Set([...prev, newZone.id]))
      setSelectedZone(newZone)

      // Crear polígono final en el mapa
      if (mapInstanceRef.current) {
        createPolygonOnMap(mapInstanceRef.current, newZone)
      }

      // Limpiar modo dibujo
      cancelDrawing()

      toast({
        title: "✅ Zona creada exitosamente",
        description: `"${newZone.nombre}" ha sido guardada en su ubicación exacta`,
        variant: "default"
      })

      onSaveZones(updatedZones)

    } catch (error) {
      console.error('Error guardando zona:', error)
      toast({
        title: "Error",
        description: "No se pudo guardar la zona",
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }, [drawingPoints, editingZone, zones, onSaveZones])

  // Cancelar dibujo
  const cancelDrawing = useCallback(() => {
    if (!mapInstanceRef.current) return

    const map = mapInstanceRef.current

    // Restaurar cursor
    map.setOptions({ draggableCursor: null })

    // Limpiar listeners
    const clickListener = map.get('drawingClickListener')
    if (clickListener) {
      window.google.maps.event.removeListener(clickListener)
      map.set('drawingClickListener', null)
    }

    // Limpiar polígono de dibujo
    if (drawingPolygonRef.current) {
      drawingPolygonRef.current.setMap(null)
      drawingPolygonRef.current = null
    }

    setIsDrawing(false)
    setDrawingPoints([])
    setEditingZone({})
  }, [])

  // Seleccionar zona
  const selectZone = useCallback((zone: DeliveryZone) => {
    if (isDrawing) return
    setSelectedZone(zone)
    setEditingZone({ ...zone })
  }, [isDrawing])

  // Toggle visibilidad de zona
  const toggleZoneVisibility = useCallback((zoneId: string) => {
    setVisibleZones(prev => {
      const newSet = new Set(prev)
      const polygon = polygonsRef.current.get(zoneId)
      
      if (newSet.has(zoneId)) {
        newSet.delete(zoneId)
        if (polygon) {
          polygon.setMap(null)
        }
      } else {
        newSet.add(zoneId)
        if (polygon && mapInstanceRef.current) {
          polygon.setMap(mapInstanceRef.current)
        }
      }
      return newSet
    })
  }, [])

  // Centrar en zona
  const centerOnZone = useCallback((zone: DeliveryZone) => {
    if (!mapInstanceRef.current || !zone.poligono || zone.poligono.length === 0) return

    const bounds = new window.google.maps.LatLngBounds()
    
    zone.poligono.forEach(point => {
      if (Array.isArray(point)) {
        bounds.extend({ lat: point[0], lng: point[1] })
      } else {
        bounds.extend(point)
      }
    })

    mapInstanceRef.current.fitBounds(bounds)
  }, [])

  // Guardar zona editada
  const handleSaveZone = useCallback(async () => {
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
        zone.id === selectedZone.id ? { ...zone, ...editingZone } : zone
      )

      await saveDeliveryZones(updatedZones)
      setZones(updatedZones)

      // Actualizar polígono en el mapa
      const polygon = polygonsRef.current.get(selectedZone.id)
      if (polygon) {
        polygon.setOptions({
          strokeColor: editingZone.color,
          fillColor: editingZone.color
        })
      }

      toast({
        title: "Zona actualizada",
        description: `"${editingZone.nombre}" ha sido actualizada`,
        variant: "default"
      })

      onSaveZones(updatedZones)
      setSelectedZone(null)
      setEditingZone({})

    } catch (error) {
      console.error('Error actualizando zona:', error)
      toast({
        title: "Error",
        description: "No se pudo actualizar la zona",
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }, [editingZone, selectedZone, zones, onSaveZones])

  // Eliminar zona
  const handleDeleteZone = useCallback(async () => {
    if (!selectedZone) return

    if (!confirm(`¿Estás seguro de eliminar la zona "${selectedZone.nombre}"?`)) {
      return
    }

    try {
      setIsSaving(true)

      await deleteDeliveryZone(selectedZone.id)

      const updatedZones = zones.filter(zone => zone.id !== selectedZone.id)
      setZones(updatedZones)

      // Remover polígono del mapa
      const polygon = polygonsRef.current.get(selectedZone.id)
      if (polygon) {
        polygon.setMap(null)
        polygonsRef.current.delete(selectedZone.id)
      }

      toast({
        title: "Zona eliminada",
        description: `"${selectedZone.nombre}" ha sido eliminada`,
        variant: "default"
      })

      onSaveZones(updatedZones)
      setSelectedZone(null)
      setEditingZone({})

    } catch (error) {
      console.error('Error eliminando zona:', error)
      toast({
        title: "Error",
        description: "No se pudo eliminar la zona",
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }, [selectedZone, zones, onSaveZones])

  // Guardar todas las zonas
  const handleSaveAll = useCallback(async () => {
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
        description: `${zones.length} zonas guardadas correctamente`,
        variant: "default"
      })

      onClose()

    } catch (error) {
      console.error('Error guardando zonas:', error)
      toast({
        title: "Error",
        description: "No se pudieron guardar las zonas",
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }, [zones, onSaveZones, onClose])

  // Limpiar al cerrar
  useEffect(() => {
    if (!isOpen) {
      cancelDrawing()
      setSelectedZone(null)
      setEditingZone({})
    }
  }, [isOpen, cancelDrawing])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <MapPin className="w-5 h-5 mr-2 text-pink-600" />
            Editor de Zonas de Delivery - Google Maps Directo
            <Badge variant="outline" className="ml-2 bg-green-50 text-green-700">
              API Directa
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex h-[75vh] gap-4">
          {/* Mapa */}
          <div className="flex-1 relative">
            {/* Controles */}
            <div className="absolute top-2 right-2 z-10 flex gap-2">
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

            {/* Indicador de modo dibujo */}
            {isDrawing && (
              <div className="absolute top-14 left-2 right-2 z-10 bg-green-100 border-2 border-green-400 rounded-lg p-3 text-sm shadow-lg">
                <div className="flex items-center justify-center text-green-800">
                  <Target className="w-5 h-5 mr-2 animate-pulse" />
                  <strong>MODO DIBUJO ACTIVO:</strong> Haz clic en el mapa para agregar puntos
                  {drawingPoints.length > 0 && (
                    <span className="ml-2 bg-green-200 px-2 py-1 rounded">
                      {drawingPoints.length} puntos
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Contenedor del mapa */}
            <div className="w-full h-full border-2 border-gray-300 rounded-lg overflow-hidden">
              <div
                ref={mapRef}
                className="w-full h-full"
                style={{ minHeight: '500px' }}
              />

              {/* Indicador de carga */}
              {!mapLoaded && (
                <div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-10">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-gray-600">Cargando Google Maps...</p>
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
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              centerOnZone(zone)
                            }}
                            className="text-xs h-6 px-2 flex-shrink-0"
                            title="Centrar en esta zona"
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

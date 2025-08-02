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

// Declaración global para TypeScript
declare global {
  interface Window {
    google: any
    initMap: () => void
  }
}

export default function DeliveryZoneMapV7({ isOpen, onClose, onSaveZones, initialZones }: DeliveryZoneMapProps) {
  // Estados principales
  const [zones, setZones] = useState<DeliveryZone[]>([])
  const [selectedZone, setSelectedZone] = useState<DeliveryZone | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawingPoints, setDrawingPoints] = useState<google.maps.LatLng[]>([])
  const [editingZone, setEditingZone] = useState<Partial<DeliveryZone>>({})
  
  // Estados del mapa
  const [mapLoaded, setMapLoaded] = useState(false)
  const [drawingMode, setDrawingMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false)
  
  // Referencias
  const mapRef = useRef<HTMLDivElement>(null)
  const googleMap = useRef<google.maps.Map | null>(null)
  const currentPolygons = useRef<google.maps.Polygon[]>([])
  const drawingPolygon = useRef<google.maps.Polygon | null>(null)
  
  // Centro y configuración del mapa
  const MAP_CENTER = { lat: -32.8347, lng: -70.5983 }
  const MAP_ZOOM = 14

  // Cargar Google Maps API
  useEffect(() => {
    if (!isOpen) return

    const loadGoogleMaps = () => {
      if (window.google && window.google.maps) {
        setGoogleMapsLoaded(true)
        return
      }

      // Crear script para cargar Google Maps
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dO39LXPn4NYD98&callback=initMap&libraries=geometry`
      script.async = true
      script.defer = true
      
      // Callback cuando se carga la API
      window.initMap = () => {
        setGoogleMapsLoaded(true)
      }
      
      document.head.appendChild(script)
      
      return () => {
        document.head.removeChild(script)
        delete window.initMap
      }
    }

    loadGoogleMaps()
  }, [isOpen])

  // Inicializar mapa cuando Google Maps esté cargado
  useEffect(() => {
    if (!googleMapsLoaded || !mapRef.current || !isOpen) return

    console.log("V7: Inicializando Google Maps...")

    // Crear el mapa
    googleMap.current = new window.google.maps.Map(mapRef.current, {
      center: MAP_CENTER,
      zoom: MAP_ZOOM,
      mapTypeId: 'roadmap',
      disableDefaultUI: false,
      zoomControl: true,
      streetViewControl: false,
      fullscreenControl: false,
    })

    // Agregar listener para clics en modo dibujo
    googleMap.current.addListener('click', handleMapClick)

    setMapLoaded(true)
    console.log("V7: Google Maps inicializado correctamente")

    // Cargar zonas existentes
    loadExistingZones()

  }, [googleMapsLoaded, isOpen])

  // Cargar zonas existentes cuando se inicializa
  useEffect(() => {
    if (isOpen && initialZones) {
      console.log("V7: Cargando zonas iniciales:", initialZones)
      setZones([...initialZones])
    }
  }, [isOpen, initialZones])

  // Cargar zonas existentes en el mapa
  const loadExistingZones = () => {
    if (!googleMap.current || !zones.length) return

    console.log("V7: Cargando zonas existentes en el mapa:", zones.length)

    // Limpiar polígonos existentes
    currentPolygons.current.forEach(polygon => polygon.setMap(null))
    currentPolygons.current = []

    // Crear polígonos para cada zona
    zones.forEach(zone => {
      createZonePolygon(zone)
    })
  }

  // Crear polígono para una zona
  const createZonePolygon = (zone: DeliveryZone) => {
    if (!googleMap.current) return

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
      fillOpacity: selectedZone?.id === zone.id ? 0.6 : 0.35,
      clickable: true,
      zIndex: selectedZone?.id === zone.id ? 2 : 1
    })

    polygon.setMap(googleMap.current)
    
    // Agregar listener para seleccionar zona
    polygon.addListener('click', () => selectZone(zone))

    // Agregar label
    const bounds = new window.google.maps.LatLngBounds()
    paths.forEach((path: any) => bounds.extend(path))
    const center = bounds.getCenter()

    const marker = new window.google.maps.Marker({
      position: center,
      map: googleMap.current,
      label: {
        text: zone.nombre,
        color: zone.color || '#3B82F6',
        fontWeight: 'bold',
        fontSize: '12px'
      },
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 0,
      }
    })

    currentPolygons.current.push(polygon)
  }

  // Manejo de clics en el mapa
  const handleMapClick = (event: google.maps.MapMouseEvent) => {
    if (!isDrawing || !event.latLng) return

    const latLng = event.latLng
    setDrawingPoints(prev => {
      const updated = [...prev, latLng]
      console.log(`V7: Punto agregado ${updated.length}:`, { 
        lat: latLng.lat(), 
        lng: latLng.lng() 
      })
      
      // Actualizar polígono de dibujo
      updateDrawingPolygon([...updated])
      
      return updated
    })
  }

  // Actualizar polígono durante el dibujo
  const updateDrawingPolygon = (points: google.maps.LatLng[]) => {
    if (!googleMap.current) return

    // Remover polígono anterior
    if (drawingPolygon.current) {
      drawingPolygon.current.setMap(null)
    }

    if (points.length < 2) return

    // Crear nuevo polígono temporal
    drawingPolygon.current = new window.google.maps.Polygon({
      paths: points,
      strokeColor: '#3B82F6',
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: '#3B82F6',
      fillOpacity: 0.2,
      clickable: false,
      zIndex: 10
    })

    drawingPolygon.current.setMap(googleMap.current)
  }

  // Recargar zonas en el mapa cuando cambian
  useEffect(() => {
    if (mapLoaded && zones.length > 0) {
      loadExistingZones()
    }
  }, [zones, mapLoaded, selectedZone])

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
    
    // Cambiar cursor del mapa
    if (googleMap.current) {
      googleMap.current.setOptions({ draggableCursor: 'crosshair' })
    }
    
    console.log("V7: Iniciando modo dibujo con Google Maps")
  }

  // Finalizar dibujo
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

      // Convertir LatLng a array
      const polygonPoints: [number, number][] = drawingPoints.map(point => [
        point.lat(),
        point.lng()
      ])

      const newZone: DeliveryZone = {
        id: `zona-${Date.now()}`,
        nombre: editingZone.nombre,
        poligono: polygonPoints,
        tarifa: editingZone.tarifa,
        disponible: editingZone.disponible ?? true,
        tiempoEstimado: editingZone.tiempoEstimado || "30-40 min",
        color: editingZone.color || "#3B82F6",
        descripcion: editingZone.descripcion || "Nueva zona de delivery"
      }

      console.log("V7: Guardando nueva zona:", newZone)

      // Guardar en la base de datos
      await saveDeliveryZones([...zones, newZone])

      // Actualizar estado local
      setZones(prev => [...prev, newZone])
      setSelectedZone(newZone)
      
      // Limpiar dibujo
      setIsDrawing(false)
      setDrawingMode(false)
      setDrawingPoints([])
      
      // Remover polígono temporal
      if (drawingPolygon.current) {
        drawingPolygon.current.setMap(null)
        drawingPolygon.current = null
      }
      
      // Restaurar cursor
      if (googleMap.current) {
        googleMap.current.setOptions({ draggableCursor: null })
      }
      
      console.log("V7: Zona creada y guardada:", newZone)
      
      toast({
        title: "Zona creada y guardada",
        description: `Se ha creado la zona "${newZone.nombre}" con ${newZone.poligono.length} puntos`,
        variant: "default"
      })

      // Notificar al componente padre
      onSaveZones([...zones, newZone])

    } catch (error) {
      console.error("V7: Error creando zona:", error)
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
    
    // Remover polígono temporal
    if (drawingPolygon.current) {
      drawingPolygon.current.setMap(null)
      drawingPolygon.current = null
    }
    
    // Restaurar cursor
    if (googleMap.current) {
      googleMap.current.setOptions({ draggableCursor: null })
    }
  }

  // Seleccionar zona
  const selectZone = (zone: DeliveryZone) => {
    if (isDrawing) return
    console.log("V7: Seleccionando zona:", zone.nombre)
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
      try {
        setIsSaving(true)
        
        const updatedZones = zones.map(zone => 
          zone.id === selectedZone.id 
            ? { ...zone, ...editingZone }
            : zone
        )
        
        // Guardar en base de datos
        await saveDeliveryZones(updatedZones)
        
        setZones(updatedZones)
        
        toast({
          title: "Zona actualizada",
          description: `Se ha actualizado la zona "${editingZone.nombre}"`,
          variant: "default"
        })
        
        // Notificar al componente padre
        onSaveZones(updatedZones)
        
      } catch (error) {
        console.error("V7: Error actualizando zona:", error)
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
      
      // Notificar al componente padre
      onSaveZones(updatedZones)
      
      console.log("V7: Zona eliminada:", selectedZone.id)
      
    } catch (error) {
      console.error("V7: Error eliminando zona:", error)
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
      
      console.log("V7: Guardando todas las zonas:", zones)
      
      if (zones.length === 0) {
        toast({
          title: "Error",
          description: "No hay zonas para guardar",
          variant: "destructive"
        })
        return
      }
      
      // Guardar en la base de datos
      await saveDeliveryZones(zones)
      
      // Notificar al componente padre
      onSaveZones(zones)
      
      toast({
        title: "Zonas guardadas",
        description: `Se han guardado ${zones.length} zonas en la base de datos`,
        variant: "default"
      })
      
      console.log("V7: Zonas guardadas exitosamente")
      
      // Cerrar el editor
      onClose()
      
    } catch (error) {
      console.error("V7: Error guardando zonas:", error)
      toast({
        title: "Error",
        description: "No se pudieron guardar las zonas en la base de datos",
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <MapPin className="w-5 h-5 mr-2 text-pink-600" />
            Editor de Zonas de Delivery - V7 GOOGLE MAPS API
            <Badge variant="outline" className="ml-2 bg-green-50 text-green-700">
              API Real + Polígonos Fijos
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
            {drawingMode && (
              <div className="absolute top-14 left-2 right-2 z-30 bg-green-100 border-2 border-green-400 rounded-lg p-3 text-sm shadow-lg">
                <div className="flex items-center justify-center text-green-800">
                  <Target className="w-5 h-5 mr-2 animate-pulse" />
                  <strong>MODO DIBUJO:</strong> Haz clic en el mapa para agregar puntos (Google Maps API)
                  {drawingPoints.length > 0 && (
                    <span className="ml-2 bg-green-200 px-2 py-1 rounded">
                      {drawingPoints.length} puntos
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Panel de información */}
            <div className="absolute bottom-2 left-2 z-30 bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs max-w-72">
              <div><strong>Sistema:</strong> V7 - Google Maps API Real</div>
              <div><strong>Centro:</strong> {MAP_CENTER.lat}, {MAP_CENTER.lng}</div>
              <div><strong>Estado:</strong> 
                <span className={`ml-1 ${mapLoaded ? 'text-green-600' : 'text-orange-600'}`}>
                  {mapLoaded ? '✅ Cargado' : '⏳ Cargando'}
                </span>
              </div>
              <div><strong>Google Maps:</strong> 
                <span className={`ml-1 ${googleMapsLoaded ? 'text-green-600' : 'text-orange-600'}`}>
                  {googleMapsLoaded ? '✅ Listo' : '⏳ Cargando'}
                </span>
              </div>
              <div><strong>Modo:</strong> {isDrawing ? '🟢 DIBUJO' : '🔴 NAVEGACIÓN'}</div>
              <div><strong>Zonas:</strong> {zones.length}</div>
              {drawingPoints.length > 0 && (
                <div><strong>Puntos:</strong> {drawingPoints.length}</div>
              )}
            </div>

            {/* Contenedor del mapa */}
            <div className="w-full h-full border-2 border-gray-300 rounded-lg overflow-hidden relative">
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
                    <p className="text-gray-600">
                      {!googleMapsLoaded ? 'Cargando Google Maps API...' : 'Inicializando mapa...'}
                    </p>
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
                          {zone.poligono.length} puntos • V7 API
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

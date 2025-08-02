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
import { Trash2, Save, Plus, X, MapPin, Move } from "lucide-react"
import { defaultDeliveryZones, type DeliveryZone } from "../../lib/delivery-zones"

declare global {
  interface Window {
    google: any
    initMap: () => void
  }
}

interface DeliveryZoneMapProps {
  isOpen: boolean
  onClose: () => void
  onSaveZones: (zones: DeliveryZone[]) => void
  initialZones?: DeliveryZone[]
}

export default function DeliveryZoneMapV3({ isOpen, onClose, onSaveZones, initialZones }: DeliveryZoneMapProps) {
  // Estados principales
  const [zones, setZones] = useState<DeliveryZone[]>([])
  const [selectedZone, setSelectedZone] = useState<DeliveryZone | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawingPath, setDrawingPath] = useState<google.maps.LatLng[]>([])
  const [editingZone, setEditingZone] = useState<Partial<DeliveryZone>>({})
  
  // Estados del mapa
  const [mapLoaded, setMapLoaded] = useState(false)
  const [drawingMode, setDrawingMode] = useState(false)
  
  // Referencias
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const polygonsRef = useRef<google.maps.Polygon[]>([])
  const drawingPolygonRef = useRef<google.maps.Polygon | null>(null)

  // Centro de Los Andes, Chile
  const mapCenter = { lat: -32.8347, lng: -70.5983 }

  // Cargar Google Maps API
  useEffect(() => {
    if (!isOpen) return

    const loadGoogleMaps = () => {
      if (window.google) {
        initializeMap()
        return
      }

      // Crear script de Google Maps (modo desarrollo)
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?callback=initMap&libraries=geometry,drawing`
      script.async = true
      script.defer = true
      
      window.initMap = initializeMap
      
      script.onerror = () => {
        console.error('Error cargando Google Maps API')
      }
      
      document.head.appendChild(script)
    }

    loadGoogleMaps()
  }, [isOpen])

  // Inicializar zonas
  useEffect(() => {
    if (isOpen) {
      if (initialZones && initialZones.length > 0) {
        setZones([...initialZones])
      } else {
        setZones([])
      }
    }
  }, [isOpen, initialZones])

  // Actualizar polígonos cuando cambien las zonas
  useEffect(() => {
    if (mapInstanceRef.current && mapLoaded) {
      updatePolygonsOnMap()
    }
  }, [zones, mapLoaded])

  const initializeMap = useCallback(() => {
    if (!mapRef.current || !window.google) return

    const map = new window.google.maps.Map(mapRef.current, {
      center: mapCenter,
      zoom: 14,
      mapTypeId: 'roadmap',
      disableDefaultUI: false,
      zoomControl: true,
      streetViewControl: false,
      fullscreenControl: false,
      mapTypeControl: false,
    })

    mapInstanceRef.current = map
    setMapLoaded(true)

    // Event listener para clics en el mapa (solo cuando está dibujando)
    map.addListener('click', (event: google.maps.MapMouseEvent) => {
      if (isDrawing && event.latLng) {
        addPointToDrawing(event.latLng)
      }
    })

    console.log('✅ Google Maps inicializado')
  }, [isDrawing])

  const updatePolygonsOnMap = () => {
    // Limpiar polígonos existentes
    polygonsRef.current.forEach(polygon => polygon.setMap(null))
    polygonsRef.current = []

    // Crear nuevos polígonos
    zones.forEach((zone, index) => {
      if (!zone.poligono || zone.poligono.length < 3) return

      const paths = zone.poligono.map(point => {
        if (Array.isArray(point)) {
          return new window.google.maps.LatLng(point[0], point[1])
        } else {
          return new window.google.maps.LatLng(point.lat, point.lng)
        }
      })

      const polygon = new window.google.maps.Polygon({
        paths: paths,
        fillColor: zone.color || '#10B981',
        fillOpacity: selectedZone?.id === zone.id ? 0.7 : 0.5,
        strokeColor: zone.color || '#10B981',
        strokeOpacity: 0.9,
        strokeWeight: selectedZone?.id === zone.id ? 3 : 2,
        clickable: true,
      })

      polygon.setMap(mapInstanceRef.current)
      
      // Event listener para seleccionar zona
      polygon.addListener('click', () => {
        selectZone(zone)
      })

      polygonsRef.current.push(polygon)
    })
  }

  const addPointToDrawing = (latLng: google.maps.LatLng) => {
    const newPath = [...drawingPath, latLng]
    setDrawingPath(newPath)

    // Actualizar polígono temporal
    if (drawingPolygonRef.current) {
      drawingPolygonRef.current.setMap(null)
    }

    if (newPath.length >= 2) {
      const polygon = new window.google.maps.Polygon({
        paths: newPath,
        fillColor: '#3B82F6',
        fillOpacity: 0.3,
        strokeColor: '#3B82F6',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        strokeDasharray: [10, 5],
      })

      polygon.setMap(mapInstanceRef.current)
      drawingPolygonRef.current = polygon
    }
  }

  const startDrawing = () => {
    setIsDrawing(true)
    setDrawingMode(true)
    setDrawingPath([])
    setSelectedZone(null)
    setEditingZone({})
    
    // Cambiar cursor del mapa
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setOptions({ draggableCursor: 'crosshair' })
    }
  }

  const finishDrawing = () => {
    if (drawingPath.length < 3) {
      alert("Necesitas al menos 3 puntos para crear una zona")
      return
    }

    const newZone: DeliveryZone = {
      id: `zona-${Date.now()}`,
      nombre: `Nueva Zona ${zones.length + 1}`,
      poligono: drawingPath.map(point => [point.lat(), point.lng()] as [number, number]),
      tarifa: 2000,
      disponible: true,
      tiempoEstimado: "30-40 min",
      color: "#3B82F6",
      descripcion: "Nueva zona de delivery"
    }

    setZones([...zones, newZone])
    setSelectedZone(newZone)
    setEditingZone(newZone)
    cancelDrawing()
  }

  const cancelDrawing = () => {
    setIsDrawing(false)
    setDrawingMode(false)
    setDrawingPath([])
    
    // Limpiar polígono temporal
    if (drawingPolygonRef.current) {
      drawingPolygonRef.current.setMap(null)
      drawingPolygonRef.current = null
    }
    
    // Restaurar cursor
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setOptions({ draggableCursor: 'grab' })
    }
  }

  const selectZone = (zone: DeliveryZone) => {
    setSelectedZone(zone)
    setEditingZone({ ...zone })
    updatePolygonsOnMap() // Re-renderizar para resaltar la zona seleccionada
  }

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

  const handleDeleteZone = () => {
    if (!selectedZone) return

    if (confirm(`¿Estás seguro de eliminar la zona "${selectedZone.nombre}"?`)) {
      const updatedZones = zones.filter(zone => zone.id !== selectedZone.id)
      setZones(updatedZones)
      setSelectedZone(null)
      setEditingZone({})
    }
  }

  const handleSaveAll = () => {
    onSaveZones(zones)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <MapPin className="w-5 h-5 mr-2 text-pink-600" />
            Editor de Zonas de Delivery - Google Maps Nativo
            <Badge variant="outline" className="ml-2">
              Coordenadas Reales
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
                    disabled={drawingPath.length < 3}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Finalizar ({drawingPath.length})
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
              <div className="absolute top-2 left-2 z-30 bg-green-100 border border-green-300 rounded-lg p-2 text-sm">
                <div className="flex items-center text-green-700">
                  <Plus className="w-4 h-4 mr-1" />
                  <strong>Modo Dibujo:</strong> Haz clic en el mapa para agregar puntos
                </div>
              </div>
            )}

            {/* Contenedor del mapa */}
            <div 
              ref={mapRef} 
              className="w-full h-full border-2 border-gray-300 rounded-lg"
              style={{ minHeight: '500px' }}
            />

            {/* Indicador de carga */}
            {!mapLoaded && (
              <div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-10 rounded-lg">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-gray-600">Cargando Google Maps...</p>
                </div>
              </div>
            )}
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
                        {zone.poligono.length} puntos
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

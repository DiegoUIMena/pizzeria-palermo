"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trash2, Save, Plus, X, Eye, EyeOff, MapPin, ZoomIn, ZoomOut, Satellite, MapIcon } from "lucide-react"
import { deliveryZones, type DeliveryZone } from "../../lib/delivery-zones"

interface DeliveryZoneMapProps {
  isOpen: boolean
  onClose: () => void
  onSaveZones: (zones: DeliveryZone[]) => void
}

export default function DeliveryZoneMap({ isOpen, onClose, onSaveZones }: DeliveryZoneMapProps) {
  const [zones, setZones] = useState<DeliveryZone[]>([...deliveryZones])
  const [selectedZone, setSelectedZone] = useState<DeliveryZone | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawingPoints, setDrawingPoints] = useState<{ x: number; y: number; lat: number; lng: number }[]>([])
  const [editingZone, setEditingZone] = useState<Partial<DeliveryZone>>({})
  const [showZones, setShowZones] = useState(true)
  const [mapType, setMapType] = useState<"roadmap" | "satellite" | "hybrid" | "terrain">("roadmap")
  const [zoom, setZoom] = useState(14)
  const mapRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Coordenadas exactas de Los Andes, Chile
  const losAndesCenter = { lat: -32.8347, lng: -70.5983 }

  // URL del mapa de Google Maps Embed (gratuito)
  const getGoogleMapsUrl = () => {
    const baseUrl = "https://www.google.com/maps/embed/v1/view"
    const params = new URLSearchParams({
      key: "AIzaSyB41DRUbKWJHPxaFjMAwdrzWzbVKartNGg", // Clave pública de ejemplo (usar la tuya)
      center: `${losAndesCenter.lat},${losAndesCenter.lng}`,
      zoom: zoom.toString(),
      maptype: mapType,
    })

    // Si no tienes API key, usar la versión sin key (limitada pero funcional)
    return `https://maps.google.com/maps?q=${losAndesCenter.lat},${losAndesCenter.lng}&t=${mapType}&z=${zoom}&output=embed&iwloc=near`
  }

  // Alternativa con OpenStreetMap tiles
  const getOSMTileUrl = (x: number, y: number, z: number) => {
    return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`
  }

  // Convertir coordenadas geográficas a píxeles
  const geoToPixel = (lat: number, lng: number) => {
    if (!mapRef.current) return { x: 0, y: 0 }

    const mapRect = mapRef.current.getBoundingClientRect()
    const mapWidth = mapRect.width
    const mapHeight = mapRect.height

    // Calcular bounds aproximados basados en el zoom
    const latRange = 0.01 * (20 - zoom) // Rango de latitud visible
    const lngRange = 0.01 * (20 - zoom) // Rango de longitud visible

    const bounds = {
      north: losAndesCenter.lat + latRange / 2,
      south: losAndesCenter.lat - latRange / 2,
      west: losAndesCenter.lng - lngRange / 2,
      east: losAndesCenter.lng + lngRange / 2,
    }

    const x = ((lng - bounds.west) / (bounds.east - bounds.west)) * mapWidth
    const y = ((bounds.north - lat) / (bounds.north - bounds.south)) * mapHeight

    return { x, y }
  }

  // Convertir píxeles a coordenadas geográficas
  const pixelToGeo = (x: number, y: number) => {
    if (!mapRef.current) return { lat: losAndesCenter.lat, lng: losAndesCenter.lng }

    const mapRect = mapRef.current.getBoundingClientRect()
    const mapWidth = mapRect.width
    const mapHeight = mapRect.height

    const latRange = 0.01 * (20 - zoom)
    const lngRange = 0.01 * (20 - zoom)

    const bounds = {
      north: losAndesCenter.lat + latRange / 2,
      south: losAndesCenter.lat - latRange / 2,
      west: losAndesCenter.lng - lngRange / 2,
      east: losAndesCenter.lng + lngRange / 2,
    }

    const lng = bounds.west + (x / mapWidth) * (bounds.east - bounds.west)
    const lat = bounds.north - (y / mapHeight) * (bounds.north - bounds.south)

    return { lat, lng }
  }

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing) return

    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    const geo = pixelToGeo(x, y)
    setDrawingPoints((prev) => [...prev, { x, y, lat: geo.lat, lng: geo.lng }])
  }

  const handleSaveZone = () => {
    if (!editingZone.nombre || !editingZone.tarifa) {
      alert("Por favor completa el nombre y la tarifa de la zona")
      return
    }

    if (selectedZone) {
      const updatedZones = zones.map((zone) => (zone.id === selectedZone.id ? { ...zone, ...editingZone } : zone))
      setZones(updatedZones)
    } else if (drawingPoints.length >= 3) {
      const polygonPoints: [number, number][] = drawingPoints.map((point) => [point.lat, point.lng])

      const newZone: DeliveryZone = {
        id: `zona-${Date.now()}`,
        nombre: editingZone.nombre,
        poligono: polygonPoints,
        tarifa: editingZone.tarifa || 0,
        tiempoEstimado: editingZone.tiempoEstimado || "20-30 min",
        disponible: editingZone.disponible ?? true,
        color: editingZone.color || "#3B82F6",
        descripcion: editingZone.descripcion || "",
      }
      setZones([...zones, newZone])
      setDrawingPoints([])
    } else {
      alert("Necesitas al menos 3 puntos para crear una zona")
      return
    }

    setSelectedZone(null)
    setEditingZone({})
    setIsDrawing(false)
  }

  const handleDeleteZone = () => {
    if (!selectedZone) return

    if (confirm(`¿Estás seguro de eliminar la zona "${selectedZone.nombre}"?`)) {
      const updatedZones = zones.filter((zone) => zone.id !== selectedZone.id)
      setZones(updatedZones)
      setSelectedZone(null)
      setEditingZone({})
    }
  }

  const startDrawing = () => {
    setIsDrawing(true)
    setSelectedZone(null)
    setDrawingPoints([])
    setEditingZone({
      nombre: "",
      tarifa: 2000,
      tiempoEstimado: "20-30 min",
      disponible: true,
      color: "#10B981",
      descripcion: "",
    })
  }

  const cancelDrawing = () => {
    setIsDrawing(false)
    setDrawingPoints([])
    setEditingZone({})
  }

  const finishDrawing = () => {
    if (drawingPoints.length < 3) {
      alert("Necesitas al menos 3 puntos para crear una zona")
      return
    }
  }

  const handleSaveAll = () => {
    onSaveZones(zones)
    onClose()
  }

  const selectZone = (zone: DeliveryZone) => {
    if (isDrawing) return

    setSelectedZone(zone)
    setEditingZone({
      nombre: zone.nombre,
      tarifa: zone.tarifa,
      tiempoEstimado: zone.tiempoEstimado,
      disponible: zone.disponible,
      color: zone.color,
      descripcion: zone.descripcion,
    })
  }

  // Renderizar zona en el overlay
  const renderZoneOverlay = (zone: DeliveryZone) => {
    if (!showZones) return null

    // Convertir coordenadas del polígono a píxeles
    const pixelPoints = zone.poligono.map(([lat, lng]) => geoToPixel(lat, lng))
    const pathString = pixelPoints.map((p) => `${p.x},${p.y}`).join(" ")

    return (
      <g key={zone.id}>
        <polygon
          points={pathString}
          fill={zone.color}
          fillOpacity={selectedZone?.id === zone.id ? 0.6 : 0.3}
          stroke={zone.color}
          strokeWidth={selectedZone?.id === zone.id ? 3 : 2}
          className="cursor-pointer hover:fill-opacity-50 transition-all"
          onClick={(e) => {
            e.stopPropagation()
            selectZone(zone)
          }}
        />
        {/* Etiqueta de la zona */}
        {pixelPoints.length > 0 && (
          <g>
            <rect
              x={pixelPoints[0].x - 30}
              y={pixelPoints[0].y - 25}
              width="60"
              height="20"
              fill="white"
              stroke={zone.color}
              strokeWidth="1"
              rx="3"
              className="drop-shadow-sm"
            />
            <text
              x={pixelPoints[0].x}
              y={pixelPoints[0].y - 10}
              textAnchor="middle"
              className="text-xs font-medium fill-gray-800"
            >
              {zone.nombre}
            </text>
          </g>
        )}
      </g>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <MapPin className="w-5 h-5 mr-2 text-pink-600" />
            Editor de Zonas de Delivery - Los Andes, Chile
            <Badge variant="outline" className="ml-2">
              Google Maps
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex h-[75vh] gap-4">
          {/* Mapa */}
          <div className="flex-1 relative">
            {/* Controles superiores */}
            <div className="absolute top-2 left-2 z-30 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowZones(!showZones)} disabled={isDrawing}>
                {showZones ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showZones ? "Ocultar" : "Mostrar"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setMapType(mapType === "roadmap" ? "satellite" : "roadmap")}
              >
                {mapType === "roadmap" ? <Satellite className="w-4 h-4" /> : <MapIcon className="w-4 h-4" />}
                {mapType === "roadmap" ? "Satélite" : "Mapa"}
              </Button>

              <Button variant="outline" size="sm" onClick={() => setZoom(Math.min(zoom + 1, 18))}>
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setZoom(Math.max(zoom - 1, 10))}>
                <ZoomOut className="w-4 h-4" />
              </Button>
            </div>

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

            {/* Instrucciones */}
            {isDrawing && (
              <div className="absolute bottom-4 left-4 z-30 bg-green-100 border border-green-400 rounded-lg p-3 max-w-sm shadow-lg">
                <h4 className="font-medium text-green-800 mb-2">🎨 Dibujando Nueva Zona</h4>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• Haz clic en el mapa para añadir puntos</li>
                  <li>• Puntos añadidos: {drawingPoints.length}</li>
                  <li>• Mínimo 3 puntos para crear zona</li>
                  <li>• Haz clic en "Finalizar" cuando termines</li>
                </ul>
              </div>
            )}

            {/* Información del mapa */}
            <div className="absolute bottom-4 right-4 z-30 bg-white p-2 rounded-lg shadow-lg border text-xs">
              <p>
                <strong>📍 Los Andes, Chile</strong>
              </p>
              <p>
                Zoom: {zoom} | Tipo: {mapType}
              </p>
              <p>Lat: {losAndesCenter.lat}°</p>
              <p>Lng: {losAndesCenter.lng}°</p>
            </div>

            {/* Contenedor del mapa */}
            <div className="w-full h-full border-2 border-gray-300 rounded-lg overflow-hidden relative">
              {/* Google Maps iframe */}
              <iframe
                ref={mapRef}
                src={getGoogleMapsUrl()}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="absolute inset-0"
              />

              {/* Overlay para interacciones */}
              <div
                ref={overlayRef}
                className="absolute inset-0 z-10"
                style={{
                  pointerEvents: isDrawing ? "auto" : "none",
                  cursor: isDrawing ? "crosshair" : "default",
                }}
                onClick={handleOverlayClick}
              >
                {/* SVG para zonas y dibujo */}
                <svg className="w-full h-full">
                  {/* Zonas existentes */}
                  {zones.map((zone) => renderZoneOverlay(zone))}

                  {/* Líneas de dibujo */}
                  {isDrawing && drawingPoints.length > 1 && (
                    <polyline
                      points={drawingPoints.map((p) => `${p.x},${p.y}`).join(" ")}
                      fill="none"
                      stroke="#10B981"
                      strokeWidth="3"
                      strokeDasharray="5,5"
                      opacity="0.8"
                    />
                  )}

                  {/* Línea de cierre */}
                  {isDrawing && drawingPoints.length > 2 && (
                    <line
                      x1={drawingPoints[drawingPoints.length - 1].x}
                      y1={drawingPoints[drawingPoints.length - 1].y}
                      x2={drawingPoints[0].x}
                      y2={drawingPoints[0].y}
                      stroke="#10B981"
                      strokeWidth="2"
                      strokeDasharray="3,3"
                      opacity="0.5"
                    />
                  )}

                  {/* Puntos de dibujo */}
                  {isDrawing &&
                    drawingPoints.map((point, index) => (
                      <g key={index}>
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r="8"
                          fill={index === 0 ? "#EF4444" : "#10B981"}
                          stroke="white"
                          strokeWidth="3"
                          opacity="0.9"
                        />
                        <text
                          x={point.x}
                          y={point.y + 20}
                          textAnchor="middle"
                          className="text-xs font-bold fill-gray-700"
                        >
                          {index + 1}
                        </text>
                      </g>
                    ))}

                  {/* Área en construcción */}
                  {isDrawing && drawingPoints.length > 2 && (
                    <polygon
                      points={drawingPoints.map((p) => `${p.x},${p.y}`).join(" ")}
                      fill={editingZone.color || "#10B981"}
                      fillOpacity="0.4"
                      stroke={editingZone.color || "#10B981"}
                      strokeWidth="3"
                      strokeDasharray="8,4"
                    />
                  )}
                </svg>
              </div>
            </div>
          </div>

          {/* Panel de edición */}
          <div className="w-80 space-y-4 overflow-y-auto">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  {selectedZone ? (
                    <>
                      <Save className="w-4 h-4 mr-2 text-blue-600" />
                      Editar Zona
                    </>
                  ) : isDrawing ? (
                    <>
                      <Plus className="w-4 h-4 mr-2 text-green-600" />
                      Nueva Zona
                    </>
                  ) : (
                    <>
                      <MapPin className="w-4 h-4 mr-2 text-gray-600" />
                      Selecciona una Zona
                    </>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(selectedZone || isDrawing) && (
                  <>
                    <div>
                      <Label htmlFor="nombre">Nombre de la Zona</Label>
                      <Input
                        id="nombre"
                        value={editingZone.nombre || ""}
                        onChange={(e) => setEditingZone({ ...editingZone, nombre: e.target.value })}
                        placeholder="Ej: Centro Los Andes"
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="tarifa">Tarifa de Delivery ($)</Label>
                      <Input
                        id="tarifa"
                        type="number"
                        value={editingZone.tarifa || ""}
                        onChange={(e) =>
                          setEditingZone({ ...editingZone, tarifa: Number.parseInt(e.target.value) || 0 })
                        }
                        placeholder="2000"
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="tiempo">Tiempo Estimado</Label>
                      <Input
                        id="tiempo"
                        value={editingZone.tiempoEstimado || ""}
                        onChange={(e) => setEditingZone({ ...editingZone, tiempoEstimado: e.target.value })}
                        placeholder="20-30 min"
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="descripcion">Descripción</Label>
                      <Input
                        id="descripcion"
                        value={editingZone.descripcion || ""}
                        onChange={(e) => setEditingZone({ ...editingZone, descripcion: e.target.value })}
                        placeholder="Barrios incluidos"
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="color">Color de la Zona</Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          id="color"
                          type="color"
                          value={editingZone.color || "#3B82F6"}
                          onChange={(e) => setEditingZone({ ...editingZone, color: e.target.value })}
                          className="w-16"
                        />
                        <Input
                          value={editingZone.color || "#3B82F6"}
                          onChange={(e) => setEditingZone({ ...editingZone, color: e.target.value })}
                          placeholder="#3B82F6"
                        />
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="disponible"
                        checked={editingZone.disponible ?? true}
                        onCheckedChange={(checked) => setEditingZone({ ...editingZone, disponible: checked })}
                      />
                      <Label htmlFor="disponible">Zona Disponible</Label>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={handleSaveZone}
                        className="flex-1"
                        disabled={!editingZone.nombre || !editingZone.tarifa || (isDrawing && drawingPoints.length < 3)}
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Guardar
                      </Button>
                      {selectedZone && (
                        <Button onClick={handleDeleteZone} variant="destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Lista de zonas */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Zonas Configuradas ({zones.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {zones.map((zone) => (
                    <div
                      key={zone.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedZone?.id === zone.id
                          ? "bg-pink-50 border-pink-300 shadow-md"
                          : "hover:bg-gray-50 border-gray-200"
                      } ${isDrawing ? "opacity-50 cursor-not-allowed" : ""}`}
                      onClick={() => !isDrawing && selectZone(zone)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">{zone.nombre}</div>
                          <div className="text-xs text-gray-500">${zone.tarifa.toLocaleString()}</div>
                          <div className="text-xs text-gray-400">{zone.tiempoEstimado}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                            style={{ backgroundColor: zone.color }}
                          ></div>
                          <Badge variant={zone.disponible ? "default" : "destructive"} className="text-xs">
                            {zone.disponible ? "✓" : "✗"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSaveAll} className="bg-pink-600 hover:bg-pink-700 text-white">
            <Save className="w-4 h-4 mr-2" />
            Guardar Cambios ({zones.length} zonas)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

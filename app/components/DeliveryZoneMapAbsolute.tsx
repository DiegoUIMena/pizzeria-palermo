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
import { Save, Plus, X, MapPin, Target, AlertCircle, Lock } from "lucide-react"
import { type DeliveryZone } from "../../lib/delivery-zones"
import { saveDeliveryZones } from "../../lib/delivery-zones-service"
import { toast } from "@/hooks/use-toast"
import dynamic from 'next/dynamic'
// Cargar el componente del mapa sólo en el cliente para evitar errores de SSR con Leaflet
const LeafletZonesInner = dynamic(() => import('./LeafletZonesInner'), { ssr: false })

interface DeliveryZoneMapProps {
  isOpen: boolean
  onClose: () => void
  onSaveZones: (zones: DeliveryZone[]) => void
  initialZones?: DeliveryZone[]
}

// Constantes de mapa definidas dentro del componente LeafletZonesInner

export default function DeliveryZoneMapAbsolute({ isOpen, onClose, onSaveZones, initialZones }: DeliveryZoneMapProps) {
  // Estados
  const [zones, setZones] = useState<DeliveryZone[]>([])
  const [selectedZone, setSelectedZone] = useState<DeliveryZone | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawingPoints, setDrawingPoints] = useState<[number, number][]>([])
  const [editingZone, setEditingZone] = useState<Partial<DeliveryZone>>({})
  const [visibleZones, setVisibleZones] = useState<Set<string>>(new Set())
  const [isSaving, setIsSaving] = useState(false)
  const [isEditingVertices, setIsEditingVertices] = useState(false)

  // Normalizar polígono a [number,number][]
  const normalizePolygon = useCallback((poly: DeliveryZone["poligono"]): [number, number][] => {
    return poly.map(p => Array.isArray(p) ? [p[0], p[1]] : [p.lat, p.lng]) as [number, number][]
  }, [])

  // INICIALIZACIÓN
  useEffect(() => {
    if (!isOpen) return
    const zonesData = initialZones || []
    setZones(zonesData)
    setVisibleZones(new Set(zonesData.map(z => z.id)))
    setSelectedZone(null)
    setEditingZone({})
    setIsDrawing(false)
    setDrawingPoints([])
    setIsEditingVertices(false)
  }, [isOpen, initialZones])

  // (Click handler se maneja dentro de LeafletZonesInner)

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
    console.log("🎨 INICIANDO DIBUJO")
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

      // Crear zona con coordenadas EXACTAS en formato compatible con Leaflet
      const newZone: DeliveryZone = {
        id: `zona-${Date.now()}`,
        nombre: editingZone.nombre,
        poligono: drawingPoints.map(p => [p[0], p[1]] as [number, number]),
        tarifa: editingZone.tarifa,
        disponible: editingZone.disponible ?? true,
        tiempoEstimado: editingZone.tiempoEstimado || "30-40 min",
        color: editingZone.color || "#3B82F6",
        descripcion: editingZone.descripcion || "Nueva zona de delivery"
      }

      console.log("💾 GUARDANDO ZONA:", newZone.nombre)
      console.log("📍 Polígono:", newZone.poligono)

      // Guardar en Firebase
      const allZones = [...zones, newZone]
      await saveDeliveryZones(allZones)

      // Actualizar estado LOCAL (SIN RECARGAR)
      setZones(allZones)
      setVisibleZones(prev => new Set([...prev, newZone.id]))
      setSelectedZone(newZone)
      setIsDrawing(false)
      setDrawingPoints([])
      
      toast({
        title: "✅ Zona creada",
        description: `"${newZone.nombre}" creada correctamente`,
        variant: "default"
      })

      // Notificar al padre SIN forzar recarga
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
    setIsEditingVertices(false)
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

  // RENDERIZAR ZONA CON COORDENADAS ABSOLUTAS
  // Actualizar vértice arrastrado
  const handleVertexDrag = (index: number, newPoint: [number, number]) => {
    if (!selectedZone) return
    const updatedPolygon = normalizePolygon(selectedZone.poligono).map((p, i) => i === index ? newPoint : p)
    setZones(prev => prev.map(z => z.id === selectedZone.id ? { ...z, poligono: updatedPolygon } : z))
    setSelectedZone(prev => prev ? { ...prev, poligono: updatedPolygon } : prev)
  }

  // Guardar cambios de una zona existente (metadatos o geometría)
  const saveExistingChanges = async () => {
    if (!selectedZone) return
    try {
      setIsSaving(true)
      const updatedZones = zones.map(z => z.id === selectedZone.id ? { ...selectedZone, ...editingZone, poligono: selectedZone.poligono } as DeliveryZone : z)
      setZones(updatedZones)
      await saveDeliveryZones(updatedZones)
      toast({ title: "Cambios guardados", description: `Zona "${selectedZone.nombre}" actualizada` })
      onSaveZones(updatedZones)
    } catch (e) {
      console.error(e)
      toast({ title: "Error", description: "No se pudieron guardar los cambios", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='max-w-6xl max-h-[95vh] overflow-hidden'>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-pink-600" />
    <span>Editor de Zonas</span>
    <Badge variant="outline" className="bg-blue-50 text-blue-700">Leaflet</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex h-[75vh] gap-4">
          {/* Mapa */}
          <div className="flex-1 relative">
    {/* Controles */}
            {/* Controles superiores (subimos z-index por encima de capas Leaflet) */}
            <div className="absolute top-2 right-2 z-[1100] flex gap-2 pointer-events-auto">
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

            {isDrawing && (
              <div className="absolute top-14 left-2 right-2 z-30 bg-blue-100 border-2 border-blue-400 rounded-lg p-3 text-sm shadow-lg flex items-center justify-center text-blue-800">
                <Target className="w-5 h-5 mr-2 animate-pulse" />
                <strong>🎯 DIBUJANDO:</strong>
                {drawingPoints.length > 0 && (
                  <span className="ml-2 bg-blue-200 px-2 py-1 rounded">
                    {drawingPoints.length} puntos
                  </span>
                )}
              </div>
            )}

            {/* Contenedor del mapa Leaflet */}
            <div className="w-full h-full border-2 border-gray-300 rounded-lg overflow-hidden relative">
              {/* Capa para asegurar que los controles no queden debajo de tiles */}
              <style>{`.leaflet-pane, .leaflet-top, .leaflet-bottom{z-index:400;} .leaflet-container{z-index:0;} .leaflet-marker-pane{z-index:600;} .leaflet-tooltip-pane{z-index:650;} `}</style>
              <LeafletZonesInner
                zones={zones}
                visibleZoneIds={[...visibleZones]}
                selectedZoneId={selectedZone?.id || null}
                normalizePolygon={normalizePolygon}
                isDrawing={isDrawing}
                drawingPoints={drawingPoints}
                onAddDrawingPoint={(p: [number, number]) => setDrawingPoints(prev => [...prev, p])}
                onSelectZone={(id: string) => {
                  const z = zones.find(z => z.id === id); if (z) selectZone(z)
                }}
                isEditingVertices={isEditingVertices}
                onVertexDrag={handleVertexDrag}
              />
              {selectedZone && !isDrawing && (
                <div className="absolute bottom-2 left-2 z-[1100] flex gap-2 pointer-events-auto">
                  <Button size="sm" variant={isEditingVertices ? "default" : "outline"} onClick={() => setIsEditingVertices(v => !v)}>
                    {isEditingVertices ? "Terminar edición" : "Editar vértices"}
                  </Button>
                  {isEditingVertices && (
                    <Button size="sm" onClick={saveExistingChanges} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white">
                      {isSaving ? "Guardando..." : "Guardar cambios"}
                    </Button>
                  )}
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
                    <span>Zonas ({zones.length})</span>
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
                      <p className="text-xs">Crea zonas con posición absoluta</p>
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
                              {normalizePolygon(zone.poligono).length} puntos
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
                Cerrar
              </Button>
              {!isDrawing && selectedZone && !isEditingVertices && (
                <Button variant="outline" onClick={saveExistingChanges} disabled={isSaving} className="flex-1">
                  {isSaving ? "Guardando..." : "Guardar Datos"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

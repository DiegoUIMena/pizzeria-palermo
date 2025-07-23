"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { MapPin, Navigation, ZoomIn, ZoomOut, Layers } from "lucide-react"
import { deliveryZones, detectarZonaCliente, type DeliveryZone } from "../../lib/delivery-zones"
import SimulatedMap from "./SimulatedMap"

interface GoogleMapModalProps {
  isOpen: boolean
  onClose: () => void
  onLocationSelect: (lat: number, lng: number, address?: string) => void
  initialLocation?: { lat: number; lng: number }
  showDeliveryZones?: boolean
  address?: string
}

export default function GoogleMapModal({
  isOpen,
  onClose,
  onLocationSelect,
  initialLocation,
  showDeliveryZones = false,
  address,
}: GoogleMapModalProps) {
  // Coordenadas del centro de Los Andes
  const LOS_ANDES_CENTER = { lat: -32.8347, lng: -70.5983 }

  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(
    initialLocation || LOS_ANDES_CENTER,
  )
  const [zoom, setZoom] = useState(15)
  const [showZones, setShowZones] = useState(showDeliveryZones)
  const [currentZone, setCurrentZone] = useState<DeliveryZone | null>(null)
  const [mapType, setMapType] = useState<"roadmap" | "satellite">("roadmap")

  useEffect(() => {
    if (selectedLocation) {
      const resultado = detectarZonaCliente(selectedLocation.lat, selectedLocation.lng)
      setCurrentZone(resultado.zona)
    }
  }, [selectedLocation])

  const handleMapClick = (lat: number, lng: number) => {
    setSelectedLocation({ lat, lng })
  }

  const handleConfirmLocation = async () => {
    if (selectedLocation) {
      // Intentar obtener la dirección
      try {
        const address = await reverseGeocode(selectedLocation.lat, selectedLocation.lng)
        onLocationSelect(selectedLocation.lat, selectedLocation.lng, address)
      } catch (error) {
        onLocationSelect(selectedLocation.lat, selectedLocation.lng)
      }
      onClose()
    }
  }

  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=es`,
      )
      const data = await response.json()

      if (data.display_name) {
        const addressParts = data.display_name.split(",")
        return addressParts.slice(0, 3).join(", ")
      }
      return ""
    } catch (error) {
      console.error("Error en geocodificación:", error)
      return ""
    }
  }

  const centerOnLosAndes = () => {
    setSelectedLocation(LOS_ANDES_CENTER)
    setZoom(15)
  }

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setSelectedLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          })
        },
        (error) => {
          console.error("Error obteniendo ubicación:", error)
          alert("No se pudo obtener tu ubicación actual")
        },
      )
    }
  }

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] p-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="flex items-center space-x-2">
            <MapPin className="h-5 w-5 text-pink-600" />
            <span>Seleccionar Ubicación en Los Andes</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex h-full">
          {/* Mapa Simulado */}
          <div className="flex-1 relative h-full">
            <SimulatedMap
              center={selectedLocation || LOS_ANDES_CENTER}
              zoom={zoom}
              onMapClick={handleMapClick}
              marker={selectedLocation}
              showDeliveryZones={showZones}
              deliveryZones={deliveryZones}
              mapType={mapType}
            />
          </div>

          {/* Panel lateral */}
          <div className="w-80 border-l bg-gray-50 p-4 space-y-4 overflow-y-auto">
            <div>
              <h3 className="font-semibold text-lg mb-2">Información de Ubicación</h3>
              {selectedLocation ? (
                <div className="space-y-2">
                  <div className="bg-white p-3 rounded-lg border">
                    <p className="text-sm font-medium text-gray-600">Coordenadas:</p>
                    <p className="text-sm">
                      {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
                    </p>
                  </div>

                  {address && (
                    <div className="bg-white p-3 rounded-lg border">
                      <p className="text-sm font-medium text-gray-600">Dirección:</p>
                      <p className="text-sm">{address}</p>
                    </div>
                  )}

                  {currentZone && (
                    <div className="bg-white p-3 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-gray-600">Zona de Delivery:</p>
                        <Badge style={{ backgroundColor: currentZone.color }} className="text-white">
                          {currentZone.nombre}
                        </Badge>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Tarifa:</span>
                          <span className="font-medium">${currentZone.tarifa.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Tiempo:</span>
                          <span>{currentZone.tiempoEstimado}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Estado:</span>
                          <Badge variant={currentZone.disponible ? "default" : "destructive"}>
                            {currentZone.disponible ? "Disponible" : "No Disponible"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">Haz clic en el mapa para seleccionar una ubicación</p>
              )}
            </div>

            {/* Controles del mapa */}
            <div className="space-y-2">
              <h3 className="font-semibold text-lg mb-2">Controles del Mapa</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="outline" onClick={centerOnLosAndes}>
                  Centro Los Andes
                </Button>
                <Button size="sm" variant="outline" onClick={getCurrentLocation}>
                  <Navigation className="h-4 w-4 mr-1" />
                  Mi Ubicación
                </Button>
                <Button size="sm" variant="outline" onClick={() => setZoom(Math.min(18, zoom + 1))}>
                  <ZoomIn className="h-4 w-4 mr-1" />
                  Acercar
                </Button>
                <Button size="sm" variant="outline" onClick={() => setZoom(Math.max(10, zoom - 1))}>
                  <ZoomOut className="h-4 w-4 mr-1" />
                  Alejar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setMapType(mapType === "roadmap" ? "satellite" : "roadmap")}
                  className="col-span-1"
                >
                  <Layers className="h-4 w-4 mr-1" />
                  {mapType === "roadmap" ? "Satélite" : "Mapa"}
                </Button>
                {showDeliveryZones && (
                  <Button
                    size="sm"
                    variant="outline"
                    className={`col-span-1 ${showZones ? "bg-blue-100" : ""}`}
                    onClick={() => setShowZones(!showZones)}
                  >
                    {showZones ? "Ocultar" : "Mostrar"} Zonas
                  </Button>
                )}
              </div>
            </div>

            {showDeliveryZones && (
              <div>
                <h3 className="font-semibold text-lg mb-2">Zonas de Delivery</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {deliveryZones.map((zone) => (
                    <div
                      key={zone.id}
                      className={`p-2 rounded-lg border cursor-pointer transition-colors ${
                        currentZone?.id === zone.id ? "bg-blue-100 border-blue-300" : "bg-white hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: zone.color }} />
                          <span className="text-sm font-medium">{zone.nombre}</span>
                        </div>
                        <span className="text-xs text-gray-500">${zone.tarifa.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2 pt-4 border-t">
              <Button
                onClick={handleConfirmLocation}
                disabled={!selectedLocation}
                className="w-full bg-pink-600 hover:bg-pink-700 text-white"
              >
                Confirmar Ubicación
              </Button>
              <Button onClick={onClose} variant="outline" className="w-full">
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

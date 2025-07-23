"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Map } from "lucide-react"
import MapSelectionModal from "./MapSelectionModal"
import DeliveryZoneChecker from "./DeliveryZoneChecker"
import OpenStreetMapPicker from "./OpenStreetMapPicker"
import type { DeliveryZone } from "../../lib/delivery-zones"

interface LocationPickerProps {
  onLocationSelect: (lat: number, lng: number, address?: string) => void
  selectedLocation?: { lat: number; lng: number; address?: string } | null
  onDeliveryInfoChange?: (zone: DeliveryZone | null, tarifa: number, disponible: boolean) => void
}

export default function LocationPicker({
  onLocationSelect,
  selectedLocation,
  onDeliveryInfoChange,
}: LocationPickerProps) {
  const [showMapModal, setShowMapModal] = useState(false)

  const handleMapLocationSelect = (lat: number, lng: number, address?: string) => {
    onLocationSelect(lat, lng, address)
  }

  const openMapModal = () => {
    setShowMapModal(true)
  }

  const handleZoneChange = useCallback(
    (zone: DeliveryZone | null, tarifa: number, disponible: boolean) => {
      if (onDeliveryInfoChange) {
        onDeliveryInfoChange(zone, tarifa, disponible)
      }
    },
    [onDeliveryInfoChange],
  )

  const handleMapPickerLocationSelect = (lat: number, lng: number) => {
    // Intentar obtener la dirección
    reverseGeocode(lat, lng)
      .then((address) => {
        onLocationSelect(lat, lng, address)
      })
      .catch((error) => {
        onLocationSelect(lat, lng)
      })
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

  return (
    <div className="space-y-6">
      {/* Mapa Integrado */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Seleccionar Ubicación en el Mapa</Label>
        <OpenStreetMapPicker
          onLocationSelect={handleMapPickerLocationSelect}
          initialLocation={selectedLocation ? { lat: selectedLocation.lat, lng: selectedLocation.lng } : null}
          showDeliveryZones={true}
        />
      </div>

      {/* Verificador de Zona de Delivery - Mejorado visualmente */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Información de Entrega</Label>
        <DeliveryZoneChecker selectedLocation={selectedLocation} onZoneChange={handleZoneChange} />
      </div>

      {/* Modal del Mapa (para pantalla completa) */}
      <div className="space-y-3">
        <Button type="button" variant="outline" onClick={openMapModal} className="w-full">
          <Map className="w-4 h-4 mr-2" />
          Abrir mapa en pantalla completa
        </Button>
      </div>

      <MapSelectionModal
        isOpen={showMapModal}
        onClose={() => setShowMapModal(false)}
        onLocationSelect={handleMapLocationSelect}
        initialLocation={selectedLocation ? { lat: selectedLocation.lat, lng: selectedLocation.lng } : undefined}
        showDeliveryZones={true}
        address={selectedLocation?.address}
      />
    </div>
  )
}

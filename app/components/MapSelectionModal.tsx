"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { MapPin } from "lucide-react"
import OpenStreetMapPicker from "./OpenStreetMapPicker"

interface MapSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  onLocationSelect: (lat: number, lng: number, address?: string) => void
  initialLocation?: { lat: number; lng: number }
  showDeliveryZones?: boolean
  address?: string
}

export default function MapSelectionModal({
  isOpen,
  onClose,
  onLocationSelect,
  initialLocation,
  showDeliveryZones = true,
}: MapSelectionModalProps) {
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(initialLocation || null)
  const [address, setAddress] = useState<string>("")

  const handleLocationSelect = async (lat: number, lng: number) => {
    setSelectedLocation({ lat, lng })

    // Intentar obtener la dirección
    try {
      const address = await reverseGeocode(lat, lng)
      setAddress(address)
    } catch (error) {
      console.error("Error al obtener dirección:", error)
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

  const handleConfirmLocation = () => {
    if (selectedLocation) {
      onLocationSelect(selectedLocation.lat, selectedLocation.lng, address)
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] p-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="flex items-center space-x-2">
            <MapPin className="h-5 w-5 text-pink-600" />
            <span>Seleccionar Ubicación en Mapa de Los Andes</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col h-full">
          {/* Mapa OpenStreetMap */}
          <div className="flex-1 p-4">
            <OpenStreetMapPicker
              onLocationSelect={handleLocationSelect}
              initialLocation={initialLocation}
              showDeliveryZones={showDeliveryZones}
            />
          </div>

          {/* Botones de acción */}
          <div className="p-4 border-t flex justify-end space-x-2">
            <Button onClick={onClose} variant="outline">
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmLocation}
              disabled={!selectedLocation}
              className="bg-pink-600 hover:bg-pink-700 text-white"
            >
              Confirmar Ubicación
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

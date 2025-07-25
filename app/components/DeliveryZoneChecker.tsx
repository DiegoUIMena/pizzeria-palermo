"use client"

import { useEffect, useState } from "react"
import { detectarZonaCliente, type DeliveryZone } from "../../lib/delivery-zones"
import { Badge } from "@/components/ui/badge"
import { MapPin, AlertCircle } from "lucide-react"

interface DeliveryZoneCheckerProps {
  selectedLocation: { lat: number; lng: number; address?: string } | null | undefined
  onZoneChange?: (zone: DeliveryZone | null, tarifa: number, disponible: boolean) => void
}

export default function DeliveryZoneChecker({ selectedLocation, onZoneChange }: DeliveryZoneCheckerProps) {
  const [zona, setZona] = useState<DeliveryZone | null>(null)
  const [tarifa, setTarifa] = useState(0)
  const [disponible, setDisponible] = useState(false)

  useEffect(() => {
    if (selectedLocation) {
      const resultado = detectarZonaCliente(selectedLocation.lat, selectedLocation.lng)
      setZona(resultado.zona)
      setTarifa(resultado.tarifa)
      setDisponible(resultado.disponible)

      if (onZoneChange) {
        onZoneChange(resultado.zona, resultado.tarifa, resultado.disponible)
      }
    } else {
      setZona(null)
      setTarifa(0)
      setDisponible(false)

      if (onZoneChange) {
        onZoneChange(null, 0, false)
      }
    }
  }, [selectedLocation, onZoneChange])

  if (!selectedLocation) {
    return (
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-white p-2 rounded-full shadow-lg border border-amber-200 z-10 opacity-70 hover:opacity-100 transition-opacity duration-300">
        <div className="flex items-center">
          <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
          <span className="text-xs font-medium text-amber-600 ml-1">Selecciona ubicación</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-lg border ${disponible ? "border-green-200" : "border-red-200"} z-10 max-w-xs w-full transition-all duration-300`}>
      <div className="px-3 py-2 flex items-center justify-between">
        <div className="flex items-center">
          <MapPin className="h-4 w-4 text-gray-500 flex-shrink-0" />
          <span className="text-xs ml-1">
            {zona ? (
              <span>
                <span className="font-medium" style={{color: zona.color}}>{zona.nombre}</span>
                {disponible && <span className="ml-1">(${tarifa.toLocaleString()})</span>}
              </span>
            ) : (
              <span className="text-gray-600">Zona no detectada</span>
            )}
          </span>
        </div>
        <Badge variant={disponible ? "outline" : "destructive"} className="text-xs h-5 ml-1">
          {disponible ? "Disponible" : "No disponible"}
        </Badge>
      </div>
    </div>
  )
}
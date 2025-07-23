"use client"

import { useEffect, useState } from "react"
import { detectarZonaCliente, type DeliveryZone } from "../../lib/delivery-zones"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, Clock, Truck, AlertCircle } from "lucide-react"

interface DeliveryZoneCheckerProps {
  selectedLocation: { lat: number; lng: number } | null | undefined
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
      <Card className="border border-gray-200">
        <CardContent className="p-4 text-center">
          <div className="flex items-center justify-center text-amber-500 mb-2">
            <AlertCircle className="h-5 w-5 mr-2" />
            <span className="font-medium">Selecciona una ubicación</span>
          </div>
          <p className="text-sm text-gray-500">
            Haz clic en el mapa para seleccionar tu ubicación y verificar la disponibilidad de delivery.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={`border ${disponible ? "border-green-200" : "border-red-200"}`}>
      <CardContent className="p-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {/* Información de la zona */}
          <div className="p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium flex items-center">
                  <MapPin className="h-4 w-4 mr-1" />
                  Zona de Entrega
                </h3>
                {zona && (
                  <Badge style={{ backgroundColor: zona.color }} className="text-white">
                    {zona.nombre}
                  </Badge>
                )}
              </div>

              <div className="space-y-2">
                {zona ? (
                  <>
                    <p className="text-sm flex items-center">
                      <Truck className="h-4 w-4 mr-1 text-gray-500" />
                      <span className="text-gray-700">Tarifa de delivery:</span>
                      <span className="ml-1 font-medium">${tarifa.toLocaleString()}</span>
                    </p>
                    <p className="text-sm flex items-center">
                      <Clock className="h-4 w-4 mr-1 text-gray-500" />
                      <span className="text-gray-700">Tiempo estimado:</span>
                      <span className="ml-1 font-medium">{zona.tiempoEstimado}</span>
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500">No se detectó ninguna zona para esta ubicación.</p>
                )}
              </div>
            </div>

            <div className="mt-3">
              <Badge variant={disponible ? "outline" : "destructive"} className="w-full justify-center py-1">
                {disponible ? "Disponible para entrega" : "Fuera del área de cobertura"}
              </Badge>
            </div>
          </div>

          {/* Dirección seleccionada */}
          <div className={`p-4 ${disponible ? "bg-green-50" : "bg-red-50"} flex flex-col justify-between`}>
            <div>
              <h3 className="font-medium mb-2">Dirección seleccionada</h3>
              {selectedLocation.address ? (
                <p className="text-sm">{selectedLocation.address}</p>
              ) : (
                <p className="text-sm text-gray-500">Dirección no disponible</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Coordenadas: {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
              </p>
            </div>

            <div className="mt-3 text-xs">
              {disponible ? (
                <p className="text-green-600">
                  Tu pedido será entregado a esta dirección con un costo de delivery de ${tarifa.toLocaleString()}.
                </p>
              ) : (
                <p className="text-red-600">
                  Lo sentimos, no realizamos entregas en esta ubicación. Por favor, selecciona otra dirección dentro de
                  nuestras zonas de cobertura.
                </p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

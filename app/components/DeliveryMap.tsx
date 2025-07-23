"use client"

import { useEffect, useState } from "react"
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
})

interface DeliveryMapProps {
  onLocationSelect: (lat: number, lng: number, address?: string) => void
  initialPosition?: [number, number]
}

// Componente para manejar clics en el mapa
function MapClickHandler({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      const { lat, lng } = e.latlng
      onLocationSelect(lat, lng)
    },
  })
  return null
}

export default function DeliveryMap({ onLocationSelect, initialPosition }: DeliveryMapProps) {
  const [position, setPosition] = useState<[number, number]>(initialPosition || [-33.4489, -70.6693]) // Santiago, Chile por defecto
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  const handleLocationSelect = async (lat: number, lng: number) => {
    setPosition([lat, lng])

    // Intentar obtener la dirección usando geocodificación inversa (Nominatim - OpenStreetMap)
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      )
      const data = await response.json()

      let address = ""
      if (data.display_name) {
        // Extraer información relevante de la dirección
        const addressParts = data.display_name.split(",")
        address = addressParts.slice(0, 3).join(", ") // Tomar las primeras 3 partes
      }

      onLocationSelect(lat, lng, address)
    } catch (error) {
      console.error("Error al obtener la dirección:", error)
      onLocationSelect(lat, lng)
    }
  }

  // No renderizar en el servidor para evitar problemas de hidratación
  if (!isClient) {
    return (
      <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center">
        <p className="text-gray-500">Cargando mapa...</p>
      </div>
    )
  }

  return (
    <div className="w-full h-64 rounded-lg overflow-hidden border border-gray-200">
      <MapContainer center={position} zoom={15} style={{ height: "100%", width: "100%" }} className="z-0">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler onLocationSelect={handleLocationSelect} />
        <Marker position={position} />
      </MapContainer>
    </div>
  )
}

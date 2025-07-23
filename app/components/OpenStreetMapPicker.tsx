"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Navigation, ZoomIn, ZoomOut, Layers } from "lucide-react"
import { deliveryZones, detectarZonaCliente, type DeliveryZone } from "../../lib/delivery-zones"
import Script from "next/script"

interface OpenStreetMapPickerProps {
  onLocationSelect: (lat: number, lng: number, address?: string) => void
  initialLocation?: { lat: number; lng: number } | null
  showDeliveryZones?: boolean
}

export default function OpenStreetMapPicker({
  onLocationSelect,
  initialLocation,
  showDeliveryZones = true,
}: OpenStreetMapPickerProps) {
  // Coordenadas del centro de Los Andes
  const LOS_ANDES_CENTER = { lat: -32.8347, lng: -70.5983 }

  const mapRef = useRef<HTMLDivElement>(null)
  const leafletMapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const zonesLayerRef = useRef<any>(null)

  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(
    initialLocation || LOS_ANDES_CENTER,
  )
  const [zoom, setZoom] = useState(15)
  const [showZones, setShowZones] = useState(showDeliveryZones)
  const [currentZone, setCurrentZone] = useState<DeliveryZone | null>(null)
  const [isMapReady, setIsMapReady] = useState(false)
  const [isScriptLoaded, setIsScriptLoaded] = useState(false)
  const [address, setAddress] = useState<string>("")

  // Inicializar el mapa cuando los scripts estén cargados
  useEffect(() => {
    if (!isScriptLoaded || !mapRef.current || leafletMapRef.current) return

    const L = window.L
    if (!L) return

    try {
      // Crear el mapa
      const map = L.map(mapRef.current).setView(
        [selectedLocation?.lat || LOS_ANDES_CENTER.lat, selectedLocation?.lng || LOS_ANDES_CENTER.lng],
        zoom,
      )

      // Añadir capa de OpenStreetMap
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map)

      // Crear capa para las zonas de delivery
      zonesLayerRef.current = L.layerGroup().addTo(map)

      // Crear icono personalizado para el marcador
      const customIcon = L.divIcon({
        className: "custom-marker-icon",
        html: `<div class="w-8 h-8 bg-pink-600 rounded-full flex items-center justify-center animate-bounce shadow-lg border-2 border-white">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
              </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      })

      // Añadir marcador si hay una ubicación inicial
      if (selectedLocation) {
        markerRef.current = L.marker([selectedLocation.lat, selectedLocation.lng], { icon: customIcon }).addTo(map)
      }

      // Manejar clics en el mapa
      map.on("click", (e: any) => {
        const { lat, lng } = e.latlng
        handleMapClick(lat, lng)
      })

      // Manejar cambios de zoom
      map.on("zoomend", () => {
        setZoom(map.getZoom())
      })

      // Guardar referencia al mapa
      leafletMapRef.current = map

      // Actualizar zonas si es necesario
      if (showZones) {
        updateDeliveryZones()
      }

      setIsMapReady(true)
    } catch (error) {
      console.error("Error al inicializar el mapa:", error)
    }

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove()
        leafletMapRef.current = null
      }
    }
  }, [isScriptLoaded])

  // Actualizar el marcador cuando cambia la ubicación seleccionada
  useEffect(() => {
    if (!isMapReady || !leafletMapRef.current) return

    const L = window.L
    if (!L) return

    // Eliminar marcador existente
    if (markerRef.current) {
      markerRef.current.remove()
      markerRef.current = null
    }

    // Crear nuevo marcador si hay una ubicación
    if (selectedLocation) {
      // Icono personalizado para el marcador
      const customIcon = L.divIcon({
        className: "custom-marker-icon",
        html: `<div class="w-8 h-8 bg-pink-600 rounded-full flex items-center justify-center animate-bounce shadow-lg border-2 border-white">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
              </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      })

      markerRef.current = L.marker([selectedLocation.lat, selectedLocation.lng], { icon: customIcon }).addTo(
        leafletMapRef.current,
      )

      // Centrar el mapa en la ubicación seleccionada
      leafletMapRef.current.setView([selectedLocation.lat, selectedLocation.lng], zoom)

      // Actualizar zona actual
      const resultado = detectarZonaCliente(selectedLocation.lat, selectedLocation.lng)
      setCurrentZone(resultado.zona)

      // Obtener dirección
      reverseGeocode(selectedLocation.lat, selectedLocation.lng)
        .then((addr) => setAddress(addr))
        .catch((err) => console.error("Error al obtener dirección:", err))
    }
  }, [selectedLocation, isMapReady])

  // Actualizar zonas de delivery cuando cambia showZones
  useEffect(() => {
    if (isMapReady) {
      updateDeliveryZones()
    }
  }, [showZones, isMapReady])

  // Función para actualizar las zonas de delivery en el mapa
  const updateDeliveryZones = () => {
    if (!isMapReady || !leafletMapRef.current || !zonesLayerRef.current) return

    const L = window.L
    if (!L) return

    // Limpiar zonas existentes
    zonesLayerRef.current.clearLayers()

    // Si no se deben mostrar las zonas, salir
    if (!showZones) return

    // Añadir cada zona como un polígono
    deliveryZones.forEach((zone) => {
      if (!zone.poligono || zone.poligono.length < 3) return

      const polygon = L.polygon(zone.poligono, {
        color: zone.color,
        fillColor: zone.color,
        fillOpacity: 0.2,
        weight: 2,
      })

      // Añadir tooltip con información de la zona
      polygon.bindTooltip(
        `<div class="font-bold text-sm">${zone.nombre}</div>
         <div class="text-xs">Tarifa: $${zone.tarifa.toLocaleString()}</div>
         <div class="text-xs">Tiempo: ${zone.tiempoEstimado}</div>`,
        { sticky: true },
      )

      zonesLayerRef.current.addLayer(polygon)
    })
  }

  const handleMapClick = (lat: number, lng: number) => {
    setSelectedLocation({ lat, lng })
    onLocationSelect(lat, lng)
  }

  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=es`,
      )
      const data = await response.json()

      if (data.display_name) {
        const addressParts = data.display_name.split(",")
        const formattedAddress = addressParts.slice(0, 3).join(", ")
        return formattedAddress
      }
      return ""
    } catch (error) {
      console.error("Error en geocodificación:", error)
      return ""
    }
  }

  const centerOnLosAndes = () => {
    if (!isMapReady || !leafletMapRef.current) return
    leafletMapRef.current.setView([LOS_ANDES_CENTER.lat, LOS_ANDES_CENTER.lng], 15)
    setSelectedLocation(LOS_ANDES_CENTER)
    setZoom(15)
  }

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          setSelectedLocation({ lat: latitude, lng: longitude })
          if (isMapReady && leafletMapRef.current) {
            leafletMapRef.current.setView([latitude, longitude], 17)
          }
        },
        (error) => {
          console.error("Error obteniendo ubicación:", error)
          alert("No se pudo obtener tu ubicación actual")
        },
      )
    }
  }

  const handleZoomIn = () => {
    if (!isMapReady || !leafletMapRef.current) return
    const newZoom = Math.min(19, zoom + 1)
    leafletMapRef.current.setZoom(newZoom)
    setZoom(newZoom)
  }

  const handleZoomOut = () => {
    if (!isMapReady || !leafletMapRef.current) return
    const newZoom = Math.max(10, zoom - 1)
    leafletMapRef.current.setZoom(newZoom)
    setZoom(newZoom)
  }

  const toggleZones = () => {
    setShowZones(!showZones)
  }

  return (
    <div className="flex flex-col h-[400px] rounded-lg overflow-hidden border">
      {/* Cargar Leaflet CSS y JS */}
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
        crossOrigin=""
      />
      <Script
        src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
        integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
        crossOrigin=""
        onLoad={() => setIsScriptLoaded(true)}
      />

      {/* Controles del mapa */}
      <div className="bg-white p-2 border-b flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Button size="sm" variant="outline" onClick={centerOnLosAndes} className="text-xs">
            Centro Los Andes
          </Button>
          <Button size="sm" variant="outline" onClick={getCurrentLocation} className="text-xs">
            <Navigation className="h-3 w-3 mr-1" />
            Mi Ubicación
          </Button>
        </div>
        <div className="flex items-center space-x-2">
          <Button size="sm" variant="outline" onClick={handleZoomIn} className="px-2">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={handleZoomOut} className="px-2">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={toggleZones} className={`px-2 ${showZones ? "bg-blue-50" : ""}`}>
            <Layers className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Contenedor del mapa */}
      <div className="relative flex-1">
        <div ref={mapRef} className="w-full h-full" />

        {!isScriptLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Cargando mapa de Los Andes...</p>
            </div>
          </div>
        )}
      </div>

      {/* Información de ubicación - Simplificada */}
      {selectedLocation && (
        <div className="bg-white p-2 border-t flex flex-wrap items-center justify-between">
          <div className="flex items-center">
            {currentZone && (
              <Badge style={{ backgroundColor: currentZone.color }} className="text-white mr-2">
                {currentZone.nombre}
              </Badge>
            )}
            {address && <span className="text-xs text-gray-600 truncate max-w-[200px]">{address}</span>}
          </div>
          <div className="text-xs text-gray-500">Haz clic en el mapa para seleccionar tu ubicación</div>
        </div>
      )}
    </div>
  )
}

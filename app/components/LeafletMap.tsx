"use client"

import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import type { DeliveryZone } from "../../lib/delivery-zones"

interface LeafletMapProps {
  center: { lat: number; lng: number }
  zoom: number
  onMapClick: (lat: number, lng: number) => void
  marker?: { lat: number; lng: number } | null
  onZoomChange?: (zoom: number) => void
  onMapLoaded?: () => void
  showDeliveryZones?: boolean
  deliveryZones?: DeliveryZone[]
}

export default function LeafletMap({
  center,
  zoom,
  onMapClick,
  marker,
  onZoomChange,
  onMapLoaded,
  showDeliveryZones = false,
  deliveryZones = [],
}: LeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const zonesLayerRef = useRef<L.LayerGroup | null>(null)
  const [isMapInitialized, setIsMapInitialized] = useState(false)

  // Inicializar el mapa
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return // Evitar reinicialización

    try {
      // Configurar iconos por defecto de Leaflet
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      })

      // Crear el mapa
      const map = L.map(mapContainerRef.current, {
        center: [center.lat, center.lng],
        zoom: zoom,
        zoomControl: false, // Desactivamos los controles de zoom predeterminados
      })

      // Añadir capa de OpenStreetMap
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map)

      // Crear capa para las zonas de delivery
      zonesLayerRef.current = L.layerGroup().addTo(map)

      // Manejar clics en el mapa
      map.on("click", (e) => {
        const { lat, lng } = e.latlng
        onMapClick(lat, lng)
      })

      // Manejar cambios de zoom
      map.on("zoomend", () => {
        if (onZoomChange) {
          onZoomChange(map.getZoom())
        }
      })

      // Guardar referencia al mapa
      mapRef.current = map

      // Notificar que el mapa está cargado
      setIsMapInitialized(true)
      if (onMapLoaded) {
        onMapLoaded()
      }
    } catch (error) {
      console.error("Error al inicializar el mapa:", error)
    }

    // Limpiar al desmontar
    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        setIsMapInitialized(false)
      }
    }
  }, []) // Dependencia vacía para que se ejecute solo una vez

  // Actualizar centro y zoom del mapa
  useEffect(() => {
    if (!mapRef.current || !isMapInitialized) return

    mapRef.current.setView([center.lat, center.lng], zoom)
  }, [center, zoom, isMapInitialized])

  // Actualizar marcador
  useEffect(() => {
    if (!mapRef.current || !isMapInitialized) return

    // Eliminar marcador existente
    if (markerRef.current) {
      markerRef.current.remove()
      markerRef.current = null
    }

    // Crear nuevo marcador si hay una ubicación
    if (marker) {
      // Icono personalizado para el marcador
      const customIcon = L.divIcon({
        className: "custom-marker-icon",
        html: `<div class="w-8 h-8 bg-pink-600 rounded-full flex items-center justify-center animate-bounce shadow-lg border-2 border-white">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
              </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32], // Ancla en la punta inferior del marcador
      })

      markerRef.current = L.marker([marker.lat, marker.lng], { icon: customIcon }).addTo(mapRef.current)
    }
  }, [marker, isMapInitialized])

  // Renderizar zonas de delivery
  useEffect(() => {
    if (!mapRef.current || !isMapInitialized || !zonesLayerRef.current) return

    // Limpiar zonas existentes
    zonesLayerRef.current.clearLayers()

    // Si no se deben mostrar las zonas, salir
    if (!showDeliveryZones) return

    // Añadir cada zona como un polígono
    deliveryZones.forEach((zone) => {
      // Asegurarse de que 'poligono' existe y tiene al menos 3 puntos
      if (!zone.poligono || zone.poligono.length < 3) return

      const coordinates = zone.poligono.map(([lat, lng]) => [lat, lng] as [number, number])

      const polygon = L.polygon(coordinates, {
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
        { sticky: true, className: "custom-leaflet-tooltip" },
      )

      zonesLayerRef.current?.addLayer(polygon)
    })
  }, [deliveryZones, showDeliveryZones, isMapInitialized])

  return <div ref={mapContainerRef} className="w-full h-full z-0" />
}

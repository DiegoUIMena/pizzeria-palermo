"use client"

import { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Map, MapPin, RefreshCw } from "lucide-react"
import MapSelectionModal from "./MapSelectionModal"
import DeliveryZoneChecker from "./DeliveryZoneChecker"
import FixedMapPicker from "./FixedMapPicker"
import type { DeliveryZone } from "../../lib/delivery-zones"
import { detectarZonaCliente } from "../../lib/delivery-zones"
import { toast } from "@/hooks/use-toast"
import { useDeliveryZones } from "../../hooks/useDeliveryZones"

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
  const [localSelectedLocation, setLocalSelectedLocation] = useState<{ lat: number; lng: number; address?: string } | null>(
    selectedLocation || null
  )
  const [mapKey, setMapKey] = useState<number>(Date.now()) // Estado para forzar re-renderizado
  const [locationDebug, setLocationDebug] = useState<string>("")
  const [zoneStatus, setZoneStatus] = useState<{ name: string, available: boolean } | null>(null)
  
  // Obtener zonas de delivery desde Firestore
  const { zones, loading: loadingZones } = useDeliveryZones()

  // Efecto para inicializar el mapa automáticamente al cargar el componente
  useEffect(() => {
    console.log("LocationPicker montado - inicializando mapa automáticamente");
    
    // Reiniciar el mapa al cargar el componente con un pequeño retraso
    // para asegurar que todo esté listo
    const timer = setTimeout(() => {
      console.log("Ejecutando inicialización programada del mapa");
      const newMapKey = Date.now();
      console.log("Generando nuevo mapKey para inicialización:", newMapKey);
      setMapKey(newMapKey);
      
      // Verificar después de un momento si el mapa se ha inicializado correctamente
      setTimeout(() => {
        console.log("Verificando inicialización del mapa...");
        setLocationDebug("Mapa inicializado automáticamente");
      }, 1000);
    }, 500);
    
    return () => clearTimeout(timer);
  }, []); // Solo se ejecuta al montar el componente

  const handleMapLocationSelect = (lat: number, lng: number, address?: string) => {
    // Actualizar el estado local
    setLocalSelectedLocation({ lat, lng, address });
    // Notificar al componente padre
    onLocationSelect(lat, lng, address);
  }

  const openMapModal = () => {
    setShowMapModal(true)
  }
  
  // Función para reiniciar el mapa
  const resetMap = () => {
    console.log("Reiniciando mapa desde LocationPicker...");
    setLocationDebug("Mapa reiniciado");
    setLocalSelectedLocation(null); // Limpiar la ubicación local
    setZoneStatus(null); // Limpiar el estado de la zona
    
    // Forzar re-renderizado con un nuevo mapKey
    const newMapKey = Date.now();
    console.log("Generando nuevo mapKey:", newMapKey);
    setMapKey(newMapKey);
    
    // Esperar un momento y luego verificar si el mapa se ha reiniciado correctamente
    setTimeout(() => {
      console.log("Verificando reinicio del mapa...");
      // Esta línea nos ayuda a depurar si hay problemas
      setLocationDebug(prev => `${prev} | Verificando reinicio (${new Date().toLocaleTimeString()})`);
    }, 1000);
  }

  const handleZoneChange = useCallback(
    (zone: DeliveryZone | null, tarifa: number, disponible: boolean) => {
      if (onDeliveryInfoChange) {
        onDeliveryInfoChange(zone, tarifa, disponible)
      }
    },
    [onDeliveryInfoChange],
  )
  
  // Actualizar localSelectedLocation cuando cambia selectedLocation
  useEffect(() => {
    if (selectedLocation) {
      setLocalSelectedLocation(selectedLocation);
      
      // Verificar la zona al inicializar
      const { lat, lng } = selectedLocation;
      const result = detectarZonaCliente(lat, lng, zones);
      console.log("Verificando zona inicial:", result);
      
      setZoneStatus({
        name: result.zona?.nombre || "Fuera de zona",
        available: result.disponible
      });
      
      setLocationDebug(`Ubicación inicial: ${lat.toFixed(6)}, ${lng.toFixed(6)}${selectedLocation.address ? ` | ${selectedLocation.address}` : ''}`);
      
      if (onDeliveryInfoChange) {
        onDeliveryInfoChange(result.zona, result.tarifa, result.disponible);
      }
    }
  }, [selectedLocation, onDeliveryInfoChange]);

  const handleMapPickerLocationSelect = (lat: number, lng: number, address?: string) => {
    console.log("LocationPicker: ubicación seleccionada:", lat, lng, address);
    
    // Actualizar el estado local sin dirección inicialmente
    setLocalSelectedLocation({ lat, lng, address });
    
    // Verificar la zona de delivery inmediatamente
    const result = detectarZonaCliente(lat, lng, zones);
    console.log("Resultado de detección de zona:", result);
    
    // Actualizar estado de zona y mostrar aviso si la zona existe pero está inactiva
    if (result.zona) {
      if (!result.disponible) {
        toast({
          title: "Zona inactiva",
            description: `La zona "${result.zona.nombre}" actualmente no presta servicio de delivery.`,
          variant: "destructive"
        });
      }
      setZoneStatus({ name: result.zona.nombre, available: result.disponible });
    } else {
      setZoneStatus({ name: "Fuera de zona", available: result.disponible });
    }
    
    setLocationDebug(`Ubicación: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    
    // Notificar cambio de zona
    if (onDeliveryInfoChange) {
      onDeliveryInfoChange(result.zona, result.tarifa, result.disponible);
    }
    
    // Intentar obtener la dirección si no se proporcionó
    if (!address) {
      reverseGeocode(lat, lng)
        .then((addr) => {
          console.log("LocationPicker: dirección obtenida:", addr);
          // Actualizar debug info
          setLocationDebug(prev => `${prev} | Dirección: ${addr}`);
          
          // Actualizar con la dirección
          setLocalSelectedLocation(prev => prev ? { ...prev, address: addr } : { lat, lng, address: addr });
          onLocationSelect(lat, lng, addr);
        })
        .catch((error) => {
          console.error("Error al obtener dirección:", error);
          onLocationSelect(lat, lng);
        });
    } else {
      // Si ya tenemos la dirección, notificar inmediatamente
      console.log("LocationPicker: usando dirección proporcionada:", address);
      setLocationDebug(prev => `${prev} | Dirección: ${address}`);
      onLocationSelect(lat, lng, address);
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

  return (
    <div className="flex flex-col h-full">
      {/* Mapa Integrado con altura 100% para ajustarse al contenedor padre */}
      <div className="flex-1 relative" id="map-container">
        {mapKey && (
          <FixedMapPicker
            key={`location-map-${mapKey}`}
            onLocationSelect={handleMapPickerLocationSelect}
            initialLocation={localSelectedLocation ? { lat: localSelectedLocation.lat, lng: localSelectedLocation.lng } : null}
            showDeliveryZones={true}
          />
        )}
        
        {/* Panel de controles del mapa */}
        <div className="absolute top-2 left-2 z-50 flex flex-col gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={resetMap}
            className="bg-white hover:bg-gray-100 dark:bg-gray-800 shadow-md flex items-center gap-1 px-2 py-1 h-8"
            size="sm"
          >
            <RefreshCw className="h-3 w-3" />
            <span className="text-xs">Reiniciar</span>
          </Button>
          
          {/* Indicador de estado de zona */}
          {zoneStatus && (
            <div className={`text-xs px-2 py-1 rounded-md shadow-md flex items-center gap-1 ${
              zoneStatus.available 
                ? "bg-green-50 text-green-700 border border-green-200" 
                : "bg-red-50 text-red-700 border border-red-200"
            }`}>
              <MapPin className="h-3 w-3" />
              <span>{zoneStatus.name}</span>
              <span className="ml-1 font-semibold">
                {zoneStatus.available ? "(Disponible)" : "(No disponible)"}
              </span>
            </div>
          )}
          
          {/* Información de depuración */}
          {locationDebug && (
            <div className="bg-blue-50 text-blue-700 border border-blue-200 text-xs px-2 py-1 rounded-md shadow-md max-w-[200px] truncate">
              {locationDebug}
            </div>
          )}
        </div>
        
        {/* Botón de reinicio emergencia (visible solo si el mapa no carga) */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              console.log("⚠️ Reinicio de emergencia activado");
              // Resetear todo completamente
              setMapKey(Date.now() + 1000);
              setLocalSelectedLocation(null);
              setZoneStatus(null);
              
              // Forzar recarga del script de Leaflet
              const leafletScript = document.createElement('script');
              leafletScript.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
              document.head.appendChild(leafletScript);
              
              // Actualizar mensaje
              setLocationDebug("Reinicio de emergencia ejecutado");
            }}
            className="bg-red-600 hover:bg-red-700 text-white shadow-lg"
          >
            Forzar carga del mapa
          </Button>
        </div>
      </div>

      {/* Botón compacto para modal de mapa completo */}
      <div className="mt-2">
        <Button type="button" variant="outline" onClick={openMapModal} className="w-full text-sm h-8 px-3">
          <Map className="w-3 h-3 mr-1" />
          Ver mapa en pantalla completa
        </Button>
      </div>

      <MapSelectionModal
        isOpen={showMapModal}
        onClose={() => setShowMapModal(false)}
        onLocationSelect={handleMapLocationSelect}
        initialLocation={localSelectedLocation ? { lat: localSelectedLocation.lat, lng: localSelectedLocation.lng } : undefined}
        showDeliveryZones={true}
        address={localSelectedLocation?.address}
      />
    </div>
  )
}

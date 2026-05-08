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
  const [mapKey, setMapKey] = useState<number>(1) // Iniciar en 1 para que el mapa se renderice inmediatamente
  const [locationDebug, setLocationDebug] = useState<string>("")
  const [zoneStatus, setZoneStatus] = useState<{ name: string, available: boolean } | null>(null)
  const [showEmergencyButton, setShowEmergencyButton] = useState(false)
  
  // Obtener zonas de delivery desde Firestore
  const { zones, loading: loadingZones } = useDeliveryZones()

  // Log del estado del componente
  useEffect(() => {
    console.log("📍 LocationPicker - Estado actual:", { mapKey, showEmergencyButton });
  }, [mapKey, showEmergencyButton]);

  // Log cuando LocationPicker se monta
  useEffect(() => {
    console.log("🎭 LocationPicker MONTADO con mapKey:", mapKey);
    return () => {
      console.log("🎭 LocationPicker DESMONTADO");
    };
  }, []);

  // Mostrar botón de emergencia solo si el mapa no carga en 8 segundos (una sola vez)
  useEffect(() => {
    console.log("⏰ Iniciando timer para botón de emergencia");
    
    const timer = setTimeout(() => {
      console.log("⏰ Mostrando botón de emergencia por timeout");
      setShowEmergencyButton(true);
    }, 8000); // Aumentado a 8 segundos para dar más tiempo
    
    return () => {
      clearTimeout(timer);
    };
  }, []); // Solo ejecutar una vez al montar

  const handleMapLocationSelect = (lat: number, lng: number, address?: string) => {
    // Actualizar el estado local
    setLocalSelectedLocation({ lat, lng, address });

    // Calcular disponibilidad y tarifa igual que en el mapa principal
    const result = detectarZonaCliente(lat, lng, zones);
    let finalDisponible = false;
    let finalTarifa = 0;
    let zonaDetectada = result.zona;

    if (zonaDetectada) {
      finalDisponible = !!result.disponible;
      finalTarifa = finalDisponible ? result.tarifa : 0;
      setZoneStatus({ name: zonaDetectada.nombre, available: finalDisponible });
    } else {
      zonaDetectada = null;
      setZoneStatus({ name: "Fuera de zona", available: false });
    }

    if (onDeliveryInfoChange) {
      onDeliveryInfoChange(zonaDetectada, finalTarifa, finalDisponible);
    }

    // Notificar al componente padre
    onLocationSelect(lat, lng, address);
  }

  const openMapModal = () => {
    setShowMapModal(true)
  }
  
  // Función para reiniciar el mapa (solo en casos de emergencia)
  const resetMap = () => {
    console.log("🔄 REINICIANDO MAPA desde LocationPicker...");
    console.log("📊 Estado actual:", { mapKey, showEmergencyButton });
    setLocationDebug("Mapa reiniciado");
    setLocalSelectedLocation(null);
    setZoneStatus(null);
    const newMapKey = mapKey + 1;
    console.log(`🔑 Nuevo mapKey: ${newMapKey}`);
    setMapKey(newMapKey);
    setShowEmergencyButton(false); // Ocultar el botón después de usarlo
    
    // Mostrar nuevamente el botón si no se carga en 5 segundos
    setTimeout(() => {
      setShowEmergencyButton(true);
    }, 5000);
  }

  const handleZoneChange = useCallback(
    (zone: DeliveryZone | null, tarifa: number, disponible: boolean) => {
      if (onDeliveryInfoChange) {
        onDeliveryInfoChange(zone, tarifa, disponible)
      }
    },
    [onDeliveryInfoChange],
  )
  
  // Mantener sincronizado el estado local cuando selectedLocation cambie externamente
  useEffect(() => {
    if (selectedLocation) {
      const changed =
        !localSelectedLocation ||
        localSelectedLocation.lat !== selectedLocation.lat ||
        localSelectedLocation.lng !== selectedLocation.lng ||
        localSelectedLocation.address !== selectedLocation.address;

      if (!changed) return;

      console.log("🔍 Sincronizando ubicación seleccionada desde props");
      setLocalSelectedLocation(selectedLocation);

      const { lat, lng } = selectedLocation;
      const result = detectarZonaCliente(lat, lng, zones);
      console.log("Verificando zona sincronizada:", result);

      setZoneStatus({
        name: result.zona?.nombre || "Fuera de zona",
        available: !!(result.zona && result.disponible),
      });

      setLocationDebug(`Ubicación inicial: ${lat.toFixed(6)}, ${lng.toFixed(6)}${selectedLocation.address ? ` | ${selectedLocation.address}` : ''}`);

      if (onDeliveryInfoChange) {
        const zona = result.zona || null;
        const disponible = !!(result.zona && result.disponible);
        const tarifa = disponible ? result.tarifa : 0;
        onDeliveryInfoChange(zona, tarifa, disponible);
      }
    }
  }, [selectedLocation, localSelectedLocation, zones, onDeliveryInfoChange]);

  const handleMapPickerLocationSelect = (lat: number, lng: number, address?: string) => {
    console.log("LocationPicker: ubicación seleccionada:", lat, lng, address);
    
    // Actualizar el estado local sin dirección inicialmente
    setLocalSelectedLocation({ lat, lng, address });
    
    // Verificar la zona de delivery inmediatamente (sin aceptar fallback fuera de zonas preestablecidas)
    const result = detectarZonaCliente(lat, lng, zones);
    console.log("Resultado de detección de zona:", result);

    let finalDisponible = false;
    let finalTarifa = 0;
    let zonaDetectada = result.zona;

    if (zonaDetectada) {
      if (!result.disponible) {
        toast({
          title: "Zona inactiva",
          description: `La zona "${zonaDetectada.nombre}" actualmente no presta servicio de delivery.`,
          variant: "destructive"
        });
        finalDisponible = false;
      } else {
        finalDisponible = true;
        finalTarifa = result.tarifa;
      }
      setZoneStatus({ name: zonaDetectada.nombre, available: finalDisponible });
    } else {
      // Si no pertenece a una zona definida, consideramos no disponible aunque la función devuelva disponible por fallback
      toast({
        title: "Fuera de zonas de delivery",
        description: "Selecciona un punto dentro de las zonas de cobertura establecidas.",
        variant: "destructive"
      });
      finalDisponible = false;
      setZoneStatus({ name: "Fuera de zona", available: false });
      zonaDetectada = null;
    }
    
    setLocationDebug(`Ubicación: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    
    // Notificar cambio de zona
    if (onDeliveryInfoChange) {
      onDeliveryInfoChange(zonaDetectada, finalTarifa, finalDisponible);
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
        {mapKey ? (
          <FixedMapPicker
            key={`location-map-${mapKey}`}
            onLocationSelect={handleMapPickerLocationSelect}
            initialLocation={localSelectedLocation ? { lat: localSelectedLocation.lat, lng: localSelectedLocation.lng } : null}
            showDeliveryZones={true}
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-gray-100">
            <p className="text-gray-600">Preparando mapa...</p>
          </div>
        )}
        
        {/* Indicador de estado de zona */}
        <div className="absolute top-2 left-2 z-50 flex flex-col gap-2">
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
        </div>
        
        {/* Botón de emergencia (visible solo si el mapa no carga después de 5 segundos) */}
        {showEmergencyButton && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
            <div className="bg-white p-4 rounded-lg shadow-xl border-2 border-red-500">
              <p className="text-sm text-gray-700 mb-3 text-center">¿El mapa no carga correctamente?</p>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  console.log("⚠️ Reinicio de emergencia activado");
                  resetMap();
                }}
                className="bg-red-600 hover:bg-red-700 text-white shadow-lg w-full"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reintentar carga
              </Button>
            </div>
          </div>
        )}
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

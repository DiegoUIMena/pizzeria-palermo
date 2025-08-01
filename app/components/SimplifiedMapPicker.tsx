"use client";

import { useState, useEffect, useRef } from "react";
import Script from "next/script";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Navigation, ZoomIn, ZoomOut, Layers } from "lucide-react";
import { deliveryZones, detectarZonaCliente, type DeliveryZone } from "../../lib/delivery-zones";
import { useDeliveryZones } from "../../hooks/useDeliveryZones";

// Declaración de tipo para Window con Leaflet
declare global {
  interface Window {
    L: any;
  }
}

interface SimplifiedMapPickerProps {
  onLocationSelect: (lat: number, lng: number, address?: string) => void;
  initialLocation?: { lat: number; lng: number } | null;
  showDeliveryZones?: boolean;
}

export default function SimplifiedMapPicker({
  onLocationSelect,
  initialLocation,
  showDeliveryZones = true,
}: SimplifiedMapPickerProps) {
  // Coordenadas del centro de Los Andes
  const LOS_ANDES_CENTER = { lat: -32.8347, lng: -70.5983 };

  // Referencias
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const zonesLayerRef = useRef<any>(null);

  // Estados
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [mapInitialized, setMapInitialized] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{lat: number; lng: number} | null>(
    initialLocation || null
  );
  
  // Obtener zonas de delivery desde Firestore
  const { zones: firestoreZones, loading: loadingZones } = useDeliveryZones();
  const [zoom, setZoom] = useState(15);
  const [showZones, setShowZones] = useState(showDeliveryZones);
  const [currentZone, setCurrentZone] = useState<DeliveryZone | null>(null);
  const [address, setAddress] = useState<string>("");
  const [initAttempts, setInitAttempts] = useState(0);

  // Inicializar mapa cuando el script esté cargado
  useEffect(() => {
    if (!scriptLoaded || !mapContainerRef.current) return;

    console.log("Intentando inicializar mapa...");
    
    // Función para inicializar el mapa
    const initializeMap = () => {
      // Verificar si Leaflet está disponible
      if (!window.L) {
        console.error("Leaflet no está disponible después de cargar script");
        if (initAttempts < 3) {
          // Intentar de nuevo después de un retraso
          setTimeout(() => {
            setInitAttempts(prev => prev + 1);
          }, 500);
        }
        return;
      }

      // Limpiar el mapa existente si hay uno
      if (mapInstanceRef.current) {
        try {
          console.log("Limpiando mapa existente...");
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
          
          // Asegurarnos de limpiar también el contenedor
          if (mapContainerRef.current) {
            while (mapContainerRef.current.firstChild) {
              mapContainerRef.current.removeChild(mapContainerRef.current.firstChild);
            }
          }
        } catch (err) {
          console.error("Error al limpiar mapa existente:", err);
        }
      }

      try {
        // Crear el mapa
        const map = window.L.map(mapContainerRef.current).setView(
          [selectedLocation?.lat || LOS_ANDES_CENTER.lat, selectedLocation?.lng || LOS_ANDES_CENTER.lng],
          zoom
        );

        // Añadir la capa de tiles
        window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);

        // Crear capa para zonas de delivery
        zonesLayerRef.current = window.L.layerGroup().addTo(map);

      // Crear icono personalizado para el marcador
      const customIcon = window.L.divIcon({
        className: "custom-marker-icon",
        html: `<div class="w-8 h-8 bg-pink-600 dark:bg-pink-700 rounded-full flex items-center justify-center shadow-lg border-2 border-white dark:border-gray-800">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
              </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });        // Añadir marcador si hay ubicación inicial
        if (selectedLocation) {
          markerRef.current = window.L.marker(
            [selectedLocation.lat, selectedLocation.lng], 
            { icon: customIcon }
          ).addTo(map);
        }

        // Manejar clics en el mapa
        map.on("click", (e: any) => {
          const { lat, lng } = e.latlng;
          handleMapClick(lat, lng);
        });

        // Guardar referencia al mapa
        mapInstanceRef.current = map;
        
        // Forzar un reajuste del tamaño del mapa
        setTimeout(() => {
          if (map && typeof map.invalidateSize === 'function') {
            map.invalidateSize(true);
          }
        }, 200);

        // Actualizar zonas si es necesario
        if (showZones) {
          updateDeliveryZones();
        }

        setMapInitialized(true);
        console.log("Mapa inicializado correctamente");
      } catch (error) {
        console.error("Error al inicializar mapa:", error);
      }
    };

    // Inicializar el mapa
    initializeMap();

    // Limpieza al desmontar
    return () => {
      if (mapInstanceRef.current) {
        try {
          // Eliminar eventos
          mapInstanceRef.current.off();
          // Eliminar marcador
          if (markerRef.current) {
            markerRef.current.remove();
            markerRef.current = null;
          }
          // Eliminar capa de zonas
          if (zonesLayerRef.current) {
            zonesLayerRef.current.clearLayers();
            zonesLayerRef.current = null;
          }
          // Eliminar mapa
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
          
          console.log("Mapa eliminado correctamente durante limpieza");
        } catch (err) {
          console.error("Error durante la limpieza del mapa:", err);
        }
      }
      setMapInitialized(false);
    };
  }, [scriptLoaded, initAttempts, selectedLocation?.lat, selectedLocation?.lng]);

  // Función para actualizar zonas de delivery
  const updateDeliveryZones = () => {
    if (!mapInitialized || !mapInstanceRef.current || !zonesLayerRef.current) return;

    // Limpiar zonas existentes
    zonesLayerRef.current.clearLayers();

    // Si no se deben mostrar las zonas, salir
    if (!showZones) return;

    // Usar las zonas de Firestore si están disponibles, o las zonas por defecto si no
    const zones = firestoreZones && firestoreZones.length > 0 ? firestoreZones : deliveryZones;

    // Añadir cada zona como un polígono
    zones.forEach((zone) => {
      if (!zone.poligono || zone.poligono.length < 3) return;

      const polygon = window.L.polygon(zone.poligono, {
        color: zone.color,
        fillColor: zone.color,
        fillOpacity: 0.2,
        weight: 2,
      });

      // Añadir tooltip con información de la zona
      polygon.bindTooltip(
        `<div class="font-bold text-sm">${zone.nombre}</div>
         <div class="text-xs">Tarifa: $${zone.tarifa.toLocaleString()}</div>
         <div class="text-xs">Tiempo: ${zone.tiempoEstimado}</div>`,
        { sticky: true }
      );

      zonesLayerRef.current.addLayer(polygon);
    });
  };

  // Actualizar zonas cuando cambia showZones
  useEffect(() => {
    if (mapInitialized) {
      updateDeliveryZones();
    }
  }, [showZones, mapInitialized]);

  // Manejar clic en el mapa
  const handleMapClick = (lat: number, lng: number) => {
    setSelectedLocation({ lat, lng });
    
    // Actualizar marcador
    if (mapInitialized && mapInstanceRef.current) {
      // Eliminar marcador existente
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      
      // Crear nuevo marcador
      const customIcon = window.L.divIcon({
        className: "custom-marker-icon",
        html: `<div class="w-8 h-8 bg-pink-600 dark:bg-pink-700 rounded-full flex items-center justify-center shadow-lg border-2 border-white dark:border-gray-800">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
              </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });
      
      markerRef.current = window.L.marker([lat, lng], { icon: customIcon }).addTo(mapInstanceRef.current);
      
      // Centrar mapa en la ubicación
      mapInstanceRef.current.setView([lat, lng], zoom);
    }
    
    // Actualizar zona actual
    const resultado = detectarZonaCliente(lat, lng, firestoreZones);
    setCurrentZone(resultado.zona);
    
    // Obtener dirección
    reverseGeocode(lat, lng)
      .then((addr) => {
        setAddress(addr);
        onLocationSelect(lat, lng, addr);
      })
      .catch((err) => {
        console.error("Error al obtener dirección:", err);
        onLocationSelect(lat, lng);
      });
  };

  // Geocodificación inversa
  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=es`
      );
      const data = await response.json();

      if (data.display_name) {
        const addressParts = data.display_name.split(",");
        const formattedAddress = addressParts.slice(0, 3).join(", ");
        return formattedAddress;
      }
      return "";
    } catch (error) {
      console.error("Error en geocodificación:", error);
      return "";
    }
  };

  // Centrar en Los Andes
  const centerOnLosAndes = () => {
    if (!mapInitialized || !mapInstanceRef.current) return;
    
    // Actualizamos la ubicación seleccionada
    const newLocation = { lat: LOS_ANDES_CENTER.lat, lng: LOS_ANDES_CENTER.lng };
    setSelectedLocation(newLocation);
    
    // Centrar el mapa
    mapInstanceRef.current.setView([newLocation.lat, newLocation.lng], 15);
    setZoom(15);
    
    // Actualizar el marcador
    handleMapClick(newLocation.lat, newLocation.lng);
  };

  // Obtener ubicación actual
  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          // En lugar de solo actualizar el estado, usamos handleMapClick para actualizar todo correctamente
          handleMapClick(latitude, longitude);
        },
        (error) => {
          console.error("Error obteniendo ubicación:", error);
          alert("No se pudo obtener tu ubicación actual");
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      alert("Tu navegador no soporta geolocalización");
    }
  };

  // Zoom In
  const handleZoomIn = () => {
    if (!mapInitialized || !mapInstanceRef.current) return;
    const newZoom = Math.min(19, zoom + 1);
    mapInstanceRef.current.setZoom(newZoom);
    setZoom(newZoom);
  };

  // Zoom Out
  const handleZoomOut = () => {
    if (!mapInitialized || !mapInstanceRef.current) return;
    const newZoom = Math.max(10, zoom - 1);
    mapInstanceRef.current.setZoom(newZoom);
    setZoom(newZoom);
  };

  // Alternar zonas
  const toggleZones = () => {
    setShowZones(!showZones);
  };

  // Reiniciar el mapa
  const resetMap = () => {
    console.log("Reiniciando mapa...");
    
    // Eliminar referencias del mapa actual
    if (mapInstanceRef.current) {
      try {
        // Eliminar eventos
        mapInstanceRef.current.off();
        // Eliminar marcador
        if (markerRef.current) {
          markerRef.current.remove();
          markerRef.current = null;
        }
        // Eliminar capa de zonas
        if (zonesLayerRef.current) {
          zonesLayerRef.current.clearLayers();
          zonesLayerRef.current = null;
        }
        // Eliminar mapa
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      } catch (err) {
        console.error("Error al eliminar mapa:", err);
      }
    }
    
    // Limpiar el contenedor del mapa
    if (mapContainerRef.current) {
      while (mapContainerRef.current.firstChild) {
        mapContainerRef.current.removeChild(mapContainerRef.current.firstChild);
      }
    }
    
    // Reiniciar estados
    setMapInitialized(false);
    setInitAttempts(0);
    
    // Forzar la recarga del script
    setScriptLoaded(false);
    setTimeout(() => {
      setScriptLoaded(true);
    }, 100);
  };

  return (
    <div className="flex flex-col h-[400px] rounded-lg overflow-hidden border">
      {/* Cargar Leaflet CSS */}
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
        crossOrigin=""
      />
      
      {/* Cargar Leaflet JS */}
      <Script
        src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
        integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
        crossOrigin=""
        onLoad={() => {
          console.log("Script de Leaflet cargado correctamente");
          setScriptLoaded(true);
        }}
        onError={(e) => {
          console.error("Error al cargar script de Leaflet:", e);
        }}
      />

      {/* Controles del mapa */}
      <div className="bg-white dark:bg-gray-800 p-2 border-b dark:border-gray-700 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Button size="sm" variant="outline" onClick={centerOnLosAndes} className="text-xs dark:text-white dark:border-gray-600 dark:hover:bg-gray-700">
            Centro Los Andes
          </Button>
          <Button size="sm" variant="outline" onClick={getCurrentLocation} className="text-xs dark:text-white dark:border-gray-600 dark:hover:bg-gray-700">
            <Navigation className="h-3 w-3 mr-1" />
            Mi Ubicación
          </Button>
          <Button size="sm" variant="outline" onClick={resetMap} className="text-xs bg-gray-50 dark:bg-gray-700 dark:text-white dark:border-gray-600 dark:hover:bg-gray-600">
            Reiniciar Mapa
          </Button>
        </div>
        <div className="flex items-center space-x-2">
          <Button size="sm" variant="outline" onClick={handleZoomIn} className="px-2 dark:text-white dark:border-gray-600 dark:hover:bg-gray-700">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={handleZoomOut} className="px-2 dark:text-white dark:border-gray-600 dark:hover:bg-gray-700">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={toggleZones} className={`px-2 ${showZones ? "bg-blue-50 dark:bg-blue-900" : ""} dark:text-white dark:border-gray-600 dark:hover:bg-gray-700`}>
            <Layers className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Contenedor del mapa */}
      <div className="relative flex-1">
        <div ref={mapContainerRef} className="w-full h-full" />

        {!mapInitialized && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 dark:border-pink-400 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-300">Cargando mapa de Los Andes...</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {scriptLoaded 
                  ? "Inicializando mapa..."
                  : "Cargando script de Leaflet..."}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Información de ubicación */}
      {selectedLocation && (
        <div className="bg-white dark:bg-gray-800 p-2 border-t dark:border-gray-700 flex flex-wrap items-center justify-between">
          <div className="flex items-center">
            {currentZone && (
              <Badge style={{ backgroundColor: currentZone.color }} className="text-white mr-2">
                {currentZone.nombre}
              </Badge>
            )}
            {address && <span className="text-xs text-gray-600 dark:text-gray-300 truncate max-w-[200px]">{address}</span>}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Haz clic en el mapa para seleccionar tu ubicación</div>
        </div>
      )}
    </div>
  );
}

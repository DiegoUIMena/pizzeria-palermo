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

interface OpenStreetMapPickerProps {
  onLocationSelect: (lat: number, lng: number, address?: string) => void;
  initialLocation?: { lat: number; lng: number } | null;
  showDeliveryZones?: boolean;
}

export default function OpenStreetMapPicker({
  onLocationSelect,
  initialLocation,
  showDeliveryZones = true,
}: OpenStreetMapPickerProps) {
  // Coordenadas del centro de Los Andes
  const LOS_ANDES_CENTER = { lat: -32.8347, lng: -70.5983 };

  // Referencias
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const zonesLayerRef = useRef<any>(null);

  // Estados
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [isMapInitialized, setIsMapInitialized] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{lat: number; lng: number} | null>(
    initialLocation || LOS_ANDES_CENTER
  );
  const [zoom, setZoom] = useState(15);
  const [showZones, setShowZones] = useState(showDeliveryZones);
  const [currentZone, setCurrentZone] = useState<DeliveryZone | null>(null);
  const [address, setAddress] = useState<string>("");
  const [initAttempts, setInitAttempts] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const leafletLoadedRef = useRef<boolean>(false);
  
  // Obtener zonas de Firestore
  const { zones, loading, error } = useDeliveryZones();

  // Inicializar mapa cuando el script esté cargado
  useEffect(() => {
    if (!scriptLoaded || !mapContainerRef.current) return;

    console.log("Intentando inicializar mapa...");
    
    const timer = setTimeout(() => {
      initializeMap();
    }, 300);
    
    return () => clearTimeout(timer);
  }, [scriptLoaded, mapContainerRef.current]);

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
      console.log("Inicializando mapa...");
      
      // Limpiar mapa existente si hay uno
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      // Crear el mapa
      const map = window.L.map(mapContainerRef.current, {
        preferCanvas: true,
        attributionControl: false,
        zoomControl: false
      }).setView(
        [selectedLocation?.lat || LOS_ANDES_CENTER.lat, selectedLocation?.lng || LOS_ANDES_CENTER.lng],
        zoom
      );

      // Añadir capa de tiles
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(map);

      // Crear capa para zonas de delivery
      zonesLayerRef.current = window.L.layerGroup().addTo(map);

      // Crear icono personalizado para el marcador
      const customIcon = window.L.divIcon({
        className: "custom-marker-icon",
        html: `<div class="w-8 h-8 bg-pink-600 rounded-full flex items-center justify-center animate-bounce shadow-lg border-2 border-white">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
              </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });

      // Añadir marcador si hay ubicación
      if (selectedLocation) {
        // Icono personalizado más visible para el marcador
        const customIcon = window.L.divIcon({
          className: "custom-marker-icon",
          html: `<div class="w-10 h-10 bg-pink-600 rounded-full flex items-center justify-center animate-bounce shadow-lg border-4 border-white">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div class="w-4 h-4 bg-pink-600 rotate-45 absolute left-3 -bottom-1"></div>`,
          iconSize: [40, 48],
          iconAnchor: [20, 48],
        });

        // Añadir marcador de forma explícita con zIndex alto
        markerRef.current = window.L.marker(
          [selectedLocation.lat, selectedLocation.lng], 
          { 
            icon: customIcon,
            zIndexOffset: 1000 
          }
        );
        
        markerRef.current.addTo(map);
        console.log("Marcador inicial añadido en:", selectedLocation.lat, selectedLocation.lng);
      }

      // Manejar clics en el mapa
      map.on("click", (e: any) => {
        console.log("Click detectado en el mapa en posición:", e.latlng);
        const { lat, lng } = e.latlng;
        
        // Acción inmediata: actualizar marcador en el mapa
        if (markerRef.current) {
          markerRef.current.remove();
        }
        
        const customIcon = window.L.divIcon({
          className: "custom-marker-icon",
          html: `<div class="w-10 h-10 bg-pink-600 rounded-full flex items-center justify-center animate-bounce shadow-lg border-4 border-white">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div class="w-4 h-4 bg-pink-600 rotate-45 absolute left-3 -bottom-1"></div>`,
          iconSize: [40, 48],
          iconAnchor: [20, 48],
        });
        
        markerRef.current = window.L.marker([lat, lng], { 
          icon: customIcon,
          zIndexOffset: 1000
        }).addTo(map);
        
        // Actualizar estado después (evitamos la dependencia del efecto)
        handleMapClick(lat, lng);
      });

      // Manejar cambios de zoom
      map.on("zoomend", () => {
        setZoom(map.getZoom());
      });

      // Guardar referencia al mapa
      mapInstanceRef.current = map;
      
      // Forzar un reajuste del tamaño del mapa después de renderizar
      setTimeout(() => {
        if (map && typeof map.invalidateSize === 'function') {
          map.invalidateSize(true);
        }
      }, 300);

      // Actualizar zonas si es necesario
      if (showZones) {
        updateDeliveryZones();
      }

      setIsMapInitialized(true);
      console.log("Mapa inicializado correctamente");
    } catch (error) {
      console.error("Error al inicializar mapa:", error);
      setLoadError(`Error al inicializar el mapa: ${error}`);
    }
  };

  // Inicializar mapa cuando Leaflet esté disponible
  useEffect(() => {
    if (window.L && mapContainerRef.current && !isMapInitialized && leafletLoadedRef.current) {
      initializeMap();
    }
  }, [isMapInitialized, mapContainerRef.current]);

  // Limpiar al desmontar
  useEffect(() => {
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
    };
  }, []);

  // Actualizar el marcador cuando cambia la ubicación seleccionada
  useEffect(() => {
    if (!isMapInitialized || !mapInstanceRef.current || !window.L) return;

    try {
      // Eliminar marcador existente
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }

      // Crear nuevo marcador si hay una ubicación
      if (selectedLocation) {
        // Icono personalizado para el marcador
        const customIcon = window.L.divIcon({
          className: "custom-marker-icon",
          html: `<div class="w-10 h-10 bg-pink-600 rounded-full flex items-center justify-center animate-bounce shadow-lg border-4 border-white">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div class="w-4 h-4 bg-pink-600 rotate-45 absolute left-3 -bottom-1"></div>`,
          iconSize: [40, 48],
          iconAnchor: [20, 48],
        });

        // Añadir marcador de forma explícita
        markerRef.current = window.L.marker(
          [selectedLocation.lat, selectedLocation.lng], 
          { 
            icon: customIcon,
            zIndexOffset: 1000 // Asegurarse que esté por encima de otros elementos
          }
        );
        
        markerRef.current.addTo(mapInstanceRef.current);

        // Centrar el mapa en la ubicación seleccionada
        mapInstanceRef.current.setView([selectedLocation.lat, selectedLocation.lng], zoom);

        // Actualizar zona actual
        const resultado = detectarZonaCliente(selectedLocation.lat, selectedLocation.lng, zones);
        setCurrentZone(resultado.zona);

        // Obtener dirección
        reverseGeocode(selectedLocation.lat, selectedLocation.lng)
          .then((addr) => setAddress(addr))
          .catch((err) => console.error("Error al obtener dirección:", err));
          
        console.log("Marcador actualizado en:", selectedLocation.lat, selectedLocation.lng);
      }
    } catch (error) {
      console.error("Error al actualizar marcador:", error);
    }
  }, [selectedLocation, isMapInitialized, zoom]);

  // Función para actualizar zonas de delivery
  const updateDeliveryZones = () => {
    if (!isMapInitialized || !mapInstanceRef.current || !zonesLayerRef.current || !window.L) return;

    // Limpiar zonas existentes
    zonesLayerRef.current.clearLayers();

    // Si no se deben mostrar las zonas, salir
    if (!showZones) return;

    // Usar zonas de Firestore si están disponibles, de lo contrario usar las zonas por defecto
    const zonasAMostrar = zones && zones.length > 0 ? zones : deliveryZones;

    // Añadir cada zona como un polígono
    zonasAMostrar.forEach((zone) => {
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
    if (isMapInitialized) {
      updateDeliveryZones();
    }
  }, [showZones, isMapInitialized, zones]);

  // Manejar clic en el mapa
  const handleMapClick = (lat: number, lng: number) => {
    console.log(`Procesando ubicación: [${lat}, ${lng}]`);
    
    // Establecer la ubicación seleccionada
    setSelectedLocation({ lat, lng });
    
    // Actualizar zona actual
    const resultado = detectarZonaCliente(lat, lng, zones);
    console.log("Resultado de detección de zona:", resultado);
    setCurrentZone(resultado.zona);
    
    // Obtener dirección
    reverseGeocode(lat, lng)
      .then((addr) => {
        console.log("Dirección obtenida:", addr);
        setAddress(addr);
        
        // Notificar al componente padre de la selección con dirección
        setTimeout(() => {
          onLocationSelect(lat, lng, addr);
        }, 100); // Pequeño retraso para asegurar que el estado se actualice
      })
      .catch((err) => {
        console.error("Error al obtener dirección:", err);
        // Notificar al componente padre incluso sin dirección
        setTimeout(() => {
          onLocationSelect(lat, lng);
        }, 100);
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
    if (!isMapInitialized || !mapInstanceRef.current) return;
    mapInstanceRef.current.setView([LOS_ANDES_CENTER.lat, LOS_ANDES_CENTER.lng], 15);
    setSelectedLocation(LOS_ANDES_CENTER);
    setZoom(15);
  };

  // Obtener ubicación actual
  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setSelectedLocation({ lat: latitude, lng: longitude });
          if (isMapInitialized && mapInstanceRef.current) {
            mapInstanceRef.current.setView([latitude, longitude], 17);
          }
        },
        (error) => {
          console.error("Error obteniendo ubicación:", error);
          alert("No se pudo obtener tu ubicación actual");
        }
      );
    }
  };

  // Zoom In
  const handleZoomIn = () => {
    if (!isMapInitialized || !mapInstanceRef.current) return;
    const newZoom = Math.min(19, zoom + 1);
    mapInstanceRef.current.setZoom(newZoom);
    setZoom(newZoom);
  };

  // Zoom Out
  const handleZoomOut = () => {
    if (!isMapInitialized || !mapInstanceRef.current) return;
    const newZoom = Math.max(10, zoom - 1);
    mapInstanceRef.current.setZoom(newZoom);
    setZoom(newZoom);
  };

  // Alternar zonas
  const toggleZones = () => {
    setShowZones(!showZones);
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
      
      {/* Estilos personalizados para el marcador */}
      <style jsx global>{`
        .custom-marker-icon {
          background: transparent;
          border: none;
          z-index: 1000 !important; /* Forzar que esté por encima de todo */
        }
        .leaflet-marker-icon {
          z-index: 1000 !important;
        }
        .leaflet-marker-pane {
          z-index: 1000 !important;
        }
      `}</style>
      
      {/* Cargar Leaflet JS */}
      <Script
        src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
        integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
        crossOrigin=""
        onLoad={() => {
          console.log("Script de Leaflet cargado correctamente");
          setScriptLoaded(true);
          leafletLoadedRef.current = true;
        }}
        onError={(e) => {
          console.error("Error al cargar script de Leaflet:", e);
          setLoadError("Error al cargar Leaflet");
        }}
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
        <div ref={mapContainerRef} className="w-full h-full" />

        {!isMapInitialized && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Cargando mapa de Los Andes...</p>
              {loadError && (
                <p className="text-xs text-red-500 mt-2">{loadError}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Información de ubicación */}
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
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import Script from "next/script";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Navigation, ZoomIn, ZoomOut, Layers, RefreshCw } from "lucide-react";
import { deliveryZones, detectarZonaCliente, type DeliveryZone } from "../../lib/delivery-zones";

// Declaración de tipo para Window con Leaflet
declare global {
  interface Window {
    L: any;
  }
}

interface FixedMapPickerProps {
  onLocationSelect: (lat: number, lng: number, address?: string) => void;
  initialLocation?: { lat: number; lng: number } | null;
  showDeliveryZones?: boolean;
}

export default function FixedMapPicker({
  onLocationSelect,
  initialLocation,
  showDeliveryZones = true,
}: FixedMapPickerProps) {
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
  const [zoom, setZoom] = useState(15);
  const [showZones, setShowZones] = useState(showDeliveryZones);
  const [currentZone, setCurrentZone] = useState<DeliveryZone | null>(null);
  const [address, setAddress] = useState<string>("");
  const [initAttempts, setInitAttempts] = useState(0);

  // Inicializar mapa después de que el script esté cargado
  useEffect(() => {
    if (!scriptLoaded || !mapContainerRef.current) return;

    console.log("Script cargado, programando inicialización del mapa...");
    
    // Inicializar el mapa con un retardo para asegurar que el contenedor está correctamente dimensionado
    const timer = setTimeout(() => {
      console.log("Inicializando mapa después del retardo...");
      initializeMap();
    }, 300);
    
    return () => clearTimeout(timer);
  }, [scriptLoaded]);

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
      });
      
      // Añadir marcador si hay ubicación inicial
      if (selectedLocation) {
        markerRef.current = window.L.marker(
          [selectedLocation.lat, selectedLocation.lng], 
          { icon: customIcon }
        ).addTo(map);
      }

      // Manejar clics en el mapa
      map.on("click", (e: any) => {
        console.log("🗺️ Click en mapa detectado, coordenadas:", e.latlng);
        const { lat, lng } = e.latlng;
        // Asegurarse de que las coordenadas sean válidas
        if (isNaN(lat) || isNaN(lng)) {
          console.error("Coordenadas inválidas en el clic del mapa:", e.latlng);
          return;
        }
        // Usar el método handleMapClick para procesar el clic
        handleMapClick(lat, lng);
      });

      // Guardar referencia al mapa
      mapInstanceRef.current = map;
      
      // Establecer el estado como inicializado primero
      setMapInitialized(true);
      
      // Actualizar zonas si es necesario
      if (showZones) {
        updateDeliveryZones();
      }
      
      // Realizar múltiples intentos de ajuste del tamaño del mapa para asegurar que se renderice correctamente
      // Inmediatamente
      try {
        console.log("Ajuste inicial del mapa");
        map.invalidateSize({animate: false, pan: false});
      } catch (e) {
        console.error("Error al ajustar tamaño inicial del mapa:", e);
      }
      
      // Serie de intentos con retrasos crecientes
      [100, 300, 600, 1000].forEach(delay => {
        setTimeout(() => {
          try {
            if (mapInstanceRef.current) {
              console.log(`Ajustando tamaño del mapa (${delay}ms)...`);
              mapInstanceRef.current.invalidateSize({animate: false, pan: false});
            }
          } catch (e) {
            console.error(`Error al ajustar tamaño del mapa (${delay}ms):`, e);
          }
        }, delay);
      });
      
      console.log("Mapa inicializado correctamente");
    } catch (error) {
      console.error("Error al inicializar mapa:", error);
    }
  };

  // Inicializar el mapa
  useEffect(() => {
    // Solo intentar inicializar si el script está cargado pero el mapa no está inicializado
    if (scriptLoaded && !mapInitialized && initAttempts > 0) {
      initializeMap();
    }
  }, [scriptLoaded, mapInitialized, initAttempts]);

  // Limpieza al desmontar
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
      setMapInitialized(false);
    };
  }, []);

  // Función para actualizar zonas de delivery
  const updateDeliveryZones = () => {
    if (!mapInitialized || !mapInstanceRef.current || !zonesLayerRef.current) return;

    // Limpiar zonas existentes
    zonesLayerRef.current.clearLayers();

    // Si no se deben mostrar las zonas, salir
    if (!showZones) return;

    // Añadir cada zona como un polígono
    deliveryZones.forEach((zone) => {
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
    console.log(`🖱️ Clic en mapa: [${lat}, ${lng}]`);
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
      
      // Asegurarse de que el marcador se añada al mapa
      markerRef.current = window.L.marker([lat, lng], { icon: customIcon }).addTo(mapInstanceRef.current);
      
      // Centrar el mapa en la ubicación seleccionada
      mapInstanceRef.current.panTo([lat, lng]);
    }
    
    // Intentar obtener dirección
    try {
      fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=es`
      )
        .then((response) => response.json())
        .then((data) => {
          if (data && data.display_name) {
            const addressParts = data.display_name.split(",");
            const shortAddress = addressParts.slice(0, 3).join(", ");
            setAddress(shortAddress);
            
            // Notificar selección con dirección
            onLocationSelect(lat, lng, shortAddress);
          } else {
            // Notificar selección sin dirección
            onLocationSelect(lat, lng);
          }
        })
        .catch((error) => {
          console.error("Error al obtener dirección:", error);
          // Notificar selección sin dirección en caso de error
          onLocationSelect(lat, lng);
        });
    } catch (error) {
      console.error("Error en la solicitud de geocodificación inversa:", error);
      // Notificar selección sin dirección en caso de error
      onLocationSelect(lat, lng);
    }
    
    // Detectar zona
    const zoneResult = detectarZonaCliente(lat, lng);
    console.log("Resultado de detección de zona:", zoneResult);
    
    if (zoneResult.disponible && zoneResult.zona) {
      setCurrentZone(zoneResult.zona);
    } else {
      setCurrentZone(null);
    }
  };

  // Función para centrar en Los Andes
  const centerOnLosAndes = () => {
    if (mapInitialized && mapInstanceRef.current) {
      mapInstanceRef.current.setView([LOS_ANDES_CENTER.lat, LOS_ANDES_CENTER.lng], zoom);
    }
  };

  // Función para obtener ubicación actual
  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          
          // Actualizar mapa
          if (mapInitialized && mapInstanceRef.current) {
            mapInstanceRef.current.setView([latitude, longitude], zoom);
          }
          
          // Manejar clic para crear marcador
          handleMapClick(latitude, longitude);
        },
        (error) => {
          console.error("Error al obtener ubicación:", error);
          alert("No se pudo obtener tu ubicación. Por favor, selecciona manualmente en el mapa.");
        }
      );
    } else {
      alert("Tu navegador no soporta geolocalización. Por favor, selecciona manualmente en el mapa.");
    }
  };

  // Funciones de zoom
  const handleZoomIn = () => {
    if (mapInitialized && mapInstanceRef.current) {
      const newZoom = Math.min(zoom + 1, 19);
      setZoom(newZoom);
      mapInstanceRef.current.setZoom(newZoom);
    }
  };
  
  const handleZoomOut = () => {
    if (mapInitialized && mapInstanceRef.current) {
      const newZoom = Math.max(zoom - 1, 10);
      setZoom(newZoom);
      mapInstanceRef.current.setZoom(newZoom);
    }
  };
  
  // Alternar zonas
  const toggleZones = () => {
    setShowZones(!showZones);
  };
  
  // Reiniciar mapa
  const resetMap = () => {
    // Reiniciar ubicación
    setSelectedLocation(null);
    
    // Eliminar marcador si existe
    if (markerRef.current && mapInstanceRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
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
    <div className="flex flex-col h-full rounded-lg overflow-hidden border dark:border-gray-700">
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

      {/* Botón de reiniciar mapa grande y destacado */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
        <Button 
          onClick={resetMap} 
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-full px-4 py-2 shadow-lg flex items-center"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Reiniciar Mapa
        </Button>
      </div>
      
      {/* Controles del mapa - Versión responsiva mejorada */}
      <div className="absolute top-2 right-2 z-10 flex flex-col gap-2">
        <Button 
          size="sm" 
          variant="outline" 
          onClick={resetMap} 
          className="h-8 w-8 p-0 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:text-white dark:border-blue-700 dark:hover:bg-blue-800 rounded-full shadow-md"
          title="Reiniciar mapa"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button 
          size="sm" 
          variant="outline" 
          onClick={getCurrentLocation} 
          className="h-8 w-8 p-0 bg-white hover:bg-gray-100 dark:bg-gray-800 dark:text-white dark:border-gray-600 dark:hover:bg-gray-700 rounded-full shadow-md"
          title="Mi ubicación"
        >
          <Navigation className="h-4 w-4" />
        </Button>
        <Button 
          size="sm" 
          variant="outline" 
          onClick={handleZoomIn} 
          className="h-8 w-8 p-0 bg-white hover:bg-gray-100 dark:bg-gray-800 dark:text-white dark:border-gray-600 dark:hover:bg-gray-700 rounded-full shadow-md"
          title="Acercar"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button 
          size="sm" 
          variant="outline" 
          onClick={handleZoomOut} 
          className="h-8 w-8 p-0 bg-white hover:bg-gray-100 dark:bg-gray-800 dark:text-white dark:border-gray-600 dark:hover:bg-gray-700 rounded-full shadow-md"
          title="Alejar"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button 
          size="sm" 
          variant="outline" 
          onClick={toggleZones} 
          className={`h-8 w-8 p-0 ${showZones ? "bg-blue-100 hover:bg-blue-200 dark:bg-blue-900" : "bg-white hover:bg-gray-100 dark:bg-gray-800"} dark:text-white dark:border-gray-600 dark:hover:bg-gray-700 rounded-full shadow-md`}
          title="Mostrar/ocultar zonas"
        >
          <Layers className="h-4 w-4" />
        </Button>
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
    </div>
  );
}

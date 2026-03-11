"use client";

import { useState, useEffect, useRef } from "react";
import Script from "next/script";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Navigation, ZoomIn, ZoomOut, Layers, RefreshCw } from "lucide-react";
import { deliveryZones, detectarZonaCliente, type DeliveryZone } from "../../lib/delivery-zones";
import { toast } from "@/hooks/use-toast";
import { useDeliveryZones } from "../../hooks/useDeliveryZones";

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
  const redCircleMarkerRef = useRef<any>(null); // Referencia para el marcador circular rojo
  const zonesLayerRef = useRef<any>(null);

  // Estados
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [mapInitialized, setMapInitialized] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{lat: number; lng: number} | null>(
    initialLocation || null
  );
  const [selectedAddress, setSelectedAddress] = useState<string>("");
  const [mapTileLayer, setMapTileLayer] = useState<string>("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png");
  const [zoom, setZoom] = useState(15);
  const [showZones, setShowZones] = useState(showDeliveryZones);
  const [currentZone, setCurrentZone] = useState<DeliveryZone | null>(null);
  const [address, setAddress] = useState<string>("");
  const [initAttempts, setInitAttempts] = useState(0);
  
  // Obtener zonas de delivery desde Firestore
  const { zones: firestoreZones, loading: loadingZones } = useDeliveryZones();

  // Asegurar que el CSS de Leaflet esté cargado
  useEffect(() => {
    // Verificar si el CSS de Leaflet ya está cargado
    const leafletCssExists = Array.from(document.styleSheets).some(
      sheet => sheet.href && sheet.href.includes('leaflet.css')
    );
    
    if (!leafletCssExists) {
      console.log("📌 Añadiendo CSS de Leaflet al documento");
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      link.crossOrigin = '';
      document.head.appendChild(link);
    } else {
      console.log("✅ CSS de Leaflet ya está cargado");
    }
  }, []);

  // Log de montaje del componente
  useEffect(() => {
    console.log("🎬 FixedMapPicker MONTADO");
    console.log("📊 Estado inicial:", {
      scriptLoaded,
      mapInitialized,
      initAttempts,
      hasLeaflet: !!window.L,
      hasContainer: !!mapContainerRef.current
    });
    
    // Si Leaflet ya está disponible globalmente, marcarlo como cargado
    if (window.L && !scriptLoaded) {
      console.log("🔍 Leaflet ya estaba disponible globalmente, marcando script como cargado");
      setScriptLoaded(true);
    }
    
    return () => {
      console.log("🔚 FixedMapPicker DESMONTADO");
    };
  }, []);

  // Inicializar mapa cuando el script esté cargado
  useEffect(() => {
    // Verificar condiciones básicas
    if (!scriptLoaded) {
      console.log(`⏳ Esperando script: scriptLoaded=${scriptLoaded}`);
      return;
    }
    
    if (!mapContainerRef.current) {
      console.log("⏳ Esperando contenedor del mapa...");
      return;
    }

    // Si ya está inicializado, no hacer nada
    if (mapInitialized) {
      console.log("✅ Mapa ya inicializado, omitiendo");
      return;
    }

    console.log("🚀 FixedMapPicker - Todas las condiciones listas, iniciando proceso de carga...");
    
    // Si Leaflet ya está disponible globalmente, inicializar directamente
    if (window.L) {
      console.log("✅ Leaflet disponible globalmente, inicializando mapa inmediatamente");
      initializeMap();
    } else {
      // Si no está disponible, iniciar el sistema de reintentos
      console.warn("⚠️ Leaflet no disponible aún, iniciando sistema de reintentos");
      setInitAttempts(1);
    }
  }, [scriptLoaded, mapInitialized]); // Depender de scriptLoaded Y mapInitialized

  // Función para inicializar el mapa
  const initializeMap = () => {
    console.log("🔧 initializeMap() llamada");
    
    // Verificar si Leaflet está disponible
    if (!window.L) {
      console.error("❌ Leaflet no está disponible");
      if (initAttempts < 5) {
        console.log("⏭️ Programando reintento...");
        setTimeout(() => {
          setInitAttempts(prev => prev + 1);
        }, 300);
      }
      return;
    }

    // Verificar que el contenedor del mapa exista
    if (!mapContainerRef.current) {
      console.error("❌ Contenedor del mapa no disponible");
      return;
    }

    // Verificar que el contenedor del mapa tenga dimensiones
    const mapRect = mapContainerRef.current.getBoundingClientRect();
    console.log("📏 Dimensiones del contenedor:", {
      width: mapRect.width, 
      height: mapRect.height,
      top: mapRect.top,
      left: mapRect.left
    });
    
    if (mapRect.width === 0 || mapRect.height === 0) {
      console.error("❌ Contenedor tiene dimensiones cero");
      
      // Forzar un reintento después de un pequeño retraso
      if (initAttempts < 5) {
        console.log("⏭️ Programando reintento por dimensiones...");
        setTimeout(() => {
          setInitAttempts(prev => prev + 1);
        }, 300);
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
      console.log("🗺️ CREANDO NUEVA INSTANCIA DEL MAPA");
      
      // Crear el mapa con configuración simple y estable
      const map = window.L.map(mapContainerRef.current, {
        minZoom: 12,
        maxZoom: 18,
      }).setView(
        [selectedLocation?.lat || LOS_ANDES_CENTER.lat, selectedLocation?.lng || LOS_ANDES_CENTER.lng],
        zoom
      );

      console.log("🗺️ Instancia del mapa creada, añadiendo capa de tiles...");

      // Añadir la capa de tiles con configuración estándar de Leaflet
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18,
      }).addTo(map);
      
      console.log("✅ Capa de tiles añadida al mapa");

      // Crear capa para zonas de delivery
      zonesLayerRef.current = window.L.layerGroup().addTo(map);

      // No creamos aquí el icono personalizado, usaremos la función createMarkerIcon()
      // que garantiza consistencia en todo el componente
      
      // Añadir marcador si hay ubicación inicial
      if (selectedLocation) {
        console.log("Añadiendo marcador inicial en:", selectedLocation);
        const icon = createMarkerIcon();
        
        if (icon) {
          try {
            // Crear el marcador con el ícono estándar
            markerRef.current = window.L.marker(
              [selectedLocation.lat, selectedLocation.lng], 
              { icon: icon }
            ).addTo(map);
            
            // También añadir marcador circular rojo para mejor visibilidad
            redCircleMarkerRef.current = createRedCircleMarker({ 
              lat: selectedLocation.lat, 
              lng: selectedLocation.lng 
            });
            
            console.log("✅ Marcador inicial añadido correctamente");
            
            // Verificar que el marcador esté en el mapa
            if (markerRef.current && markerRef.current._map) {
              console.log("✅ Confirmado: el marcador inicial está en el mapa");
            } else {
              console.error("❌ Error: el marcador inicial no se añadió al mapa correctamente");
            }
          } catch (error) {
            console.error("❌ Error al añadir marcador inicial:", error);
          }
        }
      }

      // Manejar clics en el mapa
      map.on("click", (e: any) => {
        try {
          const { lat, lng } = e.latlng;
          
          // Validar coordenadas
          if (isNaN(lat) || isNaN(lng)) {
            console.error("Coordenadas inválidas:", e.latlng);
            return;
          }
          
          // Actualizar el marcador visual
          updateMarker(lat, lng);
          
          // Notificar cambio de ubicación
          handleMapClick(lat, lng);
          
        } catch (error) {
          console.error("Error al procesar clic en mapa:", error);
        }
      });

      // Guardar referencia al mapa
      mapInstanceRef.current = map;
      
      // Establecer el estado como inicializado primero
      setMapInitialized(true);
      
      // Actualizar zonas si es necesario
      if (showZones) {
        updateDeliveryZones();
      }
      
      // Ajustar tamaño del mapa una sola vez después de un pequeño delay
      setTimeout(() => {
        try {
          if (mapInstanceRef.current) {
            console.log("Ajustando tamaño del mapa...");
            mapInstanceRef.current.invalidateSize();
          }
        } catch (e) {
          console.error("Error al ajustar tamaño del mapa:", e);
        }
      }, 250);
      
      console.log("Mapa inicializado correctamente");
    } catch (error) {
      console.error("Error al inicializar mapa:", error);
    }
  };

  // Sistema de reintentos si la primera inicialización falla
  useEffect(() => {
    // Solo reintentar si no está inicializado y hay reintentos pendientes
    if (mapInitialized || initAttempts === 0 || initAttempts >= 5) {
      return;
    }

    console.log(`🔄 Reintento #${initAttempts} de inicialización del mapa`);
    
    // Delay progresivo: 200ms, 400ms, 600ms, 800ms
    const delay = initAttempts * 200;
    
    const timer = setTimeout(() => {
      if (window.L && scriptLoaded) {
        console.log(`✅ Intento #${initAttempts}: Leaflet disponible, inicializando...`);
        initializeMap();
      } else {
        console.warn(`⚠️ Intento #${initAttempts}: Leaflet aún no disponible`);
        setInitAttempts(prev => prev + 1);
      }
    }, delay);
    
    return () => clearTimeout(timer);
  }, [initAttempts, mapInitialized, scriptLoaded]);

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
          // Eliminar marcador circular rojo
          if (redCircleMarkerRef.current) {
            redCircleMarkerRef.current.remove();
            redCircleMarkerRef.current = null;
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

  // Función para crear un icono de marcador
  const createMarkerIcon = () => {
    if (!window.L) {
      console.error("❌ Leaflet no disponible para crear icono");
      return null;
    }
    
    try {
      // Usar un ícono Leaflet estándar para máxima compatibilidad
      return window.L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      });
    } catch (error) {
      console.error("❌ Error al crear icono de marcador:", error);
      return null;
    }
  };
  
  // Función para crear un marcador circular rojo para indicar la ubicación seleccionada
  const createRedCircleMarker = (coordinates: { lat: number; lng: number }) => {
    if (!window.L || !mapInstanceRef.current) {
      console.error("❌ No se puede crear marcador - mapa no disponible");
      return null;
    }
    
    try {
      // Crear marcador con icono predeterminado de Leaflet
      const marker = window.L.marker([coordinates.lat, coordinates.lng]).addTo(mapInstanceRef.current);
      return marker;
    } catch (error) {
      console.error("❌ Error al crear marcador:", error);
      return null;
    }
  };

  // Función para actualizar el marcador en el mapa
  const updateMarker = (lat: number, lng: number) => {
    if (!mapInstanceRef.current) {
      console.error("❌ No se puede actualizar marcador - mapa no disponible");
      return;
    }
    
    try {
      // Actualizar coordenadas en el estado
      setSelectedLocation({ lat, lng });
      
      // Eliminar marcador estándar si existe
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      
      // Eliminar marcador rojo si existe
      if (redCircleMarkerRef.current) {
        redCircleMarkerRef.current.remove();
        redCircleMarkerRef.current = null;
      }
      
      // Crear nuevo marcador en la posición actual
      const nuevoMarcador = createRedCircleMarker({ lat, lng });
      
      if (nuevoMarcador) {
        redCircleMarkerRef.current = nuevoMarcador;
      } else {
        console.error("❌ No se pudo crear el marcador");
      }
      
      // Centrar mapa en la nueva ubicación
      mapInstanceRef.current.panTo([lat, lng]);
      
    } catch (error) {
      console.error("❌ Error al actualizar marcador:", error);
    }
  };

  // Manejar clic en el mapa
  const handleMapClick = (lat: number, lng: number) => {
    console.log(`🖱️ Procesando clic en mapa: [${lat}, ${lng}]`);
    
    // Actualizar estado local
    setSelectedLocation({ lat, lng });
    
    // Detectar zona antes de intentar obtener dirección
    const zoneResult = detectarZonaCliente(lat, lng, firestoreZones);
    console.log("Resultado de detección de zona:", zoneResult);

    if (zoneResult.zona) {
      if (zoneResult.disponible) {
        setCurrentZone(zoneResult.zona);
      } else {
        // Zona encontrada pero marcada como NO disponible: informar claramente al cliente
        setCurrentZone({ ...zoneResult.zona, disponible: false });
        toast({
          title: "Zona no disponible",
          description: `La zona "${zoneResult.zona.nombre}" existe pero actualmente no está activa para delivery.`,
          variant: "destructive"
        });
      }
    } else {
      // Fuera de zonas definidas: mantenemos comportamiento previo (puede aplicar lógica especial más adelante)
      setCurrentZone(null);
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
            console.log("🔔 Notificando selección con dirección:", shortAddress);
            onLocationSelect(lat, lng, shortAddress);
          } else {
            // Notificar selección sin dirección
            console.log("🔔 Notificando selección sin dirección");
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
      const newZoom = Math.min(zoom + 1, 18); // Límite máximo 18 (antes era 19)
      setZoom(newZoom);
      mapInstanceRef.current.setZoom(newZoom);
    }
  };
  
  const handleZoomOut = () => {
    if (mapInitialized && mapInstanceRef.current) {
      const newZoom = Math.max(zoom - 1, 12); // Límite mínimo 12
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
    console.log("🔄 Reiniciando mapa completamente...");
    
    // Reiniciar ubicación
    setSelectedLocation(null);
    
    // Limpiar el mapa existente si hay uno
    if (mapInstanceRef.current) {
      try {
        console.log("Limpiando mapa existente...");
        
        // Eliminar marcadores
        if (markerRef.current) {
          markerRef.current.remove();
          markerRef.current = null;
        }
        
        if (redCircleMarkerRef.current) {
          redCircleMarkerRef.current.remove();
          redCircleMarkerRef.current = null;
        }
        
        // Limpiar capas y eventos
        mapInstanceRef.current.off();
        if (zonesLayerRef.current) {
          zonesLayerRef.current.clearLayers();
        }
        
        // Eliminar el mapa
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        
        // Limpiar el contenedor
        if (mapContainerRef.current) {
          while (mapContainerRef.current.firstChild) {
            mapContainerRef.current.removeChild(mapContainerRef.current.firstChild);
          }
        }
      } catch (err) {
        console.error("Error al limpiar mapa existente:", err);
      }
    }
    
    // Reiniciar estados
    setMapInitialized(false);
    
    // Forzar un nuevo intento de inicialización
    console.log("Forzando nueva inicialización del mapa");
    setInitAttempts(1);
    
    // Asegurarse que el script se recargue si es necesario
    if (!window.L) {
      setScriptLoaded(false);
      setTimeout(() => {
        setScriptLoaded(true);
      }, 100);
    } else {
      // Si Leaflet ya está disponible, inicializar directamente
      setTimeout(() => {
        initializeMap();
      }, 200);
    }
  };

  return (
    <div className="flex flex-col h-full rounded-lg overflow-hidden border dark:border-gray-700">
      {/* Cargar Leaflet JS - cambiar a lazyOnload para que funcione en componentes dinámicos */}
      <Script
        src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
        integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
        crossOrigin=""
        strategy="lazyOnload"
        onLoad={() => {
          console.log("✅ Script de Leaflet cargado correctamente");
          setScriptLoaded(true);
        }}
        onError={(e) => {
          console.error("❌ Error al cargar script de Leaflet:", e);
          // Intentar cargar manualmente como respaldo
          const leafletScript = document.createElement('script');
          leafletScript.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
          leafletScript.onload = () => {
            console.log("✅ Leaflet cargado manualmente como respaldo");
            setScriptLoaded(true);
          };
          document.head.appendChild(leafletScript);
        }}
      />

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
        <div ref={mapContainerRef} className="w-full h-full relative" style={{position: 'relative'}} />

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

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
  
  // Cuando el componente se monta, forzar un intento inicial de carga
  useEffect(() => {
    console.log("FixedMapPicker montado - forzando inicialización del mapa");
    // Iniciar un intento inmediatamente
    setInitAttempts(1);
  }, []);

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

    // Verificar que el contenedor del mapa exista
    if (!mapContainerRef.current) {
      console.error("Contenedor del mapa no disponible");
      return;
    }

    // Verificar que el contenedor del mapa tenga dimensiones
    const mapRect = mapContainerRef.current.getBoundingClientRect();
    if (mapRect.width === 0 || mapRect.height === 0) {
      console.error("Contenedor del mapa tiene dimensiones cero:", mapRect);
      
      // Forzar un reintento después de un pequeño retraso
      setTimeout(() => {
        setInitAttempts(prev => prev + 1);
      }, 500);
      
      return;
    }

    console.log("Dimensiones del contenedor del mapa:", mapRect.width, "x", mapRect.height);

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
        console.log("🗺️ Click en mapa detectado, coordenadas:", e.latlng);
        
        try {
          const { lat, lng } = e.latlng;
          // Asegurarse de que las coordenadas sean válidas
          if (isNaN(lat) || isNaN(lng)) {
            console.error("Coordenadas inválidas en el clic del mapa:", e.latlng);
            return;
          }
          
          // Crear un punto visible temporalmente para confirmar que el clic funciona
          const clickPoint = window.L.circleMarker([lat, lng], {
            radius: 8,
            color: 'blue',
            fillColor: 'blue',
            fillOpacity: 0.7,
            weight: 2
          }).addTo(map);
          
          // Eliminar el punto después de un momento
          setTimeout(() => {
            if (clickPoint) {
              clickPoint.remove();
            }
          }, 800);
          
          console.log("Procesando clic en coordenadas:", lat, lng);
          
          // PRIMERO: Actualizar el marcador - esto es crítico
          updateMarker(lat, lng);
          
          // SEGUNDO: Notificar sobre la ubicación seleccionada
          handleMapClick(lat, lng);
          
          // TERCERO: Verificación adicional para asegurar que el marcador esté presente
          setTimeout(() => {
            if (!redCircleMarkerRef.current || !redCircleMarkerRef.current._map) {
              console.log("⚠️ Verificación adicional: el marcador no está visible, recreándolo...");
              redCircleMarkerRef.current = createRedCircleMarker({ lat, lng });
              
              // Verificación final
              setTimeout(() => {
                if (!redCircleMarkerRef.current || !redCircleMarkerRef.current._map) {
                  console.log("❗ ALERTA: Último intento de recuperación de marcador");
                  const icon = window.L.icon({
                    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41]
                  });
                  
                  redCircleMarkerRef.current = window.L.marker([lat, lng], {
                    icon: icon
                  }).addTo(map);
                }
              }, 300);
            }
          }, 1000);
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
    // Solo intentar inicializar si no está inicializado y tenemos un intento activo
    if (!mapInitialized && initAttempts > 0) {
      console.log(`Intento #${initAttempts} de inicialización del mapa`);
      
      // Si Leaflet está disponible, inicializar directamente
      if (window.L) {
        initializeMap();
      } 
      // Si no está disponible, asegurar que el script esté cargado
      else if (!scriptLoaded) {
        console.log("Leaflet no disponible, asegurando carga del script...");
        setScriptLoaded(true);
      } 
      // Si el script está cargado pero Leaflet no está disponible, recargar script
      else {
        console.log("Script cargado pero Leaflet no disponible, recargando script...");
        setScriptLoaded(false);
        setTimeout(() => setScriptLoaded(true), 200);
      }
      
      // Si después de varios intentos aún no se inicializa, intentar medidas más drásticas
      if (initAttempts >= 3 && !mapInitialized) {
        console.log("Múltiples intentos fallidos, aplicando medidas de recuperación...");
        
        // Limpiar completamente el DOM del mapa y forzar recarga
        if (mapContainerRef.current) {
          while (mapContainerRef.current.firstChild) {
            mapContainerRef.current.removeChild(mapContainerRef.current.firstChild);
          }
        }
        
        // Recargar Leaflet completamente
        const leafletScript = document.createElement('script');
        leafletScript.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        leafletScript.onload = () => {
          console.log("Leaflet recargado manualmente");
          setTimeout(() => initializeMap(), 300);
        };
        document.head.appendChild(leafletScript);
      }
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
      console.error("❌ No se puede crear marcador circular rojo - mapa no inicializado");
      return null;
    }
    
    try {
      console.log("🔴 Creando marcador rojo PERMANENTE en:", coordinates);
      
      // Crear un marcador estándar con icono predeterminado (más visible y confiable)
      const defaultIcon = window.L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      });
      
      // Crear un marcador con el icono estándar de Leaflet
      const marker = window.L.marker([coordinates.lat, coordinates.lng], {
        icon: defaultIcon,
        zIndexOffset: 1000 // Asegurarse que esté por encima de otros elementos
      }).addTo(mapInstanceRef.current);
      
      console.log("✅ Marcador estándar creado correctamente");
      
      // Verificar que el marcador se haya añadido correctamente al mapa
      if (!marker._map) {
        console.error("⚠️ El marcador no se añadió al mapa correctamente, reintentando...");
        marker.addTo(mapInstanceRef.current);
      }
      
      return marker;
    } catch (error) {
      console.error("❌ Error al crear marcador rojo:", error);
      return null;
    }
  };

  // Función para actualizar el marcador en el mapa
  const updateMarker = (lat: number, lng: number) => {
    console.log(`🎯 Actualizando marcador en: [${lat}, ${lng}]`);
    
    if (!mapInitialized || !mapInstanceRef.current) {
      console.error("❌ No se puede actualizar el marcador - mapa no inicializado");
      return;
    }
    
    try {
      // Guardar las coordenadas actuales
      setSelectedLocation({ lat, lng });
      
      // Eliminar marcadores existentes para asegurar una limpieza adecuada
      if (markerRef.current) {
        console.log("Eliminando marcador estándar existente");
        markerRef.current.remove();
        markerRef.current = null;
      }
      
      if (redCircleMarkerRef.current) {
        console.log("Eliminando marcador rojo existente");
        redCircleMarkerRef.current.remove();
        redCircleMarkerRef.current = null;
      }
      
      // Crear un nuevo marcador en la posición actualizada
      console.log("Creando nuevo marcador en:", lat, lng);
      redCircleMarkerRef.current = createRedCircleMarker({ lat, lng });
      
      // Centrar el mapa en la ubicación seleccionada
      mapInstanceRef.current.panTo([lat, lng]);
      
      console.log("✅ Marcador actualizado correctamente");
      
      // Verificación diferida para asegurar que el marcador está visible
      setTimeout(() => {
        if (!redCircleMarkerRef.current || !redCircleMarkerRef.current._map) {
          console.log("⚠️ Verificación: el marcador no está visible, recreándolo...");
          // Si el marcador no está en el mapa, intentar crearlo de nuevo
          redCircleMarkerRef.current = createRedCircleMarker({ lat, lng });
        }
      }, 500);
    } catch (error) {
      console.error("❌ Error al actualizar marcador:", error);
      
      // Intento de recuperación con un marcador estándar como respaldo
      setTimeout(() => {
        try {
          console.log("🔄 Intento de recuperación de emergencia para marcador");
          // Usar marcador predeterminado de Leaflet como último recurso
          const defaultIcon = window.L.icon({
            iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41]
          });
          
          redCircleMarkerRef.current = window.L.marker([lat, lng], {
            icon: defaultIcon
          }).addTo(mapInstanceRef.current);
        } catch (e) {
          console.error("Falló el intento de recuperación:", e);
        }
      }, 500);
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
        strategy="beforeInteractive"
        onLoad={() => {
          console.log("✅ Script de Leaflet cargado correctamente");
          setScriptLoaded(true);
          // Iniciar un intento inmediatamente después de cargar el script con un pequeño retraso
          setTimeout(() => {
            setInitAttempts(prev => prev + 1);
            // Verificar que Leaflet esté realmente disponible
            if (window.L) {
              console.log("✅ Objeto L de Leaflet confirmado como disponible");
            } else {
              console.error("❌ Objeto L de Leaflet NO disponible a pesar de carga exitosa");
            }
          }, 200);
        }}
        onError={(e) => {
          console.error("❌ Error al cargar script de Leaflet:", e);
          // Intentar cargar manualmente como respaldo
          const leafletScript = document.createElement('script');
          leafletScript.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
          leafletScript.onload = () => {
            console.log("✅ Leaflet cargado manualmente como respaldo");
            setScriptLoaded(true);
            setTimeout(() => setInitAttempts(prev => prev + 1), 200);
          };
          document.head.appendChild(leafletScript);
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

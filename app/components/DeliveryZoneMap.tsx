"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trash2, Save, Plus, X, MapPin, ZoomIn, ZoomOut } from "lucide-react"
import { defaultDeliveryZones, type DeliveryZone } from "../../lib/delivery-zones"

interface DeliveryZoneMapProps {
  isOpen: boolean
  onClose: () => void
  onSaveZones: (zones: DeliveryZone[]) => void
  initialZones?: DeliveryZone[]
}

export default function DeliveryZoneMap({ isOpen, onClose, onSaveZones, initialZones }: DeliveryZoneMapProps) {
  const [zones, setZones] = useState<DeliveryZone[]>([])
  const [selectedZone, setSelectedZone] = useState<DeliveryZone | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawingPoints, setDrawingPoints] = useState<{ x: number; y: number; lat: number; lng: number }[]>([])
  const [editingZone, setEditingZone] = useState<Partial<DeliveryZone>>({})
  const [zoom, setZoom] = useState(14)
  const [renderKey, setRenderKey] = useState(0) // Estado para forzar re-renderizado
  const [mapLoaded, setMapLoaded] = useState(false) // Nuevo estado para rastrear si el mapa está cargado
  const [mapBounds, setMapBounds] = useState<{north: number, south: number, east: number, west: number} | null>(null)
  const [isSyncing, setIsSyncing] = useState(false) // Nuevo estado para mostrar cuando se está sincronizando
  const mapRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Inicializar zonas cuando se abre el mapa
  useEffect(() => {
    if (isOpen) {
      if (initialZones && initialZones.length > 0) {
        setZones([...initialZones])
      } else {
        // Si no hay zonas iniciales, comenzar con un array vacío
        setZones([])
      }
      // Resetear el estado de carga del mapa cuando se abre
      setMapLoaded(false)
    }
  }, [isOpen, initialZones])

  // Detectar cuando el iframe del mapa se ha cargado
  useEffect(() => {
    if (isOpen) {
      console.log('🔍 Iniciando detección de carga del mapa...');
      
      // Estrategia 1: Intentar detectar iframe load event
      const checkIframeLoad = () => {
        if (mapRef.current) {
          const iframe = mapRef.current.querySelector('iframe');
          if (iframe) {
            console.log('📄 Iframe encontrado, añadiendo listener de carga');
            const handleLoad = () => {
              console.log('🗺️ Iframe del mapa cargado completamente');
              setTimeout(() => {
                setMapLoaded(true);
                console.log('✅ Estado mapLoaded establecido a true (via iframe load)');
              }, 500);
            };

            iframe.addEventListener('load', handleLoad);
            
            return () => {
              iframe.removeEventListener('load', handleLoad);
            };
          }
        }
        return null;
      };

      // Estrategia 2: Timeout de seguridad
      const fallbackTimer = setTimeout(() => {
        console.log('⏰ Timeout: Forzando mapLoaded a true después de 4 segundos');
        setMapLoaded(true);
      }, 4000);

      // Estrategia 3: Polling para verificar iframe
      const pollTimer = setInterval(() => {
        if (!mapLoaded && mapRef.current) {
          const iframe = mapRef.current.querySelector('iframe');
          if (iframe) {
            console.log('🔍 Polling: Iframe detectado');
            setMapLoaded(true);
            clearInterval(pollTimer);
          }
        }
      }, 500);

      const cleanup = checkIframeLoad();
      
      return () => {
        clearTimeout(fallbackTimer);
        clearInterval(pollTimer);
        if (cleanup) cleanup();
      };
    }
  }, [isOpen, renderKey, mapLoaded])

  // Forzar re-renderizado de zonas cuando el mapa se carga
  useEffect(() => {
    if (mapLoaded && zones.length > 0) {
      console.log('🔄 Mapa cargado, forzando re-renderizado de zonas');
      setRenderKey(prev => prev + 1);
    }
  }, [mapLoaded, zones.length])

  // Coordenadas exactas de Los Andes, Chile (puede cambiar si el usuario mueve el mapa)
  const [mapCenter, setMapCenter] = useState({ lat: -32.8347, lng: -70.5983 });
  const losAndesCenter = { lat: -32.8347, lng: -70.5983 };

  // Calcular bounds reales del mapa basándose en el centro actual y zoom
  const calculateMapBounds = () => {
    if (!mapRef.current) return null;

    const mapRect = mapRef.current.getBoundingClientRect();
    const mapWidth = mapRect.width;
    const mapHeight = mapRect.height;

    if (mapWidth === 0 || mapHeight === 0) return null;

    // Fórmula más precisa para calcular bounds basándose en el zoom de Google Maps
    // En el nivel de zoom 1, la tierra entera es 256 píxeles
    const EARTH_CIRCUMFERENCE = 40075.016686; // km
    const DEGREES_PER_PIXEL_AT_ZOOM_0 = 360 / 256;
    
    // Calcular grados por píxel en el zoom actual
    const degreesPerPixel = DEGREES_PER_PIXEL_AT_ZOOM_0 / Math.pow(2, zoom);
    
    // Calcular el rango de lat/lng visible
    const latRange = (mapHeight / 2) * degreesPerPixel;
    const lngRange = (mapWidth / 2) * degreesPerPixel;

    const bounds = {
      north: mapCenter.lat + latRange,
      south: mapCenter.lat - latRange,
      west: mapCenter.lng - lngRange,
      east: mapCenter.lng + lngRange,
    };

    console.log(`🗺️ Bounds calculados para zoom ${zoom} en centro [${mapCenter.lat}, ${mapCenter.lng}]:`, bounds);
    return bounds;
  };

  // Actualizar bounds cuando cambie el zoom o cuando el mapa se cargue
  useEffect(() => {
    if (mapLoaded && mapRef.current) {
      const bounds = calculateMapBounds();
      if (bounds) {
        setMapBounds(bounds);
        console.log('📐 Bounds del mapa actualizados por cambio de zoom:', bounds);
        // Forzar re-renderizado de zonas con nuevos bounds
        setRenderKey(prev => prev + 1);
      }
    }
  }, [mapLoaded, zoom, mapCenter.lat, mapCenter.lng]);

  // Auto-sincronización inteligente de polígonos
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;

    let syncTimeout: NodeJS.Timeout;
    let periodicSyncInterval: NodeJS.Timeout;
    let lastSyncTime = Date.now();
    let isUserInteracting = false;

    const autoSync = (source: string = 'auto') => {
      const now = Date.now();
      // Permitir sincronización más frecuente durante interacción del usuario
      const minInterval = isUserInteracting ? 300 : 1000;
      
      if (now - lastSyncTime > minInterval) {
        setIsSyncing(true);
        console.log(`🔄 Auto-sincronización (${source}) de polígonos...`);
        const bounds = calculateMapBounds();
        if (bounds) {
          setMapBounds(bounds);
          setRenderKey(prev => prev + 1);
          lastSyncTime = now;
        }
        setTimeout(() => setIsSyncing(false), 400);
      }
    };

    // Sincronización periódica - más frecuente si hay zonas
    const periodicInterval = zones.length > 0 ? 3000 : 5000;
    periodicSyncInterval = setInterval(() => {
      if (zones.length > 0 && !isUserInteracting) {
        autoSync('periodic');
      }
    }, periodicInterval);

    // Manejar interacciones del usuario
    const handleUserInteractionStart = () => {
      isUserInteracting = true;
      clearTimeout(syncTimeout);
    };

    const handleUserInteractionEnd = () => {
      isUserInteracting = false;
      clearTimeout(syncTimeout);
      // Sincronizar después de que termine la interacción
      syncTimeout = setTimeout(() => autoSync('interaction'), 800);
    };

    // Escuchar eventos de interacción
    const mapContainer = mapRef.current;
    
    // Eventos de inicio de interacción
    mapContainer.addEventListener('mousedown', handleUserInteractionStart);
    mapContainer.addEventListener('touchstart', handleUserInteractionStart);
    
    // Eventos de fin de interacción
    mapContainer.addEventListener('mouseup', handleUserInteractionEnd);
    mapContainer.addEventListener('touchend', handleUserInteractionEnd);
    mapContainer.addEventListener('mouseleave', handleUserInteractionEnd);
    
    // Evento de rueda del mouse (zoom del usuario en el iframe)
    mapContainer.addEventListener('wheel', (e) => {
      handleUserInteractionStart();
      clearTimeout(syncTimeout);
      syncTimeout = setTimeout(() => {
        handleUserInteractionEnd();
      }, 1000);
    });

    return () => {
      clearTimeout(syncTimeout);
      clearInterval(periodicSyncInterval);
      mapContainer.removeEventListener('mousedown', handleUserInteractionStart);
      mapContainer.removeEventListener('touchstart', handleUserInteractionStart);
      mapContainer.removeEventListener('mouseup', handleUserInteractionEnd);
      mapContainer.removeEventListener('touchend', handleUserInteractionEnd);
      mapContainer.removeEventListener('mouseleave', handleUserInteractionEnd);
      mapContainer.removeEventListener('wheel', handleUserInteractionStart);
    };
  }, [mapLoaded, zones.length]);

  // URL del mapa de Google Maps Embed (gratuito)
  const getGoogleMapsUrl = () => {
    const baseUrl = "https://www.google.com/maps/embed/v1/view"
    const params = new URLSearchParams({
      key: "AIzaSyB41DRUbKWJHPxaFjMAwdrzWzbVKartNGg", // Clave pública de ejemplo (usar la tuya)
      center: `${mapCenter.lat},${mapCenter.lng}`,
      zoom: zoom.toString(),
      maptype: "roadmap",
    })

    // Si no tienes API key, usar la versión sin key (limitada pero funcional) 
    // Permitimos que aparezcan los controles nativos de Google Maps
    return `https://maps.google.com/maps?q=${mapCenter.lat},${mapCenter.lng}&t=roadmap&z=${zoom}&output=embed&iwloc=near`
  }

  // Alternativa con OpenStreetMap tiles
  const getOSMTileUrl = (x: number, y: number, z: number) => {
    return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`
  }

  // Convertir coordenadas geográficas a píxeles usando los bounds reales del mapa
  const geoToPixel = (lat: number, lng: number) => {
    if (!mapRef.current || !mapBounds) {
      console.log("⚠️ geoToPixel: Sin mapRef o mapBounds");
      return { x: 0, y: 0 }
    }

    const mapRect = mapRef.current.getBoundingClientRect()
    const mapWidth = mapRect.width
    const mapHeight = mapRect.height

    // Calcular la posición relativa dentro de los bounds del mapa
    const x = ((lng - mapBounds.west) / (mapBounds.east - mapBounds.west)) * mapWidth
    const y = ((mapBounds.north - lat) / (mapBounds.north - mapBounds.south)) * mapHeight

    // Limitar los valores a los límites del mapa
    const clampedX = Math.max(0, Math.min(mapWidth, x))
    const clampedY = Math.max(0, Math.min(mapHeight, y))

    console.log(`🎯 geoToPixel: [${lat.toFixed(6)}, ${lng.toFixed(6)}] -> pixel: [${clampedX.toFixed(1)}, ${clampedY.toFixed(1)}]`);

    return { x: clampedX, y: clampedY }
  }

  // Convertir píxeles a coordenadas geográficas usando los bounds reales del mapa
  const pixelToGeo = (x: number, y: number) => {
    if (!mapRef.current || !mapBounds) {
      console.log("⚠️ pixelToGeo: Sin mapRef o mapBounds, usando centro por defecto");
      return { lat: losAndesCenter.lat, lng: losAndesCenter.lng }
    }

    const mapRect = mapRef.current.getBoundingClientRect()
    const mapWidth = mapRect.width
    const mapHeight = mapRect.height

    // Calcular las coordenadas geográficas basándose en la posición del pixel
    const lng = mapBounds.west + (x / mapWidth) * (mapBounds.east - mapBounds.west)
    const lat = mapBounds.north - (y / mapHeight) * (mapBounds.north - mapBounds.south)

    console.log(`🎯 pixelToGeo: pixel [${x.toFixed(1)}, ${y.toFixed(1)}] -> geo [${lat.toFixed(6)}, ${lng.toFixed(6)}]`);

    return { lat, lng }
  }

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing) return

    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    const geo = pixelToGeo(x, y)
    setDrawingPoints((prev) => [...prev, { x, y, lat: geo.lat, lng: geo.lng }])
  }

  const handleSaveZone = () => {
    if (!editingZone.nombre || !editingZone.tarifa) {
      alert("Por favor completa el nombre y la tarifa de la zona")
      return
    }

    if (selectedZone) {
      // Actualizar zona existente
      const updatedZones = zones.map((zone) => {
        if (zone.id === selectedZone.id) {
          console.log(`Actualizando zona ${selectedZone.id} con nuevos datos:`, editingZone);
          return { 
            ...zone, 
            nombre: editingZone.nombre || zone.nombre,
            tarifa: editingZone.tarifa || zone.tarifa,
            tiempoEstimado: editingZone.tiempoEstimado || zone.tiempoEstimado,
            disponible: editingZone.disponible !== undefined ? editingZone.disponible : zone.disponible,
            color: editingZone.color || zone.color,
            descripcion: editingZone.descripcion || zone.descripcion
          }
        }
        return zone;
      });
      
      console.log("Zonas actualizadas:", updatedZones);
      setZones(updatedZones);
    } else if (drawingPoints.length >= 3) {
      // Crear nueva zona
      // Convertir los puntos dibujados a formato de polígono [lat, lng][]
      const polygonPoints: [number, number][] = drawingPoints.map((point) => [point.lat, point.lng]);
      
      console.log("Puntos del polígono para nueva zona:", polygonPoints);

      const newZone: DeliveryZone = {
        id: `zona-${Date.now()}`,
        nombre: editingZone.nombre || "",
        poligono: polygonPoints,
        tarifa: editingZone.tarifa || 0,
        tiempoEstimado: editingZone.tiempoEstimado || "20-30 min",
        disponible: editingZone.disponible ?? true,
        color: editingZone.color || "#3B82F6",
        descripcion: editingZone.descripcion || "",
      };
      
      console.log("Nueva zona creada:", newZone);
      setZones([...zones, newZone]);
      setDrawingPoints([]);
    } else {
      alert("Necesitas al menos 3 puntos para crear una zona")
      return
    }

    setSelectedZone(null)
    setEditingZone({})
    setIsDrawing(false)
  }

  const handleDeleteZone = () => {
    if (!selectedZone) return

    if (confirm(`¿Estás seguro de eliminar la zona "${selectedZone.nombre}"?`)) {
      const updatedZones = zones.filter((zone) => zone.id !== selectedZone.id)
      setZones(updatedZones)
      setSelectedZone(null)
      setEditingZone({})
    }
  }

  const startDrawing = () => {
    setIsDrawing(true)
    setSelectedZone(null)
    setDrawingPoints([])
    setEditingZone({
      nombre: "",
      tarifa: 2000,
      tiempoEstimado: "20-30 min",
      disponible: true,
      color: "#10B981",
      descripcion: "",
    })
  }

  const cancelDrawing = () => {
    setIsDrawing(false)
    setDrawingPoints([])
    setEditingZone({})
  }

  const finishDrawing = () => {
    if (drawingPoints.length < 3) {
      alert("Necesitas al menos 3 puntos para crear una zona")
      return
    }
  }

  const handleSaveAll = () => {
    // Verificar que tengamos zonas para guardar
    if (zones.length === 0) {
      alert("No hay zonas para guardar. Dibuja al menos una zona primero.");
      return;
    }
    
    // Validar que todas las zonas tengan polígonos válidos
    const zonasInvalidas = zones.filter(zone => 
      !zone.poligono || zone.poligono.length < 3
    );
    
    if (zonasInvalidas.length > 0) {
      alert(`¡Atención! Hay ${zonasInvalidas.length} zonas con polígonos inválidos. Cada zona debe tener al menos 3 puntos.`);
      return;
    }
    
    // Validar que todos los polígonos tengan el formato correcto [lat, lng][]
    const zonasFormatoInvalido = zones.filter(zone => 
      !zone.poligono.every(punto => 
        Array.isArray(punto) && punto.length === 2 && 
        typeof punto[0] === 'number' && typeof punto[1] === 'number'
      )
    );
    
    if (zonasFormatoInvalido.length > 0) {
      console.error("Zonas con formato inválido:", zonasFormatoInvalido);
      alert(`¡Error! Hay ${zonasFormatoInvalido.length} zonas con formato de polígono incorrecto.`);
      return;
    }
    
    // Log detallado para depuración
    console.log("Guardando zonas desde el editor de mapa:", JSON.stringify(zones, null, 2));
    
    // Enviar las zonas al componente padre para guardar
    onSaveZones(zones);
    onClose();
  }

  const selectZone = (zone: DeliveryZone) => {
    if (isDrawing) return

    setSelectedZone(zone)
    setEditingZone({
      nombre: zone.nombre,
      tarifa: zone.tarifa,
      tiempoEstimado: zone.tiempoEstimado,
      disponible: zone.disponible,
      color: zone.color,
      descripcion: zone.descripcion,
    })
  }

  // Renderizar zona en el overlay
  const renderZoneOverlay = (zone: DeliveryZone) => {
    if (!mapLoaded) {
      console.log('⏳ Mapa aún no cargado, saltando renderizado de zona:', zone.nombre);
      return null;
    }

    console.log("🔍 Intentando renderizar zona:", zone.nombre, "con polígono:", zone.poligono);
    
    // Verificar que la zona tenga un polígono válido
    if (!zone.poligono || !Array.isArray(zone.poligono) || zone.poligono.length < 3) {
      console.warn("❌ Zona sin polígono válido:", zone);
      return null;
    }

    console.log(`✅ Zona ${zone.nombre} tiene ${zone.poligono.length} puntos válidos`);

    // Convertir coordenadas geográficas a píxeles usando bounds actuales
    const pixelPoints = zone.poligono.map((point: any, index: number) => {
      let lat, lng;
      
      // Detectar formato: array [lat, lng] o objeto {lat, lng}
      if (Array.isArray(point)) {
        [lat, lng] = point;
      } else if (typeof point === 'object' && point.lat !== undefined && point.lng !== undefined) {
        lat = point.lat;
        lng = point.lng;
      } else {
        console.error(`❌ Formato de punto no reconocido en zona ${zone.nombre}:`, point);
        return { x: 0, y: 0 };
      }
      
      const pixel = geoToPixel(lat, lng);
      console.log(`🎯 Punto ${index}: [${lat}, ${lng}] -> [${pixel.x}, ${pixel.y}]`);
      return pixel;
    });
    
    const pathString = pixelPoints.map((p) => `${p.x},${p.y}`).join(" ")
    console.log("📐 Path string para zona", zone.nombre, ":", pathString);
    
    if (!pathString || pathString.includes('NaN')) {
      console.error("❌ Path string inválido para zona", zone.nombre, ":", pathString);
      return null;
    }

    console.log(`🎨 Renderizando polígono para zona ${zone.nombre} con color ${zone.color}`);

    return (
      <g key={`${zone.id}-${renderKey}`}>
        <polygon
          points={pathString}
          fill={zone.color || "#10B981"}
          fillOpacity={selectedZone?.id === zone.id ? 0.7 : 0.5}
          stroke={zone.color || "#10B981"}
          strokeWidth={selectedZone?.id === zone.id ? 4 : 3}
          strokeOpacity={0.9}
          className="cursor-pointer hover:fill-opacity-70 transition-all duration-200"
          onClick={(e) => {
            console.log(`🖱️ Click en zona: ${zone.nombre}`);
            e.stopPropagation()
            selectZone(zone)
          }}
          style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
        />
        {/* Etiqueta de la zona */}
        {pixelPoints.length > 0 && (
          <g>
            <rect
              x={pixelPoints[0].x - 30}
              y={pixelPoints[0].y - 25}
              width="60"
              height="20"
              fill="white"
              stroke={zone.color || "#10B981"}
              strokeWidth="1"
              rx="3"
              className="drop-shadow-sm"
            />
            <text
              x={pixelPoints[0].x}
              y={pixelPoints[0].y - 10}
              textAnchor="middle"
              className="text-xs font-medium fill-gray-800"
            >
              {zone.nombre}
            </text>
          </g>
        )}
      </g>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <MapPin className="w-5 h-5 mr-2 text-pink-600" />
            Editor de Zonas de Delivery - Los Andes, Chile
            <Badge variant="outline" className="ml-2">
              Google Maps
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex h-[75vh] gap-4">
          {/* Mapa */}
          <div className="flex-1 relative">
            {/* Información del estado del mapa - esquina superior izquierda */}
            <div className="absolute top-2 left-2 z-30 bg-white/90 backdrop-blur-sm rounded-lg p-2 text-xs border">
              <div><strong>Centro:</strong> {mapCenter.lat.toFixed(6)}, {mapCenter.lng.toFixed(6)}</div>
              <div><strong>Zoom:</strong> {zoom}</div>
              <div><strong>Zonas:</strong> {zones.length}</div>
              <div><strong>Bounds:</strong> {mapBounds ? '✅' : '❌'}</div>
              <div className="flex items-center gap-1">
                <strong>Sync:</strong> 
                {isSyncing ? (
                  <span className="inline-flex items-center gap-1 text-blue-600">
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                    Actualizando...
                  </span>
                ) : (
                  <span className="text-green-600">#{renderKey}</span>
                )}
              </div>
            </div>

            {/* Indicador de auto-sync mejorado */}
            {zones.length > 0 && (
              <div className="absolute top-14 right-2 z-30 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-2 text-xs">
                <div className="flex items-center gap-2">
                  {isSyncing ? (
                    <>
                      <div className="w-3 h-3 bg-blue-500 rounded-full animate-spin border-2 border-white border-t-transparent"></div>
                      <span className="text-blue-700 font-medium">Sincronizando...</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-green-700">Auto-Sync Activo</span>
                    </>
                  )}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  Polígonos: {zones.length} • Sync #{renderKey}
                </div>
              </div>
            )}

            {/* Controles de zoom y navegación - esquina inferior izquierda */}
            <div className="absolute bottom-4 left-4 z-30 flex flex-col gap-1">
              <Button variant="outline" size="sm" onClick={() => setZoom(Math.min(zoom + 1, 18))}>
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setZoom(Math.max(zoom - 1, 8))}>
                <ZoomOut className="w-4 h-4" />
              </Button>
              
              {/* Controles de movimiento simplificados */}
              <div className="grid grid-cols-3 gap-1 mt-2">
                <div></div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    const newLat = mapCenter.lat + 0.003;
                    setMapCenter({...mapCenter, lat: newLat});
                  }}
                  title="Mover norte"
                >
                  ⬆️
                </Button>
                <div></div>
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    const newLng = mapCenter.lng - 0.003;
                    setMapCenter({...mapCenter, lng: newLng});
                  }}
                  title="Mover oeste"
                >
                  ⬅️
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setMapCenter(losAndesCenter)}
                  title="Centrar en Los Andes"
                >
                  🏠
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    const newLng = mapCenter.lng + 0.003;
                    setMapCenter({...mapCenter, lng: newLng});
                  }}
                  title="Mover este"
                >
                  ➡️
                </Button>
                
                <div></div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    const newLat = mapCenter.lat - 0.003;
                    setMapCenter({...mapCenter, lat: newLat});
                  }}
                  title="Mover sur"
                >
                  ⬇️
                </Button>
                <div></div>
              </div>
              
              {/* Botón de sincronización manual de emergencia */}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  setIsSyncing(true);
                  console.log('🔄 Sincronización manual forzada...');
                  const bounds = calculateMapBounds();
                  if (bounds) {
                    setMapBounds(bounds);
                    setRenderKey(prev => prev + 1);
                  }
                  setTimeout(() => setIsSyncing(false), 500);
                }}
                title="Sincronización manual"
                className="bg-blue-50 hover:bg-blue-100 text-xs"
              >
                Manual Sync
              </Button>
            </div>

            {/* Controles superiores derecha - Nueva Zona */}
            <div className="absolute top-2 right-2 z-30 flex gap-2">
              {!isDrawing ? (
                <Button onClick={startDrawing} className="bg-green-600 hover:bg-green-700 text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  Nueva Zona
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    onClick={finishDrawing}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={drawingPoints.length < 3}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Finalizar ({drawingPoints.length})
                  </Button>
                  <Button onClick={cancelDrawing} variant="outline">
                    <X className="w-4 h-4 mr-2" />
                    Cancelar
                  </Button>
                </div>
              )}
            </div>

            {/* Contenedor del mapa */}
            <div ref={mapRef} className="w-full h-full border-2 border-gray-300 rounded-lg overflow-hidden relative">
              {/* Indicador de carga del mapa */}
              {!mapLoaded && (
                <div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-10">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-sm text-gray-600">Cargando mapa...</p>
                  </div>
                </div>
              )}
              
              {/* Google Maps iframe */}
              <iframe
                src={getGoogleMapsUrl()}
                width="100%"
                height="100%"
                style={{ 
                  border: 0,
                  pointerEvents: isDrawing ? 'none' : 'auto' // Habilitar interacción cuando no se está dibujando
                }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="absolute inset-0"
              />

              {/* SVG para visualización de zonas y dibujo */}
              <svg 
                className="absolute inset-0 w-full h-full z-20" 
                style={{ 
                  pointerEvents: isDrawing ? 'auto' : 'none' // Solo capturar eventos cuando se está dibujando
                }}
              >
                {/* Zonas existentes - renderizar solo cuando el mapa esté cargado */}
                {mapLoaded && zones.map((zone) => renderZoneOverlay(zone))}
                
                {/* Mensaje informativo cuando el mapa no está cargado */}
                {!mapLoaded && zones.length > 0 && (
                  <text x="400" y="300" textAnchor="middle" className="text-sm font-medium fill-blue-600">
                    Esperando carga del mapa para mostrar {zones.length} zona(s)...
                  </text>
                )}
              </svg>

              {/* Overlay para interacciones de dibujo */}
              <div
                ref={overlayRef}
                className="absolute inset-0 z-30"
                style={{
                  pointerEvents: isDrawing ? "auto" : "none",
                  cursor: isDrawing ? "crosshair" : "default",
                }}
                onClick={handleOverlayClick}
              >
                {/* SVG para elementos de dibujo interactivo */}
                <svg className="w-full h-full">
                  {/* Líneas de dibujo */}
                  {isDrawing && drawingPoints.length > 1 && (
                    <polyline
                      points={drawingPoints.map((p) => `${p.x},${p.y}`).join(" ")}
                      fill="none"
                      stroke="#10B981"
                      strokeWidth="3"
                      strokeDasharray="5,5"
                      opacity="0.8"
                    />
                  )}

                  {/* Línea de cierre */}
                  {isDrawing && drawingPoints.length > 2 && (
                    <line
                      x1={drawingPoints[drawingPoints.length - 1].x}
                      y1={drawingPoints[drawingPoints.length - 1].y}
                      x2={drawingPoints[0].x}
                      y2={drawingPoints[0].y}
                      stroke="#10B981"
                      strokeWidth="2"
                      strokeDasharray="3,3"
                      opacity="0.5"
                    />
                  )}

                  {/* Puntos de dibujo */}
                  {isDrawing &&
                    drawingPoints.map((point, index) => (
                      <g key={index}>
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r="8"
                          fill={index === 0 ? "#EF4444" : "#10B981"}
                          stroke="white"
                          strokeWidth="3"
                          opacity="0.9"
                        />
                        <text
                          x={point.x}
                          y={point.y + 20}
                          textAnchor="middle"
                          className="text-xs font-bold fill-gray-700"
                        >
                          {index + 1}
                        </text>
                      </g>
                    ))}

                  {/* Área en construcción */}
                  {isDrawing && drawingPoints.length > 2 && (
                    <polygon
                      points={drawingPoints.map((p) => `${p.x},${p.y}`).join(" ")}
                      fill={editingZone.color || "#10B981"}
                      fillOpacity="0.4"
                      stroke={editingZone.color || "#10B981"}
                      strokeWidth="3"
                      strokeDasharray="8,4"
                    />
                  )}
                </svg>
              </div>
            </div>
          </div>

          {/* Panel de edición */}
          <div className="w-80 space-y-4 overflow-y-auto">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  {selectedZone ? (
                    <>
                      <Save className="w-4 h-4 mr-2 text-blue-600" />
                      Editar Zona
                    </>
                  ) : isDrawing ? (
                    <>
                      <Plus className="w-4 h-4 mr-2 text-green-600" />
                      Nueva Zona
                    </>
                  ) : (
                    <>
                      <MapPin className="w-4 h-4 mr-2 text-gray-600" />
                      Selecciona una Zona
                    </>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(selectedZone || isDrawing) && (
                  <>
                    <div>
                      <Label htmlFor="nombre">Nombre de la Zona</Label>
                      <Input
                        id="nombre"
                        value={editingZone.nombre || ""}
                        onChange={(e) => setEditingZone({ ...editingZone, nombre: e.target.value })}
                        placeholder="Ej: Centro Los Andes"
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="tarifa">Tarifa de Delivery ($)</Label>
                      <Input
                        id="tarifa"
                        type="number"
                        value={editingZone.tarifa || ""}
                        onChange={(e) =>
                          setEditingZone({ ...editingZone, tarifa: Number.parseInt(e.target.value) || 0 })
                        }
                        placeholder="2000"
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="tiempo">Tiempo Estimado</Label>
                      <Input
                        id="tiempo"
                        value={editingZone.tiempoEstimado || ""}
                        onChange={(e) => setEditingZone({ ...editingZone, tiempoEstimado: e.target.value })}
                        placeholder="20-30 min"
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="descripcion">Descripción</Label>
                      <Input
                        id="descripcion"
                        value={editingZone.descripcion || ""}
                        onChange={(e) => setEditingZone({ ...editingZone, descripcion: e.target.value })}
                        placeholder="Barrios incluidos"
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="color">Color de la Zona</Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          id="color"
                          type="color"
                          value={editingZone.color || "#3B82F6"}
                          onChange={(e) => setEditingZone({ ...editingZone, color: e.target.value })}
                          className="w-16"
                        />
                        <Input
                          value={editingZone.color || "#3B82F6"}
                          onChange={(e) => setEditingZone({ ...editingZone, color: e.target.value })}
                          placeholder="#3B82F6"
                        />
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="disponible"
                        checked={editingZone.disponible ?? true}
                        onCheckedChange={(checked) => setEditingZone({ ...editingZone, disponible: checked })}
                      />
                      <Label htmlFor="disponible">Zona Disponible</Label>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={handleSaveZone}
                        className="flex-1"
                        disabled={!editingZone.nombre || !editingZone.tarifa || (isDrawing && drawingPoints.length < 3)}
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Guardar
                      </Button>
                      {selectedZone && (
                        <Button onClick={handleDeleteZone} variant="destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Lista de zonas */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Zonas Configuradas ({zones.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {zones.map((zone) => (
                    <div
                      key={zone.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedZone?.id === zone.id
                          ? "bg-pink-50 border-pink-300 shadow-md"
                          : "hover:bg-gray-50 border-gray-200"
                      } ${isDrawing ? "opacity-50 cursor-not-allowed" : ""}`}
                      onClick={() => !isDrawing && selectZone(zone)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">{zone.nombre}</div>
                          <div className="text-xs text-gray-500">${zone.tarifa.toLocaleString()}</div>
                          <div className="text-xs text-gray-400">{zone.tiempoEstimado}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                            style={{ backgroundColor: zone.color }}
                          ></div>
                          <Badge variant={zone.disponible ? "default" : "destructive"} className="text-xs">
                            {zone.disponible ? "✓" : "✗"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSaveAll} className="bg-pink-600 hover:bg-pink-700 text-white">
            <Save className="w-4 h-4 mr-2" />
            Guardar Cambios ({zones.length} zonas)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

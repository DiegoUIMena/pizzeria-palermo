"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import Script from "next/script";

export default function SimpleMapDebug() {
  const [logs, setLogs] = useState<string[]>([]);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [mapInitialized, setMapInitialized] = useState(false);
  const [showDebugControls, setShowDebugControls] = useState(false);

  // Función para agregar logs
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev].slice(0, 30));
    console.log(`[${timestamp}] ${message}`);
  };

  // Inicializar mapa cuando el script esté cargado
  useEffect(() => {
    if (!scriptLoaded) return;
    
    addLog("Script de Leaflet cargado, intentando inicializar mapa básico");
    
    const mapContainer = document.getElementById('simple-map');
    if (!mapContainer) {
      addLog("ERROR: No se encontró el contenedor del mapa");
      return;
    }
    
    try {
      // Comprobar si Leaflet está disponible
      if (!window.L) {
        addLog("ERROR: window.L no está disponible");
        return;
      }
      
      // Limpiar cualquier mapa existente
      mapContainer.innerHTML = '';
      
      // Crear mapa simple
      const map = window.L.map(mapContainer).setView([-32.8347, -70.5983], 15);
      
      // Añadir capa de tiles
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);
      
      // Añadir un marcador
      window.L.marker([-32.8347, -70.5983]).addTo(map)
        .bindPopup('Centro de Los Andes')
        .openPopup();
      
      // Forzar actualización del tamaño del mapa
      setTimeout(() => {
        map.invalidateSize(true);
        addLog("Mapa inicializado correctamente");
        setMapInitialized(true);
      }, 100);
      
      // Limpieza al desmontar
      return () => {
        addLog("Desmontando componente, limpiando mapa");
        try {
          map.remove();
        } catch (err) {
          console.error("Error al limpiar mapa:", err);
        }
      };
    } catch (error) {
      addLog(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
      console.error("Error al inicializar mapa:", error);
    }
  }, [scriptLoaded]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Diagnóstico Simplificado de Mapa</h1>
      
      {/* Enlaces a hojas de estilo de Leaflet */}
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
        crossOrigin=""
      />
      
      {/* Script de Leaflet */}
      <Script
        src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
        integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
        crossOrigin=""
        onLoad={() => {
          addLog("Script de Leaflet cargado");
          setScriptLoaded(true);
        }}
        onError={(e) => {
          addLog(`ERROR al cargar script: ${e.type}`);
        }}
      />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="flex space-x-4">
            <Button 
              onClick={() => window.location.reload()} 
              variant="outline"
            >
              Recargar Página
            </Button>
            <Button 
              onClick={() => setShowDebugControls(!showDebugControls)} 
              variant="outline"
            >
              {showDebugControls ? "Ocultar Debug" : "Mostrar Debug"}
            </Button>
          </div>
          
          {showDebugControls && (
            <div className="border p-4 rounded-lg bg-gray-50">
              <h3 className="font-medium mb-2">Herramientas de Debug</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  onClick={() => {
                    addLog("Verificando window.L...");
                    if (window.L) {
                      addLog("✅ window.L está disponible");
                    } else {
                      addLog("❌ window.L NO está disponible");
                    }
                  }}
                  size="sm"
                  variant="outline"
                >
                  Verificar Leaflet
                </Button>
                <Button 
                  onClick={() => {
                    const mapDiv = document.getElementById('simple-map');
                    addLog(`Estado del div: ${mapDiv ? 'Existe' : 'No existe'}`);
                    if (mapDiv) {
                      addLog(`Dimensiones: ${mapDiv.clientWidth}x${mapDiv.clientHeight}`);
                    }
                  }}
                  size="sm"
                  variant="outline"
                >
                  Verificar Div
                </Button>
                <Button 
                  onClick={() => {
                    addLog("Cargando script manualmente...");
                    const script = document.createElement('script');
                    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
                    script.onload = () => addLog("Script cargado manualmente");
                    script.onerror = () => addLog("Error al cargar script manualmente");
                    document.head.appendChild(script);
                  }}
                  size="sm"
                  variant="outline"
                >
                  Cargar Script Manual
                </Button>
                <Button 
                  onClick={() => {
                    const scripts = document.querySelectorAll('script');
                    addLog(`Scripts en la página: ${scripts.length}`);
                    scripts.forEach((s, i) => {
                      if (s.src.includes('leaflet')) {
                        addLog(`Script Leaflet #${i}: ${s.src}`);
                      }
                    });
                  }}
                  size="sm"
                  variant="outline"
                >
                  Listar Scripts
                </Button>
              </div>
            </div>
          )}
          
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-white p-3 border-b">
              <h2 className="font-semibold">Mapa Básico</h2>
              <p className="text-sm text-gray-500">
                {scriptLoaded 
                  ? (mapInitialized 
                      ? "✅ Mapa inicializado correctamente" 
                      : "⚠️ Script cargado pero mapa no inicializado")
                  : "⏳ Esperando carga del script..."}
              </p>
            </div>
            <div id="simple-map" className="w-full h-[400px] relative">
              {!scriptLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Cargando script de Leaflet...</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="border rounded-lg p-4 bg-white">
          <h2 className="text-lg font-semibold mb-4">Registro de Eventos</h2>
          <div className="h-[500px] overflow-y-auto bg-gray-50 p-4 rounded border">
            {logs.length === 0 ? (
              <p className="text-gray-500 text-center">No hay eventos registrados</p>
            ) : (
              <ul className="space-y-2">
                {logs.map((log, index) => (
                  <li 
                    key={index} 
                    className={`text-sm font-mono ${
                      log.includes("ERROR") ? "text-red-600" : 
                      log.includes("✅") ? "text-green-600" : 
                      log.includes("⚠️") ? "text-amber-600" : 
                      "text-gray-700"
                    }`}
                  >
                    {log}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
      
      <div className="mt-8 border-t pt-6">
        <h2 className="text-lg font-semibold mb-4">Instrucciones</h2>
        <ul className="list-disc list-inside space-y-2">
          <li>Esta es una versión simplificada para diagnosticar problemas con Leaflet</li>
          <li>Si el mapa se muestra correctamente aquí pero no en otras partes, el problema está en la integración</li>
          <li>Usa las herramientas de debug para verificar el estado de la biblioteca Leaflet</li>
          <li>Puedes ver los logs detallados para identificar errores específicos</li>
        </ul>
      </div>
    </div>
  );
}

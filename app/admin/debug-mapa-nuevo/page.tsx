"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import OpenStreetMapPicker from "../../components/OpenStreetMapPicker";

// Definir tipos para la ubicación
interface LocationType {
  lat: number;
  lng: number;
  address?: string;
}

export default function DebugMapPage() {
  // Estado para verificar si estamos en el cliente
  const [mounted, setMounted] = useState(false);
  // Estado para la visibilidad del mapa
  const [showMap, setShowMap] = useState(false);
  // Estado para la ubicación seleccionada
  const [location, setLocation] = useState<LocationType | null>(null);
  // Estado para los logs
  const [logs, setLogs] = useState<string[]>([]);
  // Contador para forzar re-renderizado
  const [renderCount, setRenderCount] = useState(0);

  // Efecto para inicializar en el cliente
  useEffect(() => {
    setMounted(true);
    setShowMap(true);
  }, []);

  // Función para agregar logs
  const addLog = (message: string) => {
    setLogs((prev) => [message, ...prev].slice(0, 10));
  };

  // Manejador de selección de ubicación
  const handleLocationSelect = (lat: number, lng: number, address?: string) => {
    setLocation({ lat, lng, address });
    addLog(`Ubicación seleccionada: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
  };

  // Función para alternar el mapa
  const toggleMap = () => {
    addLog(`${showMap ? "Ocultando" : "Mostrando"} el mapa`);
    setShowMap(!showMap);
  };

  // Función para reiniciar el mapa
  const resetMap = () => {
    addLog("Reiniciando el mapa");
    setShowMap(false);
    
    setTimeout(() => {
      addLog("Mapa oculto, preparando reinicio");
      setRenderCount((prev) => prev + 1);
      
      setTimeout(() => {
        addLog("Volviendo a mostrar el mapa");
        setShowMap(true);
      }, 500);
    }, 200);
  };

  // Si no estamos en el cliente, mostrar carga
  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto mb-4"></div>
          <p>Cargando herramienta de diagnóstico...</p>
        </div>
      </div>
    );
  }

  // Renderizado principal
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Herramienta de Diagnóstico de Mapa</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="flex space-x-4">
            <Button onClick={toggleMap} variant="outline">
              {showMap ? "Ocultar Mapa" : "Mostrar Mapa"}
            </Button>
            <Button onClick={resetMap} variant="outline">
              Reiniciar Mapa ({renderCount})
            </Button>
            <Button 
              onClick={() => window.location.reload()} 
              variant="destructive"
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Recargar Página
            </Button>
          </div>
          
          {showMap && (
            <div className="border rounded-lg p-4 bg-white">
              <h2 className="text-lg font-semibold mb-4">Mapa de Prueba</h2>
              <OpenStreetMapPicker
                key={`map-instance-${renderCount}`}
                onLocationSelect={handleLocationSelect}
                initialLocation={location}
                showDeliveryZones={true}
              />
            </div>
          )}
          
          {location && (
            <div className="border rounded-lg p-4 bg-white">
              <h2 className="text-lg font-semibold mb-4">Ubicación Seleccionada</h2>
              <p><strong>Latitud:</strong> {location.lat.toFixed(6)}</p>
              <p><strong>Longitud:</strong> {location.lng.toFixed(6)}</p>
              {location.address && (
                <p><strong>Dirección:</strong> {location.address}</p>
              )}
            </div>
          )}
        </div>
        
        <div className="border rounded-lg p-4 bg-white">
          <h2 className="text-lg font-semibold mb-4">Registro de Eventos</h2>
          <div className="h-80 overflow-y-auto bg-gray-50 p-4 rounded border">
            {logs.length === 0 ? (
              <p className="text-gray-500 text-center">No hay eventos registrados</p>
            ) : (
              <ul className="space-y-2">
                {logs.map((log, index) => (
                  <li key={index} className={`text-sm ${log.includes("ERROR") ? "text-red-600" : "text-gray-700"}`}>
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
          <li>Usa los botones para mostrar/ocultar o reiniciar el mapa</li>
          <li>Si el mapa no carga, observa los mensajes de error en el registro</li>
          <li>Haz clic en el mapa para seleccionar una ubicación</li>
          <li>Si el mapa se queda en "Cargando..." por más de 10 segundos, intenta reiniciarlo</li>
        </ul>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import SimplifiedMapPicker from "../../components/SimplifiedMapPicker";

// Definir tipos para la ubicación
interface LocationType {
  lat: number;
  lng: number;
  address?: string;
}

export default function DebugMapPage() {
  // Estado para verificar si estamos en el cliente
  const [isClient, setIsClient] = useState(false);
  // Estado para la visibilidad del mapa
  const [showMap, setShowMap] = useState(false);
  // Estado para la ubicación seleccionada
  const [location, setLocation] = useState<LocationType | null>(null);
  // Estado para los logs
  const [logs, setLogs] = useState<string[]>([]);
  // Contador para forzar re-renderizado
  const [renderCount, setRenderCount] = useState(0);
  // ID único para la instancia actual
  const [instanceId] = useState(() => Date.now().toString());

  // Efecto para inicializar en el cliente
  useEffect(() => {
    setIsClient(true);
    setShowMap(true);
    
    // Agregar log inicial
    addLog(`Componente montado (ID: ${instanceId})`);
    
    return () => {
      addLog("Componente desmontado");
    };
  }, [instanceId]);

  // Función para agregar logs
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev].slice(0, 20));
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
  if (!isClient) {
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold dark:text-white">Herramienta Mejorada de Diagnóstico de Mapa</h1>
        <Button 
          onClick={() => window.location.href = '/admin/zonas-delivery'} 
          className="bg-pink-600 hover:bg-pink-700 text-white"
        >
          Volver a Zonas de Delivery
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="flex space-x-4">
            <Button onClick={toggleMap} variant="outline" className="dark:text-white dark:border-gray-600 dark:hover:bg-gray-700">
              {showMap ? "Ocultar Mapa" : "Mostrar Mapa"}
            </Button>
            <Button 
              onClick={() => window.location.reload()} 
              variant="destructive"
              className="bg-red-500 hover:bg-red-600 text-white dark:bg-red-700 dark:hover:bg-red-800"
            >
              Recargar Página
            </Button>
          </div>
          
          {showMap && (
            <div className="border rounded-lg p-4 bg-white dark:bg-gray-800 dark:border-gray-700">
              <h2 className="text-lg font-semibold mb-4 dark:text-white">Mapa de Prueba (Versión Mejorada)</h2>
              <div className="relative">
                <SimplifiedMapPicker
                  key={`map-${renderCount}-${instanceId}`}
                  onLocationSelect={handleLocationSelect}
                  initialLocation={location}
                  showDeliveryZones={true}
                />
                <div className="absolute top-0 right-0 mt-2 mr-2">
                  <span className="bg-white px-2 py-1 text-xs rounded-full border shadow-sm">
                    Renderizado: {renderCount}
                  </span>
                </div>
              </div>
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
          <li>Esta es una versión mejorada del diagnóstico de mapa con un componente optimizado</li>
          <li>Usa los botones para mostrar/ocultar o reiniciar el mapa</li>
          <li>Si el mapa no carga, observa los mensajes de error en el registro</li>
          <li>Haz clic en el mapa para seleccionar una ubicación</li>
          <li>Si el mapa se queda en "Cargando..." por más de 10 segundos, intenta reiniciarlo</li>
        </ul>
      </div>
    </div>
  );
}

"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, Edit, Download, Upload, Save, AlertCircle } from "lucide-react"
import DeliveryZoneMapV9 from "../../components/DeliveryZoneMapV9"
import { type DeliveryZone } from "../../../lib/delivery-zones"
import { useDeliveryZones } from "../../../hooks/useDeliveryZones"
import { toast } from "@/hooks/use-toast"

export default function ZonasDeliveryPage() {
  // Usar el hook personalizado para gestionar las zonas
  const { zones, loading, error, saveZones } = useDeliveryZones()
  const [localZones, setLocalZones] = useState<DeliveryZone[]>([])
  const [isMapOpen, setIsMapOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Actualizar las zonas locales cuando se cargan desde Firestore
  useEffect(() => {
    console.log("Zonas recibidas del hook useDeliveryZones:", zones);
    
    if (Array.isArray(zones)) {
      if (zones.length > 0) {
        console.log("Actualizando zonas locales con las zonas de Firestore:", zones);
        setLocalZones([...zones]);
      } else {
        console.log("No hay zonas en Firestore. Estado local:", localZones);
        // Solo inicializar a array vacío si no hay zonas locales tampoco
        if (localZones.length === 0) {
          console.log("Inicializando estado local a array vacío");
          setLocalZones([]);
        }
      }
    } else {
      console.error("Error: zones no es un array", zones);
    }
  }, [zones]);

  const handleSaveZones = async (updatedZones: DeliveryZone[]) => {
    console.log("Zonas recibidas desde el editor de mapa:", updatedZones);
    
    // Si no hay zonas, mostrar un mensaje de advertencia
    if (!updatedZones || updatedZones.length === 0) {
      console.warn("¡Advertencia! Se recibió un array vacío de zonas desde el editor de mapa");
      toast({
        title: "Advertencia",
        description: "No se recibieron zonas desde el editor. No se han realizado cambios.",
        variant: "destructive",
      });
      return;
    }
    
    // Validar el formato de las zonas recibidas
    const zonasValidas = updatedZones.filter(zone => {
      // Verificar que la zona tenga los campos requeridos
      const tieneRequeridos = zone && zone.id && zone.nombre && 
                            zone.poligono && Array.isArray(zone.poligono) && 
                            zone.poligono.length >= 3;
      
      if (!tieneRequeridos) {
        console.error("Zona inválida encontrada:", zone);
        return false;
      }
      
      // Verificar el formato del polígono
      const formatoPoligonoValido = zone.poligono.every(punto => 
        Array.isArray(punto) && punto.length === 2 && 
        typeof punto[0] === 'number' && typeof punto[1] === 'number'
      );
      
      if (!formatoPoligonoValido) {
        console.error("Zona con formato de polígono inválido:", zone);
        return false;
      }
      
      return true;
    });
    
    if (zonasValidas.length < updatedZones.length) {
      console.warn(`Se filtró ${updatedZones.length - zonasValidas.length} zonas inválidas`);
      toast({
        title: "Advertencia",
        description: `Se encontraron ${updatedZones.length - zonasValidas.length} zonas con formato inválido que serán ignoradas.`,
        variant: "default",
      });
    }
    
    if (zonasValidas.length === 0) {
      toast({
        title: "Error",
        description: "No hay zonas válidas para guardar. Verifica el formato de las zonas dibujadas.",
        variant: "destructive",
      });
      return;
    }
    
    // Actualizar el estado local
    console.log("Actualizando estado local con zonas válidas:", zonasValidas);
    
    // Para evitar confusiones, guardamos inmediatamente en Firestore
    // Pero primero actualizamos el estado local y luego pasamos las zonas directamente
    // a la función saveChangesToFirestore para evitar problemas con el estado asíncrono
    setLocalZones(zonasValidas);
    
    // Marcar que hay cambios pendientes para guardar
    setHasChanges(true);
    
    // Mostrar mensaje al usuario
    toast({
      title: "Guardando zonas",
      description: `Guardando ${zonasValidas.length} zonas en la base de datos...`,
      variant: "default",
    });
    
    // Llamamos a la función pasando directamente las zonas validadas
    await saveChangesToFirestoreDirecto(zonasValidas);
  }
  
  // Función que recibe las zonas directamente como parámetro
  const saveChangesToFirestoreDirecto = async (zonas: DeliveryZone[]) => {
    setIsSaving(true);
    try {
      console.log("Página Admin: Guardando zonas en Firestore directamente:", zonas);
      
      if (!zonas || zonas.length === 0) {
        console.warn("¡No hay zonas para guardar! El array de zonas está vacío.");
        toast({
          title: "Advertencia",
          description: "No hay zonas para guardar. Crea al menos una zona antes de guardar.",
          variant: "destructive",
        });
        setIsSaving(false);
        return;
      }
      
      // Usar SOLO directamente la función de saveDeliveryZones para evitar conflictos
      const { saveDeliveryZones } = await import("../../../lib/delivery-zones-service");
      
      console.log(`Guardando ${zonas.length} zonas válidas directamente en Firestore...`);
      await saveDeliveryZones(zonas);
      console.log("Zonas guardadas exitosamente en Firestore mediante saveDeliveryZones");
      
      // Actualizar el estado para reflejar que se han guardado los cambios
      setHasChanges(false);
      
      // Notificar al usuario
      toast({
        title: "Zonas guardadas",
        description: `${zonas.length} zonas de delivery se han guardado correctamente en la base de datos.`,
        variant: "default",
      });
      
      // Recargamos las zonas para asegurar la coherencia
      const { getDeliveryZones } = await import("../../../lib/delivery-zones-service");
      const refreshedZones = await getDeliveryZones();
      
      console.log("Zonas recargadas desde Firestore:", refreshedZones);
      setLocalZones(refreshedZones);
    } catch (error) {
      console.error("Error guardando zonas:", error);
      toast({
        title: "Error",
        description: "Ocurrió un error inesperado al guardar las zonas.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }
  
  const saveChangesToFirestore = async () => {
    try {
      console.log("Página Admin: Guardando zonas del estado local en Firestore:", localZones);
      
      // Simplemente llamamos a la función que recibe las zonas directamente
      await saveChangesToFirestoreDirecto(localZones);
    } catch (error) {
      console.error("Error al guardar zonas desde el estado local:", error);
      toast({
        title: "Error",
        description: "Ocurrió un error inesperado al guardar las zonas.",
        variant: "destructive",
      });
    }
  }

  const exportZones = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(localZones, null, 2))
    const downloadAnchorNode = document.createElement("a")
    downloadAnchorNode.setAttribute("href", dataStr)
    downloadAnchorNode.setAttribute("download", "zonas-delivery.json")
    document.body.appendChild(downloadAnchorNode)
    downloadAnchorNode.click()
    downloadAnchorNode.remove()
  }

  const importZones = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const importedZones = JSON.parse(e.target?.result as string)
        // Validar que el formato sea correcto
        if (Array.isArray(importedZones) && importedZones.every(zone => 
          typeof zone.id === 'string' && 
          typeof zone.nombre === 'string' && 
          typeof zone.tarifa === 'number' && 
          Array.isArray(zone.poligono)
        )) {
          setLocalZones(importedZones)
          setHasChanges(true)
          toast({
            title: "Zonas importadas",
            description: `Se han importado ${importedZones.length} zonas. No olvides guardar los cambios.`,
            variant: "default",
          })
        } else {
          toast({
            title: "Formato incorrecto",
            description: "El archivo no tiene el formato esperado para zonas de delivery.",
            variant: "destructive",
          })
        }
      } catch (error) {
        toast({
          title: "Error al importar",
          description: "No se pudo procesar el archivo. Verifica que sea un JSON válido.",
          variant: "destructive",
        })
      }
    }
    reader.readAsText(file)
  }

  if (loading && localZones.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8 flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto mb-4"></div>
          <p>Cargando zonas de delivery...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Zonas de Delivery</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Administra las zonas de entrega y tarifas para Los Andes</p>
          </div>
          <div className="flex space-x-3">
            {/* Botón de reinicio/reset */}
            <Button 
              onClick={() => window.location.href = '/admin/reset-zonas'} 
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Reiniciar/Eliminar Zonas
            </Button>
            {/* Botón de depuración */}
            <Button 
              onClick={async () => {
                // Forzar recarga desde Firestore
                const { getDeliveryZones } = await import("../../../lib/delivery-zones-service");
                const loadedZones = await getDeliveryZones();
                console.log("DEBUG: Zonas actuales en Firestore:", loadedZones);
                toast({
                  title: "Estado de Firestore",
                  description: `Hay ${loadedZones.length} zonas en la base de datos.`,
                  variant: "default",
                });
                // Actualizar estado local
                if (loadedZones.length > 0) {
                  setLocalZones(loadedZones);
                  toast({
                    title: "Zonas recargadas",
                    description: "Se han recargado las zonas desde Firestore.",
                    variant: "default",
                  });
                }
              }} 
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              Recargar desde Firestore
            </Button>
            <Button onClick={() => setIsMapOpen(true)} className="bg-pink-600 hover:bg-pink-700 text-white">
              <Edit className="w-4 h-4 mr-2" />
              Editar Zonas en Mapa
            </Button>
            <Button 
              onClick={() => window.location.href = '/admin/debug-mapa-mejorado'} 
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <MapPin className="w-4 h-4 mr-2" />
              Herramienta de Diagnóstico
            </Button>
            {hasChanges && (
              <Button 
                onClick={saveChangesToFirestore} 
                disabled={isSaving}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Guardar Cambios
                  </>
                )}
              </Button>
            )}
            <div className="flex space-x-2">
              <Button variant="outline" onClick={exportZones}>
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
              <div className="relative">
                <Button variant="outline">
                  <Upload className="w-4 h-4 mr-2" />
                  Importar
                </Button>
                <input
                  type="file"
                  accept=".json"
                  onChange={importZones}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {localZones.length === 0 ? (
            <div className="col-span-3 flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-lg">
              <div className="text-center mb-6">
                <h3 className="text-xl font-medium mb-2">No hay zonas de delivery configuradas</h3>
                <p className="text-gray-500">
                  No se encontraron zonas de delivery en la base de datos. 
                  Haz clic en el botón "Editar Zonas en Mapa" para crear nuevas zonas personalizadas.
                </p>
              </div>
              <Button onClick={() => setIsMapOpen(true)} className="bg-pink-600 hover:bg-pink-700 text-white">
                <Edit className="w-4 h-4 mr-2" />
                Crear Zonas de Delivery
              </Button>
            </div>
          ) : (
            localZones.map((zone) => (
              <Card key={zone.id} className="overflow-hidden bg-white dark:bg-gray-800 border dark:border-gray-700">
                <div className="h-2" style={{ backgroundColor: zone.color }}></div>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-xl dark:text-white">{zone.nombre}</CardTitle>
                    <Badge variant={zone.disponible ? "default" : "destructive"}>
                      {zone.disponible ? "Disponible" : "No Disponible"}
                    </Badge>
                  </div>
                  <CardDescription className="dark:text-gray-400">{zone.descripcion || "Sin descripción"}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-500">Tarifa de Delivery:</span>
                      <span className="font-bold text-lg">${zone.tarifa.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-500">Tiempo Estimado:</span>
                      <span>{zone.tiempoEstimado}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-500">Puntos del Polígono:</span>
                      <span>{zone.poligono.length}</span>
                    </div>
                    <div className="pt-2">
                      <Button variant="outline" size="sm" className="w-full" onClick={() => setIsMapOpen(true)}>
                        <MapPin className="w-4 h-4 mr-2" />
                        Ver en Mapa
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <DeliveryZoneMapV9 
          isOpen={isMapOpen} 
          onClose={() => setIsMapOpen(false)} 
          onSaveZones={handleSaveZones} 
          initialZones={localZones}
        />
        
        {/* Sección de herramientas adicionales */}
        <div className="mt-10 p-6 border rounded-lg bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800">
          <h2 className="text-xl font-semibold mb-3 dark:text-white">Herramientas Avanzadas</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Si experimentas problemas con las zonas de delivery o necesitas probar la funcionalidad de ubicación,
            puedes utilizar nuestras herramientas avanzadas.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button 
              onClick={() => window.location.href = '/admin/debug-mapa-mejorado'} 
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <MapPin className="w-4 h-4 mr-2" />
              Herramienta de Diagnóstico de Mapa
            </Button>
            <Button 
              onClick={() => window.location.href = '/admin/reset-zonas'} 
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <AlertCircle className="w-4 h-4 mr-2" />
              Restablecer/Eliminar Zonas
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}

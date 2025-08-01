"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { toast } from "@/hooks/use-toast"
import { defaultDeliveryZones } from "../../../lib/delivery-zones"
import { 
  getDeliveryZones, 
  saveDeliveryZones, 
  deleteDeliveryZone, 
  DELIVERY_ZONES_COLLECTION 
} from "../../../lib/delivery-zones-service"
import { collection, getDocs, deleteDoc } from "firebase/firestore"
import { db } from "../../../lib/firebase"

export default function ResetZonasPage() {
  const [zonas, setZonas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState(false)
  
  const cargarZonas = async () => {
    setLoading(true)
    try {
      const loadedZones = await getDeliveryZones()
      setZonas(loadedZones)
    } catch (error) {
      console.error("Error al cargar zonas:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar las zonas de delivery",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }
  
  useEffect(() => {
    cargarZonas()
  }, [])
  
  const eliminarTodasLasZonas = async () => {
    if (!confirm("¿Estás seguro de eliminar TODAS las zonas? Esta acción no se puede deshacer.")) {
      return
    }
    
    setProcesando(true)
    try {
      // Obtener todas las zonas
      const zonesRef = collection(db, DELIVERY_ZONES_COLLECTION)
      const snapshot = await getDocs(zonesRef)
      
      if (snapshot.empty) {
        toast({
          title: "Información",
          description: "No hay zonas para eliminar",
          variant: "default",
        })
        return
      }
      
      // Eliminar cada zona
      let contador = 0
      for (const doc of snapshot.docs) {
        await deleteDoc(doc.ref)
        contador++
      }
      
      toast({
        title: "Zonas eliminadas",
        description: `Se han eliminado ${contador} zonas de la base de datos`,
        variant: "default",
      })
      
      // Recargar las zonas
      await cargarZonas()
    } catch (error) {
      console.error("Error al eliminar zonas:", error)
      toast({
        title: "Error",
        description: "No se pudieron eliminar todas las zonas",
        variant: "destructive",
      })
    } finally {
      setProcesando(false)
    }
  }
  
  const inicializarZonasPredeterminadas = async () => {
    if (!confirm("¿Estás seguro de inicializar las zonas predeterminadas? Esto reemplazará cualquier zona existente.")) {
      return
    }
    
    setProcesando(true)
    try {
      // Primero eliminamos todas las zonas existentes
      await eliminarTodasLasZonas()
      
      // Luego guardamos las zonas predeterminadas
      await saveDeliveryZones(defaultDeliveryZones)
      
      toast({
        title: "Zonas inicializadas",
        description: "Se han inicializado las zonas predeterminadas",
        variant: "default",
      })
      
      // Recargar las zonas
      await cargarZonas()
    } catch (error) {
      console.error("Error al inicializar zonas:", error)
      toast({
        title: "Error",
        description: "No se pudieron inicializar las zonas predeterminadas",
        variant: "destructive",
      })
    } finally {
      setProcesando(false)
    }
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Herramienta de Reinicio de Zonas</h1>
      
      <Alert className="mb-6 bg-red-50 border-red-200">
        <AlertTitle className="text-red-600">¡Advertencia! Herramienta de administración avanzada</AlertTitle>
        <AlertDescription className="text-red-500">
          Esta herramienta permite realizar operaciones destructivas en la base de datos.
          Úsala con precaución, las acciones no se pueden deshacer.
        </AlertDescription>
      </Alert>
      
      <Alert className="mb-6 bg-blue-50 border-blue-200">
        <AlertTitle className="text-blue-600">Información importante</AlertTitle>
        <AlertDescription className="text-blue-600">
          Al eliminar todas las zonas, el sistema quedará sin zonas de delivery. El sistema ya no creará 
          automáticamente zonas predeterminadas. Deberás crear tus propias zonas manualmente desde la
          página de administración de zonas.
        </AlertDescription>
      </Alert>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Estado Actual</CardTitle>
            <CardDescription>Zonas de delivery en la base de datos</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-600"></div>
              </div>
            ) : (
              <>
                <p className="mb-4">
                  Total de zonas: <span className="font-bold">{zonas.length}</span>
                </p>
                <div className="space-y-3 max-h-60 overflow-auto p-2 border rounded">
                  {zonas.length === 0 ? (
                    <p className="text-gray-500 italic">No hay zonas en la base de datos</p>
                  ) : (
                    zonas.map((zona) => (
                      <div key={zona.id} className="border-b pb-2">
                        <p className="font-semibold">{zona.nombre}</p>
                        <p className="text-sm text-gray-600">ID: {zona.id}</p>
                        <p className="text-sm">Tarifa: ${zona.tarifa}</p>
                      </div>
                    ))
                  )}
                </div>
                <Button 
                  onClick={cargarZonas} 
                  variant="outline" 
                  className="mt-4"
                  disabled={loading}
                >
                  Recargar zonas
                </Button>
              </>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Acciones</CardTitle>
            <CardDescription>Operaciones para gestionar las zonas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Button 
                onClick={eliminarTodasLasZonas} 
                variant="destructive" 
                className="w-full"
                disabled={procesando}
              >
                {procesando ? 'Procesando...' : 'Eliminar TODAS las zonas'}
              </Button>
              <p className="text-xs text-gray-500 mt-1">
                Elimina todas las zonas de la base de datos. Esta acción no se puede deshacer.
              </p>
            </div>
            
            <div>
              <Button 
                onClick={inicializarZonasPredeterminadas} 
                variant="default" 
                className="w-full bg-amber-500 hover:bg-amber-600"
                disabled={procesando}
              >
                {procesando ? 'Procesando...' : 'Inicializar zonas predeterminadas'}
              </Button>
              <p className="text-xs text-gray-500 mt-1">
                Elimina todas las zonas y luego crea las zonas predeterminadas del sistema.
              </p>
            </div>
            
            <div>
              <Button 
                onClick={() => window.location.href = '/admin/zonas-delivery'} 
                variant="outline" 
                className="w-full"
              >
                Volver a la administración de zonas
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

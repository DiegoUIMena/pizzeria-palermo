"use client"

import { useState, useEffect } from 'react'
import { 
  getDeliveryZones, 
  saveDeliveryZones, 
  saveDeliveryZone, 
  deleteDeliveryZone, 
  subscribeToDeliveryZones,
  initializeDeliveryZones
} from '../lib/delivery-zones-service'
import { defaultDeliveryZones, updateDeliveryZones, type DeliveryZone } from '../lib/delivery-zones'

/**
 * Hook personalizado para gestionar zonas de delivery
 */
export function useDeliveryZones() {
  const [zones, setZones] = useState<DeliveryZone[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Cargar las zonas al inicializar
  useEffect(() => {
    let isMounted = true;
    
    console.log("Hook useDeliveryZones: Inicializando...");
    
    const loadZones = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Primero intentamos obtener las zonas desde Firestore
        console.log("Hook: Cargando zonas desde Firestore...");
        const loadedZones = await getDeliveryZones();
        
        if (isMounted) {
          if (loadedZones.length > 0) {
            // Si hay zonas en Firestore, usamos esas
            console.log("Hook: Encontradas zonas en Firestore:", loadedZones.length);
            setZones(loadedZones);
            updateDeliveryZones(loadedZones);
          } else {
            // Si no hay zonas en Firestore, dejamos el array vacío para que el usuario cree sus propias zonas
            console.log("Hook: No hay zonas en Firestore, usando array vacío");
            setZones([]);
            updateDeliveryZones([]);
            
            // Informamos al usuario (solo para depuración)
            console.log("Hook: No se inicializaron zonas predeterminadas - el usuario deberá crear sus propias zonas");
          }
          
          setLoading(false);
        }
      } catch (err) {
        console.error("Error cargando zonas:", err);
        if (isMounted) {
          setError('Error al cargar las zonas de delivery');
          // En caso de error, usamos un array vacío
          console.log("Hook: Error al cargar zonas, usando array vacío");
          setZones([]);
          updateDeliveryZones([]);
          setLoading(false);
        }
      }
    };

    // Suscribirse a cambios en tiempo real
    console.log("Hook: Configurando suscripción a cambios en tiempo real...");
    const unsubscribe = subscribeToDeliveryZones((updatedZones) => {
      if (isMounted) {
        console.log("Hook: Recibidos cambios en tiempo real de zonas:", updatedZones);
        
        if (updatedZones.length > 0) {
          setZones(updatedZones);
          updateDeliveryZones(updatedZones);
        } else {
          console.log("Hook: No hay zonas en la actualización, manteniendo estado actual");
        }
        
        setLoading(false);
      }
    });
    
    // Cargar inicialmente
    loadZones()
    
    // Limpiar al desmontar
    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  // Función para guardar todas las zonas
  const saveZones = async (newZones: DeliveryZone[]) => {
    try {
      setLoading(true);
      console.log("Hook: Guardando zonas en Firestore:", newZones);
      
      // Guardar las zonas en Firestore
      await saveDeliveryZones(newZones);
      
      console.log("Hook: Zonas guardadas correctamente en Firestore");
      
      // Actualizar el estado local
      setZones(newZones);
      
      // Actualizar la versión global para compatibilidad
      updateDeliveryZones(newZones);
      
      setLoading(false);
      return true;
    } catch (err) {
      console.error("Error guardando zonas:", err);
      setError('Error al guardar las zonas de delivery');
      setLoading(false);
      return false;
    }
  }

  // Función para guardar una zona
  const saveZone = async (zone: DeliveryZone) => {
    try {
      setLoading(true)
      await saveDeliveryZone(zone)
      setLoading(false)
      return true
    } catch (err) {
      console.error("Error guardando zona:", err)
      setError('Error al guardar la zona de delivery')
      setLoading(false)
      return false
    }
  }

  // Función para eliminar una zona
  const deleteZone = async (zoneId: string) => {
    try {
      setLoading(true)
      await deleteDeliveryZone(zoneId)
      setLoading(false)
      return true
    } catch (err) {
      console.error("Error eliminando zona:", err)
      setError('Error al eliminar la zona de delivery')
      setLoading(false)
      return false
    }
  }

  return {
    zones,
    loading,
    error,
    saveZones,
    saveZone,
    deleteZone,
    setError
  }
}

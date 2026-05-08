"use client"

import { useState, useEffect } from 'react'
import { 
  saveDeliveryZones, 
  saveDeliveryZone, 
  deleteDeliveryZone, 
  subscribeToDeliveryZones
} from '../lib/delivery-zones-service'
import { updateDeliveryZones, type DeliveryZone } from '../lib/delivery-zones'

/**
 * Hook personalizado para gestionar zonas de delivery
 */
export function useDeliveryZones() {
  const [zones, setZones] = useState<DeliveryZone[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Cargar las zonas al inicializar
  useEffect(() => {
    let isMounted = true
    setLoading(true)
    setError(null)

    // Suscribirse a cambios en tiempo real
    const unsubscribe = subscribeToDeliveryZones((updatedZones) => {
      if (isMounted) {
        setZones(updatedZones)
        updateDeliveryZones(updatedZones)
        setLoading(false)
      }
    })
    
    // Limpiar al desmontar
    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  // Función para guardar todas las zonas
  const saveZones = async (newZones: DeliveryZone[]) => {
    try {
      setLoading(true)
      setError(null)
      
      // Guardar las zonas en Firestore
      await saveDeliveryZones(newZones)
      
      // Actualizar el estado local
      setZones(newZones)
      
      // Actualizar la versión global para compatibilidad
      updateDeliveryZones(newZones)
      
      setLoading(false)
      return true
    } catch (err) {
      console.error("Error guardando zonas:", err)
      setError('Error al guardar las zonas de delivery');
      setLoading(false)
      return false
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

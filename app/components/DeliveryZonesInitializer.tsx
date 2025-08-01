"use client"

import { useEffect } from 'react'
import { initializeDeliveryZones } from '../../lib/delivery-zones-service'
import { defaultDeliveryZones } from '../../lib/delivery-zones'

// IMPORTANTE: Este componente ya no inicializa automáticamente las zonas
// Se mantiene por compatibilidad pero ya no realiza ninguna acción
export default function DeliveryZonesInitializer() {
  useEffect(() => {
    // Ya no inicializamos automáticamente para permitir personalización
    console.log("DeliveryZonesInitializer: La inicialización automática de zonas predeterminadas está deshabilitada.")
    console.log("Para crear zonas predeterminadas, usa la página de administración de zonas.")
  }, [])
  
  // Este componente no renderiza nada visualmente
  return null
}

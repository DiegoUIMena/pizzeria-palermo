'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useFormattedAdminOrders } from '@/hooks/useAdminOrders'
import { useAlarms } from '../context/AlarmsContext'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

// Clave para almacenar los tiempos en localStorage
const TIEMPOS_STORAGE_KEY = 'admin_pedidos_tiempos'
const CUENTAS_STORAGE_KEY = 'admin_pedidos_cuentas'
const ULTIMO_UPDATE_KEY = 'admin_pedidos_ultimo_update'

/**
 * Componente global para monitorear pedidos nuevos y tiempos críticos,
 * disparando alarmas independientemente de en qué página se encuentre el administrador
 */
export default function GlobalOrderMonitor() {
  const { pedidos, isLoading } = useFormattedAdminOrders()
  const { 
    reproducirAlarmaNuevoPedido, 
    reproducirAlarmaTiempoAgotandose, 
    iniciarAlarmaRepetitiva, 
    detenerAlarmaRepetitiva, 
    alarmaActiva 
  } = useAlarms()
  
  // Estados para monitoreo global
  const [tiemposEstimados, setTiemposEstimados] = useState<Record<string, number>>({})
  const [cuentasRegresivas, setCuentasRegresivas] = useState<Record<string, number>>({})
  const [pedidosConPocoTiempo, setPedidosConPocoTiempo] = useState<Set<string>>(new Set())
  
  // Referencias para tracking
  const pedidosNotificadosRef = useRef<Set<string>>(new Set())
  const pedidosSinAtenderRef = useRef<Set<string>>(new Set())
  const ultimoTickRef = useRef<number>(Date.now())
  
  // Cargar tiempos guardados en localStorage al inicio
  useEffect(() => {
    try {
      // Recuperar datos guardados
      const tiemposGuardados = localStorage.getItem(TIEMPOS_STORAGE_KEY)
      const cuentasGuardadas = localStorage.getItem(CUENTAS_STORAGE_KEY)
      const ultimoUpdate = localStorage.getItem(ULTIMO_UPDATE_KEY)
      
      if (tiemposGuardados && cuentasGuardadas && ultimoUpdate) {
        const tiempos = JSON.parse(tiemposGuardados)
        const cuentas = JSON.parse(cuentasGuardadas)
        const timestamp = parseInt(ultimoUpdate, 10)
        
        // Calcular cuánto tiempo ha pasado desde la última actualización
        const ahora = Date.now()
        const segundosTranscurridos = Math.floor((ahora - timestamp) / 1000)
        
        // Ajustar cuentas regresivas teniendo en cuenta el tiempo transcurrido
        const cuentasActualizadas: Record<string, number> = {}
        for (const id in cuentas) {
          // Restar el tiempo transcurrido
          const tiempoRestante = Math.max(0, cuentas[id] - segundosTranscurridos)
          cuentasActualizadas[id] = tiempoRestante
        }
        
        // Actualizar estados
        setTiemposEstimados(tiempos)
        setCuentasRegresivas(cuentasActualizadas)
        
        console.log(`[GLOBAL] Recuperados ${Object.keys(cuentasActualizadas).length} tiempos de pedidos desde localStorage. Han transcurrido ${segundosTranscurridos} segundos.`)
      }
    } catch (error) {
      console.error("[GLOBAL] Error al cargar tiempos desde localStorage:", error)
    }
  }, [])
  
  // Función auxiliar para formatear tiempo
  const formatearTiempo = (seg: number) => {
    const minutos = Math.floor(seg / 60)
    const segundos = seg % 60
    return `${minutos}:${segundos < 10 ? '0' : ''}${segundos}`
  }
  
  // Función para guardar los tiempos en localStorage
  const guardarTiemposEnStorage = useCallback((tiempos: Record<string, number>, cuentas: Record<string, number>) => {
    try {
      localStorage.setItem(TIEMPOS_STORAGE_KEY, JSON.stringify(tiempos))
      localStorage.setItem(CUENTAS_STORAGE_KEY, JSON.stringify(cuentas))
      localStorage.setItem(ULTIMO_UPDATE_KEY, Date.now().toString())
      
      // Log para depuración
      console.log("[GLOBAL] Guardados en localStorage:", {
        tiempos,
        cuentas,
        timestamp: Date.now()
      })
    } catch (error) {
      console.error("[GLOBAL] Error al guardar tiempos en localStorage:", error)
    }
  }, [])
  
  // Detectar pedidos nuevos a nivel global
  useEffect(() => {
    // No hacer nada si está cargando
    if (isLoading) return
    
    // Buscar pedidos pendientes que no hayamos notificado aún
    const pedidosPendientesNuevos = new Set<string>()
    const pedidosPendientesActuales = new Set<string>()
    
    pedidos.forEach(pedido => {
      // Solo considerar pedidos pendientes
      if (pedido.estado === "Pendiente") {
        pedidosPendientesActuales.add(pedido.documentId)
        
        // Si no lo hemos notificado antes, es nuevo
        if (!pedidosNotificadosRef.current.has(pedido.documentId)) {
          pedidosPendientesNuevos.add(pedido.documentId)
          // Marcar como notificado
          pedidosNotificadosRef.current.add(pedido.documentId)
        }
      }
    })
    
    // Si hay nuevos pedidos pendientes, activar alarma
    if (pedidosPendientesNuevos.size > 0) {
      console.log(`🔔 [GLOBAL] Detectados ${pedidosPendientesNuevos.size} nuevos pedidos pendientes`)
      
      // Actualizar pedidos sin atender
      pedidosPendientesNuevos.forEach(id => {
        pedidosSinAtenderRef.current.add(id)
      })
      
      // Activar alarma si no está sonando ya
      if (!alarmaActiva) {
        iniciarAlarmaRepetitiva()
      }
    }
    
    // Actualizar pedidosSinAtenderRef solo con los que siguen pendientes
    const nuevosSinAtender = new Set<string>()
    pedidosSinAtenderRef.current.forEach(id => {
      if (pedidosPendientesActuales.has(id)) {
        nuevosSinAtender.add(id)
      }
    })
    pedidosSinAtenderRef.current = nuevosSinAtender
    
    // Si no hay pedidos sin atender, detener la alarma
    if (pedidosSinAtenderRef.current.size === 0 && alarmaActiva) {
      console.log(`✅ [GLOBAL] Todos los pedidos atendidos, deteniendo alarma`)
      detenerAlarmaRepetitiva()
    }
    
    // Limpiar IDs de pedidos que ya no están en la lista o no están pendientes
    const idsActuales = new Set(pedidos.map(p => p.documentId))
    const notificadosParaEliminar: string[] = []
    
    pedidosNotificadosRef.current.forEach(id => {
      const pedido = pedidos.find(p => p.documentId === id)
      // Eliminar si el pedido ya no existe o no está pendiente
      if (!idsActuales.has(id) || (pedido && pedido.estado !== "Pendiente")) {
        notificadosParaEliminar.push(id)
      }
    })
    
    notificadosParaEliminar.forEach(id => {
      pedidosNotificadosRef.current.delete(id)
    })
    
  }, [pedidos, isLoading, alarmaActiva, iniciarAlarmaRepetitiva, detenerAlarmaRepetitiva])

  // Sincronizar tiempos estimados y cuentas regresivas
  useEffect(() => {
    // Calcular tiempos estimados a partir de los datos de pedidos
    const newTiemposEstimados: Record<string, number> = {}
    const newCuentasRegresivas: Record<string, number> = {}
    let hasChanges = false
    
    // Primero eliminar de los estados actuales los pedidos entregados o cancelados
    const pedidosActivos = new Set(pedidos
      .filter(p => p.estado !== "Entregado" && p.estado !== "Cancelado")
      .map(p => p.documentId))
    
    // Verificar si hay pedidos en nuestro estado que ya no están activos
    for (const id in tiemposEstimados) {
      if (!pedidosActivos.has(id)) {
        console.log(`[GLOBAL] Eliminando pedido completado ${id} de los estados`)
        hasChanges = true
        // No incluimos este pedido en los nuevos estados
        
        // También eliminar de pedidosConPocoTiempo si está ahí
        if (pedidosConPocoTiempo.has(id)) {
          setPedidosConPocoTiempo(prev => {
            const nuevos = new Set(prev)
            nuevos.delete(id)
            return nuevos
          })
        }
      }
    }
    
    // Procesar pedidos activos
    pedidos.forEach(pedido => {
      // Solo procesar pedidos con tiempo estimado y que no estén entregados/cancelados
      if (pedido.tiempoEstimadoMinutos && pedido.tiempoEstimadoInicio && 
          pedido.estado !== "Entregado" && pedido.estado !== "Cancelado") {
        const minutos = pedido.tiempoEstimadoMinutos
        const inicioDate = new Date(pedido.tiempoEstimadoInicio)
        const ahora = new Date()
        
        // Calcular segundos transcurridos desde el inicio
        const segundosTranscurridos = Math.floor((ahora.getTime() - inicioDate.getTime()) / 1000)
        
        // Calcular segundos restantes
        const segundosTotales = minutos * 60
        const segundosRestantes = Math.max(0, segundosTotales - segundosTranscurridos)
        
        // Actualizar estado si es diferente
        if (tiemposEstimados[pedido.documentId] !== segundosTotales || 
            cuentasRegresivas[pedido.documentId] !== segundosRestantes) {
          hasChanges = true
          newTiemposEstimados[pedido.documentId] = segundosTotales
          newCuentasRegresivas[pedido.documentId] = segundosRestantes
        } else {
          // Mantener los valores existentes
          newTiemposEstimados[pedido.documentId] = tiemposEstimados[pedido.documentId]
          newCuentasRegresivas[pedido.documentId] = cuentasRegresivas[pedido.documentId]
        }
      }
    })
    
    // Solo actualizar estados si hay cambios reales
    if (hasChanges) {
      setTiemposEstimados(newTiemposEstimados)
      setCuentasRegresivas(newCuentasRegresivas)
      
      // Guardar en localStorage para persistencia
      guardarTiemposEnStorage(newTiemposEstimados, newCuentasRegresivas)
    }
  }, [pedidos, guardarTiemposEnStorage])

  // Actualizar cuentas regresivas cada segundo y detectar tiempos críticos
  useEffect(() => {
    // No iniciar el timer si está cargando
    if (isLoading) return undefined
    
    const timer = setInterval(() => {
      // Calcular el tiempo transcurrido desde el último tick (debería ser cercano a 1 segundo)
      const ahora = Date.now()
      const delta = Math.floor((ahora - ultimoTickRef.current) / 1000)
      ultimoTickRef.current = ahora
      
      // Si pasaron más de 10 segundos, probablemente la pestaña estuvo inactiva
      // En ese caso, recalcular los tiempos basados en la sincronización con Firebase
      if (delta > 10) {
        console.log(`[GLOBAL] Detectada inactividad de ${delta} segundos, recalculando tiempos...`)
        // No necesitamos hacer nada aquí porque el efecto de sincronización con pedidos
        // se encargará de recalcular los tiempos correctamente
        return
      }
      
      setCuentasRegresivas(prev => {
        const newCuentas = { ...prev }
        let hasChanges = false
        const nuevosPocoTiempo = new Set<string>(pedidosConPocoTiempo)
        
        // Para cada pedido con cuenta regresiva
        for (const id in newCuentas) {
          // Primero verificar si el pedido sigue activo (no está entregado ni cancelado)
          const pedido = pedidos.find(p => p.documentId === id)
          
          // Si el pedido ya no existe o está entregado/cancelado, eliminarlo de las cuentas regresivas
          if (!pedido || pedido.estado === "Entregado" || pedido.estado === "Cancelado") {
            delete newCuentas[id]
            nuevosPocoTiempo.delete(id)
            hasChanges = true
            console.log(`[GLOBAL] Eliminando pedido ${id} de cuentas regresivas por estar completado o cancelado`)
            continue
          }
          
          // Reducir el tiempo según el delta (normalmente 1 segundo)
          if (newCuentas[id] > 0) {
            newCuentas[id] = Math.max(0, newCuentas[id] - delta)
            hasChanges = true
            
            // Si llegó a exactamente 3 minutos (180 segundos), agregar a la lista de poco tiempo y reproducir alarma
            if (newCuentas[id] <= 180 && newCuentas[id] > 175) { // Margen para evitar perder la alarma por lag
              console.log(`⚠️ [GLOBAL] Pedido ${id} ahora tiene 3 minutos o menos`)
              
              if (!nuevosPocoTiempo.has(id)) {
                nuevosPocoTiempo.add(id)
                // Reproducir alarma cuando un pedido entra en tiempo crítico (pasando el ID)
                reproducirAlarmaTiempoAgotandose(id)
              }
            }
            
            // Cada 60 segundos exactos, reproducir alarma si hay pedidos con poco tiempo (menor a 3 minutos)
            if (newCuentas[id] > 0 && newCuentas[id] <= 180 && (Math.floor(newCuentas[id]) % 60 <= delta)) {
              if (nuevosPocoTiempo.has(id)) {
                console.log(`⏱️ [GLOBAL] Recordatorio de tiempo crítico para pedido ${id}: ${formatearTiempo(newCuentas[id])}`)
                reproducirAlarmaTiempoAgotandose(id)
              }
            }
          } else if (newCuentas[id] === 0) {
            // Si el tiempo llegó a cero, también reproducir alarma, pero solo si está en nuevosPocoTiempo
            // y el pedido no está entregado o cancelado
            const pedido = pedidos.find(p => p.documentId === id)
            if (nuevosPocoTiempo.has(id) && pedido && 
                pedido.estado !== "Entregado" && pedido.estado !== "Cancelado") {
              console.log(`⚠️ [GLOBAL] ¡Tiempo agotado para pedido ${id}!`)
              reproducirAlarmaTiempoAgotandose(id)
            }
          }
        }
        
        // Actualizar el estado de pedidos con poco tiempo si cambió
        if (nuevosPocoTiempo.size !== pedidosConPocoTiempo.size || 
            ![...nuevosPocoTiempo].every(id => pedidosConPocoTiempo.has(id)) ||
            ![...pedidosConPocoTiempo].every(id => nuevosPocoTiempo.has(id))) {
          
          // Log para depuración: pedidos eliminados de tiempo crítico
          const eliminados = [...pedidosConPocoTiempo].filter(id => !nuevosPocoTiempo.has(id))
          if (eliminados.length > 0) {
            console.log(`[GLOBAL] Pedidos eliminados de tiempo crítico: ${eliminados.join(', ')}`)
          }
          
          setPedidosConPocoTiempo(nuevosPocoTiempo)
        }
        
        // Guardar en localStorage cada 5 segundos para no saturar
        if (hasChanges && Date.now() % 5000 < 1000) {
          guardarTiemposEnStorage(tiemposEstimados, newCuentas)
        }
        
        return hasChanges ? newCuentas : prev
      })
    }, 1000)
    
    return () => clearInterval(timer)
  }, [isLoading, reproducirAlarmaTiempoAgotandose, pedidosConPocoTiempo, tiemposEstimados, guardarTiemposEnStorage])

  // Método para establecer tiempo estimado (exportado a través de window para que otras partes de la app lo usen)
  const establecerTiempoEstimado = useCallback(async (pedidoId: string, minutos: number) => {
    try {
      console.log(`[GLOBAL] Estableciendo tiempo estimado para pedido ${pedidoId}: ${minutos} minutos`)
      
      // Validación
      if (minutos < 3.5) {
        console.warn(`⚠️ [GLOBAL] Estableciendo tiempo muy corto (${minutos} minutos) para pruebas de alarma`)
      }
      
      // Calcular tiempos
      const ahora = new Date()
      const tiempoEstimadoInicio = ahora.toISOString()
      
      // Calcular hora estimada de entrega
      const tiempoEntrega = new Date(ahora.getTime() + minutos * 60 * 1000)
      const tiempoEstimadoFin = tiempoEntrega.toISOString()
      
      // Formateo para mostrar al usuario
      const tiempoFormateado = `${minutos} minutos (${tiempoEntrega.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})`
      
      // Actualizar en Firebase
      const pedidoRef = doc(db, "orders", pedidoId)
      await updateDoc(pedidoRef, {
        tiempoEstimado: tiempoFormateado,
        tiempoEstimadoMinutos: minutos,
        tiempoEstimadoInicio,
        tiempoEstimadoFin,
      })
      
      // Actualizar estados locales
      const segundosTotales = minutos * 60
      
      setTiemposEstimados(prev => {
        const newTiempos = { ...prev, [pedidoId]: segundosTotales }
        return newTiempos
      })
      
      setCuentasRegresivas(prev => {
        const newCuentas = { ...prev, [pedidoId]: segundosTotales }
        // También guardar en localStorage
        guardarTiemposEnStorage({ ...tiemposEstimados, [pedidoId]: segundosTotales }, newCuentas)
        return newCuentas
      })
      
      console.log(`✅ [GLOBAL] Tiempo estimado establecido para pedido ${pedidoId}: ${tiempoFormateado}`)
      return true
    } catch (error) {
      console.error("[GLOBAL] Error al establecer tiempo estimado:", error)
      return false
    }
  }, [tiemposEstimados, guardarTiemposEnStorage])

  // Exponer el método establecerTiempoEstimado a nivel global para que otras partes de la app puedan usarlo
  useEffect(() => {
    // @ts-ignore
    window.establecerTiempoEstimadoGlobal = establecerTiempoEstimado
    
    return () => {
      // @ts-ignore
      delete window.establecerTiempoEstimadoGlobal
    }
  }, [establecerTiempoEstimado])

  // Este componente no renderiza nada visible
  return null
}

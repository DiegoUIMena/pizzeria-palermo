import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore'
import { listenIngredientes, type Ingrediente } from '@/lib/inventory'
import { listenToAllOrders, type Order } from '../lib/orders'
import { db } from '../lib/firebase'

export interface DashboardStats {
  totalPedidos: number
  pedidosPendientes: number
  pedidosEnProceso: number
  pedidosEntregados: number
  ventasHoy: number
  stockBajo: number
  clientesActivos: number
}

export interface PedidoResumen {
  id: string
  cliente: string
  total: number
  estado: Order['estado']
  tiempo: string
}

export interface InventarioAlerta {
  id: string
  nombre: string
  stockActual: number
  stockMinimo: number
  unidad?: string
  estado: 'Stock Bajo' | 'Agotado'
}

interface UseAdminDashboardReturn {
  stats: DashboardStats
  pedidosRecientes: (PedidoResumen & { docId?: string, isNuevo?: boolean })[]
  alertasInventario: InventarioAlerta[]
  nuevosPendientes: number
  loading: boolean
  error: string | null
  acknowledgeNuevos: () => void
}

export function useAdminDashboard(): UseAdminDashboardReturn {
  const [orders, setOrders] = useState<Order[]>([])
  const [alertasInventario, setAlertasInventario] = useState<InventarioAlerta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const prevOrderIdsRef = useRef<Set<string>>(new Set())
  const [nuevosPendientes, setNuevosPendientes] = useState(0)
  const nuevosPendientesIdsRef = useRef<Set<string>>(new Set())

  const acknowledgeNuevos = useCallback(() => {
    // Al reconocer, limpiamos el contador pero mantenemos prevOrderIds para futuras detecciones
    nuevosPendientesIdsRef.current.clear()
    setNuevosPendientes(0)
  }, [])

  // Suscripción en tiempo real a pedidos
  useEffect(() => {
    try {
      const unsubscribe = listenToAllOrders((all) => {
        // Detectar nuevos pedidos pendientes no vistos antes
        const prevIds = prevOrderIdsRef.current
        const newPendingArr: string[] = []
        all.forEach(o => {
          const docId = o.id as string
          if (o.estado === 'Pendiente' && docId && !prevIds.has(docId)) {
            newPendingArr.push(docId)
          }
        })
        if (newPendingArr.length) {
          newPendingArr.forEach(id => nuevosPendientesIdsRef.current.add(id))
          setNuevosPendientes(nuevosPendientesIdsRef.current.size)
        }
        // Actualizar referencia de ids vistos
        prevOrderIdsRef.current = new Set(all.map(o => o.id as string))

        setOrders(all)
        setLoading(false)
      })
      return () => unsubscribe()
    } catch (e: any) {
      setError('Error suscribiendo pedidos')
      setLoading(false)
    }
  }, [])

  // Suscripción en tiempo real a ingredientes para alertas de stock bajo
  useEffect(() => {
    let unsub: (() => void) | undefined
    try {
      unsub = listenIngredientes((items: Ingrediente[]) => {
        const low: InventarioAlerta[] = items
          .filter(i => i.stockActual <= i.stockMinimo || i.estado === 'Stock Bajo' || i.estado === 'Agotado')
          .map(i => ({
            id: i.id,
            nombre: i.nombre,
            stockActual: i.stockActual,
            stockMinimo: i.stockMinimo,
            unidad: i.unidad,
            estado: (i.stockActual === 0 ? 'Agotado' : 'Stock Bajo') as ('Agotado' | 'Stock Bajo')
          }))
        setAlertasInventario(low)
      })
    } catch (e) {
      // Fallback: intentar una sola lectura de colección legacy 'inventory'
      ;(async () => {
        try {
          const invQuery = query(collection(db, 'inventory'), orderBy('nombre'), limit(100))
            const snap = await getDocs(invQuery)
            if (snap.empty) { setAlertasInventario([]); return }
            const low: InventarioAlerta[] = []
            snap.forEach(docSnap => {
              const data: any = docSnap.data()
              if (data && typeof data.stockActual === 'number' && typeof data.stockMinimo === 'number') {
                if (data.stockActual <= data.stockMinimo) {
                  low.push({
                    id: docSnap.id,
                    nombre: data.nombre || docSnap.id,
                    stockActual: data.stockActual,
                    stockMinimo: data.stockMinimo,
                    unidad: data.unidad,
                    estado: (data.stockActual === 0 ? 'Agotado' : 'Stock Bajo') as ('Agotado' | 'Stock Bajo')
                  })
                }
              }
            })
            setAlertasInventario(low)
        } catch {}
      })()
    }
    return () => { if (unsub) unsub() }
  }, [])

  const stats: DashboardStats = useMemo(() => {
    if (!orders.length) {
      return {
        totalPedidos: 0,
        pedidosPendientes: 0,
        pedidosEnProceso: 0,
        pedidosEntregados: 0,
        ventasHoy: 0,
        stockBajo: alertasInventario.length,
        clientesActivos: 0,
      }
    }

    const now = new Date()
    const todayDate = now.toISOString().slice(0,10) // YYYY-MM-DD

    let pedidosPendientes = 0
    let pedidosEnProceso = 0
    let pedidosEntregados = 0
    let ventasHoy = 0
    const clientesHoy = new Set<string>()

    orders.forEach(o => {
      switch (o.estado) {
        case 'Pendiente': pedidosPendientes++; break
        case 'En preparación':
        case 'En camino':
        case 'Pedido Listo':
          pedidosEnProceso++; break
        case 'Entregado': pedidosEntregados++; break
      }
      // Usar timestamp ISO para comparar día
      const createdISO = o.timestamps?.created
      if (createdISO && typeof createdISO === 'string') {
        if (createdISO.startsWith(todayDate)) {
          ventasHoy += o.total || 0
          if (o.userId) clientesHoy.add(o.userId)
        }
      }
    })

    return {
      totalPedidos: orders.length,
      pedidosPendientes,
      pedidosEnProceso,
      pedidosEntregados,
      ventasHoy,
      stockBajo: alertasInventario.length,
      clientesActivos: clientesHoy.size,
    }
  }, [orders, alertasInventario])

  const pedidosRecientes: (PedidoResumen & { docId?: string, isNuevo?: boolean })[] = useMemo(() => {
    return orders.slice(0,4).map(o => {
      // Tiempo relativo simple
      let tiempo = ''
      const createdISO = o.timestamps?.created
      if (createdISO) {
        const created = new Date(createdISO)
        const diffMin = Math.max(0, Math.floor((Date.now() - created.getTime())/60000))
        if (diffMin < 1) tiempo = 'Hace instantes'
        else if (diffMin < 60) tiempo = `Hace ${diffMin} min`
        else {
          const diffH = Math.floor(diffMin/60)
            tiempo = `Hace ${diffH}h ${diffMin%60}m`
        }
      }
      const docId = o.id as string | undefined
      const isNuevo = !!(docId && nuevosPendientesIdsRef.current.has(docId))
      return {
        id: `#${o.orderNumber}`,
        cliente: typeof o.cliente === 'object' ? (o.cliente?.nombre || 'Cliente') : (o.cliente as any) || 'Cliente',
        total: o.total,
        estado: o.estado,
        tiempo,
        docId,
        isNuevo
      }
    })
  }, [orders])

  return { stats, pedidosRecientes, alertasInventario, nuevosPendientes, loading, error, acknowledgeNuevos }
}

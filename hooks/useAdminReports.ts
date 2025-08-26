import { useEffect, useMemo, useState } from 'react'
import { listenToAllOrders, type Order } from '@/lib/orders'
import { collection, getDocs, orderBy, query, limit, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { addDays, subDays, startOfDay, isWithinInterval, format, subWeeks, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'

export type Periodo = 'semana' | 'mes' | 'trimestre' | 'anual'

interface KPIStats {
  ventasTotal: number
  ventasCrecimiento: number
  ticketPromedio: number
  ticketCrecimiento: number
  clientesNuevos: number
  clientesCrecimiento: number
  tiempoEntrega: number // minutos promedio
  tiempoEntregaCrecimiento: number
}

export interface SalesPoint { label: string; value: number }
export interface ProductShare { name: string; value: number }
export interface InventoryItem { id: string; nombre: string; stockActual: number; stockMinimo: number; stockMaximo?: number }
export interface ClientesPoint { month: string; nuevos: number; total: number }

interface UseAdminReportsReturn {
  orders: Order[]
  loading: boolean
  error: string | null
  kpis: KPIStats
  getSalesSeries: (periodo: Periodo) => SalesPoint[]
  getProductShare: (periodo: Periodo) => ProductShare[]
  inventory: InventoryItem[]
  clientesSeries: ClientesPoint[]
}

const toDate = (iso?: string) => (iso ? new Date(iso) : null)

const currencyRound = (v: number) => Math.round(v)

export function useAdminReports(): UseAdminReportsReturn {
  const [orders, setOrders] = useState<Order[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const unsub = listenToAllOrders((all) => {
      setOrders(all)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    // Primero intentamos colección principal 'ingredientes'; si vacía, fallback a 'inventory'
    const qMain = query(collection(db, 'ingredientes'), orderBy('nombre'), limit(500))
    const unsubMain = onSnapshot(qMain, snap => {
      if (!snap.size) {
        // fallback sólo una vez a inventory
        const qFallback = query(collection(db, 'inventory'), orderBy('nombre'), limit(500))
        getDocs(qFallback).then(fSnap => {
          const arr: InventoryItem[] = []
          fSnap.forEach(d => {
            const data: any = d.data()
            arr.push({
              id: d.id,
              nombre: data.nombre || d.id,
              stockActual: data.stockActual ?? 0,
              stockMinimo: data.stockMinimo ?? 0,
              stockMaximo: data.stockMaximo,
            })
          })
          setInventory(arr)
        })
        return
      }
      const arr: InventoryItem[] = []
      snap.forEach(d => {
        const data: any = d.data()
        arr.push({
          id: d.id,
          nombre: data.nombre || d.id,
          stockActual: data.stockActual ?? 0,
          stockMinimo: data.stockMinimo ?? 0,
          stockMaximo: data.stockMaximo,
        })
      })
      setInventory(arr)
    }, () => {/* ignore errors */})
    return () => unsubMain()
  }, [])

  // Helpers para filtrar períodos relativos
  const filterOrdersByPeriodo = (periodo: Periodo): Order[] => {
    if (!orders.length) return []
    const now = new Date()
    let start: Date
    switch (periodo) {
      case 'semana':
        start = subDays(startOfDay(now), 6) // últimos 7 días
        break
      case 'mes':
        start = subDays(startOfDay(now), 29)
        break
      case 'trimestre':
        start = subWeeks(startOfDay(now), 12 - 1) // 12 semanas (~ trimestre extendido)
        break
      case 'anual':
        start = subMonths(startOfDay(now), 11)
        break
    }
    return orders.filter(o => {
      const d = toDate(o.timestamps?.created)
      return d && d >= start && d <= now
    })
  }

  const computeKPI = useMemo((): KPIStats => {
    // Usamos periodo actual: últimos 30 días, previo 30 días
    const now = new Date()
    const startCurrent = subDays(startOfDay(now), 29)
    const startPrev = subDays(startCurrent, 30)
    const endPrev = subDays(startCurrent, 1)

    let ventasActual = 0, ventasPrev = 0
    let pedidosActual = 0, pedidosPrev = 0
    let clientesNuevosActual = 0, clientesNuevosPrev = 0
    let totalTiempoEntregaActual = 0, entregadosActual = 0
    let totalTiempoEntregaPrev = 0, entregadosPrev = 0

    // Map de primer pedido por usuario
    const firstOrderDate: Record<string, Date> = {}
    orders.forEach(o => {
      const created = toDate(o.timestamps?.created)
      if (!created) return
      if (!firstOrderDate[o.userId] || firstOrderDate[o.userId] > created) {
        firstOrderDate[o.userId] = created
      }
    })

    orders.forEach(o => {
      const created = toDate(o.timestamps?.created)
      if (!created) return
      const delivered = toDate(o.timestamps?.delivered)
      const isFirst = firstOrderDate[o.userId]?.getTime() === created.getTime()
      // Periodo actual
      if (created >= startCurrent) {
        ventasActual += o.total || 0
        pedidosActual++
        if (isFirst) clientesNuevosActual++
        if (delivered) {
          totalTiempoEntregaActual += Math.max(0, (delivered.getTime() - created.getTime()) / 60000)
          entregadosActual++
        }
      } else if (created >= startPrev && created <= endPrev) {
        ventasPrev += o.total || 0
        pedidosPrev++
        if (isFirst) clientesNuevosPrev++
        if (delivered) {
          totalTiempoEntregaPrev += Math.max(0, (delivered.getTime() - created.getTime()) / 60000)
          entregadosPrev++
        }
      }
    })

    const ticketActual = pedidosActual ? ventasActual / pedidosActual : 0
    const ticketPrev = pedidosPrev ? ventasPrev / pedidosPrev : 0
    const tiempoActual = entregadosActual ? totalTiempoEntregaActual / entregadosActual : 0
    const tiempoPrev = entregadosPrev ? totalTiempoEntregaPrev / entregadosPrev : 0

    const growth = (curr: number, prev: number) => {
      if (!prev) return curr ? 100 : 0
      return ((curr - prev) / prev) * 100
    }

    return {
      ventasTotal: currencyRound(ventasActual),
      ventasCrecimiento: parseFloat(growth(ventasActual, ventasPrev).toFixed(1)),
      ticketPromedio: currencyRound(ticketActual),
      ticketCrecimiento: parseFloat(growth(ticketActual, ticketPrev).toFixed(1)),
      clientesNuevos: clientesNuevosActual,
      clientesCrecimiento: parseFloat(growth(clientesNuevosActual, clientesNuevosPrev).toFixed(1)),
      tiempoEntrega: parseFloat(tiempoActual.toFixed(0)),
      tiempoEntregaCrecimiento: parseFloat(growth(tiempoActual, tiempoPrev).toFixed(1)),
    }
  }, [orders])

  const getSalesSeries = (periodo: Periodo): SalesPoint[] => {
    const filtered = filterOrdersByPeriodo(periodo)
    if (!filtered.length) return []
    const now = new Date()
    const map: Record<string, number> = {}
    const pushPoint = (label: string, value: number) => { map[label] = (map[label] || 0) + value }

    switch (periodo) {
      case 'semana': {
        for (let i = 6; i >= 0; i--) {
          const day = subDays(startOfDay(now), i)
          const lab = format(day, 'EEE', { locale: es })
          map[lab] = 0
        }
        filtered.forEach(o => {
          const d = toDate(o.timestamps?.created)!
          const lab = format(d, 'EEE', { locale: es })
          pushPoint(lab, o.total || 0)
        })
        break
      }
      case 'mes': { // agrupar por semana relativa
        for (let w = 1; w <= 5; w++) map[`Sem ${w}`] = 0
        const start = subDays(startOfDay(now), 29)
        filtered.forEach(o => {
          const d = toDate(o.timestamps?.created)!
          const diff = Math.floor((d.getTime() - start.getTime()) / 86400000)
            const w = Math.min(4, Math.floor(diff / 7)) + 1
          pushPoint(`Sem ${w}`, o.total || 0)
        })
        break
      }
      case 'trimestre': { // 12 semanas
        for (let w = 1; w <= 12; w++) map[`W${w}`] = 0
        const start = subWeeks(startOfDay(now), 11)
        filtered.forEach(o => {
          const d = toDate(o.timestamps?.created)!
          const diffWeeks = Math.floor((d.getTime() - start.getTime()) / (7 * 86400000))
          const label = `W${diffWeeks + 1}`
          if (map[label] !== undefined) pushPoint(label, o.total || 0)
        })
        break
      }
      case 'anual': {
        for (let i = 11; i >= 0; i--) {
          const m = subMonths(startOfDay(now), i)
          const lab = format(m, 'MMM', { locale: es })
          map[lab] = 0
        }
        filtered.forEach(o => {
          const d = toDate(o.timestamps?.created)!
          const lab = format(d, 'MMM', { locale: es })
          pushPoint(lab, o.total || 0)
        })
        break
      }
    }
    return Object.entries(map).map(([label, value]) => ({ label, value }))
  }

  const getProductShare = (periodo: Periodo): ProductShare[] => {
    const filtered = filterOrdersByPeriodo(periodo)
    if (!filtered.length) return []
    const counts: Record<string, number> = {}
    filtered.forEach(o => {
      o.items?.forEach(item => {
        const key = item.nombre || item.pizzaType || 'Producto'
        counts[key] = (counts[key] || 0) + (item.cantidad || 1)
      })
    })
    const entries = Object.entries(counts).sort((a,b)=>b[1]-a[1])
    const top = entries.slice(0,5)
    const others = entries.slice(5)
    const total = entries.reduce((acc,[,v])=>acc+v,0)
    const data: ProductShare[] = top.map(([name,value])=>({ name, value: parseFloat(((value/total)*100).toFixed(1)) }))
    if (others.length) {
      const otherVal = others.reduce((acc,[,v])=>acc+v,0)
      data.push({ name: 'Otros', value: parseFloat(((otherVal/total)*100).toFixed(1)) })
    }
    return data
  }

  const clientesSeries: ClientesPoint[] = useMemo(() => {
    if (!orders.length) return []
    const now = new Date()
    const months: string[] = []
    const monthStart = subMonths(startOfDay(now), 11)
    for (let i = 0; i < 12; i++) {
      const m = addDays(monthStart, i * 30) // approx month; later labeling by real month of order
      months.push(format(subMonths(now, 11 - i), 'MMM', { locale: es }))
    }
    // Map first order date per user
    const firstOrder: Record<string, Date> = {}
    orders.forEach(o => {
      const d = toDate(o.timestamps?.created)
      if (!d) return
      if (!firstOrder[o.userId] || firstOrder[o.userId] > d) firstOrder[o.userId] = d
    })
    const byMonth: Record<string, { nuevos: Set<string>; activos: Set<string> }> = {}
    months.forEach(m => { byMonth[m] = { nuevos: new Set(), activos: new Set() } })
    orders.forEach(o => {
      const d = toDate(o.timestamps?.created)
      if (!d) return
      const label = format(d, 'MMM', { locale: es })
      if (!byMonth[label]) return
      byMonth[label].activos.add(o.userId)
      const first = firstOrder[o.userId]
      if (first && format(first, 'MMM', { locale: es }) === label) {
        byMonth[label].nuevos.add(o.userId)
      }
    })
    return months.map(m => ({ month: m, nuevos: byMonth[m].nuevos.size, total: byMonth[m].activos.size }))
  }, [orders])

  return { orders, loading, error, kpis: computeKPI, getSalesSeries, getProductShare, inventory, clientesSeries }
}

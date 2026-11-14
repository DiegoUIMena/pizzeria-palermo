"use client"

import React, { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  Truck, 
  ClipboardList, 
  Printer, 
  Calendar, 
  Search, 
  DollarSign, 
  PackageCheck, 
  MapPin, 
  User, 
  Phone,
  Clock, 
  CreditCard,
  Banknote,
  Send
} from "lucide-react"
import DeliveryReportModal from "./DeliveryReportModal"
import RepartidoresPlanillaModal from "./RepartidoresPlanillaModal"
import { 
  ExtendedOrder, 
  getOrderDateRaw, 
  isDeliveryOrder, 
  getOrderDeliveryFee, 
  getSafeTime, 
  isValidSale,
  getMetodoCategoria 
} from "./PagosReport"

interface DeliveryReportTabProps {
  orders: any[]
}

type PeriodoFilter = "hoy" | "semana" | "mes" | "anio" | "personalizado"

// Funciones auxiliares ultra-seguras para extraer strings de pedidos de Firestore
// previniendo cualquier error de renderizado de objetos como React Children
function extractDriverName(order: any): string {
  if (!order) return "Sin asignar"

  // 1. Objeto o string en repartidor
  if (order.repartidor) {
    if (typeof order.repartidor === "string" && order.repartidor.trim()) {
      return order.repartidor.trim()
    }
    if (typeof order.repartidor === "object") {
      if (order.repartidor.nombre && typeof order.repartidor.nombre === "string") {
        return order.repartidor.nombre.trim()
      }
      if (order.repartidor.iniciales && typeof order.repartidor.iniciales === "string") {
        return order.repartidor.iniciales.trim()
      }
    }
  }

  // 2. Objeto o string en driver
  if (order.driver) {
    if (typeof order.driver === "string" && order.driver.trim()) {
      return order.driver.trim()
    }
    if (typeof order.driver === "object") {
      if (order.driver.nombre && typeof order.driver.nombre === "string") {
        return order.driver.nombre.trim()
      }
      if (order.driver.name && typeof order.driver.name === "string") {
        return order.driver.name.trim()
      }
      if (order.driver.iniciales && typeof order.driver.iniciales === "string") {
        return order.driver.iniciales.trim()
      }
    }
  }

  // 3. Campos directos tipo string
  if (typeof order.repartidorNombre === "string" && order.repartidorNombre.trim()) {
    return order.repartidorNombre.trim()
  }
  if (typeof order.repartidorIniciales === "string" && order.repartidorIniciales.trim()) {
    return order.repartidorIniciales.trim()
  }
  if (typeof order.driverName === "string" && order.driverName.trim()) {
    return order.driverName.trim()
  }
  if (typeof order.driverInitials === "string" && order.driverInitials.trim()) {
    return order.driverInitials.trim()
  }
  if (typeof order.repartidorAsignado === "string" && order.repartidorAsignado.trim()) {
    return order.repartidorAsignado.trim()
  }

  return "Sin asignar"
}

function extractClientName(order: any): string {
  if (!order) return "Cliente"
  if (order.cliente) {
    if (typeof order.cliente === "string" && order.cliente.trim()) return order.cliente.trim()
    if (typeof order.cliente === "object" && typeof order.cliente.nombre === "string") return order.cliente.nombre.trim()
  }
  if (order.customer) {
    if (typeof order.customer === "string" && order.customer.trim()) return order.customer.trim()
    if (typeof order.customer === "object" && typeof order.customer.name === "string") return order.customer.name.trim()
  }
  if (typeof order.nombreCliente === "string" && order.nombreCliente.trim()) return order.nombreCliente.trim()
  if (typeof order.nombre === "string" && order.nombre.trim()) return order.nombre.trim()
  return "Cliente"
}

function extractClientPhone(order: any): string {
  if (!order) return ""
  if (order.cliente && typeof order.cliente === "object" && order.cliente.telefono) {
    return String(order.cliente.telefono).trim()
  }
  if (order.customer && typeof order.customer === "object" && order.customer.phone) {
    return String(order.customer.phone).trim()
  }
  if (typeof order.telefono === "string" && order.telefono.trim()) return order.telefono.trim()
  if (typeof order.phone === "string" && order.phone.trim()) return order.phone.trim()
  return ""
}

function extractAddress(order: any): string {
  if (!order) return "Entrega a domicilio"
  if (typeof order.direccion === "string" && order.direccion.trim()) {
    return order.direccion.trim()
  }
  if (order.direccion && typeof order.direccion === "object") {
    if (typeof order.direccion.address === "string" && order.direccion.address.trim()) {
      return order.direccion.address.trim()
    }
    if (order.direccion.calle) {
      return `${order.direccion.calle} ${order.direccion.numero || ""}`.trim()
    }
  }
  if (order.deliveryAddress) {
    if (typeof order.deliveryAddress === "string" && order.deliveryAddress.trim()) {
      return order.deliveryAddress.trim()
    }
    if (typeof order.deliveryAddress === "object" && typeof order.deliveryAddress.address === "string") {
      return order.deliveryAddress.address.trim()
    }
  }
  if (order.customer && typeof order.customer === "object") {
    if (typeof order.customer.address === "string" && order.customer.address.trim()) {
      return order.customer.address.trim()
    }
  }
  if (order.deliveryInfo && typeof order.deliveryInfo === "object") {
    if (order.deliveryInfo.zone && typeof order.deliveryInfo.zone.nombre === "string") {
      return order.deliveryInfo.zone.nombre.trim()
    }
    if (typeof order.deliveryInfo.direccion === "string" && order.deliveryInfo.direccion.trim()) {
      return order.deliveryInfo.direccion.trim()
    }
  }
  return "Entrega a domicilio"
}

function extractPaymentMethod(order: any): string {
  if (!order) return "—"
  if (typeof order.metodoPago === "string" && order.metodoPago.trim()) {
    return order.metodoPago.trim()
  }
  if (typeof order.paymentMethod === "string" && order.paymentMethod.trim()) {
    return order.paymentMethod.trim()
  }
  const cat = getMetodoCategoria(order.metodoPago)
  return typeof cat === "string" ? cat : "—"
}

export default function DeliveryReportTab({ orders }: DeliveryReportTabProps) {
  const [periodoFilter, setPeriodoFilter] = useState<PeriodoFilter>("hoy")
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date()
    return today.toISOString().split("T")[0]
  })
  const [searchTerm, setSearchTerm] = useState("")
  const [deliveryReportModalOpen, setDeliveryReportModalOpen] = useState(false)
  const [repartidoresPlanillaModalOpen, setRepartidoresPlanillaModalOpen] = useState(false)

  // 1. Filtrar pedidos en el período seleccionado
  const { ordersInPeriod, deliveryOrders, metrics } = useMemo(() => {
    const extOrders = orders as ExtendedOrder[]
    const now = new Date()

    let start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    let end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

    if (periodoFilter === "semana") {
      const day = now.getDay()
      const diff = now.getDate() - day + (day === 0 ? -6 : 1) // Lunes como inicio
      start = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0)
      end = new Date(now.getFullYear(), now.getMonth(), diff + 6, 23, 59, 59, 999)
    } else if (periodoFilter === "mes") {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    } else if (periodoFilter === "anio") {
      start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0)
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)
    } else if (periodoFilter === "personalizado" && selectedDate) {
      const [year, month, day] = selectedDate.split("-").map(Number)
      if (year && month && day) {
        start = new Date(year, month - 1, day, 0, 0, 0, 0)
        end = new Date(year, month - 1, day, 23, 59, 59, 999)
      }
    }

    const startTime = start.getTime()
    const endTime = end.getTime()

    // Pedidos en el rango de tiempo
    const inPeriod = extOrders.filter((o) => {
      const d = getOrderDateRaw(o)
      if (!d) return false
      const t = getSafeTime(d)
      return t >= startTime && t <= endTime
    })

    // Todos los pedidos registrados en el sistema (excluyendo solo cancelados o pagos rechazados)
    const validInPeriod = inPeriod.filter(
      (o) => o.estado !== "Cancelado" && o.estado !== "Pago Rechazado"
    )

    // Filtrar solo pedidos de delivery
    const deliveryList = validInPeriod.filter((o) => isDeliveryOrder(o) || getOrderDeliveryFee(o) > 0)

    // Calcular métricas
    let totalDelivery = 0
    let totalVentasDelivery = 0

    deliveryList.forEach((o) => {
      totalDelivery += getOrderDeliveryFee(o)
      totalVentasDelivery += Number(o.total) || 0
    })

    const countDelivery = deliveryList.length
    const promedioTarifa = countDelivery > 0 ? Math.round(totalDelivery / countDelivery) : 0

    return {
      ordersInPeriod: inPeriod,
      deliveryOrders: deliveryList,
      metrics: {
        totalDelivery,
        totalVentasDelivery,
        countDelivery,
        promedioTarifa,
      },
    }
  }, [orders, periodoFilter, selectedDate])

  // 2. Filtrado para la tabla de pedidos según el buscador
  const filteredDeliveryOrders = useMemo(() => {
    if (!searchTerm.trim()) return deliveryOrders

    const term = searchTerm.toLowerCase().trim()
    return deliveryOrders.filter((order) => {
      const idMatch = (order.id ? String(order.id) : "").toLowerCase().includes(term)
      const numMatch = order.orderNumber ? String(order.orderNumber).includes(term) : false
      const clientMatch = extractClientName(order).toLowerCase().includes(term)
      const phoneMatch = extractClientPhone(order).toLowerCase().includes(term)
      const addressMatch = extractAddress(order).toLowerCase().includes(term)
      const driverMatch = extractDriverName(order).toLowerCase().includes(term)

      return idMatch || numMatch || clientMatch || phoneMatch || addressMatch || driverMatch
    })
  }, [deliveryOrders, searchTerm])

  const periodoLabel = useMemo(() => {
    if (periodoFilter === "hoy") return "Hoy"
    if (periodoFilter === "semana") return "Esta Semana"
    if (periodoFilter === "mes") return "Este Mes"
    if (periodoFilter === "anio") return "Este Año"
    return selectedDate || "Personalizado"
  }, [periodoFilter, selectedDate])

  return (
    <div className="space-y-6">
      {/* Barra de Filtros y Acciones */}
      <Card className="bg-white dark:bg-gray-800 border dark:border-gray-700 shadow-sm">
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Selector de Período */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mr-1">
              Período:
            </span>
            <Button
              type="button"
              size="sm"
              variant={periodoFilter === "hoy" ? "default" : "outline"}
              onClick={() => setPeriodoFilter("hoy")}
              className={`text-xs h-8 ${
                periodoFilter === "hoy"
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : "text-gray-700 dark:text-gray-300"
              }`}
            >
              Hoy
            </Button>
            <Button
              type="button"
              size="sm"
              variant={periodoFilter === "semana" ? "default" : "outline"}
              onClick={() => setPeriodoFilter("semana")}
              className={`text-xs h-8 ${
                periodoFilter === "semana"
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : "text-gray-700 dark:text-gray-300"
              }`}
            >
              Esta Semana
            </Button>
            <Button
              type="button"
              size="sm"
              variant={periodoFilter === "mes" ? "default" : "outline"}
              onClick={() => setPeriodoFilter("mes")}
              className={`text-xs h-8 ${
                periodoFilter === "mes"
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : "text-gray-700 dark:text-gray-300"
              }`}
            >
              Este Mes
            </Button>
            <Button
              type="button"
              size="sm"
              variant={periodoFilter === "anio" ? "default" : "outline"}
              onClick={() => setPeriodoFilter("anio")}
              className={`text-xs h-8 ${
                periodoFilter === "anio"
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : "text-gray-700 dark:text-gray-300"
              }`}
            >
              Este Año
            </Button>

            {/* Selector de Fecha Específica */}
            <div className="flex items-center gap-1.5 ml-1">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value)
                  setPeriodoFilter("personalizado")
                }}
                className={`text-xs h-8 px-2 rounded-md border bg-white dark:bg-gray-900 ${
                  periodoFilter === "personalizado"
                    ? "border-amber-600 ring-1 ring-amber-600 text-amber-700 dark:text-amber-400 font-semibold"
                    : "border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300"
                }`}
              />
            </div>
          </div>

          {/* Botones de Acción de Delivery */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={() => setRepartidoresPlanillaModalOpen(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-9 font-semibold gap-1.5 shadow-sm"
            >
              <ClipboardList className="w-4 h-4" />
              Planilla de Repartidores
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => setDeliveryReportModalOpen(true)}
              className="border-amber-600/40 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-xs h-9 font-semibold gap-1.5"
            >
              <Printer className="w-4 h-4" />
              Imprimir Planilla
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Contenedor Principal: Tarjetas de Resumen de Delivery */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. CONTENEDOR TOTAL DELIVERY (Trasladado desde Ventas) */}
        <Card className="bg-white dark:bg-gray-800 border-2 border-amber-500/30 dark:border-amber-500/20 shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <div>
              <CardTitle className="text-base font-bold text-gray-800 dark:text-gray-200">
                Total Delivery
              </CardTitle>
              <CardDescription className="text-xs text-gray-500">
                {periodoLabel}
              </CardDescription>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setRepartidoresPlanillaModalOpen(true)}
                title="Planilla de liquidación de repartidores"
                className="h-8 w-8 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/60 p-0 rounded-lg transition-colors"
              >
                <ClipboardList className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setDeliveryReportModalOpen(true)}
                title="Imprimir planilla de delivery"
                className="h-8 w-8 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/60 p-0 rounded-lg transition-colors"
              >
                <Printer className="h-4 w-4" />
              </Button>
              <div className="p-2 bg-amber-100 dark:bg-amber-950/60 rounded-lg">
                <Truck className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-amber-600 dark:text-amber-400">
              ${metrics.totalDelivery.toLocaleString("es-CL")}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-300 mt-2 flex items-center justify-between">
              <span className="font-medium">
                {metrics.countDelivery} {metrics.countDelivery === 1 ? "pedido" : "pedidos"} con delivery
              </span>
              <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full">
                Tarifas de Reparto
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 2. Total Ventas con Delivery */}
        <Card className="bg-white dark:bg-gray-800 border dark:border-gray-700 shadow-sm hover:shadow transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <div>
              <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Venta Total en Delivery
              </CardTitle>
              <CardDescription className="text-xs text-gray-500">
                Total de deliverys registrados ({periodoLabel})
              </CardDescription>
            </div>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg">
              <PackageCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              ${metrics.totalDelivery.toLocaleString("es-CL")}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {metrics.countDelivery}{" "}
              {metrics.countDelivery === 1 ? "delivery realizado" : "deliverys realizados"} (todos los repartidores, liquidados y pendientes)
            </p>
          </CardContent>
        </Card>

        {/* 3. Tarifa Promedio de Envío */}
        <Card className="bg-white dark:bg-gray-800 border dark:border-gray-700 shadow-sm hover:shadow transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <div>
              <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Tarifa Promedio
              </CardTitle>
              <CardDescription className="text-xs text-gray-500">
                Por pedido entregado
              </CardDescription>
            </div>
            <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-lg">
              <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              ${metrics.promedioTarifa.toLocaleString("es-CL")}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Costo medio cobrado por despacho
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla Detallada de Pedidos con Delivery */}
      <Card className="bg-white dark:bg-gray-800 border dark:border-gray-700 shadow-sm">
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b dark:border-gray-700/60">
          <div>
            <CardTitle className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Truck className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              Detalle de Pedidos con Delivery
            </CardTitle>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Listado de entregas realizadas durante el período seleccionado ({filteredDeliveryOrders.length} pedidos)
            </p>
          </div>

          <div className="w-full md:w-80">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Buscar por cliente, teléfono, dirección..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 text-xs h-9 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-[11px] uppercase bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
                <tr>
                  <th className="py-3 px-4 font-semibold">N° Pedido</th>
                  <th className="py-3 px-4 font-semibold">Fecha y Hora</th>
                  <th className="py-3 px-4 font-semibold">Cliente</th>
                  <th className="py-3 px-4 font-semibold">Dirección de Entrega</th>
                  <th className="py-3 px-4 font-semibold">Repartidor</th>
                  <th className="py-3 px-4 font-semibold">Método</th>
                  <th className="py-3 px-4 font-semibold text-right">Tarifa Delivery</th>
                  <th className="py-3 px-4 font-semibold text-right">Total Pedido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredDeliveryOrders.length > 0 ? (
                  filteredDeliveryOrders.map((order, idx) => {
                    const fee = getOrderDeliveryFee(order)
                    const total = Number(order.total) || 0
                    const orderDate = getOrderDateRaw(order)
                    const formattedDate = orderDate
                      ? new Date(getSafeTime(orderDate)).toLocaleString("es-CL", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"

                    const clientName = extractClientName(order)
                    const clientPhone = extractClientPhone(order)
                    const address = extractAddress(order)
                    const driverName = extractDriverName(order)
                    const paymentMethodName = extractPaymentMethod(order)

                    return (
                      <tr
                        key={order.id || idx}
                        className="hover:bg-gray-50/70 dark:hover:bg-gray-900/40 transition-colors"
                      >
                        <td className="py-3 px-4 font-mono font-bold text-gray-900 dark:text-white">
                          #{order.orderNumber || (order.id ? String(order.id).slice(-6).toUpperCase() : idx + 1)}
                        </td>
                        <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                          {formattedDate}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-gray-900 dark:text-gray-100">{clientName}</div>
                          {clientPhone && (
                            <div className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                              <Phone className="w-2.5 h-2.5" />
                              {clientPhone}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 max-w-xs truncate text-gray-600 dark:text-gray-300" title={address}>
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-amber-500 shrink-0" />
                            <span className="truncate">{address}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-medium ${
                              driverName !== "Sin asignar"
                                ? "border-amber-400 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40"
                                : "border-gray-200 text-gray-400"
                            }`}
                          >
                            {driverName}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 capitalize">
                          <span className="text-[11px] text-gray-700 dark:text-gray-300">
                            {paymentMethodName}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-amber-600 dark:text-amber-400">
                          ${fee.toLocaleString("es-CL")}
                        </td>
                        <td className="py-3 px-4 text-right font-extrabold text-gray-900 dark:text-white">
                          ${total.toLocaleString("es-CL")}
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-gray-400">
                      <Truck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      No se encontraron pedidos con delivery en este período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Planilla / Reporte de Delivery para Impresión */}
      <DeliveryReportModal
        open={deliveryReportModalOpen}
        onOpenChange={setDeliveryReportModalOpen}
        orders={ordersInPeriod}
        periodoLabel={periodoLabel}
        periodoFilter={periodoFilter}
        selectedDate={selectedDate}
        totalDelivery={metrics.totalDelivery}
        countDelivery={metrics.countDelivery}
      />

      {/* Modal de Liquidación y Desglose por Repartidor (recibe todos los pedidos para acumular repartos no liquidados sin depender del día filtrado) */}
      <RepartidoresPlanillaModal
        open={repartidoresPlanillaModalOpen}
        onOpenChange={setRepartidoresPlanillaModalOpen}
        orders={orders as ExtendedOrder[]}
      />
    </div>
  )
}

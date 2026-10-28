"use client"

import React, { useState, useEffect, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Truck,
  DollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  Printer,
  FileSpreadsheet,
  MapPin,
  Phone,
  User,
  ShieldCheck,
  RotateCcw,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { getDeliveryDriverConfig, DeliveryDriverContact } from "@/lib/delivery-driver-config"
import {
  getDriverSettlements,
  saveDriverSettlement,
  DriverSettlement,
} from "@/lib/driver-settlements"
import { ExtendedOrder, getOrderDeliveryFee, getSafeTime, getOrderDateRaw, isDeliveryOrder } from "./PagosReport"

interface RepartidoresPlanillaModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orders: ExtendedOrder[]
}

const formatCurrency = (val: number) => `$${Math.round(val || 0).toLocaleString("es-CL")}`

export default function RepartidoresPlanillaModal({
  open,
  onOpenChange,
  orders,
}: RepartidoresPlanillaModalProps) {
  const [repartidoresConfig, setRepartidoresConfig] = useState<DeliveryDriverContact[]>([])
  const [settlements, setSettlements] = useState<DriverSettlement[]>([])
  const [selectedDriverInitials, setSelectedDriverInitials] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [savingPayment, setSavingPayment] = useState(false)

  // Cargar configuración de repartidores y liquidaciones guardadas al abrir
  useEffect(() => {
    if (!open) return

    const loadData = async () => {
      setLoading(true)
      try {
        const [config, liquidaciones] = await Promise.all([
          getDeliveryDriverConfig(),
          getDriverSettlements(),
        ])
        setRepartidoresConfig(config.contactos || [])
        setSettlements(liquidaciones || [])
      } catch (err) {
        console.error("Error cargando datos para planilla de repartidores:", err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [open])

  // Filtrar todos los pedidos de delivery válidos (excluye cancelados)
  const deliveryOrders = useMemo(() => {
    return orders
      .filter((o) => {
        if (o.estado === "Cancelado" || o.estado === "Pago Rechazado") return false
        return isDeliveryOrder(o) || getOrderDeliveryFee(o) > 0
      })
      .sort((a, b) => {
        const timeA = getSafeTime(getOrderDateRaw(a))
        const timeB = getSafeTime(getOrderDateRaw(b))
        return timeA - timeB // orden cronológico ascendente para planillas
      })
  }, [orders])

  // Obtener iniciales y nombre del repartidor asignado a una orden
  const getOrderDriver = (order: ExtendedOrder) => {
    const iniciales = (
      order.repartidorIniciales ||
      order.repartidor?.iniciales ||
      ""
    ).trim().toUpperCase()

    const nombre = (
      order.repartidorNombre ||
      order.repartidor?.nombre ||
      ""
    ).trim()

    const id = order.repartidorId || order.repartidor?.id || ""

    return { iniciales, nombre, id }
  }

  // Lista unificada de repartidores ordenados descendentemente por cantidad de repartos
  const driversList = useMemo(() => {
    const map = new Map<string, { iniciales: string; nombre: string; id?: string; totalPedidos: number; totalMonto: number }>()

    // 1. Añadir los repartidores configurados en el sistema
    repartidoresConfig.forEach((c) => {
      const ini = c.iniciales.toUpperCase()
      map.set(ini, {
        iniciales: ini,
        nombre: c.nombre,
        id: c.id,
        totalPedidos: 0,
        totalMonto: 0,
      })
    })

    // 2. Mapear pedidos a sus repartidores
    deliveryOrders.forEach((o) => {
      const { iniciales, nombre, id } = getOrderDriver(o)
      const key = iniciales || "S/A"
      const fee = getOrderDeliveryFee(o)

      if (!map.has(key)) {
        map.set(key, {
          iniciales: key,
          nombre: nombre || (key === "S/A" ? "Sin Asignar" : `Repartidor ${key}`),
          id,
          totalPedidos: 0,
          totalMonto: 0,
        })
      }

      const item = map.get(key)!
      item.totalPedidos += 1
      item.totalMonto += fee
    })

    // Ordenar de forma descendente por total de repartos (o total monto)
    const list = Array.from(map.values()).sort((a, b) => {
      if (b.totalPedidos !== a.totalPedidos) {
        return b.totalPedidos - a.totalPedidos
      }
      return b.totalMonto - a.totalMonto
    })

    return list
  }, [repartidoresConfig, deliveryOrders])

  // Seleccionar automáticamente el primer repartidor al cargar si no hay ninguno seleccionado
  useEffect(() => {
    if (driversList.length > 0 && !selectedDriverInitials) {
      setSelectedDriverInitials(driversList[0].iniciales)
    }
  }, [driversList, selectedDriverInitials])

  // Repartidor seleccionado actualmente
  const currentDriver = useMemo(() => {
    return driversList.find((d) => d.iniciales === selectedDriverInitials) || driversList[0] || null
  }, [driversList, selectedDriverInitials])

  // Pedidos del repartidor seleccionado
  const driverOrders = useMemo(() => {
    if (!currentDriver) return []
    return deliveryOrders.filter((o) => {
      const { iniciales } = getOrderDriver(o)
      if (currentDriver.iniciales === "S/A") {
        return !iniciales || iniciales === "S/A"
      }
      return iniciales === currentDriver.iniciales
    })
  }, [deliveryOrders, currentDriver])

  // Liquidaciones previas de este repartidor
  const driverSettlements = useMemo(() => {
    if (!currentDriver) return []
    return settlements
      .filter((s) => s.repartidorIniciales === currentDriver.iniciales)
      .sort((a, b) => new Date(b.fechaPago).getTime() - new Date(a.fechaPago).getTime())
  }, [settlements, currentDriver])

  // IDs de pedidos ya pagados en liquidaciones previas
  const paidOrderIds = useMemo(() => {
    const set = new Set<string>()
    driverSettlements.forEach((s) => {
      s.pedidosIds?.forEach((id) => set.add(id))
    })
    return set
  }, [driverSettlements])

  // Separar pedidos pendientes de pago vs pedidos ya pagados
  const pendingOrders = useMemo(() => {
    return driverOrders.filter((o) => !paidOrderIds.has(o.documentId || o.id))
  }, [driverOrders, paidOrderIds])

  const totalPendiente = useMemo(() => {
    return pendingOrders.reduce((acc, o) => acc + getOrderDeliveryFee(o), 0)
  }, [pendingOrders])

  const totalHistorico = useMemo(() => {
    return driverOrders.reduce((acc, o) => acc + getOrderDeliveryFee(o), 0)
  }, [driverOrders])

  const totalYaPagado = useMemo(() => {
    return totalHistorico - totalPendiente
  }, [totalHistorico, totalPendiente])

  // Estado si este repartidor ya tiene al menos una liquidación pagada
  const tienePagosPrevios = driverSettlements.length > 0

  // Estado si la planilla actual no tiene nada pendiente (está pagada totalmente)
  const estaTotalmentePagado = pendingOrders.length === 0 && driverOrders.length > 0

  // Registrar pago total de los repartos acumulados hasta la fecha consultada
  const handlePagarTotal = async () => {
    if (!currentDriver || pendingOrders.length === 0) return

    setSavingPayment(true)
    try {
      const ahora = new Date()
      const fechaPagoTexto = ahora.toLocaleString("es-CL", {
        dateStyle: "medium",
        timeStyle: "short",
      })

      const newSettlement: DriverSettlement = {
        id: `liq_${currentDriver.iniciales}_${Date.now()}`,
        repartidorIniciales: currentDriver.iniciales,
        repartidorId: currentDriver.id,
        repartidorNombre: currentDriver.nombre,
        fechaPago: ahora.toISOString(),
        fechaPagoTexto,
        totalPagado: totalPendiente,
        pedidosIds: pendingOrders.map((o) => o.documentId || o.id),
        pedidosCount: pendingOrders.length,
        createdAt: ahora.toISOString(),
      }

      const ok = await saveDriverSettlement(newSettlement)

      if (ok) {
        setSettlements((prev) => [newSettlement, ...prev])
        toast({
          title: "¡Repartos Pagados!",
          description: `Se liquidaron ${pendingOrders.length} repartos de ${currentDriver.nombre} por un total de ${formatCurrency(totalPendiente)}.`,
        })
      } else {
        throw new Error("No se pudo guardar la liquidación")
      }
    } catch (err) {
      console.error("Error al registrar pago de repartos:", err)
      toast({
        title: "Error al registrar pago",
        description: "Ocurrió un error al guardar la liquidación. Intenta nuevamente.",
        variant: "destructive",
      })
    } finally {
      setSavingPayment(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] p-0 flex flex-col overflow-hidden bg-white dark:bg-gray-900 border dark:border-gray-800 shadow-2xl rounded-2xl">
        {/* Cabecera del Modal */}
        <DialogHeader className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/80 shrink-0">
          <DialogTitle className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
            <FileSpreadsheet className="w-5 h-5 text-pink-600 dark:text-pink-400" />
            <span>Planilla de Liquidación de Repartidores</span>
          </DialogTitle>
        </DialogHeader>

        {/* Cuerpo dividido en 2 verticalmente */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* LADO IZQUIERDO: Botones centrados en orden descendente con las iniciales de cada repartidor */}
          <aside className="w-full md:w-44 lg:w-48 bg-gray-100/70 dark:bg-gray-950/60 border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-800 p-3 overflow-y-auto shrink-0 flex md:flex-col items-center gap-3">
            <div className="w-full text-center pb-1 border-b border-gray-200 dark:border-gray-800 hidden md:block">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Repartidores
              </span>
            </div>

            {driversList.length === 0 ? (
              <div className="text-xs text-gray-400 text-center py-6">
                No hay repartidores registrados
              </div>
            ) : (
              driversList.map((driver) => {
                const isSelected = currentDriver?.iniciales === driver.iniciales
                const driverOrdersCount = deliveryOrders.filter((o) => {
                  const { iniciales } = getOrderDriver(o)
                  return driver.iniciales === "S/A" ? (!iniciales || iniciales === "S/A") : iniciales === driver.iniciales
                }).length

                return (
                  <button
                    key={driver.iniciales}
                    type="button"
                    onClick={() => setSelectedDriverInitials(driver.iniciales)}
                    className={`w-20 h-20 md:w-24 md:h-24 rounded-2xl flex items-center justify-center text-center transition-all duration-200 ease-out transform active:scale-90 cursor-pointer select-none relative overflow-hidden ${
                      isSelected
                        ? "bg-gradient-to-br from-pink-500 via-pink-600 to-pink-700 text-white shadow-xl shadow-pink-500/40 ring-2 ring-pink-300/80 dark:ring-pink-400/80 scale-105 border-t border-white/30"
                        : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:border-pink-400 dark:hover:border-pink-600 hover:scale-102 hover:shadow-md"
                    }`}
                    title={driver.nombre}
                  >
                    {/* Reflejo de luz y brillo satinado en el botón seleccionado */}
                    {isSelected && (
                      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-white/25 pointer-events-none rounded-2xl" />
                    )}

                    {/* Iniciales Grandes y Claras */}
                    <span className={`text-2xl md:text-3xl font-black tracking-widest font-mono relative z-10 ${
                      isSelected ? "text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]" : ""
                    }`}>
                      {driver.iniciales}
                    </span>
                  </button>
                )
              })
            )}
          </aside>

          {/* LADO DERECHO: Planilla con historial de repartos del repartidor seleccionado */}
          <main className="flex-1 p-4 md:p-6 overflow-y-auto flex flex-col gap-4 bg-white dark:bg-gray-900">
            {currentDriver ? (
              <>
                {/* Cabecera del Repartidor */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-pink-100 dark:bg-pink-950/60 border border-pink-300 dark:border-pink-800 text-pink-700 dark:text-pink-300 font-black text-xl flex items-center justify-center font-mono">
                      {currentDriver.iniciales}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900 dark:text-white">
                        {currentDriver.nombre}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {driverOrders.length} {driverOrders.length === 1 ? "reparto registrado" : "repartos registrados"} en total
                      </p>
                    </div>
                  </div>

                  {/* Resumen de montos */}
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">Total Histórico</div>
                      <div className="text-sm font-bold text-gray-800 dark:text-gray-200">
                        {formatCurrency(totalHistorico)}
                      </div>
                    </div>
                    <div className="border-l border-gray-200 dark:border-gray-700 pl-4">
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">Por Pagar</div>
                      <div className="text-base font-extrabold text-pink-600 dark:text-pink-400">
                        {formatCurrency(totalPendiente)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Planilla de Repartos (con marca de agua "REPARTOS PAGADOS" cuando corresponde) */}
                <div className="relative border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 shadow-xs flex-1 flex flex-col overflow-hidden">
                  {/* MARCA DE AGUA: Aparece desenfocada en el fondo cuando la planilla está pagada */}
                  {(estaTotalmentePagado || savingPayment) && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden">
                      <div 
                        className="transform -rotate-12 border-8 border-emerald-600/30 dark:border-emerald-400/30 rounded-3xl px-8 md:px-12 py-4 md:py-6"
                        style={{ filter: "blur(2.5px)" }}
                      >
                        <span className="text-4xl sm:text-6xl md:text-7xl font-black uppercase text-emerald-600/35 dark:text-emerald-400/35 tracking-widest text-center block">
                          REPARTOS PAGADOS
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Contenedor scrolleable de la tabla (en primer plano sobre la marca de agua) */}
                  <div className="p-4 flex-1 overflow-x-auto relative z-10">
                    <div className="min-w-[620px]">
                      {/* Título de la Planilla */}
                      <div className="border-b border-gray-200 dark:border-gray-700 pb-2 mb-3 flex items-center justify-between">
                        <div className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                          Detalle de Repartos Acumulados
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400">
                          {pendingOrders.length} {pendingOrders.length === 1 ? "pedido pendiente" : "pedidos pendientes"}
                        </div>
                      </div>

                      {driverOrders.length === 0 ? (
                        <div className="py-12 text-center text-gray-400 text-sm">
                          Este repartidor aún no tiene pedidos de delivery asignados.
                        </div>
                      ) : (
                        <>
                          {/* TABLA DE PEDIDOS */}
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500 dark:text-gray-400 font-semibold">
                                <th className="py-2 px-2">N° Pedido</th>
                                <th className="py-2 px-2">Fecha / Hora</th>
                                <th className="py-2 px-2">Cliente y Dirección</th>
                                <th className="py-2 px-2">Estado</th>
                                <th className="py-2 px-2 text-right">Valor Delivery</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                              {driverOrders.map((pedido) => {
                                const fee = getOrderDeliveryFee(pedido)
                                const isPaid = paidOrderIds.has(pedido.documentId || pedido.id)
                                const fechaRaw = getOrderDateRaw(pedido)
                                const fechaStr = fechaRaw 
                                  ? new Date(getSafeTime(fechaRaw)).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })
                                  : "Sin fecha"
                                
                                const dirTexto = pedido.direccion 
                                  ? `${pedido.direccion.calle || ""} ${pedido.direccion.numero || ""}${pedido.direccion.comuna ? `, ${pedido.direccion.comuna}` : ""}`.trim()
                                  : "Sin dirección"

                                return (
                                  <tr
                                    key={pedido.documentId || pedido.id}
                                    className={`hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors ${
                                      isPaid ? "opacity-75 bg-gray-50/40 dark:bg-gray-900/40" : ""
                                    }`}
                                  >
                                    <td className="py-2.5 px-2 font-bold font-mono text-gray-900 dark:text-white">
                                      #{pedido.orderNumber || pedido.id}
                                    </td>
                                    <td className="py-2.5 px-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                      {fechaStr}
                                    </td>
                                    <td className="py-2.5 px-2 max-w-[220px]">
                                      <div className="font-semibold text-gray-800 dark:text-gray-200 truncate">
                                        {pedido.cliente?.nombre || "Cliente"}
                                      </div>
                                      <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                                        {dirTexto}
                                      </div>
                                    </td>
                                    <td className="py-2.5 px-2">
                                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                        isPaid
                                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700"
                                          : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
                                      }`}>
                                        {isPaid ? "Liquidado" : pedido.estado}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-2 text-right font-extrabold text-gray-900 dark:text-white">
                                      {formatCurrency(fee)}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>

                          {/* Sumatoria Total de Deliverys */}
                          <div className="mt-4 pt-3 border-t-2 border-gray-300 dark:border-gray-700 flex justify-between items-center px-2">
                            <span className="text-xs uppercase tracking-wider font-extrabold text-gray-700 dark:text-gray-300">
                              Sumatoria Total de Deliverys:
                            </span>
                            <span className="text-lg font-black text-gray-900 dark:text-white font-mono">
                              {formatCurrency(totalHistorico)}
                            </span>
                          </div>

                          {/* LÍNEA DIVISORIA FINAL DE CIERRE DE PAGO */}
                          {driverSettlements.length > 0 && (
                            <div className="mt-6 space-y-3">
                              <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                Registro de Períodos y Liquidaciones Pagadas:
                              </div>
                              {driverSettlements.map((s, idx) => (
                                <div
                                  key={s.id || idx}
                                  className="border-t-2 border-dashed border-emerald-500/80 pt-3 pb-2 px-3 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-emerald-900 dark:text-emerald-200"
                                >
                                  <div className="flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                    <span className="font-extrabold">
                                      Período Pagado: {s.fechaPagoTexto || s.fechaPago}
                                    </span>
                                    <span className="text-[11px] opacity-80">
                                      ({s.pedidosCount} {s.pedidosCount === 1 ? "reparto" : "repartos"})
                                    </span>
                                  </div>
                                  <div className="font-black text-sm text-emerald-700 dark:text-emerald-300">
                                    Total Liquidado: {formatCurrency(s.totalPagado)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* PIE DE PLANILLA: Botón Pagar Total */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-3 relative z-20">
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {pendingOrders.length > 0 ? (
                        <span>
                          Pendiente de liquidar: <strong className="text-pink-600 dark:text-pink-400 font-extrabold">{formatCurrency(totalPendiente)}</strong> ({pendingOrders.length} {pendingOrders.length === 1 ? "pedido" : "pedidos"})
                        </span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          Todos los repartos acumulados hasta la fecha están pagados.
                        </span>
                      )}
                    </div>

                    <Button
                      type="button"
                      disabled={pendingOrders.length === 0 || savingPayment}
                      onClick={handlePagarTotal}
                      className={`font-bold px-6 py-2.5 text-sm rounded-xl shadow-md transition-all flex items-center gap-2 ${
                        pendingOrders.length > 0
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                          : "bg-gray-200 text-gray-400 dark:bg-gray-800 dark:text-gray-600 cursor-not-allowed"
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{savingPayment ? "Registrando..." : `Pagar total (${formatCurrency(totalPendiente)})`}</span>
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                Selecciona un repartidor para visualizar su planilla de repartos.
              </div>
            )}
          </main>
        </div>
      </DialogContent>
    </Dialog>
  )
}

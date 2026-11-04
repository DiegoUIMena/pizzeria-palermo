"use client"

import React, { useState, useEffect, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  CheckCircle2,
  Printer,
  FileSpreadsheet,
  ShieldCheck,
  Mail,
  AlertTriangle,
  Trash2,
  Send,
  Loader2,
  Undo2,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { httpsCallable } from "firebase/functions"
import { functions } from "@/lib/firebase"
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

const HIDDEN_DRIVERS_STORAGE_KEY = "palermo_hidden_planilla_drivers"

export default function RepartidoresPlanillaModal({
  open,
  onOpenChange,
  orders,
}: RepartidoresPlanillaModalProps) {
  const [repartidoresConfig, setRepartidoresConfig] = useState<DeliveryDriverContact[]>([])
  const [settlements, setSettlements] = useState<DriverSettlement[]>([])
  const [selectedDriverInitials, setSelectedDriverInitials] = useState<string>("")
  const [hiddenDriverInitials, setHiddenDriverInitials] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [savingPayment, setSavingPayment] = useState(false)

  // Estados para modal de envío por Email
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false)
  const [emailDestino, setEmailDestino] = useState("")
  const [emailNotas, setEmailNotas] = useState("")
  const [sendingEmail, setSendingEmail] = useState(false)

  // Cargar repartidores ocultados en localStorage al inicio
  useEffect(() => {
    try {
      const saved = localStorage.getItem(HIDDEN_DRIVERS_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          setHiddenDriverInitials(parsed)
        }
      }
    } catch (e) {
      console.error("Error cargando repartidores ocultos de localStorage:", e)
    }
  }, [])

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

  // Comprobar si un repartidor fue eliminado o está inactivo en la sección Zonas-delivery
  const isDriverInactive = (iniciales: string) => {
    if (!iniciales) return false
    const config = repartidoresConfig.find(
      (c) => c.iniciales.toUpperCase() === iniciales.toUpperCase()
    )
    if (!config) return true // Eliminado de la sección de Zonas-delivery
    if (config.activo === false) return true // Marcado como inactivo
    return false
  }

  // Lista unificada de repartidores excluyendo S/A y aquellos eliminados por el usuario de la planilla
  const driversList = useMemo(() => {
    const map = new Map<string, { iniciales: string; nombre: string; id?: string; totalPedidos: number; totalMonto: number }>()

    // 1. Añadir los repartidores configurados en el sistema (excluyendo cualquier posible S/A)
    repartidoresConfig.forEach((c) => {
      const ini = c.iniciales.toUpperCase().trim()
      if (!ini || ini === "S/A") return
      map.set(ini, {
        iniciales: ini,
        nombre: c.nombre,
        id: c.id,
        totalPedidos: 0,
        totalMonto: 0,
      })
    })

    // 2. Mapear pedidos a sus repartidores (omitiendo pedidos sin asignar o con S/A)
    deliveryOrders.forEach((o) => {
      const { iniciales, nombre, id } = getOrderDriver(o)
      if (!iniciales || iniciales === "S/A") return // Omitir Sin Asignar
      const key = iniciales
      const fee = getOrderDeliveryFee(o)

      if (!map.has(key)) {
        map.set(key, {
          iniciales: key,
          nombre: nombre || `Repartidor ${key}`,
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

    // Excluir repartidores que el usuario decidió eliminar de la planilla
    return list.filter((d) => d.iniciales !== "S/A" && !hiddenDriverInitials.includes(d.iniciales))
  }, [repartidoresConfig, deliveryOrders, hiddenDriverInitials])

  // Seleccionar automáticamente el primer repartidor al cargar o tras eliminar
  useEffect(() => {
    if (driversList.length > 0) {
      const exists = driversList.some((d) => d.iniciales === selectedDriverInitials)
      if (!exists || !selectedDriverInitials) {
        setSelectedDriverInitials(driversList[0].iniciales)
      }
    } else {
      setSelectedDriverInitials("")
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
    return driverOrders.filter((o) => !paidOrderIds.has(o.documentId || o.id || ""))
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

  // Estado si la planilla actual no tiene nada pendiente (está pagada totalmente)
  const estaTotalmentePagado = pendingOrders.length === 0 && driverOrders.length > 0

  // Eliminar repartidor de la planilla (registra en el historial de eliminación en orden cronológico)
  const handleEliminarDePlanilla = (iniciales: string) => {
    if (!iniciales) return
    const iniUpper = iniciales.toUpperCase()
    // Remover si ya existía para agregarlo al final como el último eliminado
    const filtered = hiddenDriverInitials.filter((ini) => ini !== iniUpper)
    const updated = [...filtered, iniUpper]
    setHiddenDriverInitials(updated)
    try {
      localStorage.setItem(HIDDEN_DRIVERS_STORAGE_KEY, JSON.stringify(updated))
    } catch (e) {
      console.error("Error guardando repartidores ocultos:", e)
    }
    toast({
      title: "Repartidor eliminado de la planilla",
      description: `Se eliminó al repartidor (${iniUpper}) de la planilla de liquidación para que no sume información.`,
    })
  }

  // Restaurar repartidores en orden inverso al de su eliminación (historial paso a paso)
  const handleRestaurarUltimoRepartidor = () => {
    if (hiddenDriverInitials.length === 0) return

    const updated = [...hiddenDriverInitials]
    const lastDeleted = updated.pop() // Extrae el último repartidor eliminado
    if (!lastDeleted) return

    setHiddenDriverInitials(updated)
    try {
      if (updated.length > 0) {
        localStorage.setItem(HIDDEN_DRIVERS_STORAGE_KEY, JSON.stringify(updated))
      } else {
        localStorage.removeItem(HIDDEN_DRIVERS_STORAGE_KEY)
      }
    } catch (e) {
      console.error("Error actualizando historial de repartidores ocultos:", e)
    }

    // Seleccionar automáticamente el repartidor que acaba de ser restaurado
    setSelectedDriverInitials(lastDeleted)

    toast({
      title: "Repartidor restaurado",
      description: `Se ha restaurado al repartidor (${lastDeleted}) a la planilla de liquidación.`,
    })
  }

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
          title: "¡Repartos Pagados Exitosamente!",
          description: `Se liquidaron ${pendingOrders.length} repartos de ${currentDriver.nombre} por un total de ${formatCurrency(totalPendiente)}. Puedes imprimir o enviar la planilla por email.`,
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

  // Imprimir planilla completa con pictograma de impresora
  const handleImprimirPlanilla = () => {
    if (!currentDriver || driverOrders.length === 0) return

    const printWindow = window.open("", "_blank", "width=850,height=900")
    if (!printWindow) {
      toast({
        title: "Ventana emergente bloqueada",
        description: "Por favor permite las ventanas emergentes en tu navegador para imprimir la planilla.",
        variant: "destructive",
      })
      return
    }

    const fechaEmision = new Date().toLocaleString("es-CL", {
      dateStyle: "medium",
      timeStyle: "short",
    })

    const filas = driverOrders
      .map((pedido) => {
        const fee = getOrderDeliveryFee(pedido)
        const isPaid = paidOrderIds.has(pedido.documentId || pedido.id || "")
        const fechaRaw = getOrderDateRaw(pedido)
        const fechaStr = fechaRaw
          ? new Date(getSafeTime(fechaRaw)).toLocaleString("es-CL", {
              dateStyle: "short",
              timeStyle: "short",
            })
          : "Sin fecha"
        const cliente = pedido.cliente?.nombre || "Cliente"
        const dir = pedido.direccion
          ? `${pedido.direccion.calle || ""} ${pedido.direccion.numero || ""}${pedido.direccion.comuna ? `, ${pedido.direccion.comuna}` : ""}`.trim()
          : "Sin dirección"

        return `
          <tr>
            <td style="padding: 7px 8px; border-bottom: 1px solid #e5e7eb; font-family: monospace; font-weight: bold; font-size: 11px;">#${pedido.orderNumber || pedido.id}</td>
            <td style="padding: 7px 8px; border-bottom: 1px solid #e5e7eb; white-space: nowrap; font-size: 11px; color: #4b5563;">${fechaStr}</td>
            <td style="padding: 7px 8px; border-bottom: 1px solid #e5e7eb; font-size: 11px;">
              <strong style="color: #111827;">${cliente}</strong><br>
              <span style="color: #6b7280; font-size: 10px;">${dir}</span>
            </td>
            <td style="padding: 7px 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">
              <span style="display: inline-block; padding: 2px 6px; font-size: 9px; font-weight: bold; border-radius: 4px; ${
                isPaid
                  ? "background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0;"
                  : "background: #fffbeb; color: #92400e; border: 1px solid #fde68a;"
              }">
                ${isPaid ? "PAGADO" : pedido.estado}
              </span>
            </td>
            <td style="padding: 7px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold; font-size: 11px; color: #111827;">
              ${formatCurrency(fee)}
            </td>
          </tr>
        `
      })
      .join("")

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Planilla de Liquidación - ${currentDriver.nombre} (${currentDriver.iniciales})</title>
        <style>
          @page {
            size: letter portrait;
            margin: 12mm 15mm;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            color: #111827;
            margin: 0;
            padding: 0;
            background: #ffffff;
            font-size: 12px;
          }
          .header-box {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 3px solid #ec4899;
            padding-bottom: 10px;
            margin-bottom: 14px;
          }
          .brand-title {
            font-size: 20px;
            font-weight: 900;
            color: #db2777;
            letter-spacing: -0.5px;
          }
          .sheet-title {
            font-size: 13px;
            font-weight: 800;
            color: #1f2937;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .driver-card {
            background-color: #fdf2f8;
            border: 1px solid #fbcfe8;
            border-radius: 8px;
            padding: 10px 14px;
            margin-bottom: 14px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .driver-badge {
            display: inline-block;
            background: #be185d;
            color: #ffffff;
            font-family: monospace;
            font-weight: 900;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 13px;
            margin-right: 8px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 14px;
          }
          th {
            background-color: #f3f4f6;
            color: #374151;
            font-weight: 800;
            font-size: 10px;
            text-transform: uppercase;
            padding: 8px;
            border-bottom: 2px solid #d1d5db;
            text-align: left;
          }
          .totals-section {
            float: right;
            width: 280px;
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 10px 14px;
            margin-bottom: 24px;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            padding: 3px 0;
            font-size: 12px;
          }
          .total-final {
            border-top: 2px solid #e5e7eb;
            margin-top: 6px;
            padding-top: 6px;
            font-size: 14px;
            font-weight: 900;
            color: #065f46;
          }
          .signatures {
            margin-top: 65px;
            display: flex;
            justify-content: space-around;
            clear: both;
          }
          .sig-line {
            width: 220px;
            border-top: 1px solid #4b5563;
            text-align: center;
            padding-top: 6px;
            font-size: 11px;
            font-weight: 700;
            color: #374151;
          }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="header-box">
          <div style="display: flex; align-items: center; gap: 16px;">
            <img 
              id="logo-img" 
              src="${typeof window !== "undefined" ? window.location.origin : ""}/iconos/logo.png" 
              alt="Palermo Pizzas" 
              style="height: 52px; width: auto; object-fit: contain; display: block;" 
            />
            <div>
              <div class="sheet-title">Planilla de Liquidación de Repartidores</div>
            </div>
          </div>
          <div style="text-align: right; font-size: 11px; color: #4b5563;">
            Fecha de Emisión: <strong>${fechaEmision}</strong>
          </div>
        </div>

        <div class="driver-card">
          <div>
            <span class="driver-badge">${currentDriver.iniciales}</span>
            <strong style="font-size: 14px; color: #111827;">${currentDriver.nombre}</strong>
            <div style="font-size: 11px; color: #6b7280; margin-top: 3px;">
              Repartos acumulados: <strong>${driverOrders.length}</strong> &bull; Repartos pagados: <strong>${paidOrderIds.size}</strong>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 10px; text-transform: uppercase; font-weight: bold; color: #6b7280;">Estado Actual</div>
            <div style="font-size: 13px; font-weight: 800; color: ${pendingOrders.length === 0 ? "#059669" : "#d97706"};">
              ${pendingOrders.length === 0 ? "✓ REPARTOS PAGADOS" : "EN LIQUIDACIÓN"}
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>N° Pedido</th>
              <th>Fecha / Hora</th>
              <th>Cliente y Dirección</th>
              <th style="text-align: center;">Estado</th>
              <th style="text-align: right;">Valor Delivery</th>
            </tr>
          </thead>
          <tbody>
            ${filas || '<tr><td colspan="5" style="text-align:center; padding: 20px; color: #9ca3af;">Sin pedidos</td></tr>'}
          </tbody>
        </table>

        <div class="totals-section">
          <div class="total-row">
            <span>Total Repartos:</span>
            <strong>${driverOrders.length}</strong>
          </div>
          <div class="total-row">
            <span>Monto ya Liquidado:</span>
            <strong>${formatCurrency(totalYaPagado)}</strong>
          </div>
          <div class="total-row">
            <span>Monto Pendiente:</span>
            <strong style="color: #db2777;">${formatCurrency(totalPendiente)}</strong>
          </div>
          <div class="total-row total-final">
            <span>TOTAL LIQUIDACIÓN:</span>
            <span>${formatCurrency(totalHistorico)}</span>
          </div>
        </div>

        <div class="signatures">
          <div>
            <div class="sig-line">Firma Administración / Cajero</div>
          </div>
          <div>
            <div class="sig-line">Firma y Conforme Repartidor</div>
          </div>
        </div>

        <script>
          window.onload = function() {
            var img = document.getElementById("logo-img");
            if (img && !img.complete) {
              img.onload = function() {
                setTimeout(function() {
                  window.print();
                }, 250);
              };
              img.onerror = function() {
                setTimeout(function() {
                  window.print();
                }, 250);
              };
            } else {
              setTimeout(function() {
                window.print();
              }, 300);
            }
          };
        </script>
      </body>
      </html>
    `

    printWindow.document.open()
    printWindow.document.write(htmlContent)
    printWindow.document.close()
  }

  // Enviar planilla por Email con el sistema existente de Firebase Functions + Nodemailer
  const handleSendEmail = async () => {
    if (!emailDestino.trim() || !emailDestino.includes("@")) {
      toast({
        title: "Correo electrónico inválido",
        description: "Por favor ingresa una dirección de correo válida para enviar la planilla.",
        variant: "destructive",
      })
      return
    }

    if (!currentDriver || driverOrders.length === 0) return

    setSendingEmail(true)
    try {
      const fechaEmision = new Date().toLocaleString("es-CL", {
        dateStyle: "medium",
        timeStyle: "short",
      })

      const pedidosPayload = driverOrders.map((pedido) => {
        const fee = getOrderDeliveryFee(pedido)
        const fechaRaw = getOrderDateRaw(pedido)
        const fechaStr = fechaRaw
          ? new Date(getSafeTime(fechaRaw)).toLocaleString("es-CL", {
              dateStyle: "short",
              timeStyle: "short",
            })
          : "Sin fecha"
        const dir = pedido.direccion
          ? `${pedido.direccion.calle || ""} ${pedido.direccion.numero || ""}${pedido.direccion.comuna ? `, ${pedido.direccion.comuna}` : ""}`.trim()
          : "Sin dirección"

        return {
          numeroPedido: pedido.orderNumber || pedido.id,
          fechaHora: fechaStr,
          cliente: pedido.cliente?.nombre || "Cliente",
          direccion: dir,
          montoDelivery: fee,
        }
      })

      const sendFn = httpsCallable(functions, "enviarLiquidacionRepartidorEmail")
      const res = await sendFn({
        emailDestino: emailDestino.trim(),
        settlementData: {
          repartidorNombre: currentDriver.nombre,
          repartidorIniciales: currentDriver.iniciales,
          fechaEmision,
          estadoLiquidacion:
            pendingOrders.length === 0 ? "Repartos Pagados / Liquidados" : "En Liquidación",
          totalPedidos: driverOrders.length,
          totalMonto: totalHistorico,
          pedidos: pedidosPayload,
          notas: emailNotas.trim(),
        },
      })

      const data = res.data as { success?: boolean }
      if (data?.success) {
        toast({
          title: "¡Planilla enviada con éxito!",
          description: `Se envió la planilla de liquidación de ${currentDriver.nombre} a ${emailDestino.trim()}.`,
        })
        setIsEmailModalOpen(false)
        setEmailNotas("")
      } else {
        throw new Error("No se pudo completar el envío del correo")
      }
    } catch (err: any) {
      console.error("Error al enviar email de liquidación:", err)
      toast({
        title: "Error al enviar email",
        description: err.message || "Ocurrió un error al enviar la planilla por correo electrónico.",
        variant: "destructive",
      })
    } finally {
      setSendingEmail(false)
    }
  }

  return (
    <>
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
            <aside className="w-full md:w-44 lg:w-48 bg-gray-100/70 dark:bg-gray-950/60 border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-800 p-3 shrink-0 flex flex-col justify-between overflow-hidden">
              <div className="w-full text-center pb-2 border-b border-gray-200 dark:border-gray-800 hidden md:block shrink-0">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Repartidores
                </span>
              </div>

              {/* Lista con scroll vertical de botones de repartidores */}
              <div className="flex-1 overflow-y-auto flex md:flex-col items-center gap-3 py-2 w-full">
                {driversList.length === 0 ? (
                  <div className="text-xs text-gray-400 text-center py-6">
                    {hiddenDriverInitials.length > 0
                      ? "Todos los repartidores han sido removidos de la planilla"
                      : "No hay repartidores registrados"}
                  </div>
                ) : (
                  driversList.map((driver) => {
                    const isSelected = currentDriver?.iniciales === driver.iniciales
                    const isInactive = isDriverInactive(driver.iniciales)

                    return (
                      <button
                        key={driver.iniciales}
                        type="button"
                        onClick={() => setSelectedDriverInitials(driver.iniciales)}
                        className={`w-20 h-20 md:w-24 md:h-24 rounded-2xl flex flex-col items-center justify-center text-center transition-all duration-200 ease-out transform active:scale-90 cursor-pointer select-none relative overflow-hidden shrink-0 ${
                          isSelected
                            ? "bg-gradient-to-br from-pink-500 via-pink-600 to-pink-700 text-white shadow-xl shadow-pink-500/40 ring-2 ring-pink-300/80 dark:ring-pink-400/80 scale-105 border-t border-white/30"
                            : isInactive
                            ? "bg-amber-50/70 dark:bg-amber-950/30 text-gray-700 dark:text-gray-300 border border-amber-300/80 dark:border-amber-800/80 hover:border-amber-400 hover:scale-102"
                            : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:border-pink-400 dark:hover:border-pink-600 hover:scale-102 hover:shadow-md"
                        }`}
                        title={`${driver.nombre}${isInactive ? " (Inactivo en el sistema)" : ""}`}
                      >
                        {/* Reflejo de luz y brillo satinado en el botón seleccionado */}
                        {isSelected && (
                          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-white/25 pointer-events-none rounded-2xl" />
                        )}

                        {/* Iniciales Grandes y Claras */}
                        <span
                          className={`text-2xl md:text-3xl font-black tracking-widest font-mono relative z-10 ${
                            isSelected ? "text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]" : ""
                          }`}
                        >
                          {driver.iniciales}
                        </span>
                      </button>
                    )
                  })
                )}
              </div>

              {/* Botón para restaurar repartidores eliminados ubicado al final de la ventana con línea superior */}
              {hiddenDriverInitials.length > 0 && (
                <div className="w-full pt-2.5 mt-auto border-t border-gray-200 dark:border-gray-800 flex items-center justify-center shrink-0">
                  <button
                    type="button"
                    onClick={handleRestaurarUltimoRepartidor}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-pink-600 hover:bg-gray-200/70 dark:text-gray-400 dark:hover:text-pink-400 dark:hover:bg-gray-800/80 transition-colors cursor-pointer"
                    title={`Restaurar último repartidor eliminado (${hiddenDriverInitials[hiddenDriverInitials.length - 1]})`}
                    aria-label="Restaurar último repartidor eliminado"
                  >
                    <Undo2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </aside>

            {/* LADO DERECHO: Planilla con historial de repartos del repartidor seleccionado */}
            <main className="flex-1 p-4 md:p-6 overflow-y-auto flex flex-col gap-4 bg-white dark:bg-gray-900">
              {currentDriver ? (
                <>
                  {/* ALERTA: Si el repartidor fue eliminado o está inactivo en la sección Zonas-delivery */}
                  {isDriverInactive(currentDriver.iniciales) && (
                    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl text-amber-900 dark:text-amber-200 shadow-xs">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                          Este repartidor ya no está activo en el sistema
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => handleEliminarDePlanilla(currentDriver.iniciales)}
                        className="w-8 h-8 shrink-0 bg-white dark:bg-gray-800 border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/60 rounded-lg flex items-center justify-center shadow-xs cursor-pointer"
                        title="Eliminar de la planilla"
                        aria-label="Eliminar de la planilla"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}

                  {/* Cabecera del Repartidor */}
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-pink-100 dark:bg-pink-950/60 border border-pink-300 dark:border-pink-800 text-pink-700 dark:text-pink-300 font-black text-xl flex items-center justify-center font-mono">
                        {currentDriver.iniciales}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-gray-900 dark:text-white">
                            {currentDriver.nombre}
                          </h3>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {driverOrders.length}{" "}
                          {driverOrders.length === 1 ? "reparto registrado" : "repartos registrados"} en total
                        </p>
                      </div>
                    </div>

                    {/* Resumen de montos */}
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                          Total Histórico
                        </div>
                        <div className="text-sm font-bold text-gray-800 dark:text-gray-200">
                          {formatCurrency(totalHistorico)}
                        </div>
                      </div>
                      <div className="border-l border-gray-200 dark:border-gray-700 pl-4">
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                          Por Pagar
                        </div>
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
                            {pendingOrders.length}{" "}
                            {pendingOrders.length === 1 ? "pedido pendiente" : "pedidos pendientes"}
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
                                  const isPaid = paidOrderIds.has(pedido.documentId || pedido.id || "")
                                  const fechaRaw = getOrderDateRaw(pedido)
                                  const fechaStr = fechaRaw
                                    ? new Date(getSafeTime(fechaRaw)).toLocaleString("es-CL", {
                                        dateStyle: "short",
                                        timeStyle: "short",
                                      })
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
                                        <span
                                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                            isPaid
                                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700"
                                              : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
                                          }`}
                                        >
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

                    {/* PIE DE PLANILLA: Botones de Acción (Imprimir, Email, Pagar Total) */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-700 flex flex-col md:flex-row items-center justify-between gap-3 relative z-20">
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {pendingOrders.length > 0 ? (
                          <span>
                            Pendiente de liquidar:{" "}
                            <strong className="text-pink-600 dark:text-pink-400 font-extrabold">
                              {formatCurrency(totalPendiente)}
                            </strong>{" "}
                            ({pendingOrders.length} {pendingOrders.length === 1 ? "pedido" : "pedidos"})
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4" />
                            Todos los repartos acumulados hasta la fecha están pagados.
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                        {/* Botón Imprimir con pictograma de impresora */}
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          disabled={driverOrders.length === 0}
                          onClick={handleImprimirPlanilla}
                          className="w-9 h-9 rounded-xl border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200 flex items-center justify-center shadow-xs cursor-pointer shrink-0"
                          title="Imprimir planilla"
                          aria-label="Imprimir planilla"
                        >
                          <Printer className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                        </Button>

                        {/* Botón Enviar por Email con pictograma de email */}
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          disabled={driverOrders.length === 0}
                          onClick={() => setIsEmailModalOpen(true)}
                          className="w-9 h-9 rounded-xl border-pink-300 dark:border-pink-800/80 hover:bg-pink-50 dark:hover:bg-pink-950/40 text-pink-600 dark:text-pink-400 flex items-center justify-center shadow-xs cursor-pointer shrink-0"
                          title="Enviar planilla por email"
                          aria-label="Enviar planilla por email"
                        >
                          <Mail className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                        </Button>

                        {/* Botón Pagar Total */}
                        <Button
                          type="button"
                          disabled={pendingOrders.length === 0 || savingPayment}
                          onClick={handlePagarTotal}
                          className={`font-bold px-5 py-2 text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center gap-2 ${
                            pendingOrders.length > 0
                              ? "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                              : "bg-gray-200 text-gray-400 dark:bg-gray-800 dark:text-gray-600 cursor-not-allowed"
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>
                            {savingPayment
                              ? "Registrando..."
                              : `Pagar total (${formatCurrency(totalPendiente)})`}
                          </span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                  {driversList.length === 0 && hiddenDriverInitials.length > 0
                    ? "Has removido a todos los repartidores de la planilla. Puedes restaurarlos con el botón inferior izquierdo."
                    : "Selecciona un repartidor para visualizar su planilla de repartos."}
                </div>
              )}
            </main>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Dialog para ingresar el email y enviar la planilla */}
      <Dialog open={isEmailModalOpen} onOpenChange={setIsEmailModalOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-gray-900 dark:text-white">
              <Mail className="w-5 h-5 text-pink-600 dark:text-pink-400" />
              <span>Enviar Planilla por Correo</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500 dark:text-gray-400">
              Ingresa el correo electrónico donde se enviará el detalle de los repartos y el total de la liquidación.
            </DialogDescription>
          </DialogHeader>

          {currentDriver && (
            <div className="space-y-4 py-2">
              {/* Tarjeta con resumen del repartidor a liquidar */}
              <div className="bg-pink-50 dark:bg-pink-950/30 border border-pink-200 dark:border-pink-900/60 rounded-xl p-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono font-black bg-pink-600 text-white px-2 py-0.5 rounded text-xs shadow-xs">
                    {currentDriver.iniciales}
                  </span>
                  <div>
                    <div className="font-bold text-gray-900 dark:text-white">
                      {currentDriver.nombre}
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400">
                      {driverOrders.length} {driverOrders.length === 1 ? "reparto" : "repartos"}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">
                    Total Planilla
                  </div>
                  <div className="text-pink-700 dark:text-pink-300 font-extrabold text-sm">
                    {formatCurrency(totalHistorico)}
                  </div>
                </div>
              </div>

              {/* Input de Email destino */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="input-email-destino"
                  className="text-xs font-semibold text-gray-700 dark:text-gray-300"
                >
                  Correo Electrónico Destinatario <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="input-email-destino"
                  type="email"
                  placeholder="ejemplo@correo.com"
                  value={emailDestino}
                  onChange={(e) => setEmailDestino(e.target.value)}
                  className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-sm"
                  disabled={sendingEmail}
                  autoFocus
                />
              </div>

              {/* Textarea de Observaciones opcionales */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="textarea-email-notas"
                  className="text-xs font-semibold text-gray-700 dark:text-gray-300"
                >
                  Observaciones o Mensaje Adicional (opcional)
                </Label>
                <Textarea
                  id="textarea-email-notas"
                  placeholder="Ej: Liquidación correspondiente al turno de hoy. Pagado mediante transferencia..."
                  value={emailNotas}
                  onChange={(e) => setEmailNotas(e.target.value)}
                  rows={3}
                  className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-xs resize-none"
                  disabled={sendingEmail}
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-row justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEmailModalOpen(false)}
              disabled={sendingEmail}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSendEmail}
              disabled={sendingEmail || !emailDestino.trim()}
              className="bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
            >
              {sendingEmail ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar Planilla</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

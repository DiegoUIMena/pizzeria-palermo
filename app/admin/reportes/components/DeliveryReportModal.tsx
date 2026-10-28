"use client"

import React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Printer, Truck } from "lucide-react"
import { ExtendedOrder, getOrderDeliveryFee, getSafeTime, isDeliveryOrder, getOrderDateRaw } from "./PagosReport"

interface DeliveryReportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orders: ExtendedOrder[]
  periodoLabel?: string
  periodoFilter?: string
  selectedDate?: string
  totalDelivery: number
  countDelivery: number
}

const formatCurrency = (value: number) => `$${Math.round(value).toLocaleString('es-CL')}`

export default function DeliveryReportModal({
  open,
  onOpenChange,
  orders,
  periodoLabel = "Día actual",
  periodoFilter = "dia",
  selectedDate,
  totalDelivery,
  countDelivery,
}: DeliveryReportModalProps) {
  const fechaTexto = new Date().toLocaleString("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
  })

  // Filtrar todos los pedidos válidos que correspondan a delivery
  const deliveryOrders = React.useMemo(() => {
    return [...orders]
      .filter((o) => isDeliveryOrder(o) || getOrderDeliveryFee(o) > 0)
      .sort((a, b) => {
        const numA = Number(a.orderNumber) || 0
        const numB = Number(b.orderNumber) || 0
        return numA - numB
      })
  }, [orders])

  // Helper para obtener iniciales y nombre del repartidor de la orden
  const getOrderDriver = (order: ExtendedOrder): { iniciales: string; nombre: string } => {
    const iniciales = (
      order.repartidorIniciales ||
      (order as any).repartidor?.iniciales ||
      ""
    ).trim().toUpperCase()

    const nombre = (
      order.repartidorNombre ||
      (order as any).repartidor?.nombre ||
      ""
    ).trim()

    return { iniciales, nombre }
  }

  // Desglose de totales agrupados por repartidor (para liquidación)
  const resumenPorRepartidor = React.useMemo(() => {
    const mapa: Record<string, { iniciales: string; nombre: string; count: number; total: number }> = {}

    deliveryOrders.forEach((o) => {
      const fee = getOrderDeliveryFee(o)
      const { iniciales, nombre } = getOrderDriver(o)
      const key = iniciales || "__SIN_ASIGNAR__"

      if (!mapa[key]) {
        mapa[key] = {
          iniciales: iniciales || "S/A",
          nombre: nombre || (iniciales ? `Repartidor ${iniciales}` : "Sin Asignar"),
          count: 0,
          total: 0,
        }
      }

      mapa[key].count += 1
      mapa[key].total += fee
    })

    return Object.values(mapa).sort((a, b) => {
      if (a.iniciales === "S/A") return 1
      if (b.iniciales === "S/A") return -1
      return b.total - a.total
    })
  }, [deliveryOrders])

  // Total acumulado calculado directamente desde las órdenes para máxima fidelidad
  const sumDelivery = React.useMemo(() => {
    return deliveryOrders.reduce((acc, o) => acc + getOrderDeliveryFee(o), 0)
  }, [deliveryOrders])

  const effectiveTotalDelivery = totalDelivery > 0 ? totalDelivery : sumDelivery

  // Fecha en que se realizaron los pedidos
  const fechaRealizados = React.useMemo(() => {
    if (periodoFilter === "fecha" && selectedDate) {
      const parts = selectedDate.split("-")
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`
      }
    }

    if (periodoFilter === "dia") {
      return new Date().toLocaleDateString("es-CL")
    }

    // Extraer fechas únicas reales de los pedidos de delivery
    const fechasSet = new Set<string>()
    deliveryOrders.forEach((o) => {
      const raw = getOrderDateRaw(o)
      const t = getSafeTime(raw)
      if (t > 0) {
        fechasSet.add(new Date(t).toLocaleDateString("es-CL"))
      }
    })

    const fechas = Array.from(fechasSet)
    if (fechas.length === 1) {
      return fechas[0]
    } else if (fechas.length > 1) {
      return `${fechas[0]} al ${fechas[fechas.length - 1]}`
    }

    return new Date().toLocaleDateString("es-CL")
  }, [deliveryOrders, periodoFilter, selectedDate])

  const confirmarImpresion = () => {
    const printContent = document.getElementById("reporte-delivery-imprimir")
    if (!printContent) return

    const iframe = document.createElement("iframe")
    iframe.style.position = "absolute"
    iframe.style.width = "0"
    iframe.style.height = "0"
    iframe.style.border = "0"
    document.body.appendChild(iframe)

    iframe.onload = () => {
      const printStyles = `
        <style>
          @media print {
            @page { size: 58mm auto; margin: 0; }
            body { margin: 0; padding: 4mm 3mm; font-size: 11pt; }
            .delivery-ticket-container { width: 58mm; max-width: 58mm; margin: 0 auto; }
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          body { font-family: Arial, sans-serif; color: #000; margin: 0; padding: 8px; }
          .delivery-ticket-container { font-size: 11px; line-height: 1.25; width: 100%; max-width: 58mm; margin: 0 auto; }
          .ticket-header { text-align: center; }
          .ticket-logo { width: 30mm; height: auto; margin: 3px auto 4px; display: block; }
          .ticket-title {
            font-family: 'Arial Narrow', 'Roboto Condensed', sans-serif;
            font-size: 15px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: -0.2px;
            margin: 2px 0;
          }
          .ticket-pill {
            display: inline-block;
            background: #fff;
            color: #000;
            border: 1.5px solid #000;
            border-radius: 999px;
            padding: 2px 10px;
            font-weight: 700;
            font-size: 11px;
            letter-spacing: 0.5px;
            margin: 3px 0 2px;
          }
          .ticket-meta { font-size: 9px; color: #333; margin: 1px 0; }
          .ticket-divider { border-top: 1px dashed #666; margin: 6px 0; }
          .ticket-table { width: 100%; border-collapse: collapse; margin-top: 4px; }
          .ticket-table th {
            font-size: 9.5px;
            font-weight: 700;
            border-bottom: 1px solid #000;
            padding: 2px 1px;
          }
          .ticket-table td {
            font-size: 10px;
            padding: 3px 1px;
            border-bottom: 1px dashed #ccc;
          }
          .col-num { width: 22%; font-weight: 700; text-align: left; }
          .col-rep { width: 16%; font-weight: 800; text-align: center; }
          .col-cli { width: 38%; max-width: 22mm; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; }
          .col-val { width: 24%; text-align: right; font-weight: 700; }
          .rep-tag {
            display: inline-block;
            padding: 1px 3px;
            font-weight: 800;
            font-size: 9px;
            background: #eee;
            border: 1px solid #999;
            border-radius: 2px;
            color: #000;
          }
          .ticket-totals { text-align: center; margin-top: 6px; }
          .ticket-total-strong { font-size: 14.5px; font-weight: 800; border-top: 1.5px solid #000; padding-top: 5px; margin-top: 4px; text-transform: uppercase; }
          .ticket-date-footer { font-size: 10.5px; font-weight: 700; color: #111; margin-top: 3px; }
          .ticket-total-row { font-size: 10px; margin: 2px 0; color: #444; }
          .ticket-section-title {
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            text-align: center;
            margin: 6px 0 3px;
            letter-spacing: 0.3px;
            border-bottom: 1px solid #000;
            padding-bottom: 2px;
          }
          .ticket-summary-table { width: 100%; border-collapse: collapse; margin-top: 2px; }
          .ticket-summary-table td { font-size: 9.5px; padding: 2px 1px; border-bottom: 1px dotted #ccc; }
          .summary-rep-col { text-align: left; font-weight: 700; width: 48%; }
          .summary-count-col { text-align: center; color: #333; width: 24%; }
          .summary-val-col { text-align: right; font-weight: 800; width: 28%; }
        </style>
      `

      const content = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Reporte de Delivery - Palermo Pizzas</title>
            ${printStyles}
          </head>
          <body>
            ${printContent.innerHTML}
          </body>
        </html>
      `

      iframe.contentWindow?.document.open()
      iframe.contentWindow?.document.write(content)
      iframe.contentWindow?.document.close()

      setTimeout(() => {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()

        setTimeout(() => {
          document.body.removeChild(iframe)
          onOpenChange(false)
        }, 100)
      }, 200)
    }

    iframe.src = "about:blank"
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <Truck className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            Planilla de Reparto / Total Delivery
          </DialogTitle>
        </DialogHeader>

        {/* Contenedor del Ticket Térmico Imprimible */}
        <div className="bg-white text-black p-4 rounded-lg border shadow-sm my-2 flex justify-center">
          <div id="reporte-delivery-imprimir" className="w-full max-w-[340px]">
            <style>{`
              .ticket-header { text-align: center; }
              .ticket-logo { width: 110px; height: auto; margin: 0 auto 6px; display: block; }
              .ticket-title { font-size: 16px; font-weight: 800; text-align: center; margin: 2px 0; }
              .ticket-pill {
                display: inline-block; background: #fff; color: #000;
                border: 1.5px solid #000; border-radius: 999px;
                padding: 3px 12px; font-weight: 700; font-size: 11px;
                letter-spacing: 0.5px; margin: 4px 0;
              }
              .ticket-meta { font-size: 10px; color: #444; margin: 2px 0; text-align: center; }
              .ticket-divider { border-top: 1px dashed #666; margin: 8px 0; }
              .ticket-table { width: 100%; border-collapse: collapse; margin-top: 4px; }
              .ticket-table th { font-size: 10px; font-weight: 700; border-bottom: 1px solid #000; padding: 3px 2px; }
              .ticket-table td { font-size: 10.5px; padding: 4px 2px; border-bottom: 1px dashed #ddd; }
              .col-num { width: 22%; font-weight: 700; text-align: left; }
              .col-rep { width: 16%; font-weight: 800; text-align: center; }
              .col-cli { width: 38%; max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; }
              .col-val { width: 24%; text-align: right; font-weight: 700; }
              .rep-tag {
                display: inline-block;
                padding: 1px 4px;
                font-weight: 800;
                font-size: 9.5px;
                background: #f3f4f6;
                border: 1px solid #d1d5db;
                border-radius: 3px;
                color: #111;
              }
              .ticket-totals { text-align: center; margin-top: 8px; }
              .ticket-total-strong { font-size: 15px; font-weight: 800; border-top: 1.5px solid #000; padding-top: 6px; margin-top: 4px; text-transform: uppercase; }
              .ticket-date-footer { font-size: 11px; font-weight: 700; color: #111; margin-top: 4px; }
              .ticket-total-row { font-size: 10.5px; margin: 2px 0; color: #555; }
              .ticket-section-title {
                font-size: 10.5px;
                font-weight: 800;
                text-transform: uppercase;
                text-align: center;
                margin: 8px 0 4px;
                letter-spacing: 0.4px;
                border-bottom: 1px solid #000;
                padding-bottom: 2px;
              }
              .ticket-summary-table { width: 100%; border-collapse: collapse; margin-top: 3px; }
              .ticket-summary-table td { font-size: 10px; padding: 3px 2px; border-bottom: 1px dashed #ddd; }
              .summary-rep-col { text-align: left; font-weight: 700; width: 48%; }
              .summary-count-col { text-align: center; color: #444; width: 24%; }
              .summary-val-col { text-align: right; font-weight: 800; width: 28%; }
            `}</style>

            <div className="ticket-header">
              <img src="/iconos/logo_negro.png" alt="Palermo Pizzas" className="ticket-logo" />
              <div className="ticket-title">PALERMO PIZZAS</div>
              <div className="ticket-pill">PLANILLA DE REPARTIDORES</div>
              <div className="ticket-meta">Período: {periodoLabel}</div>
              <div className="ticket-meta">Fecha emisión: {fechaTexto}</div>
            </div>

            <div className="ticket-divider"></div>

            {deliveryOrders.length > 0 ? (
              <>
                <table className="ticket-table">
                  <thead>
                    <tr>
                      <th className="col-num">N° Pedido</th>
                      <th className="col-rep">Rep.</th>
                      <th className="col-cli">Cliente</th>
                      <th className="col-val">Delivery</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveryOrders.map((order, idx) => {
                      const orderNum = String(order.orderNumber || order.id || "").replace("#", "").trim()
                      const rawNombre = order.cliente?.nombre
                      const nombreCliente = (
                        rawNombre &&
                        rawNombre !== "Usuario anónimo" &&
                        rawNombre !== "No especificado" &&
                        rawNombre !== "No informado"
                      )
                        ? String(rawNombre).toUpperCase().trim()
                        : "CLIENTE"
                      const fee = getOrderDeliveryFee(order)
                      const { iniciales, nombre } = getOrderDriver(order)

                      return (
                        <tr key={order.id || idx}>
                          <td className="col-num">#{orderNum}</td>
                          <td className="col-rep">
                            {iniciales ? (
                              <span className="rep-tag" title={nombre || undefined}>
                                {iniciales}
                              </span>
                            ) : (
                              <span style={{ color: "#9ca3af" }}>-</span>
                            )}
                          </td>
                          <td className="col-cli" title={nombreCliente}>
                            {nombreCliente}
                          </td>
                          <td className="col-val">{formatCurrency(fee)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: "1.5px solid #000" }}>
                      <td colSpan={3} style={{ padding: "5px 2px", fontWeight: 800, fontSize: "11px", textAlign: "left" }}>
                        TOTAL DELIVERY
                      </td>
                      <td style={{ padding: "5px 2px", fontWeight: 800, fontSize: "11.5px", textAlign: "right" }}>
                        {formatCurrency(effectiveTotalDelivery)}
                      </td>
                    </tr>
                  </tfoot>
                </table>

                {/* Resumen de liquidación por repartidor */}
                {resumenPorRepartidor.length > 0 && (
                  <>
                    <div className="ticket-section-title">RESUMEN POR REPARTIDOR</div>
                    <table className="ticket-summary-table">
                      <tbody>
                        {resumenPorRepartidor.map((r, i) => (
                          <tr key={i}>
                            <td className="summary-rep-col">
                              <strong>[{r.iniciales}]</strong> {r.nombre && r.nombre !== r.iniciales ? r.nombre : ""}
                            </td>
                            <td className="summary-count-col">
                              {r.count} {r.count === 1 ? "viaje" : "viajes"}
                            </td>
                            <td className="summary-val-col">
                              {formatCurrency(r.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}

                <div className="ticket-divider"></div>

                <div className="ticket-totals">
                  <div className="ticket-total-strong">
                    TOTAL DELIVERY: {formatCurrency(effectiveTotalDelivery)}
                  </div>
                  <div className="ticket-date-footer">
                    Fecha en que se realizaron: <strong>{fechaRealizados}</strong>
                  </div>
                  <div className="ticket-total-row" style={{ marginTop: "3px" }}>
                    Cantidad de pedidos con delivery: <strong>{deliveryOrders.length}</strong>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-6 text-center text-xs text-gray-500">
                No hay pedidos con costo de delivery registrados en este período.
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-center gap-3 mt-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Cerrar
          </Button>
          <Button
            type="button"
            onClick={confirmarImpresion}
            disabled={deliveryOrders.length === 0}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold flex items-center gap-2 text-xs"
          >
            <Printer className="w-4 h-4" />
            Imprimir Reporte Delivery
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

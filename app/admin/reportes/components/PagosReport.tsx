"use client"

import { useState, useMemo } from "react"
import { Order } from "@/lib/orders"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CreditCard, Banknote, Building, Receipt, RefreshCcw, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getFunctions, httpsCallable } from "firebase/functions"
import { db } from "@/lib/firebase"
import { toast } from "@/hooks/use-toast"

interface PagosReportProps {
  orders: Order[]
}

// Extender el tipo Order localmente para evitar errores de TypeScript en VSCode
// con las propiedades de Webpay, fechas y estados de pago que no están en la interfaz base
export type ExtendedOrder = Omit<Order, 'paymentStatus'> & {
  paymentStatus?: "pending" | "paid" | "failed" | "refunded" | string;
  webpay?: {
    token?: string;
    status?: string;
    authorizationCode?: string;
    responseCode?: number;
    amount?: number;
    cardDetail?: { card_number?: string };
    transactionDate?: string;
  };
  timestamps?: { created?: any; updated?: any };
  fecha?: any;
  createdAt?: any;
  fechaCreacion?: any;
};

const getSafeTime = (fechaRaw: any): number => {
  if (!fechaRaw) return 0;
  if (typeof fechaRaw === 'number') return fechaRaw;
  if (typeof fechaRaw.toDate === 'function') return fechaRaw.toDate().getTime();
  if (typeof fechaRaw.seconds === 'number') return fechaRaw.seconds * 1000;
  if (typeof fechaRaw._seconds === 'number') return fechaRaw._seconds * 1000;
  
  if (typeof fechaRaw === 'string') {
    // Intentar parsear formato chileno DD/MM/YYYY o DD-MM-YYYY
    const chileMatch = fechaRaw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (chileMatch) {
      const day = parseInt(chileMatch[1], 10);
      const month = parseInt(chileMatch[2], 10) - 1;
      const year = parseInt(chileMatch[3], 10);
      
      const timeMatch = fechaRaw.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
      let hours = 0, minutes = 0, seconds = 0;
      if (timeMatch) {
        hours = parseInt(timeMatch[1], 10);
        minutes = parseInt(timeMatch[2], 10);
        if (timeMatch[3]) seconds = parseInt(timeMatch[3], 10);
      }
      
      const d = new Date(year, month, day, hours, minutes, seconds);
      if (!isNaN(d.getTime())) return d.getTime();
    }
  }

  const d = new Date(fechaRaw);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

export default function PagosReport({ orders }: PagosReportProps) {
  const [metodoFilter, setMetodoFilter] = useState<string>("todos")
  const [refunding, setRefunding] = useState<string | null>(null)

  // Calcular métricas
  const { totalEfectivo, totalWebpay, totalTransferencia, txWebpay } = useMemo(() => {
    const extOrders = orders as ExtendedOrder[];
    let tEfectivo = 0
    let tWebpay = 0
    let tTransferencia = 0
    const txWp: any[] = []

    extOrders.forEach(order => {
      // Ignorar pedidos cancelados para los totales
      if (order.estado !== "Cancelado") {
        if (order.metodoPago === "Efectivo") tEfectivo += order.total
        if (order.metodoPago === "Webpay Plus") tWebpay += order.total
        if (order.metodoPago === "Transferencia") tTransferencia += order.total
      }

      // Recolectar datos de Webpay, incluso si están cancelados para ver el estado de la tx
      if (order.metodoPago === "Webpay Plus") {
        txWp.push({
          id: order.id,
          orderNumber: order.orderNumber,
          fecha: order.fecha || order.fechaCreacion || order.createdAt || order.timestamps?.created,
          total: order.total,
          estadoPedido: order.estado,
          webpayToken: order.webpay?.token || "-",
          webpayStatus: order.webpay?.status || "pending",
          webpayAuthCode: order.webpay?.authorizationCode || "-",
          webpayResponseCode: order.webpay?.responseCode,
          webpayAmount: order.webpay?.amount || 0,
          webpayCard: order.webpay?.cardDetail?.card_number || "-",
          webpayDate: order.webpay?.transactionDate || "-",
          paymentStatus: order.paymentStatus || "pending"
        })
      }
    })

    return { 
      totalEfectivo: tEfectivo, 
      totalWebpay: tWebpay, 
      totalTransferencia: tTransferencia,
      txWebpay: txWp.sort((a, b) => {
        const timeA = getSafeTime(a.fecha);
        const timeB = getSafeTime(b.fecha);
        return timeB - timeA;
      })
    }
  }, [orders])

  // Filtrar para la tabla
  const txFiltered = useMemo(() => {
    const extOrders = orders as ExtendedOrder[];
    if (metodoFilter === "todos") return extOrders
    return extOrders.filter(o => o.metodoPago === metodoFilter)
  }, [orders, metodoFilter])

  // Helper para mostrar la fecha de manera segura
  const formatOrderDate = (order: ExtendedOrder) => {
    try {
      const fechaRaw = order.fecha || order.fechaCreacion || order.createdAt || order.timestamps?.created
      if (!fechaRaw) return "Sin fecha"
      
      const time = getSafeTime(fechaRaw);
      if (time === 0) return "Fecha inválida"
      
      return new Date(time).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })
    } catch (e) {
      return "Error"
    }
  }

  const handleRefund = async (orderId?: string) => {
    if (!orderId) return;
    if (!window.confirm("¿Estás seguro de que quieres reembolsar este pedido? Esta acción no se puede deshacer.")) {
      return;
    }
    
    setRefunding(orderId);
    try {
      const functions = getFunctions(db.app);
      const refundOrderCall = httpsCallable(functions, 'refundOrder');
      await refundOrderCall({ orderId });
      
      toast({
        title: "Reembolso exitoso",
        description: "El pedido ha sido reembolsado correctamente.",
      });
    } catch (error: any) {
      console.error("Error al reembolsar:", error);
      toast({
        title: "Error al reembolsar",
        description: error.message || "Ocurrió un error inesperado.",
        variant: "destructive"
      });
    } finally {
      setRefunding(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* KPIs de Pagos */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white dark:bg-gray-800 border dark:border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium dark:text-gray-200">Total Efectivo</CardTitle>
            <Banknote className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold dark:text-white">${totalEfectivo.toLocaleString()}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-white dark:bg-gray-800 border dark:border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium dark:text-gray-200">Total Webpay Plus</CardTitle>
            <CreditCard className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold dark:text-white">${totalWebpay.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-800 border dark:border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium dark:text-gray-200">Total Transferencia</CardTitle>
            <Building className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold dark:text-white">${totalTransferencia.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-800 border dark:border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium dark:text-gray-200">Tx Webpay (Totales)</CardTitle>
            <Receipt className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold dark:text-white">{txWebpay.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de Transacciones */}
      <Card className="bg-white dark:bg-gray-800 border dark:border-gray-700">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="dark:text-gray-200">Registro de Transacciones</CardTitle>
          <Select value={metodoFilter} onValueChange={setMetodoFilter}>
            <SelectTrigger className="w-[180px] bg-white dark:bg-gray-800 dark:border-gray-700">
              <SelectValue placeholder="Método de pago" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los métodos</SelectItem>
              <SelectItem value="Webpay Plus">Webpay Plus</SelectItem>
              <SelectItem value="Efectivo">Efectivo</SelectItem>
              <SelectItem value="Transferencia">Transferencia</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border dark:border-gray-700 overflow-hidden">
            <Table>
              <TableHeader className="bg-gray-50 dark:bg-gray-800/50">
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Estado Pago</TableHead>
                  <TableHead>Total</TableHead>
                  {metodoFilter === "Webpay Plus" && (
                    <>
                      <TableHead>Estado WP</TableHead>
                      <TableHead>Auth Code</TableHead>
                      <TableHead>Tarjeta</TableHead>
                      <TableHead className="text-center">Acciones</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {txFiltered.length > 0 ? (
                  txFiltered.map((order) => {
                    const isPaid = order.paymentStatus === "paid" || (order.metodoPago === "Efectivo" && order.estado === "Entregado");
                    const isCancelledPayment = order.metodoPago === "Efectivo" && order.estado === "Cancelado";
                    return (
                      <TableRow key={order.id} className="dark:border-gray-700">
                        <TableCell className="font-medium">
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
                            <span>#{order.orderNumber}</span>
                            <Badge 
                              variant="outline" 
                              className={
                                order.paymentStatus === "refunded" ? "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 text-[10px] font-normal px-1.5 py-0" :
                                order.estado === "Entregado" ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] font-normal px-1.5 py-0" :
                                order.estado === "Cancelado" ? "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 text-[10px] font-normal px-1.5 py-0" :
                                "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 text-[10px] font-normal px-1.5 py-0"
                              }
                            >
                              {order.paymentStatus === "refunded" ? "Reembolsado" : order.estado}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>{formatOrderDate(order)}</TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1">
                            {order.metodoPago === "Webpay Plus" ? <CreditCard className="w-4 h-4 text-blue-500" /> : 
                             order.metodoPago === "Efectivo" ? <Banknote className="w-4 h-4 text-emerald-500" /> : 
                             <Building className="w-4 h-4 text-purple-500" />}
                            {order.metodoPago}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={
                              isPaid ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200" :
                              isCancelledPayment ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200" :
                              order.paymentStatus === "refunded" ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200" :
                              order.paymentStatus === "failed" ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200" :
                              "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200"
                            }
                          >
                            {isPaid ? "Pagado" : 
                             isCancelledPayment ? "Cancelado" : 
                             order.paymentStatus === "refunded" ? "Reembolsado" : 
                             order.paymentStatus === "failed" ? "Fallido" : 
                             "Pendiente"}
                          </Badge>
                        </TableCell>
                        <TableCell>${order.total.toLocaleString()}</TableCell>
                        {metodoFilter === "Webpay Plus" && (
                          <>
                            <TableCell>
                              <Badge variant="outline" className={
                                order.webpay?.status === "approved" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" :
                                order.webpay?.status === "rejected" ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" :
                                "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                              }>
                                {order.webpay?.status === "approved" ? "Aprobado" : order.webpay?.status === "rejected" ? "Rechazado" : "Pendiente"}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs text-gray-500">{order.webpay?.authorizationCode || "-"}</TableCell>
                            <TableCell className="font-mono text-xs">{order.webpay?.cardDetail?.card_number ? `**** ${order.webpay?.cardDetail?.card_number}` : "-"}</TableCell>
                            <TableCell className="text-center">
                              {order.paymentStatus === "paid" && order.webpay?.token && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRefund(order.id)}
                                  disabled={refunding === order.id}
                                  className="h-7 text-xs px-2"
                                >
                                  {refunding === order.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCcw className="w-3 h-3 mr-1" />}
                                  Reembolsar
                                </Button>
                              )}
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={metodoFilter === "Webpay Plus" ? 9 : 5} className="h-24 text-center">
                      No hay transacciones registradas.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
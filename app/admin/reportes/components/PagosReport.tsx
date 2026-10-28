"use client"

import { useState, useMemo } from "react"
import { Order } from "@/lib/orders"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CreditCard, Banknote, Building, Receipt, RefreshCcw, Loader2, Globe, Store, Calendar, Printer, DollarSign, Truck, ClipboardList } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getFunctions, httpsCallable } from "firebase/functions"
import { db } from "@/lib/firebase"
import { toast } from "@/hooks/use-toast"
import ComandaModal from "@/app/admin/components/ComandaModal"
import DeliveryReportModal from "./DeliveryReportModal"
import RepartidoresPlanillaModal from "./RepartidoresPlanillaModal"

interface PagosReportProps {
  orders: Order[]
}

// Extender el tipo Order localmente para evitar errores de TypeScript en VSCode
// con las propiedades de Webpay, fechas y estados de pago que no están en la interfaz base
export type ExtendedOrder = Omit<Order, 'paymentStatus'> & {
  paymentStatus?: "pending" | "paid" | "failed" | "refunded" | string;
  source?: string;
  orderChannel?: string;
  valorDelivery?: number;
  deliveryFee?: number;
  delivery?: number;
  priceCalculation?: {
    deliveryFee?: number;
    subtotal?: number;
    total?: number;
  };
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
  repartidorId?: string;
  repartidorNombre?: string;
  repartidorIniciales?: string;
  repartidor?: {
    id?: string;
    nombre?: string;
    iniciales?: string;
    telefono?: string;
  };
};

// Helper para obtener el timestamp raw más canónico de una orden
export const getOrderDateRaw = (order: any): any => {
  if (!order) return null;
  return order.timestamps?.created || order.createdAt || order.fechaCreacion || order.fecha || null;
};

// Clasificar si un pedido corresponde a entrega a domicilio (delivery)
export const isDeliveryOrder = (order: any): boolean => {
  if (!order) return false;
  const tipo = String(order.tipoEntrega || "").toLowerCase().trim();
  if (tipo === "delivery" || tipo.includes("delivery") || tipo.includes("envio") || tipo.includes("envío") || tipo.includes("domicilio")) {
    return true;
  }
  if (order.isDelivery === true) return true;
  if (order.direccion && (order.direccion.calle || order.direccion.address)) return true;
  const feeCandidate = Number(
    order.valorDelivery ??
    order.deliveryFee ??
    order.delivery ??
    order.priceCalculation?.deliveryFee ??
    order.costoEnvio ??
    order.shippingFee ??
    order.deliveryCost ??
    0
  );
  if (!isNaN(feeCandidate) && feeCandidate > 0) return true;
  return false;
};

// Obtener el valor del delivery discriminado en la comanda/pedido de forma exhaustiva y segura
export const getOrderDeliveryFee = (order: any): number => {
  if (!order) return 0;

  // 1. Buscar en todas las propiedades posibles donde se almacena el monto de delivery
  const candidates = [
    order.valorDelivery,
    order.deliveryFee,
    order.delivery,
    order.priceCalculation?.deliveryFee,
    order.costoEnvio,
    order.envio,
    order.shippingFee,
    order.deliveryCost,
  ];

  for (const c of candidates) {
    if (c !== undefined && c !== null && c !== '') {
      const num = Number(c);
      if (!isNaN(num) && num > 0) {
        return Math.round(num);
      }
    }
  }

  // 2. Si el pedido es explícitamente Delivery y tiene subtotal y total, calcular la diferencia si es coherente
  if (isDeliveryOrder(order)) {
    const total = Number(order.total) || 0;
    const subtotal = Number(order.subtotal ?? order.priceCalculation?.subtotal) || 0;
    const discount = Number(order.discountAmount ?? order.voucherDiscount ?? order.priceCalculation?.discountAmount) || 0;
    if (subtotal > 0 && total > subtotal - discount) {
      const diff = total - (subtotal - discount);
      if (diff > 0 && diff < total) {
        return Math.round(diff);
      }
    }
  }

  return 0;
};

// Obtener timestamp numérico confiable de cualquier formato de fecha sin desfases de zona horaria
export const getSafeTime = (fechaRaw: any): number => {
  if (!fechaRaw) return 0;
  if (typeof fechaRaw === 'number') return fechaRaw;
  if (typeof fechaRaw.toDate === 'function') {
    try {
      const d = fechaRaw.toDate();
      return d instanceof Date && !isNaN(d.getTime()) ? d.getTime() : 0;
    } catch {
      return 0;
    }
  }
  if (typeof fechaRaw.seconds === 'number') return fechaRaw.seconds * 1000;
  if (typeof fechaRaw._seconds === 'number') return fechaRaw._seconds * 1000;
  
  if (typeof fechaRaw === 'string') {
    const str = fechaRaw.trim();
    if (!str) return 0;

    // A. Formato ISO estándar completo (ej. 2026-10-25T17:50:00.000Z o con offset)
    if (/^\d{4}-\d{2}-\d{2}T/.test(str)) {
      const d = new Date(str);
      if (!isNaN(d.getTime())) return d.getTime();
    }

    // B. Formato de solo fecha YYYY-MM-DD (interpretar como fecha LOCAL para evitar desfase UTC-3)
    const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (ymdMatch) {
      const year = parseInt(ymdMatch[1], 10);
      const month = parseInt(ymdMatch[2], 10) - 1;
      const day = parseInt(ymdMatch[3], 10);
      const timeMatch = str.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
      let hours = 0, minutes = 0, seconds = 0;
      if (timeMatch) {
        hours = parseInt(timeMatch[1], 10);
        minutes = parseInt(timeMatch[2], 10);
        if (timeMatch[3]) seconds = parseInt(timeMatch[3], 10);
        if (/p\.?\s*m\.?/i.test(str) && hours < 12) hours += 12;
        if (/a\.?\s*m\.?/i.test(str) && hours === 12) hours = 0;
      }
      const d = new Date(year, month, day, hours, minutes, seconds);
      if (!isNaN(d.getTime())) return d.getTime();
    }

    // C. Formato chileno DD/MM/YYYY o DD-MM-YYYY
    const chileMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (chileMatch) {
      const day = parseInt(chileMatch[1], 10);
      const month = parseInt(chileMatch[2], 10) - 1;
      const year = parseInt(chileMatch[3], 10);
      const timeMatch = str.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
      let hours = 0, minutes = 0, seconds = 0;
      if (timeMatch) {
        hours = parseInt(timeMatch[1], 10);
        minutes = parseInt(timeMatch[2], 10);
        if (timeMatch[3]) seconds = parseInt(timeMatch[3], 10);
        if (/p\.?\s*m\.?/i.test(str) && hours < 12) hours += 12;
        if (/a\.?\s*m\.?/i.test(str) && hours === 12) hours = 0;
      }
      const d = new Date(year, month, day, hours, minutes, seconds);
      if (!isNaN(d.getTime())) return d.getTime();
    }

    const fallback = new Date(str);
    if (!isNaN(fallback.getTime())) return fallback.getTime();
  }

  const d = new Date(fechaRaw);
  return isNaN(d.getTime()) ? 0 : d.getTime();
};

// Clasificar si el pedido proviene del panel interno de ventas presenciales (POS)
export const isOrderPresencial = (order: ExtendedOrder): boolean => {
  const o = order as any;
  if (o.source === "IN_PERSON") return true;
  if (o.orderChannel === "POS") return true;
  if (o.cliente?.email === "caja-pos@pizzeriapalermo.cl") return true;
  if (typeof o.cliente?.nombre === "string" && o.cliente.nombre.toLowerCase().includes("presencial")) return true;
  if (typeof o.notas === "string" && /POS\s*-\s*Venta\s+Presencial/i.test(o.notas)) return true;
  return false;
};

// Clasificar si el pedido proviene del frontend web público
export const isOrderWeb = (order: ExtendedOrder): boolean => {
  return !isOrderPresencial(order);
};

// Categorizar métodos de pago de forma flexible
export type MetodoCategoria = "efectivo" | "transferencia" | "tarjeta" | "otro";

export const getMetodoCategoria = (metodoRaw?: string): MetodoCategoria => {
  if (!metodoRaw) return "otro";
  const m = metodoRaw.toLowerCase().trim();
  if (m.includes("efectivo") || m.includes("cash")) return "efectivo";
  if (m.includes("transferencia") || m.includes("khipu")) return "transferencia";
  if (
    m.includes("webpay") ||
    m.includes("tarjeta") ||
    m.includes("debito") ||
    m.includes("débito") ||
    m.includes("credito") ||
    m.includes("crédito") ||
    m.includes("transbank")
  ) {
    return "tarjeta";
  }
  return "otro";
};

// Formato YYYY-MM-DD para inicializar fecha local
const getTodayDateStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Validar si una orden es una venta real (excluye cancelados, rechazados y fallidos)
const isValidSale = (order: ExtendedOrder): boolean => {
  if (order.estado === "Cancelado" || order.estado === "Pago Rechazado") return false;
  if (order.paymentStatus === "failed" || order.paymentStatus === "refunded" || order.paymentStatus === "cancelled") return false;
  if (order.webpay?.status === "rejected") return false;
  return true;
};

// Filtrar si una orden cae en el período indicado
const isOrderInPeriod = (order: ExtendedOrder, periodo: string, now: Date, customDate?: string): boolean => {
  if (periodo === "todos") return true;
  const fechaRaw = getOrderDateRaw(order);
  const time = getSafeTime(fechaRaw);
  if (time === 0) return false;

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDate = now.getDate();

  if (periodo === "dia") {
    const startOfDay = new Date(currentYear, currentMonth, currentDate, 0, 0, 0, 0).getTime();
    const endOfDay = new Date(currentYear, currentMonth, currentDate, 23, 59, 59, 999).getTime();
    return time >= startOfDay && time <= endOfDay;
  }

  if (periodo === "fecha") {
    if (!customDate) return false;
    const parts = customDate.split("-").map(Number);
    if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return false;
    const [year, month, day] = parts;
    const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
    const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
    return time >= startOfDay && time <= endOfDay;
  }

  if (periodo === "semana") {
    // Últimos 7 días inclusive
    const startOfWeek = new Date(currentYear, currentMonth, currentDate - 6, 0, 0, 0, 0).getTime();
    const endOfWeek = new Date(currentYear, currentMonth, currentDate, 23, 59, 59, 999).getTime();
    return time >= startOfWeek && time <= endOfWeek;
  }

  if (periodo === "mes") {
    const startOfMonth = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0).getTime();
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999).getTime();
    return time >= startOfMonth && time <= endOfMonth;
  }

  if (periodo === "ano") {
    const startOfYear = new Date(currentYear, 0, 1, 0, 0, 0, 0).getTime();
    const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59, 999).getTime();
    return time >= startOfYear && time <= endOfYear;
  }

  return true;
};

const getPeriodoLabel = (p: string, customDate?: string) => {
  switch (p) {
    case 'dia': return 'Día de hoy';
    case 'fecha': {
      if (!customDate) return 'Día seleccionado';
      const parts = customDate.split('-');
      if (parts.length === 3) {
        return `Día: ${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return `Día: ${customDate}`;
    }
    case 'semana': return 'Últimos 7 días';
    case 'mes': return 'Mes en curso';
    case 'ano': return 'Año en curso';
    case 'todos': return 'Histórico completo';
    default: return p;
  }
};

export default function PagosReport({ orders }: PagosReportProps) {
  // Filtros: Por defecto día actual, fecha de hoy y todos los métodos
  const [periodoFilter, setPeriodoFilter] = useState<string>("dia")
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateStr())
  const [metodoFilter, setMetodoFilter] = useState<string>("todos")
  const [refunding, setRefunding] = useState<string | null>(null)
  const [comandaModalOpen, setComandaModalOpen] = useState(false)
  const [pedidoParaComanda, setPedidoParaComanda] = useState<ExtendedOrder | null>(null)
  const [deliveryReportModalOpen, setDeliveryReportModalOpen] = useState(false)
  const [repartidoresPlanillaModalOpen, setRepartidoresPlanillaModalOpen] = useState(false)

  const handleAbrirComanda = (order: ExtendedOrder) => {
    setPedidoParaComanda(order)
    setComandaModalOpen(true)
  }

  // 1. Calcular métricas para los 5 contenedores
  const metrics = useMemo(() => {
    const extOrders = orders as ExtendedOrder[];
    const now = new Date();

    // Filtrar pedidos correspondientes al período seleccionado
    const ordersInPeriod = extOrders.filter(o => isOrderInPeriod(o, periodoFilter, now, selectedDate));

    let tEfectivo = 0;
    let tTransferencia = 0;
    let tTarjetas = 0;
    let tVentasNetas = 0;
    let tDelivery = 0;

    let countEfectivo = 0;
    let countTransferencia = 0;
    let countTarjetas = 0;
    let countVentasNetas = 0;
    let countDelivery = 0;

    const validOrdersInPeriod: ExtendedOrder[] = [];

    ordersInPeriod.forEach(order => {
      if (!isValidSale(order)) return;
      validOrdersInPeriod.push(order);

      const cat = getMetodoCategoria(order.metodoPago);
      const orderTotal = Number(order.total) || 0;
      const orderDelivery = getOrderDeliveryFee(order);
      const orderVentaNeta = Math.max(0, orderTotal - orderDelivery);

      // Métricas por categoría de método de pago (reflejan siempre el total de su categoría en el período)
      if (cat === "efectivo") {
        tEfectivo += orderTotal;
        countEfectivo++;
      } else if (cat === "transferencia") {
        tTransferencia += orderTotal;
        countTransferencia++;
      } else if (cat === "tarjeta") {
        tTarjetas += orderTotal;
        countTarjetas++;
      }

      // Si metodoFilter === "todos", suman todos los métodos del período.
      // Si hay un método específico seleccionado (ej. "efectivo"), se filtran por ese método.
      const matchMetodo = metodoFilter === "todos" || cat === metodoFilter;
      if (matchMetodo) {
        if (orderDelivery > 0 || isDeliveryOrder(order)) {
          tDelivery += orderDelivery;
          countDelivery++;
        }
        tVentasNetas += orderVentaNeta;
        countVentasNetas++;
      }
    });

    return {
      totalEfectivo: tEfectivo,
      totalTransferencia: tTransferencia,
      totalTarjetas: tTarjetas,
      totalVentasNetas: tVentasNetas,
      totalDelivery: tDelivery,
      countEfectivo,
      countTransferencia,
      countTarjetas,
      countVentasNetas,
      countDelivery,
      ordersInPeriod,
      validOrdersInPeriod
    };
  }, [orders, periodoFilter, selectedDate, metodoFilter]);

  // 2. Filtrar transacciones para la tabla
  const txFiltered = useMemo(() => {
    const extOrders = orders as ExtendedOrder[];
    const now = new Date();

    return extOrders
      .filter(order => {
        // Filtro por período
        if (!isOrderInPeriod(order, periodoFilter, now, selectedDate)) return false;

        // Filtro por método de pago
        if (metodoFilter !== "todos") {
          const cat = getMetodoCategoria(order.metodoPago);
          if (cat !== metodoFilter) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = getSafeTime(getOrderDateRaw(a));
        const timeB = getSafeTime(getOrderDateRaw(b));
        return timeB - timeA;
      });
  }, [orders, periodoFilter, selectedDate, metodoFilter]);

  // Helper para mostrar la fecha de manera segura
  const formatOrderDate = (order: ExtendedOrder) => {
    try {
      const fechaRaw = getOrderDateRaw(order);
      if (!fechaRaw) return "Sin fecha";
      
      const time = getSafeTime(fechaRaw);
      if (time === 0) return "Fecha inválida";
      
      return new Date(time).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
    } catch (e) {
      return "Error";
    }
  };

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
  };

  // Fecha formateada con nombre del día en formato: nombre día (número día) / (número mes) / (número año)
  const displayHeaderDate = useMemo(() => {
    const now = new Date();

    const formatFullDay = (d: Date): string => {
      const rawWeekday = d.toLocaleDateString("es-CL", { weekday: "long" });
      const weekday = rawWeekday.charAt(0).toUpperCase() + rawWeekday.slice(1);
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${weekday} ${day} / ${month} / ${year}`;
    };

    if (periodoFilter === "fecha" && selectedDate) {
      const parts = selectedDate.split("-").map(Number);
      if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
        const d = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
        return formatFullDay(d);
      }
    }

    if (periodoFilter === "dia") {
      return formatFullDay(now);
    }

    if (periodoFilter === "semana") {
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 12, 0, 0);
      return `${formatFullDay(startOfWeek)} al ${formatFullDay(now)}`;
    }

    if (periodoFilter === "mes") {
      const mesNombre = now.toLocaleDateString("es-CL", { month: "long" });
      const capMes = mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1);
      return `${capMes} ${now.getFullYear()}`;
    }

    if (periodoFilter === "ano") {
      return `Año ${now.getFullYear()}`;
    }

    if (periodoFilter === "todos") {
      return "Histórico Completo";
    }

    return formatFullDay(now);
  }, [periodoFilter, selectedDate]);

  return (
    <div className="space-y-6">
      {/* Encabezado contextual del período */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b dark:border-gray-800 pb-3">
        <div>
          <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Resumen de Ventas y Delivery
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Valores totales calculados a partir de ventas válidas según los filtros seleccionados
          </p>
        </div>

        <div className="text-left sm:text-right">
          <div className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            {displayHeaderDate}
          </div>
          <p className="text-xs font-medium text-pink-600 dark:text-pink-400 mt-0.5">
            {getPeriodoLabel(periodoFilter, selectedDate)}
          </p>
        </div>
      </div>

      {/* 5 Contenedores de Totales solicitados */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* 1. Total Efectivo */}
        <Card className="bg-white dark:bg-gray-800 border dark:border-gray-700 shadow-sm hover:shadow transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Efectivo</CardTitle>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg">
              <Banknote className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              ${metrics.totalEfectivo.toLocaleString('es-CL')}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {metrics.countEfectivo} {metrics.countEfectivo === 1 ? 'pedido' : 'pedidos'}
            </p>
          </CardContent>
        </Card>

        {/* 2. Total Transferencias */}
        <Card className="bg-white dark:bg-gray-800 border dark:border-gray-700 shadow-sm hover:shadow transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Transferencias</CardTitle>
            <div className="p-2 bg-purple-50 dark:bg-purple-950/40 rounded-lg">
              <Building className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              ${metrics.totalTransferencia.toLocaleString('es-CL')}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {metrics.countTransferencia} {metrics.countTransferencia === 1 ? 'pedido' : 'pedidos'}
            </p>
          </CardContent>
        </Card>

        {/* 3. Total Tarjetas */}
        <Card className="bg-white dark:bg-gray-800 border dark:border-gray-700 shadow-sm hover:shadow transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Tarjetas</CardTitle>
            <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-lg">
              <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              ${metrics.totalTarjetas.toLocaleString('es-CL')}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {metrics.countTarjetas} {metrics.countTarjetas === 1 ? 'pedido' : 'pedidos'}
            </p>
          </CardContent>
        </Card>

        {/* 4. TOTAL (anteriormente Total Web) */}
        <Card className="bg-white dark:bg-gray-800 border dark:border-gray-700 shadow-sm hover:shadow transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-300">TOTAL</CardTitle>
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg">
              <DollarSign className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              ${metrics.totalVentasNetas.toLocaleString('es-CL')}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center justify-between">
              <span>{metrics.countVentasNetas} {metrics.countVentasNetas === 1 ? 'pedido' : 'pedidos'}</span>
              {metodoFilter !== "todos" ? (
                <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-1.5 py-0.5 rounded capitalize">
                  {metodoFilter}
                </span>
              ) : (
                <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded">
                  Sin delivery
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 5. Total Delivery (anteriormente Total Presencial) */}
        <Card className="bg-white dark:bg-gray-800 border dark:border-gray-700 shadow-sm hover:shadow transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Delivery</CardTitle>
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
              <div className="p-2 bg-amber-50 dark:bg-amber-950/40 rounded-lg">
                <Truck className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              ${metrics.totalDelivery.toLocaleString('es-CL')}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center justify-between">
              <span>{metrics.countDelivery} {metrics.countDelivery === 1 ? 'pedido' : 'pedidos'} con delivery</span>
              {metodoFilter !== "todos" ? (
                <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded capitalize">
                  {metodoFilter}
                </span>
              ) : (
                <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded">
                  Repartidores
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de Transacciones con Filtros */}
      <Card className="bg-white dark:bg-gray-800 border dark:border-gray-700 shadow-sm">
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b dark:border-gray-700/60">
          <div>
            <CardTitle className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Receipt className="w-5 h-5 text-pink-600 dark:text-pink-400" />
              Registro de Transacciones
            </CardTitle>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Listado detallado de transacciones ({txFiltered.length} {txFiltered.length === 1 ? 'resultado' : 'resultados'})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Filtro Período: día, día específico, semana, mes, año, todos */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Período:</span>
                <Select value={periodoFilter} onValueChange={(val) => {
                  setPeriodoFilter(val);
                  if (val === "fecha" && !selectedDate) {
                    setSelectedDate(getTodayDateStr());
                  }
                }}>
                  <SelectTrigger className="w-[160px] bg-white dark:bg-gray-800 dark:border-gray-700 h-9 text-xs">
                    <Calendar className="w-3.5 h-3.5 mr-1.5 text-gray-500" />
                    <SelectValue placeholder="Período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dia">Día (Hoy)</SelectItem>
                    <SelectItem value="fecha">Día específico...</SelectItem>
                    <SelectItem value="semana">Semana (7 días)</SelectItem>
                    <SelectItem value="mes">Mes (Este mes)</SelectItem>
                    <SelectItem value="ano">Año (Este año)</SelectItem>
                    <SelectItem value="todos">Todos los períodos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Selector de fecha del calendario si se elige "Día específico" */}
              {periodoFilter === "fecha" && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="h-9 px-2.5 py-1 text-xs rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent cursor-pointer font-medium"
                    title="Seleccionar día en el calendario"
                  />
                </div>
              )}
            </div>

            {/* Filtro Método de Pago: efectivo, transferencia, tarjeta, todos */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Método:</span>
              <Select value={metodoFilter} onValueChange={setMetodoFilter}>
                <SelectTrigger className="w-[155px] bg-white dark:bg-gray-800 dark:border-gray-700 h-9 text-xs">
                  <SelectValue placeholder="Método de pago" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los métodos</SelectItem>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="tarjeta">Tarjeta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <div className="rounded-md border dark:border-gray-700 overflow-hidden">
            <Table>
              <TableHeader className="bg-gray-50 dark:bg-gray-800/50">
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Estado Pago</TableHead>
                  <TableHead>Total</TableHead>
                  {metodoFilter === "tarjeta" && (
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
                    const cat = getMetodoCategoria(order.metodoPago);
                    const presencial = isOrderPresencial(order);
                    const isOrderCancelled = order.estado === "Cancelado" || order.estado === "Pago Rechazado" || order.paymentStatus === "cancelled";
                    const isPaid = !isOrderCancelled && (order.paymentStatus === "paid" || (cat === "efectivo" && order.estado === "Entregado"));

                    return (
                      <TableRow key={order.id} className="dark:border-gray-700">
                        {/* Pedido */}
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
                              <span>#{order.orderNumber}</span>
                              <Badge 
                                variant="outline" 
                                className={
                                  order.paymentStatus === "refunded" ? "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 text-[10px] font-normal px-1.5 py-0" :
                                  order.estado === "Entregado" ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] font-normal px-1.5 py-0" :
                                  order.estado === "Cancelado" || order.estado === "Pago Rechazado" ? "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 text-[10px] font-normal px-1.5 py-0" :
                                  "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 text-[10px] font-normal px-1.5 py-0"
                                }
                              >
                                {order.paymentStatus === "refunded" ? "Reembolsado" : order.estado}
                              </Badge>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleAbrirComanda(order)}
                              title="Ver comanda / Imprimir"
                              className="h-7 w-7 text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white p-0 hover:bg-gray-100 dark:hover:bg-gray-800 shrink-0"
                            >
                              <Printer className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>

                        {/* Fecha */}
                        <TableCell className="text-xs text-gray-600 dark:text-gray-300">
                          {formatOrderDate(order)}
                        </TableCell>

                        {/* Canal (Web vs Presencial) */}
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={
                              presencial
                                ? "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 text-[11px] font-medium px-2 py-0.5"
                                : "bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 text-[11px] font-medium px-2 py-0.5"
                            }
                          >
                            {presencial ? (
                              <span className="flex items-center gap-1">
                                <Store className="w-3 h-3" /> Presencial
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <Globe className="w-3 h-3" /> Web
                              </span>
                            )}
                          </Badge>
                        </TableCell>

                        {/* Método */}
                        <TableCell>
                          <span className="flex items-center gap-1.5 text-xs font-medium">
                            {cat === "tarjeta" ? (
                              <CreditCard className="w-4 h-4 text-blue-500 shrink-0" />
                            ) : cat === "efectivo" ? (
                              <Banknote className="w-4 h-4 text-emerald-500 shrink-0" />
                            ) : cat === "transferencia" ? (
                              <Building className="w-4 h-4 text-purple-500 shrink-0" />
                            ) : (
                              <CreditCard className="w-4 h-4 text-gray-500 shrink-0" />
                            )}
                            <span>{order.metodoPago || "Sin método"}</span>
                          </span>
                        </TableCell>

                        {/* Estado Pago */}
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={
                              isOrderCancelled ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200" :
                              order.paymentStatus === "refunded" ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200" :
                              isPaid ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200" :
                              order.paymentStatus === "failed" ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200" :
                              "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200"
                            }
                          >
                            {isOrderCancelled ? "Cancelado" : 
                             order.paymentStatus === "refunded" ? "Reembolsado" : 
                             isPaid ? "Pagado" : 
                             order.paymentStatus === "failed" ? "Fallido" : 
                             "Pendiente"}
                          </Badge>
                        </TableCell>

                        {/* Total */}
                        <TableCell className="font-semibold text-gray-900 dark:text-white">
                          <div>${Number(order.total || 0).toLocaleString('es-CL')}</div>
                          {(() => {
                            const dFee = getOrderDeliveryFee(order);
                            if (dFee > 0) {
                              return (
                                <div className="text-[10px] text-amber-600 dark:text-amber-400 font-normal">
                                  Delivery: ${dFee.toLocaleString('es-CL')}
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </TableCell>

                        {/* Columnas extras si se filtra por tarjeta */}
                        {metodoFilter === "tarjeta" && (
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
                            <TableCell className="font-mono text-xs text-gray-500">
                              {order.webpay?.authorizationCode || "-"}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {order.webpay?.cardDetail?.card_number ? `**** ${order.webpay?.cardDetail?.card_number}` : "-"}
                            </TableCell>
                            <TableCell className="text-center">
                              {!isOrderPresencial(order) && order.paymentStatus === "paid" && order.webpay?.token && (
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
                    <TableCell colSpan={metodoFilter === "tarjeta" ? 10 : 6} className="h-24 text-center text-gray-500 dark:text-gray-400">
                      No hay transacciones registradas para los filtros seleccionados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Comanda para Reimpresión */}
      <ComandaModal
        open={comandaModalOpen}
        onOpenChange={setComandaModalOpen}
        pedido={pedidoParaComanda}
      />

      {/* Modal de Planilla/Reporte de Delivery para Impresión */}
      <DeliveryReportModal
        open={deliveryReportModalOpen}
        onOpenChange={setDeliveryReportModalOpen}
        orders={metrics.validOrdersInPeriod}
        periodoLabel={getPeriodoLabel(periodoFilter, selectedDate)}
        periodoFilter={periodoFilter}
        selectedDate={selectedDate}
        totalDelivery={metrics.totalDelivery}
        countDelivery={metrics.countDelivery}
      />

      {/* Modal de Planilla y Liquidación de Repartidores */}
      <RepartidoresPlanillaModal
        open={repartidoresPlanillaModalOpen}
        onOpenChange={setRepartidoresPlanillaModalOpen}
        orders={orders as ExtendedOrder[]}
      />
    </div>
  )
}
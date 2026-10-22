"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import {
  Clock,
  Package,
  Truck,
  CheckCircle,
  Search,
  Filter,
  MapPin,
  Phone,
  DollarSign,
  Calendar,
  Printer,
  CheckCircle2
} from "lucide-react"
import { useFormattedAdminOrders } from "../../../hooks/useAdminOrders"
import { useAlarms } from "../context/AlarmsContext"
import { db } from "@/lib/firebase"
import { doc, updateDoc } from "firebase/firestore"
import { getFunctions, httpsCallable } from "firebase/functions"
import { useToast } from "../../../hooks/use-toast"
import { getActiveDeliveryPhone } from "../../../lib/delivery-driver-config"

interface Pedido {
  id: string
  documentId: string
  cliente: { nombre: string; telefono: string; email: string }
  direccion?: { 
    calle: string; 
    numero: string; 
    comuna: string; 
    referencia?: string;
    lat?: number;
    lng?: number;
  }
  discountCode?: string
  discountAmount?: number
  voucherCode?: string
  voucherDiscount?: number
  items: Array<{ 
    nombre: string; 
    cantidad: number; 
    precio: number;
    size?: string;
    ingredients?: string[];
    premiumIngredients?: string[];
    selectedMenuPizza?: string | null;
    sauces?: string[];
    drinks?: string[];
    extras?: string[];
    comments?: string;
    pizzaType?: string;
    pizza1?: string;
    pizza2?: string;
    half1?: {
      baseType: 'menu' | 'custom';
      variety: string | null;
      simpleIngredients: string[];
      premiumIngredients: string[];
    };
    half2?: {
      baseType: 'menu' | 'custom';
      variety: string | null;
      simpleIngredients: string[];
      premiumIngredients: string[];
    };
    sinOregano?: boolean;
    sinQueso?: boolean;
    sinSalsaTomate?: boolean;
  }>
  total: number
  subtotal?: number
  estado: "Pago Pendiente" | "Pago Rechazado" | "Pendiente" | "En preparación" | "En camino" | "Pedido Listo" | "Entregado" | "Cancelado"
  tipoEntrega: "Delivery" | "Retiro"
  metodoPago: string
  fechaCreacion: string
  tiempoEstimado?: string
  tiempoEstimadoMinutos?: number
  tiempoEstimadoInicio?: string
  tiempoEstimadoFin?: string
  notas?: string
  valorDelivery?: number
  requiereVuelto?: boolean
  montoVuelto?: number
  paymentDetails?: {
    cashAmount?: number
    change?: number
  }
  paymentStatus?: "paid" | "pending" | "refunded" | "failed" | null
  webpay?: any
}

const formatCurrency = (value: number) => `$${Math.round(value).toLocaleString('es-CL')}`

function getPedidoMontos(pedido: Pedido | null | undefined) {
  const totalGuardado = Number(pedido?.total || 0)
  const valorDelivery = Math.max(0, Number(pedido?.valorDelivery || 0))
    
  let discountAmount = Number(pedido?.discountAmount || 0)
  const voucherDiscount = Number(pedido?.voucherDiscount || 0)

  const subtotalGuardado = Number(pedido?.subtotal || 0)
  
  // Cálculo implícito si el backend eliminó los campos de descuento pero guardó subtotal y total
  if (discountAmount === 0 && voucherDiscount === 0 && subtotalGuardado > 0) {
    const implicitDiscount = subtotalGuardado + valorDelivery - totalGuardado;
    if (implicitDiscount > 0) {
      discountAmount = implicitDiscount;
    }
  }

  const totalDescuentos = discountAmount + voucherDiscount

  const subtotal = subtotalGuardado > 0
    ? subtotalGuardado
    : Math.max(0, totalGuardado - valorDelivery + totalDescuentos)

  return {
    subtotal,
    valorDelivery,
    descuentos: totalDescuentos,
    discountCode: pedido?.discountCode,
    discountAmount,
    voucherCode: pedido?.voucherCode,
    voucherDiscount,
    totalConDelivery: totalGuardado,
  }
}

// Helper para extraer únicamente notas especiales legítimas (excluyendo marcas de sistema como POS - Venta Presencial)
export function getSpecialOrderNote(notas?: string): string {
  if (!notas || typeof notas !== 'string') return ''

  let cleaned = notas
    .replace(/\[POS\s*-\s*Venta\s+Presencial\]/gi, '')
    .replace(/POS\s*-\s*Venta\s+Presencial/gi, '')
    .trim()

  cleaned = cleaned
    .replace(/^\|\s*/, '')
    .replace(/\s*\|$/, '')
    .replace(/\s*\|\s*\|+/g, ' | ')
    .trim()

  return cleaned
}

// Claves para almacenamiento en localStorage (mismas que usa GlobalOrderMonitor)
const TIEMPOS_STORAGE_KEY = 'admin_pedidos_tiempos'
const CUENTAS_STORAGE_KEY = 'admin_pedidos_cuentas'
const ULTIMO_UPDATE_KEY = 'admin_pedidos_ultimo_update'

export default function AdminPedidos() {
  const [filtroEstado, setFiltroEstado] = useState("activos")
  const [busqueda, setBusqueda] = useState("")
  const [tiemposEstimados, setTiemposEstimados] = useState<Record<string, number>>({})
  const [cuentasRegresivas, setCuentasRegresivas] = useState<Record<string, number>>({})
  const [pedidosNuevosSinAtender, setPedidosNuevosSinAtender] = useState<Set<string>>(new Set())
  const [pedidosConPocoTiempo, setPedidosConPocoTiempo] = useState<Set<string>>(new Set())
  
  // Estado para el modal de impresión
  const [modalImpresionAbierto, setModalImpresionAbierto] = useState(false)
  const [pedidoAImprimir, setPedidoAImprimir] = useState<Pedido | null>(null)

  // Estado para tracking de botones en proceso (aunque con optimistic update no es necesario)
  const [botonesEnProceso, setBotonesEnProceso] = useState<Set<string>>(new Set())

  // Referencias para tracking
  const pedidosNotificadosRef = useRef<Set<string>>(new Set());

  const { pedidos, isLoading, error, actualizarEstado: actualizarEstadoOriginal } = useFormattedAdminOrders(filtroEstado)
  const { toast } = useToast()
  
  // Usar el contexto global de alarmas
  const { 
    reproducirAlarmaNuevoPedido, 
    reproducirAlarmaTiempoAgotandose, 
    iniciarAlarmaRepetitiva, 
    detenerAlarmaRepetitiva,
    detenerAudiosInmediatamente,
    alarmaActiva 
  } = useAlarms();
  // Función para marcar un pedido como atendido (actualiza la visualización)
  const marcarPedidoAtendido = useCallback((pedidoId: string) => {
    // Actualizar el conjunto de pedidos sin atender
    setPedidosNuevosSinAtender(prev => {
      const nuevos = new Set(prev);
      nuevos.delete(pedidoId);
      
      // 🔇 DETENER AUDIOS SOLO SI NO QUEDAN MÁS PEDIDOS SIN ATENDER
      if (nuevos.size === 0) {
        console.log('✅ Último pedido atendido - deteniendo alarmas');
        detenerAudiosInmediatamente();
      } else {
        console.log(`⏳ Quedan ${nuevos.size} pedido(s) sin atender - alarmas continúan`);
      }
      
      return nuevos;
    });
    
    // Eliminar de los pedidos notificados localmente
    pedidosNotificadosRef.current.delete(pedidoId);
  }, [detenerAudiosInmediatamente]);
  
  // Función para actualizar estado con atención automática y feedback instantáneo
  const actualizarEstado = useCallback(async (pedidoId: string, nuevoEstado: Pedido['estado']) => {
    // 🚀 Marcar el pedido como atendido INMEDIATAMENTE (feedback visual)
    marcarPedidoAtendido(pedidoId);
    
    // 🚀 Limpiar estados locales INMEDIATAMENTE para feedback instantáneo
    if (nuevoEstado === "Entregado" || nuevoEstado === "Cancelado") {
      setCuentasRegresivas(prev => {
        const next = { ...prev };
        delete next[pedidoId];
        return next;
      });
      
      setPedidosConPocoTiempo(prev => {
        const nuevos = new Set(prev);
        nuevos.delete(pedidoId);
        return nuevos;
      });
    }

    // Actualizar el estado en Firebase (el hook ya hace optimistic update)
    // No esperamos el resultado para no bloquear la UI
    actualizarEstadoOriginal(pedidoId, nuevoEstado).catch(error => {
      console.error('Error al actualizar estado:', error);
      // El listener en tiempo real revertirá si hay error
    });
  }, [actualizarEstadoOriginal, marcarPedidoAtendido, pedidos]);

  // Función para reembolsar pedido Webpay
  const reembolsarPedidoWebpay = async (pedidoId: string) => {
    try {
      const functions = getFunctions()
      const refundOrder = httpsCallable(functions, "refundOrder")
      await refundOrder({ orderId: pedidoId })
      toast({
        title: "Reembolso exitoso",
        description: "El pedido fue reembolsado correctamente. El inventario ha sido restaurado.",
      })
    } catch (error: any) {
      toast({
        title: "Error al reembolsar",
        description: error?.message || "No se pudo procesar el reembolso.",
        variant: "destructive",
      })
    }
  }

  // Función para marcar como pagado un pedido pendiente
  const marcarComoPagado = async (pedidoId: string) => {
    try {
      await updateDoc(doc(db, 'orders', pedidoId), {
        paymentStatus: 'paid'
      });
      toast({
        title: "Pago confirmado",
        description: "El pedido ha sido marcado como pagado exitosamente.",
      });
    } catch (error: any) {
      toast({
        title: "Error al marcar pago",
        description: error?.message || "No se pudo actualizar el estado de pago.",
        variant: "destructive",
      });
    }
  }

  // Funciones auxiliares
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Pendiente": return <Clock className="w-4 h-4 text-yellow-500" />
      case "En preparación": return <Package className="w-4 h-4 text-blue-500" />
      case "En camino": return <Truck className="w-4 h-4 text-purple-500" />
      case "Pedido Listo": return <CheckCircle className="w-4 h-4 text-green-600" />
      case "Entregado": return <CheckCircle className="w-4 h-4 text-green-500" />
      case "Cancelado": return <Clock className="w-4 h-4 text-red-500" />
      default: return <Clock className="w-4 h-4 text-gray-500" />
    }
  }
  const getStatusColor = (status: string) => {
    switch (status) {
      case "Pendiente": return "bg-yellow-500"
      case "En preparación": return "bg-blue-500"
      case "En camino": return "bg-purple-500"
      case "Pedido Listo": return "bg-green-600"
      case "Entregado": return "bg-green-500"
      case "Cancelado": return "bg-red-500"
      default: return "bg-gray-500"
    }
  }
  // Obtener el próximo estado basado en el estado actual y tipo de entrega
  const getNextStatus = (current: string, tipo: string): Pedido['estado'] | null => {
    if (tipo === "Retiro") {
      switch (current) {
        case "Pendiente": return "En preparación"
        case "En preparación": return "Pedido Listo"
        case "Pedido Listo": return "Entregado"
        default: return null
      }
    } else {
      switch (current) {
        case "Pendiente": return "En preparación"
        case "En preparación": return "En camino"
        case "En camino": return "Entregado"
        default: return null
      }
    }
  }
  
  // Obtener la etiqueta amigable para el próximo estado
  const getNextStatusLabel = (current: string, tipo: string): string => {
    if (tipo === "Retiro") {
      switch (current) {
        case "Pendiente": return "Elaboración"
        case "En preparación": return "Listo"
        case "Pedido Listo": return "Entregado"
        default: return ""
      }
    } else {
      switch (current) {
        case "Pendiente": return "Elaboración"
        case "En preparación": return "Delivery"
        case "En camino": return "Entregado"
        default: return ""
      }
    }
  }

  const formatearTiempo = (seg: number) => {
    const m = Math.floor(seg/60)
    const s = seg % 60
    return `${m}:${s.toString().padStart(2,'0')}`
  }
  
  // Cargar tiempos desde localStorage al inicio y mantener sincronía
  useEffect(() => {
    // Función para cargar datos desde localStorage
    const cargarDesdeLocalStorage = () => {
      try {
        const cuentasGuardadas = localStorage.getItem(CUENTAS_STORAGE_KEY)
        const tiemposGuardados = localStorage.getItem(TIEMPOS_STORAGE_KEY)
        
        if (cuentasGuardadas && tiemposGuardados) {
          const cuentasObj = JSON.parse(cuentasGuardadas)
          const tiemposObj = JSON.parse(tiemposGuardados)
          
          // Log para depuración
          console.log("Cuentas regresivas cargadas desde localStorage:", cuentasObj)
          
          setCuentasRegresivas(cuentasObj)
          setTiemposEstimados(tiemposObj)
        }
      } catch (error) {
        console.error("Error al cargar tiempos desde localStorage:", error)
      }
    }
    
    // Cargar inicialmente
    cargarDesdeLocalStorage()
    
    // Configurar sincronización periódica
    const interval = setInterval(cargarDesdeLocalStorage, 1000)
    
    // Evento de almacenamiento para sincronizar entre pestañas
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === CUENTAS_STORAGE_KEY || e.key === TIEMPOS_STORAGE_KEY) {
        cargarDesdeLocalStorage()
      }
    }
    
    // Agregar listener para eventos de storage
    window.addEventListener('storage', handleStorageChange)
    
    // Limpiar
    return () => {
      clearInterval(interval)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  // Función para imprimir la comanda
  const imprimirComanda = (pedido: Pedido) => {
    // Guardar el pedido en el estado y abrir el modal
    setPedidoAImprimir(pedido)
    setModalImpresionAbierto(true)
    
    // Marcar el pedido como atendido (detiene la alarma)
    marcarPedidoAtendido(pedido.documentId);
  }

  // Función para imprimir desde el modal
  const confirmarImpresion = () => {
    if (!pedidoAImprimir) return;

    const printContent = document.getElementById('comanda-para-imprimir');
    if (!printContent) return;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    iframe.onload = () => {
      const printStyles = `
        <style>
          @media print {
            @page { size: 58mm auto; margin: 0; }
            body { margin: 0; padding: 4mm 3mm; font-size: 12pt; }
            .comanda-container { width: 58mm; max-width: 58mm; margin: 0 auto; }
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          body { font-family: Arial, sans-serif; color: #000; }
          .comanda-container { font-size: 12px; line-height: 1.2; }
          .comanda-header { text-align: center; }
          .comanda-logo { width: 32mm; height: auto; margin: 4px auto 3px; display: block; }
          .comanda-order-number { 
            font-family: 'Arial Narrow', 'Roboto Condensed', 'Archivo Narrow', sans-serif-condensed, sans-serif;
            font-stretch: condensed;
            font-size: 18px; 
            font-weight: 700; 
            letter-spacing: -0.2px; 
            text-decoration: underline; 
            margin: 2px 0 4px; 
          }
          .comanda-estimada {
            display: flex; align-items: center; justify-content: center; gap: 6px;
            font-size: 13px; font-weight: 700; margin: 4px 0 6px;
          }
          .comanda-clock {
            width: 14px; height: 14px; display: inline-block; vertical-align: middle;
          }
          .comanda-pill {
            display: inline-block; background: #fff; color: #000; 
            border: 1.5px solid #000;
            border-radius: 999px; padding: 5px 14px; font-weight: 700; 
            font-size: 13px; letter-spacing: 0.7px; margin: 6px 0 4px;
          }
          .comanda-meta { font-size: 9px; margin: 3px 0; }
          .comanda-payment { font-size: 9px; margin-top: 3px; }
          .comanda-divider { border-top: 1px solid #999; margin: 7px 0; }
          .comanda-items { margin-top: 6px; text-align: center; }
          .comanda-item { margin-bottom: 6px; }
          .comanda-item-name { font-size: 13px; font-weight: 700; text-align: center; }
          .comanda-item-detail { font-size: 12px; text-align: center; }
          .comanda-totals { text-align: center; margin-top: 6px; }
          .comanda-total-row { font-size: 12px; margin: 2px 0; }
          .comanda-total-strong { font-size: 14px; font-weight: 700; }
        </style>
      `;

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) {
        return;
      }

      iframeDoc.open();
      iframeDoc.write(printStyles + printContent.innerHTML);
      iframeDoc.close();

      setTimeout(() => {
        iframe.contentWindow?.print();

        setTimeout(() => {
          document.body.removeChild(iframe);

          setModalImpresionAbierto(false);

          if (pedidoAImprimir.documentId) {
            marcarPedidoAtendido(pedidoAImprimir.documentId);

            setPedidosNuevosSinAtender(prev => {
              const updated = new Set(prev);
              updated.delete(pedidoAImprimir.documentId);
              return updated;
            });

            setPedidosConPocoTiempo(prev => {
              const updated = new Set(prev);
              updated.delete(pedidoAImprimir.documentId);
              return updated;
            });
          }
        }, 100);
      }, 200);
    };

    iframe.src = 'about:blank';
  }
  
  // Función para enviar los datos del delivery a WhatsApp
  const enviarPedidoAWhatsApp = (pedido: Pedido) => {
    if (pedido.tipoEntrega !== "Delivery" || !pedido.direccion) return;
    
    const { valorDelivery, totalConDelivery } = getPedidoMontos(pedido);
    const pagaCon = Number(pedido.paymentDetails?.cashAmount || pedido.montoVuelto || 0)
    const vuelto = Number(
      pedido.paymentDetails?.change ??
      (pedido.requiereVuelto && pedido.montoVuelto ? pedido.montoVuelto - totalConDelivery : 0)
    )
    const detalleEfectivo = pedido.metodoPago === "Efectivo"
      ? `
*PAGA CON:* ${pagaCon > 0 ? formatCurrency(pagaCon) : 'No informado'}
*VUELTO A ENTREGAR:* ${formatCurrency(Math.max(0, vuelto))}`
      : ''
    
    // Limpiar notas de códigos promocionales, vouchers o POS para no enviar información extra al delivery
    let notasDelivery = getSpecialOrderNote(pedido.notas);
    notasDelivery = notasDelivery
      .replace(/\|?\s*\[CÓDIGO USADO:[^\]]+\]/g, '')
      .replace(/\|?\s*\[VOUCHER USADO:[^\]]+\]/g, '')
      .trim();
    notasDelivery = notasDelivery.replace(/^\|\s*/, '').replace(/\s*\|$/, '').trim();

    // Crear el mensaje con todos los datos relevantes
    const mensaje = `
🍕 *DELIVERY PIZZERÍA PALERMO* 🍕

*CLIENTE:* ${pedido.cliente.nombre}
*TELÉFONO:* ${pedido.cliente.telefono}
*DIRECCIÓN:* ${pedido.direccion.calle} ${pedido.direccion.numero}, ${pedido.direccion.comuna}
${pedido.direccion.referencia ? `*REFERENCIAS:* ${pedido.direccion.referencia}` : ''}
*UBICACIÓN EN MAPA:* ${pedido.direccion.lat && pedido.direccion.lng 
  ? `https://www.google.com/maps?q=${pedido.direccion.lat},${pedido.direccion.lng}` 
  : 'No disponible'}
*MÉTODO DE PAGO:* ${pedido.metodoPago}
${detalleEfectivo}
*VALOR DELIVERY:* ${formatCurrency(valorDelivery)}
${notasDelivery ? `\n*NOTAS ADICIONALES:* ${notasDelivery}` : ''}
`.trim();
    
    getActiveDeliveryPhone()
      .then((numeroRepartidor) => {
        const functions = getFunctions();
        const sendDeliveryDataWhatsApp = httpsCallable(functions, "sendDeliveryDataWhatsApp");

        return sendDeliveryDataWhatsApp({
          phone: numeroRepartidor,
          message: mensaje,
        });
      })
      .then((response) => {
        const result = response as { data?: { success?: boolean } };

        if (!result.data?.success) {
          throw new Error("No se pudo enviar el WhatsApp al repartidor");
        }

        toast({
          title: "Datos enviados",
          description: "La información del delivery fue enviada al repartidor por WhatsApp.",
        });
      })
      .catch((error) => {
        console.error("Error al enviar datos de delivery por WhatsApp:", error);
        toast({
          title: "No se pudo enviar WhatsApp",
          description: "Revisa la configuración de teléfonos en Zonas Delivery o la integración de WhatsApp/Twilio.",
          variant: "destructive",
        });
      });
  }

  // Establecer tiempo estimado
  const establecerTiempoEstimado = useCallback(async (pedidoId: string, minutos: number) => {
    try {
      console.log(`Solicitando establecer tiempo estimado: ${pedidoId}, ${minutos} minutos`)
      
      // Usar el método global si está disponible
      if (typeof window !== 'undefined' && 'establecerTiempoEstimadoGlobal' in window) {
        // @ts-ignore
        const resultado = await window.establecerTiempoEstimadoGlobal(pedidoId, minutos)
        
        if (resultado) {
          // El estado de tiemposEstimados y cuentasRegresivas se sincronizará automáticamente
          // con los cambios en Firebase a través del efecto de sincronización
          console.log(`✅ Tiempo estimado establecido globalmente para pedido ${pedidoId}: ${minutos} minutos`)
          
          // Marcar el pedido como atendido (detiene la alarma)
          marcarPedidoAtendido(pedidoId);
        }
      } else {
        console.warn('Método global para establecer tiempo no disponible. Usando método local como fallback.')
        
        // Código de fallback (similar al original)
        const inicio = new Date()
        const fin = new Date(inicio.getTime() + minutos * 60000)
        
        // Si el tiempo es menor a 3.5 minutos, mostrar advertencia
        if (minutos < 3.5) {
          console.warn(`⚠️ Estableciendo tiempo muy corto (${minutos} minutos) para pruebas de alarma`)
        }
        
        setTiemposEstimados(prev => ({ ...prev, [pedidoId]: minutos }))
        
        // Calcular los segundos correctamente
        const segundos = Math.round(minutos * 60)
        setCuentasRegresivas(prev => ({ ...prev, [pedidoId]: segundos }))
        
        await updateDoc(doc(db,'orders',pedidoId), {
          tiempoEstimadoMinutos: minutos,
          tiempoEstimadoInicio: inicio.toISOString(),
          tiempoEstimadoFin: fin.toISOString()
        })
        
        // Marcar el pedido como atendido (detiene la alarma)
        marcarPedidoAtendido(pedidoId);
        console.log(`✅ Tiempo establecido correctamente: ${segundos} segundos`)
      }
    } catch (error) {
      console.error("Error al establecer tiempo estimado:", error)
    }
  }, [marcarPedidoAtendido])

  // lógica de cuenta regresiva (solo para visualización)
  useEffect(() => {
    const iv = setInterval(() => {
      setCuentasRegresivas(prev => {
        const next = { ...prev }
        // Crear un conjunto temporal para actualizar pedidosConPocoTiempo
        const nuevosPocoTiempo = new Set<string>()
        
        for (const id in next) {
          if (next[id] > 0) {
            // Actualizar visualización de pedidos con poco tiempo (solo visualización)
            if (next[id] <= 180) {
              nuevosPocoTiempo.add(id)
            }
            
            next[id]--
          }
        }
        
        // Actualizar el estado de pedidos con poco tiempo solo si cambió para evitar re-renders innecesarios
        setPedidosConPocoTiempo(prevPoco => {
          if (
            prevPoco.size === nuevosPocoTiempo.size &&
            [...nuevosPocoTiempo].every(id => prevPoco.has(id))
          ) {
            return prevPoco
          }
          return nuevosPocoTiempo
        })
        
        return next
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [])

  // Sincronizar con pedidos pendientes (no activar alarmas, solo estado visual)
  useEffect(() => {
    // No hacer nada si está cargando
    if (isLoading) return;
    
    // Actualizar el estado visual de pedidos sin atender
    const pedidosPendientes = pedidos.filter(p => p.estado === "Pendiente");
    
    // Verificar si hay pedidos pendientes que no estemos mostrando como nuevos
    const pendientesIds = new Set(pedidosPendientes.map(p => p.documentId));
    const nuevosVisuales = new Set<string>();
    
    // Mantenemos como "nuevos visuales" solo los que siguen pendientes
    pendientesIds.forEach(id => {
      if (pedidosNotificadosRef.current.has(id)) {
        nuevosVisuales.add(id);
      }
    });
    
    // Actualizar estado visual si es diferente
    if (nuevosVisuales.size !== pedidosNuevosSinAtender.size || 
        ![...nuevosVisuales].every(id => pedidosNuevosSinAtender.has(id))) {
      setPedidosNuevosSinAtender(nuevosVisuales);
    }
    
  }, [pedidos, isLoading, pedidosNuevosSinAtender]);

  // Limpiar recursos al desmontar el componente
  useEffect(() => {
    return () => {
      // No es necesario limpiar el intervalo de alarma ya que se maneja en el contexto
    };
  }, []);

  // Detectar pedidos con poco tiempo al cargar
  useEffect(() => {
    // Esto se ejecutará una vez al cargar el componente para identificar
    // pedidos que ya tienen poco tiempo restante
    setCuentasRegresivas(prev => {
      const nuevosPocoTiempo = new Set<string>(pedidosConPocoTiempo);
      
      // Verificar si hay pedidos que ya estén con menos de 3 minutos
      for (const id in prev) {
        if (prev[id] <= 180) {
          nuevosPocoTiempo.add(id);
        }
      }
      
      // Si encontramos nuevos pedidos con poco tiempo, actualizar el estado
      if (nuevosPocoTiempo.size > pedidosConPocoTiempo.size) {
        setPedidosConPocoTiempo(nuevosPocoTiempo);
      }
      
      return prev;
    });
  }, []);

  // restaurar tiempos
  useEffect(() => {
    // Crear objetos temporales para actualizar en batch
    const newTiemposEstimados = { ...tiemposEstimados };
    const newCuentasRegresivas = { ...cuentasRegresivas };
    let hasChanges = false;
    
    // Primero, verificar si hay pedidos entregados o cancelados en cuentasRegresivas que deban eliminarse
    for (const id in newCuentasRegresivas) {
      const pedido = pedidos.find(p => p.documentId === id);
      if (pedido && (pedido.estado === "Entregado" || pedido.estado === "Cancelado")) {
        delete newCuentasRegresivas[id];
        delete newTiemposEstimados[id];
        hasChanges = true;
      }
    }
    
    // Luego procesar los pedidos activos
    pedidos.forEach(p => {
      // Solo procesar pedidos que no estén entregados o cancelados
      if (p.tiempoEstimadoInicio && p.tiempoEstimadoMinutos && !["Entregado","Cancelado"].includes(p.estado)) {
        const ini = new Date(p.tiempoEstimadoInicio).getTime()
        const total = p.tiempoEstimadoMinutos*60
        const trans = Math.floor((Date.now()-ini)/1000)
        const rest = Math.max(0,total-trans)
        
        // Actualizar en objetos temporales
        if (newTiemposEstimados[p.documentId] !== p.tiempoEstimadoMinutos) {
          newTiemposEstimados[p.documentId] = p.tiempoEstimadoMinutos!;
          hasChanges = true;
        }
        
        if (newCuentasRegresivas[p.documentId] !== rest) {
          newCuentasRegresivas[p.documentId] = rest;
          hasChanges = true;
        }
        
        // Marcar como poco tiempo si corresponde
        if (rest <= 180) {
          setPedidosConPocoTiempo(prev => {
            if (!prev.has(p.documentId)) {
              const nuevos = new Set(prev);
              nuevos.add(p.documentId);
              return nuevos;
            }
            return prev;
          });
        }
      }
    });
    
    // Solo actualizar estados si hay cambios reales
    if (hasChanges) {
      setTiemposEstimados(newTiemposEstimados);
      setCuentasRegresivas(newCuentasRegresivas);
    }
  }, [pedidos, isLoading, tiemposEstimados, cuentasRegresivas]);

  // Este efecto se elimina porque ahora la sincronización con Firebase se hace en el GlobalOrderMonitor
  useEffect(() => {
    // La sincronización con Firebase ahora se maneja en el GlobalOrderMonitor
    return () => {}
  }, [])

  // Los pedidos ya vienen filtrados por estado desde el listener
  // Aquí solo filtramos por búsqueda de texto
  const pedidosFiltrados = pedidos.filter(p =>
    busqueda === '' || 
    p.id.toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.cliente && p.cliente.nombre && p.cliente.nombre.toLowerCase().includes(busqueda.toLowerCase()))
  )

  if (isLoading) return <div className="min-h-screen bg-gray-50 dark:bg-gray-900"><p className="p-8 text-center dark:text-white">Cargando pedidos...</p></div>

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold dark:text-white">Gestión de Pedidos</h1>
            <p className="text-gray-600 dark:text-gray-300">Administra y actualiza el estado de los pedidos</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:flex-initial">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input placeholder="Buscar por ID o cliente" value={busqueda} onChange={e=>setBusqueda(e.target.value)} className="pl-10 w-full md:w-64" />
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Filter className="w-4 h-4 text-gray-500" />
              <label htmlFor="filtroEstado" className="sr-only">Filtrar estado</label>
              <select
                id="filtroEstado"
                value={filtroEstado}
                onChange={e => setFiltroEstado(e.target.value)}
                className="border rounded px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white flex-1 md:flex-initial"
              >
                <option value="activos">Activos</option>
                <option value="todos">Todos</option>
                <option value="Pendiente">Pendiente</option>
                <option value="En preparación">En preparación</option>
                <option value="En camino">En camino</option>
                <option value="Pedido Listo">Pedido Listo</option>
                <option value="Entregado">Entregado</option>
                <option value="Cancelado">Cancelado</option>
              </select>
            </div>
          </div>
        </div>
        <div className="grid gap-6">
          {pedidosFiltrados.map(pedido => (
            <Card key={pedido.documentId} className={`hover:shadow-md transition-shadow ${pedidosNuevosSinAtender.has(pedido.documentId) ? 'border-2 border-red-500 animate-pulse' : ''}`}>
              <CardHeader className="pb-2">
                <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-3">
                  {/* Columna 1 Header: Estado e información de fecha/pago */}
                  <div>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(pedido.estado)}
                      <span className={`px-2 py-0.5 rounded-full text-white text-xs font-semibold ${getStatusColor(pedido.estado)}`}>
                        {pedido.estado}
                      </span>
                      {pedidosNuevosSinAtender.has(pedido.documentId) && (
                        <span className="bg-red-500 text-white px-2 py-0.5 rounded-full text-xs font-bold animate-pulse">
                          ¡NUEVO!
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-4 text-xs text-gray-600 dark:text-gray-300 mt-1.5">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4"/>
                        <span>{pedido.fechaCreacion}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4"/>
                        <span>{pedido.metodoPago}</span>
                      </div>
                    </div>
                  </div>

                  {/* Columna 2 Header: CLIENTE #ID + Insignia Retiro/Delivery */}
                  <div className="flex items-center md:justify-center gap-3">
                    <span 
                      className="font-arial-narrow text-2xl md:text-3xl lg:text-4xl text-pink-500 uppercase tracking-tighter"
                      style={{
                        fontFamily: "'Arial Narrow', 'Arial-Narrow', 'Roboto Condensed', 'Archivo Narrow', sans-serif",
                        fontStretch: 'condensed',
                        fontWeight: 700,
                        letterSpacing: '-0.02em'
                      }}
                    >
                      {(() => {
                        const nombre = pedido.cliente?.nombre
                        const esValido = Boolean(
                          nombre && 
                          nombre.trim() !== '' && 
                          nombre !== 'Usuario anónimo' && 
                          nombre !== 'No especificado' && 
                          nombre !== 'Venta Caja (Presencial)'
                        )
                        const textoNombre = esValido ? nombre!.trim().toUpperCase() : 'CLIENTE'
                        const idFormateado = pedido.id.startsWith('#') ? pedido.id : `#${pedido.id}`
                        return `${textoNombre} ${idFormateado}`
                      })()}
                    </span>
                    <span className="px-4 md:px-5 py-1 md:py-1.5 rounded-full text-sm md:text-base font-extrabold bg-white text-gray-900 border border-gray-300 dark:border-gray-500 shadow-md tracking-wide">
                      {(pedido.tipoEntrega === 'Delivery' || Number(pedido.valorDelivery || 0) > 0) ? 'Delivery' : 'Retiro'}
                    </span>
                  </div>

                  {/* Columna 3 Header: Acción Aceptar (solo si está pendiente) */}
                  <div className="flex justify-start md:justify-end items-center gap-2">
                    {pedido.estado === "Pendiente" && (
                      <Button 
                        onClick={() => actualizarEstado(pedido.documentId, "En preparación")}
                        className="bg-green-600 hover:bg-green-700 text-white font-semibold"
                        size="sm"
                      >
                        Aceptar
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid md:grid-cols-3 gap-4">
                  {/* Cliente: Información de contacto (Teléfono, Email, Dirección) */}
                  <div>
                    <div className="space-y-1 text-sm pt-1">
                      <div className="flex items-start">
                        <div className="font-semibold w-20 dark:text-white">Teléfono:</div>
                        <div className="flex items-center dark:text-white">
                          <Phone className="w-4 h-4 mr-1 text-blue-600 dark:text-blue-400"/> 
                          {(!pedido.cliente?.telefono || pedido.cliente.telefono === 'No disponible' || pedido.cliente.telefono === 'No informado') ? 
                            <span className="text-gray-500 dark:text-gray-400">No informado</span> : 
                            pedido.cliente.telefono}
                        </div>
                      </div>
                      {pedido.cliente?.email && (
                        <div className="flex items-start">
                          <div className="font-semibold w-20 dark:text-white">Email:</div>
                          <div className="dark:text-white truncate">{pedido.cliente.email}</div>
                        </div>
                      )}
                    </div>
                    
                    {/* Mostrar dirección solo para pedidos de delivery */}
                    {(pedido.tipoEntrega === 'Delivery' || Number(pedido.valorDelivery || 0) > 0) && pedido.direccion && (
                      <div className="mt-2 text-sm">
                        <div className="font-semibold mb-1 dark:text-white">Dirección de entrega:</div>
                        <div className="dark:text-white"><MapPin className="w-4 h-4 inline mr-1 text-red-500 dark:text-red-400"/> {pedido.direccion.calle} {pedido.direccion.numero}, {pedido.direccion.comuna}</div>
                        {pedido.direccion.referencia && <div className="text-xs mt-1 italic dark:text-gray-300">Ref: {pedido.direccion.referencia}</div>}
                      </div>
                    )}
                  </div>
                  {/* Productos y montos */}
                  <div>
                    <h4 className="font-medium mb-1 dark:text-white">Productos</h4>
                    <div className="space-y-1 text-sm dark:text-white">
                      {pedido.items.map((i, idx) => {
                        const isDuo = i.pizzaType === 'duo' || Boolean(i.half1 || i.half2) || (i.nombre && i.nombre.toLowerCase().includes('duo'))
                        const h1Name = i.half1?.variety || i.pizza1 || 'Personalizada'
                        const h2Name = i.half2?.variety || i.pizza2 || 'Personalizada'
                        const h1Extras = [...(i.half1?.simpleIngredients || []), ...(i.half1?.premiumIngredients || []).map((x: string) => `${x} (P)`)]
                        const h2Extras = [...(i.half2?.simpleIngredients || []), ...(i.half2?.premiumIngredients || []).map((x: string) => `${x} (P)`)]
                        
                        const todaSimple = (Array.isArray(i.extraSimple) && i.extraSimple.length > 0)
                          ? i.extraSimple
                          : (Array.isArray(i.ingredients) ? i.ingredients.filter((x: string) => !h1Extras.includes(x) && !h2Extras.includes(x)) : [])
                        const todaPremium = (Array.isArray(i.extraPremium) && i.extraPremium.length > 0)
                          ? i.extraPremium
                          : (Array.isArray(i.premiumIngredients) ? i.premiumIngredients.filter((x: string) => !h1Extras.includes(x) && !h2Extras.includes(x)) : [])
                        const todaEx = [...todaSimple, ...todaPremium.map((x: string) => `${x} (P)`)]

                        return (
                          <div key={idx} className="border-b border-gray-100 dark:border-gray-800/60 pb-1 last:border-0">
                            <div className="flex justify-between">
                              <span className="font-medium">{i.cantidad}x {i.nombre}</span>
                              <span className="font-semibold">${(i.precio * (i.cantidad || 1)).toLocaleString('es-CL')}</span>
                            </div>
                            {isDuo && (
                              <div className="text-[11px] text-gray-500 dark:text-gray-400 pl-2 space-y-0.5 mt-0.5">
                                <div>• 1/2 {h1Name}{h1Extras.length ? ` (${h1Extras.join(', ')})` : ''}</div>
                                <div>• 1/2 {h2Name}{h2Extras.length ? ` (${h2Extras.join(', ')})` : ''}</div>
                                {todaEx.length > 0 && <div className="text-yellow-600 dark:text-yellow-400 font-semibold">• Toda la pizza: {todaEx.join(', ')}</div>}
                              </div>
                            )}
                          </div>
                        )
                      })}
                      {(() => {
                        const { subtotal, valorDelivery, descuentos, discountCode, voucherCode, totalConDelivery } = getPedidoMontos(pedido)
                        return (
                          <>
                            <div className="border-t pt-2 flex justify-between dark:text-white">
                              <span>Subtotal</span>
                              <span>{formatCurrency(subtotal)}</span>
                            </div>
                            {valorDelivery > 0 && (
                              <div className="flex justify-between dark:text-white">
                                <span>Delivery</span>
                                <span>{formatCurrency(valorDelivery)}</span>
                              </div>
                            )}
                            {descuentos > 0 && (
                              <div className="flex justify-between text-green-600 dark:text-green-400">
                                <span>Descuento {discountCode ? `(${discountCode})` : voucherCode ? `(${voucherCode})` : '(Promoción)'}</span>
                                <span>-{formatCurrency(descuentos)}</span>
                              </div>
                            )}
                            <div className="font-bold flex justify-between dark:text-white mt-1 border-t border-dashed border-gray-200 dark:border-gray-700 pt-1">
                              <span>Total</span>
                              <span>{formatCurrency(totalConDelivery)}</span>
                            </div>
                          </>
                        )
                      })()}
                      {(() => {
                        const notaEspecial = getSpecialOrderNote(pedido.notas);
                        if (!notaEspecial) return null;
                        return (
                          <div className="mt-2 text-xs bg-yellow-50 dark:bg-yellow-900 dark:text-yellow-100 p-1 rounded">
                            Notas: {notaEspecial}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  {/* Acciones y timers */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5 md:gap-2">
                      {["Entregado", "Cancelado"].includes(pedido.estado) ? (
                        <div className="text-sm text-gray-500 dark:text-gray-400 italic">Pedido finalizado</div>
                      ) : (
                        <>
                          {[15, 20, 25, 30, 45, 60].map(m => (
                            <Button 
                              key={m} 
                              size="sm" 
                              variant={tiemposEstimados[pedido.documentId] === m ? 'default' : 'outline'} 
                              className={tiemposEstimados[pedido.documentId] === m 
                                ? "bg-white text-gray-900 font-bold border-2 border-white hover:bg-gray-100 dark:bg-white dark:text-gray-900 shadow-sm" 
                                : "dark:border-gray-700 dark:text-gray-300 hover:bg-gray-800"}
                              onClick={() => establecerTiempoEstimado(pedido.documentId, m)}
                            >
                              {m}m
                            </Button>
                          ))}
                        </>
                      )}
                    </div>
                    {/* Solo mostrar cuenta regresiva si el pedido no está entregado o cancelado */}
                    {cuentasRegresivas[pedido.documentId] !== undefined && !["Entregado", "Cancelado"].includes(pedido.estado) && (
                      <>
                        {(() => {
                          const tiempoRestante = cuentasRegresivas[pedido.documentId]
                          const tiempoTotal = (tiemposEstimados[pedido.documentId] || 0) * 60 // convertir minutos a segundos
                          const porcentaje = tiempoTotal > 0 ? Math.max(0, Math.min(100, (tiempoRestante / tiempoTotal) * 100)) : 0
                          const esTiempoCritico = pedidosConPocoTiempo.has(pedido.documentId)
                          
                          return (
                            <div className="space-y-2">
                              {/* Barra de progreso */}
                              <div className={`relative h-12 rounded-lg overflow-hidden shadow-inner border transition-colors duration-300 ${
                                esTiempoCritico 
                                  ? "bg-red-950/20 border-red-500/80 dark:border-red-500/80" 
                                  : "bg-gray-200 dark:bg-gray-800 border-gray-300 dark:border-gray-700"
                              }`}>
                                {/* Barra de progreso que se vacía */}
                                <div 
                                  className={`absolute top-0 left-0 h-full transition-[width] duration-1000 ease-linear ${
                                    esTiempoCritico 
                                      ? "bg-gradient-to-r from-red-600 to-red-700" 
                                      : "bg-gray-600 dark:bg-zinc-700"
                                  }`}
                                  style={{ width: `${porcentaje}%` }}
                                />
                                {/* Texto del tiempo sobre la barra */}
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                  <span className="font-mono text-2xl font-bold text-white z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
                                    {formatearTiempo(tiempoRestante)}
                                  </span>
                                </div>
                              </div>
                              {esTiempoCritico && (
                                <div className="text-center text-red-600 dark:text-red-400 font-extrabold text-sm tracking-wide">
                                  ¡TIEMPO CRÍTICO!
                                </div>
                              )}
                            </div>
                          )
                        })()}
                      </>
                    )}
                    {/* Mensaje de estado completado para pedidos finalizados */}
                    {["Entregado", "Cancelado"].includes(pedido.estado) && (
                      <div className={`font-medium text-center py-2 px-3 rounded-md ${
                        pedido.estado === "Entregado" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                      }`}>
                        {pedido.estado === "Entregado" ? "Pedido completado" : "Pedido cancelado"}
                      </div>
                    )}
                    {/* Fila de botones de acción con diseño gris neutro para Listo y Marcar Pagado */}
                    <div className="flex gap-2 items-center justify-between mt-2">
                      {getNextStatus(pedido.estado, pedido.tipoEntrega) && (
                        <Button 
                          size="sm" 
                          className="flex-1 bg-gray-700 hover:bg-gray-600 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white border border-gray-600 dark:border-zinc-600 transition-colors" 
                          onClick={() => {
                            const nuevoEstado = getNextStatus(pedido.estado, pedido.tipoEntrega);
                            if (nuevoEstado) {
                              actualizarEstado(pedido.documentId, nuevoEstado);
                            }
                          }}
                        >
                          {getNextStatusLabel(pedido.estado, pedido.tipoEntrega)}
                        </Button>
                      )}
                      
                      {/* Botón para marcar como pagado */}
                      {pedido.paymentStatus === "pending" && pedido.estado !== "Cancelado" && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="bg-gray-700 hover:bg-gray-600 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white border border-gray-600 dark:border-zinc-600 font-bold px-2 transition-colors"
                          onClick={() => marcarComoPagado(pedido.documentId)}
                        >
                          Marcar Pagado
                        </Button>
                      )}

                      {/* Botón de impresión simplificado */}
                      <Button size="sm" variant="outline" className="bg-green-600 text-white hover:bg-green-700" 
                        onClick={()=>imprimirComanda(pedido)}>
                        <Printer className="w-4 h-4" />
                      </Button>
                      
                      {/* Botón de WhatsApp para pedidos de delivery */}
                      {(pedido.tipoEntrega === 'Delivery' || Number(pedido.valorDelivery || 0) > 0) && pedido.direccion && (
                        <Button size="sm" variant="outline" className="bg-green-500 text-white hover:bg-green-600 flex items-center gap-1 px-2"
                          onClick={() => enviarPedidoAWhatsApp(pedido)}>
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                            <path fillRule="evenodd" clipRule="evenodd" d="M20.463 3.488C18.217 1.24 15.231 0.001 12.05 0C5.495 0 0.16 5.334 0.157 11.892C0.156 13.988 0.67 16.035 1.651 17.855L0.059 24L6.345 22.445C8.089 23.33 10.042 23.794 12.04 23.795H12.05C18.603 23.795 23.94 18.461 23.943 11.901C23.944 8.738 22.71 5.735 20.463 3.488ZM12.05 21.784H12.041C10.264 21.784 8.524 21.341 6.999 20.513L6.63 20.296L2.864 21.219L3.804 17.56L3.567 17.178C2.66 15.6 2.177 13.772 2.178 11.893C2.18 6.443 6.601 2.011 12.059 2.011C14.686 2.012 17.156 3.043 19.022 4.911C20.888 6.778 21.922 9.258 21.921 11.9C21.919 17.351 17.498 21.784 12.05 21.784ZM17.472 14.382C17.17 14.231 15.697 13.508 15.416 13.407C15.136 13.307 14.934 13.256 14.732 13.558C14.529 13.86 13.96 14.534 13.782 14.736C13.604 14.939 13.426 14.964 13.125 14.813C12.823 14.662 11.886 14.342 10.769 13.35C9.892 12.573 9.309 11.622 9.131 11.32C8.953 11.019 9.113 10.851 9.265 10.697C9.402 10.558 9.57 10.336 9.723 10.158C9.875 9.98 9.927 9.854 10.027 9.652C10.127 9.449 10.076 9.271 10.001 9.12C9.927 8.969 9.344 7.494 9.091 6.891C8.847 6.304 8.599 6.388 8.412 6.378C8.234 6.369 8.031 6.367 7.829 6.367C7.626 6.367 7.295 6.442 7.015 6.744C6.734 7.045 5.961 7.768 5.961 9.244C5.961 10.719 7.04 12.145 7.193 12.347C7.345 12.55 9.307 15.583 12.297 16.883C13.006 17.192 13.559 17.388 13.991 17.533C14.716 17.77 15.378 17.738 15.901 17.661C16.481 17.576 17.674 16.941 17.927 16.236C18.18 15.532 18.18 14.928 18.105 14.736C18.031 14.544 17.775 14.432 17.472 14.382Z" fill="currentColor"/>
                          </svg>
                          <Truck className="w-4 h-4" />
                        </Button>
                      )}
                      
                      {/* Botón de reembolso Webpay */}
                      {pedido.paymentStatus === "paid" && pedido.estado !== "Cancelado" && pedido.estado !== "Entregado" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-blue-600 text-white hover:bg-blue-700"
                          onClick={() => reembolsarPedidoWebpay(pedido.documentId)}
                        >
                          💳 Reembolsar
                        </Button>
                      )}
                      
                      {/* Botón de cancelar simplificado */}
                      {pedido.estado !== "Entregado" && pedido.estado !== "Cancelado" && (
                        <Button size="sm" variant="outline" className="bg-red-600 text-white hover:bg-red-700" 
                          onClick={() => actualizarEstado(pedido.documentId, "Cancelado")}>
                          <span className="text-lg font-bold">×</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      {/* Modal de impresión */}
      <Dialog open={modalImpresionAbierto} onOpenChange={setModalImpresionAbierto}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Comanda de Pedido {pedidoAImprimir?.id}</DialogTitle>
          </DialogHeader>
          
          <div id="comanda-para-imprimir" className="mt-4">
            <style jsx global>{`
              @media print {
                .no-print { 
                  display: none !important; 
                }
                body { 
                  margin: 0;
                  padding: 4mm 3mm;
                  font-size: 10pt;
                }
                @page { size: 58mm auto; margin: 0; }
                * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              }
              .comanda-container {
                font-family: Arial, sans-serif;
                font-size: 12px;
                line-height: 1.2;
                width: 58mm;
                max-width: 58mm;
                margin: 0 auto;
              }
              .comanda-header { text-align: center; }
              .comanda-logo { width: 32mm; height: auto; margin: 4px auto 3px; display: block; }
              .comanda-order-number { 
                font-family: 'Arial Narrow', 'Roboto Condensed', 'Archivo Narrow', sans-serif-condensed, sans-serif;
                font-stretch: condensed;
                font-size: 18px; 
                font-weight: 700; 
                letter-spacing: -0.2px; 
                text-decoration: underline; 
                margin: 2px 0 4px; 
              }
              .comanda-estimada {
                display: flex; align-items: center; justify-content: center; gap: 6px;
                font-size: 13px; font-weight: 700; margin: 4px 0 6px;
              }
              .comanda-clock { width: 14px; height: 14px; display: inline-block; vertical-align: middle; }
              .comanda-pill {
                display: inline-block; background: #fff; color: #000; 
                border: 1.5px solid #000;
                border-radius: 999px; padding: 5px 14px; font-weight: 700; 
                font-size: 13px; letter-spacing: 0.7px; margin: 6px 0 4px;
              }
              .comanda-meta { font-size: 9px; margin: 3px 0; }
              .comanda-payment { font-size: 9px; margin-top: 3px; }
              .comanda-divider { border-top: 1px solid #999; margin: 7px 0; }
              .comanda-items { margin-top: 6px; text-align: center; }
              .comanda-item { margin-bottom: 6px; }
              .comanda-item-name { font-size: 13px; font-weight: 700; text-align: center; }
              .comanda-item-detail { font-size: 12px; text-align: center; }
              .comanda-totals { text-align: center; margin-top: 6px; }
              .comanda-total-row { font-size: 12px; margin: 2px 0; }
              .comanda-total-strong { font-size: 14px; font-weight: 700; }
            `}</style>
            
            <div className="comanda-container">
              <div className="comanda-header">
                {/* 1. Logo tal cual está */}
                <img src="/iconos/logo_negro.png" alt="Palermo Pizzas" className="comanda-logo" />

                {/* Dos líneas de espacio entre el logo y el número/nombre del cliente */}
                <br />
                <br />

                {/* 2. Número de pedido - NOMBRE CLIENTE (subrayado, sin palabra N° Pedido, 15px Arial Narrow Bold) */}
                <div className="comanda-order-number">
                  {(() => {
                    const orderNum = (pedidoAImprimir?.id || '').replace('#', '').trim()
                    const nombre = (pedidoAImprimir?.cliente?.nombre && 
                      pedidoAImprimir.cliente.nombre !== 'Usuario anónimo' && 
                      pedidoAImprimir.cliente.nombre !== 'No especificado' && 
                      pedidoAImprimir.cliente.nombre !== 'No informado')
                      ? pedidoAImprimir.cliente.nombre.toUpperCase().trim()
                      : 'CLIENTE'
                    return `${orderNum} - ${nombre}`
                  })()}
                </div>

                {/* 3. Hora de retiro con pictograma de reloj (sin iniciales p.m./a.m.) */}
                {(() => {
                  const fin = pedidoAImprimir?.tiempoEstimadoFin 
                    ? new Date(pedidoAImprimir.tiempoEstimadoFin)
                    : (pedidoAImprimir?.documentId && tiemposEstimados[pedidoAImprimir.documentId]
                        ? new Date(Date.now() + tiemposEstimados[pedidoAImprimir.documentId] * 60000)
                        : null)
                  if (!fin || isNaN(fin.getTime())) return null
                  const horaLimpia = fin.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })
                    .replace(/\s*(a\.?\s*m\.?|p\.?\s*m\.?|am|pm)/gi, '')
                    .trim()
                  return (
                    <div className="comanda-estimada">
                      <svg className="comanda-clock" viewBox="0 0 20 20" aria-hidden="true">
                        <circle cx="10" cy="10" r="9" stroke="#000" strokeWidth="2" fill="none" />
                        <polyline points="10 5 10 10 13.5 12" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </svg>
                      {horaLimpia}
                    </div>
                  )
                })()}

                {/* 4. Óvalo RETIRO o DELIVERY (fondo blanco, filete negro, palabra en negro) */}
                <div className="comanda-pill">
                  {(pedidoAImprimir?.tipoEntrega === 'Delivery' || Number(pedidoAImprimir?.valorDelivery || 0) > 0) ? 'DELIVERY' : 'RETIRO'}
                </div>

                {/* 5. Fecha y hora cuando se realizó el pedido */}
                <div className="comanda-meta">
                  {pedidoAImprimir?.fechaCreacion}
                </div>

                {/* 6. Medio de pago con el valor en MAYÚSCULAS */}
                <div className="comanda-payment">
                  Medio de pago: {String(pedidoAImprimir?.metodoPago || '').toUpperCase()}
                </div>
              </div>
              
              <div className="comanda-divider"></div>
              
              {/* 7. Productos con inicial del tamaño adelante (ej: F: 1x Pizza 4 Estaciones) */}
              <div className="comanda-items">
                {pedidoAImprimir?.items.map((item, idx) => {
                  const detalles: React.ReactNode[] = []
                  let sizeLetter = item.size ? String(item.size).trim().charAt(0).toUpperCase() : ''
                  if (!sizeLetter) {
                    const match = item.nombre.match(/\((familiar|mediana|personal|grande|f|m|p|g)\)/i)
                    if (match) {
                      sizeLetter = match[1].charAt(0).toUpperCase()
                    }
                  }
                  const nombreSinTamano = item.nombre
                    .replace(/^\s*pizza\s+personalizada\s*$/i, 'Personalizada')
                    .replace(/\s*\((?:familiar|mediana|personal|grande|f|m|p|g)\)\s*$/i, '')
                    .trim()
                  const isDuo = item.pizzaType === 'duo'
                  const half1Variety = item.half1?.variety || item.pizza1 || 'Personalizada'
                  const half2Variety = item.half2?.variety || item.pizza2 || 'Personalizada'
                  const half1Extras = [
                    ...(item.half1?.simpleIngredients || []),
                    ...(item.half1?.premiumIngredients || []),
                  ]
                  const half2Extras = [
                    ...(item.half2?.simpleIngredients || []),
                    ...(item.half2?.premiumIngredients || []),
                  ]
                  const displayName = isDuo ? 'Pizza DUO' : nombreSinTamano

                  if (isDuo) {
                    detalles.push(`Mitad 1: ${half1Variety}`)
                    if (half1Extras.length) {
                      half1Extras.forEach((ex: string) => detalles.push(`+ ${ex}`))
                    }

                    detalles.push('\u00A0')
                    detalles.push(`Mitad 2: ${half2Variety}`)
                    if (half2Extras.length) {
                      half2Extras.forEach((ex: string) => detalles.push(`+ ${ex}`))
                    }

                    const h1Raw = [...(item.half1?.simpleIngredients || []), ...(item.half1?.premiumIngredients || [])]
                    const h2Raw = [...(item.half2?.simpleIngredients || []), ...(item.half2?.premiumIngredients || [])]

                    const rawExtraSimple = (Array.isArray(item.extraSimple) && item.extraSimple.length > 0)
                      ? item.extraSimple
                      : (Array.isArray(item.ingredients) ? item.ingredients.filter((ex: string) => !h1Raw.includes(ex) && !h2Raw.includes(ex)) : [])

                    const rawExtraPremium = (Array.isArray(item.extraPremium) && item.extraPremium.length > 0)
                      ? item.extraPremium
                      : (Array.isArray(item.premiumIngredients) ? item.premiumIngredients.filter((ex: string) => !h1Raw.includes(ex) && !h2Raw.includes(ex)) : [])

                    const todaLaPizzaExtras = [
                      ...rawExtraSimple.map((ex: string) => `+ ${ex}`),
                      ...rawExtraPremium.map((ex: string) => `+ ${ex} (P)`),
                    ]
                    if (todaLaPizzaExtras.length) {
                      detalles.push('\u00A0')
                      detalles.push(`Toda la pizza:`)
                      todaLaPizzaExtras.forEach((ex: string) => detalles.push(ex))
                    }
                  } else {
                    if (item.ingredients && item.ingredients.length) {
                      detalles.push(...item.ingredients.map((i: string) => `+ ${i}`))
                    }
                    if (item.premiumIngredients && item.premiumIngredients.length) {
                      detalles.push(...item.premiumIngredients.map((i: string) => `+ ${i} (P)`))
                    }
                  }

                  if (item.sauces && item.sauces.length) {
                    detalles.push(...item.sauces)
                  }
                  if (item.drinks && item.drinks.length) {
                    detalles.push(...item.drinks)
                  }
                  if (item.extras && item.extras.length) {
                    detalles.push(...item.extras)
                  }
                  if (item.sinOregano) detalles.push('(sin oregano)')
                  if (item.sinQueso) detalles.push('(sin queso)')
                  if (item.sinSalsaTomate) detalles.push('(sin salsa tomate)')
                  
                  {/* 8. Mantener la nota tal cual está */}
                  if (item.comments) {
                    detalles.push(<br key="br1" />)
                    detalles.push(<strong key="note">Nota: {item.comments}</strong>)
                  }

                  return (
                    <div key={idx} className="comanda-item">
                      <div className="comanda-item-name">
                        {sizeLetter ? `${sizeLetter}: ` : ''}{item.cantidad}x {displayName}
                      </div>
                      {detalles.map((detalle, detailIdx) => (
                        <div key={detailIdx} className="comanda-item-detail">
                          {detalle}
                        </div>
                      ))}
                    </div>
                  )
                })}

                {/* 8. Nota general del pedido solo si efectivamente lleva una nota especial */}
                {(() => {
                  const notaEspecial = getSpecialOrderNote(pedidoAImprimir?.notas);
                  if (!notaEspecial) return null;
                  return (
                    <div className="comanda-item" style={{ marginTop: '6px' }}>
                      <div className="comanda-item-detail">
                        <strong>Nota: {notaEspecial}</strong>
                      </div>
                    </div>
                  );
                })()}
              </div>
              
              <div className="comanda-divider"></div>
              
              {/* 9. Mantener subtotal, delivery y total tal cual está */}
              <div className="comanda-totals">
                {(() => {
                  const { subtotal, valorDelivery, descuentos, discountCode, voucherCode, totalConDelivery } = getPedidoMontos(pedidoAImprimir)
                  return (
                    <>
                      <div className="comanda-total-row">
                        SUBTOTAL: {formatCurrency(subtotal)}
                      </div>
                      {valorDelivery > 0 && (
                        <div className="comanda-total-row">
                          DELIVERY: {formatCurrency(valorDelivery)}
                        </div>
                      )}
                      {descuentos > 0 && (
                        <div className="comanda-total-row">
                          DESCUENTO {discountCode ? `(${discountCode})` : voucherCode ? `(${voucherCode})` : '(PROMO)'}: -{formatCurrency(descuentos)}
                        </div>
                      )}
                      <div className="comanda-total-row comanda-total-strong" style={{ marginTop: "4px" }}>
                        TOTAL: {formatCurrency(totalConDelivery)}
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>
          </div>
          
          <div className="flex justify-center mt-6 no-print">
            <Button 
              onClick={confirmarImpresion}
              className="bg-green-600 hover:bg-green-700 text-white mr-2"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Confirmar Impresión
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

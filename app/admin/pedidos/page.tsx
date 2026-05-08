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
    sinOregano?: boolean;
    sinQueso?: boolean;
    sinSalsaTomate?: boolean;
  }>
  total: number
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
  paymentStatus?: "paid" | "pending" | "refunded" | "failed" | null
  webpay?: any
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
  }, [actualizarEstadoOriginal, marcarPedidoAtendido]);

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
            body { margin: 0; padding: 10mm; font-size: 12pt; }
            .comanda-container { width: 100%; max-width: 100%; }
            ul { margin: 2px 0; padding-left: 15px; }
            li { margin-bottom: 1px; }
          }
          body { font-family: Arial, sans-serif; }
          .comanda-title {
            font-size: 20px; text-align: center;
            border-bottom: 1px solid #000; padding-bottom: 10px;
            margin-bottom: 15px;
          }
          .comanda-info { margin-bottom: 5px; }
          .comanda-divider { border-top: 1px dashed #000; margin: 10px 0; }
          .comanda-item {
            margin-bottom: 8px; border-bottom: 1px dotted #ccc;
            padding-bottom: 8px;
          }
          .comanda-total {
            font-size: 16px; font-weight: bold; text-align: right;
            margin-top: 10px; border-top: 1px solid #000; padding-top: 5px;
          }
          .comanda-estado {
            text-align: center; font-size: 16px; margin: 15px 0;
            padding: 5px; border: 1px solid #000;
          }
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
    
    // Calcular valor total a cobrar
    const valorDelivery = pedido.valorDelivery || 0;
    const totalACobrar = pedido.total + valorDelivery;
    
    // Construir el detalle de los productos
    const detalleProductos = pedido.items.map(item => 
      `${item.cantidad}x ${item.nombre}${item.size ? ` (${item.size})` : ''}${
        item.selectedMenuPizza && item.selectedMenuPizza !== 'base' ? `\n   - Base: ${item.selectedMenuPizza}` : ''
      }${
        item.ingredients?.length ? `\n   - Ingredientes: ${item.ingredients.join(', ')}` : ''
      }${
        item.premiumIngredients?.length ? `\n   - Premium: ${item.premiumIngredients.join(', ')}` : ''
      }${
        item.sauces?.length ? `\n   - Salsas: ${item.sauces.join(', ')}` : ''
      }${
        (item.sinOregano || item.sinQueso || item.sinSalsaTomate) ? 
          `\n   ⚠️ PERSONALIZACIÓN: ${[
            item.sinOregano && 'SIN ORÉGANO',
            item.sinQueso && 'SIN QUESO',
            item.sinSalsaTomate && 'SIN SALSA TOMATE'
          ].filter(Boolean).join(', ')}` : ''
      }${
        item.comments ? `\n   - Notas: ${item.comments}` : ''
      }`
    ).join('\n\n');
    
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
${pedido.requiereVuelto ? `*VUELTO PARA:* $${pedido.montoVuelto?.toLocaleString()}` : ''}

*PRODUCTOS:*
${detalleProductos}

*VALOR PEDIDO:* $${pedido.total.toLocaleString()}
*VALOR DELIVERY:* $${valorDelivery.toLocaleString()}
*TOTAL A COBRAR:* $${totalACobrar.toLocaleString()}

${pedido.tiempoEstimadoFin ? `*HORA ESTIMADA DE ENTREGA:* ${new Date(pedido.tiempoEstimadoFin).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` : ''}
${pedido.notas ? `\n*NOTAS ADICIONALES:* ${pedido.notas}` : ''}
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
        
        // Actualizar el estado de pedidos con poco tiempo (solo para visualización)
        setPedidosConPocoTiempo(nuevosPocoTiempo)
        
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
  }, [pedidosConPocoTiempo]);

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
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold dark:text-white">Gestión de Pedidos</h1>
            <p className="text-gray-600 dark:text-gray-300">Administra y actualiza el estado de los pedidos</p>
          </div>
          <div className="flex space-x-2">
            <Search className="w-5 h-5 text-gray-500" />
            <Input placeholder="Buscar por ID o cliente" value={busqueda} onChange={e=>setBusqueda(e.target.value)} className="w-64" />
            <Filter className="w-5 h-5 text-gray-500" />
            {/* Filtro de estado */}
            <div className="flex items-center space-x-2">
              <label htmlFor="filtroEstado" className="sr-only">Filtrar estado</label>
              <select
                id="filtroEstado"
                value={filtroEstado}
                onChange={e => setFiltroEstado(e.target.value)}
                className="border rounded px-2 py-1"
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
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(pedido.estado)}
                    <span className={`px-2 py-0.5 rounded-full text-white ${getStatusColor(pedido.estado)}`}>{pedido.estado}</span>
                    {pedidosNuevosSinAtender.has(pedido.documentId) && (
                      <span className="bg-red-500 text-white px-2 py-0.5 rounded-full text-xs font-bold animate-pulse">
                        ¡NUEVO!
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-lg font-mono font-bold bg-gray-100 dark:bg-gray-800 dark:text-white px-3 py-1 rounded-md">{pedido.id}</div>
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
                <div className="flex items-center space-x-4 text-xs text-gray-600 dark:text-gray-300 mt-1">
                  <Calendar className="w-4 h-4"/><span>{pedido.fechaCreacion}</span>
                  <DollarSign className="w-4 h-4"/><span>{pedido.metodoPago}</span>
                  <Badge variant={pedido.tipoEntrega==='Delivery'?'destructive':'default'}>{pedido.tipoEntrega}</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid md:grid-cols-3 gap-4">
                  {/* Cliente */}
                  <div>
                    <h4 className="font-medium mb-1">Cliente</h4>
                    
                    {/* Información básica del cliente */}
                    <div className="space-y-1 text-sm">
                      <div className="flex items-start">
                        <div className="font-semibold w-20 dark:text-white">Nombre:</div>
                        <div>{pedido.cliente.nombre === 'Usuario anónimo' ? 
                          <span className="text-gray-500 dark:text-gray-400 italic">No especificado</span> : 
                          <span className="dark:text-white">{pedido.cliente.nombre}</span>}
                        </div>
                      </div>
                      <div className="flex items-start">
                        <div className="font-semibold w-20 dark:text-white">Teléfono:</div>
                        <div className="flex items-center dark:text-white">
                          <Phone className="w-4 h-4 mr-1 text-blue-600 dark:text-blue-400"/> 
                          {pedido.cliente.telefono === 'No disponible' ? 
                            <span className="text-gray-500 dark:text-gray-400 italic">No disponible</span> : 
                            pedido.cliente.telefono}
                        </div>
                      </div>
                      {pedido.cliente.email && (
                        <div className="flex items-start">
                          <div className="font-semibold w-20 dark:text-white">Email:</div>
                          <div className="dark:text-white">{pedido.cliente.email}</div>
                        </div>
                      )}
                    </div>
                    
                    {/* Mostrar dirección solo para pedidos de delivery */}
                    {pedido.tipoEntrega === 'Delivery' && pedido.direccion && (
                      <div className="mt-2 text-sm">
                        <div className="font-semibold mb-1 dark:text-white">Dirección de entrega:</div>
                        <div className="dark:text-white"><MapPin className="w-4 h-4 inline mr-1 text-red-500 dark:text-red-400"/> {pedido.direccion.calle} {pedido.direccion.numero}, {pedido.direccion.comuna}</div>
                        {pedido.direccion.referencia && <div className="text-xs mt-1 italic dark:text-gray-300">Ref: {pedido.direccion.referencia}</div>}
                      </div>
                    )}
                    
                    {/* Eliminamos la descripción de "Retiro en local" en color azul */}
                  </div>
                  {/* Productos y montos */}
                  <div>
                    <h4 className="font-medium mb-1 dark:text-white">Productos</h4>
                    <div className="space-y-1 text-sm dark:text-white">
                      {pedido.items.map((i, idx) => (
                        <div key={idx} className="flex justify-between"><span>{i.cantidad}x {i.nombre}</span><span>${i.precio.toLocaleString()}</span></div>
                      ))}
                      <div className="border-t pt-2 font-bold flex justify-between dark:text-white"><span>Total</span><span>${pedido.total.toLocaleString()}</span></div>
                      {pedido.notas && <div className="mt-2 text-xs bg-yellow-50 dark:bg-yellow-900 dark:text-yellow-100 p-1 rounded">Notas: {pedido.notas}</div>}
                    </div>
                  </div>                    {/* Acciones y timers */}
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      {["Entregado", "Cancelado"].includes(pedido.estado) ? (
                        <div className="text-sm text-gray-500 dark:text-gray-400 italic">Pedido finalizado</div>
                      ) : (
                        <>
                          {[15,30,45,60].map(m => (
                            <Button key={m} size="sm" variant={tiemposEstimados[pedido.documentId]===m?'default':'outline'} onClick={()=>establecerTiempoEstimado(pedido.documentId,m)}>
                              {m}m
                            </Button>
                          ))}
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="bg-yellow-600 text-white hover:bg-yellow-700"
                            onClick={() => establecerTiempoEstimado(pedido.documentId, 3.1)}
                            title="Establece 3 minutos y 6 segundos para probar la alarma"
                          >
                            TEST 3m
                          </Button>
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
                              {/* Barra de progreso invertida */}
                              <div className="relative h-12 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden shadow-inner">
                                {/* Barra de progreso que se vacía */}
                                <div 
                                  className={`absolute top-0 left-0 h-full transition-all duration-1000 ease-linear ${
                                    esTiempoCritico 
                                      ? "bg-gradient-to-r from-red-500 to-red-600 animate-pulse" 
                                      : "bg-gradient-to-r from-green-500 to-green-600"
                                  }`}
                                  style={{ width: `${porcentaje}%` }}
                                />
                                {/* Texto del tiempo sobre la barra */}
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <span className={`font-mono text-2xl font-bold z-10 ${
                                    porcentaje > 50 ? 'text-white' : 'text-gray-800 dark:text-gray-200'
                                  }`}>
                                    {formatearTiempo(tiempoRestante)}
                                  </span>
                                </div>
                              </div>
                              {esTiempoCritico && (
                                <div className="text-center text-red-600 dark:text-red-400 font-bold text-sm animate-pulse">
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
                      {/* Fila de botones de acción */}
                    <div className="flex gap-2 items-center justify-between mt-2">
                      {getNextStatus(pedido.estado, pedido.tipoEntrega) && (
                        <Button size="sm" className="flex-1 bg-pink-600 text-white" 
                          onClick={() => {
                            const nuevoEstado = getNextStatus(pedido.estado, pedido.tipoEntrega);
                            if (nuevoEstado) {
                              actualizarEstado(pedido.documentId, nuevoEstado);
                            }
                          }}>
                          {getNextStatusLabel(pedido.estado, pedido.tipoEntrega)}
                        </Button>
                      )}
                      
                      {/* Botón de impresión simplificado */}
                      <Button size="sm" variant="outline" className="bg-green-600 text-white hover:bg-green-700" 
                        onClick={()=>imprimirComanda(pedido)}>
                        <Printer className="w-4 h-4" />
                      </Button>
                      
                      {/* Botón de WhatsApp para pedidos de delivery */}
                      {pedido.tipoEntrega === 'Delivery' && pedido.direccion && (
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
                  padding: 5mm; 
                  font-size: 10pt;
                }
                ul {
                  margin-top: 2px !important;
                  margin-bottom: 2px !important;
                  padding-left: 15px !important;
                }
                li {
                  margin-bottom: 1px !important;
                }
              }
              .comanda-container {
                font-family: Arial, sans-serif;
                font-size: 12px;
                padding: 10px;
                max-width: 100%;
              }
              .comanda-title {
                font-size: 20px;
                text-align: center;
                border-bottom: 1px solid #000;
                padding-bottom: 10px;
                margin-bottom: 15px;
              }
              .comanda-info {
                margin-bottom: 5px;
              }
              .comanda-divider {
                border-top: 1px dashed #000;
                margin: 10px 0;
              }
              .comanda-item {
                margin-bottom: 8px;
                border-bottom: 1px dotted #ccc;
                padding-bottom: 8px;
              }
              .comanda-total {
                font-size: 16px;
                font-weight: bold;
                text-align: right;
                margin-top: 10px;
                border-top: 1px solid #000;
                padding-top: 5px;
              }
              .comanda-estado {
                text-align: center;
                font-size: 16px;
                margin: 15px 0;
                padding: 5px;
                border: 1px solid #000;
              }
              .comanda-detail {
                font-size: 11px;
                margin-left: 15px;
                margin-top: 2px;
              }
            `}</style>
            
            <div className="comanda-container">
              <h1 className="comanda-title">PIZZERÍA PALERMO - COMANDA</h1>
              <div className="comanda-info"><strong>PEDIDO:</strong> {pedidoAImprimir?.id}</div>
              <div className="comanda-info"><strong>FECHA:</strong> {pedidoAImprimir?.fechaCreacion}</div>
              <div className="comanda-info">
                <strong>CLIENTE:</strong> {
                  pedidoAImprimir?.cliente.nombre !== 'Usuario anónimo' 
                    ? pedidoAImprimir?.cliente.nombre 
                    : 'No especificado'
                }
              </div>
              <div className="comanda-info">
                <strong>TELÉFONO:</strong> {
                  pedidoAImprimir?.cliente.telefono !== 'No disponible' 
                    ? pedidoAImprimir?.cliente.telefono 
                    : 'No especificado'
                }
              </div>
              
              {pedidoAImprimir?.tipoEntrega === "Delivery" && pedidoAImprimir?.direccion ? (
                <>
                  <div className="comanda-info">
                    <strong>DIRECCIÓN:</strong> {pedidoAImprimir.direccion.calle} {pedidoAImprimir.direccion.numero}, {pedidoAImprimir.direccion.comuna}
                  </div>
                  {pedidoAImprimir.direccion.referencia && (
                    <div className="comanda-info">
                      <strong>REFERENCIA:</strong> {pedidoAImprimir.direccion.referencia}
                    </div>
                  )}
                </>
              ) : (
                <div className="comanda-info"><strong>RETIRO EN LOCAL</strong></div>
              )}
              
              <div className="comanda-info"><strong>MÉTODO DE PAGO:</strong> {pedidoAImprimir?.metodoPago}</div>
              {pedidoAImprimir?.notas && (
                <div className="comanda-info"><strong>NOTAS:</strong> {pedidoAImprimir.notas}</div>
              )}
              
              <div className="comanda-divider"></div>
              
              <h2 className="text-lg font-semibold mb-2">PRODUCTOS:</h2>
              
              {pedidoAImprimir?.items.map((item, idx) => (
                <div key={idx} className="comanda-item mb-4 pb-2">
                  <div className="flex justify-between mb-1 border-b border-gray-300 pb-1">
                    <span className="font-bold text-base">
                      {item.cantidad}x {item.nombre}
                      {item.size && <span className="ml-1">({item.size})</span>}
                    </span>
                    <span className="font-bold">${item.precio.toLocaleString('es-CL')}</span>
                  </div>
                  
                  {/* Detalles de la pizza */}
                  <div className="ml-4 text-sm">
                    {/* Tipo de pizza */}
                    {item.pizzaType && (
                      <div className="mb-1">
                        <span className="font-semibold">Tipo:</span> {item.pizzaType}
                      </div>
                    )}
                    
                    {/* Pizza base seleccionada (para Premium/Promo) */}
                    {item.selectedMenuPizza && item.selectedMenuPizza !== 'base' && (
                      <div className="mb-1">
                        <span className="font-semibold">🍕 Pizza Base:</span> <span className="font-bold text-blue-600">{item.selectedMenuPizza}</span>
                      </div>
                    )}
                    
                    {/* Ingredientes - con mejor formato */}
                    {item.ingredients && item.ingredients.length > 0 && (
                      <div className="mb-1">
                        <span className="font-semibold">Ingredientes:</span>
                        <ul className="list-disc ml-5 mt-1">
                          {item.ingredients.map((ing, i) => (
                            <li key={i}>{ing}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {/* Ingredientes premium */}
                    {item.premiumIngredients && item.premiumIngredients.length > 0 && (
                      <div className="mb-1">
                        <span className="font-semibold">Ingredientes Premium:</span>
                        <ul className="list-disc ml-5 mt-1">
                          {item.premiumIngredients.map((ing, i) => (
                            <li key={i}>{ing}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {/* Salsas */}
                    {item.sauces && item.sauces.length > 0 && (
                      <div className="mb-1">
                        <span className="font-semibold">Salsas:</span>
                        <ul className="list-disc ml-5 mt-1">
                          {item.sauces.map((sauce, i) => (
                            <li key={i}>{sauce}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {/* Bebidas */}
                    {item.drinks && item.drinks.length > 0 && (
                      <div className="mb-1">
                        <span className="font-semibold">Bebidas:</span>
                        <ul className="list-disc ml-5 mt-1">
                          {item.drinks.map((drink, i) => (
                            <li key={i}>{drink}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {/* Extras */}
                    {item.extras && item.extras.length > 0 && (
                      <div className="mb-1">
                        <span className="font-semibold">Extras:</span>
                        <ul className="list-disc ml-5 mt-1">
                          {item.extras.map((extra, i) => (
                            <li key={i}>{extra}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {/* Personalizaciones - SIN orégano, queso o salsa */}
                    {(item.sinOregano || item.sinQueso || item.sinSalsaTomate) && (
                      <div className="mb-1 mt-2 p-2 bg-yellow-50 border border-yellow-300 rounded">
                        <span className="font-semibold text-yellow-800">⚠️ PERSONALIZACIÓN:</span>
                        <ul className="list-disc ml-5 mt-1 text-yellow-900 font-medium">
                          {item.sinOregano && <li>🚫 SIN ORÉGANO</li>}
                          {item.sinQueso && <li>🚫 SIN QUESO</li>}
                          {item.sinSalsaTomate && <li>🚫 SIN SALSA TOMATE</li>}
                        </ul>
                      </div>
                    )}
                    
                    {/* Comentarios específicos del ítem */}
                    {item.comments && (
                      <div className="mb-1 border-t border-dotted border-gray-300 pt-1 mt-1">
                        <span className="font-semibold">Comentarios:</span> {item.comments}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              <div className="comanda-divider"></div>
              
              <div className="comanda-total">TOTAL: ${pedidoAImprimir?.total.toLocaleString('es-CL')}</div>
              <div className="comanda-estado">ESTADO: {pedidoAImprimir?.estado}</div>
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
            
            <Button 
              onClick={() => {
                if (pedidoAImprimir) {
                  console.log('Estructura completa del pedido:', pedidoAImprimir);
                  alert('Revisa la consola para ver los detalles del pedido');
                }
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Depurar Datos
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

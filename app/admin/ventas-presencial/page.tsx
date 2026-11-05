"use client"

import React, { useState, useEffect, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { useFirestorePizzaConfig } from "@/hooks/useFirestorePizzaConfig"
import { usePizzaBuilderData } from "@/app/armar-pizza-nueva/hooks/usePizzaBuilderData"
import { useCart } from "@/app/context/CartContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Pizza,
  Store,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  DollarSign,
  CreditCard,
  Send,
  Search,
  Check,
  RefreshCw,
  Printer,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  AlertTriangle,
  PackageX,
  Clock,
  ExternalLink,
  Info,
  XCircle,
  Layers,
  Utensils,
  Landmark
} from "lucide-react"
import { useTheme } from "next-themes"
import { mercadoPagoPointService } from "@/lib/mercadopago-point"

// Interfaces para desglose detallado de falta de stock y errores
interface InventoryMissingDetail {
  ingrediente: string
  ingredienteId?: string
  needed?: number
  available?: number
  unidad?: string
}

interface InventoryMissingProduct {
  item: string
  missing: InventoryMissingDetail[]
}

interface SaleErrorState {
  isOpen: boolean
  type: 'inventory' | 'schedule' | 'payment' | 'validation' | 'general'
  title: string
  message: string
  insufficientItems?: InventoryMissingProduct[]
  rawError?: string
  helpSuggestion?: string
}

// Analizador y formateador inteligente de errores de venta/stock
function parseSaleError(err: any, result?: any): SaleErrorState {
  const details = err?.details || err?.customData?.details || result?.validationDetails || result?.details || null
  const rawMsg = err?.message || result?.error || String(err || '')
  const message = rawMsg.toLowerCase()

  // 1. Caso: Fuera de Horario Comercial / Local Cerrado
  if (
    message.includes('horario comercial') || 
    message.includes('fuera de horario') || 
    message.includes('cerrado temporalmente') ||
    message.includes('business_hours')
  ) {
    return {
      isOpen: true,
      type: 'schedule',
      title: 'Local Fuera de Horario o Cerrado',
      message: rawMsg || 'El sistema no permite ingresar pedidos porque el local figura cerrado o fuera del horario comercial.',
      helpSuggestion: 'Si estás en horario de atención presencial, puedes verificar la configuración de Horarios Comerciales en el panel de Ajustes.'
    }
  }

  // 2. Caso: Error de Falta de Stock / Inventario
  if (
    message.includes('inventory_unavailable') || 
    message.includes('stock') || 
    message.includes('inventario') ||
    message.includes('ingrediente') ||
    message.includes('insufficient') ||
    (Array.isArray(details) && details.length > 0)
  ) {
    let parsedItems: InventoryMissingProduct[] = []

    if (Array.isArray(details) && details.length > 0) {
      parsedItems = details.map((d: any) => {
        // Formato estándar: { item: 'Pizza X', missing: [{ ingrediente: 'Queso', needed: 250, available: 0, unidad: 'gr' }] }
        if (d.item && Array.isArray(d.missing)) {
          return {
            item: d.item,
            missing: d.missing.map((m: any) => ({
              ingrediente: m.ingrediente || m.name || 'Ingrediente no especificado',
              ingredienteId: m.ingredienteId || m.id,
              needed: typeof m.needed === 'number' ? m.needed : m.requerido,
              available: typeof m.available === 'number' ? m.available : m.disponible,
              unidad: m.unidad || 'gr'
            }))
          }
        }

        // Formato alternativo con missing plano
        if (d.ingrediente || d.item || d.name) {
          return {
            item: d.item || 'Producto del pedido',
            missing: [{
              ingrediente: d.ingrediente || d.name || d.item || 'Ingrediente',
              ingredienteId: d.ingredienteId || d.id,
              needed: typeof d.needed === 'number' ? d.needed : d.requerido,
              available: typeof d.available === 'number' ? d.available : d.disponible,
              unidad: d.unidad || 'gr'
            }]
          }
        }

        return {
          item: 'Producto del pedido',
          missing: [{
            ingrediente: typeof d === 'string' ? d : JSON.stringify(d),
            unidad: ''
          }]
        }
      })
    }

    return {
      isOpen: true,
      type: 'inventory',
      title: '¡Falta de Stock de Ingredientes / Productos!',
      message: 'No es posible registrar esta venta porque uno o más productos del pedido no cuentan con suficiente stock en cocina.',
      insufficientItems: parsedItems.length > 0 ? parsedItems : undefined,
      rawError: rawMsg !== 'INVENTORY_UNAVAILABLE' ? rawMsg : undefined,
      helpSuggestion: 'Puedes sugerir al cliente cambiar de ingrediente/variedad, retirar el ítem del pedido o ingresar stock en el panel de Inventario si llegó mercadería.'
    }
  }

  // 3. Caso: Error de Pago en Terminal / Point
  if (message.includes('point') || message.includes('mercadopago') || message.includes('terminal') || message.includes('tarjeta')) {
    return {
      isOpen: true,
      type: 'payment',
      title: 'Problema en Terminal de Pago',
      message: rawMsg || 'Ocurrió un inconveniente al comunicarse con la terminal de cobro Point.',
      helpSuggestion: 'Puedes reintentar el cobro en la terminal o seleccionar otro método de pago (Efectivo o Transferencia).'
    }
  }

  // 4. Caso: Error de Validación de Datos
  if (message.includes('invalid-argument') || message.includes('incompleto') || message.includes('no tiene items')) {
    return {
      isOpen: true,
      type: 'validation',
      title: 'Datos del Pedido Incompletos',
      message: rawMsg || 'Por favor verifica que el pedido tenga productos seleccionados.',
      helpSuggestion: 'Revisa los ítems en el carrito antes de confirmar el cobro.'
    }
  }

  // 5. Caso General
  return {
    isOpen: true,
    type: 'general',
    title: 'No se pudo Registrar la Venta',
    message: rawMsg || 'Ha ocurrido un error inesperado al procesar la venta.',
    rawError: rawMsg,
    helpSuggestion: 'Verifica tu conexión y vuelve a intentar.'
  }
}

// Utilidad para obtener la URL de Firebase Storage de forma resiliente
const getStorageUrl = (path: string) => {
  if (!path) return "/placeholder.svg?height=200&width=200";
  if (path.startsWith('http')) return path;

  const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'pizzeria-palermo-17f6d.appspot.com';

  // Interceptar genéricas o placeholders y redirigirlas a la URL real en Storage
  if (path.includes('pizza-premium-bg') ||
    path.includes('pizza-promo-bg') ||
    path.includes('pizza-duo-bg') ||
    path.includes('doble muzza.jpg') ||
    path.includes('doble_muzza.jpg') ||
    path.includes('palermo.jpg')) {
    return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/pizzas%2F1781109313438_doble_muzza.jpg?alt=media`;
  }

  if (path.startsWith('/bebidas/')) {
    const fileName = path.split('/').pop() || '';
    return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/bebidas%2F${encodeURIComponent(fileName)}?alt=media`;
  }
  if (path.startsWith('/acompañamientos/') || path.startsWith('/acompanamientos/')) {
    const fileName = path.split('/').pop() || '';
    return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/acompa%C3%B1amientos%2F${encodeURIComponent(fileName)}?alt=media`;
  }
  if (path.startsWith('/pizzas/')) {
    const fileName = path.split('/').pop() || '';
    return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/pizzas%2F${encodeURIComponent(fileName)}?alt=media`;
  }
  return path;
};

// Mapeo completo de ilustraciones oficiales para botones de ingredientes POS
const INGREDIENT_ICON_MAP: Record<string, string> = {
  // Simples
  'aceituna negra': '/iconos/ingredientes/aceituna_negra.webp',
  'aceituna verde': '/iconos/ingredientes/aceituna_verde.webp',
  'cebolla morada': '/iconos/ingredientes/cebolla_morada.webp',
  'cebolla': '/iconos/ingredientes/cebolla_morada.webp',
  'champiñón': '/iconos/ingredientes/champiñones.webp',
  'champiñon': '/iconos/ingredientes/champiñones.webp',
  'champiñones': '/iconos/ingredientes/champiñones.webp',
  'champinon': '/iconos/ingredientes/champiñones.webp',
  'champinones': '/iconos/ingredientes/champiñones.webp',
  'choclo': '/iconos/ingredientes/choclo.webp',
  'chorizo': '/iconos/ingredientes/chorizo.webp',
  'choricillo': '/iconos/ingredientes/chorizo.webp',
  'jamón': '/iconos/ingredientes/jamon.webp',
  'jamon': '/iconos/ingredientes/jamon.webp',
  'pepperoni': '/iconos/ingredientes/pepperoni.webp',
  'peperoni': '/iconos/ingredientes/pepperoni.webp',
  'pesto de albahaca': '/iconos/ingredientes/pesto.webp',
  'pesto': '/iconos/ingredientes/pesto.webp',
  'pimentón': '/iconos/ingredientes/pimenton.webp',
  'pimenton': '/iconos/ingredientes/pimenton.webp',
  'rúcula': '/iconos/ingredientes/rucula.webp',
  'rucula': '/iconos/ingredientes/rucula.webp',
  'salame': '/iconos/ingredientes/salame.webp',
  'tocino': '/iconos/ingredientes/tocino.webp',
  'tomate': '/iconos/ingredientes/tomate.webp',

  // Premium
  'camarones': '/iconos/ingredientes/camarones.webp',
  'camarón': '/iconos/ingredientes/camarones.webp',
  'camaron': '/iconos/ingredientes/camarones.webp',
  'carne mechada': '/iconos/ingredientes/carne_mechada.webp',
  'mechada': '/iconos/ingredientes/carne_mechada.webp',
  'espárragos': '/iconos/ingredientes/esparragos.webp',
  'esparragos': '/iconos/ingredientes/esparragos.webp',
  'extra queso': '/iconos/ingredientes/extra_queso.webp',
  'doble queso': '/iconos/ingredientes/extra_queso.webp',
  'jamón serrano': '/iconos/ingredientes/jamon_serrano.webp',
  'jamon serrano': '/iconos/ingredientes/jamon_serrano.webp',
  'piña caramelizada': '/iconos/ingredientes/piña.webp',
  'pina caramelizada': '/iconos/ingredientes/piña.webp',
  'piña': '/iconos/ingredientes/piña.webp',
  'pina': '/iconos/ingredientes/piña.webp',
  'pollo bbq': '/iconos/ingredientes/pollo.webp',
  'pollo': '/iconos/ingredientes/pollo.webp',
  'queso azul': '/iconos/ingredientes/queso_azul.webp'
}

function getIngredientIconUrl(name: string): string | null {
  if (!name) return null
  const clean = name.toLowerCase().trim()
  if (INGREDIENT_ICON_MAP[clean]) {
    return INGREDIENT_ICON_MAP[clean]
  }
  const norm = clean.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  for (const [key, path] of Object.entries(INGREDIENT_ICON_MAP)) {
    const keyNorm = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    if (keyNorm === norm || norm.includes(keyNorm) || keyNorm.includes(norm)) {
      return path
    }
  }
  return null
}

// Listado de Bebidas Fijo (Tradicional + Zero) para evitar problemas en base de datos
const BEBIDAS_LIST = [
  { id: 'lipton-lata', nombre: 'Lipton Lata', precio: 1500, imagen: '/bebidas/lipton_lata.jpg' },
  { id: 'lipton-botella', nombre: 'Lipton Botella', precio: 2900, imagen: '/bebidas/lipton_botella.jpg' },
  { id: 'coca-lata-tradicional', nombre: 'Coca Cola Lata 350cc', precio: 1500, imagen: '/bebidas/coca_cola_lata.jpg' },
  { id: 'coca-lata-zero', nombre: 'Coca Cola Zero Lata 350cc', precio: 1500, imagen: '/bebidas/coca_cola_lata_zero.jpg' },
  { id: 'coca-botella-tradicional', nombre: 'Coca Cola 1.5 Litro', precio: 2900, imagen: '/bebidas/coca_cola_1.5_litro.jpg' },
  { id: 'coca-botella-zero', nombre: 'Coca Cola Zero 1.5 Litro', precio: 2900, imagen: '/bebidas/coca_cola_1.5_litro_zero.jpg' }
]

// Estilos de comanda para impresión térmica de 58mm
const PRINT_STYLES = `
  <style>
    @media print {
      @page { size: 58mm auto; margin: 0; }
      body { margin: 0; padding: 4mm 3mm; font-family: Arial, sans-serif; font-size: 12pt; color: #000; }
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
    .text-center { text-align: center; }
  </style>
`

interface POSItem {
  id: string
  name: string
  price: number
  image: string
  quantity: number
  size?: 'mediana' | 'familiar'
  pizzaType?: 'normal' | 'duo' | 'custom'
  selectedMenuPizza?: string | null
  ingredients?: string[]
  premiumIngredients?: string[]
  pizza1?: string
  pizza2?: string
  half1?: {
    baseType: 'menu' | 'custom'
    variety: string | null
    simpleIngredients: string[]
    premiumIngredients: string[]
  }
  half2?: {
    baseType: 'menu' | 'custom'
    variety: string | null
    simpleIngredients: string[]
    premiumIngredients: string[]
  }
  sinOregano?: boolean
  sinQueso?: boolean
  sinSalsaTomate?: boolean
  comments?: string
  extraSimple?: string[]
  extraPremium?: string[]
}

interface AnimatedCartItemProps {
  item: POSItem
  isRemoving: boolean
  onUpdateQty: (id: string, qty: number) => void
  onRemove: (id: string) => void
  isConflicted: boolean
  detailsText: string | null
}

function AnimatedCartItem({
  item,
  isRemoving,
  onUpdateQty,
  onRemove,
  isConflicted,
  detailsText
}: AnimatedCartItemProps) {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setIsMounted(true)
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  const isOpen = isMounted && !isRemoving

  return (
    <div className={`pos-item-accordion ${isOpen ? 'is-open' : ''}`}>
      <div className="pos-item-accordion-inner">
        <div 
          className={`p-2.5 rounded-xl border flex items-start gap-2.5 transition-colors ${
            isConflicted
              ? 'bg-red-950/30 border-red-600/70 ring-1 ring-red-500/40'
              : 'bg-gray-950/60 border-gray-800/80 hover:border-gray-800'
          }`}
        >
          <img 
            src={getStorageUrl(item.image)} 
            alt={item.name}
            className="w-10 h-10 object-cover rounded-md shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <h4 className="font-semibold text-xs text-white truncate">{item.name}</h4>
              {isConflicted && (
                <span className="shrink-0 text-[9px] bg-red-950 text-red-400 border border-red-800/70 px-1 py-0.2 rounded font-bold">
                  Sin Stock
                </span>
              )}
            </div>
            {detailsText && <p className="text-[10px] text-gray-500 line-clamp-2 leading-snug">{detailsText}</p>}
            <div className="flex justify-between items-center mt-1">
              <div className="text-[11px] text-pink-500 font-bold">
                ${(item.price * item.quantity).toLocaleString('es-CL')}
              </div>
              
              <div className="flex items-center gap-1.5 bg-gray-900 border border-gray-800 rounded px-1.5 py-0.5">
                <button 
                  onClick={() => onUpdateQty(item.id, item.quantity - 1)}
                  className="text-gray-400 hover:text-white"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="text-[11px] font-bold text-white px-1">{item.quantity}</span>
                <button 
                  onClick={() => onUpdateQty(item.id, item.quantity + 1)}
                  className="text-gray-400 hover:text-white"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
          <button 
            onClick={() => onRemove(item.id)}
            className="text-gray-600 hover:text-red-500 shrink-0 p-0.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PresentialSalesPage() {
  const router = useRouter()
  const { setTheme } = useTheme()

  // Forzar tema oscuro para coherencia visual con la administración Palermo Dark POS
  useEffect(() => {
    setTheme("dark")
  }, [setTheme])

  // Carga de datos unificada
  const { loading: dataLoading, error: dataError, itemsMenu, ingredients } = useFirestorePizzaConfig()
  const {
    pizzasParaNormal,
    pizzasParaDuo,
    ingredientesSimples,
    ingredientesPremium,
    salsas,
    otrosExtras,
    getPreciosSegunTamano,
    getIngredientPrice,
    getIngredientDisplayName,
  } = usePizzaBuilderData()

  // Estados locales del POS
  const [activeCategory, setActiveCategory] = useState<'pizzas' | 'armar' | 'duo' | 'agregados' | 'bebidas'>('pizzas')
  const [searchTerm, setSearchTerm] = useState('')
  const [cart, setCart] = useState<POSItem[]>([])
  
  // Datos del Cliente (Requerido: Nombre / Mesa)
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [mesaNum, setMesaNum] = useState('')
  const [orderNotes, setOrderNotes] = useState('')
  const [nameError, setNameError] = useState(false)
  const clientNameInputRef = useRef<HTMLInputElement>(null)

  // Modales y configuradores
  const [selectedPizzaForConfig, setSelectedPizzaForConfig] = useState<any | null>(null)
  const [pizzaConfig, setPizzaConfig] = useState<{
    size: 'mediana' | 'familiar'
    simpleIngredients: string[]
    premiumIngredients: string[]
    sinOregano: boolean
    sinQueso: boolean
    sinSalsaTomate: boolean
    comments: string
  }>({
    size: 'familiar',
    simpleIngredients: [],
    premiumIngredients: [],
    sinOregano: false,
    sinQueso: false,
    sinSalsaTomate: false,
    comments: ''
  })

  // Estado para "Armar Pizza"
  const [customPizza, setCustomPizza] = useState<{
    size: 'mediana' | 'familiar'
    simpleIngredients: string[]
    premiumIngredients: string[]
    sinOregano: boolean
    sinQueso: boolean
    sinSalsaTomate: boolean
    comments: string
  }>({
    size: 'familiar',
    simpleIngredients: [],
    premiumIngredients: [],
    sinOregano: false,
    sinQueso: false,
    sinSalsaTomate: false,
    comments: ''
  })

  // Estado para "Pizzas Duo" — cada mitad puede ser variedad del menú O armada con ingredientes
  const [duoPizza, setDuoPizza] = useState<{
    size: 'mediana' | 'familiar'
    half1Type: 'menu' | 'custom'
    half2Type: 'menu' | 'custom'
    pizza1Name: string
    pizza2Name: string
    half1Simple: string[]
    half1Premium: string[]
    half2Simple: string[]
    half2Premium: string[]
    extraSimple: string[]
    extraPremium: string[]
    sinOregano: boolean
    sinQueso: boolean
    sinSalsaTomate: boolean
    comments: string
  }>({
    size: 'familiar',
    half1Type: 'menu',
    half2Type: 'menu',
    pizza1Name: '',
    pizza2Name: '',
    half1Simple: [],
    half1Premium: [],
    half2Simple: [],
    half2Premium: [],
    extraSimple: [],
    extraPremium: [],
    sinOregano: false,
    sinQueso: false,
    sinSalsaTomate: false,
    comments: ''
  })
  const [isDuoExtrasExpanded, setIsDuoExtrasExpanded] = useState(false)

  // Métodos de Pago
  const [paymentMethod, setPaymentMethod] = useState<'Efectivo' | 'Tarjeta' | 'Transferencia' | 'Por Pagar'>('Efectivo')
  const [receivedAmount, setReceivedAmount] = useState('')
  const [transferConfirmed, setTransferConfirmed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Mercado Pago Point Integration
  const [pointIntentId, setPointIntentId] = useState<string | null>(null)
  const [pointStatus, setPointStatus] = useState<'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED' | 'CANCELLED' | null>(null)

  // Resultado de Compra
  const [successOrder, setSuccessOrder] = useState<any | null>(null)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)

  // Estados de Errores y Avisos de Stock para el Cajero
  const [saleError, setSaleError] = useState<SaleErrorState | null>(null)
  const [showInventoryBanner, setShowInventoryBanner] = useState(false)
  const [inventoryConflictItems, setInventoryConflictItems] = useState<string[]>([])
  
  const [deliveryAmount, setDeliveryAmount] = useState<string>('')
  const [discountAmount, setDiscountAmount] = useState<string>('')
  const [removingItemIds, setRemovingItemIds] = useState<string[]>([])

  // Carrito activo (excluye ítems en proceso de animación de salida)
  const activeCart = useMemo(() => {
    return cart.filter(item => !removingItemIds.includes(item.id))
  }, [cart, removingItemIds])

  // Mapeo en tiempo real del estado de ingredientes en Firestore para advertencias visuales
  const ingredientsStockMap = useMemo(() => {
    const map = new Map<string, { stockActual: number; estado: string; disponible: boolean }>()
    if (Array.isArray(ingredients)) {
      ingredients.forEach((ing: any) => {
        const nameKey = (ing.nombre || '').toLowerCase().trim()
        const stock = typeof ing.stockActual === 'number' ? ing.stockActual : 999
        const isAgotado = ing.estado === 'Agotado' || stock <= 0
        map.set(nameKey, {
          stockActual: stock,
          estado: ing.estado || (isAgotado ? 'Agotado' : 'Disponible'),
          disponible: !isAgotado
        })
      })
    }
    return map
  }, [ingredients])

  // Totales
  const subtotal = useMemo(() => {
    return activeCart.reduce((acc, item) => acc + item.price * item.quantity, 0)
  }, [activeCart])
  const discountVal = useMemo(() => {
    const parsed = parseFloat(discountAmount)
    return isNaN(parsed) || parsed < 0 ? 0 : parsed
  }, [discountAmount])
  const deliveryVal = useMemo(() => {
    const parsed = parseFloat(deliveryAmount)
    return isNaN(parsed) || parsed < 0 ? 0 : parsed
  }, [deliveryAmount])
  const total = useMemo(() => {
    return Math.max(0, subtotal - discountVal + deliveryVal)
  }, [subtotal, discountVal, deliveryVal])

  // Vuelto en Efectivo
  const changeAmount = useMemo(() => {
    const r = parseFloat(receivedAmount)
    if (isNaN(r) || r < total) return 0
    return r - total
  }, [receivedAmount, total])

  // Deshabilitar botón de cobro
  const isPaymentDisabled = useMemo(() => {
    if (activeCart.length === 0) return true
    if (isSubmitting) return true
    if (!clientName.trim()) return true

    if (paymentMethod === 'Efectivo') {
      const r = parseFloat(receivedAmount)
      return isNaN(r) || r < total
    }

    return false
  }, [activeCart, isSubmitting, clientName, paymentMethod, receivedAmount, total])

  // Calcular precio total de Pizza Duo en tiempo real
  const calculatedDuoPrice = useMemo(() => {
    const sizePrices = getPreciosSegunTamano(duoPizza.size)

    // Calcular precio de mitad 1
    let price1 = 0
    if (duoPizza.half1Type === 'menu' && duoPizza.pizza1Name) {
      const p1 = pizzasParaDuo.find(p => p.nombre === duoPizza.pizza1Name)
      if (p1) price1 = duoPizza.size === 'mediana' ? p1.precioMediana : p1.precio
    } else if (duoPizza.half1Type === 'custom') {
      price1 = sizePrices.baseCustom
      duoPizza.half1Simple.forEach(ing => { price1 += getIngredientPrice(ing, duoPizza.size, false) })
      duoPizza.half1Premium.forEach(ing => { price1 += getIngredientPrice(ing, duoPizza.size, true) })
    }

    // Calcular precio de mitad 2
    let price2 = 0
    if (duoPizza.half2Type === 'menu' && duoPizza.pizza2Name) {
      const p2 = pizzasParaDuo.find(p => p.nombre === duoPizza.pizza2Name)
      if (p2) price2 = duoPizza.size === 'mediana' ? p2.precioMediana : p2.precio
    } else if (duoPizza.half2Type === 'custom') {
      price2 = sizePrices.baseCustom
      duoPizza.half2Simple.forEach(ing => { price2 += getIngredientPrice(ing, duoPizza.size, false) })
      duoPizza.half2Premium.forEach(ing => { price2 += getIngredientPrice(ing, duoPizza.size, true) })
    }

    // LÓGICA: El valor corresponde al de la mitad más cara
    const baseDuoPrice = Math.max(price1, price2)

    // Sumar ingredientes extra generales (adicionales a toda la pizza)
    let extraCost = 0
    duoPizza.extraSimple.forEach(ing => { extraCost += getIngredientPrice(ing, duoPizza.size, false) })
    duoPizza.extraPremium.forEach(ing => { extraCost += getIngredientPrice(ing, duoPizza.size, true) })

    return baseDuoPrice + extraCost
  }, [duoPizza, pizzasParaDuo, getPreciosSegunTamano, getIngredientPrice])

  // Helper: verificar que al menos ambas mitades estén configuradas
  const isDuoValid = useMemo(() => {
    const half1Ok = duoPizza.half1Type === 'menu' ? !!duoPizza.pizza1Name : (duoPizza.half1Simple.length + duoPizza.half1Premium.length) > 0
    const half2Ok = duoPizza.half2Type === 'menu' ? !!duoPizza.pizza2Name : (duoPizza.half2Simple.length + duoPizza.half2Premium.length) > 0
    return half1Ok && half2Ok
  }, [duoPizza])

  // 1. Agregar Bebida/Acompañamiento rápido
  const handleAddItemFast = (product: any) => {
    const pName = product.nombre || product.name
    const existingIndex = cart.findIndex(c => (c.id === product.id || c.name === pName) && !removingItemIds.includes(c.id))
    if (existingIndex > -1) {
      const newCart = [...cart]
      newCart[existingIndex].quantity += 1
      setCart(newCart)
    } else {
      setCart([...cart, {
        id: `${product.id || 'item'}-${Date.now()}`,
        name: pName,
        price: product.precio,
        image: getStorageUrl(product.imagen || product.image),
        quantity: 1
      }])
    }
  }

  // 2. Modificar cantidades en el pedido
  const handleUpdateQty = (id: string, qty: number) => {
    if (qty <= 0) {
      handleRemoveItem(id)
    } else {
      setCart(cart.map(item => item.id === id ? { ...item, quantity: qty } : item))
    }
  }

  // 3. Quitar item con animación fluida de salida
  const handleRemoveItem = (id: string) => {
    if (removingItemIds.includes(id)) return
    setRemovingItemIds(prev => [...prev, id])
    setTimeout(() => {
      setCart(prev => prev.filter(item => item.id !== id))
      setRemovingItemIds(prev => prev.filter(itemId => itemId !== id))
    }, 320)
  }

  // 4. Configurar Pizza del Menú
  const handleOpenPizzaConfig = (pizza: any) => {
    setSelectedPizzaForConfig(pizza)
    const tieneFamiliar = pizza.disponibleFamiliar !== false
    setPizzaConfig({
      size: tieneFamiliar ? 'familiar' : 'mediana',
      simpleIngredients: [],
      premiumIngredients: [],
      sinOregano: false,
      sinQueso: false,
      sinSalsaTomate: false,
      comments: ''
    })
    setIsDuoExtrasExpanded(false)
  }

  const handleAddConfiguredPizza = () => {
    if (!selectedPizzaForConfig) return

    const size = pizzaConfig.size
    const prices = getPreciosSegunTamano(size)
    const tieneMediana = selectedPizzaForConfig.disponibleMediana !== false && selectedPizzaForConfig.precioMediana > 0
    
    // Precio Base
    let basePrice = (size === 'mediana' && tieneMediana) ? selectedPizzaForConfig.precioMediana : selectedPizzaForConfig.precio
    if (!basePrice) {
      basePrice = prices.baseMenu
    }

    // Precio total unitario de la pizza
    let extraIngredientsCost = 0
    pizzaConfig.simpleIngredients.forEach(ing => { extraIngredientsCost += getIngredientPrice(ing, size, false) })
    pizzaConfig.premiumIngredients.forEach(ing => { extraIngredientsCost += getIngredientPrice(ing, size, true) })
    const itemPrice = basePrice + extraIngredientsCost

    // Resolver imagen de pizza a través de getStorageUrl
    const pizzaImage = getStorageUrl(selectedPizzaForConfig.imagen)

    const item: POSItem = {
      id: `pizza-menu-${Date.now()}`,
      name: `Pizza ${selectedPizzaForConfig.nombre}`,
      price: itemPrice,
      image: pizzaImage,
      quantity: 1,
      size: pizzaConfig.size,
      pizzaType: 'normal',
      selectedMenuPizza: selectedPizzaForConfig.nombre,
      ingredients: pizzaConfig.simpleIngredients,
      premiumIngredients: pizzaConfig.premiumIngredients,
      sinOregano: pizzaConfig.sinOregano,
      sinQueso: pizzaConfig.sinQueso,
      sinSalsaTomate: pizzaConfig.sinSalsaTomate,
      comments: pizzaConfig.comments
    }

    setCart([...cart, item])
    setSelectedPizzaForConfig(null)
  }

  // Toggle Ingredientes en Configuración
  const toggleIngredientConfig = (name: string, isPremium: boolean) => {
    if (isPremium) {
      setPizzaConfig(prev => {
        const ingredients = prev.premiumIngredients.includes(name)
          ? prev.premiumIngredients.filter(i => i !== name)
          : [...prev.premiumIngredients, name]
        return { ...prev, premiumIngredients: ingredients }
      })
    } else {
      setPizzaConfig(prev => {
        const ingredients = prev.simpleIngredients.includes(name)
          ? prev.simpleIngredients.filter(i => i !== name)
          : [...prev.simpleIngredients, name]
        return { ...prev, simpleIngredients: ingredients }
      })
    }
  }

  // 5. Agregar "Armar Pizza" Personalizada
  const handleAddCustomPizza = () => {
    const size = customPizza.size
    const prices = getPreciosSegunTamano(size)
    const basePrice = prices.baseCustom

    let extraCost = 0
    customPizza.simpleIngredients.forEach(ing => { extraCost += getIngredientPrice(ing, size, false) })
    customPizza.premiumIngredients.forEach(ing => { extraCost += getIngredientPrice(ing, size, true) })
    const itemPrice = basePrice + extraCost

    // Usar la URL de Storage correcta para la pizza personalizada a través de getStorageUrl
    const customPizzaImage = getStorageUrl('doble_muzza.jpg')

    const item: POSItem = {
      id: `pizza-custom-${Date.now()}`,
      name: 'Pizza Personalizada',
      price: itemPrice,
      image: customPizzaImage,
      quantity: 1,
      size: customPizza.size,
      pizzaType: 'custom',
      selectedMenuPizza: null,
      ingredients: customPizza.simpleIngredients,
      premiumIngredients: customPizza.premiumIngredients,
      sinOregano: customPizza.sinOregano,
      sinQueso: customPizza.sinQueso,
      sinSalsaTomate: customPizza.sinSalsaTomate,
      comments: customPizza.comments
    }

    setCart([...cart, item])
    
    // Limpiar estado
    setCustomPizza({
      size: 'familiar',
      simpleIngredients: [],
      premiumIngredients: [],
      sinOregano: false,
      sinQueso: false,
      sinSalsaTomate: false,
      comments: ''
    })
    setIsDuoExtrasExpanded(false)
  }

  const toggleIngredientCustom = (name: string, isPremium: boolean) => {
    if (isPremium) {
      setCustomPizza(prev => {
        const ingredients = prev.premiumIngredients.includes(name)
          ? prev.premiumIngredients.filter(i => i !== name)
          : [...prev.premiumIngredients, name]
        return { ...prev, premiumIngredients: ingredients }
      })
    } else {
      setCustomPizza(prev => {
        const ingredients = prev.simpleIngredients.includes(name)
          ? prev.simpleIngredients.filter(i => i !== name)
          : [...prev.simpleIngredients, name]
        return { ...prev, simpleIngredients: ingredients }
      })
    }
  }

  // 6. Agregar "Pizza Duo"
  const handleAddDuoPizza = () => {
    if (!isDuoValid) return

    const duoPizzaImage = getStorageUrl('doble_muzza.jpg')

    const half1Label = duoPizza.half1Type === 'menu' ? duoPizza.pizza1Name : 'Personalizada'
    const half2Label = duoPizza.half2Type === 'menu' ? duoPizza.pizza2Name : 'Personalizada'

    const item: POSItem = {
      id: `pizza-duo-${Date.now()}`,
      name: `Pizza Duo (${half1Label} / ${half2Label})`,
      price: calculatedDuoPrice,
      image: duoPizzaImage,
      quantity: 1,
      size: duoPizza.size,
      pizzaType: 'duo',
      pizza1: half1Label,
      pizza2: half2Label,
      ingredients: duoPizza.extraSimple || [],
      premiumIngredients: duoPizza.extraPremium || [],
      extraSimple: duoPizza.extraSimple || [],
      extraPremium: duoPizza.extraPremium || [],
      half1: {
        baseType: duoPizza.half1Type,
        variety: duoPizza.half1Type === 'menu' ? duoPizza.pizza1Name : null,
        simpleIngredients: duoPizza.half1Simple || [],
        premiumIngredients: duoPizza.half1Premium || []
      },
      half2: {
        baseType: duoPizza.half2Type,
        variety: duoPizza.half2Type === 'menu' ? duoPizza.pizza2Name : null,
        simpleIngredients: duoPizza.half2Simple || [],
        premiumIngredients: duoPizza.half2Premium || []
      },
      sinOregano: duoPizza.sinOregano,
      sinQueso: duoPizza.sinQueso,
      sinSalsaTomate: duoPizza.sinSalsaTomate,
      comments: duoPizza.comments
    }

    setCart([...cart, item])

    setDuoPizza({
      size: 'familiar',
      half1Type: 'menu',
      half2Type: 'menu',
      pizza1Name: '',
      pizza2Name: '',
      half1Simple: [],
      half1Premium: [],
      half2Simple: [],
      half2Premium: [],
      extraSimple: [],
      extraPremium: [],
      sinOregano: false,
      sinQueso: false,
      sinSalsaTomate: false,
      comments: ''
    })
    setIsDuoExtrasExpanded(false)
  }

  // Toggle ingredientes por mitad o extras generales
  const toggleHalfIngredient = (half: 'half1' | 'half2' | 'extra', name: string, isPremium: boolean) => {
    const simpleKey = half === 'half1' ? 'half1Simple' : half === 'half2' ? 'half2Simple' : 'extraSimple'
    const premiumKey = half === 'half1' ? 'half1Premium' : half === 'half2' ? 'half2Premium' : 'extraPremium'
    const key = isPremium ? premiumKey : simpleKey

    setDuoPizza(prev => {
      const arr = prev[key] as string[]
      const updated = arr.includes(name) ? arr.filter(i => i !== name) : [...arr, name]
      return { ...prev, [key]: updated }
    })
  }

  // 7. Simular/Ejecutar integración Mercado Pago Point Smart 2
  const handleStartPointPayment = async () => {
    setPointStatus('PENDING')
    
    const reference = `pos_ref_${Date.now()}`
    const response = await mercadoPagoPointService.createPaymentIntent({
      amount: total,
      description: 'Caja Palermo Pizzas',
      externalReference: reference
    })

    if (response.success) {
      setPointIntentId(response.id)
      setPointStatus('PROCESSING')
      
      if (mercadoPagoPointService.isRealIntegrationEnabled()) {
        const interval = setInterval(async () => {
          const statusRes = await mercadoPagoPointService.getPaymentIntentStatus(response.id)
          if (statusRes.state === 'FINISHED') {
            setPointStatus('PAID')
            clearInterval(interval)
          } else if (statusRes.state === 'ERROR') {
            setPointStatus('FAILED')
            clearInterval(interval)
          } else if (statusRes.state === 'CANCELED') {
            setPointStatus('CANCELLED')
            clearInterval(interval)
          }
        }, 2000)
      }
    } else {
      setPointStatus('FAILED')
      alert(`Error al iniciar cobro en terminal: ${response.error}`)
    }
  }

  const handleCancelPointPayment = async () => {
    if (!pointIntentId) return
    const response = await mercadoPagoPointService.cancelPaymentIntent(pointIntentId)
    if (response.success) {
      setPointStatus('CANCELLED')
    } else {
      alert(`No se pudo cancelar el cobro en terminal: ${response.error}`)
    }
  }

  // Simuladores de Point para QA
  const simularPagoExitoso = () => {
    setPointStatus('PAID')
  }

  const simularPagoFallido = () => {
    setPointStatus('FAILED')
  }

  const simularPagoCancelado = () => {
    setPointStatus('CANCELLED')
  }

  // 8. Crear la Orden (Confirmar Cobro)
  const handleConfirmOrder = async () => {
    if (activeCart.length === 0) return
    if (!clientName.trim()) {
      setNameError(true)
      clientNameInputRef.current?.focus()
      return
    }
    setIsSubmitting(true)

    // Formatear notas solo si hay mesa o nota especial
    const notesArr = [
      mesaNum.trim() ? `[Mesa/Lugar: ${mesaNum.trim()}]` : null,
      orderNotes.trim() ? orderNotes.trim() : null
    ].filter(Boolean)
    const finalNotas = notesArr.length > 0 ? notesArr.join(' | ') : ""

    const payload = {
      customerType: "guest" as const,
      cliente: {
        nombre: clientName || "Venta Caja (Presencial)",
        telefono: clientPhone || "No informado",
        email: "caja-pos@pizzeriapalermo.cl"
      },
      tipoEntrega: "Retiro" as const,
      metodoPago: paymentMethod === 'Por Pagar' ? ('Por Pagar' as const) : (paymentMethod === 'Tarjeta' ? ('Tarjeta' as const) : (paymentMethod === 'Transferencia' ? ('Transferencia' as const) : ('Efectivo' as const))),
      paymentDetails: paymentMethod === 'Efectivo' ? {
        cashAmount: parseFloat(receivedAmount),
        change: changeAmount
      } : undefined,
      notas: finalNotas,
      source: "IN_PERSON",
      orderChannel: "POS",
      paymentStatus: paymentMethod === 'Por Pagar' ? ("pending" as const) : ("paid" as const),
      eraPorPagar: paymentMethod === 'Por Pagar'
    }

    try {
      console.log('Enviando pedido POS a createOrder:', payload)
      
      const { httpsCallable } = await import("firebase/functions")
      const { functions } = await import("@/lib/firebase")
      
      const createOrderFunction = httpsCallable(functions, 'createOrder')
      
      const orderItems = activeCart.map(item => ({
        nombre: item.name,
        cantidad: item.quantity,
        precio: item.price,
        size: item.size,
        ingredients: item.ingredients,
        premiumIngredients: item.premiumIngredients,
        extraSimple: item.extraSimple,
        extraPremium: item.extraPremium,
        pizzaType: item.pizzaType,
        pizza1: item.pizza1,
        pizza2: item.pizza2,
        half1: item.half1,
        half2: item.half2,
        selectedMenuPizza: item.selectedMenuPizza,
        sinOregano: item.sinOregano,
        sinQueso: item.sinQueso,
        sinSalsaTomate: item.sinSalsaTomate,
        comments: item.comments
      }))

      const deliveryFeeVal = parseFloat(deliveryAmount) || 0
      const discountFeeVal = parseFloat(discountAmount) || 0
      const isPosDelivery = deliveryFeeVal > 0

      const payloadToSend = {
        customerType: "guest",
        cliente: payload.cliente,
        tipoEntrega: isPosDelivery ? "Delivery" : payload.tipoEntrega,
        items: orderItems,
        subtotal: subtotal,
        delivery: deliveryFeeVal,
        valorDelivery: deliveryFeeVal,
        deliveryFee: deliveryFeeVal,
        descuento: discountFeeVal,
        discount: discountFeeVal,
        discountAmount: discountFeeVal,
        total: total,
        metodoPago: payload.metodoPago,
        paymentDetails: payload.paymentDetails,
        notas: payload.notas,
        source: "IN_PERSON",
        orderChannel: "POS",
        paymentStatus: payload.paymentStatus,
        eraPorPagar: paymentMethod === 'Por Pagar'
      }

      const functionResponse = await createOrderFunction(payloadToSend)
      const result = functionResponse.data as any

      if (result.success) {
        setSaleError(null)
        setShowInventoryBanner(false)
        setInventoryConflictItems([])
        setSuccessOrder({
          id: result.id,
          orderNumber: result.orderNumber,
          cliente: payload.cliente,
          items: orderItems,
          subtotal: subtotal,
          delivery: deliveryFeeVal,
          descuento: discountFeeVal,
          discountAmount: discountFeeVal,
          total: total,
          metodoPago: paymentMethod,
          notas: finalNotas,
          fecha: new Date().toLocaleDateString('es-CL'),
          hora: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
        })
        setShowSuccessDialog(true)
      } else {
        const parsed = parseSaleError(null, result)
        setSaleError(parsed)
        if (parsed.type === 'inventory') {
          setShowInventoryBanner(true)
          const conflictNames = (parsed.insufficientItems || []).map(i => i.item.toLowerCase().trim())
          setInventoryConflictItems(conflictNames)
        }
      }
    } catch (err: any) {
      console.error('Error al procesar pedido POS:', err)
      const parsed = parseSaleError(err)
      setSaleError(parsed)
      if (parsed.type === 'inventory') {
        setShowInventoryBanner(true)
        const conflictNames = (parsed.insufficientItems || []).map(i => i.item.toLowerCase().trim())
        setInventoryConflictItems(conflictNames)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // Imprimir comanda de 58mm en impresora térmica
  const handlePrintReceipt = () => {
    if (!successOrder) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const itemsHtml = successOrder.items.map((it: any) => {
      let sizeLetter = it.size ? String(it.size).trim().charAt(0).toUpperCase() : ''
      if (!sizeLetter) {
        const match = (it.nombre || '').match(/\((familiar|mediana|personal|grande|f|m|p|g)\)/i)
        if (match) {
          sizeLetter = match[1].charAt(0).toUpperCase()
        }
      }
      const nombreSinTamano = (it.nombre || '')
        .replace(/^\s*pizza\s+personalizada\s*$/i, 'Personalizada')
        .replace(/\s*\((?:familiar|mediana|personal|grande|f|m|p|g)\)\s*$/i, '')
        .trim()

      const isDuo = it.pizzaType === 'duo' || Boolean(it.half1 || it.half2) || (it.nombre && it.nombre.toLowerCase().includes('duo'))

      const half1Extras = [
        ...(it.half1?.simpleIngredients || []).map((i: string) => `+ ${i}`),
        ...(it.half1?.premiumIngredients || []).map((i: string) => `+ ${i} (P)`)
      ]
      const half2Extras = [
        ...(it.half2?.simpleIngredients || []).map((i: string) => `+ ${i}`),
        ...(it.half2?.premiumIngredients || []).map((i: string) => `+ ${i} (P)`)
      ]

      const h1Raw = [...(it.half1?.simpleIngredients || []), ...(it.half1?.premiumIngredients || [])]
      const h2Raw = [...(it.half2?.simpleIngredients || []), ...(it.half2?.premiumIngredients || [])]

      const rawExtraSimple = (Array.isArray(it.extraSimple) && it.extraSimple.length > 0)
        ? it.extraSimple
        : (Array.isArray(it.ingredients) ? it.ingredients.filter((i: string) => !h1Raw.includes(i) && !h2Raw.includes(i)) : [])

      const rawExtraPremium = (Array.isArray(it.extraPremium) && it.extraPremium.length > 0)
        ? it.extraPremium
        : (Array.isArray(it.premiumIngredients) ? it.premiumIngredients.filter((i: string) => !h1Raw.includes(i) && !h2Raw.includes(i)) : [])

      const todaLaPizzaExtras = [
        ...rawExtraSimple.map((i: string) => `+ ${i}`),
        ...rawExtraPremium.map((i: string) => `+ ${i} (P)`)
      ]

      const half1Name = it.half1?.variety || it.pizza1 || 'Personalizada'
      const half2Name = it.half2?.variety || it.pizza2 || 'Personalizada'

      const detailsArray = isDuo ? [
        it.sinOregano ? '(sin oregano)' : null,
        it.sinQueso ? '(sin queso)' : null,
        it.sinSalsaTomate ? '(sin salsa tomate)' : null,
        `Mitad 1: ${half1Name}`,
        ...(half1Extras.length > 0 ? half1Extras : []),
        '&nbsp;',
        `Mitad 2: ${half2Name}`,
        ...(half2Extras.length > 0 ? half2Extras : []),
        ...(todaLaPizzaExtras.length > 0 ? ['&nbsp;', 'Toda la pizza:', ...todaLaPizzaExtras] : [])
      ] : [
        it.sinOregano ? '(sin oregano)' : null,
        it.sinQueso ? '(sin queso)' : null,
        it.sinSalsaTomate ? '(sin salsa tomate)' : null,
        ...(it.ingredients || []).map((i: string) => `+ ${i}`),
        ...(it.premiumIngredients || []).map((i: string) => `+ ${i} (P)`)
      ]

      const detailsJoined = detailsArray.filter(Boolean).map(d => `<div class="comanda-item-detail">${d}</div>`).join('')
      const noteHtml = it.comments ? `<div class="comanda-item-detail"><strong>Nota: ${it.comments}</strong></div>` : ''

      return `
        <div class="comanda-item">
          <div class="comanda-item-name">${sizeLetter ? `${sizeLetter}: ` : ''}${it.cantidad}x ${isDuo ? 'Pizza DUO' : nombreSinTamano}</div>
          ${detailsJoined}
          ${noteHtml}
        </div>
      `
    }).join('')

    const comandaContent = `
      <html>
        <head>
          ${PRINT_STYLES}
        </head>
        <body>
          <div class="comanda-container">
            <div class="comanda-header">
              <!-- 1. Logo tal cual está -->
              <img src="/iconos/logo_negro.png" alt="Palermo Pizzas" class="comanda-logo" />

              <!-- Dos líneas de espacio entre el logo y el número/nombre del cliente -->
              <br />
              <br />

              <!-- 2. Número de pedido - NOMBRE CLIENTE (subrayado, sin "N° Pedido") -->
              <div class="comanda-order-number">
                ${String(successOrder.orderNumber).replace('#', '').trim()} - ${successOrder.cliente?.nombre ? successOrder.cliente.nombre.toUpperCase().trim() : 'CLIENTE'}
              </div>

              <!-- 4. Óvalo RETIRO o DELIVERY (fondo blanco, filete negro, palabra negro) -->
              <div class="comanda-pill">${successOrder.delivery > 0 ? 'DELIVERY' : 'RETIRO'}</div>

              <!-- 5. Fecha y hora cuando se realizó el pedido -->
              <div class="comanda-meta">
                ${successOrder.fecha} ${successOrder.hora}
              </div>

              <!-- 6. Medio de pago con el valor en MAYÚSCULAS -->
              <div class="comanda-payment">
                Medio de pago: ${String(successOrder.metodoPago || '').toUpperCase()}
              </div>
            </div>

            <div class="comanda-divider"></div>

            <!-- 7. Productos con inicial del tamaño adelante (ej: F: 1x Pizza 4 Estaciones) -->
            <div class="comanda-items">
              ${itemsHtml}
              ${(() => {
                const specialNote = typeof successOrder.notas === 'string'
                  ? successOrder.notas.replace(/\[POS\s*-\s*Venta\s+Presencial\]/gi, '').replace(/POS\s*-\s*Venta\s+Presencial/gi, '').trim().replace(/^\|\s*/, '').replace(/\s*\|$/, '').trim()
                  : ''
                return specialNote ? `
                  <div class="comanda-item" style="margin-top: 6px;">
                    <div class="comanda-item-detail">
                      <strong>Nota: ${specialNote}</strong>
                    </div>
                  </div>
                ` : ''
              })()}
            </div>

            <div class="comanda-divider"></div>

            <!-- 9. Mantener subtotal, descuento, delivery y total -->
            <div class="comanda-totals">
              <div class="comanda-total-row">SUBTOTAL: $${(successOrder.subtotal || (successOrder.total + (successOrder.descuento || 0) - successOrder.delivery)).toLocaleString('es-CL')}</div>
              ${(successOrder.descuento && successOrder.descuento > 0) ? `<div class="comanda-total-row font-bold">DESCUENTO: -$${successOrder.descuento.toLocaleString('es-CL')}</div>` : ''}
              ${successOrder.delivery > 0 ? `<div class="comanda-total-row">DELIVERY: $${successOrder.delivery.toLocaleString('es-CL')}</div>` : ''}
              <div class="comanda-total-row comanda-total-strong" style="margin-top: 4px;">TOTAL: $${successOrder.total.toLocaleString('es-CL')}</div>
            </div>
          </div>
        </body>
      </html>
    `

    printWindow.document.write(comandaContent)
    printWindow.document.close()
    
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 250)
  }

  // Reiniciar estado para una nueva venta
  const handleResetPOS = () => {
    setCart([])
    setRemovingItemIds([])
    setClientName('')
    setClientPhone('')
    setDeliveryAmount('')
    setDiscountAmount('')
    setMesaNum('')
    setOrderNotes('')
    setReceivedAmount('')
    setTransferConfirmed(false)
    setPointIntentId(null)
    setPointStatus(null)
    setSuccessOrder(null)
    setShowSuccessDialog(false)
    setSaleError(null)
    setIsDuoExtrasExpanded(false)
    setShowInventoryBanner(false)
    setInventoryConflictItems([])
    setActiveCategory('pizzas')
    setNameError(false)
  }

  // Filtrado de pizzas del menú para grilla central
  const filteredPizzas = useMemo(() => {
    if (!pizzasParaNormal) return []
    return pizzasParaNormal.filter(pizza =>
      (pizza.nombre || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
      (pizza.descripcion || '').toLowerCase().includes((searchTerm || '').toLowerCase())
    )
  }, [pizzasParaNormal, searchTerm])

  if (dataLoading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-gray-400">
        <RefreshCw className="w-12 h-12 animate-spin text-pink-600 mb-4" />
        <p className="text-lg">Cargando menú e inventario de Palermo...</p>
      </div>
    )
  }

  if (dataError) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-red-500 max-w-md mx-auto text-center">
        <AlertCircle className="w-16 h-16 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Error al cargar datos</h2>
        <p className="text-gray-400 mb-4">{dataError.message || 'No se pudo conectar a la base de datos de Palermo.'}</p>
        <Button onClick={handleResetPOS} variant="outline">Reintentar</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full text-gray-100 bg-[#0c1322] min-h-[calc(100vh-5rem)] p-2">
      
      {/* SECCIÓN IZQUIERDA: CATEGORÍAS */}
      <div className="w-full lg:w-48 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0">
        {[
          { id: 'pizzas', label: 'Pizzas', icon: Pizza },
          { id: 'armar', label: 'Armar Pizza', icon: Pizza },
          { id: 'duo', label: 'Pizzas Duo', icon: Pizza },
          { id: 'agregados', label: 'Agregados', icon: Plus },
          { id: 'bebidas', label: 'Bebidas', icon: Store }
        ].map(cat => {
          const Icon = cat.icon
          const isActive = activeCategory === cat.id
          return (
            <Button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as any)}
              className={`flex-1 lg:flex-initial flex items-center justify-start gap-3 py-6 px-4 rounded-xl text-left font-medium transition-all ${
                isActive 
                  ? 'bg-pink-600 hover:bg-pink-700 text-white shadow-lg shadow-pink-900/30'
                  : 'bg-gray-900 hover:bg-gray-800 text-gray-400 border border-gray-800'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span>{cat.label}</span>
            </Button>
          )
        })}
      </div>

      {/* SECCIÓN CENTRAL: PRODUCTOS Y CATÁLOGO */}
      <div className="flex-1 bg-gray-900/60 rounded-2xl border border-gray-800 p-4 flex flex-col gap-4 overflow-y-auto">
        <div className="flex justify-between items-center gap-4">
          <h2 className="text-xl font-bold text-white capitalize">
            {activeCategory === 'pizzas' && 'Pizzas del Menú'}
            {activeCategory === 'armar' && 'ARMAR PIZZA PERSONALIZADA ENTERA'}
            {activeCategory === 'duo' && 'ARMAR PIZZA DUO'}
            {activeCategory === 'agregados' && 'Acompañamientos y Agregados'}
            {activeCategory === 'bebidas' && 'Bebidas'}
          </h2>

          {activeCategory === 'pizzas' && (
            <div className="relative w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Buscar pizza..."
                className="pl-9 bg-gray-950 border-gray-800 text-white"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="flex-1">
          {/* CATEGORÍA: PIZZAS DEL MENÚ */}
          {activeCategory === 'pizzas' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredPizzas.map(pizza => {
                const showsMediana = pizza.disponibleMediana !== false && pizza.precioMediana > 0
                const showsFamiliar = pizza.disponibleFamiliar !== false && pizza.precio > 0

                return (
                  <Card 
                    key={pizza.id} 
                    className="bg-gray-950 border-gray-800 hover:border-pink-600/50 cursor-pointer transition-all duration-200 group overflow-hidden"
                    onClick={() => handleOpenPizzaConfig(pizza)}
                  >
                    <div className="h-40 overflow-hidden relative">
                      <img 
                        src={getStorageUrl(pizza.imagen)} 
                        alt={pizza.nombre}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                        {/* REQUERIMIENTO: Mostrar ambos precios M y F si corresponde */}
                        {showsMediana && (
                          <div className="bg-pink-600 text-white text-base font-bold px-4 py-1.5 rounded shadow-md">
                            M: ${pizza.precioMediana.toLocaleString('es-CL')}
                          </div>
                        )}
                        {showsFamiliar && (
                          <div className="bg-pink-700 text-white text-base font-bold px-4 py-1.5 rounded shadow-md">
                            F: ${pizza.precio.toLocaleString('es-CL')}
                          </div>
                        )}
                      </div>
                    </div>
                    <CardContent className="p-3">
                      <h3 className="font-bold text-white text-base mb-1">{pizza.nombre}</h3>
                      <p className="text-xs text-gray-400 line-clamp-2">{pizza.descripcion || 'Sin descripción'}</p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}

          {/* CATEGORÍA: ARMAR PIZZA */}
          {activeCategory === 'armar' && (
            <div className="bg-[#11141c] border border-gray-800 rounded-2xl p-6 space-y-6 max-w-5xl mx-auto shadow-2xl">
              {/* Selector de tamaño centrado y espacioso */}
              <div className="flex justify-center items-center border-b border-gray-800 pb-5">
                <div className="flex justify-center gap-6 sm:gap-8 w-full max-w-md">
                  {(['mediana', 'familiar'] as const).map(sz => (
                    <Button
                      key={sz}
                      onClick={() => setCustomPizza(prev => ({ ...prev, size: sz }))}
                      className={`flex-1 py-3 px-6 text-sm font-bold tracking-wider uppercase rounded-xl transition-all shadow-md ${
                        customPizza.size === sz
                          ? 'bg-pink-600 hover:bg-pink-500 text-white shadow-pink-900/40 ring-2 ring-pink-500/50'
                          : 'bg-gray-900 text-gray-400 border border-gray-800 hover:bg-gray-800 hover:text-white'
                      }`}
                    >
                      {sz.toUpperCase()}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Personalizaciones */}
              <div className="grid grid-cols-3 gap-4 bg-gray-900/50 p-4 rounded-lg border border-gray-800">
                <label className="flex items-center gap-3 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={customPizza.sinOregano}
                    onChange={e => setCustomPizza(prev => ({ ...prev, sinOregano: e.target.checked }))}
                    className="w-4 h-4 rounded bg-gray-950 border-gray-800 text-pink-600 focus:ring-0"
                  />
                  <span>Sin Orégano</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={customPizza.sinQueso}
                    onChange={e => setCustomPizza(prev => ({ ...prev, sinQueso: e.target.checked }))}
                    className="w-4 h-4 rounded bg-gray-950 border-gray-800 text-pink-600 focus:ring-0"
                  />
                  <span>Sin Queso</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={customPizza.sinSalsaTomate}
                    onChange={e => setCustomPizza(prev => ({ ...prev, sinSalsaTomate: e.target.checked }))}
                    className="w-4 h-4 rounded bg-gray-950 border-gray-800 text-pink-600 focus:ring-0"
                  />
                  <span>Sin Salsa de Tomate</span>
                </label>
              </div>

              {/* Ingredientes Simples */}
              <div className="space-y-3.5">
                <div className="flex items-center justify-between border-b border-gray-800/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-gray-100 uppercase tracking-wider">
                      Ingredientes
                    </h4>
                    <span className="text-[11px] font-medium text-gray-400">
                      (Básicos del menú)
                    </span>
                  </div>
                  <span className="text-sm sm:text-base font-extrabold text-pink-400 bg-pink-950/60 border border-pink-800/70 px-3.5 py-1 rounded-full shadow-sm">
                    +${getPreciosSegunTamano(customPizza.size).simple.toLocaleString('es-CL')} c/u
                  </span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-3">
                  {ingredientesSimples.map(ing => {
                    const stockInfo = ingredientsStockMap.get((ing.nombre || '').toLowerCase().trim())
                    const isAgotado = Boolean(stockInfo && !stockInfo.disponible)
                    const isSelected = customPizza.simpleIngredients.includes(ing.nombre)
                    const iconUrl = getIngredientIconUrl(ing.nombre)

                    return (
                      <button
                        type="button"
                        key={ing.id}
                        disabled={isAgotado}
                        onClick={() => toggleIngredientCustom(ing.nombre, false)}
                        className={`pos-ingredient-card group relative flex flex-col items-center justify-between p-1.5 pt-1.5 pb-1 rounded-2xl overflow-hidden !transition-all !duration-200 select-none text-center h-[116px] sm:h-[122px] ${
                          isAgotado
                            ? '!opacity-35 !grayscale !cursor-not-allowed !border !border-gray-800 !bg-[#151922]'
                            : isSelected
                            ? '!bg-[#2b1424] !border-2 !border-pink-500 !ring-2 !ring-pink-500/50 !shadow-lg !shadow-pink-900/40 is-selected'
                            : '!bg-[#1c202a] !border !border-[#2e3444] hover:!border-gray-400 hover:!bg-[#242936] hover:!shadow-md'
                        }`}
                      >
                        {/* Indicador de Selección con Check */}
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 z-10 w-4 h-4 rounded-full bg-pink-600 text-white flex items-center justify-center shadow-md animate-in zoom-in-75 !duration-150">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}

                        {/* Badge de Agotado */}
                        {isAgotado && (
                          <span className="absolute top-1.5 right-1.5 z-10 text-[8px] font-bold bg-red-950 text-red-400 border border-red-800/80 px-1 py-0.2 rounded shadow">
                            Agotado
                          </span>
                        )}

                        {/* Imagen del Ingrediente */}
                        <div className="w-full flex-1 min-h-0 flex items-center justify-center overflow-hidden px-0.5">
                          {iconUrl ? (
                            <img
                              src={iconUrl}
                              alt={ing.nombre}
                              className="pos-ingredient-img w-full h-full object-contain filter drop-shadow-md"
                              loading="lazy"
                            />
                          ) : (
                            <Pizza className="w-12 h-12 text-gray-500 group-hover:text-pink-400 !transition-colors" />
                          )}
                        </div>

                        {/* Nombre del Ingrediente */}
                        <div className="w-full shrink-0 flex flex-col items-center px-1 pb-0.5 z-10">
                          <span className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider leading-tight line-clamp-1 truncate w-full text-center !transition-colors ${
                            isSelected 
                              ? '!text-pink-200' 
                              : 'text-gray-200 group-hover:text-white'
                          }`}>
                            {ing.nombre.toUpperCase()}
                          </span>
                          {ing.esPrecioEspecial && (
                            <span className="text-[10px] sm:text-[11px] text-pink-400 font-extrabold mt-0.5 leading-none">
                              +${getIngredientPrice(ing, customPizza.size, false).toLocaleString('es-CL')}
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Ingredientes Premium */}
              <div className="space-y-3.5 pt-2">
                <div className="flex items-center justify-between border-b border-amber-900/40 pb-2.5">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm sm:text-base font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                      <span>Ingredientes Premium</span>
                    </h4>
                    <span className="text-[11px] font-medium text-amber-400/80">
                      (Calidad gourmet)
                    </span>
                  </div>
                  <span className="text-sm sm:text-base font-extrabold text-amber-300 bg-amber-950/60 border border-amber-700/70 px-3.5 py-1 rounded-full shadow-sm">
                    +${getPreciosSegunTamano(customPizza.size).premium.toLocaleString('es-CL')} c/u
                  </span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 gap-3">
                  {ingredientesPremium.map(ing => {
                    const stockInfo = ingredientsStockMap.get((ing.nombre || '').toLowerCase().trim())
                    const isAgotado = Boolean(stockInfo && !stockInfo.disponible)
                    const isSelected = customPizza.premiumIngredients.includes(ing.nombre)
                    const iconUrl = getIngredientIconUrl(ing.nombre)

                    return (
                      <button
                        type="button"
                        key={ing.id}
                        disabled={isAgotado}
                        onClick={() => toggleIngredientCustom(ing.nombre, true)}
                        className={`pos-ingredient-card group relative flex flex-col items-center justify-between p-1.5 pt-1.5 pb-1 rounded-2xl overflow-hidden !transition-all !duration-200 select-none text-center h-[116px] sm:h-[122px] ${
                          isAgotado
                            ? '!opacity-35 !grayscale !cursor-not-allowed !border !border-gray-800 !bg-[#151922]'
                            : isSelected
                            ? '!bg-[#2c2211] !border-2 !border-amber-400 !ring-2 !ring-amber-400/60 !shadow-lg !shadow-amber-950/50 is-selected'
                            : '!bg-[#1c202a] !border !border-amber-600/50 hover:!border-amber-400 hover:!bg-[#26241c] hover:!shadow-md hover:!shadow-amber-950/30'
                        }`}
                      >
                        {/* Indicador de Selección con Check Dorado */}
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 z-10 w-4 h-4 rounded-full bg-amber-500 text-black flex items-center justify-center shadow-md animate-in zoom-in-75 !duration-150">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}

                        {/* Badge de Agotado */}
                        {isAgotado && (
                          <span className="absolute top-1.5 right-1.5 z-10 text-[8px] font-bold bg-red-950 text-red-400 border border-red-800/80 px-1 py-0.2 rounded shadow">
                            Agotado
                          </span>
                        )}

                        {/* Imagen del Ingrediente */}
                        <div className="w-full flex-1 min-h-0 flex items-center justify-center overflow-hidden px-0.5">
                          {iconUrl ? (
                            <img
                              src={iconUrl}
                              alt={ing.nombre}
                              className="pos-ingredient-img w-full h-full object-contain filter drop-shadow-md"
                              loading="lazy"
                            />
                          ) : (
                            <Pizza className="w-12 h-12 text-amber-500/70 group-hover:text-amber-400 !transition-colors" />
                          )}
                        </div>

                        {/* Nombre del Ingrediente */}
                        <div className="w-full shrink-0 flex flex-col items-center px-1 pb-0.5 z-10">
                          <span className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider leading-tight line-clamp-1 truncate w-full text-center !transition-colors ${
                            isSelected 
                              ? '!text-amber-200 font-bold' 
                              : 'text-amber-100/90 group-hover:text-amber-300'
                          }`}>
                            {ing.nombre.toUpperCase()}
                          </span>
                          {ing.esPrecioEspecial && (
                            <span className="text-[10px] sm:text-[11px] text-amber-400 font-extrabold mt-0.5 leading-none">
                              +${getIngredientPrice(ing, customPizza.size, true).toLocaleString('es-CL')}
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Comentarios */}
              <div className="space-y-2">
                <label className="text-xs text-gray-400">Instrucciones o notas adicionales para la pizza:</label>
                <Input
                  placeholder="Ej: Masa bien tostada, cortar en 12 trozos..."
                  value={customPizza.comments}
                  onChange={e => setCustomPizza(prev => ({ ...prev, comments: e.target.value }))}
                  className="bg-gray-900 border-gray-800 text-white"
                />
              </div>

              {/* Agregar */}
              <div className="flex justify-between items-center border-t border-gray-800 pt-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-base sm:text-lg font-bold text-gray-300">
                    Total Pizza:
                  </span>
                  <span className="text-2xl sm:text-3xl font-black tracking-tight text-pink-500 drop-shadow-md">
                    ${ (() => {
                      let totalCustom = getPreciosSegunTamano(customPizza.size).baseCustom
                      customPizza.simpleIngredients.forEach(i => { totalCustom += getIngredientPrice(i, customPizza.size, false) })
                      customPizza.premiumIngredients.forEach(i => { totalCustom += getIngredientPrice(i, customPizza.size, true) })
                      return totalCustom.toLocaleString('es-CL')
                    })() }
                  </span>
                </div>
                <Button 
                  onClick={handleAddCustomPizza}
                  className="bg-pink-600 hover:bg-pink-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-lg shadow-pink-900/30 text-sm"
                >
                  Agregar al Pedido
                </Button>
              </div>
            </div>
          )}

          {/* CATEGORÍA: PIZZAS DUO */}
          {activeCategory === 'duo' && (
            <div className="bg-gray-950 border border-gray-800 rounded-xl p-5 sm:p-6 space-y-6 w-full max-w-6xl mx-auto">
              {/* Selector de tamaño centrado y espacioso */}
              <div className="flex justify-center items-center border-b border-gray-800 pb-5">
                <div className="flex justify-center gap-6 sm:gap-8 w-full max-w-md">
                  {(['mediana', 'familiar'] as const).map(sz => (
                    <Button
                      key={sz}
                      onClick={() => setDuoPizza(prev => {
                        const isMediana = sz === 'mediana';
                        const resetH1 = isMediana && (prev.pizza1Name || '').toLowerCase().includes('sevillana');
                        const resetH2 = isMediana && (prev.pizza2Name || '').toLowerCase().includes('sevillana');
                        return { 
                          ...prev, 
                          size: sz, 
                          pizza1Name: resetH1 ? '' : prev.pizza1Name, 
                          pizza2Name: resetH2 ? '' : prev.pizza2Name 
                        };
                      })}
                      className={`flex-1 py-3 px-6 text-sm font-bold tracking-wider uppercase rounded-xl transition-all shadow-md ${
                        duoPizza.size === sz
                          ? 'bg-pink-600 hover:bg-pink-500 text-white shadow-pink-900/40 ring-2 ring-pink-500/50'
                          : 'bg-gray-900 text-gray-400 border border-gray-800 hover:bg-gray-800 hover:text-white'
                      }`}
                    >
                      {sz.toUpperCase()}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Selección de Mitades — cada una puede ser Variedad o Personalizada */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* MITAD 1 */}
                <div className="space-y-3 bg-gray-900/40 p-4 rounded-xl border border-gray-800">
                  <div className="flex items-center justify-between">
                    <span className="text-base sm:text-lg font-black tracking-wide text-pink-500 uppercase drop-shadow-sm">
                      MITAD 1
                    </span>
                    <div className="flex gap-1.5 bg-gray-950 p-1 rounded-xl border border-gray-800 shadow-inner">
                      <button
                        onClick={() => setDuoPizza(prev => ({ ...prev, half1Type: 'menu', half1Simple: [], half1Premium: [] }))}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          duoPizza.half1Type === 'menu'
                            ? 'bg-pink-600 text-white shadow-md shadow-pink-900/30'
                            : 'text-gray-400 hover:text-white hover:bg-gray-900/60'
                        }`}
                      >
                        Variedad
                      </button>
                      <button
                        onClick={() => setDuoPizza(prev => ({ ...prev, half1Type: 'custom', pizza1Name: '' }))}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          duoPizza.half1Type === 'custom'
                            ? 'bg-pink-600 text-white shadow-md shadow-pink-900/30'
                            : 'text-gray-400 hover:text-white hover:bg-gray-900/60'
                        }`}
                      >
                        Armar
                      </button>
                    </div>
                  </div>

                  {duoPizza.half1Type === 'menu' ? (
                    /* Grid de botones tipo card para seleccionar variedad de pizza */
                    <div className="pos-half-mode-enter space-y-2">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">
                        Selecciona la variedad
                      </p>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {pizzasParaDuo
                          .filter(p => duoPizza.size === 'familiar' || !(p.nombre || '').toLowerCase().includes('sevillana'))
                          .slice()
                          .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''))
                          .map(p => {
                            const isSelected = duoPizza.pizza1Name === p.nombre
                            const imgUrl = getStorageUrl(p.imagen)
                            const precio = duoPizza.size === 'mediana' ? p.precioMediana : p.precio
                            return (
                              <button
                                type="button"
                                key={`half1-var-${p.id}`}
                                onClick={() => setDuoPizza(prev => ({ ...prev, pizza1Name: p.nombre }))}
                                className={`pos-pizza-card group flex flex-col items-center justify-between p-0 !transition-all !duration-200 select-none text-center h-[108px] sm:h-[114px] ${
                                  isSelected
                                    ? '!bg-[#2b1424] !border-2 !border-pink-500 !ring-2 !ring-pink-500/50 !shadow-lg !shadow-pink-900/40 is-selected'
                                    : '!bg-[#1c202a] !border !border-[#2e3444] hover:!border-pink-400/60 hover:!bg-[#242936] hover:!shadow-md'
                                }`}
                              >
                                {/* Check de selección */}
                                {isSelected && (
                                  <div className="absolute top-1.5 right-1.5 z-10 w-4 h-4 rounded-full bg-pink-600 text-white flex items-center justify-center shadow-md animate-in zoom-in-75 !duration-150">
                                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                                  </div>
                                )}

                                {/* Imagen de la pizza — recortada y centrada */}
                                <div className="w-full flex-1 min-h-0 overflow-hidden rounded-t-2xl">
                                  <img
                                    src={imgUrl}
                                    alt={p.nombre}
                                    className="pos-pizza-img"
                                    loading="lazy"
                                    onError={(e) => {
                                      (e.currentTarget as HTMLImageElement).src = '/placeholder.svg?height=100&width=100'
                                    }}
                                  />
                                </div>

                                {/* Nombre y precio */}
                                <div className="w-full shrink-0 flex flex-col items-center px-1 pb-0.5 pt-0.5 z-10">
                                  <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider leading-tight line-clamp-2 w-full text-center !transition-colors ${
                                    isSelected ? '!text-pink-200' : 'text-gray-200 group-hover:text-white'
                                  }`}>
                                    {p.nombre.toUpperCase()}
                                  </span>
                                  <span className={`text-[8px] font-semibold mt-0.5 leading-none ${
                                    isSelected ? '!text-pink-300' : 'text-gray-500 group-hover:text-pink-400'
                                  }`}>
                                    ${precio.toLocaleString('es-CL')}
                                  </span>
                                </div>
                              </button>
                            )
                          })}
                      </div>
                    </div>
                  ) : (
                    <div className="pos-half-mode-enter space-y-4">
                      {/* Simples Mitad 1 */}
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between border-b border-gray-800 pb-1.5">
                          <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                            Ingredientes Simples
                          </span>
                          <span className="text-sm sm:text-base font-extrabold text-pink-400 bg-pink-950/60 border border-pink-800/70 px-3 py-0.5 rounded-full shadow-sm">
                            +${getPreciosSegunTamano(duoPizza.size).simple.toLocaleString('es-CL')} c/u
                          </span>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {ingredientesSimples.map(ing => {
                            const stockInfo = ingredientsStockMap.get((ing.nombre || '').toLowerCase().trim())
                            const isAgotado = Boolean(stockInfo && !stockInfo.disponible)
                            const isSelected = duoPizza.half1Simple.includes(ing.nombre)
                            const iconUrl = getIngredientIconUrl(ing.nombre)

                            return (
                              <button
                                type="button"
                                key={`h1-s-${ing.id}`}
                                disabled={isAgotado}
                                onClick={() => toggleHalfIngredient('half1', ing.nombre, false)}
                                className={`pos-ingredient-card group relative flex flex-col items-center justify-between p-1.5 pt-1.5 pb-1 rounded-2xl overflow-hidden !transition-all !duration-200 select-none text-center h-[106px] sm:h-[112px] ${
                                  isAgotado
                                    ? '!opacity-35 !grayscale !cursor-not-allowed !border !border-gray-800 !bg-[#151922]'
                                    : isSelected
                                    ? '!bg-[#2b1424] !border-2 !border-pink-500 !ring-2 !ring-pink-500/50 !shadow-lg !shadow-pink-900/40 is-selected'
                                    : '!bg-[#1c202a] !border !border-[#2e3444] hover:!border-gray-400 hover:!bg-[#242936] hover:!shadow-md'
                                }`}
                              >
                                {isSelected && (
                                  <div className="absolute top-1.5 right-1.5 z-10 w-4 h-4 rounded-full bg-pink-600 text-white flex items-center justify-center shadow-md animate-in zoom-in-75 !duration-150">
                                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                                  </div>
                                )}
                                {isAgotado && (
                                  <span className="absolute top-1.5 right-1.5 z-10 text-[8px] font-bold bg-red-950 text-red-400 border border-red-800/80 px-1 py-0.2 rounded shadow">
                                    Agotado
                                  </span>
                                )}
                                <div className="w-full flex-1 min-h-0 flex items-center justify-center overflow-hidden px-0.5">
                                  {iconUrl ? (
                                    <img
                                      src={iconUrl}
                                      alt={ing.nombre}
                                      className="pos-ingredient-img w-full h-full object-contain filter drop-shadow-md"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <Pizza className="w-10 h-10 text-gray-500 group-hover:text-pink-400 !transition-colors" />
                                  )}
                                </div>
                                <div className="w-full shrink-0 flex flex-col items-center px-0.5 pb-0.5 z-10">
                                  <span className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider leading-tight line-clamp-1 truncate w-full text-center !transition-colors ${
                                    isSelected ? '!text-pink-200' : 'text-gray-200 group-hover:text-white'
                                  }`}>
                                    {ing.nombre.toUpperCase()}
                                  </span>
                                  {ing.esPrecioEspecial && (
                                    <span className="text-[9px] text-pink-400 font-bold mt-0.5 leading-none">
                                      +${getIngredientPrice(ing, duoPizza.size, false).toLocaleString('es-CL')}
                                    </span>
                                  )}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Premium Mitad 1 */}
                      <div className="space-y-2.5 pt-2">
                        <div className="flex items-center justify-between border-b border-amber-900/40 pb-1.5">
                          <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                            Ingredientes Premium
                          </span>
                          <span className="text-sm sm:text-base font-extrabold text-amber-300 bg-amber-950/60 border border-amber-700/70 px-3 py-0.5 rounded-full shadow-sm">
                            +${getPreciosSegunTamano(duoPizza.size).premium.toLocaleString('es-CL')} c/u
                          </span>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {ingredientesPremium.map(ing => {
                            const stockInfo = ingredientsStockMap.get((ing.nombre || '').toLowerCase().trim())
                            const isAgotado = Boolean(stockInfo && !stockInfo.disponible)
                            const isSelected = duoPizza.half1Premium.includes(ing.nombre)
                            const iconUrl = getIngredientIconUrl(ing.nombre)

                            return (
                              <button
                                type="button"
                                key={`h1-p-${ing.id}`}
                                disabled={isAgotado}
                                onClick={() => toggleHalfIngredient('half1', ing.nombre, true)}
                                className={`pos-ingredient-card group relative flex flex-col items-center justify-between p-1.5 pt-1.5 pb-1 rounded-2xl overflow-hidden !transition-all !duration-200 select-none text-center h-[106px] sm:h-[112px] ${
                                  isAgotado
                                    ? '!opacity-35 !grayscale !cursor-not-allowed !border !border-gray-800 !bg-[#151922]'
                                    : isSelected
                                    ? '!bg-[#2c2211] !border-2 !border-amber-400 !ring-2 !ring-amber-400/60 !shadow-lg !shadow-amber-950/50 is-selected'
                                    : '!bg-[#1c202a] !border !border-amber-600/50 hover:!border-amber-400 hover:!bg-[#26241c] hover:!shadow-md hover:!shadow-amber-950/30'
                                }`}
                              >
                                {isSelected && (
                                  <div className="absolute top-1.5 right-1.5 z-10 w-4 h-4 rounded-full bg-amber-500 text-black flex items-center justify-center shadow-md animate-in zoom-in-75 !duration-150">
                                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                                  </div>
                                )}
                                {isAgotado && (
                                  <span className="absolute top-1.5 right-1.5 z-10 text-[8px] font-bold bg-red-950 text-red-400 border border-red-800/80 px-1 py-0.2 rounded shadow">
                                    Agotado
                                  </span>
                                )}
                                <div className="w-full flex-1 min-h-0 flex items-center justify-center overflow-hidden px-0.5">
                                  {iconUrl ? (
                                    <img
                                      src={iconUrl}
                                      alt={ing.nombre}
                                      className="pos-ingredient-img w-full h-full object-contain filter drop-shadow-md"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <Pizza className="w-10 h-10 text-amber-500/70 group-hover:text-amber-400 !transition-colors" />
                                  )}
                                </div>
                                <div className="w-full shrink-0 flex flex-col items-center px-0.5 pb-0.5 z-10">
                                  <span className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider leading-tight line-clamp-1 truncate w-full text-center !transition-colors ${
                                    isSelected ? '!text-amber-200 font-bold' : 'text-amber-100/90 group-hover:text-amber-300'
                                  }`}>
                                    {ing.nombre.toUpperCase()}
                                  </span>
                                  {ing.esPrecioEspecial && (
                                    <span className="text-[9px] text-amber-400 font-bold mt-0.5 leading-none">
                                      +${getIngredientPrice(ing, duoPizza.size, true).toLocaleString('es-CL')}
                                    </span>
                                  )}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* MITAD 2 */}
                <div className="space-y-3 bg-gray-900/40 p-4 rounded-xl border border-gray-800">
                  <div className="flex items-center justify-between">
                    <span className="text-base sm:text-lg font-black tracking-wide text-pink-500 uppercase drop-shadow-sm">
                      MITAD 2
                    </span>
                    <div className="flex gap-1.5 bg-gray-950 p-1 rounded-xl border border-gray-800 shadow-inner">
                      <button
                        onClick={() => setDuoPizza(prev => ({ ...prev, half2Type: 'menu', half2Simple: [], half2Premium: [] }))}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          duoPizza.half2Type === 'menu'
                            ? 'bg-pink-600 text-white shadow-md shadow-pink-900/30'
                            : 'text-gray-400 hover:text-white hover:bg-gray-900/60'
                        }`}
                      >
                        Variedad
                      </button>
                      <button
                        onClick={() => setDuoPizza(prev => ({ ...prev, half2Type: 'custom', pizza2Name: '' }))}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          duoPizza.half2Type === 'custom'
                            ? 'bg-pink-600 text-white shadow-md shadow-pink-900/30'
                            : 'text-gray-400 hover:text-white hover:bg-gray-900/60'
                        }`}
                      >
                        Armar
                      </button>
                    </div>
                  </div>

                  {duoPizza.half2Type === 'menu' ? (
                    /* Grid de botones tipo card para seleccionar variedad de pizza */
                    <div className="pos-half-mode-enter space-y-2">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">
                        Selecciona la variedad
                      </p>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {pizzasParaDuo
                          .filter(p => duoPizza.size === 'familiar' || !(p.nombre || '').toLowerCase().includes('sevillana'))
                          .slice()
                          .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''))
                          .map(p => {
                            const isSelected = duoPizza.pizza2Name === p.nombre
                            const imgUrl = getStorageUrl(p.imagen)
                            const precio = duoPizza.size === 'mediana' ? p.precioMediana : p.precio
                            return (
                              <button
                                type="button"
                                key={`half2-var-${p.id}`}
                                onClick={() => setDuoPizza(prev => ({ ...prev, pizza2Name: p.nombre }))}
                                className={`pos-pizza-card group flex flex-col items-center justify-between p-0 !transition-all !duration-200 select-none text-center h-[108px] sm:h-[114px] ${
                                  isSelected
                                    ? '!bg-[#2b1424] !border-2 !border-pink-500 !ring-2 !ring-pink-500/50 !shadow-lg !shadow-pink-900/40 is-selected'
                                    : '!bg-[#1c202a] !border !border-[#2e3444] hover:!border-pink-400/60 hover:!bg-[#242936] hover:!shadow-md'
                                }`}
                              >
                                {/* Check de selección */}
                                {isSelected && (
                                  <div className="absolute top-1.5 right-1.5 z-10 w-4 h-4 rounded-full bg-pink-600 text-white flex items-center justify-center shadow-md animate-in zoom-in-75 !duration-150">
                                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                                  </div>
                                )}

                                {/* Imagen de la pizza — recortada y centrada */}
                                <div className="w-full flex-1 min-h-0 overflow-hidden rounded-t-2xl">
                                  <img
                                    src={imgUrl}
                                    alt={p.nombre}
                                    className="pos-pizza-img"
                                    loading="lazy"
                                    onError={(e) => {
                                      (e.currentTarget as HTMLImageElement).src = '/placeholder.svg?height=100&width=100'
                                    }}
                                  />
                                </div>

                                {/* Nombre y precio */}
                                <div className="w-full shrink-0 flex flex-col items-center px-1 pb-0.5 pt-0.5 z-10">
                                  <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider leading-tight line-clamp-2 w-full text-center !transition-colors ${
                                    isSelected ? '!text-pink-200' : 'text-gray-200 group-hover:text-white'
                                  }`}>
                                    {p.nombre.toUpperCase()}
                                  </span>
                                  <span className={`text-[8px] font-semibold mt-0.5 leading-none ${
                                    isSelected ? '!text-pink-300' : 'text-gray-500 group-hover:text-pink-400'
                                  }`}>
                                    ${precio.toLocaleString('es-CL')}
                                  </span>
                                </div>
                              </button>
                            )
                          })}
                      </div>
                    </div>
                  ) : (
                    <div className="pos-half-mode-enter space-y-4">
                      {/* Simples Mitad 2 */}
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between border-b border-gray-800 pb-1.5">
                          <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                            Ingredientes Simples
                          </span>
                          <span className="text-sm sm:text-base font-extrabold text-pink-400 bg-pink-950/60 border border-pink-800/70 px-3 py-0.5 rounded-full shadow-sm">
                            +${getPreciosSegunTamano(duoPizza.size).simple.toLocaleString('es-CL')} c/u
                          </span>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {ingredientesSimples.map(ing => {
                            const stockInfo = ingredientsStockMap.get((ing.nombre || '').toLowerCase().trim())
                            const isAgotado = Boolean(stockInfo && !stockInfo.disponible)
                            const isSelected = duoPizza.half2Simple.includes(ing.nombre)
                            const iconUrl = getIngredientIconUrl(ing.nombre)

                            return (
                              <button
                                type="button"
                                key={`h2-s-${ing.id}`}
                                disabled={isAgotado}
                                onClick={() => toggleHalfIngredient('half2', ing.nombre, false)}
                                className={`pos-ingredient-card group relative flex flex-col items-center justify-between p-1.5 pt-1.5 pb-1 rounded-2xl overflow-hidden !transition-all !duration-200 select-none text-center h-[106px] sm:h-[112px] ${
                                  isAgotado
                                    ? '!opacity-35 !grayscale !cursor-not-allowed !border !border-gray-800 !bg-[#151922]'
                                    : isSelected
                                    ? '!bg-[#2b1424] !border-2 !border-pink-500 !ring-2 !ring-pink-500/50 !shadow-lg !shadow-pink-900/40 is-selected'
                                    : '!bg-[#1c202a] !border !border-[#2e3444] hover:!border-gray-400 hover:!bg-[#242936] hover:!shadow-md'
                                }`}
                              >
                                {isSelected && (
                                  <div className="absolute top-1.5 right-1.5 z-10 w-4 h-4 rounded-full bg-pink-600 text-white flex items-center justify-center shadow-md animate-in zoom-in-75 !duration-150">
                                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                                  </div>
                                )}
                                {isAgotado && (
                                  <span className="absolute top-1.5 right-1.5 z-10 text-[8px] font-bold bg-red-950 text-red-400 border border-red-800/80 px-1 py-0.2 rounded shadow">
                                    Agotado
                                  </span>
                                )}
                                <div className="w-full flex-1 min-h-0 flex items-center justify-center overflow-hidden px-0.5">
                                  {iconUrl ? (
                                    <img
                                      src={iconUrl}
                                      alt={ing.nombre}
                                      className="pos-ingredient-img w-full h-full object-contain filter drop-shadow-md"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <Pizza className="w-10 h-10 text-gray-500 group-hover:text-pink-400 !transition-colors" />
                                  )}
                                </div>
                                <div className="w-full shrink-0 flex flex-col items-center px-0.5 pb-0.5 z-10">
                                  <span className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider leading-tight line-clamp-1 truncate w-full text-center !transition-colors ${
                                    isSelected ? '!text-pink-200' : 'text-gray-200 group-hover:text-white'
                                  }`}>
                                    {ing.nombre.toUpperCase()}
                                  </span>
                                  {ing.esPrecioEspecial && (
                                    <span className="text-[9px] text-pink-400 font-bold mt-0.5 leading-none">
                                      +${getIngredientPrice(ing, duoPizza.size, false).toLocaleString('es-CL')}
                                    </span>
                                  )}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Premium Mitad 2 */}
                      <div className="space-y-2.5 pt-2">
                        <div className="flex items-center justify-between border-b border-amber-900/40 pb-1.5">
                          <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                            Ingredientes Premium
                          </span>
                          <span className="text-sm sm:text-base font-extrabold text-amber-300 bg-amber-950/60 border border-amber-700/70 px-3 py-0.5 rounded-full shadow-sm">
                            +${getPreciosSegunTamano(duoPizza.size).premium.toLocaleString('es-CL')} c/u
                          </span>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {ingredientesPremium.map(ing => {
                            const stockInfo = ingredientsStockMap.get((ing.nombre || '').toLowerCase().trim())
                            const isAgotado = Boolean(stockInfo && !stockInfo.disponible)
                            const isSelected = duoPizza.half2Premium.includes(ing.nombre)
                            const iconUrl = getIngredientIconUrl(ing.nombre)

                            return (
                              <button
                                type="button"
                                key={`h2-p-${ing.id}`}
                                disabled={isAgotado}
                                onClick={() => toggleHalfIngredient('half2', ing.nombre, true)}
                                className={`pos-ingredient-card group relative flex flex-col items-center justify-between p-1.5 pt-1.5 pb-1 rounded-2xl overflow-hidden !transition-all !duration-200 select-none text-center h-[106px] sm:h-[112px] ${
                                  isAgotado
                                    ? '!opacity-35 !grayscale !cursor-not-allowed !border !border-gray-800 !bg-[#151922]'
                                    : isSelected
                                    ? '!bg-[#2c2211] !border-2 !border-amber-400 !ring-2 !ring-amber-400/60 !shadow-lg !shadow-amber-950/50 is-selected'
                                    : '!bg-[#1c202a] !border !border-amber-600/50 hover:!border-amber-400 hover:!bg-[#26241c] hover:!shadow-md hover:!shadow-amber-950/30'
                                }`}
                              >
                                {isSelected && (
                                  <div className="absolute top-1.5 right-1.5 z-10 w-4 h-4 rounded-full bg-amber-500 text-black flex items-center justify-center shadow-md animate-in zoom-in-75 !duration-150">
                                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                                  </div>
                                )}
                                {isAgotado && (
                                  <span className="absolute top-1.5 right-1.5 z-10 text-[8px] font-bold bg-red-950 text-red-400 border border-red-800/80 px-1 py-0.2 rounded shadow">
                                    Agotado
                                  </span>
                                )}
                                <div className="w-full flex-1 min-h-0 flex items-center justify-center overflow-hidden px-0.5">
                                  {iconUrl ? (
                                    <img
                                      src={iconUrl}
                                      alt={ing.nombre}
                                      className="pos-ingredient-img w-full h-full object-contain filter drop-shadow-md"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <Pizza className="w-10 h-10 text-amber-500/70 group-hover:text-amber-400 !transition-colors" />
                                  )}
                                </div>
                                <div className="w-full shrink-0 flex flex-col items-center px-0.5 pb-0.5 z-10">
                                  <span className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider leading-tight line-clamp-1 truncate w-full text-center !transition-colors ${
                                    isSelected ? '!text-amber-200 font-bold' : 'text-amber-100/90 group-hover:text-amber-300'
                                  }`}>
                                    {ing.nombre.toUpperCase()}
                                  </span>
                                  {ing.esPrecioEspecial && (
                                    <span className="text-[9px] text-amber-400 font-bold mt-0.5 leading-none">
                                      +${getIngredientPrice(ing, duoPizza.size, true).toLocaleString('es-CL')}
                                    </span>
                                  )}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Ingredientes Extra Generales (para toda la pizza) - Acordeón Desplegable */}
              <div className="space-y-4 pt-2 border-t border-gray-800/80">
                <button
                  type="button"
                  onClick={() => setIsDuoExtrasExpanded(prev => !prev)}
                  className="w-full flex items-center gap-3 p-3 sm:p-3.5 rounded-xl bg-gray-900/60 hover:bg-gray-900 border border-gray-800 hover:border-gray-700 transition-all text-left group select-none cursor-pointer"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                    (duoPizza.extraSimple.length + duoPizza.extraPremium.length) > 0 
                      ? 'bg-pink-600 text-white shadow-md shadow-pink-900/40' 
                      : 'bg-gray-800 text-gray-400 group-hover:text-white'
                  }`}>
                    <Plus className={`w-4 h-4 transition-transform duration-200 ${isDuoExtrasExpanded ? 'rotate-45' : ''}`} />
                  </div>

                  <div className="flex items-center gap-2.5 flex-wrap min-w-0 flex-1">
                    <span className="text-sm font-bold text-white uppercase tracking-wider">
                      INGREDIENTES EXTRA PARA TODA LA PIZZA
                    </span>
                    {(duoPizza.extraSimple.length + duoPizza.extraPremium.length) > 0 && (
                      <span className="text-[11px] font-bold bg-pink-900/80 text-pink-300 border border-pink-700/60 px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                        <Check className="w-3 h-3 stroke-[3]" />
                        {duoPizza.extraSimple.length + duoPizza.extraPremium.length} seleccionado{(duoPizza.extraSimple.length + duoPizza.extraPremium.length) > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </button>

                {/* Contenido desplegable con animaciones fluidas */}
                <div className={`pos-duo-accordion ${isDuoExtrasExpanded ? 'is-open' : ''}`}>
                  <div className="pos-duo-accordion-inner">
                    <div className="space-y-4 pt-1">
                    {/* Extras Simples */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between border-b border-gray-800 pb-1.5">
                        <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                          Extras Simples
                        </span>
                        <span className="text-sm sm:text-base font-extrabold text-pink-400 bg-pink-950/60 border border-pink-800/70 px-3 py-0.5 rounded-full shadow-sm">
                          +${getPreciosSegunTamano(duoPizza.size).simple.toLocaleString('es-CL')} c/u
                        </span>
                      </div>

                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-2.5">
                        {ingredientesSimples.map(ing => {
                          const stockInfo = ingredientsStockMap.get((ing.nombre || '').toLowerCase().trim())
                          const isAgotado = Boolean(stockInfo && !stockInfo.disponible)
                          const isSelected = duoPizza.extraSimple.includes(ing.nombre)
                          const iconUrl = getIngredientIconUrl(ing.nombre)

                          return (
                            <button
                              type="button"
                              key={`extra-s-${ing.id}`}
                              disabled={isAgotado}
                              onClick={() => toggleHalfIngredient('extra', ing.nombre, false)}
                              className={`pos-ingredient-card group relative flex flex-col items-center justify-between p-1.5 pt-1.5 pb-1 rounded-2xl overflow-hidden !transition-all !duration-200 select-none text-center h-[116px] sm:h-[122px] ${
                                isAgotado
                                  ? '!opacity-35 !grayscale !cursor-not-allowed !border !border-gray-800 !bg-[#151922]'
                                  : isSelected
                                  ? '!bg-[#2b1424] !border-2 !border-pink-500 !ring-2 !ring-pink-500/50 !shadow-lg !shadow-pink-900/40 is-selected'
                                  : '!bg-[#1c202a] !border !border-[#2e3444] hover:!border-gray-400 hover:!bg-[#242936] hover:!shadow-md'
                              }`}
                            >
                              {isSelected && (
                                <div className="absolute top-1.5 right-1.5 z-10 w-4 h-4 rounded-full bg-pink-600 text-white flex items-center justify-center shadow-md animate-in zoom-in-75 !duration-150">
                                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                                </div>
                              )}
                              {isAgotado && (
                                <span className="absolute top-1.5 right-1.5 z-10 text-[8px] font-bold bg-red-950 text-red-400 border border-red-800/80 px-1 py-0.2 rounded shadow">
                                  Agotado
                                </span>
                              )}
                              <div className="w-full flex-1 min-h-0 flex items-center justify-center overflow-hidden px-0.5">
                                {iconUrl ? (
                                  <img
                                    src={iconUrl}
                                    alt={ing.nombre}
                                    className="pos-ingredient-img w-full h-full object-contain filter drop-shadow-md"
                                    loading="lazy"
                                  />
                                ) : (
                                  <Pizza className="w-12 h-12 text-gray-500 group-hover:text-pink-400 !transition-colors" />
                                )}
                              </div>
                              <div className="w-full shrink-0 flex flex-col items-center px-0.5 pb-0.5 z-10">
                                <span className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider leading-tight line-clamp-1 truncate w-full text-center !transition-colors ${
                                  isSelected ? '!text-pink-200' : 'text-gray-200 group-hover:text-white'
                                }`}>
                                  {ing.nombre.toUpperCase()}
                                </span>
                                {ing.esPrecioEspecial && (
                                  <span className="text-[9px] text-pink-400 font-bold mt-0.5 leading-none">
                                    +${getIngredientPrice(ing, duoPizza.size, false).toLocaleString('es-CL')}
                                  </span>
                                )}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Extras Premium */}
                    <div className="space-y-2.5 pt-2">
                      <div className="flex items-center justify-between border-b border-amber-900/40 pb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                            Extras Premium
                          </span>
                          <span className="text-[11px] font-medium text-amber-400/80">
                            (Calidad gourmet)
                          </span>
                        </div>
                        <span className="text-sm sm:text-base font-extrabold text-amber-300 bg-amber-950/60 border border-amber-700/70 px-3 py-0.5 rounded-full shadow-sm">
                          +${getPreciosSegunTamano(duoPizza.size).premium.toLocaleString('es-CL')} c/u
                        </span>
                      </div>

                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-2.5">
                        {ingredientesPremium.map(ing => {
                          const stockInfo = ingredientsStockMap.get((ing.nombre || '').toLowerCase().trim())
                          const isAgotado = Boolean(stockInfo && !stockInfo.disponible)
                          const isSelected = duoPizza.extraPremium.includes(ing.nombre)
                          const iconUrl = getIngredientIconUrl(ing.nombre)

                          return (
                            <button
                              type="button"
                              key={`extra-p-${ing.id}`}
                              disabled={isAgotado}
                              onClick={() => toggleHalfIngredient('extra', ing.nombre, true)}
                              className={`pos-ingredient-card group relative flex flex-col items-center justify-between p-1.5 pt-1.5 pb-1 rounded-2xl overflow-hidden !transition-all !duration-200 select-none text-center h-[116px] sm:h-[122px] ${
                                isAgotado
                                  ? '!opacity-35 !grayscale !cursor-not-allowed !border !border-gray-800 !bg-[#151922]'
                                  : isSelected
                                  ? '!bg-[#2c2211] !border-2 !border-amber-400 !ring-2 !ring-amber-400/60 !shadow-lg !shadow-amber-950/50 is-selected'
                                  : '!bg-[#1c202a] !border !border-amber-600/50 hover:!border-amber-400 hover:!bg-[#26241c] hover:!shadow-md hover:!shadow-amber-950/30'
                              }`}
                            >
                              {isSelected && (
                                <div className="absolute top-1.5 right-1.5 z-10 w-4 h-4 rounded-full bg-amber-500 text-black flex items-center justify-center shadow-md animate-in zoom-in-75 !duration-150">
                                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                                </div>
                              )}
                              {isAgotado && (
                                <span className="absolute top-1.5 right-1.5 z-10 text-[8px] font-bold bg-red-950 text-red-400 border border-red-800/80 px-1 py-0.2 rounded shadow">
                                  Agotado
                                </span>
                              )}
                              <div className="w-full flex-1 min-h-0 flex items-center justify-center overflow-hidden px-0.5">
                                {iconUrl ? (
                                  <img
                                    src={iconUrl}
                                    alt={ing.nombre}
                                    className="pos-ingredient-img w-full h-full object-contain filter drop-shadow-md"
                                    loading="lazy"
                                  />
                                ) : (
                                  <Pizza className="w-12 h-12 text-amber-500/70 group-hover:text-amber-400 !transition-colors" />
                                )}
                              </div>
                              <div className="w-full shrink-0 flex flex-col items-center px-0.5 pb-0.5 z-10">
                                <span className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider leading-tight line-clamp-1 truncate w-full text-center !transition-colors ${
                                  isSelected ? '!text-amber-200 font-bold' : 'text-amber-100/90 group-hover:text-amber-300'
                                }`}>
                                  {ing.nombre.toUpperCase()}
                                </span>
                                {ing.esPrecioEspecial && (
                                  <span className="text-[9px] text-amber-400 font-bold mt-0.5 leading-none">
                                    +${getIngredientPrice(ing, duoPizza.size, true).toLocaleString('es-CL')}
                                  </span>
                                )}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Personalizaciones Básicas */}
              <div className="grid grid-cols-3 gap-4 bg-gray-900/50 p-4 rounded-lg border border-gray-800">
                <label className="flex items-center gap-3 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={duoPizza.sinOregano}
                    onChange={e => setDuoPizza(prev => ({ ...prev, sinOregano: e.target.checked }))}
                    className="w-4 h-4 rounded bg-gray-950 border-gray-800 text-pink-600 focus:ring-0"
                  />
                  <span>Sin Orégano</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={duoPizza.sinQueso}
                    onChange={e => setDuoPizza(prev => ({ ...prev, sinQueso: e.target.checked }))}
                    className="w-4 h-4 rounded bg-gray-950 border-gray-800 text-pink-600 focus:ring-0"
                  />
                  <span>Sin Queso</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={duoPizza.sinSalsaTomate}
                    onChange={e => setDuoPizza(prev => ({ ...prev, sinSalsaTomate: e.target.checked }))}
                    className="w-4 h-4 rounded bg-gray-950 border-gray-800 text-pink-600 focus:ring-0"
                  />
                  <span>Sin Salsa de Tomate</span>
                </label>
              </div>

              {/* Comentarios */}
              <div className="space-y-2">
                <label className="text-xs text-gray-400">Instrucciones o notas adicionales para la pizza:</label>
                <Input
                  placeholder="Ej: Tostar bien, sin aceitunas en la mitad..."
                  value={duoPizza.comments}
                  onChange={e => setDuoPizza(prev => ({ ...prev, comments: e.target.value }))}
                  className="bg-gray-900 border-gray-800 text-white"
                />
              </div>

              {/* Agregar */}
              <div className="flex justify-between items-center border-t border-gray-800 pt-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-base sm:text-lg font-bold text-gray-300">
                    Total Pizza Duo:
                  </span>
                  <span className="text-2xl sm:text-3xl font-black tracking-tight text-pink-500 drop-shadow-md">
                    ${calculatedDuoPrice.toLocaleString('es-CL')}
                  </span>
                </div>
                <Button
                  onClick={handleAddDuoPizza}
                  disabled={!isDuoValid}
                  className="bg-pink-600 hover:bg-pink-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-lg shadow-pink-900/30 text-sm"
                >
                  Agregar al Pedido
                </Button>
              </div>
            </div>
          )}

          {/* CATEGORÍA: AGREGADOS */}
          {activeCategory === 'agregados' && (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...salsas, ...otrosExtras].map(extra => (
                <Card 
                  key={extra.id}
                  className="bg-gray-950 border-gray-800 hover:border-pink-600/50 transition-all cursor-pointer group overflow-hidden"
                  onClick={() => handleAddItemFast(extra)}
                >
                  <div className="h-32 overflow-hidden relative bg-gray-900">
                    {extra.imagen ? (
                      <img 
                        src={getStorageUrl(extra.imagen)} 
                        alt={extra.nombre}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-700">
                        <Plus className="w-10 h-10" />
                      </div>
                    )}
                    <div className="absolute bottom-2 right-2 bg-pink-600 text-white text-base font-bold px-4 py-1.5 rounded shadow-md">
                      ${extra.precio.toLocaleString('es-CL')}
                    </div>
                  </div>
                  <CardContent className="p-3 text-center">
                    <h3 className="font-semibold text-sm text-white line-clamp-1">{extra.nombre}</h3>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* CATEGORÍA: BEBIDAS */}
          {activeCategory === 'bebidas' && (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {/* REQUERIMIENTO: Usar listado con Coca Cola Lata / Botella Zero */}
              {BEBIDAS_LIST.map(bebida => (
                <Card 
                  key={bebida.id}
                  className="bg-gray-950 border-gray-800 hover:border-pink-600/50 transition-all cursor-pointer group overflow-hidden"
                  onClick={() => handleAddItemFast(bebida)}
                >
                  <div className="h-32 overflow-hidden relative bg-gray-900">
                    <img 
                      src={getStorageUrl(bebida.imagen)} 
                      alt={bebida.nombre}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute bottom-2 right-2 bg-pink-600 text-white text-base font-bold px-4 py-1.5 rounded shadow-md">
                      ${bebida.precio.toLocaleString('es-CL')}
                    </div>
                  </div>
                  <CardContent className="p-3 text-center">
                    <h3 className="font-semibold text-sm text-white line-clamp-2">{bebida.nombre}</h3>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SECCIÓN DERECHA: RESUMEN DE COMPRA / CARRITO POS */}
      <div className="w-full lg:w-96 bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col gap-3.5 self-start pos-smooth-shift !transition-all !duration-300">
        <div className="flex justify-between items-center border-b border-gray-800 pb-2">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-pink-500" />
            <h2 className="text-lg font-bold text-white font-semibold">Pedido Actual</h2>
          </div>
          <Button 
            onClick={handleResetPOS} 
            variant="ghost" 
            size="sm" 
            className="text-xs text-gray-400 hover:text-red-500"
          >
            Limpiar
          </Button>
        </div>

        {/* Inputs de Referencia Cliente */}
        <div className={`grid grid-cols-2 gap-2 bg-gray-950/50 p-2.5 rounded-xl border transition-all ${
          (!clientName.trim() && (nameError || activeCart.length > 0))
            ? 'border-red-500/80 ring-1 ring-red-500/40 bg-red-950/10'
            : 'border-gray-800'
        }`}>
          <div className="col-span-2">
            <Input
              ref={clientNameInputRef}
              placeholder="Cliente / Mesa (Requerido) *"
              value={clientName}
              onChange={e => {
                setClientName(e.target.value)
                if (nameError && e.target.value.trim()) {
                  setNameError(false)
                }
              }}
              className={`bg-gray-950 text-xs h-8 text-white transition-all ${
                (!clientName.trim() && (nameError || activeCart.length > 0))
                  ? 'border-red-500 focus-visible:ring-red-500 placeholder:text-red-400/70'
                  : 'border-gray-800 focus-visible:ring-pink-500'
              }`}
            />
            {(!clientName.trim() && (nameError || activeCart.length > 0)) && (
              <p className="text-[10px] text-red-400 font-semibold flex items-center gap-1 mt-1.5 animate-pulse">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                Ingresa el nombre del cliente o mesa para habilitar el pedido
              </p>
            )}
          </div>
          <div>
            <Input
              placeholder="Teléfono"
              value={clientPhone}
              onChange={e => setClientPhone(e.target.value)}
              className="bg-gray-950 border-gray-800 text-xs h-8 text-white"
            />
          </div>
          <div>
            <Input
              placeholder="Mesa N°"
              value={mesaNum}
              onChange={e => setMesaNum(e.target.value)}
              className="bg-gray-950 border-gray-800 text-xs h-8 text-white text-center"
            />
          </div>
          <div className="col-span-2">
            <Input
              placeholder="Nota especial / Observación (Opcional)"
              value={orderNotes}
              onChange={e => setOrderNotes(e.target.value)}
              className="bg-gray-950 border-gray-800 text-xs h-8 text-white placeholder:text-gray-500 focus-visible:ring-pink-500"
            />
          </div>
        </div>

        {/* Banner de Advertencia de Stock si hubo fallo */}
        {showInventoryBanner && saleError?.type === 'inventory' && (
          <div className="bg-red-950/60 border border-red-800/80 rounded-xl p-3 text-xs text-red-200 space-y-2 shadow-lg shadow-red-950/40">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold text-red-300 block">Falta de Stock en el Pedido</span>
                <p className="text-[10px] text-red-200/90 leading-tight">
                  Uno o más productos no pueden prepararse por falta de ingredientes.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => setSaleError(prev => prev ? { ...prev, isOpen: true } : null)}
              className="w-full bg-red-900/80 hover:bg-red-800 text-white font-semibold text-[11px] h-7"
            >
              Ver Detalle de Ingredientes Faltantes
            </Button>
          </div>
        )}

        {/* Listado de Items en Carrito (Ubicado justo debajo de los datos del pedido) */}
        {activeCart.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl border border-dashed border-gray-800 bg-gray-950/30 text-gray-500 text-xs pos-smooth-shift !transition-all !duration-300">
            <ShoppingCart className="w-3.5 h-3.5 opacity-40" />
            <span>Sin productos en el pedido</span>
          </div>
        ) : (
          <div className="space-y-1.5 pos-smooth-shift !transition-all !duration-300">
            <div className="flex items-center justify-between text-[11px] text-gray-400 font-semibold px-0.5">
              <span>Productos ({activeCart.reduce((acc, item) => acc + item.quantity, 0)})</span>
              <span className="text-[10px] text-gray-500 font-normal">
                {activeCart.length} {activeCart.length === 1 ? 'ítem' : 'ítems'}
              </span>
            </div>

            <div className="pos-smooth-shift !transition-all !duration-300">
              {cart.map(item => {
                const isRemoving = removingItemIds.includes(item.id)
                const isDuo = item.pizzaType === 'duo' || Boolean(item.half1 || item.half2)
                const half1Extras = [
                  ...(item.half1?.simpleIngredients || []).map(i => `+${i}`),
                  ...(item.half1?.premiumIngredients || []).map(i => `+${i} (P)`)
                ]
                const half2Extras = [
                  ...(item.half2?.simpleIngredients || []).map(i => `+${i}`),
                  ...(item.half2?.premiumIngredients || []).map(i => `+${i} (P)`)
                ]
                const todaExtras = [
                  ...(item.extraSimple || []).map(i => `+${i} (Toda)`),
                  ...(item.extraPremium || []).map(i => `+${i} (P Toda)`)
                ]

                const half1Label = item.half1?.variety || item.pizza1 || 'Personalizada'
                const half2Label = item.half2?.variety || item.pizza2 || 'Personalizada'

                const detailsText = isDuo ? [
                  item.size === 'mediana' ? 'Mediana' : 'Familiar',
                  item.sinOregano ? 'Sin Orégano' : null,
                  item.sinQueso ? 'Sin Queso' : null,
                  item.sinSalsaTomate ? 'Sin Salsa' : null,
                  `1/2 ${half1Label}${half1Extras.length > 0 ? ` (${half1Extras.join(', ')})` : ''}`,
                  `1/2 ${half2Label}${half2Extras.length > 0 ? ` (${half2Extras.join(', ')})` : ''}`,
                  todaExtras.length > 0 ? todaExtras.join(', ') : null,
                  item.comments ? `"${item.comments}"` : null
                ].filter(Boolean).join(', ') : [
                  item.size === 'mediana' ? 'Mediana' : (item.size === 'familiar' ? 'Familiar' : null),
                  item.sinOregano ? 'Sin Orégano' : null,
                  item.sinQueso ? 'Sin Queso' : null,
                  item.sinSalsaTomate ? 'Sin Salsa' : null,
                  ...(item.ingredients || []).map(i => `+${i}`),
                  ...(item.premiumIngredients || []).map(i => `+${i} (P)`),
                  item.comments ? `"${item.comments}"` : null
                ].filter(Boolean).join(', ')

                const isConflicted = inventoryConflictItems.some(name => 
                  item.name.toLowerCase().includes(name) || name.includes(item.name.toLowerCase())
                )

                return (
                  <AnimatedCartItem
                    key={item.id}
                    item={item}
                    isRemoving={isRemoving}
                    onUpdateQty={handleUpdateQty}
                    onRemove={handleRemoveItem}
                    isConflicted={isConflicted}
                    detailsText={detailsText || null}
                  />
                )
              })}
            </div>
          </div>
        )}

        {/* Bloque Final de Cierre (Se desplaza hacia abajo suavemente con animación) */}
        <div className="border-t border-gray-800/80 pt-3 space-y-3.5 pos-smooth-shift !transition-all !duration-300 !ease-in-out">
          {/* Subtotales y Totales */}
          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-gray-400">
              <span>Subtotal</span>
              <span>${subtotal.toLocaleString('es-CL')}</span>
            </div>

            {/* Descuento (Resta del total - diferenciado en verde esmeralda) */}
            <div className="flex justify-between items-center text-emerald-400 font-bold bg-emerald-950/20 px-2 py-1 rounded-lg border border-emerald-900/40">
              <span>- Descuento</span>
              <div className="flex items-center">
                <span>$</span>
                <Input
                  type="number"
                  min="0"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  placeholder="0"
                  className="w-20 h-6 text-xs font-bold text-right text-emerald-400 bg-gray-900 border-emerald-800/60 focus-visible:ring-emerald-500 ml-1"
                />
              </div>
            </div>

            {/* Delivery (Suma al total - toda en mayúsculas DELIVERY y rojo) */}
            <div className="flex justify-between items-center text-red-500 font-bold bg-red-950/20 px-2 py-1 rounded-lg border border-red-900/40">
              <span>+ DELIVERY</span>
              <div className="flex items-center">
                <span>$</span>
                <Input
                  type="number"
                  min="0"
                  value={deliveryAmount}
                  onChange={(e) => setDeliveryAmount(e.target.value)}
                  placeholder="0"
                  className="w-20 h-6 text-xs font-bold text-right text-red-500 bg-gray-900 border-red-900/50 focus-visible:ring-red-500 ml-1"
                />
              </div>
            </div>

            <div className="flex justify-between text-white font-bold text-base border-t border-gray-800/50 pt-2">
              <span>Total</span>
              <span className="text-pink-500 font-bold">${total.toLocaleString('es-CL')}</span>
            </div>
          </div>

          {/* Selector de Método de Pago */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-gray-500 uppercase font-semibold">Método de Pago</label>
            <div className="grid grid-cols-2 gap-1 bg-gray-950 p-1 rounded-xl border border-gray-800">
              {[
                { id: 'Efectivo', label: 'Efectivo', icon: DollarSign },
                { id: 'Tarjeta', label: 'Tarjeta', icon: CreditCard },
                { id: 'Transferencia', label: 'Transferencia', icon: Landmark },
                { id: 'Por Pagar', label: 'Por Pagar', icon: Clock }
              ].map(method => {
                const Icon = method.icon
                const isSelected = paymentMethod === method.id
                return (
                  <button
                    key={method.id}
                    onClick={() => setPaymentMethod(method.id as any)}
                    className={`flex flex-col items-center py-2 rounded-lg text-[10px] font-medium transition-all ${
                      isSelected
                        ? 'bg-pink-600 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-gray-900'
                    }`}
                  >
                    <Icon className="w-4 h-4 mb-1" />
                    <span>{method.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Detalle del Pago Seleccionado */}
          <div className="bg-gray-950 border border-gray-800 rounded-xl p-3 text-xs min-h-[92px] flex flex-col justify-center">
            
            {/* EFECTIVO */}
            {paymentMethod === 'Efectivo' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 shrink-0">Recibido: $</span>
                  <Input
                    type="number"
                    placeholder="Monto entregado por cliente"
                    value={receivedAmount}
                    onChange={e => setReceivedAmount(e.target.value)}
                    className="bg-gray-900 border-gray-800 text-xs h-8 text-white"
                  />
                </div>
                {parseFloat(receivedAmount) >= total && (
                  <div className="text-green-500 font-bold text-center">
                    Vuelto a entregar: ${changeAmount.toLocaleString('es-CL')}
                  </div>
                )}
              </div>
            )}

            {/* TARJETA */}
            {paymentMethod === 'Tarjeta' && (
              <div className="text-center py-2 space-y-1">
                <div className="flex items-center justify-center gap-2 text-pink-400 font-semibold text-xs">
                  <CreditCard className="w-4 h-4" />
                  <span>Cobro con Tarjeta</span>
                </div>
                <p className="text-[11px] text-gray-400">
                  Cobrar <strong className="text-white">${total.toLocaleString('es-CL')}</strong> externamente en la máquina POS Point.
                </p>
              </div>
            )}

            {/* TRANSFERENCIA */}
            {paymentMethod === 'Transferencia' && (
              <div className="text-center py-2 space-y-1">
                <div className="flex items-center justify-center gap-2 text-pink-400 font-semibold text-xs">
                  <Landmark className="w-4 h-4" />
                  <span>Pago por Transferencia</span>
                </div>
                <p className="text-[11px] text-gray-400">
                  Venta presencial pagada mediante transferencia bancaria.
                </p>
              </div>
            )}

            {/* POR PAGAR */}
            {paymentMethod === 'Por Pagar' && (
              <div className="text-center py-2 space-y-1">
                <div className="flex items-center justify-center gap-2 text-amber-400 font-semibold text-xs">
                  <Clock className="w-4 h-4" />
                  <span>Pedido Por Pagar</span>
                </div>
                <p className="text-[11px] text-gray-400">
                  El pedido quedará registrado pendiente de cobro posterior.
                </p>
              </div>
            )}
          </div>

          {/* Botón de Cobro Primario */}
          <Button
            onClick={handleConfirmOrder}
            disabled={isPaymentDisabled}
            className={`w-full font-bold py-5 text-sm rounded-xl transition-all shadow-lg ${
              isPaymentDisabled
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700 shadow-none'
                : 'bg-pink-600 hover:bg-pink-700 text-white shadow-pink-900/30'
            }`}
          >
            {isSubmitting ? (
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <ShoppingCart className="w-4 h-4 mr-2" />
            )}
            {!clientName.trim() && activeCart.length > 0
              ? 'Ingresa Nombre de Cliente para Confirmar'
              : (
                <>
                  {paymentMethod === 'Efectivo' && `Confirmar Pago en Efectivo`}
                  {paymentMethod === 'Tarjeta' && `Confirmar Venta con Tarjeta ($${total.toLocaleString('es-CL')})`}
                  {paymentMethod === 'Transferencia' && `Confirmar Venta por Transferencia ($${total.toLocaleString('es-CL')})`}
                  {paymentMethod === 'Por Pagar' && `Confirmar Pedido (Por Pagar)`}
                </>
              )}
          </Button>
        </div>
      </div>

      {/* DIÁLOGO: CONFIGURACIÓN COMPACTA DE PIZZA DEL MENÚ */}
      <Dialog 
        open={!!selectedPizzaForConfig} 
        onOpenChange={(open) => !open && setSelectedPizzaForConfig(null)}
      >
        <DialogContent className="bg-gray-950 border border-gray-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              Configurar Pizza {selectedPizzaForConfig?.nombre}
            </DialogTitle>
          </DialogHeader>

          {selectedPizzaForConfig && (
            <div className="space-y-5 py-2">
              
              {/* Selector de Tamaño */}
              <div className="space-y-2">
                <label className="text-xs text-gray-400 font-semibold uppercase">Tamaño de la Pizza</label>
                <div className="flex gap-2">
                  {/* Solo mostrar tamaños válidos según stock/precios */}
                  {selectedPizzaForConfig.disponibleMediana !== false && selectedPizzaForConfig.precioMediana > 0 && (
                    <Button
                      onClick={() => setPizzaConfig(prev => ({ ...prev, size: 'mediana' }))}
                      className={`flex-1 capitalize ${
                        pizzaConfig.size === 'mediana'
                          ? 'bg-pink-600 text-white font-semibold'
                          : 'bg-gray-900 text-gray-400 border border-gray-800 hover:bg-gray-800'
                      }`}
                    >
                      Mediana
                    </Button>
                  )}
                  {selectedPizzaForConfig.disponibleFamiliar !== false && (
                    <Button
                      onClick={() => setPizzaConfig(prev => ({ ...prev, size: 'familiar' }))}
                      className={`flex-1 capitalize ${
                        pizzaConfig.size === 'familiar'
                          ? 'bg-pink-600 text-white font-semibold'
                          : 'bg-gray-900 text-gray-400 border border-gray-800 hover:bg-gray-800'
                      }`}
                    >
                      Familiar
                    </Button>
                  )}
                </div>
              </div>

              {/* Personalizaciones Básicas */}
              <div className="grid grid-cols-3 gap-3 bg-gray-900/50 p-3 rounded-lg border border-gray-800">
                <label className="flex items-center gap-2.5 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={pizzaConfig.sinOregano}
                    onChange={e => setPizzaConfig(prev => ({ ...prev, sinOregano: e.target.checked }))}
                    className="w-4 h-4 rounded bg-gray-950 border-gray-800 text-pink-600 focus:ring-0"
                  />
                  <span>Sin Orégano</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={pizzaConfig.sinQueso}
                    onChange={e => setPizzaConfig(prev => ({ ...prev, sinQueso: e.target.checked }))}
                    className="w-4 h-4 rounded bg-gray-950 border-gray-800 text-pink-600 focus:ring-0"
                  />
                  <span>Sin Queso</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={pizzaConfig.sinSalsaTomate}
                    onChange={e => setPizzaConfig(prev => ({ ...prev, sinSalsaTomate: e.target.checked }))}
                    className="w-4 h-4 rounded bg-gray-950 border-gray-800 text-pink-600 focus:ring-0"
                  />
                  <span>Sin Salsa Tomate</span>
                </label>
              </div>

              {/* Ingredientes Adicionales Simples */}
              <div className="space-y-2">
                <label className="text-xs text-gray-400 font-semibold uppercase">
                  Ingredientes Simples (+${getPreciosSegunTamano(pizzaConfig.size).simple})
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {ingredientesSimples.map(ing => {
                    const stockInfo = ingredientsStockMap.get((ing.nombre || '').toLowerCase().trim())
                    const isAgotado = Boolean(stockInfo && !stockInfo.disponible)
                    const isSelected = pizzaConfig.simpleIngredients.includes(ing.nombre)

                    return (
                      <Button
                        key={ing.id}
                        onClick={() => toggleIngredientConfig(ing.nombre, false)}
                        variant="outline"
                        className={`justify-between px-2 py-1.5 text-xs truncate border transition-all ${
                          isSelected
                            ? 'bg-pink-900/30 border-pink-600 text-pink-400 font-semibold'
                            : isAgotado
                            ? 'bg-gray-950/80 border-red-900/50 text-gray-400 hover:border-red-700'
                            : 'bg-gray-900 border-gray-800 hover:bg-gray-800 text-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-1 min-w-0 truncate">
                          <Check className={`w-3 h-3 shrink-0 ${isSelected ? 'opacity-100 text-pink-500' : 'opacity-0'}`} />
                          <span className="truncate">{getIngredientDisplayName(ing, pizzaConfig.size)}</span>
                        </div>
                        {isAgotado && (
                          <span className="shrink-0 text-[8px] bg-red-950 text-red-400 border border-red-800 px-0.5 rounded ml-0.5">
                            Agotado
                          </span>
                        )}
                      </Button>
                    )
                  })}
                </div>
              </div>

              {/* Ingredientes Adicionales Premium */}
              <div className="space-y-2">
                <label className="text-xs text-gray-400 font-semibold uppercase">
                  Ingredientes Premium (+${getPreciosSegunTamano(pizzaConfig.size).premium})
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {ingredientesPremium.map(ing => {
                    const stockInfo = ingredientsStockMap.get((ing.nombre || '').toLowerCase().trim())
                    const isAgotado = Boolean(stockInfo && !stockInfo.disponible)
                    const isSelected = pizzaConfig.premiumIngredients.includes(ing.nombre)

                    return (
                      <Button
                        key={ing.id}
                        onClick={() => toggleIngredientConfig(ing.nombre, true)}
                        variant="outline"
                        className={`justify-between px-2 py-1.5 text-xs truncate border transition-all ${
                          isSelected
                            ? 'bg-pink-900/30 border-pink-600 text-pink-400 font-semibold'
                            : isAgotado
                            ? 'bg-gray-950/80 border-red-900/50 text-gray-400 hover:border-red-700'
                            : 'bg-gray-900 border-gray-800 hover:bg-gray-800 text-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-1 min-w-0 truncate">
                          <Check className={`w-3 h-3 shrink-0 ${isSelected ? 'opacity-100 text-pink-500' : 'opacity-0'}`} />
                          <span className="truncate">{getIngredientDisplayName(ing, pizzaConfig.size, true)}</span>
                        </div>
                        {isAgotado && (
                          <span className="shrink-0 text-[8px] bg-red-950 text-red-400 border border-red-800 px-0.5 rounded ml-0.5">
                            Agotado
                          </span>
                        )}
                      </Button>
                    )
                  })}
                </div>
              </div>

              {/* Comentarios de la Pizza */}
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 uppercase">Instrucciones Especiales</label>
                <Input
                  placeholder="Ej: Hornear poco rato, champiñones solo a un lado..."
                  value={pizzaConfig.comments}
                  onChange={e => setPizzaConfig(prev => ({ ...prev, comments: e.target.value }))}
                  className="bg-gray-900 border-gray-800 text-xs text-white"
                />
              </div>

            </div>
          )}

          <DialogFooter className="border-t border-gray-800 pt-4 flex items-center justify-between">
            <div className="text-sm font-bold text-white">
              Precio Unitario: ${ (
                (((pizzaConfig.size === 'mediana' && selectedPizzaForConfig?.disponibleMediana !== false && selectedPizzaForConfig?.precioMediana > 0) ? selectedPizzaForConfig?.precioMediana : selectedPizzaForConfig?.precio) || getPreciosSegunTamano(pizzaConfig.size).baseMenu) +
                (pizzaConfig.simpleIngredients.length * getPreciosSegunTamano(pizzaConfig.size).simple) +
                (pizzaConfig.premiumIngredients.length * getPreciosSegunTamano(pizzaConfig.size).premium)
              ).toLocaleString('es-CL') }
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={() => setSelectedPizzaForConfig(null)}
                variant="ghost" 
                className="text-gray-400 hover:text-white text-xs h-9"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleAddConfiguredPizza}
                className="bg-pink-600 hover:bg-pink-700 text-white font-semibold text-xs h-9"
              >
                Agregar al Pedido
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO: COMPRA CONFIRMADA CON ÉXITO */}
      <Dialog 
        open={showSuccessDialog} 
        onOpenChange={(open) => !open && handleResetPOS()}
      >
        <DialogContent className="bg-gray-950 border border-gray-800 text-white max-w-sm text-center">
          <div className="py-4 space-y-4">
            <div className="w-12 h-12 bg-green-500 text-black rounded-full flex items-center justify-center mx-auto">
              <Check className="w-7 h-7 stroke-[3px]" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">¡Venta Registrada Exitosamente!</h3>
              {successOrder && (
                <p className="text-xs text-gray-400">N° Pedido Generado: <strong>{successOrder.orderNumber}</strong></p>
              )}
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button 
                onClick={handlePrintReceipt}
                className="w-full bg-white hover:bg-gray-200 text-black font-bold text-xs py-2 flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                Imprimir Comanda
              </Button>
              <Button 
                onClick={() => {
                  handleResetPOS()
                  router.push('/admin/pedidos')
                }}
                className="w-full bg-pink-600 hover:bg-pink-700 text-white font-semibold text-xs py-2 flex items-center justify-center gap-1.5"
              >
                <ShoppingCart className="w-4 h-4" />
                Ir a Pedidos
              </Button>
              <Button
                onClick={handleResetPOS}
                variant="outline"
                className="w-full border-gray-800 text-gray-300 hover:bg-gray-900 text-xs py-2"
              >
                Nueva Venta
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO: AVISO DETALLADO DE FALTA DE STOCK Y ERRORES EN VENTAS */}
      <Dialog 
        open={Boolean(saleError?.isOpen)} 
        onOpenChange={(open) => {
          if (!open) {
            setSaleError(prev => prev ? { ...prev, isOpen: false } : null)
          }
        }}
      >
        <DialogContent className="bg-gray-950 border border-gray-800 text-white max-w-xl max-h-[90vh] overflow-y-auto">
          {saleError && (
            <div className="space-y-5 py-2">
              {/* Encabezado con Icono Temático */}
              <div className="flex items-start gap-3.5 pb-2 border-b border-gray-800/80">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  saleError.type === 'inventory' 
                    ? 'bg-red-950/80 text-red-400 border border-red-800/80 shadow-lg shadow-red-950/50' 
                    : saleError.type === 'schedule'
                    ? 'bg-amber-950/80 text-amber-400 border border-amber-800/80 shadow-lg shadow-amber-950/50'
                    : 'bg-pink-950/80 text-pink-400 border border-pink-800/80'
                }`}>
                  {saleError.type === 'inventory' && <PackageX className="w-6 h-6 animate-pulse" />}
                  {saleError.type === 'schedule' && <Clock className="w-6 h-6" />}
                  {saleError.type === 'payment' && <CreditCard className="w-6 h-6" />}
                  {(saleError.type === 'validation' || saleError.type === 'general') && <AlertTriangle className="w-6 h-6" />}
                </div>
                <div className="flex-1">
                  <DialogTitle className="text-lg font-bold text-white leading-tight">
                    {saleError.title}
                  </DialogTitle>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                    {saleError.message}
                  </p>
                </div>
              </div>

              {/* Caso de Falta de Stock con Desglose */}
              {saleError.type === 'inventory' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase font-bold text-gray-400 tracking-wider">
                      Desglose de Ingredientes Insuficientes
                    </span>
                    <span className="text-[10px] text-red-400 bg-red-950/60 border border-red-900/60 px-2 py-0.5 rounded-full font-medium">
                      Acción requerida en caja
                    </span>
                  </div>

                  {saleError.insufficientItems && saleError.insufficientItems.length > 0 ? (
                    <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                      {saleError.insufficientItems.map((prod, idx) => (
                        <div 
                          key={idx} 
                          className="bg-gray-900/70 border border-red-900/40 rounded-xl p-3.5 space-y-2 hover:border-red-800/70 transition-all"
                        >
                          <div className="flex items-center gap-2 text-pink-400 font-semibold text-xs">
                            <Pizza className="w-4 h-4 shrink-0 text-pink-500" />
                            <span className="text-white font-bold">{prod.item}</span>
                          </div>

                          <div className="space-y-1.5 pl-5">
                            {prod.missing.map((ing, iIdx) => (
                              <div 
                                key={iIdx} 
                                className="flex flex-wrap items-center justify-between gap-2 bg-gray-950/70 border border-gray-800/80 rounded-lg p-2 text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                                  <span className="font-bold text-red-300">{ing.ingrediente}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-[11px]">
                                  {typeof ing.needed === 'number' || typeof ing.available === 'number' ? (
                                    <div className="flex items-center gap-2 text-gray-400">
                                      {typeof ing.needed === 'number' && (
                                        <span>Necesario: <strong className="text-white">{ing.needed}{ing.unidad || 'gr'}</strong></span>
                                      )}
                                      <span className="text-gray-600">|</span>
                                      {typeof ing.available === 'number' && (
                                        <span>Disponible: <strong className={ing.available <= 0 ? 'text-red-400 font-bold' : 'text-amber-400'}>{ing.available}{ing.unidad || 'gr'}</strong></span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-red-400 font-semibold bg-red-950/80 border border-red-800/50 px-2 py-0.5 rounded text-[10px]">
                                      Agotado en inventario
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-red-950/30 border border-red-900/40 rounded-xl p-3 text-xs text-red-300">
                      {saleError.rawError || 'No se pudieron recuperar las cantidades exactas, pero uno de los componentes del pedido no cuenta con stock disponible en cocina.'}
                    </div>
                  )}
                </div>
              )}

              {/* Caja de Consejos / Sugerencias para el Cajero */}
              {saleError.helpSuggestion && (
                <div className="bg-amber-950/25 border border-amber-800/40 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-200">
                  <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-bold text-amber-300 block">¿Cómo solucionarlo?</span>
                    <p className="text-[11px] text-amber-200/90 leading-relaxed">
                      {saleError.helpSuggestion}
                    </p>
                  </div>
                </div>
              )}

              {/* Botones de Acción del Diálogo */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-2 border-t border-gray-800/80">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => window.open('/admin/inventario', '_blank')}
                  className="w-full sm:w-auto border-gray-800 text-gray-300 hover:bg-gray-900 text-xs h-9 flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Ir al Módulo de Inventario
                </Button>

                <Button
                  type="button"
                  onClick={() => setSaleError(prev => prev ? { ...prev, isOpen: false } : null)}
                  className="w-full sm:w-auto bg-pink-600 hover:bg-pink-700 text-white font-semibold text-xs h-9 px-5"
                >
                  Entendido, Modificar Pedido
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

"use client"

import { useState, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import { useCart } from "../context/CartContext"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import { Trash, ChevronDown, ChevronUp, AlertCircle, X } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Minus, Plus } from "lucide-react"
import { Truck, Store, MapPin, CheckCircle, ArrowLeft, CreditCard, Banknote, ArrowRightCircle, Tag, Sparkles, Search, LocateFixed } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useAuth } from "../context/AuthContext"
import LocationPicker from "./LocationPicker"
import type { DeliveryZone } from "../../lib/delivery-zones"
import { useDeliveryZones } from "../../hooks/useDeliveryZones"
import { useBusinessHours } from "@/hooks/useBusinessHours"
import PizzaConfigModal from "./PizzaConfigModal"
import InventoryErrorModal from "./InventoryErrorModal"
import { functions, db } from "@/lib/firebase"
import { httpsCallable } from "firebase/functions"
import { collection, getDocs, query, where, doc, updateDoc, serverTimestamp } from "firebase/firestore"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useFirestorePizzaConfig } from "@/hooks/useFirestorePizzaConfig"
import { subscribeAgregadosConfig, type BebidasDisponiblesConfig, type SalsasDisponiblesConfig } from "@/lib/agregados-config"

interface CartProps {
  onClose?: () => void
}

// Caché global de imágenes precargadas para prevenir la recolección de basura (Garbage Collection)
const preloadedImagesCache: Record<string, HTMLImageElement> = {};

// Feature Flag para activar la integración automatizada de transferencias con Khipu
const IS_KHIPU_ENABLED = true;

const Cart = ({ onClose }: CartProps) => {
  const { items, removeItem, getTotal, updateQuantity, updateItem, clearCart, createOrder, addItem } = useCart()
  const { preciosConfig } = useFirestorePizzaConfig()
  const [isMounted, setIsMounted] = useState(false)
  const [expandedItems, setExpandedItems] = useState<{ [key: string]: boolean }>({})
  const [expandedPrepOptions, setExpandedPrepOptions] = useState<{ [key: string]: boolean }>({})
  const [inventoryErrorDetails, setInventoryErrorDetails] = useState<any[] | undefined>(undefined)
  const [isInventoryErrorModalOpen, setIsInventoryErrorModalOpen] = useState(false)
  const [showInventoryError, setShowInventoryError] = useState(false)

  // Estado para el desplegable unificado de extras
  const [isExtrasOpen, setIsExtrasOpen] = useState(false)

  const { isAuthenticated, user, updateUser } = useAuth()
  const [guestName, setGuestName] = useState("")
  const [guestPhone, setGuestPhone] = useState("")
  const [guestEmail, setGuestEmail] = useState("")
  const [guestFormError, setGuestFormError] = useState("")
  const { isOpen, config } = useBusinessHours()

  // Estados para la solicitud automática de teléfono en confirmación
  const [phoneInput, setPhoneInput] = useState("")
  const [isSavingPhone, setIsSavingPhone] = useState(false)
  const [isDelivery, setIsDelivery] = useState<boolean | null>(null) // null = no seleccionado
  const [currentView, setCurrentView] = useState<"cart" | "address" | "payment" | "confirmation" | "phone-registration">("cart")
  const [paymentMethod, setPaymentMethod] = useState("webpay")
  const [isProcessing, setIsProcessing] = useState(false)
  const [isRedirectingToWebpay, setIsRedirectingToWebpay] = useState(false)
  const [redirectingProvider, setRedirectingProvider] = useState<'webpay' | 'khipu' | null>(null)
  const [orderNumber, setOrderNumber] = useState(Math.floor(Math.random() * 100000))
  const [confirmedTotal, setConfirmedTotal] = useState(0)
  const [guestTrackingUrl, setGuestTrackingUrl] = useState("")
  const [serverCalculation, setServerCalculation] = useState<{ subtotal: number; deliveryFee: number; total: number } | null>(null)
  const [isServerCalcLoading, setIsServerCalcLoading] = useState(false)
  const [serverCalcError, setServerCalcError] = useState<string | null>(null)
  const [rollitosPackStock, setRollitosPackStock] = useState<number>(99)
  const [gauchitosDisponible, setGauchitosDisponible] = useState<boolean>(true)
  const [salsasDisponibles, setSalsasDisponibles] = useState<SalsasDisponiblesConfig>({
    ajo: true,
    chimichurri: true,
    bbq: true,
    pesto: true,
  })
  const [bebidasDisponibles, setBebidasDisponibles] = useState<BebidasDisponiblesConfig>({
    liptonLata: true,
    liptonBotella: true,
    cocaLataTradicional: true,
    cocaLataZero: true,
    cocaBotellaTradicional: true,
    cocaBotellaZero: true,
  })

  // Crear overlay directamente en el DOM cuando se activa WebPay o Khipu
  useEffect(() => {
    console.log("🎨 Estado isRedirectingToWebpay cambió a:", isRedirectingToWebpay, "con proveedor:", redirectingProvider)

    if (isRedirectingToWebpay && redirectingProvider) {
      console.log("🎨 Creando overlay directamente en el DOM. Proveedor detectado:", redirectingProvider)

      // Eliminar el overlay si ya existe para evitar duplicados en el DOM
      const existingOverlay = document.getElementById('webpay-redirect-overlay')
      if (existingOverlay) {
        existingOverlay.remove()
      }

      // Evaluar textos e ícono ANTES de construir el HTML
      const isKhipu = redirectingProvider === 'khipu'
      const titulo = isKhipu ? 'Redirigiendo a Khipu' : 'Procesando pago'
      const descripcion = isKhipu
        ? 'Estás siendo redirigido a Khipu para completar tu transferencia bancaria de forma segura'
        : 'Estás siendo redirigido a Webpay Plus para completar tu pago de forma segura'

      // Ícono: banco para Khipu, tarjeta para Webpay
      const iconoSvg = isKhipu
        ? `<svg style="width:3rem;height:3rem;margin:0 auto;color:#ec4899;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
               d="M3 21h18M3 10h18M3 7l9-4 9 4M4 10v11M8 10v11M12 10v11M16 10v11M20 10v11"/>
           </svg>`
        : `<svg style="width:3rem;height:3rem;margin:0 auto;color:#ec4899;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <rect x="2" y="5" width="20" height="14" rx="2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
             <line x1="2" y1="10" x2="22" y2="10" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
           </svg>`

      // Crear el overlay
      const overlay = document.createElement('div')
      overlay.id = 'webpay-redirect-overlay'
      overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background-color: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
      `

      overlay.innerHTML = `
        <div style="
          background-color: white;
          border-radius: 0.75rem;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          padding: 1.5rem;
          max-width: 22rem;
          width: calc(100% - 2rem);
          margin: 0 1rem;
          text-align: center;
        ">
          <!-- Spinner animado -->
          <div style="margin-bottom: 1.25rem; display: flex; justify-content: center;">
            <div style="position: relative; width: 4rem; height: 4rem;">
              <div style="position: absolute; top: 0; left: 0; width: 4rem; height: 4rem; border: 3px solid #fbcfe8; border-radius: 9999px;"></div>
              <div class="khipu-spinner" style="
                position: absolute;
                top: 0;
                left: 0;
                width: 4rem;
                height: 4rem;
                border: 3px solid transparent;
                border-top-color: #ec4899;
                border-radius: 9999px;
              "></div>
            </div>
          </div>
          
          <!-- Icono del método de pago -->
          <div style="margin-bottom: 0.875rem;">
            ${iconoSvg}
          </div>
          
          <!-- Título -->
          <h3 style="font-size: 1.25rem; font-weight: bold; color: #1f2937; margin-bottom: 0.5rem; line-height: 1.3;">
            ${titulo}
          </h3>

          <!-- Descripción -->
          <p style="color: #4b5563; margin-bottom: 1rem; font-size: 0.9rem; line-height: 1.4;">
            ${descripcion}
          </p>
          
          <!-- Barra de progreso -->
          <div style="
            width: 100%;
            background-color: #e5e7eb;
            border-radius: 9999px;
            height: 0.4rem;
            margin-bottom: 0.875rem;
            overflow: hidden;
          ">
            <div class="khipu-progress" style="
              background: linear-gradient(to right, #f9a8d4, #ec4899);
              height: 0.4rem;
              border-radius: 9999px;
              width: 70%;
            "></div>
          </div>
          
          <p style="font-size: 0.8125rem; color: #6b7280; line-height: 1.3;">
            Por favor, no cierres esta ventana...
          </p>
        </div>
      `

      // Eliminar el style tag si ya existe para asegurar que se actualicen las reglas CSS
      const existingStyle = document.getElementById('webpay-overlay-styles')
      if (existingStyle) {
        existingStyle.remove()
      }

      // Agregar animaciones CSS usando clases para garantizar compatibilidad
      const style = document.createElement('style')
      style.id = 'webpay-overlay-styles'
      style.textContent = `
        @keyframes khipu-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes khipu-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .khipu-spinner {
          animation: khipu-spin 0.8s linear infinite !important;
        }
        .khipu-progress {
          animation: khipu-pulse 1.5s ease-in-out infinite !important;
        }
      `
      document.head.appendChild(style)

      document.body.appendChild(overlay)
      console.log("✅ Overlay agregado al DOM")

      // Cleanup: remover el overlay y el style tag cuando el componente se desmonte o el estado cambie
      return () => {
        const existingOverlay = document.getElementById('webpay-redirect-overlay')
        if (existingOverlay) {
          existingOverlay.remove()
          console.log("🗑️ Overlay removido del DOM")
        }
        const styleTag = document.getElementById('webpay-overlay-styles')
        if (styleTag) {
          styleTag.remove()
          console.log("🗑️ Estilos del overlay removidos")
        }
      }
    }
  }, [isRedirectingToWebpay, redirectingProvider])


  useEffect(() => {
    const unsubscribe = subscribeAgregadosConfig((config) => {
      setBebidasDisponibles(config.bebidasDisponibles)
      setSalsasDisponibles(config.salsasDisponibles)
      setGauchitosDisponible(config.gauchitosDisponible)
      setRollitosPackStock(config.rollitosPackStock)
    })

    return () => unsubscribe()
  }, [])

  // Precargar imágenes del carrito de manera proactiva e instantánea en segundo plano
  useEffect(() => {
    if (typeof window !== "undefined" && items && items.length > 0) {
      items.forEach((item: any) => {
        if (item.image) {
          const url = getStorageUrl(item.image);
          if (!preloadedImagesCache[url]) {
            const img = new window.Image();
            img.src = url;
            preloadedImagesCache[url] = img; // Retener referencia en memoria
          }
        }
      });
    }
  }, [items]);


  const [estimatedTime, setEstimatedTime] = useState("20-25 minutos")

  // Cargar zonas de delivery desde Firestore
  const { zones: deliveryZones, loading: loadingZones } = useDeliveryZones()

  // Estados para códigos de descuento
  const [discountCode, setDiscountCode] = useState("")
  const [appliedDiscount, setAppliedDiscount] = useState<{
    code: string
    amount: number
    percentage?: number
  } | null>(null)
  const [discountError, setDiscountError] = useState("")
  const [isDiscountPanelOpen, setIsDiscountPanelOpen] = useState(false)



  // Estados para dirección
  const [calle, setCalle] = useState("")
  const [numero, setNumero] = useState("")
  const [depto, setDepto] = useState("")
  const [comuna, setComuna] = useState("")
  const [referencia, setReferencia] = useState("")
  const [addressQuery, setAddressQuery] = useState("")
  const [numberDraft, setNumberDraft] = useState("")
  const [hasCheckedAddressNumber, setHasCheckedAddressNumber] = useState(false)
  const [isGeocodingAddress, setIsGeocodingAddress] = useState(false)
  const [isLocatingUser, setIsLocatingUser] = useState(false)
  const [showLastAddressModal, setShowLastAddressModal] = useState(false)
  const [hasAskedLastAddress, setHasAskedLastAddress] = useState(false)

  // Estados para pago en efectivo
  const [cashAmount, setCashAmount] = useState("")
  const [cashAmountError, setCashAmountError] = useState("")

  // Utilidad para interceptar y usar la URL de Storage
  const getStorageUrl = (path: string) => {
    if (!path) return "/placeholder.svg?height=200&width=200";
    if (path.startsWith('http')) return path;

    const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'pizzeria-palermo-17f6d.appspot.com';

    // Interceptar de manera resiliente rutas antiguas persistidas o genéricas
    // y redirigirlas a la URL real con timestamp de la Doble Muzza
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
    if (path.startsWith('/acompañamientos/')) {
      const fileName = path.split('/').pop() || '';
      return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/acompa%C3%B1amientos%2F${encodeURIComponent(fileName)}?alt=media`;
    }
    if (path.startsWith('/pizzas/')) {
      const fileName = path.split('/').pop() || '';
      return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/pizzas%2F${encodeURIComponent(fileName)}?alt=media`;
    }
    return path;
  };

  // Estados para la ubicación y delivery
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number
    lng: number
    address?: string
  } | null>(null)

  const [deliveryInfo, setDeliveryInfo] = useState<{
    zone: DeliveryZone | null
    tarifa: number
    disponible: boolean
  }>({
    zone: null,
    tarifa: 0,
    disponible: false,
  })

  // Cálculos de totales (client-side como fallback)
  const localSubtotal = getTotal()
  // Solo se cobra delivery si la ubicación pertenece a una zona definida y disponible
  const localDeliveryCost = isDelivery && deliveryInfo.zone && deliveryInfo.disponible ? deliveryInfo.tarifa : 0

  const subtotal = serverCalculation?.subtotal ?? 0
  const deliveryCost = isDelivery ? (serverCalculation?.deliveryFee ?? 0) : 0

  const orderHasPromoOrCombo = items.some((item) => {
    const name = item.name.toLowerCase()
    return name.includes('promo') || name.includes('combo') || item.pizzaType === 'promo'
  })

  // Calcular descuento total (códigos)
  let discountFromCode = 0
  if (appliedDiscount) {
    discountFromCode = appliedDiscount.amount || 0;
  }

  const discountAmount = discountFromCode
  const totalFinal = Math.max(0, (serverCalculation?.total ?? 0) - discountAmount)
  const isServerTotalReady = Boolean(serverCalculation)
  const showCalculatingTotal = isServerCalcLoading && !isServerTotalReady

  const toggleItemExpansion = (itemId: string) => {
    setExpandedItems((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }))
  }

  const togglePrepOptions = (itemId: string) => {
    setExpandedPrepOptions((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }))
  }

  const normalizeText = (text: string): string => {
    return (text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
  }

  const getBeverageAvailabilityKey = (itemName: string): keyof BebidasDisponiblesConfig | null => {
    const normalized = normalizeText(itemName)

    if (normalized.includes('lipton') && normalized.includes('botella')) {
      return 'liptonBotella'
    }
    if (normalized.includes('lipton') && normalized.includes('lata')) {
      return 'liptonLata'
    }
    if (normalized.includes('coca') && normalized.includes('1.5') && normalized.includes('zero')) {
      return 'cocaBotellaZero'
    }
    if (normalized.includes('coca') && normalized.includes('1.5')) {
      return 'cocaBotellaTradicional'
    }
    if (normalized.includes('coca') && normalized.includes('lata') && normalized.includes('zero')) {
      return 'cocaLataZero'
    }
    if (normalized.includes('coca') && normalized.includes('lata')) {
      return 'cocaLataTradicional'
    }

    return null
  }

  const getUnavailableBeveragesInCart = () => {
    return items
      .filter((item) => {
        const key = getBeverageAvailabilityKey(item.name || '')
        return key ? !bebidasDisponibles[key] : false
      })
      .map((item) => item.name)
  }

  const validateBeverageStock = () => {
    const unavailable = getUnavailableBeveragesInCart()

    if (unavailable.length > 0) {
      toast({
        title: "Producto sin stock",
        description: `${unavailable.join(', ')} no tiene stock disponible. Elimina ese producto o intenta más tarde.`,
        variant: "destructive",
      })
      return false
    }

    return true
  }



  // Función de validación para pago en efectivo
  const validateCashAmount = (amount: string) => {
    setCashAmountError("")

    if (!amount || amount.trim() === "") {
      setCashAmountError("Por favor ingresa el monto con el que vas a pagar")
      return false
    }

    const numericAmount = parseFloat(amount)

    if (isNaN(numericAmount) || numericAmount <= 0) {
      setCashAmountError("Ingresa un monto válido")
      return false
    }

    if (numericAmount < totalFinal) {
      setCashAmountError(`El monto debe ser mayor o igual a $${totalFinal.toLocaleString()}`)
      return false
    }

    return true
  }

  // Función para manejar el cambio en el monto de efectivo
  const handleCashAmountChange = (value: string) => {
    setCashAmount(value)
    if (value.trim() !== "") {
      validateCashAmount(value)
    } else {
      setCashAmountError("")
    }
  }

  // Efecto para limpiar errores cuando cambia el método de pago
  useEffect(() => {
    if (paymentMethod !== "efectivo") {
      setCashAmount("")
      setCashAmountError("")
    }
  }, [paymentMethod])

  // Forzar método de pago Efectivo si el total es $0 por ser solo canjes retirados en local
  useEffect(() => {
    if (totalFinal === 0 && paymentMethod !== "efectivo") {
      setPaymentMethod("efectivo")
    }
  }, [totalFinal, paymentMethod])

  // Función para determinar si el botón de pago debe estar deshabilitado
  const isPaymentButtonDisabled = () => {
    if (isProcessing) return true
    if (showCalculatingTotal) return true

    if (!isAuthenticated) {
      const hasGuestName = guestName.trim().length >= 2
      const hasGuestPhone = guestPhone.trim().length >= 8
      const hasValidGuestEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim())

      if (!hasGuestName || !hasGuestPhone || !hasValidGuestEmail) return true
    }

    // Si es pago en efectivo, validar que el monto sea correcto (solo si total es mayor a $0)
    if (paymentMethod === "efectivo" && totalFinal > 0) {
      if (!cashAmount || cashAmount.trim() === "") return true
      if (cashAmountError !== "") return true

      const numericAmount = parseFloat(cashAmount)
      if (isNaN(numericAmount) || numericAmount <= 0) return true
      if (numericAmount < totalFinal) return true
    }

    return false
  }

  // Calcular total en servidor para evitar manipulación del cliente
  useEffect(() => {
    let isActive = true

    const shouldCalculate = items.length > 0
    if (!shouldCalculate) {
      setServerCalculation(null)
      setServerCalcError(null)
      setIsServerCalcLoading(false)
      return () => {
        isActive = false
      }
    }

    const calculateServerTotal = async () => {
      setIsServerCalcLoading(true)
      setServerCalcError(null)

      try {
        const orderItems = items.map(item => {
          const inferredMenuName = !item.selectedMenuPizza && /^pizza\s+/i.test(item.name)
            ? item.name
              .replace(/^pizza\s+/i, '')
              .replace(/\s*\((?:familiar|mediana|personal|grande|f|m|p|g)\)\s*$/i, '')
              .trim()
            : item.selectedMenuPizza
          const normalizedPizzaType = inferredMenuName && item.pizzaType === 'promo' ? 'premium' : item.pizzaType

          return {
            nombre: item.name,
            cantidad: item.quantity,
            precio: item.price,
            size: item.size,
            ingredients: item.ingredients,
            premiumIngredients: item.premiumIngredients,
            sauces: item.sauces,
            drinks: item.drinks,
            extras: item.extras,
            comments: item.comments,
            pizzaType: normalizedPizzaType,
            pizza1: item.pizza1,
            pizza2: item.pizza2,
            half1: item.half1,
            half2: item.half2,
            selectedMenuPizza: inferredMenuName,
          }
        })

        console.log("[CART] orderItems enviados a calculatePrice:", orderItems)
        console.log("[CART] orderItems JSON:", JSON.stringify(orderItems, null, 2))

        const calculatePriceFn = httpsCallable(functions, "calculatePrice")
        const response = await calculatePriceFn({
          items: orderItems,
          tipoEntrega: isDelivery ? "Delivery" : "Retiro",
          direccion: isDelivery
            ? { lat: selectedLocation?.lat, lng: selectedLocation?.lng }
            : undefined,
          discountCode: appliedDiscount?.code,
        })

        const data = response.data as any
        if (!isActive) return

        if (data?.success) {
          // Si el servidor detectó que el código es inválido o expiró
          if (data.discountError && appliedDiscount) {
            setDiscountError(data.discountError);
            setAppliedDiscount(null);
          } else if (data.discountAmount !== undefined && appliedDiscount) {
            // Actualizar el monto del descuento con lo calculado por el servidor
            setAppliedDiscount(prev => prev ? { ...prev, amount: data.discountAmount } : null);
            setDiscountError("");
          }

          console.log("[CART] calculatePrice respuesta:", data)
          setServerCalculation({
            subtotal: Number(data.subtotal || 0),
            deliveryFee: Number(data.deliveryFee || 0),
            total: Number(data.total || 0),
          })
        } else {
          setServerCalculation(null)
          setServerCalcError("No se pudo calcular el total en el servidor")
        }
      } catch (error) {
        if (!isActive) return
        setServerCalculation(null)
        setServerCalcError("No se pudo calcular el total en el servidor")
      } finally {
        if (isActive) setIsServerCalcLoading(false)
      }
    }

    calculateServerTotal()

    return () => {
      isActive = false
    }
  }, [items, isDelivery, selectedLocation?.lat, selectedLocation?.lng, appliedDiscount?.code])

  const validateGuestCheckoutData = () => {
    if (user?.id) {
      setGuestFormError("")
      return true
    }

    const trimmedName = guestName.trim()
    const trimmedPhone = guestPhone.trim()
    const trimmedEmail = guestEmail.trim()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (trimmedName.length < 2) {
      setGuestFormError("Ingresa tu nombre para continuar")
      return false
    }

    if (trimmedPhone.length < 8) {
      setGuestFormError("Ingresa un teléfono válido para coordinar tu pedido")
      return false
    }

    if (!emailRegex.test(trimmedEmail)) {
      setGuestFormError("Ingresa un correo electrónico válido")
      return false
    }

    setGuestFormError("")
    return true
  }

  const handleContinue = () => {
    // VALIDACIÓN CRÍTICA: Verificar horario comercial PRIMERO
    if (!isOpen) {
      const horario = config ? `${config.openingTime} - ${config.closingTime}` : "18:00 - 23:30"
      toast({
        title: "Fuera de horario comercial",
        description: `Lo sentimos, actualmente estamos cerrados. Nuestro horario de atención es de ${horario}. Vuelve en ese horario para realizar tu pedido.`,
        variant: "destructive",
        duration: 8000,
      })
      return
    }

    // Validar que el usuario haya seleccionado retiro o delivery
    if (isDelivery === null) {
      toast({
        title: "Selecciona tipo de entrega",
        description: "Debes elegir si quieres retirar en local o recibir delivery antes de continuar.",
        variant: "destructive"
      })
      return
    }

    if (items.length > 0) {
      if (!validateBeverageStock()) {
        return
      }

      if (!isDelivery) {
        setCurrentView("payment")
      } else {
        setCurrentView("address")
      }
    }
  }

  const isValidHouseNumber = (num: string): boolean => {
    const clean = (num || "").trim()
    if (!clean) return false
    if (/^s\/n$/i.test(clean)) return true
    return /\d{1,5}/.test(clean)
  }

  const handleAddressSubmit = () => {
    // Debe existir una zona definida (no aceptar fallback fuera de zonas) y estar disponible
    if (!deliveryInfo.zone) {
      toast({
        title: "Ubicación fuera de zonas",
        description: "La dirección seleccionada no pertenece a nuestras zonas de delivery. Selecciona una ubicación dentro de la cobertura.",
        variant: "destructive"
      })
      return
    }
    if (!deliveryInfo.disponible) {
      toast({
        title: "Zona no disponible",
        description: "La zona seleccionada actualmente no presta servicio. Elige otra zona activa.",
        variant: "destructive"
      })
      return
    }
    if (!calle.trim() || !isValidHouseNumber(numero)) {
      setHasCheckedAddressNumber(true)
      toast({
        title: "Falta el número de dirección",
        description: "Es obligatorio ingresar el número de tu domicilio o seleccionar S/N para continuar.",
        variant: "destructive"
      })
      return
    }
    if (selectedLocation) {
      setCurrentView("payment")
    } else {
      toast({
        title: "Campos incompletos",
        description: "Por favor confirma tu punto en el mapa.",
        variant: "destructive"
      })
    }
  }

  const geocodeAndCenterMap = async (streetText: string, houseNumber: string) => {
    const cleanStreet = streetText.trim()
    const cleanNumber = houseNumber.trim()
    if (!cleanStreet) return

    // No ubicar el punto en un número aleatorio si el cliente aún no ingresa numeración o "S/N"
    if (!cleanNumber) {
      setHasCheckedAddressNumber(true)
      toast({
        title: "Falta el número de dirección",
        description: "Ingresa el número de tu domicilio o selecciona S/N antes de ubicarlo en el mapa.",
        variant: "destructive",
      })
      return
    }

    setIsGeocodingAddress(true)
    try {
      const isSinNumero = cleanNumber.toUpperCase() === "S/N"
      const fullQuery = isSinNumero
        ? `${cleanStreet}, Los Andes, Chile`
        : `${cleanStreet} ${cleanNumber}, Los Andes, Chile`

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullQuery)}&limit=1&accept-language=es`
      )
      const data = await response.json()

      if (Array.isArray(data) && data.length > 0) {
        const lat = parseFloat(data[0].lat)
        const lng = parseFloat(data[0].lon)
        const formattedAddr = isSinNumero ? `${cleanStreet} S/N` : `${cleanStreet} ${cleanNumber}`

        setSelectedLocation({ lat, lng, address: formattedAddr })
        if (!comuna) {
          setComuna("Los Andes")
        }

        // Detectar zona y tarifa automáticamente
        const { detectarZonaCliente } = await import("../../lib/delivery-zones")
        const result = detectarZonaCliente(lat, lng, deliveryZones)
        if (result.zona) {
          handleDeliveryInfoChange(result.zona, result.disponible ? result.tarifa : 0, !!result.disponible)
        } else {
          handleDeliveryInfoChange(null, 0, false)
        }
      } else {
        toast({
          title: "Dirección no encontrada exactamente",
          description: "Puedes ajustar el punto directamente haciendo clic en el mapa.",
        })
      }
    } catch (error) {
      console.error("Error geocodificando dirección:", error)
    } finally {
      setIsGeocodingAddress(false)
    }
  }

  const handleAddStreetNumber = async () => {
    const cleanNum = numberDraft.trim()
    if (!cleanNum) {
      toast({
        title: "Ingresa un número",
        description: "Escribe el número de tu casa o edificio para ubicarlo en el mapa.",
        variant: "destructive",
      })
      return
    }
    setNumero(cleanNum)
    setHasCheckedAddressNumber(false)
    const rawText = (addressQuery || calle).trim()
    if (rawText) {
      const parts = rawText.split(",")
      const streetOnly = parts[0].trim()
      const rest = parts.slice(1).join(",").trim()
      setCalle(streetOnly)
      const updatedDisplay = rest ? `${streetOnly} ${cleanNum}, ${rest}` : `${streetOnly} ${cleanNum}`
      setAddressQuery(updatedDisplay)
      // Si el cliente ya pinchó un punto en el mapa, respetar esas coordenadas exactas
      if (selectedLocation) {
        setSelectedLocation({ ...selectedLocation, address: updatedDisplay })
      } else {
        await geocodeAndCenterMap(streetOnly, cleanNum)
      }
    }
  }

  const handleSelectSinNumero = async () => {
    setNumero("S/N")
    setNumberDraft("S/N")
    setHasCheckedAddressNumber(false)
    const rawText = (addressQuery || calle).trim()
    if (rawText) {
      const parts = rawText.split(",")
      const streetOnly = parts[0].trim()
      const rest = parts.slice(1).join(",").trim()
      setCalle(streetOnly)
      const updatedDisplay = rest ? `${streetOnly} S/N, ${rest}` : `${streetOnly} S/N`
      setAddressQuery(updatedDisplay)
      // Si el cliente ya pinchó un punto en el mapa, respetar esas coordenadas exactas
      if (selectedLocation) {
        setSelectedLocation({ ...selectedLocation, address: updatedDisplay })
      } else {
        await geocodeAndCenterMap(streetOnly, "S/N")
      }
    }
  }

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Geolocalización no soportada",
        description: "Tu navegador no permite obtener la ubicación actual.",
        variant: "destructive",
      })
      return
    }

    setIsLocatingUser(true)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=es`
          )
          const data = await response.json()
          const addr = data?.address || {}
          const road = addr.road || addr.pedestrian || addr.suburb || ""
          const houseNumber = addr.house_number || ""
          const city = addr.city || addr.town || addr.village || "Los Andes"

          if (road) {
            setCalle(road)
            setComuna(city)
            if (houseNumber) {
              setNumero(houseNumber)
              setNumberDraft(houseNumber)
              setAddressQuery(`${road} ${houseNumber}, ${city}`)
            } else {
              setAddressQuery(`${road}, ${city}`)
            }
          }

          setSelectedLocation({ lat, lng, address: data?.display_name || `${road} ${houseNumber}`.trim() })

          const { detectarZonaCliente } = await import("../../lib/delivery-zones")
          const result = detectarZonaCliente(lat, lng, deliveryZones)
          if (result.zona) {
            handleDeliveryInfoChange(result.zona, result.disponible ? result.tarifa : 0, !!result.disponible)
          } else {
            handleDeliveryInfoChange(null, 0, false)
          }
        } catch (err) {
          console.error("Error en geocodificación inversa:", err)
          setSelectedLocation({ lat, lng })
        } finally {
          setIsLocatingUser(false)
        }
      },
      (error) => {
        console.error("Error obteniendo ubicación:", error)
        setIsLocatingUser(false)
        toast({
          title: "No se pudo obtener tu ubicación",
          description: "Verifica los permisos de ubicación o selecciona tu punto en el mapa.",
          variant: "destructive",
        })
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const handleSavePhoneAndContinue = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phoneInput || phoneInput.trim() === "") {
      toast({
        title: "Campo requerido",
        description: "Por favor ingresa tu número de celular para continuar.",
        variant: "destructive",
      })
      return
    }

    setIsSavingPhone(true)
    try {
      if (user?.id) {
        // 1. Guardar en Firestore directamente
        const userRef = doc(db, "users", user.id)
        await updateDoc(userRef, {
          telefono: phoneInput.trim(),
          phone: phoneInput.trim(),
          updatedAt: serverTimestamp(),
        })

        // 2. Actualizar el estado del usuario localmente en AuthContext
        await updateUser({
          phone: phoneInput.trim(),
          telefono: phoneInput.trim(),
        } as any)

        // 3. Cambiar vista a payment
        setCurrentView("payment")

        // 4. Mostrar feedback positivo
        toast({
          title: "Teléfono registrado",
          description: "Tu número de teléfono ha sido guardado exitosamente.",
        })

        // 5. Continuar inmediatamente con el flujo de pago
        setTimeout(() => {
          handlePayment()
        }, 100)
      }
    } catch (error) {
      console.error("Error al guardar el teléfono:", error)
      toast({
        title: "Error al guardar",
        description: "No pudimos guardar tu teléfono en este momento. Inténtalo de nuevo.",
        variant: "destructive",
      })
    } finally {
      setIsSavingPhone(false)
    }
  }

  const handlePayment = async () => {
    console.log(`🔵 === INICIO handlePayment ===`)
    console.log(`🔵 Usuario autenticado:`, isAuthenticated)
    console.log(`🔵 Usuario:`, user)
    console.log(`🔵 User ID:`, user?.id)
    console.log(`🔵 User name:`, user?.name)
    console.log(`🔵 User phone:`, user?.phone)
    console.log(`🔵 User email:`, user?.email)

    // VALIDACIÓN CRÍTICA: Verificar horario comercial ANTES de cualquier otra validación
    if (!isOpen) {
      const horario = config ? `${config.openingTime} - ${config.closingTime}` : "18:00 - 23:30"
      toast({
        title: "Fuera de horario comercial",
        description: `Lo sentimos, actualmente estamos cerrados. Nuestro horario de atención es de ${horario}. Vuelve en ese horario para realizar tu pedido.`,
        variant: "destructive",
        duration: 8000,
      })
      return
    }

    if (!validateBeverageStock()) {
      return
    }

    // Validar pago en efectivo si es el método seleccionado y el total es mayor a $0
    if (paymentMethod === "efectivo" && totalFinal > 0) {
      if (!cashAmount || cashAmount.trim() === "") {
        setCashAmountError("Por favor ingresa el monto con el que vas a pagar")
        return
      }

      const numericAmount = parseFloat(cashAmount)
      if (isNaN(numericAmount) || numericAmount <= 0) {
        setCashAmountError("Ingresa un monto válido")
        return
      }

      if (numericAmount < totalFinal) {
        setCashAmountError(`El monto debe ser mayor o igual a $${totalFinal.toLocaleString()}`)
        return
      }
    }

    // Validaciones adicionales específicas de delivery respecto a zonas activas
    if (isDelivery) {
      // Si no hay info de delivery aún, bloquear
      if (!deliveryInfo) {
        toast({
          title: "Validando ubicación",
          description: "Aún no se ha verificado la zona de delivery. Intenta nuevamente en unos segundos.",
          variant: "destructive"
        })
        return
      }
      // Si la zona existe pero está inactiva
      if (deliveryInfo.zone && !deliveryInfo.disponible) {
        toast({
          title: "Zona inactiva",
          description: `La zona "${deliveryInfo.zone.nombre}" no está activa para delivery actualmente. Elige otra ubicación dentro de una zona disponible.`,
          variant: "destructive"
        })
        return
      }
      // Si no hay zona definida (aunque el fallback marque disponible) bloquear
      if (!deliveryInfo.zone) {
        toast({
          title: "Fuera de cobertura",
          description: "Tu ubicación no pertenece a ninguna de las zonas de delivery configuradas. Ajusta el punto dentro de la cobertura.",
          variant: "destructive"
        })
        return
      }
    }

    // [PHONE VERIFICATION] Verificar si el usuario autenticado tiene un teléfono registrado
    if (isAuthenticated && user) {
      const hasPhone = (user.phone && user.phone.trim() !== "") || ((user as any).telefono && (user as any).telefono.trim() !== "")
      if (!hasPhone) {
        console.log("⚠️ Usuario autenticado no tiene teléfono registrado. Redirigiendo a vista de registro de teléfono.")
        setCurrentView("phone-registration")
        return
      }
    }

    setIsProcessing(true)

    // Si el método de pago es Webpay, mostrar indicador de redirección ANTES de procesar
    if (paymentMethod === "webpay") {
      console.log("🔄 Mostrando indicador de redirección a WebPay")
      setRedirectingProvider("webpay")
      setIsRedirectingToWebpay(true)

      // Usar requestAnimationFrame para asegurar que el navegador pinte el overlay
      // antes de continuar con el procesamiento
      await new Promise(resolve => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(resolve, 50)
          })
        })
      })
      console.log("🎨 Overlay debería estar visible ahora")
    }

    try {
      // Crear el pedido en Firestore
      console.log(`🔵 === CREANDO PEDIDO ===`)
      const hasAuthenticatedUser = Boolean(user?.id)
      const customerType = hasAuthenticatedUser ? "registered" : "guest"
      const guestCliente = {
        nombre: guestName.trim(),
        telefono: guestPhone.trim(),
        email: guestEmail.trim()
      }
      const customerData = hasAuthenticatedUser
        ? {
          nombre: user?.name || 'Usuario Anónimo',
          telefono: user?.phone || '',
          email: user?.email || ''
        }
        : guestCliente

      if (!validateGuestCheckoutData()) {
        toast({
          title: "Faltan datos del cliente",
          description: "Completa nombre, teléfono y correo válido para continuar con el pedido.",
          variant: "destructive",
        })
        setIsProcessing(false)
        return
      }

      const orderData: any = {
        userId: hasAuthenticatedUser ? user?.id : undefined,
        customerType,
        cliente: {
          nombre: customerData.nombre,
          telefono: customerData.telefono,
          email: customerData.email
        },
        tipoEntrega: isDelivery ? "Delivery" as const : "Retiro" as const,
        metodoPago: paymentMethod === "efectivo" ? "Efectivo" as const :
          paymentMethod === "webpay" ? "Webpay Plus" as const : "Transferencia" as const,
        isKhipu: IS_KHIPU_ENABLED
      }

      console.log(`🔵 OrderData preparado:`, JSON.stringify(orderData, null, 2))

      // Solo agregar tiempo estimado si no es undefined
      if (estimatedTime && estimatedTime !== "") {
        orderData.tiempoEstimado = estimatedTime
      }

      // Solo agregar dirección si es delivery
      if (isDelivery) {
        const cleanNumero = (numero || '').trim()
        // Limpiar calle para que no incluya el número ni la comuna duplicados
        let cleanCalle = (calle || '').split(',')[0].trim()
        if (cleanNumero && cleanNumero.toUpperCase() !== 'S/N') {
          const escapedNum = cleanNumero.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          cleanCalle = cleanCalle.replace(new RegExp(`\\s+(?:#|n°|nro\\.?\\s*)?${escapedNum}$`, 'i'), '').trim()
        } else if (cleanNumero.toUpperCase() === 'S/N') {
          cleanCalle = cleanCalle.replace(/\s+s\/n$/i, '').trim()
        }

        orderData.direccion = {
          calle: cleanCalle,
          numero: cleanNumero,
          depto: depto || '',
          comuna: (comuna || '').trim() || 'Los Andes',
          referencia: referencia || '',
          lat: selectedLocation?.lat,
          lng: selectedLocation?.lng
        }
      }

      const verifyServerTotal = async () => {
        const orderItems = items.map(item => {
          const inferredMenuName = !item.selectedMenuPizza && /^pizza\s+/i.test(item.name)
            ? item.name
              .replace(/^pizza\s+/i, '')
              .replace(/\s*\((?:familiar|mediana|personal|grande|f|m|p|g)\)\s*$/i, '')
              .trim()
            : item.selectedMenuPizza
          const normalizedPizzaType = inferredMenuName && item.pizzaType === 'promo' ? 'premium' : item.pizzaType

          return {
            nombre: item.name,
            cantidad: item.quantity,
            precio: item.price,
            size: item.size,
            ingredients: item.ingredients,
            premiumIngredients: item.premiumIngredients,
            sauces: item.sauces,
            drinks: item.drinks,
            extras: item.extras,
            comments: item.comments,
            pizzaType: normalizedPizzaType,
            pizza1: item.pizza1,
            pizza2: item.pizza2,
            half1: item.half1,
            half2: item.half2,
            selectedMenuPizza: inferredMenuName,
          }
        })

        const calculatePriceFn = httpsCallable(functions, "calculatePrice")
        const response = await calculatePriceFn({
          items: orderItems,
          tipoEntrega: isDelivery ? "Delivery" : "Retiro",
          direccion: isDelivery
            ? { lat: selectedLocation?.lat, lng: selectedLocation?.lng }
            : undefined,
          discountCode: appliedDiscount?.code,
        })

        const data = response.data as any
        if (!data?.success) {
          throw new Error("No se pudo calcular el total en el servidor")
        }

        return {
          subtotal: Number(data.subtotal || 0),
          deliveryFee: Number(data.deliveryFee || 0),
          total: Number(data.total || 0),
        }
      }

      let verifiedCalculation: { subtotal: number; deliveryFee: number; total: number } | null = null
      try {
        if (isServerCalcLoading || serverCalcError) {
          verifiedCalculation = await verifyServerTotal()
          setServerCalculation(verifiedCalculation)
        } else {
          verifiedCalculation = serverCalculation
        }
      } catch (error) {
        toast({
          title: "No se pudo validar el total",
          description: "Intenta nuevamente para confirmar el pedido.",
          variant: "destructive",
        })
        setIsProcessing(false)
        return
      }

      const verifiedTotal = Math.max(0, (verifiedCalculation?.total ?? totalFinal) - discountAmount)

      // Solo agregar detalles de pago si es efectivo y el total es mayor a $0
      if (paymentMethod === "efectivo" && verifiedTotal > 0) {
        orderData.paymentDetails = {
          cashAmount: parseFloat(cashAmount),
          change: parseFloat(cashAmount) - verifiedTotal
        }
      }

      // Construir notas finales (la referencia de dirección se mantiene solo en direccion.referencia para el repartidor)
      let notasFinales = ''
      if (appliedDiscount && appliedDiscount.code) {
        const promoText = `[CÓDIGO USADO: ${appliedDiscount.code}]`
        notasFinales = notasFinales ? `${notasFinales} | ${promoText}` : promoText
      }
      if (notasFinales !== '') {
        orderData.notas = notasFinales
      }

      if (appliedDiscount) {
        orderData.discountCode = appliedDiscount.code
        orderData.discountAmount = appliedDiscount.amount
      }

      orderData.subtotal = verifiedCalculation?.subtotal ?? subtotal
      orderData.valorDelivery = isDelivery ? (verifiedCalculation?.deliveryFee ?? deliveryCost) : 0
      orderData.total = verifiedTotal

      // Crear el pedido (ya incluye validación de inventario)
      console.log(`🔵 Llamando a createOrder...`)
      const result = await createOrder(orderData)

      console.log(`🔵 === RESULTADO createOrder ===`)
      console.log(`🛒 Resultado de createOrder:`, result)
      console.log(`Success:`, result.success)
      console.log(`Error code:`, result.error)
      console.log(`Order ID:`, result.id)
      console.log(`Order Number:`, result.orderNumber)

      // Verificar si la creación fue exitosa
      if (!result.success) {
        console.log('❌ Pedido NO exitoso, procesando error...')
        if (result.error === 'INVENTORY_UNAVAILABLE') {
          console.log('🚨 Error de inventario detectado')
          console.log('Validation details disponibles:', result.validationDetails)

          // Mostrar mensaje detallado en el carrito (sin toast redundante)
          if (result.validationDetails) {
            console.log('Detalles de inventario insuficiente:', result.validationDetails)
            setInventoryErrorDetails(result.validationDetails)
            setShowInventoryError(true)
            setCurrentView("cart") // Asegurarse de que el usuario vea el carrito
          }

          setIsProcessing(false)
          return
        } else {
          // Otro tipo de error
          toast({
            title: "Error al procesar el pedido",
            description: result.error || "Ha ocurrido un error inesperado. Por favor intenta nuevamente.",
            variant: "destructive",
            duration: 5000,
          })

          setIsProcessing(false)
          return
        }
      }

      console.log('Pedido creado exitosamente:', result)

      // Si es usuario registrado y pidió delivery, guardar su última dirección tras crear el pedido exitosamente
      if (hasAuthenticatedUser && user?.id && isDelivery && orderData.direccion?.lat && orderData.direccion?.lng) {
        const lastDeliveryAddress = {
          calle: orderData.direccion.calle,
          numero: orderData.direccion.numero,
          depto: orderData.direccion.depto || '',
          comuna: orderData.direccion.comuna,
          referencia: orderData.direccion.referencia || '',
          lat: orderData.direccion.lat,
          lng: orderData.direccion.lng,
          updatedAt: new Date().toISOString(),
        }
        updateDoc(doc(db, "users", user.id), {
          lastDeliveryAddress,
          updatedAt: serverTimestamp(),
        }).catch((err) => console.warn("No se pudo guardar lastDeliveryAddress:", err))
        updateUser({ lastDeliveryAddress } as any).catch(() => {})
      }

      // Si el método de pago es Webpay, iniciar transacción
      if (paymentMethod === "webpay") {
        try {
          console.log('🔵 Iniciando proceso de pago Webpay...')
          console.log('🔵 Order ID:', result.id)
          console.log('🔵 Total Final:', totalFinal)

          // Construir la URL de retorno
          const returnUrl = `${window.location.origin}/pago/webpay-return`
          console.log('🔵 Return URL:', returnUrl)

          // Llamar a la Cloud Function para iniciar transacción Webpay
          console.log('🔵 Llamando a initWebpayTransaction...')
          const initWebpayFunction = httpsCallable(functions, "initWebpayTransaction")
          const guestWebpayToken = !isAuthenticated ? result.guestAccessToken : undefined

          if (!isAuthenticated && !guestWebpayToken) {
            throw new Error("No se pudo generar token seguro para pago invitado")
          }

          const webpayResponse = await initWebpayFunction({
            orderId: result.id,
            returnUrl,
            guestAccessToken: guestWebpayToken
          })

          console.log('🔵 Respuesta de initWebpayTransaction:', webpayResponse)
          const webpayData = webpayResponse.data as any
          console.log('🔵 Webpay data:', webpayData)

          if (webpayData.success && webpayData.url && webpayData.token) {
            console.log('🔵 Transacción iniciada exitosamente')
            console.log('🔵 Token:', webpayData.token)
            console.log('🔵 URL:', webpayData.url)

            // Guardar información antes de redireccionar
            localStorage.setItem('pendingOrderId', result.id)
            localStorage.setItem('pendingOrderNumber', result.orderNumber.toString())

            // Guardar datos de seguimiento de invitado si corresponde
            if (!isAuthenticated) {
              localStorage.setItem(
                "guestTrackingData",
                JSON.stringify({
                  email: guestEmail.trim(),
                  phone: guestPhone.trim(),
                })
              )
            }

            console.log('🔵 Redireccionando a Webpay...')
            // Redireccionar a Webpay
            window.location.href = `${webpayData.url}?token_ws=${webpayData.token}`
            return
          } else {
            console.error('🔴 Error: Respuesta de Webpay incompleta:', webpayData)
            throw new Error('No se pudo iniciar la transacción con Webpay')
          }
        } catch (webpayError: any) {
          console.error('🔴 Error iniciando Webpay:', webpayError)
          console.error('🔴 Error completo:', JSON.stringify(webpayError, null, 2))
          console.error('🔴 Error message:', webpayError.message)
          console.error('🔴 Error code:', webpayError.code)

          setIsRedirectingToWebpay(false)
          setRedirectingProvider(null)

          // Mostrar mensaje de error más detallado
          const errorMessage = webpayError.message ||
            webpayError.code ||
            "No se pudo iniciar el pago. El pedido fue creado pero debes contactarnos para completar el pago."

          toast({
            title: "Error con Webpay",
            description: errorMessage,
            variant: "destructive",
            duration: 10000, // 10 segundos para que el usuario pueda leer
          })
          setIsProcessing(false)
          return
        }
      } else if (paymentMethod === "transferencia" && IS_KHIPU_ENABLED) {
        try {
          console.log('🔵 Iniciando proceso de pago Khipu...')
          console.log('🔵 Order ID:', result.id)
          console.log('🔵 Total Final:', totalFinal)
          setRedirectingProvider("khipu")
          setIsRedirectingToWebpay(true)

          const returnUrl = `${window.location.origin}/pago/khipu-return`
          console.log('🔵 Return URL:', returnUrl)

          console.log('🔵 Llamando a initKhipuTransaction...')
          const initKhipuFunction = httpsCallable(functions, "initKhipuTransaction")
          const guestKhipuToken = !isAuthenticated ? result.guestAccessToken : undefined

          if (!isAuthenticated && !guestKhipuToken) {
            throw new Error("No se pudo generar token seguro para pago invitado")
          }

          const khipuResponse = await initKhipuFunction({
            orderId: result.id,
            returnUrl,
            guestAccessToken: guestKhipuToken
          })

          console.log('🔵 Respuesta de initKhipuTransaction:', khipuResponse)
          const khipuData = khipuResponse.data as any
          console.log('🔵 Khipu data:', khipuData)

          if (khipuData.success && khipuData.url && khipuData.token) {
            console.log('🔵 Transacción de Khipu iniciada exitosamente')

            localStorage.setItem('pendingOrderId', result.id)
            localStorage.setItem('pendingOrderNumber', result.orderNumber.toString())
            localStorage.setItem('pendingPaymentProvider', 'khipu')
            localStorage.setItem('pendingPaymentId', khipuData.token)

            // Guardar datos de seguimiento de invitado si corresponde
            if (!isAuthenticated) {
              localStorage.setItem(
                "guestTrackingData",
                JSON.stringify({
                  email: guestEmail.trim(),
                  phone: guestPhone.trim(),
                })
              )
            }

            console.log('🔵 Redireccionando a Khipu...')
            window.location.href = khipuData.url
            return
          } else {
            console.error('🔴 Error: Respuesta de Khipu incompleta:', khipuData)
            throw new Error('No se pudo iniciar la transacción con Khipu')
          }
        } catch (khipuError: any) {
          console.error('🔴 Error iniciando Khipu:', khipuError)
          setIsRedirectingToWebpay(false)
          setRedirectingProvider(null)

          const errorMessage = khipuError.message ||
            khipuError.code ||
            "No se pudo iniciar el pago por transferencia automática. Intenta de nuevo o selecciona otro método."

          toast({
            title: "Error con Khipu",
            description: errorMessage,
            variant: "destructive",
            duration: 10000,
          })
          setIsProcessing(false)
          return
        }
      }

      // Para otros métodos de pago (efectivo, transferencia), continuar con flujo normal
      // Usamos el número de pedido real devuelto por Firestore
      setOrderNumber(result.orderNumber)

      if (!hasAuthenticatedUser) {
        const trackingUrl = `/seguimiento-pedido/guest?email=${encodeURIComponent(customerData.email)}&phone=${encodeURIComponent(customerData.telefono)}`
        setGuestTrackingUrl(trackingUrl)
        localStorage.setItem(
          "guestTrackingData",
          JSON.stringify({
            email: customerData.email,
            phone: customerData.telefono,
          })
        )
        // Disparar evento para que el tracker flotante se entere inmediatamente
        window.dispatchEvent(new Event('guestOrderCreated'))
      }

      // Guardar el total confirmado antes de cambiar de vista
      setConfirmedTotal(verifiedTotal)

      // Cambiamos a la vista de confirmación
      setCurrentView("confirmation")

      // Limpiamos el carrito DESPUÉS del tiempo mostrado en el mensaje (10 segundos)
      setTimeout(() => {
        clearCart()
        setAppliedDiscount(null)
        setDiscountCode("")

        setGuestTrackingUrl("")
        setExpandedItems({})
        setCurrentView("cart")
        // Cerrar el Sheet después de limpiar con un pequeño delay para animación
        setTimeout(() => {
          onClose?.()
        }, 300)
      }, 10000) // 10 segundos para que el usuario pueda ver la confirmación

      // Limpiar datos de efectivo
      setCashAmount("")
      setCashAmountError("")
    } catch (error) {
      console.error("🔴 Error al crear el pedido:", error)

      // Ocultar overlay de Webpay si estaba visible
      setIsRedirectingToWebpay(false)
      setRedirectingProvider(null)

      // Mostrar error al usuario
      toast({
        title: "Error al procesar el pedido",
        description: error instanceof Error ? error.message : "Ha ocurrido un error inesperado. Inténtalo de nuevo.",
        variant: "destructive",
        duration: 7000,
      })
    } finally {
      setIsProcessing(false)
      // Asegurar que el overlay se oculte siempre
      setIsRedirectingToWebpay(false)
      setRedirectingProvider(null)
    }
  }

  const handleApplyDiscount = () => {
    const code = discountCode.toUpperCase().trim()
    if (!code) {
      setDiscountError("Ingresa un código de descuento")
      return
    }

    // Al establecer el código aquí, el useEffect superior enviará la petición al servidor (calculatePrice)
    // para validarlo en tiempo real en la base de datos de Firestore.
    setAppliedDiscount({ code, amount: 0 });
    setDiscountCode("");
    setDiscountError("");
  }

  const handleRemoveDiscount = () => {
    setAppliedDiscount(null)
    setDiscountCode("")
    setDiscountError("")
  }

  // Montar/desmontar el selector de ubicación para forzar recarga
  const [mapKey, setMapKey] = useState<number>(0)
  const [hasInitializedMap, setHasInitializedMap] = useState(false)

  // Inicializar el mapa una sola vez cuando se muestra la vista de dirección
  useEffect(() => {
    if (currentView === "address" && isDelivery && !hasInitializedMap) {
      console.log("Inicializando componente de mapa por primera vez");
      setMapKey(1); // Establecer en 1 para que se renderice
      setHasInitializedMap(true);
    }

    // Resetear cuando se sale de la vista de dirección
    if (currentView !== "address") {
      setHasInitializedMap(false);
    }
  }, [currentView, isDelivery, hasInitializedMap]);

  // Limpieza del mapa cuando el usuario abandona la vista de dirección
  useEffect(() => {
    if (currentView !== "address" && document) {
      // Limpiar cualquier mapa residual
      const mapContainers = document.querySelectorAll('.leaflet-container');
      mapContainers.forEach(container => {
        try {
          container.remove();
        } catch (err) {
          console.error("Error al limpiar contenedor de mapa:", err);
        }
      });
    }
  }, [currentView]);

  const goBack = () => {
    if (currentView === "address" || currentView === "payment") {
      setCurrentView("cart")
    }
  }

  const handleLoginRedirect = () => {
    window.location.href = "/auth"
  }

  const handleLocationSelect = useCallback((lat: number, lng: number, address?: string) => {
    setSelectedLocation({ lat, lng, address })
    if (address) {
      const addressParts = address.split(",")
      const streetPart = addressParts[0]?.trim() || ""
      const comunaPart = addressParts.length >= 2 ? addressParts[addressParts.length - 1].trim() : "Los Andes"

      // Detectar si Nominatim devolvió un número al final de la calle (evita confundir calles como "18 de Septiembre")
      const numMatch = streetPart.match(/\s+(\d{1,5}[a-zA-Z]?)$/)
      if (numMatch) {
        const streetOnly = streetPart.replace(/\s+\d{1,5}[a-zA-Z]?$/, "").trim()
        setCalle(streetOnly)
        setNumero(numMatch[1])
        setNumberDraft(numMatch[1])
        setHasCheckedAddressNumber(false)
        setAddressQuery(addressParts.slice(0, 2).join(", ").trim())
      } else if (streetPart) {
        setCalle(streetPart)
        if (isValidHouseNumber(numero)) {
          // Conservar el número que el cliente ya había ingresado al ajustar el punto
          setAddressQuery(`${streetPart} ${numero.trim()}, ${comunaPart}`)
          setHasCheckedAddressNumber(false)
        } else {
          setNumero("")
          setAddressQuery(addressParts.slice(0, 2).join(", ").trim())
          setHasCheckedAddressNumber(true)
        }
      }

      setComuna(comunaPart || "Los Andes")
    }
  }, [numero])

  const handleDeliveryInfoChange = useCallback((zone: DeliveryZone | null, tarifa: number, disponible: boolean) => {
    setDeliveryInfo({ zone, tarifa, disponible })
    if (zone && disponible) {
      setEstimatedTime(zone.tiempoEstimado)
    } else {
      setEstimatedTime("20-25 minutos")
    }
  }, [])

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Resetear completamente el estado local del carrito al cerrar sesión
  useEffect(() => {
    const handleCartReset = () => {
      setCurrentView("cart")
      setIsDelivery(null)
      setCalle("")
      setNumero("")
      setNumberDraft("")
      setDepto("")
      setComuna("")
      setReferencia("")
      setAddressQuery("")
      setSelectedLocation(null)
      setDeliveryInfo({ zone: null, tarifa: 0, disponible: false })
      setHasCheckedAddressNumber(false)
      setHasAskedLastAddress(false)
      setShowLastAddressModal(false)
      setAppliedDiscount(null)
      setDiscountCode("")
      setDiscountError("")
      setCashAmount("")
      setCashAmountError("")
      setExpandedItems({})
      setExpandedPrepOptions({})
      setIsExtrasOpen(false)
    }
    window.addEventListener("palermo:cart-clear", handleCartReset)
    return () => window.removeEventListener("palermo:cart-clear", handleCartReset)
  }, [])

  // Mostrar modal de última dirección registrada al entrar a "Dirección de Entrega" (solo usuarios con cuenta)
  useEffect(() => {
    if (currentView === "address" && isAuthenticated && user?.id && !hasAskedLastAddress) {
      const saved = (user as any)?.lastDeliveryAddress
      if (saved && saved.calle && saved.numero && typeof saved.lat === "number" && typeof saved.lng === "number") {
        setShowLastAddressModal(true)
        setHasAskedLastAddress(true)
      }
    }
    if (currentView !== "address") {
      setShowLastAddressModal(false)
    }
  }, [currentView, isAuthenticated, user, hasAskedLastAddress])

  // Función para obtener el precio real de un extra
  const getExtraPrice = (extraName: string) => {
    const extraPrices = {
      Ajo: 700,
      Chimichurri: 700,
      Pesto: 1000,
      "Coca Cola Lata": 1500,
      "Coca Cola 1.5L": 2900,
      "Rollitos de Canela": 4900,
      "Gauchitos x24": 7000,
      "Gauchitos x12": 4000,
      Gauchitos: 4000,
    }

    for (const [name, price] of Object.entries(extraPrices)) {
      if (extraName.includes(name)) {
        return price
      }
    }
    return 0
  }

  // Función para calcular ingredientes extras
  const calculateExtraIngredients = (item: any) => {
    const isPremium = item.name.includes("Premium")
    const isPromo = item.name.includes("Promo")

    if (!item.ingredients && !item.premiumIngredients) return { extraSimple: 0, extraPremium: 0 }

    const simpleCount = item.ingredients ? item.ingredients.length : 0
    const premiumCount = item.premiumIngredients ? item.premiumIngredients.length : 0

    if (isPromo) {
      const extraSimple = Math.max(0, simpleCount - 2)
      return { extraSimple, extraPremium: 0 }
    } else if (isPremium) {
      const extraPremium = Math.max(0, premiumCount - 1)
      const extraSimple = simpleCount
      return { extraSimple, extraPremium }
    }

    return { extraSimple: 0, extraPremium: 0 }
  }

  // Función para obtener precios de ingredientes según tamaño (desde Firebase)
  const getIngredientPrices = (size: string) => {
    // Si aún no se cargaron los precios, usar fallback
    if (!preciosConfig) {
      if (size === "Mediana") {
        return { simple: 700, premium: 2500 }
      } else {
        return { simple: 1000, premium: 3500 }
      }
    }

    // Usar precios desde Firebase
    if (size === "Mediana") {
      return {
        simple: preciosConfig.pizzaSizes.mediana.simpleExtraPrice,
        premium: preciosConfig.pizzaSizes.mediana.premiumExtraPrice
      }
    } else {
      return {
        simple: preciosConfig.pizzaSizes.familiar.simpleExtraPrice,
        premium: preciosConfig.pizzaSizes.familiar.premiumExtraPrice
      }
    }
  }

  if (!isMounted) {
    return null
  }

  // Vista de confirmación tiene prioridad sobre otras vistas
  if (currentView === "confirmation") {
    return (
      <div className="flex-1 w-full h-full min-h-0 flex flex-col bg-white overflow-y-auto">
        <div className="flex-1 p-6 text-center">
          {/* Icono de confirmación grande y animado */}
          <div className="flex justify-center mb-6">
            <div className="bg-green-100 p-6 rounded-full shadow-lg animate-pulse">
              <CheckCircle className="h-20 w-20 text-green-600" strokeWidth={1.5} />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-green-600 mb-6">¡Pedido Confirmado!</h2>

          {/* Número de pedido destacado */}
          <div className="bg-pink-50 py-6 px-6 rounded-lg border-2 border-pink-300 mb-6 shadow-md">
            <h3 className="text-sm uppercase tracking-wider font-medium text-gray-600 mb-3">Número de Pedido</h3>
            <div className="text-5xl font-extrabold text-pink-600">#{orderNumber}</div>
          </div>

          {/* Instrucciones para seguimiento */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-4">
            <h3 className="font-medium text-gray-800 mb-2 flex items-center justify-center">
              <ArrowRightCircle className="h-5 w-5 text-blue-600 mr-2" />
              Seguimiento de Pedido
            </h3>
            {isAuthenticated ? (
              <p className="text-gray-700">
                Sigue el estado de tu pedido en la sección de
                <Link href="/pedidos" className="font-bold text-blue-600 hover:underline mx-1">
                  "Mis Pedidos"
                </Link>
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-gray-700">
                  Como invitado, puedes seguir el estado de este pedido desde aquí:
                </p>
                <Link href={guestTrackingUrl || "/seguimiento-pedido/guest"} className="inline-block font-bold text-blue-600 hover:underline">
                  Ver seguimiento de mi pedido
                </Link>
              </div>
            )}
          </div>

          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4">
            <h3 className="font-medium text-gray-800 mb-2">Tiempo Estimado</h3>
            <p className="text-xl font-bold text-pink-600">{estimatedTime}</p>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-4">
            <h3 className="font-medium text-gray-800 mb-2">Total Pagado</h3>
            <p className="text-xl font-bold text-blue-600">${confirmedTotal.toLocaleString()}</p>
          </div>

          {isDelivery && deliveryInfo.zone && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-4">
              <h3 className="font-medium text-gray-800 mb-2">Información de Delivery</h3>
              <p className="text-sm text-gray-600">Zona: {deliveryInfo.zone.nombre}</p>
              <p className="text-sm text-gray-600">Costo: ${deliveryInfo.tarifa.toLocaleString()}</p>
            </div>
          )}

          <p className="text-xs text-gray-500 mt-4 mb-4">El carrito se limpiará automáticamente en 10 segundos...</p>
        </div>
      </div>
    )
  }

  // Si no estamos en la vista de confirmación y el carrito está vacío
  if (items.length === 0) {
    return (
      <div className="flex-1 w-full h-full min-h-0 flex flex-col bg-white">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-800">Tu Carrito</h2>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="w-20 h-20 bg-pink-50 rounded-full flex items-center justify-center shadow-inner">
            <Image
              src="/iconos/header/carro.svg"
              alt="Carrito vacío"
              width={46}
              height={46}
              className="opacity-40"
            />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-800">Tu carrito está vacío</p>
            <p className="text-sm text-gray-500 mt-1 max-w-xs">
              Agrega tus pizzas y acompañamientos favoritos para comenzar tu pedido.
            </p>
          </div>
          {onClose && (
            <Button
              onClick={onClose}
              className="bg-pink-600 hover:bg-pink-700 text-white font-bold px-6 py-2 rounded-lg shadow-md transition-all active:scale-95"
            >
              Ver Menú
            </Button>
          )}
        </div>
      </div>
    )
  }

  const handleAcceptLastAddress = async () => {
    const saved = (user as any)?.lastDeliveryAddress
    if (!saved) {
      setShowLastAddressModal(false)
      return
    }

    const savedCalle = String(saved.calle || "").trim()
    const savedNumero = String(saved.numero || "").trim()
    const savedComuna = String(saved.comuna || "Los Andes").trim()
    const savedRef = String(saved.referencia || "").trim()
    const savedDepto = String(saved.depto || "").trim()
    const displayAddr = `${savedCalle} ${savedNumero}${savedComuna ? `, ${savedComuna}` : ""}`

    setCalle(savedCalle)
    setNumero(savedNumero)
    setNumberDraft(savedNumero)
    setDepto(savedDepto)
    setComuna(savedComuna)
    setReferencia(savedRef)
    setAddressQuery(displayAddr)
    setHasCheckedAddressNumber(false)
    setSelectedLocation({ lat: saved.lat, lng: saved.lng, address: displayAddr })

    const { detectarZonaCliente } = await import("../../lib/delivery-zones")
    const result = detectarZonaCliente(saved.lat, saved.lng, deliveryZones)
    if (result.zona) {
      handleDeliveryInfoChange(result.zona, result.disponible ? result.tarifa : 0, !!result.disponible)
    } else {
      handleDeliveryInfoChange(null, 0, false)
    }

    setShowLastAddressModal(false)
  }

  // Vista de dirección
  if (currentView === "address") {
    const needsHouseNumber = hasCheckedAddressNumber && addressQuery.trim().length > 0 && !numero.trim()

    return (
      <div className="flex-1 w-full h-full min-h-0 flex flex-col bg-white relative">
        {/* Modal sobre el carrito para usar la última dirección registrada */}
        {showLastAddressModal && (user as any)?.lastDeliveryAddress && (
          <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-sm w-full p-5 sm:p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-gray-900 leading-tight">
                    ¿Enviamos el pedido a tu última dirección registrada?
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Encontramos la dirección de tu último delivery:
                  </p>
                </div>
              </div>

              <div className="bg-pink-50/60 border border-pink-100 rounded-xl p-3.5 text-sm space-y-1">
                <p className="font-bold text-gray-900">
                  {(user as any).lastDeliveryAddress.calle} {(user as any).lastDeliveryAddress.numero}
                  {(user as any).lastDeliveryAddress.comuna ? `, ${(user as any).lastDeliveryAddress.comuna}` : ""}
                </p>
                {(user as any).lastDeliveryAddress.referencia && (
                  <p className="text-xs text-gray-600">
                    Ref: {(user as any).lastDeliveryAddress.referencia}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowLastAddressModal(false)}
                  className="h-11 rounded-xl border-gray-300 text-gray-700 hover:bg-gray-100 font-bold"
                >
                  No
                </Button>
                <Button
                  type="button"
                  onClick={handleAcceptLastAddress}
                  className="h-11 rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-bold shadow-md"
                >
                  Sí
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="flex items-center">
            <Button variant="ghost" size="icon" onClick={goBack} className="mr-2 hover:bg-gray-200">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center">
              <MapPin className="h-5 w-5 text-pink-600 mr-2" />
              <h2 className="text-xl font-bold text-gray-800">Dirección de Entrega</h2>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 1. Buscador / Input principal de dirección */}
          <div className="space-y-2">
            <Label htmlFor="address-search" className="text-sm font-bold text-gray-900 block">
              ¿Dónde te lo llevamos?
            </Label>
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-gray-500 absolute left-3.5 pointer-events-none" />
              <Input
                id="address-search"
                value={addressQuery}
                onChange={(e) => {
                  const val = e.target.value
                  setAddressQuery(val)
                  setHasCheckedAddressNumber(false)
                  // Detectar número de domicilio al final de la calle (antes de una coma opcional) o "S/N"
                  const parts = val.split(",")
                  const streetSegment = (parts[0] || "").trim()
                  const comunaSegment = parts.slice(1).join(",").trim()
                  if (comunaSegment) {
                    setComuna(comunaSegment)
                  }

                  const hasSinNumero = /\bs\/n\b/i.test(streetSegment)
                  const numMatch = streetSegment.match(/\s+(?:#|n°|nro\.?\s*)?(\d{1,5}[a-zA-Z]?)$/i)
                  if (hasSinNumero) {
                    setCalle(streetSegment.replace(/\s+s\/n$/i, "").trim())
                    setNumero("S/N")
                  } else if (numMatch) {
                    setCalle(streetSegment.replace(/\s+(?:#|n°|nro\.?\s*)?\d{1,5}[a-zA-Z]?$/i, "").trim())
                    setNumero(numMatch[1])
                  } else {
                    setCalle(streetSegment)
                    setNumero("")
                  }
                }}
                onBlur={() => {
                  if (addressQuery.trim().length > 0 && !numero.trim()) {
                    setHasCheckedAddressNumber(true)
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    geocodeAndCenterMap(addressQuery, numero)
                  }
                }}
                placeholder="Ej. Av. Santa Teresa, Los Andes"
                className="h-11 pl-10 pr-24 rounded-xl border-2 border-pink-400/80 focus-visible:ring-pink-500 focus-visible:border-pink-600 text-sm text-gray-900 bg-white"
              />
              {addressQuery.trim() && (
                <button
                  type="button"
                  onClick={() => geocodeAndCenterMap(addressQuery, numero)}
                  disabled={isGeocodingAddress}
                  className="absolute right-2 px-2.5 py-1 text-xs font-bold text-pink-600 hover:bg-pink-50 rounded-lg transition-colors !min-h-0 !min-w-0"
                >
                  {isGeocodingAddress ? "Buscando..." : "Buscar"}
                </button>
              )}
            </div>
          </div>

          {/* 2. Contenedor desplegable con animación sutil (!important) solo tras validar dirección sin número */}
          <div
            aria-hidden={!needsHouseNumber}
            className={`address-number-accordion ${
              needsHouseNumber ? "is-open" : "pointer-events-none"
            }`}
          >
            <div className="address-number-accordion-inner">
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3.5 sm:p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 leading-tight">Falta el número</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Agrégalo para ubicar tu punto exacto en el mapa.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="N° 1234"
                    value={numberDraft}
                    onChange={(e) => setNumberDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        handleAddStreetNumber()
                      }
                    }}
                    className="h-10 w-28 sm:w-32 rounded-xl border-gray-300 bg-white text-sm font-medium text-gray-900 focus-visible:ring-pink-500"
                  />
                  <Button
                    type="button"
                    onClick={handleAddStreetNumber}
                    disabled={isGeocodingAddress}
                    className="h-10 px-4 sm:px-5 rounded-full bg-gray-900 hover:bg-pink-600 text-white font-bold text-xs tracking-wider uppercase transition-colors"
                  >
                    {isGeocodingAddress ? "UBICANDO..." : "AGREGAR"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSelectSinNumero}
                    disabled={isGeocodingAddress}
                    className="h-10 px-3.5 rounded-full border-gray-300 bg-white hover:bg-pink-50 hover:border-pink-400 hover:text-pink-600 text-gray-700 font-bold text-xs tracking-wider uppercase transition-colors"
                  >
                    S/N
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Botón "Usar mi ubicación actual" */}
          <div>
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={isLocatingUser}
              className="inline-flex items-center gap-2 text-sm font-bold text-pink-600 hover:text-pink-700 underline underline-offset-4 transition-colors cursor-pointer !min-h-0 !min-w-0"
            >
              <LocateFixed className={`w-4 h-4 ${isLocatingUser ? "animate-spin" : ""}`} />
              <span>{isLocatingUser ? "Obteniendo ubicación..." : "Usar mi ubicación actual"}</span>
            </button>
          </div>

          {/* 4. Mapa abajo */}
          <div className="space-y-2">
            <div className="relative h-[240px] sm:h-[280px] overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
              {/* Botón flotante superior para ajustar el punto */}
              <button
                type="button"
                onClick={() => {
                  toast({
                    title: "Ajusta tu punto en el mapa",
                    description: "Toca o haz clic directamente sobre el mapa donde quieres recibir tu pedido.",
                  })
                }}
                className="absolute top-2.5 left-1/2 -translate-x-1/2 z-[1000] bg-gray-900/90 hover:bg-gray-900 text-white text-xs font-semibold px-3.5 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-transform active:scale-95 !min-h-0 !min-w-0"
              >
                <LocateFixed className="w-3.5 h-3.5 text-pink-400" />
                <span>Ajustar el punto</span>
              </button>

              <LocationPicker
                key={mapKey}
                onLocationSelect={handleLocationSelect}
                selectedLocation={selectedLocation}
                onDeliveryInfoChange={handleDeliveryInfoChange}
              />
            </div>

            {!selectedLocation && (
              <p className="text-xs text-gray-500 text-center">
                Haz clic en el mapa o ingresa tu dirección para ubicar tu punto de entrega.
              </p>
            )}
          </div>

          {/* 5. Valor del delivery minimalista y resaltado según la zona */}
          {selectedLocation && (
            <div
              className={`rounded-xl px-4 py-3 border flex items-center justify-between transition-all ${
                deliveryInfo.zone && deliveryInfo.disponible
                  ? "bg-pink-50/70 border-pink-200"
                  : "bg-red-50 border-red-200"
              }`}
            >
              {deliveryInfo.zone ? (
                deliveryInfo.disponible ? (
                  <>
                    <div className="min-w-0 pr-2">
                      <span className="text-xs text-gray-500 block">Zona de entrega</span>
                      <span className="text-sm font-bold text-gray-900 truncate block">
                        {deliveryInfo.zone.nombre}
                      </span>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-[11px] uppercase tracking-wider font-semibold text-pink-600 block">
                        Delivery
                      </span>
                      <span className="text-lg sm:text-xl font-black text-pink-600">
                        ${deliveryInfo.tarifa.toLocaleString()}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="w-full text-center text-xs sm:text-sm font-semibold text-red-700">
                    La zona "{deliveryInfo.zone.nombre}" no está disponible actualmente.
                  </div>
                )
              ) : (
                <div className="w-full text-center text-xs sm:text-sm font-semibold text-red-700">
                  Ubicación fuera de nuestras zonas de delivery.
                </div>
              )}
            </div>
          )}

          {/* 6. Input de referencia al final */}
          <div className="space-y-1.5 pt-1">
            <Label htmlFor="referencia" className="text-xs font-bold text-gray-700">
              Referencia <span className="text-gray-400 font-normal">(Opcional)</span>
            </Label>
            <Input
              id="referencia"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="Ej. Depto 42, Casa 5, portón negro, timbre 3"
              className="h-10 rounded-xl border-gray-300 bg-white text-sm"
            />
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          {(!calle || !numero || !selectedLocation) ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2.5 mb-3">
              <p className="text-xs text-yellow-800 text-center font-medium">
                Ingresa tu dirección con número y confirma el punto en el mapa para continuar.
              </p>
            </div>
          ) : selectedLocation && !deliveryInfo.disponible ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 mb-3">
              <p className="text-xs text-red-700 text-center font-medium">
                El delivery no está disponible en esta zona. Ajusta el punto en el mapa.
              </p>
            </div>
          ) : null}

          <Button
            onClick={handleAddressSubmit}
            disabled={!calle.trim() || !isValidHouseNumber(numero) || !selectedLocation || !deliveryInfo.disponible || !deliveryInfo.zone}
            className="w-full bg-pink-600 text-white hover:bg-pink-700 font-bold py-3 rounded-xl shadow-md"
          >
            Continuar al Pago
          </Button>
        </div>
      </div>
    )
  }

  // Vista de registro de teléfono (para evitar problemas de Focus Trap de Radix UI en el modal)
  if (currentView === "phone-registration") {
    return (
      <div className="flex-1 w-full h-full min-h-0 flex flex-col bg-white text-gray-900">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="flex items-center">
            <Button variant="ghost" size="icon" onClick={() => setCurrentView("payment")} className="mr-2 hover:bg-gray-200 text-gray-700">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-xl font-bold text-gray-800">Completa tu perfil</h2>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-2 text-center mt-4">
            <h3 className="text-lg font-bold text-gray-900">Completa un dato para continuar</h3>
            <p className="text-sm text-gray-500">
              Necesitamos tu número de celular para completar la confirmación de tu pedido.
            </p>
          </div>

          <form onSubmit={handleSavePhoneAndContinue} className="space-y-6">
            <div className="p-4 bg-pink-50/60 border border-pink-100/50 rounded-xl text-center">
              <p className="text-gray-700 text-sm leading-relaxed font-medium">
                Ingresa tu número de celular para que podamos avisarte cuando tu pedido esté listo o coordinar la entrega con nuestro delivery.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="checkout-phone-view" className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-1">
                Número de celular
              </Label>
              <Input
                id="checkout-phone-view"
                type="tel"
                placeholder="Ej: +56 9 1234 5678"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                required
                className="w-full border-gray-200 focus-visible:ring-pink-500 rounded-xl text-gray-900 py-5"
              />
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={isSavingPhone}
                className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-6 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-75"
              >
                {isSavingPhone ? "Guardando..." : "Guardar y continuar"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // Vista de pago
  if (currentView === "payment") {
    return (
      <div className="flex-1 w-full h-full min-h-0 flex flex-col bg-white relative">
        {/* Modal sobre el carrito para usar la última dirección registrada */}
        {showLastAddressModal && (user as any)?.lastDeliveryAddress && (
          <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-sm w-full p-5 sm:p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-gray-900 leading-tight">
                    ¿Enviamos el pedido a tu última dirección registrada?
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Encontramos la dirección de tu último delivery:
                  </p>
                </div>
              </div>

              <div className="bg-pink-50/60 border border-pink-100 rounded-xl p-3.5 text-sm space-y-1">
                <p className="font-bold text-gray-900">
                  {(user as any).lastDeliveryAddress.calle} {(user as any).lastDeliveryAddress.numero}
                  {(user as any).lastDeliveryAddress.comuna ? `, ${(user as any).lastDeliveryAddress.comuna}` : ""}
                </p>
                {(user as any).lastDeliveryAddress.referencia && (
                  <p className="text-xs text-gray-600">
                    Ref: {(user as any).lastDeliveryAddress.referencia}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowLastAddressModal(false)}
                  className="h-11 rounded-xl border-gray-300 text-gray-700 hover:bg-gray-100 font-bold"
                >
                  No
                </Button>
                <Button
                  type="button"
                  onClick={handleAcceptLastAddress}
                  className="h-11 rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-bold shadow-md"
                >
                  Sí
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="flex items-center">
            <Button variant="ghost" size="icon" onClick={goBack} className="mr-2 hover:bg-gray-200">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-xl font-bold text-gray-800">Método de Pago</h2>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            {/* Resumen del pedido */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="flex items-center text-pink-700 mb-2">
                {isDelivery ? <Truck className="h-5 w-5 mr-2" /> : <Store className="h-5 w-5 mr-2" />}
                <span className="font-medium">{isDelivery ? "Delivery" : "Retiro en Local"}</span>
              </div>
              <div className="text-sm text-gray-600 space-y-1">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{showCalculatingTotal ? 'Calculando...' : `$${subtotal.toLocaleString()}`}</span>
                </div>
                {isDelivery && deliveryCost > 0 && (
                  <div className="flex justify-between">
                    <span>Delivery ({deliveryInfo.zone?.nombre}):</span>
                    <span>{showCalculatingTotal ? 'Calculando...' : `+$${deliveryCost.toLocaleString()}`}</span>
                  </div>
                )}
                {appliedDiscount && discountFromCode > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Descuento ({appliedDiscount.code}):</span>
                    <span>-${discountFromCode.toLocaleString()}</span>
                  </div>
                )}

                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Total:</span>
                  <span className="text-pink-600">{showCalculatingTotal ? 'Calculando...' : `$${totalFinal.toLocaleString()}`}</span>
                </div>
                {serverCalcError && (
                  <div className="text-xs text-red-600 text-center mt-2">{serverCalcError}</div>
                )}
              </div>
            </div>

            {/* Métodos de pago */}
            {!isAuthenticated && (
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 space-y-3">
                <div>
                  <h3 className="font-medium text-amber-900">Compra como invitado</h3>
                  <p className="text-xs text-amber-700">Usaremos estos datos para confirmar y coordinar tu pedido.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="guestName" className="text-sm">Nombre completo</Label>
                  <Input
                    id="guestName"
                    value={guestName}
                    onChange={(e) => {
                      setGuestName(e.target.value)
                      if (guestFormError) setGuestFormError("")
                    }}
                    placeholder="Ej: Diego Pérez"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="guestPhone" className="text-sm">Teléfono</Label>
                  <Input
                    id="guestPhone"
                    value={guestPhone}
                    onChange={(e) => {
                      setGuestPhone(e.target.value)
                      if (guestFormError) setGuestFormError("")
                    }}
                    placeholder="Ej: +56 9 1234 5678"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="guestEmail" className="text-sm">Correo electrónico</Label>
                  <Input
                    id="guestEmail"
                    type="email"
                    value={guestEmail}
                    onChange={(e) => {
                      setGuestEmail(e.target.value)
                      if (guestFormError) setGuestFormError("")
                    }}
                    placeholder="Ej: nombre@email.com"
                  />
                </div>

                {guestFormError && (
                  <p className="text-sm text-red-600">{guestFormError}</p>
                )}
              </div>
            )}

            {totalFinal === 0 ? (
              <div className="p-4 bg-green-50 border border-green-200 rounded-2xl text-center space-y-2.5 shadow-sm">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600 mx-auto">
                  <CheckCircle className="w-6 h-6 animate-pulse" />
                </div>
                <h3 className="font-extrabold text-green-900 text-sm">Pedido de Canje Directo</h3>
                <p className="text-xs text-green-700 leading-relaxed font-semibold">
                  Tu pedido consta únicamente de productos de canje con retiro en local. No se requiere realizar ningún pago monetario.
                </p>
                <p className="text-[10px] text-gray-500 italic">
                  Presiona "Confirmar pedido" para generar la comanda.
                </p>
              </div>
            ) : (
              <>
                <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="webpay" id="webpay" />
                    <Label
                      htmlFor="webpay"
                      className="flex items-center cursor-pointer flex-1 p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <CreditCard className="h-4 w-4 text-pink-600 mr-3" />
                      <div>
                        <div className="font-medium text-gray-800">Webpay Plus</div>
                        <div className="text-xs text-gray-500">
                          {isAuthenticated ? "Tarjeta de crédito o débito" : "Tarjeta de crédito o débito (modo invitado seguro)"}
                        </div>
                      </div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="efectivo" id="efectivo" />
                    <Label
                      htmlFor="efectivo"
                      className="flex items-center cursor-pointer flex-1 p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <Banknote className="h-4 w-4 text-pink-600 mr-3" />
                      <div>
                        <div className="font-medium text-gray-800">Efectivo</div>
                        <div className="text-xs text-gray-500">Paga al recibir</div>
                      </div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="transferencia" id="transferencia" />
                    <Label
                      htmlFor="transferencia"
                      className="flex items-center cursor-pointer flex-1 p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <ArrowRightCircle className="h-4 w-4 text-pink-600 mr-3" />
                      <div>
                        <div className="font-medium text-gray-800">Transferencia</div>
                        <div className="text-xs text-gray-500">Transferencia bancaria</div>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>

                {paymentMethod === "efectivo" && (
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 mt-3">
                    <h3 className="font-medium text-gray-800 mb-2 text-sm">¿Con cuánto vas a pagar?</h3>
                    <div className="space-y-2">
                      <Label htmlFor="cashAmount" className="text-sm text-gray-600">
                        Monto en efectivo
                      </Label>
                      <Input
                        id="cashAmount"
                        type="number"
                        placeholder={`Mínimo $${totalFinal.toLocaleString()}`}
                        min={totalFinal}
                        value={cashAmount}
                        onChange={(e) => handleCashAmountChange(e.target.value)}
                        className={`text-lg font-medium ${cashAmountError ? 'border-red-500' : ''}`}
                      />
                      {cashAmountError && (
                        <p className="text-sm text-red-600">{cashAmountError}</p>
                      )}
                      <p className="text-xs text-gray-500">Total a pagar: ${totalFinal.toLocaleString()}</p>
                      {cashAmount && !cashAmountError && parseFloat(cashAmount) > totalFinal && (
                        <p className="text-xs text-green-600">
                          Vuelto: ${(parseFloat(cashAmount) - totalFinal).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {paymentMethod === "transferencia" && (
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 mt-3">
                    {IS_KHIPU_ENABLED ? (
                      <div className="text-xs text-gray-600 space-y-1">
                        <h3 className="font-semibold text-gray-800 mb-1 text-sm">Transferencia Automatizada:</h3>
                        <p>Al confirmar tu pedido serás redirigido a la pasarela Khipu para realizar tu transferencia de forma inmediata y 100% segura sin necesidad de subir comprobantes.</p>
                      </div>
                    ) : (
                      <>
                        <h3 className="font-medium text-gray-800 mb-2 text-sm">Datos para transferencia:</h3>
                        <div className="space-y-1 text-xs text-gray-600">
                          <div>
                            <span className="font-medium">Titular:</span> Francisco Soto Hevia
                          </div>
                          <div>
                            <span className="font-medium">RUT:</span> 15.682.774-6
                          </div>
                          <div>
                            <span className="font-medium">Banco:</span> SANTANDER
                          </div>
                          <div>
                            <span className="font-medium">Tipo:</span> CUENTA CORRIENTE
                          </div>
                          <div>
                            <span className="font-medium">N° Cuenta:</span> 0000 7905 8750
                          </div>
                          <div className="text-red-600 font-medium mt-2">⚠️ No transferir a cuenta RUT</div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        {/* Sección unificada: códigos de descuento */}
        <div className="border-t border-gray-200 bg-gray-50">
          {/* Botón/pestaña para abrir el panel */}
          <button
            onClick={() => setIsDiscountPanelOpen(!isDiscountPanelOpen)}
            className="w-full p-3 flex items-center justify-between hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-pink-600" />
              <span className="font-medium text-gray-800">
                {appliedDiscount ? 'Código promocional aplicado' : '¿Tienes un código de descuento?'}
              </span>
              {appliedDiscount && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                  Activo
                </span>
              )}
            </div>
            <ChevronDown
              className={`h-5 w-5 text-gray-500 transition-transform duration-200 ${isDiscountPanelOpen ? 'rotate-180' : ''
                }`}
            />
          </button>

          {/* Panel desplegable */}
          <div
            className={`transition-all duration-500 ease-in-out overflow-hidden ${isDiscountPanelOpen ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0'
              }`}
            style={{
              transition: 'max-height 0.5s ease-in-out, opacity 0.3s ease-in-out'
            }}
          >
            <div className="p-4 bg-white border-t border-gray-200">
              <div className="space-y-4">
                {/* Bloque Código de Descuento */}
                <div className="bg-pink-50 p-3 rounded-lg border border-pink-200 space-y-2">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-pink-600" />
                    <p className="text-sm font-semibold text-pink-900">Código promocional</p>
                  </div>

                  {appliedDiscount ? (
                    <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-green-200">
                      <div>
                        <span className="font-medium text-green-800">{appliedDiscount.code}</span>
                        <p className="text-xs text-green-600">
                          {appliedDiscount.percentage
                            ? `${appliedDiscount.percentage}% de descuento aplicado`
                            : `$${appliedDiscount.amount.toLocaleString()} de descuento aplicado`}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveDiscount}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        Quitar
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex space-x-2">
                        <Input
                          placeholder="Ingresa tu código"
                          value={discountCode}
                          onChange={(e) => {
                            setDiscountCode(e.target.value)
                            setDiscountError("")
                          }}
                          className="flex-1 text-[#1F2937]"
                        />
                        <Button
                          onClick={handleApplyDiscount}
                          variant="outline"
                          className="border-pink-300 text-pink-600 hover:bg-pink-50 cursor-pointer"
                        >
                          Aplicar
                        </Button>
                      </div>
                      {discountError && <p className="text-xs text-red-600">{discountError}</p>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Botón de confirmar pago */}
        <div className="p-4 bg-gray-50">

          <Button
            onClick={handlePayment}
            disabled={isPaymentButtonDisabled()}
            className={`w-full font-bold py-3 rounded-lg transition-colors ${isPaymentButtonDisabled()
              ? 'bg-gray-400 text-gray-600 cursor-not-allowed hover:bg-gray-400'
              : 'bg-pink-600 text-white hover:bg-pink-700'
              }`}
          >
            {isProcessing
              ? "Procesando..."
              : showCalculatingTotal
                ? "Calculando total..."
                : totalFinal === 0
                  ? "Confirmar pedido"
                  : `Confirmar Pago - $${totalFinal.toLocaleString()}`}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex-1 w-full h-full min-h-0 flex flex-col bg-white">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-800">Tu Carrito ({items.length})</h2>
        </div>

        {/* Mensaje de error de inventario */}
        {showInventoryError && inventoryErrorDetails && inventoryErrorDetails.length > 0 && (
          <div className="p-4 mb-2 bg-red-50 border-b border-red-200">
            <div className="flex items-center gap-2 text-red-600 mb-2">
              <AlertCircle className="h-5 w-5" />
              <h3 className="font-bold">¡Atención! No podemos procesar tu pedido</h3>
            </div>
            <p className="text-sm text-red-700 mb-3">
              No hay suficiente stock de los siguientes ingredientes:
            </p>

            <div className="bg-white p-3 border border-red-200 rounded-md shadow-sm mb-3">
              <ul className="text-sm space-y-2">
                {inventoryErrorDetails.map((item, index) => (
                  <li key={index} className="text-gray-700 flex items-start gap-2">
                    <span className="text-red-500 mt-1">•</span>
                    <span>
                      <span className="font-semibold text-red-700">{item.ingrediente || item.item}</span>
                      {item.requerido && (
                        <>
                          {': '}
                          necesario <span className="font-medium text-red-600">{item.requerido}gr</span>,
                          disponible <span className="text-gray-600">{item.disponible}gr</span>
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-yellow-50 p-3 rounded-md border border-yellow-200 mb-3 text-sm">
              <p className="text-gray-700">
                Por favor, modifica tu pedido eliminando o cambiando los productos que contienen estos ingredientes.
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInventoryError(false)}
              className="text-gray-600 border-gray-300 mr-2"
            >
              <X className="h-4 w-4 mr-1" />
              Cerrar
            </Button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto min-h-0 p-2 sm:p-4 space-y-3 sm:space-y-4">
          <div className="space-y-2 sm:space-y-4">
            {items.map((item) => {
            // Solo agrupar items que fueron creados desde botones de variantes (tienen propiedad 'variant')
            const isVariantItem = item.variant === "Tradicional" || item.variant === "Zero"
            const isLipton = item.name?.toLowerCase().includes("lipton") || false
            const shouldGroup = isVariantItem && !isLipton

            let displayItem = item
            let variantInfo: Array<{ variant: string; quantity: number }> = []
            let totalQuantity = item.quantity

            if (shouldGroup) {
              // Buscar la variante Tradicional y Zero del mismo producto
              const baseNameForComparison = item.name?.replace(/ \(Tradicional|Zero\)$/i, "").trim()

              const tradicional = items.find(i =>
                i.variant === "Tradicional" &&
                i.name?.replace(/ \(Tradicional|Zero\)$/i, "").trim() === baseNameForComparison
              )
              const zero = items.find(i =>
                i.variant === "Zero" &&
                i.name?.replace(/ \(Tradicional|Zero\)$/i, "").trim() === baseNameForComparison
              )

              // Si es "Zero" pero existe "Tradicional", no renderizar aquí (se mostrará agrupado desde "Tradicional")
              // Si es "Zero" y NO existe "Tradicional", renderizar normalmente
              if (item.variant === "Zero" && tradicional) {
                return null
              }

              // Si es "Tradicional" o "Zero" sin su contraparte, procesar normalmente
              totalQuantity = 0
              if (tradicional) {
                variantInfo.push({ variant: "Tradicional", quantity: tradicional.quantity })
                totalQuantity += tradicional.quantity
              }
              if (zero) {
                variantInfo.push({ variant: "Zero", quantity: zero.quantity })
                totalQuantity += zero.quantity
              }

              // Usar el Tradicional como base para displayItem, o el primero disponible
              const baseItem = tradicional || zero
              displayItem = baseItem ? { ...baseItem, quantity: totalQuantity } : item
            }

            const extraIngredients = calculateExtraIngredients(displayItem)
            const ingredientPrices = getIngredientPrices(displayItem.size || "Familiar")
            const isExpanded = expandedItems[displayItem.id] || false
            const isPrepExpanded = expandedPrepOptions[displayItem.id] || false

            const finalImageUrl = getStorageUrl(displayItem.image)

            // Extraer tamaño y limpiar el nombre para no repetir "(Familiar)" o "(Mediana)"
            const sizeMatchInName = displayItem.name?.match(/\((Familiar|Mediana|Personal|Grande)\)/i)
            const rawSizeText = displayItem.size || (sizeMatchInName ? sizeMatchInName[1] : undefined)
            const formattedSize = rawSizeText
              ? rawSizeText.charAt(0).toUpperCase() + rawSizeText.slice(1).toLowerCase()
              : undefined

            const cleanDisplayName = (shouldGroup
              ? displayItem.name.replace(/ (Tradicional|Zero)$/, "")
              : displayItem.name
            )
              .replace(/\s*\((?:Familiar|Mediana|Personal|Grande)\)\s*$/i, "")
              .trim()

            // Determinar si es una pizza real (para mostrar opciones Sin Orégano / Sin Queso / Sin Salsa Tomate)
            const itemNameLower = displayItem.name.toLowerCase()
            const itemNameNormalized = normalizeText(displayItem.name || "")
            const isCuatroQuesos = itemNameNormalized.includes("4 quesos") || itemNameNormalized.includes("cuatro quesos")
            const excludedFromPizzaPrep = ["salsa", "coca", "lipton", "sprite", "fanta", "agua", "jugo", "gauchitos", "rollitos"]
            const isPizzaItem = !excludedFromPizzaPrep.some((excluded) => itemNameLower.includes(excluded)) && !shouldGroup && !displayItem.isPromo

            const activePrepLabels = [
              item.sinOregano ? "Sin Orégano" : null,
              item.sinQueso ? "Sin Queso" : null,
              item.sinSalsaTomate ? "Sin Salsa Tomate" : null,
            ].filter(Boolean) as string[]

            return (
              <div
                key={displayItem.id}
                className="bg-white rounded-xl sm:rounded-2xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex items-stretch">
                  {/* Lado izquierdo: Imagen grande ocupando la altura del bloque */}
                  <div className="relative w-[108px] xs:w-[120px] sm:w-[140px] flex-shrink-0 bg-gray-100 self-stretch min-h-[124px]">
                    <img
                      src={finalImageUrl}
                      loading="eager"
                      decoding="sync"
                      alt={cleanDisplayName}
                      className="w-full h-full object-cover block"
                      onError={(e: any) => {
                        const currentSrc = e.currentTarget.src

                        // Sistema de auto-recuperación de enlaces rotos por Case Sensitivity o Extensión
                        if (currentSrc.includes(".jpg") && !currentSrc.includes("_retry1")) {
                          e.currentTarget.src = currentSrc.replace(".jpg", ".png") + "&_retry1=true"
                        } else if (currentSrc.includes(".png") && !currentSrc.includes("_retry2")) {
                          const urlBase = currentSrc.split("&_retry")[0].replace(".png", ".jpg")
                          const urlMayuscula = urlBase.replace(/%2F([a-z])/g, (match: string, p1: string) => `%2F${p1.toUpperCase()}`)
                          e.currentTarget.src = urlMayuscula + "&_retry2=true"
                        } else if (!currentSrc.includes("placeholder.svg")) {
                          e.currentTarget.src = "/placeholder.svg"
                        }
                      }}
                    />
                  </div>

                  {/* Lado derecho: Toda la información y controles del producto */}
                  <div className="flex-1 min-w-0 p-3 sm:p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex-1 min-w-0">
                          {/* Primero el tamaño en rojo fucsia */}
                          {formattedSize && !shouldGroup && (
                            <span className="block text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-pink-600 mb-0.5 leading-tight">
                              {formattedSize}
                            </span>
                          )}

                          {/* Luego el nombre de la pizza sin repetir el tamaño entre paréntesis */}
                          <h3 className="font-bold text-sm sm:text-base text-gray-900 leading-snug flex flex-row items-center gap-2 break-words">
                            <span>{cleanDisplayName}</span>
                            {displayItem.isCanje && (
                              <img
                                src="/iconos/puntos.png"
                                alt="Puntos Palermo"
                                className="w-7 h-7 sm:w-9 sm:h-9 object-contain flex-shrink-0"
                                title="Canje por Puntos Palermo"
                              />
                            )}
                          </h3>

                          {shouldGroup && variantInfo.length > 0 && (
                            <div className="text-[11px] sm:text-xs text-gray-600 mt-0.5">
                              {variantInfo.map((vi, idx) => (
                                <span key={idx} className="inline-block mr-2">
                                  <span className="font-medium">{vi.quantity}x {vi.variant}</span>
                                </span>
                              ))}
                            </div>
                          )}

                          {displayItem.isPromo && Array.isArray(displayItem.productos) && (
                            <div className="mt-1.5 space-y-0.5">
                              {displayItem.productos.map((prod: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="text-[10px] sm:text-xs text-gray-500 font-medium flex items-center gap-1.5 bg-gray-50 px-2 py-0.5 rounded border border-gray-100 w-fit"
                                >
                                  <span>{prod.nombre || prod.name}</span>
                                  <span className="text-pink-600 font-bold">x{prod.cantidad}</span>
                                  {prod.size && <span className="text-gray-400 font-normal">({prod.size})</span>}
                                  {prod.variant && <span className="text-gray-400 font-normal">({prod.variant})</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex space-x-0.5 sm:space-x-1 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 h-auto !min-h-0 !min-w-0"
                            onClick={() => {
                              if (shouldGroup && variantInfo.length > 0) {
                                // Eliminar ambas variantes (Tradicional y Zero)
                                const baseNameForComparison = item.name?.replace(/ \(Tradicional|Zero\)$/i, "").trim()
                                items.forEach((i) => {
                                  if (
                                    (i.variant === "Tradicional" || i.variant === "Zero") &&
                                    i.name?.replace(/ \(Tradicional|Zero\)$/i, "").trim() === baseNameForComparison
                                  ) {
                                    removeItem(i.id)
                                  }
                                })
                              } else {
                                removeItem(displayItem.id)
                              }
                              setShowInventoryError(false)
                            }}
                            title="Eliminar pedido"
                          >
                            <Trash className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Botón para expandir/contraer detalles de ingredientes - solo para pizzas personalizadas (excepto DUO) */}
                      {displayItem.pizzaType !== "duo" &&
                      ((displayItem.ingredients && displayItem.ingredients.length > 0) ||
                        (displayItem.premiumIngredients && displayItem.premiumIngredients.length > 0) ||
                        (displayItem.sauces && displayItem.sauces.length > 0) ||
                        (displayItem.drinks && displayItem.drinks.length > 0) ||
                        (displayItem.extras && displayItem.extras.length > 0)) ? (
                        <div className="mb-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleItemExpansion(displayItem.id.toString())}
                            className="text-gray-600 hover:text-gray-800 hover:bg-gray-100 px-1.5 py-0.5 h-auto text-[11px] sm:text-xs !min-h-0 !min-w-0"
                          >
                            <span className="mr-1">{isExpanded ? "Ocultar detalles" : "Ver detalles"}</span>
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </Button>
                        </div>
                      ) : null}

                      {/* Desglose de precios con ingredientes individuales */}
                      {isExpanded && (
                        <div className="space-y-2 mb-2.5 animate-in slide-in-from-top-2 duration-200">
                          <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-200 text-xs space-y-1">
                            <div className="font-medium text-gray-700 mb-1.5">Desglose de Precio:</div>

                            <div className="flex justify-between">
                              <span className="text-gray-600">
                                {displayItem.name.includes("DUO")
                                  ? `Pizza DUO (${displayItem.size}):`
                                  : displayItem.selectedMenuPizza && displayItem.selectedMenuPizza !== "base"
                                    ? `Pizza base ${displayItem.selectedMenuPizza} (${displayItem.size}):`
                                    : `Pizza base (${displayItem.size}):`}
                              </span>
                              <span>${(displayItem.basePrice || 0).toLocaleString()}</span>
                            </div>

                            {/* Ingredientes simples individuales */}
                            {displayItem.ingredients && displayItem.ingredients.length > 0 && (
                              <>
                                {displayItem.ingredients.map((ingredient, index) => {
                                  if (displayItem.name.includes("Promo") && index < 2) return null

                                  const match = ingredient.match(/^(.+?)\s*\((\d+)\)$/)
                                  const quantity = match ? parseInt(match[2]) : 1
                                  const totalPrice = ingredientPrices.simple * quantity

                                  return (
                                    <div key={`ingredient-${index}`} className="flex justify-between">
                                      <span className="text-gray-600">{ingredient}:</span>
                                      <span>+${totalPrice.toLocaleString()}</span>
                                    </div>
                                  )
                                })}
                              </>
                            )}

                            {/* Ingredientes premium individuales */}
                            {displayItem.premiumIngredients && displayItem.premiumIngredients.length > 0 && (
                              <>
                                {displayItem.premiumIngredients.map((ingredient, index) => {
                                  const match = ingredient.match(/^(.+?)\s*\((\d+)\)$/)
                                  const quantity = match ? parseInt(match[2]) : 1
                                  const totalPrice = ingredientPrices.premium * quantity

                                  return (
                                    <div key={`premium-${index}`} className="flex justify-between">
                                      <span className="text-gray-600">{ingredient}:</span>
                                      <span>+${totalPrice.toLocaleString()}</span>
                                    </div>
                                  )
                                })}
                              </>
                            )}

                            {/* Salsas individuales */}
                            {displayItem.sauces && displayItem.sauces.length > 0 && (
                              <>
                                {displayItem.sauces.map((sauce, index) => {
                                  const match = sauce.match(/^(.+?)\s*\((\d+)\)$/)
                                  const sauceName = match ? match[1] : sauce
                                  const quantity = match ? parseInt(match[2]) : 1
                                  const unitPrice = getExtraPrice(sauceName)
                                  const totalPrice = unitPrice * quantity

                                  return (
                                    <div key={`sauce-${index}`} className="flex justify-between">
                                      <span className="text-green-600">{sauce}:</span>
                                      <span className="text-green-600">+${totalPrice.toLocaleString()}</span>
                                    </div>
                                  )
                                })}
                              </>
                            )}

                            {/* Bebidas individuales */}
                            {displayItem.drinks && displayItem.drinks.length > 0 && (
                              <>
                                {displayItem.drinks.map((drink, index) => {
                                  const match = drink.match(/^(.+?)\s*\((\d+)\)$/)
                                  const drinkName = match ? match[1] : drink
                                  const quantity = match ? parseInt(match[2]) : 1
                                  const unitPrice = getExtraPrice(drinkName)
                                  const totalPrice = unitPrice * quantity

                                  return (
                                    <div key={`drink-${index}`} className="flex justify-between">
                                      <span className="text-blue-600">{drink}:</span>
                                      <span className="text-blue-600">+${totalPrice.toLocaleString()}</span>
                                    </div>
                                  )
                                })}
                              </>
                            )}

                            {/* Agregados individuales */}
                            {displayItem.extras && displayItem.extras.length > 0 && (
                              <>
                                {displayItem.extras.map((extra, index) => {
                                  const match = extra.match(/^(.+?)\s*\((\d+)\)$/)
                                  const extraName = match ? match[1] : extra
                                  const quantity = match ? parseInt(match[2]) : 1
                                  const unitPrice = getExtraPrice(extraName)
                                  const totalPrice = unitPrice * quantity

                                  return (
                                    <div key={`extra-${index}`} className="flex justify-between">
                                      <span className="text-purple-600">{extra}:</span>
                                      <span className="text-purple-600">+${totalPrice.toLocaleString()}</span>
                                    </div>
                                  )
                                })}
                              </>
                            )}

                            <div className="flex justify-between font-medium border-t pt-1.5 mt-1.5 text-pink-600">
                              <span>Subtotal unitario:</span>
                              <span>${item.price.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Opciones de Personalización desplegables con flecha - Solo para pizzas reales */}
                      {isPizzaItem && (
                        <div className="mt-1 mb-2">
                          <button
                            type="button"
                            onClick={() => togglePrepOptions(displayItem.id.toString())}
                            className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-gray-600 hover:text-pink-600 bg-gray-100/80 hover:bg-pink-50/70 px-2.5 py-1 rounded-md transition-colors cursor-pointer !min-h-0 !min-w-0"
                          >
                            <span>Opciones de preparación</span>
                            {activePrepLabels.length > 0 && (
                              <span className="bg-pink-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full leading-tight">
                                {activePrepLabels.length}
                              </span>
                            )}
                            {isPrepExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5 text-pink-600" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                            )}
                          </button>

                          {/* Mostrar resumen compacto si está contraído pero tiene opciones activas */}
                          {!isPrepExpanded && activePrepLabels.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {activePrepLabels.map((lbl) => (
                                <span
                                  key={lbl}
                                  className="text-[10px] font-semibold text-pink-700 bg-pink-50 border border-pink-200 px-1.5 py-0.5 rounded"
                                >
                                  {lbl}
                                </span>
                              ))}
                            </div>
                          )}

                          {isPrepExpanded && (
                            <div className="mt-2 flex flex-nowrap items-center gap-1 sm:gap-1.5 overflow-x-auto animate-in slide-in-from-top-1 duration-150">
                              <button
                                type="button"
                                onClick={() => {
                                  updateItem({
                                    ...item,
                                    sinOregano: !item.sinOregano,
                                  })
                                }}
                                className={`px-2 py-1 text-[10px] sm:text-[11px] whitespace-nowrap rounded-md border transition-all cursor-pointer !min-h-0 !min-w-0 ${
                                  item.sinOregano
                                    ? "bg-pink-600 text-white border-pink-600 font-semibold shadow-xs"
                                    : "bg-white text-gray-700 border-gray-300 hover:border-pink-400"
                                }`}
                              >
                                Sin Orégano
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  updateItem({
                                    ...item,
                                    sinQueso: !item.sinQueso,
                                  })
                                }}
                                className={`px-2 py-1 text-[10px] sm:text-[11px] whitespace-nowrap rounded-md border transition-all cursor-pointer !min-h-0 !min-w-0 ${
                                  item.sinQueso
                                    ? "bg-pink-600 text-white border-pink-600 font-semibold shadow-xs"
                                    : "bg-white text-gray-700 border-gray-300 hover:border-pink-400"
                                }`}
                              >
                                Sin Queso
                              </button>

                              {!isCuatroQuesos && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    updateItem({
                                      ...item,
                                      sinSalsaTomate: !item.sinSalsaTomate,
                                    })
                                  }}
                                  className={`px-2 py-1 text-[10px] sm:text-[11px] whitespace-nowrap rounded-md border transition-all cursor-pointer !min-h-0 !min-w-0 ${
                                    item.sinSalsaTomate
                                      ? "bg-pink-600 text-white border-pink-600 font-semibold shadow-xs"
                                      : "bg-white text-gray-700 border-gray-300 hover:border-pink-400"
                                  }`}
                                >
                                  Sin Salsa Tomate
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Controles de cantidad y precio */}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-1">
                      {displayItem.isCanje ? (
                        <div className="text-xs text-pink-700 font-extrabold bg-pink-50 border border-pink-100 px-3 py-1 rounded-xl shadow-xs">
                          Cantidad: {displayItem.quantity}
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1.5 sm:space-x-2">
                          <Button
                            size="icon"
                            variant="outline"
                            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white border-gray-300 text-gray-600 hover:bg-pink-50 hover:border-pink-300 hover:text-pink-600 !min-h-0 !min-w-0"
                            onClick={() => {
                              if (shouldGroup) {
                                updateQuantity(item.id, Math.max(0, item.quantity - 1))
                              } else {
                                updateQuantity(displayItem.id, Math.max(0, displayItem.quantity - 1))
                              }
                              setShowInventoryError(false)
                            }}
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="w-6 sm:w-7 text-center text-sm sm:text-base font-bold text-gray-800">
                            {displayItem.quantity}
                          </span>
                          <Button
                            size="icon"
                            variant="outline"
                            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white border-gray-300 text-gray-600 hover:bg-pink-50 hover:border-pink-300 hover:text-pink-600 !min-h-0 !min-w-0"
                            onClick={() => {
                              if (shouldGroup) {
                                updateQuantity(item.id, item.quantity + 1)
                              } else {
                                updateQuantity(displayItem.id, displayItem.quantity + 1)
                              }
                              setShowInventoryError(false)
                            }}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                      <div className="text-right">
                        {displayItem.isCanje ? (
                          <>
                            <div className="font-bold text-sm sm:text-base text-pink-600">$0 (Canje)</div>
                            <div className="text-[9px] sm:text-[10px] text-gray-500 font-semibold">
                              {displayItem.canjePoints?.toLocaleString("es-CL")} pts
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="font-extrabold text-sm sm:text-base text-gray-900">
                              ${(displayItem.price * displayItem.quantity).toLocaleString()}
                            </div>
                            {displayItem.quantity > 1 && (
                              <div className="text-[10px] sm:text-xs text-gray-500">
                                ${displayItem.price.toLocaleString()} c/u
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          </div>

          {/* Sección Unificada de Upselling: "¿Quieres agregar un extra?" */}
          {(() => {
            const unifiedExtras = [
              // Snacks / Acompañamientos
              {
                id: "15",
                name: "Rollitos de Canela",
                price: 4900,
                image: "/acompañamientos/canela.jpg",
                isAvailable: rollitosPackStock > 0,
              },
              {
                id: "16",
                name: "Gauchitos x12",
                price: 4000,
                image: "/acompañamientos/gauchitos.jpg",
                isAvailable: gauchitosDisponible,
              },
              {
                id: "21",
                name: "Gauchitos x24",
                price: 7000,
                image: "/acompañamientos/Gauchitosx24.webp",
                isAvailable: gauchitosDisponible,
              },
              // Bebidas
              {
                id: "coca-botella-tradicional",
                name: "Coca Cola 1.5 Litro",
                price: 2900,
                image: "/bebidas/coca_cola_1.5_litro.jpg",
                isAvailable: bebidasDisponibles.cocaBotellaTradicional,
              },
              {
                id: "coca-botella-zero",
                name: "Coca Cola Zero 1.5 Litro",
                price: 2900,
                image: "/bebidas/coca_cola_1.5_litro_zero.jpg",
                isAvailable: bebidasDisponibles.cocaBotellaZero,
              },
              {
                id: "coca-lata-tradicional",
                name: "Coca Cola Lata 350cc",
                price: 1500,
                image: "/bebidas/coca_cola_lata.jpg",
                isAvailable: bebidasDisponibles.cocaLataTradicional,
              },
              {
                id: "coca-lata-zero",
                name: "Coca Cola Zero Lata 350cc",
                price: 1500,
                image: "/bebidas/coca_cola_lata_zero.jpg",
                isAvailable: bebidasDisponibles.cocaLataZero,
              },
              {
                id: "lipton-botella",
                name: "Lipton Botella",
                price: 2900,
                image: "/bebidas/lipton_botella.jpg",
                isAvailable: bebidasDisponibles.liptonBotella,
              },
              {
                id: "lipton-lata",
                name: "Lipton Lata",
                price: 1500,
                image: "/bebidas/lipton_lata.jpg",
                isAvailable: bebidasDisponibles.liptonLata,
              },
              // Salsas
              {
                id: "17",
                name: "Salsa de Ajo",
                price: 700,
                image: "/acompañamientos/salsa_de_ajo.jpg",
                isAvailable: salsasDisponibles.ajo,
              },
              {
                id: "18",
                name: "Salsa Chimichurri",
                price: 700,
                image: "/acompañamientos/salsa_chimichurri.jpg",
                isAvailable: salsasDisponibles.chimichurri,
              },
              {
                id: "19",
                name: "Salsa BBQ",
                price: 700,
                image: "/acompañamientos/salsa_bbq.jpg",
                isAvailable: salsasDisponibles.bbq,
              },
              {
                id: "20",
                name: "Salsa Pesto",
                price: 1000,
                image: "/acompañamientos/salsa_pesto.jpg",
                isAvailable: salsasDisponibles.pesto,
              },
            ]

            const findMatchingCartItem = (extra: { id: string; name: string }) => {
              const targetNorm = normalizeText(extra.name)
              return items.find((item) => {
                if (item.isCanje || item.isPromo) return false
                if (String(item.id) === String(extra.id)) return true
                const itemNorm = normalizeText(item.name || "")
                if (itemNorm === targetNorm) return true
                if (extra.id === "16" && (itemNorm === "gauchitos" || itemNorm === "gauchitos x12")) return true
                return false
              })
            }

            return (
              <div className="pt-2 pb-2">
                <h3 className="font-arial-narrow font-extrabold text-lg sm:text-xl text-gray-900 mb-2.5 tracking-tight">
                  ¿Quieres agregar un extra?
                </h3>

                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setIsExtrasOpen((prev) => !prev)}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50/80 transition-colors cursor-pointer !min-h-0"
                  >
                    <span className="text-sm sm:text-[15px] text-gray-700 font-medium">
                      Selecciona más opciones
                    </span>
                    {isExtrasOpen ? (
                      <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                    ) : (
                      <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                    )}
                  </button>

                  {isExtrasOpen && (
                    <div className="px-4 pb-3 pt-1 divide-y divide-gray-100 border-t border-gray-100 animate-in slide-in-from-top-1 duration-200">
                      {unifiedExtras.map((extra) => {
                        const matchedItem = findMatchingCartItem(extra)
                        const quantity = matchedItem?.quantity || 0
                        const isAvailable = extra.isAvailable

                        return (
                          <div
                            key={extra.id}
                            className={`flex items-center justify-between py-2.5 gap-2 ${
                              !isAvailable ? "opacity-55" : ""
                            }`}
                          >
                            <span className="font-arial-narrow font-extrabold text-xs sm:text-sm uppercase tracking-wide text-gray-800 flex-1 min-w-0 pr-2 leading-tight">
                              {extra.name}
                            </span>

                            <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
                              <span className="font-arial-narrow font-extrabold text-xs sm:text-sm text-pink-600 whitespace-nowrap">
                                {isAvailable ? `$ ${extra.price.toLocaleString("es-CL")}` : "Sin Stock"}
                              </span>

                              <div className="flex items-center gap-2 sm:gap-2.5">
                                <button
                                  type="button"
                                  disabled={quantity === 0}
                                  onClick={() => {
                                    if (!matchedItem) return
                                    if (quantity <= 1) {
                                      removeItem(matchedItem.id)
                                    } else {
                                      updateQuantity(matchedItem.id, quantity - 1)
                                    }
                                    setShowInventoryError(false)
                                  }}
                                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border flex items-center justify-center transition-all !min-h-0 !min-w-0 ${
                                    quantity > 0
                                      ? "border-gray-700 text-gray-800 hover:border-pink-600 hover:text-pink-600 hover:bg-pink-50 cursor-pointer"
                                      : "border-gray-300 text-gray-300 cursor-not-allowed"
                                  }`}
                                  aria-label={`Quitar ${extra.name}`}
                                >
                                  <Minus className="w-3.5 h-3.5 stroke-[2.2]" />
                                </button>

                                <span className="w-4 text-center text-xs sm:text-sm font-semibold text-gray-800 select-none">
                                  {quantity}
                                </span>

                                <button
                                  type="button"
                                  disabled={!isAvailable}
                                  onClick={() => {
                                    if (!isAvailable) {
                                      toast({
                                        title: "Producto sin stock",
                                        description: `${extra.name} no tiene stock disponible.`,
                                        variant: "destructive",
                                      })
                                      return
                                    }

                                    if (matchedItem) {
                                      updateQuantity(matchedItem.id, quantity + 1)
                                    } else {
                                      addItem({
                                        id: String(extra.id),
                                        name: extra.name,
                                        price: extra.price,
                                        quantity: 1,
                                        image: getStorageUrl(extra.image),
                                      })
                                    }
                                    setShowInventoryError(false)
                                  }}
                                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border flex items-center justify-center transition-all !min-h-0 !min-w-0 ${
                                    isAvailable
                                      ? "border-gray-800 text-gray-900 hover:border-pink-600 hover:bg-pink-600 hover:text-white cursor-pointer"
                                      : "border-gray-300 text-gray-300 cursor-not-allowed"
                                  }`}
                                  aria-label={`Agregar ${extra.name}`}
                                >
                                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )
          })()}
        </div>

        <div className="p-2 sm:p-4 border-t border-gray-200 space-y-2 sm:space-y-4 bg-gray-50 flex-shrink-0">
          {/* Resumen de totales */}
          <div className="space-y-1.5">
            {isDelivery && deliveryCost > 0 && (
              <div className="flex justify-between text-xs sm:text-sm text-blue-600">
                <span>Delivery</span>
                <span className="font-medium">{showCalculatingTotal ? 'Calculando...' : `+$${deliveryCost.toLocaleString()}`}</span>
              </div>
            )}
            {appliedDiscount && discountFromCode > 0 && (
              <div className="flex justify-between text-xs sm:text-sm text-green-600">
                <span>Descuento ({appliedDiscount.code})</span>
                <span className="font-medium">-${discountFromCode.toLocaleString()}</span>
              </div>
            )}

            <div className="flex items-center justify-between bg-white px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl border border-pink-100 shadow-xs">
              <span className="font-extrabold text-base sm:text-lg uppercase tracking-wide text-gray-900">Total</span>
              <span className="font-black text-xl sm:text-2xl text-pink-600">
                {showCalculatingTotal ? 'Calculando...' : `$${totalFinal.toLocaleString()}`}
              </span>
            </div>
            {serverCalcError && (
              <div className="text-xs text-red-600 text-center mt-2">{serverCalcError}</div>
            )}
          </div>

          {/* Botones para elegir entre Retirar y Delivery */}
          <div className="bg-white rounded-lg p-2 sm:p-4 border border-gray-200">
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {/* Botón Retirar */}
              <button
                onClick={() => setIsDelivery(false)}
                className={`flex flex-col items-center justify-center p-2 sm:p-4 rounded-lg border-2 transition-all ${isDelivery === false
                  ? "border-pink-600 bg-pink-50 shadow-md"
                  : "border-gray-300 bg-white hover:border-pink-300 hover:bg-pink-50/50"
                  }`}
              >
                <Store className={`w-6 h-6 sm:w-8 sm:h-8 mb-1 sm:mb-2 ${isDelivery === false ? "text-pink-600" : "text-gray-400"}`} />
                <span className={`font-bold text-sm sm:text-base ${isDelivery === false ? "text-pink-600" : "text-gray-600"}`}>
                  Retirar
                </span>
                <span className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 text-center">
                  Gratis
                </span>
              </button>

              {/* Botón Delivery */}
              <button
                onClick={() => setIsDelivery(true)}
                className={`flex flex-col items-center justify-center p-2 sm:p-4 rounded-lg border-2 transition-all ${isDelivery === true
                  ? "border-pink-600 bg-pink-50 shadow-md"
                  : "border-gray-300 bg-white hover:border-pink-300 hover:bg-pink-50/50"
                  }`}
              >
                <Truck className={`w-6 h-6 sm:w-8 sm:h-8 mb-1 sm:mb-2 ${isDelivery === true ? "text-pink-600" : "text-gray-400"}`} />
                <span className={`font-bold text-sm sm:text-base ${isDelivery === true ? "text-pink-600" : "text-gray-600"}`}>
                  Delivery
                </span>
                <span className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 text-center">
                  Según zona
                </span>
              </button>
            </div>

            {/* Mensaje cuando no ha seleccionado */}
            {isDelivery === null && (
              <div className="mt-2 sm:mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-2 sm:p-3 flex items-start">
                <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-600 mr-1.5 sm:mr-2 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] sm:text-xs text-yellow-700">
                  Debes seleccionar una opción para continuar
                </p>
              </div>
            )}
          </div>

          {/* Botones condicionales */}
          {isAuthenticated ? (
            <Button
              className={`w-full font-bold py-2.5 sm:py-3 rounded-lg shadow-md transition-all text-sm sm:text-base ${!isOpen || isDelivery === null
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-pink-600 text-white hover:bg-pink-700 hover:shadow-lg"
                }`}
              onClick={handleContinue}
              disabled={!isOpen || isDelivery === null}
            >
              {!isOpen
                ? `Cerrado - Abre a las ${config?.openingTime || '18:00'}`
                : "Continuar"}
            </Button>
          ) : (
            <div className="space-y-2">
              <Button
                className={`w-full font-bold py-2.5 sm:py-3 rounded-lg shadow-md transition-all text-sm sm:text-base ${!isOpen || isDelivery === null
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-pink-600 text-white hover:bg-pink-700 hover:shadow-lg"
                  }`}
                onClick={handleContinue}
                disabled={!isOpen || isDelivery === null}
              >
                {!isOpen
                  ? `Cerrado - Abre a las ${config?.openingTime || '18:00'}`
                  : "Continuar como invitado"}
              </Button>

              <Button
                variant="outline"
                className="w-full font-semibold py-2.5 sm:py-3 text-xs sm:text-sm border-pink-300 text-pink-700 hover:bg-pink-50"
                onClick={!isOpen ? undefined : handleLoginRedirect}
                disabled={!isOpen}
              >
                Iniciar sesión (opcional)
              </Button>
            </div>
          )}
        </div>

        {/* Modal de error de inventario - mantener por compatibilidad pero no mostrarlo automáticamente */}
        <InventoryErrorModal
          isOpen={false} // Cambiado a false para usar nuestra implementación directamente en el carrito
          onClose={() => {
            setIsInventoryErrorModalOpen(false);
            setShowInventoryError(false);
          }}
          validationDetails={inventoryErrorDetails}
          onModifyCart={() => {
            setIsInventoryErrorModalOpen(false);
            setShowInventoryError(false);
            setCurrentView("cart");
          }}
        />
      </div>
    </>
  )
}

export default Cart

"use client"

import { useState, useEffect, useCallback } from "react"
import { useCart } from "../context/CartContext"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import { Trash, ChevronDown, ChevronUp, AlertCircle, X } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Minus, Plus } from "lucide-react"
import { Truck, Store, MapPin, CheckCircle, ArrowLeft, CreditCard, Banknote, ArrowRightCircle, Tag } from "lucide-react"
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
import { functions } from "@/lib/firebase"
import { httpsCallable } from "firebase/functions"
import { useFirestorePizzaConfig } from "@/hooks/useFirestorePizzaConfig"

interface CartProps {
  onClose?: () => void
}

const Cart = ({ onClose }: CartProps) => {
  const { items, removeItem, getTotal, updateQuantity, updateItem, clearCart, createOrder, addItem } = useCart()
  const { preciosConfig } = useFirestorePizzaConfig()
  const [isMounted, setIsMounted] = useState(false)
  const [expandedItems, setExpandedItems] = useState<{ [key: string]: boolean }>({})
  const [inventoryErrorDetails, setInventoryErrorDetails] = useState<any[] | undefined>(undefined)
  const [isInventoryErrorModalOpen, setIsInventoryErrorModalOpen] = useState(false)
  const [showInventoryError, setShowInventoryError] = useState(false)
  
  // Estados para desplegables de upselling
  const [expandedUpsell, setExpandedUpsell] = useState({
    salsas: false,
    bebidas: false,
    snacks: false
  })

  const { isAuthenticated, user } = useAuth()
  const { isOpen, config } = useBusinessHours()
  const [isDelivery, setIsDelivery] = useState<boolean | null>(null) // null = no seleccionado
  const [currentView, setCurrentView] = useState<"cart" | "address" | "payment" | "confirmation">("cart")
  const [paymentMethod, setPaymentMethod] = useState("webpay")
  const [isProcessing, setIsProcessing] = useState(false)
  const [isRedirectingToWebpay, setIsRedirectingToWebpay] = useState(false)
  const [orderNumber, setOrderNumber] = useState(Math.floor(Math.random() * 100000))
  const [confirmedTotal, setConfirmedTotal] = useState(0)
  
  // Crear overlay directamente en el DOM cuando se activa WebPay
  useEffect(() => {
    console.log("🎨 Estado isRedirectingToWebpay cambió a:", isRedirectingToWebpay)
    
    if (isRedirectingToWebpay) {
      console.log("🎨 Creando overlay directamente en el DOM")
      
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
              <div style="width: 4rem; height: 4rem; border: 3px solid #fbcfe8; border-radius: 9999px;"></div>
              <div style="
                width: 4rem; 
                height: 4rem; 
                border: 3px solid #ec4899; 
                border-top-color: transparent; 
                border-radius: 9999px; 
                animation: spin 1s linear infinite;
                position: absolute;
                top: 0;
                left: 0;
              "></div>
            </div>
          </div>
          
          <!-- Icono de tarjeta -->
          <div style="margin-bottom: 0.875rem;">
            <svg style="width: 3rem; height: 3rem; margin: 0 auto; color: #ec4899;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="2" y="5" width="20" height="14" rx="2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="2" y1="10" x2="22" y2="10" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          
          <!-- Mensaje -->
          <h3 style="font-size: 1.25rem; font-weight: bold; color: #1f2937; margin-bottom: 0.5rem; line-height: 1.3;">
            Procesando pago
          </h3>
          <p style="color: #4b5563; margin-bottom: 1rem; font-size: 0.9rem; line-height: 1.4;">
            Estás siendo redirigido a Webpay Plus para completar tu pago de forma segura
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
            <div style="
              background: linear-gradient(to right, #f9a8d4, #ec4899);
              height: 0.4rem;
              border-radius: 9999px;
              width: 70%;
              animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
            "></div>
          </div>
          
          <p style="font-size: 0.8125rem; color: #6b7280; line-height: 1.3;">
            Por favor, no cierres esta ventana...
          </p>
        </div>
      `
      
      // Agregar animaciones
      if (!document.getElementById('webpay-overlay-styles')) {
        const style = document.createElement('style')
        style.id = 'webpay-overlay-styles'
        style.textContent = `
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `
        document.head.appendChild(style)
      }
      
      document.body.appendChild(overlay)
      console.log("✅ Overlay agregado al DOM")
      
      // Cleanup: remover el overlay cuando el componente se desmonte o el estado cambie
      return () => {
        const existingOverlay = document.getElementById('webpay-redirect-overlay')
        if (existingOverlay) {
          existingOverlay.remove()
          console.log("🗑️ Overlay removido del DOM")
        }
      }
    }
  }, [isRedirectingToWebpay])
  
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

  // Estados para pago en efectivo
  const [cashAmount, setCashAmount] = useState("")
  const [cashAmountError, setCashAmountError] = useState("")

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

  // Códigos de descuento válidos (esto vendría de una API en producción)
  const validDiscountCodes = {
    BIENVENIDO10: { percentage: 10, description: "10% de descuento de bienvenida" },
    PIZZA20: { amount: 2000, description: "$2,000 de descuento en pizzas" },
    DELIVERY5: { percentage: 5, description: "5% de descuento en delivery" },
    PROMO15: { percentage: 15, description: "15% de descuento especial" },
  }

  // Cálculos de totales
  const subtotal = getTotal()
  // Solo se cobra delivery si la ubicación pertenece a una zona definida y disponible
  const deliveryCost = isDelivery && deliveryInfo.zone && deliveryInfo.disponible ? deliveryInfo.tarifa : 0

  // Calcular descuento
  let discountAmount = 0
  if (appliedDiscount) {
    if (appliedDiscount.percentage) {
      discountAmount = Math.round((subtotal * appliedDiscount.percentage) / 100)
    } else if (appliedDiscount.amount) {
      discountAmount = appliedDiscount.amount
    }
  }

  const totalFinal = subtotal + deliveryCost - discountAmount

  const toggleItemExpansion = (itemId: string) => {
    setExpandedItems((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }))
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

  // Función para determinar si el botón de pago debe estar deshabilitado
  const isPaymentButtonDisabled = () => {
    if (isProcessing) return true
    
    // Si es pago en efectivo, validar que el monto sea correcto
    if (paymentMethod === "efectivo") {
      if (!cashAmount || cashAmount.trim() === "") return true
      if (cashAmountError !== "") return true
      
      const numericAmount = parseFloat(cashAmount)
      if (isNaN(numericAmount) || numericAmount <= 0) return true
      if (numericAmount < totalFinal) return true
    }
    
    return false
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
    
    if (items.length > 0 && isAuthenticated) {
      if (!isDelivery) {
        setCurrentView("payment")
      } else {
        setCurrentView("address")
      }
    }
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
    if (calle && numero && depto && comuna && selectedLocation) {
      setCurrentView("payment")
    } else {
      toast({
        title: "Campos incompletos",
        description: "Por favor completa todos los campos obligatorios (Número y Depto/Casa).",
        variant: "destructive"
      })
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

    // Validar pago en efectivo si es el método seleccionado
    if (paymentMethod === "efectivo") {
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

    setIsProcessing(true)
    
    // Si el método de pago es Webpay, mostrar indicador de redirección ANTES de procesar
    if (paymentMethod === "webpay") {
      console.log("🔄 Mostrando indicador de redirección a WebPay")
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
      const orderData: any = {
        userId: user?.id || 'anonymous',
        cliente: {
          nombre: user?.name || 'Usuario Anónimo',
          telefono: user?.phone || '',
          email: user?.email || ''
        },
        tipoEntrega: isDelivery ? "Delivery" as const : "Retiro" as const,
        metodoPago: paymentMethod === "efectivo" ? "Efectivo" as const : 
                   paymentMethod === "webpay" ? "Webpay Plus" as const : "Transferencia" as const
      }
      
      console.log(`🔵 OrderData preparado:`, JSON.stringify(orderData, null, 2))

      // Solo agregar tiempo estimado si no es undefined
      if (estimatedTime && estimatedTime !== "") {
        orderData.tiempoEstimado = estimatedTime
      }

      // Solo agregar dirección si es delivery
      if (isDelivery) {
        orderData.direccion = {
          calle: calle || '',
          numero: numero || '',
          depto: depto || '',
          comuna: comuna || '',
          referencia: referencia || '',
          lat: selectedLocation?.lat,
          lng: selectedLocation?.lng
        }
      }

      // Solo agregar detalles de pago si es efectivo
      if (paymentMethod === "efectivo") {
        orderData.paymentDetails = {
          cashAmount: parseFloat(cashAmount),
          change: parseFloat(cashAmount) - totalFinal
        }
      }

      // Solo agregar notas si hay referencia
      if (referencia && referencia.trim() !== '') {
        orderData.notas = referencia
      }

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
          const webpayResponse = await initWebpayFunction({
            orderId: result.id,
            amount: Math.round(totalFinal), // Webpay requiere monto entero
            returnUrl
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
      }
      
      // Para otros métodos de pago (efectivo, transferencia), continuar con flujo normal
      // Usamos el número de pedido real devuelto por Firestore
      setOrderNumber(result.orderNumber)
      
      // Guardar el total confirmado antes de cambiar de vista
      setConfirmedTotal(totalFinal)
      
      // Cambiamos a la vista de confirmación
      setCurrentView("confirmation")
      
      // Limpiamos el carrito DESPUÉS del tiempo mostrado en el mensaje (10 segundos)
      setTimeout(() => {
        clearCart()
        setAppliedDiscount(null)
        setDiscountCode("")
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
    }
  }

  const handleApplyDiscount = () => {
    const code = discountCode.toUpperCase().trim()
    if (!code) {
      setDiscountError("Ingresa un código de descuento")
      return
    }

    if (validDiscountCodes[code as keyof typeof validDiscountCodes]) {
      const discount = validDiscountCodes[code as keyof typeof validDiscountCodes]
      setAppliedDiscount({
        code,
        amount: 'amount' in discount ? discount.amount : 0,
        percentage: 'percentage' in discount ? discount.percentage : 0,
      })
      setDiscountError("")
      setDiscountCode("")
    } else {
      setDiscountError("Código de descuento inválido")
      setAppliedDiscount(null)
    }
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
      if (addressParts.length >= 2) {
        setCalle(addressParts[0].trim())
        setComuna(addressParts[addressParts.length - 2].trim())
      }
    }
  }, [])

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

  // Función para obtener el precio real de un extra
  const getExtraPrice = (extraName: string) => {
    const extraPrices = {
      Ajo: 700,
      Chimichurri: 700,
      Pesto: 1000,
      "Coca Cola Lata": 1500,
      "Coca Cola 1.5L": 2900,
      "Rollitos de Canela": 4900,
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
      <div className="h-full flex flex-col bg-white overflow-y-auto">
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
            <p className="text-gray-700">
              Sigue el estado de tu pedido en la sección de 
              <Link href="/pedidos" className="font-bold text-blue-600 hover:underline mx-1">
                "Mis Pedidos"
              </Link>
            </p>
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
      <div className="text-center p-4">
        <p className="text-gray-500">Tu carrito está vacío</p>
      </div>
    )
  }

  // Vista de dirección
  if (currentView === "address") {
    return (
      <div className="h-full flex flex-col bg-white">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
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
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-6">
            {/* Sección del mapa con altura aumentada */}
            <div className="space-y-2">
              <Label className="text-base font-medium">Seleccionar Ubicación</Label>
              <div className="h-[400px] md:h-[450px] overflow-hidden rounded-lg border border-gray-200 shadow-sm">
                <LocationPicker
                  key={mapKey} // Forzar recreación del componente
                  onLocationSelect={handleLocationSelect}
                  selectedLocation={selectedLocation}
                  onDeliveryInfoChange={handleDeliveryInfoChange}
                />
              </div>
              {/* Indicación de uso como mensaje flotante que se auto-oculta */}
              {!selectedLocation && (
                <div className="bg-yellow-50 border border-yellow-100 rounded-md p-2 text-center animate-pulse">
                  <p className="text-xs text-yellow-700">Haz clic en el mapa para seleccionar tu ubicación exacta</p>
                </div>
              )}
            </div>
            <div className="space-y-4">
              <h3 className="font-medium text-gray-800">Detalles de la Dirección</h3>
              
              {/* Resumen de ubicación seleccionada */}
              {selectedLocation && (
                <div className={`p-3 rounded-lg mb-4 border-2 ${deliveryInfo.disponible ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300"}`}>
                  <div className="flex items-center mb-2">
                    <MapPin className="h-4 w-4 mr-2 flex-shrink-0 text-gray-600" />
                    <span className="text-sm font-medium text-gray-800 truncate">
                      {selectedLocation?.address || "Ubicación seleccionada en el mapa"}
                    </span>
                  </div>
                  {deliveryInfo.zone && (
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
                      <div className="text-sm text-gray-700">
                        Zona: <span style={{color: deliveryInfo.zone.color}} className="font-semibold">{deliveryInfo.zone.nombre}</span>
                      </div>
                      {deliveryInfo.disponible && (
                        <div className={`px-3 py-1 rounded-md ${deliveryInfo.disponible ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
                          <span className="text-xs font-medium">Costo delivery:</span>
                          <span className="text-lg font-bold ml-1">${deliveryInfo.tarifa.toLocaleString()}</span>
                        </div>
                      )}
                      {!deliveryInfo.disponible && (
                        <div className="px-3 py-1 rounded-md bg-red-600 text-white">
                          <span className="text-sm font-bold">No disponible</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              {/* Grid responsivo con mejor manejo para móviles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="calle" className="text-sm">Calle</Label>
                  <Input
                    id="calle"
                    value={calle}
                    onChange={(e) => setCalle(e.target.value)}
                    placeholder="Av. Principal"
                    className="h-9"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numero" className="text-sm font-medium">
                    Número <span className="text-red-500">*</span>
                  </Label>
                  <Input 
                    id="numero" 
                    value={numero} 
                    onChange={(e) => setNumero(e.target.value)} 
                    placeholder="123"
                    className={`h-9 ${!numero ? 'border-2 border-yellow-400 focus:border-yellow-500 bg-yellow-50' : ''}`}
                  />
                  {!numero && (
                    <p className="text-xs text-yellow-600 italic">⚠️ Campo requerido</p>
                  )}
                </div>
              </div>
              {/* Segunda fila también adaptativa */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="depto" className="text-sm font-medium">
                    Depto/Casa <span className="text-red-500">*</span>
                  </Label>
                  <Input 
                    id="depto" 
                    value={depto} 
                    onChange={(e) => setDepto(e.target.value)} 
                    placeholder="Depto 42 o Casa 5"
                    className={`h-9 ${!depto ? 'border-2 border-yellow-400 focus:border-yellow-500 bg-yellow-50' : ''}`}
                  />
                  {!depto && (
                    <p className="text-xs text-yellow-600 italic">⚠️ Campo requerido</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="comuna" className="text-sm">Comuna</Label>
                  <Input
                    id="comuna"
                    value={comuna}
                    onChange={(e) => setComuna(e.target.value)}
                    placeholder="Santiago"
                    className="h-9"
                  />
                </div>
              </div>
              {/* Referencia a pantalla completa */}
              <div className="space-y-2">
                <Label htmlFor="referencia" className="text-sm text-gray-600">
                  Referencia <span className="text-gray-400 italic text-xs">(Opcional)</span>
                </Label>
                <Input
                  id="referencia"
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  placeholder="Edificio azul, cerca del parque, timbre 3"
                  className="h-9"
                />
              </div>
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          {/* Mensajes de error dinámicos que solo aparecen cuando son necesarios */}
          {(!calle || !numero || !depto || !comuna || !selectedLocation) ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-3 animate-fadeIn">
              <p className="text-sm text-yellow-700 text-center">
                Por favor, completa todos los campos obligatorios (*) y selecciona una ubicación.
              </p>
            </div>
          ) : selectedLocation && !deliveryInfo.disponible ? (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-3 animate-fadeIn">
              <p className="text-sm text-red-700 text-center">
                Lo sentimos, el delivery no está disponible en esta zona. Por favor, selecciona otra ubicación.
              </p>
            </div>
          ) : null}
          
          <Button
            onClick={handleAddressSubmit}
            disabled={!calle || !numero || !depto || !comuna || !selectedLocation || !deliveryInfo.disponible || !deliveryInfo.zone}
            className="w-full bg-pink-600 text-white hover:bg-pink-700 font-bold py-3 rounded-lg"
          >
            Continuar al Pago
          </Button>
          {deliveryInfo.disponible && !deliveryInfo.zone && (
            <p className="mt-2 text-xs text-red-600 text-center">Debes seleccionar una ubicación dentro de una zona válida de delivery.</p>
          )}
        </div>
      </div>
    )
  }

  // Vista de pago
  if (currentView === "payment") {
    return (
      <div className="h-full flex flex-col bg-white">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
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
                  <span>${subtotal.toLocaleString()}</span>
                </div>
                {isDelivery && deliveryCost > 0 && (
                  <div className="flex justify-between">
                    <span>Delivery ({deliveryInfo.zone?.nombre}):</span>
                    <span>+${deliveryCost.toLocaleString()}</span>
                  </div>
                )}
                {appliedDiscount && discountAmount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Descuento ({appliedDiscount.code}):</span>
                    <span>-${discountAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Total:</span>
                  <span className="text-pink-600">${totalFinal.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Métodos de pago */}
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
                    <div className="text-xs text-gray-500">Tarjeta de crédito o débito</div>
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
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
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
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
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
              </div>
            )}
          </div>
        </div>

        {/* Sección de código de descuento colapsable */}
        <div className="border-t border-gray-200 bg-gray-50">
          {/* Botón/pestaña para abrir el panel */}
          <button
            onClick={() => setIsDiscountPanelOpen(!isDiscountPanelOpen)}
            className="w-full p-3 flex items-center justify-between hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-pink-600" />
              <span className="font-medium text-gray-800">
                {appliedDiscount ? 'Descuento aplicado' : '¿Tienes un código de descuento?'}
              </span>
              {appliedDiscount && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                  {appliedDiscount.code}
                </span>
              )}
            </div>
            <ChevronDown 
              className={`h-5 w-5 text-gray-500 transition-transform duration-200 ${
                isDiscountPanelOpen ? 'rotate-180' : ''
              }`} 
            />
          </button>

          {/* Panel desplegable */}
          <div 
            className={`transition-all duration-500 ease-in-out overflow-hidden ${
              isDiscountPanelOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
            }`}
            style={{
              transition: 'max-height 0.5s ease-in-out, opacity 0.3s ease-in-out'
            }}
          >
            <div className="p-4 bg-white border-t border-gray-200">
              {appliedDiscount ? (
                <div className="flex items-center justify-between bg-green-50 p-3 rounded-lg border border-green-200">
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
                      className="flex-1"
                    />
                    <Button
                      onClick={handleApplyDiscount}
                      variant="outline"
                      className="border-pink-300 text-pink-600 hover:bg-pink-50"
                    >
                      Aplicar
                    </Button>
                  </div>
                  {discountError && <p className="text-xs text-red-600">{discountError}</p>}
                  <p className="text-xs text-gray-500">Códigos de prueba: BIENVENIDO10, PIZZA20, DELIVERY5, PROMO15</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Botón de confirmar pago */}
        <div className="p-4 bg-gray-50">

          <Button
            onClick={handlePayment}
            disabled={isPaymentButtonDisabled()}
            className={`w-full font-bold py-3 rounded-lg transition-colors ${
              isPaymentButtonDisabled() 
                ? 'bg-gray-400 text-gray-600 cursor-not-allowed hover:bg-gray-400' 
                : 'bg-pink-600 text-white hover:bg-pink-700'
            }`}
          >
            {isProcessing ? "Procesando..." : `Confirmar Pago - $${totalFinal.toLocaleString()}`}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="h-full flex flex-col bg-white">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
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

      <div className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-2 sm:space-y-4">
        {items.map((item) => {
          const extraIngredients = calculateExtraIngredients(item)
          const ingredientPrices = getIngredientPrices(item.size || "Familiar")
          const isExpanded = expandedItems[item.id] || false

          return (
            <div
              key={item.id}
              className="bg-gray-50 rounded-lg sm:rounded-xl p-2 sm:p-4 border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start space-x-2 sm:space-x-3">
                <Image
                  src={item.image || "/placeholder.svg"}
                  alt={item.name}
                  width={50}
                  height={50}
                  className="rounded-lg object-cover flex-shrink-0 sm:w-[60px] sm:h-[60px]"
                  onError={(e: any) => {
                    if (e.target.src !== "/placeholder.svg") {
                      e.target.src = "/placeholder.svg"
                    }
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-1 sm:mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-xs sm:text-sm text-gray-800 leading-tight">{item.name}</h3>
                      {item.size && (
                        <span className="text-[10px] sm:text-xs text-pink-600 font-medium bg-pink-50 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full inline-block mt-0.5 sm:mt-1">
                          {item.size}
                        </span>
                      )}
                    </div>
                    <div className="flex space-x-0.5 sm:space-x-1 ml-1 sm:ml-2 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-0.5 sm:p-1 h-auto"
                        onClick={() => {
                          removeItem(item.id)
                          setShowInventoryError(false) // Limpiar error cuando se elimina un item
                        }}
                        title="Eliminar pedido"
                      >
                        <Trash className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Botón para expandir/contraer detalles - solo para pizzas personalizadas (excepto DUO) */}
                  {item.pizzaType !== 'duo' && ((item.ingredients && item.ingredients.length > 0) || 
                   (item.premiumIngredients && item.premiumIngredients.length > 0) || 
                   (item.sauces && item.sauces.length > 0) || 
                   (item.drinks && item.drinks.length > 0) || 
                   (item.extras && item.extras.length > 0)) ? (
                    <div className="mb-1.5 sm:mb-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleItemExpansion(item.id.toString())}
                        className="text-gray-600 hover:text-gray-800 hover:bg-gray-100 p-1 sm:p-2 h-auto text-[10px] sm:text-xs"
                      >
                        <span className="mr-0.5 sm:mr-1">{isExpanded ? "Ocultar detalles" : "Ver detalles"}</span>
                        {isExpanded ? <ChevronUp className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> : <ChevronDown className="w-2.5 h-2.5 sm:w-3 sm:h-3" />}
                      </Button>
                    </div>
                  ) : null}

                  {/* Desglose de precios con ingredientes individuales */}
                  {isExpanded && (
                    <div className="space-y-2 mb-3 animate-in slide-in-from-top-2 duration-200">
                      <div className="bg-white p-3 rounded-lg border border-gray-200 text-xs space-y-1">
                        <div className="font-medium text-gray-700 mb-2">Desglose de Precio:</div>

                        <div className="flex justify-between">
                          <span className="text-gray-600">
                            {item.name.includes("DUO") 
                              ? `Pizza DUO (${item.size}):` 
                              : item.selectedMenuPizza && item.selectedMenuPizza !== 'base'
                                ? `Pizza base ${item.selectedMenuPizza} (${item.size}):`
                                : `Pizza base (${item.size}):`}
                          </span>
                          <span>${(item.basePrice || 0).toLocaleString()}</span>
                        </div>

                        {/* Ingredientes simples individuales */}
                        {item.ingredients && item.ingredients.length > 0 && (
                          <>
                            {item.ingredients.map((ingredient, index) => {
                              // En Promo: los primeros 2 están incluidos en la base, no mostrarlos
                              // En Premium: todos los ingredientes se cobran, mostrar todos
                              if (item.name.includes("Promo") && index < 2) return null
                              
                              // Extraer nombre y cantidad del formato "Nombre (cantidad)"
                              const match = ingredient.match(/^(.+?)\s*\((\d+)\)$/)
                              const ingredientName = match ? match[1] : ingredient
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
                        {item.premiumIngredients && item.premiumIngredients.length > 0 && (
                          <>
                            {item.premiumIngredients.map((ingredient, index) => {
                              // Extraer nombre y cantidad del formato "Nombre (cantidad)"
                              const match = ingredient.match(/^(.+?)\s*\((\d+)\)$/)
                              const ingredientName = match ? match[1] : ingredient
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
                        {item.sauces && item.sauces.length > 0 && (
                          <>
                            {item.sauces.map((sauce, index) => {
                              // Extraer nombre y cantidad del formato "Nombre (cantidad)"
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
                        {item.drinks && item.drinks.length > 0 && (
                          <>
                            {item.drinks.map((drink, index) => {
                              // Extraer nombre y cantidad del formato "Nombre (cantidad)"
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
                        {item.extras && item.extras.length > 0 && (
                          <>
                            {item.extras.map((extra, index) => {
                              // Extraer nombre y cantidad del formato "Nombre (cantidad)"
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

                        <div className="flex justify-between font-medium border-t pt-2 mt-2 text-pink-600">
                          <span>Subtotal unitario:</span>
                          <span>${item.price.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Opciones de Personalización - Solo para pizzas reales */}
                  {(() => {
                    const itemNameLower = item.name.toLowerCase()
                    // Excluir salsas, bebidas, gauchitos y rollitos
                    const excludedItems = ['salsa', 'coca', 'lipton', 'sprite', 'fanta', 'agua', 'jugo', 'gauchitos', 'rollitos']
                    const isExcluded = excludedItems.some(excluded => itemNameLower.includes(excluded))
                    
                    // Mostrar para todo excepto los productos excluidos
                    return !isExcluded
                  })() && (
                  <div className="mt-2 mb-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        updateItem({
                          ...item,
                          sinOregano: !item.sinOregano
                        })
                      }}
                      className={`px-3 py-1.5 text-xs rounded-md border transition-all cursor-pointer ${
                        item.sinOregano 
                          ? 'bg-pink-600 text-white border-pink-600 font-semibold' 
                          : 'bg-white text-gray-700 border-gray-300 hover:border-pink-400'
                      }`}
                    >
                      Sin Orégano
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => {
                        updateItem({
                          ...item,
                          sinQueso: !item.sinQueso
                        })
                      }}
                      className={`px-3 py-1.5 text-xs rounded-md border transition-all cursor-pointer ${
                        item.sinQueso 
                          ? 'bg-pink-600 text-white border-pink-600 font-semibold' 
                          : 'bg-white text-gray-700 border-gray-300 hover:border-pink-400'
                      }`}
                    >
                      Sin Queso
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => {
                        updateItem({
                          ...item,
                          sinSalsaTomate: !item.sinSalsaTomate
                        })
                      }}
                      className={`px-3 py-1.5 text-xs rounded-md border transition-all cursor-pointer ${
                        item.sinSalsaTomate 
                          ? 'bg-pink-600 text-white border-pink-600 font-semibold' 
                          : 'bg-white text-gray-700 border-gray-300 hover:border-pink-400'
                      }`}
                    >
                      Sin Salsa Tomate
                    </button>
                  </div>
                  )}

                  {/* Controles de cantidad */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5 sm:space-x-2">
                      <Button
                        size="icon"
                        variant="outline"
                        className="w-7 h-7 sm:w-8 sm:h-8 bg-white border-gray-300 text-gray-600 hover:bg-pink-50 hover:border-pink-300 hover:text-pink-600"
                        onClick={() => {
                          updateQuantity(item.id, Math.max(0, item.quantity - 1))
                          setShowInventoryError(false) // Limpiar error cuando se modifica la cantidad
                        }}
                      >
                        <Minus className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                      </Button>
                      <span className="w-6 sm:w-8 text-center text-sm sm:text-base font-medium text-gray-800">{item.quantity}</span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="w-7 h-7 sm:w-8 sm:h-8 bg-white border-gray-300 text-gray-600 hover:bg-pink-50 hover:border-pink-300 hover:text-pink-600"
                        onClick={() => {
                          updateQuantity(item.id, item.quantity + 1)
                          setShowInventoryError(false) // Limpiar error cuando se modifica la cantidad
                        }}
                      >
                        <Plus className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                      </Button>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-sm sm:text-base text-gray-800">${(item.price * item.quantity).toLocaleString()}</div>
                      {item.quantity > 1 && (
                        <div className="text-[10px] sm:text-xs text-gray-500">${item.price.toLocaleString()} c/u</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Secciones de Upselling */}
      {/* Funciones auxiliares para detectar categorías en el carrito */}
      {(() => {
        const hasSalsas = items.some(item => 
          ['17', '18', '19', '20'].includes(item.id) || 
          item.name?.toLowerCase().includes('salsa')
        )
        const hasBebidas = items.some(item => {
          const itemName = item.name?.toLowerCase() || ''
          return item.id.includes('401') || item.id.includes('402') ||
            itemName.includes('coca') ||
            itemName.includes('bebida') ||
            itemName.includes('lipton') ||
            itemName.includes('sprite') ||
            itemName.includes('fanta') ||
            itemName.includes('agua') ||
            itemName.includes('jugo')
        })
        const hasSnacks = items.some(item => 
          ['15', '16'].includes(item.id) ||
          item.name?.toLowerCase().includes('gauchito') ||
          item.name?.toLowerCase().includes('rollito')
        )
        
        return (
          <div className="px-2 sm:px-4 pb-2 sm:pb-4 space-y-2 sm:space-y-3">
            {/* Sección 1: Salsas - Solo mostrar si NO hay salsas en el carrito */}
            {!hasSalsas && (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => setExpandedUpsell(prev => ({ ...prev, salsas: !prev.salsas }))}
            className="w-full flex items-center justify-between p-2 sm:p-3 hover:bg-gray-50 transition-colors"
          >
            <span className="font-medium text-xs sm:text-sm text-gray-700">¿Agregas Salsas?</span>
            {expandedUpsell.salsas ? (
              <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
            )}
          </button>
          
          {expandedUpsell.salsas && (
            <div className="px-2 sm:px-3 pb-2 sm:pb-3 space-y-1 sm:space-y-2 border-t border-gray-100">
              {[
                { id: 17, name: "Salsa de Ajo", price: 700, image: "/pizzas/salsa de ajo.jpg" },
                { id: 18, name: "Salsa Chimichurri", price: 700, image: "/pizzas/salsa chimichurri.jpg" },
                { id: 19, name: "Salsa BBQ", price: 700, image: "/pizzas/salsa bbq.jpg" },
                { id: 20, name: "Salsa Pesto", price: 1000, image: "/pizzas/salsa pesto.jpg" },
              ].map(salsa => {
                const cartItem = items.find(item => item.id === String(salsa.id))
                const isInCart = !!cartItem
                const quantity = cartItem?.quantity || 1

                return (
                  <div key={salsa.id} className="flex items-center justify-between py-1.5 sm:py-2">
                    <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer flex-1">
                      <input
                        type="checkbox"
                        checked={isInCart}
                        onChange={(e) => {
                          if (e.target.checked) {
                            addItem({
                              id: String(salsa.id),
                              name: salsa.name,
                              price: salsa.price,
                              quantity: 1,
                              image: salsa.image
                            })
                          } else {
                            removeItem(String(salsa.id))
                          }
                        }}
                        className="w-3.5 h-3.5 sm:w-4 sm:h-4 accent-pink-600"
                      />
                      <span className="text-xs sm:text-sm text-gray-700">{salsa.name}</span>
                      <span className="text-xs sm:text-sm text-gray-500">${salsa.price.toLocaleString()}</span>
                    </label>
                    
                    {isInCart && (
                      <div className="flex items-center gap-1 sm:gap-2">
                        <Button
                          size="icon"
                          variant="outline"
                          className="w-5 h-5 sm:w-6 sm:h-6 p-0"
                          onClick={() => updateQuantity(String(salsa.id), Math.max(0, quantity - 1))}
                        >
                          <Minus className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        </Button>
                        <span className="w-5 sm:w-6 text-center text-xs sm:text-sm font-medium">{quantity}</span>
                        <Button
                          size="icon"
                          variant="outline"
                          className="w-5 h-5 sm:w-6 sm:h-6 p-0"
                          onClick={() => updateQuantity(String(salsa.id), quantity + 1)}
                        >
                          <Plus className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
              </div>
            )}

            {/* Sección 2: Bebidas - Solo mostrar si NO hay bebidas en el carrito */}
            {!hasBebidas && (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => setExpandedUpsell(prev => ({ ...prev, bebidas: !prev.bebidas }))}
            className="w-full flex items-center justify-between p-2 sm:p-3 hover:bg-gray-50 transition-colors"
          >
            <span className="font-medium text-xs sm:text-sm text-gray-700">¿Agregar Bebida?</span>
            {expandedUpsell.bebidas ? (
              <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
            )}
          </button>
          
          {expandedUpsell.bebidas && (
            <div className="px-2 sm:px-3 pb-2 sm:pb-3 space-y-1 sm:space-y-2 border-t border-gray-100">
              {[
                { id: 401, name: "Coca Cola Lata 350cc", price: 1500, variants: ["Tradicional", "Zero"], image: "/pizzas/coca cola lata.jpg" },
                { id: 402, name: "Coca Cola 1.5 Litro", price: 2900, variants: ["Tradicional", "Zero"], image: "/pizzas/coca cola 1.5 litro.jpg" },
              ].map(bebida => {
                return bebida.variants.map((variant, idx) => {
                  const itemId = idx === 0 ? `${bebida.id}-familiar` : `${bebida.id}-mediana`
                  const cartItem = items.find(item => item.id === itemId)
                  const isInCart = !!cartItem
                  const quantity = cartItem?.quantity || 1

                  return (
                    <div key={itemId} className="flex items-center justify-between py-1.5 sm:py-2">
                      <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          checked={isInCart}
                          onChange={(e) => {
                            if (e.target.checked) {
                              addItem({
                                id: itemId,
                                name: `${bebida.name} ${variant}`,
                                price: bebida.price,
                                quantity: 1,
                                image: bebida.image
                              })
                            } else {
                              removeItem(itemId)
                            }
                          }}
                          className="w-3.5 h-3.5 sm:w-4 sm:h-4 accent-pink-600"
                        />
                        <span className="text-xs sm:text-sm text-gray-700">{bebida.name} - {variant}</span>
                        <span className="text-xs sm:text-sm text-gray-500">${bebida.price.toLocaleString()}</span>
                      </label>
                      
                      {isInCart && (
                        <div className="flex items-center gap-1 sm:gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            className="w-5 h-5 sm:w-6 sm:h-6 p-0"
                            onClick={() => updateQuantity(itemId, Math.max(0, quantity - 1))}
                          >
                            <Minus className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          </Button>
                          <span className="w-5 sm:w-6 text-center text-xs sm:text-sm font-medium">{quantity}</span>
                          <Button
                            size="icon"
                            variant="outline"
                            className="w-5 h-5 sm:w-6 sm:h-6 p-0"
                            onClick={() => updateQuantity(itemId, quantity + 1)}
                          >
                            <Plus className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                })
              })}
            </div>
          )}
              </div>
            )}

            {/* Sección 3: Gauchitos y Rollitos - Solo mostrar si NO hay snacks en el carrito */}
            {!hasSnacks && (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => setExpandedUpsell(prev => ({ ...prev, snacks: !prev.snacks }))}
            className="w-full flex items-center justify-between p-2 sm:p-3 hover:bg-gray-50 transition-colors"
          >
            <span className="font-medium text-xs sm:text-sm text-gray-700">¿Agrega Gauchitos o Rollitos Canela?</span>
            {expandedUpsell.snacks ? (
              <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
            )}
          </button>
          
          {expandedUpsell.snacks && (
            <div className="px-2 sm:px-3 pb-2 sm:pb-3 space-y-1 sm:space-y-2 border-t border-gray-100">
              {[
                { id: 15, name: "Rollitos de Canela", price: 4900 },
                { id: 16, name: "Gauchitos", price: 4000 },
              ].map(snack => {
                const cartItem = items.find(item => item.id === String(snack.id))
                const isInCart = !!cartItem
                const quantity = cartItem?.quantity || 1

                return (
                  <div key={snack.id} className="flex items-center justify-between py-1.5 sm:py-2">
                    <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer flex-1">
                      <input
                        type="checkbox"
                        checked={isInCart}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const imageMap: Record<string, string> = {
                              "Rollitos de Canela": "/pizzas/canela.jpg",
                              "Gauchitos": "/pizzas/gauchitos.jpg"
                            };
                            addItem({
                              id: String(snack.id),
                              name: snack.name,
                              price: snack.price,
                              quantity: 1,
                              image: imageMap[snack.name] || "/placeholder.svg?height=200&width=200"
                            })
                          } else {
                            removeItem(String(snack.id))
                          }
                        }}
                        className="w-3.5 h-3.5 sm:w-4 sm:h-4 accent-pink-600"
                      />
                      <span className="text-xs sm:text-sm text-gray-700">{snack.name}</span>
                      <span className="text-xs sm:text-sm text-gray-500">${snack.price.toLocaleString()}</span>
                    </label>
                    
                    {isInCart && (
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <Button
                          size="icon"
                          variant="outline"
                          className="w-5 h-5 sm:w-6 sm:h-6 p-0"
                          onClick={() => updateQuantity(String(snack.id), Math.max(0, quantity - 1))}
                        >
                          <Minus className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        </Button>
                        <span className="w-5 sm:w-6 text-center text-xs sm:text-sm font-medium">{quantity}</span>
                        <Button
                          size="icon"
                          variant="outline"
                          className="w-5 h-5 sm:w-6 sm:h-6 p-0"
                          onClick={() => updateQuantity(String(snack.id), quantity + 1)}
                        >
                          <Plus className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
              </div>
            )}
          </div>
        )
      })()}

      <div className="p-2 sm:p-4 border-t border-gray-200 space-y-2 sm:space-y-4 bg-gray-50">
        {/* Resumen de totales */}
        <div className="space-y-1 sm:space-y-2">
          <div className="flex justify-between text-xs sm:text-sm text-gray-700">
            <span>Subtotal</span>
            <span className="font-medium">${subtotal.toLocaleString()}</span>
          </div>
          {isDelivery && deliveryCost > 0 && (
            <div className="flex justify-between text-xs sm:text-sm text-blue-600">
              <span>Delivery</span>
              <span className="font-medium">+${deliveryCost.toLocaleString()}</span>
            </div>
          )}
          {appliedDiscount && discountAmount > 0 && (
            <div className="flex justify-between text-xs sm:text-sm text-green-600">
              <span>Descuento ({appliedDiscount.code})</span>
              <span className="font-medium">-${discountAmount.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base sm:text-lg text-gray-800 border-t pt-1.5 sm:pt-2">
            <span>Total</span>
            <span className="text-pink-600">${totalFinal.toLocaleString()}</span>
          </div>
        </div>

        {/* Botones para elegir entre Retirar y Delivery */}
        <div className="bg-white rounded-lg p-2 sm:p-4 border border-gray-200">
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {/* Botón Retirar */}
            <button
              onClick={() => setIsDelivery(false)}
              className={`flex flex-col items-center justify-center p-2 sm:p-4 rounded-lg border-2 transition-all ${
                isDelivery === false
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
              className={`flex flex-col items-center justify-center p-2 sm:p-4 rounded-lg border-2 transition-all ${
                isDelivery === true
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
            className={`w-full font-bold py-2.5 sm:py-3 rounded-lg shadow-md transition-all text-sm sm:text-base ${
              !isOpen || isDelivery === null
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
          <Button
            className={`w-full font-bold py-2.5 sm:py-3 rounded-lg shadow-md transition-all text-xs sm:text-sm ${
              !isOpen
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-pink-600 text-white hover:bg-pink-700 hover:shadow-lg"
            }`}
            onClick={!isOpen ? undefined : handleLoginRedirect}
            disabled={!isOpen}
          >
            {!isOpen 
              ? `Cerrado - Abre a las ${config?.openingTime || '18:00'}` 
              : "Inicia sesión para continuar"}
          </Button>
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

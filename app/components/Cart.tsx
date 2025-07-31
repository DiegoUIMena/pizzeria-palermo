"use client"

import { useState, useEffect, useCallback } from "react"
import { useCart } from "../context/CartContext"
import { Button } from "@/components/ui/button"
import { Trash, ChevronDown, ChevronUp, Edit } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Minus, Plus } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Truck, Store, MapPin, CheckCircle, ArrowLeft, CreditCard, Banknote, ArrowRightCircle, Tag } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useAuth } from "../context/AuthContext"
import LocationPicker from "./LocationPicker"
import type { DeliveryZone } from "../lib/delivery-zones"
import PizzaConfigModal from "./PizzaConfigModal"

const Cart = () => {
  const { items, removeItem, getTotal, updateQuantity, clearCart, createOrder } = useCart()
  const [isMounted, setIsMounted] = useState(false)
  const [expandedItems, setExpandedItems] = useState<{ [key: string]: boolean }>({})
  const [editingItem, setEditingItem] = useState<any>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  const { isAuthenticated, user } = useAuth()
  const [isDelivery, setIsDelivery] = useState(false)
  const [currentView, setCurrentView] = useState<"cart" | "address" | "payment" | "confirmation">("cart")
  const [paymentMethod, setPaymentMethod] = useState("webpay")
  const [isProcessing, setIsProcessing] = useState(false)
  const [orderNumber, setOrderNumber] = useState(Math.floor(Math.random() * 100000))
  const [estimatedTime, setEstimatedTime] = useState("20-25 minutos")

  // Estados para códigos de descuento
  const [discountCode, setDiscountCode] = useState("")
  const [appliedDiscount, setAppliedDiscount] = useState<{
    code: string
    amount: number
    percentage?: number
  } | null>(null)
  const [discountError, setDiscountError] = useState("")

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
  const deliveryCost = isDelivery && deliveryInfo.disponible ? deliveryInfo.tarifa : 0

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

  const handleEditItem = (item: any) => {
    // Determinar el tipo de pizza basado en el nombre
    let pizzaType = "promo" // default
    
    if (item.name.includes("Duo")) {
      pizzaType = "duo"
    } else if (item.name.includes("Premium")) {
      pizzaType = "premium"
    }

    setEditingItem({
      ...item,
      pizzaType: pizzaType,
    })
    setIsEditModalOpen(true)
  }

  const handleEditComplete = (updatedItem: any) => {
    // Aquí actualizarías el item en el carrito
    // Por ahora solo cerramos el modal
    setIsEditModalOpen(false)
    setEditingItem(null)
  }

  const handleEditCancel = () => {
    setIsEditModalOpen(false)
    setEditingItem(null)
  }

  // Función para determinar si un item es editable (solo pizzas armables)
  const isItemEditable = (item: any) => {
    // Solo las pizzas armables (promo, premium, duo) son editables
    // Se identifican principalmente por tener el campo pizzaType
    if (item.pizzaType) {
      return ["promo", "premium", "duo"].includes(item.pizzaType)
    }
    
    // Fallback: verificar por patrones en el nombre para compatibilidad con items antiguos
    // pero ser más estricto para evitar falsos positivos
    const name = item.name.toLowerCase()
    if (name.includes("pizza")) {
      return (
        name.includes("pizza") && name.includes("promo") ||
        name.includes("pizza") && name.includes("premium") ||
        name.includes("pizza duo")
      )
    }
    
    return false
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
    if (items.length > 0 && isAuthenticated) {
      if (!isDelivery) {
        setCurrentView("payment")
      } else {
        setCurrentView("address")
      }
    }
  }

  const handleAddressSubmit = () => {
    if (calle && numero && comuna && selectedLocation && deliveryInfo.disponible) {
      setCurrentView("payment")
    }
  }

  const handlePayment = async () => {
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
    
    setIsProcessing(true)
    try {
      // Crear el pedido en Firestore
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

      // Solo agregar tiempo estimado si no es undefined
      if (estimatedTime && estimatedTime !== "") {
        orderData.tiempoEstimado = estimatedTime
      }

      // Solo agregar dirección si es delivery
      if (isDelivery) {
        orderData.direccion = {
          calle: calle || '',
          numero: numero || '',
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

      const orderId = await createOrder(orderData)
      console.log('Pedido creado exitosamente:', orderId)
      
      // Usamos el número de pedido real devuelto por Firestore
      setOrderNumber(orderId.orderNumber)
      
      // Cambiamos a la vista de confirmación
      setCurrentView("confirmation")
      
      // Limpiamos el carrito DESPUÉS del tiempo mostrado en el mensaje (10 segundos)
      setTimeout(() => {
        clearCart()
        setAppliedDiscount(null)
        setDiscountCode("")
        setExpandedItems({})
        setCurrentView("cart")
      }, 10000) // 10 segundos para que el usuario pueda ver la confirmación
      
      // Limpiar datos de efectivo
      setCashAmount("")
      setCashAmountError("")
    } catch (error) {
      console.error("Error al crear el pedido:", error)
      alert("Error al crear el pedido. Inténtalo de nuevo.")
    } finally {
      setIsProcessing(false)
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
  const [mapKey, setMapKey] = useState<number>(Date.now())
  
  // Forzar remonte del componente de mapa cuando cambia la vista o al activar delivery
  useEffect(() => {
    if (currentView === "address" && isDelivery) {
      console.log("Forzando recreación del componente de mapa");
      
      // Múltiples intentos de remontaje para asegurar la correcta visualización
      // Primero inmediatamente
      setMapKey(Date.now());
      
      // Luego con varios retrasos para asegurar que el mapa se muestre correctamente
      setTimeout(() => setMapKey(Date.now()), 250);
      setTimeout(() => setMapKey(Date.now()), 500);
      setTimeout(() => setMapKey(Date.now()), 1000);
    }
  }, [currentView, isDelivery]);
  
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

  // Función para obtener precios de ingredientes según tamaño
  const getIngredientPrices = (size: string) => {
    if (size === "Mediana") {
      return { simple: 1000, premium: 1500 }
    } else if (size === "Familiar") {
      return { simple: 1500, premium: 2000 }
    }
    return { simple: 1000, premium: 1500 }
  }

  if (!isMounted) {
    return null
  }

  // Vista de confirmación tiene prioridad sobre otras vistas
  if (currentView === "confirmation") {
    return (
      <div className="h-full flex flex-col bg-white p-6 text-center">
        <div className="flex-1 flex flex-col justify-center">
          {/* Icono de confirmación grande y animado */}
          <div className="flex justify-center mb-8">
            <div className="bg-green-100 p-8 rounded-full shadow-lg animate-pulse">
              <CheckCircle className="h-24 w-24 text-green-600" strokeWidth={1.5} />
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-green-600 mb-6">¡Pedido Confirmado!</h2>
          
          {/* Número de pedido destacado */}
          <div className="bg-pink-50 py-8 px-6 rounded-lg border-2 border-pink-300 mb-8 shadow-md">
            <h3 className="text-sm uppercase tracking-wider font-medium text-gray-600 mb-3">Número de Pedido</h3>
            <div className="text-6xl font-extrabold text-pink-600 mb-3">#{orderNumber}</div>
            <p className="text-sm text-gray-600">Guarda este número para cualquier consulta</p>
          </div>
          
          {/* Instrucciones para seguimiento */}
          <div className="bg-blue-50 p-5 rounded-lg border border-blue-200 mb-6">
            <h3 className="font-medium text-gray-800 mb-2 flex items-center justify-center">
              <ArrowRightCircle className="h-5 w-5 text-blue-600 mr-2" />
              Seguimiento de Pedido
            </h3>
            <p className="text-gray-700 mb-3">
              Sigue el estado de tu pedido en la sección de 
              <Link href="/pedidos" className="font-bold text-blue-600 hover:underline mx-1">
                "Mis Pedidos"
              </Link>
            </p>
            <p className="text-sm text-gray-600">Podrás ver el progreso en tiempo real y recibir notificaciones cuando tu pedido esté listo.</p>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4">
            <h3 className="font-medium text-gray-800 mb-2">Tiempo Estimado</h3>
            <p className="text-xl font-bold text-pink-600">{estimatedTime}</p>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-4">
            <h3 className="font-medium text-gray-800 mb-2">Total Pagado</h3>
            <p className="text-xl font-bold text-blue-600">${totalFinal.toLocaleString()}</p>
          </div>
          
          {isDelivery && deliveryInfo.zone && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-4">
              <h3 className="font-medium text-gray-800 mb-2">Información de Delivery</h3>
              <p className="text-sm text-gray-600">Zona: {deliveryInfo.zone.nombre}</p>
              <p className="text-sm text-gray-600">Costo: ${deliveryInfo.tarifa.toLocaleString()}</p>
            </div>
          )}
          
          <Button 
            onClick={() => {
              clearCart();
              setAppliedDiscount(null);
              setDiscountCode("");
              setExpandedItems({});
              setCurrentView("cart");
            }}
            className="mt-4 bg-pink-600 hover:bg-pink-700 text-white"
          >
            Volver al Menú
          </Button>
          
          <p className="text-xs text-gray-500 mt-4">El carrito se limpiará automáticamente en 10 segundos...</p>
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
                <div className={`p-2 rounded-md text-sm mb-3 ${deliveryInfo.disponible ? "bg-green-50 border border-green-100" : "bg-red-50 border border-red-100"}`}>
                  <div className="flex items-center mb-1">
                    <MapPin className="h-3 w-3 mr-1 flex-shrink-0 text-gray-500" />
                    <span className="text-xs font-medium text-gray-700 truncate">
                      {selectedLocation?.address || "Ubicación seleccionada en el mapa"}
                    </span>
                  </div>
                  {deliveryInfo.zone && (
                    <div className="text-xs text-gray-600">
                      Zona: <span style={{color: deliveryInfo.zone.color}} className="font-medium">{deliveryInfo.zone.nombre}</span>
                      {deliveryInfo.disponible && <span className="ml-1">(${deliveryInfo.tarifa.toLocaleString()})</span>}
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
                  <Label htmlFor="numero" className="text-sm">Número</Label>
                  <Input 
                    id="numero" 
                    value={numero} 
                    onChange={(e) => setNumero(e.target.value)} 
                    placeholder="123"
                    className="h-9" 
                  />
                </div>
              </div>
              {/* Segunda fila también adaptativa */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="depto" className="text-sm">Depto/Casa</Label>
                  <Input 
                    id="depto" 
                    value={depto} 
                    onChange={(e) => setDepto(e.target.value)} 
                    placeholder="Depto 42"
                    className="h-9" 
                  />
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
                <Label htmlFor="referencia" className="text-sm">Referencia</Label>
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
          {(!calle || !numero || !comuna || !selectedLocation) ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-3 animate-fadeIn">
              <p className="text-sm text-yellow-700 text-center">
                Por favor, completa todos los campos obligatorios y selecciona una ubicación.
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
            disabled={!calle || !numero || !comuna || !selectedLocation || !deliveryInfo.disponible}
            className="w-full bg-pink-600 text-white hover:bg-pink-700 font-bold py-3 rounded-lg"
          >
            Continuar al Pago
          </Button>
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

        {/* Sección de código de descuento */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="mb-4">
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center mb-3">
                <Tag className="h-4 w-4 text-pink-600 mr-2" />
                <span className="font-medium text-gray-800">Código de Descuento</span>
              </div>

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
    <div className="h-full flex flex-col bg-white">
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <h2 className="text-xl font-bold text-gray-800">Tu Carrito ({items.length})</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {items.map((item) => {
          const extraIngredients = calculateExtraIngredients(item)
          const ingredientPrices = getIngredientPrices(item.size || "Familiar")
          const isExpanded = expandedItems[item.id] || false

          return (
            <div
              key={item.id}
              className="bg-gray-50 rounded-xl p-4 border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start space-x-3">
                <Image
                  src={item.image || "/placeholder.svg"}
                  alt={item.name}
                  width={60}
                  height={60}
                  className="rounded-lg object-cover flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm text-gray-800">{item.name}</h3>
                      {item.size && (
                        <span className="text-xs text-pink-600 font-medium bg-pink-50 px-2 py-1 rounded-full inline-block mt-1">
                          {item.size}
                        </span>
                      )}
                    </div>
                    <div className="flex space-x-1 ml-2 flex-shrink-0">
                      {isItemEditable(item) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-1 h-auto"
                          onClick={() => handleEditItem(item)}
                          title="Editar pedido"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 h-auto"
                        onClick={() => removeItem(item.id)}
                        title="Eliminar pedido"
                      >
                        <Trash className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Botón para expandir/contraer detalles */}
                  <div className="mb-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleItemExpansion(item.id.toString())}
                      className="text-gray-600 hover:text-gray-800 hover:bg-gray-100 p-2 h-auto text-xs"
                    >
                      <span className="mr-1">{isExpanded ? "Ocultar detalles" : "Ver detalles"}</span>
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </Button>
                  </div>

                  {/* Detalles del pedido desplegables */}
                  {isExpanded && (
                    <div className="space-y-2 mb-3 animate-in slide-in-from-top-2 duration-200">
                      {/* Ingredientes Incluidos */}
                      {item.ingredients && item.ingredients.length > 0 && (
                        <div className="text-xs">
                          <span className="font-medium text-gray-700">Ingredientes: </span>
                          <span className="text-gray-600">
                            {item.ingredients.map((ingredient, index) => {
                              const isExtra = item.name.includes("Promo") && index >= 2
                              return (
                                <span key={index}>
                                  {ingredient.replace(/\s*$$\d+$$/, "")}
                                  {isExtra && ` (+$${ingredientPrices.simple.toLocaleString()})`}
                                  {index < (item.ingredients?.length || 0) - 1 ? ", " : ""}
                                </span>
                              )
                            })}
                          </span>
                        </div>
                      )}

                      {/* Ingredientes Premium */}
                      {item.premiumIngredients && item.premiumIngredients.length > 0 && (
                        <div className="text-xs">
                          <span className="font-medium text-pink-700">Premium: </span>
                          <span className="text-pink-600">
                            {item.premiumIngredients.map((ingredient, index) => {
                              const isExtra = item.name.includes("Premium") && index >= 1
                              const isExtraInPromo = item.name.includes("Promo")
                              return (
                                <span key={index}>
                                  {ingredient.replace(/\s*$$\d+$$/, "")}
                                  {(isExtra || isExtraInPromo) && ` (+$${ingredientPrices.premium.toLocaleString()})`}
                                  {index < (item.premiumIngredients?.length || 0) - 1 ? ", " : ""}
                                </span>
                              )
                            })}
                          </span>
                        </div>
                      )}

                      {/* Salsas con precios reales */}
                      {item.sauces && item.sauces.length > 0 && (
                        <div className="text-xs">
                          <span className="font-medium text-green-700">Salsas: </span>
                          <span className="text-green-600">
                            {item.sauces.map((sauce, index) => {
                              const sauceName = sauce.replace(/\s*$$\d+$$/, "")
                              const price = getExtraPrice(sauceName)
                              return (
                                <span key={index}>
                                  {sauceName} (+${price.toLocaleString()}){index < (item.sauces?.length || 0) - 1 ? ", " : ""}
                                </span>
                              )
                            })}
                          </span>
                        </div>
                      )}

                      {/* Bebidas con precios reales */}
                      {item.drinks && item.drinks.length > 0 && (
                        <div className="text-xs">
                          <span className="font-medium text-blue-700">Bebidas: </span>
                          <span className="text-blue-600">
                            {item.drinks.map((drink, index) => {
                              const drinkName = drink.replace(/\s*$$\d+$$/, "")
                              const price = getExtraPrice(drinkName)
                              return (
                                <span key={index}>
                                  {drinkName} (+${price.toLocaleString()}){index < (item.drinks?.length || 0) - 1 ? ", " : ""}
                                </span>
                              )
                            })}
                          </span>
                        </div>
                      )}

                      {/* Extras con precios reales */}
                      {item.extras && item.extras.length > 0 && (
                        <div className="text-xs">
                          <span className="font-medium text-purple-700">Agregados: </span>
                          <span className="text-purple-600">
                            {item.extras.map((extra, index) => {
                              const extraName = extra.replace(/\s*$$\d+$$/, "")
                              const price = getExtraPrice(extraName)
                              return (
                                <span key={index}>
                                  {extraName} (+${price.toLocaleString()}){index < (item.extras?.length || 0) - 1 ? ", " : ""}
                                </span>
                              )
                            })}
                          </span>
                        </div>
                      )}

                      {/* Desglose de precios corregido */}
                      <div className="bg-white p-3 rounded-lg border border-gray-200 text-xs space-y-1">
                        <div className="font-medium text-gray-700 mb-2">Desglose de Precio:</div>

                        <div className="flex justify-between">
                          <span className="text-gray-600">
                            {item.name.includes("DUO") ? `Pizza DUO (${item.size}):` : `Pizza base (${item.size}):`}
                          </span>
                          <span>${(item.basePrice || 0).toLocaleString()}</span>
                        </div>

                        {/* Ingredientes extras */}
                        {extraIngredients.extraSimple > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Ingredientes extra ({extraIngredients.extraSimple}):</span>
                            <span>+${(extraIngredients.extraSimple * ingredientPrices.simple).toLocaleString()}</span>
                          </div>
                        )}

                        {extraIngredients.extraPremium > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Premium extra ({extraIngredients.extraPremium}):</span>
                            <span>+${(extraIngredients.extraPremium * ingredientPrices.premium).toLocaleString()}</span>
                          </div>
                        )}

                        {/* Salsas */}
                        {item.sauces && item.sauces.length > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Salsas ({item.sauces.length}):</span>
                            <span>
                              +$
                              {item.sauces
                                .reduce((total, sauce) => {
                                  const sauceName = sauce.replace(/\s*$$\d+$$/, "")
                                  return total + getExtraPrice(sauceName)
                                }, 0)
                                .toLocaleString()}
                            </span>
                          </div>
                        )}

                        {/* Bebidas */}
                        {item.drinks && item.drinks.length > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Bebidas ({item.drinks.length}):</span>
                            <span>
                              +$
                              {item.drinks
                                .reduce((total, drink) => {
                                  const drinkName = drink.replace(/\s*$$\d+$$/, "")
                                  return total + getExtraPrice(drinkName)
                                }, 0)
                                .toLocaleString()}
                            </span>
                          </div>
                        )}

                        {/* Agregados */}
                        {item.extras && item.extras.length > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Agregados ({item.extras.length}):</span>
                            <span>
                              +$
                              {item.extras
                                .reduce((total, extra) => {
                                  const extraName = extra.replace(/\s*$$\d+$$/, "")
                                  return total + getExtraPrice(extraName)
                                }, 0)
                                .toLocaleString()}
                            </span>
                          </div>
                        )}

                        <div className="flex justify-between font-medium border-t pt-2 mt-2 text-pink-600">
                          <span>Subtotal unitario:</span>
                          <span>${item.price.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Controles de cantidad */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Button
                        size="icon"
                        variant="outline"
                        className="w-8 h-8 bg-white border-gray-300 text-gray-600 hover:bg-pink-50 hover:border-pink-300 hover:text-pink-600"
                        onClick={() => updateQuantity(item.id, Math.max(0, item.quantity - 1))}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-8 text-center font-medium text-gray-800">{item.quantity}</span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="w-8 h-8 bg-white border-gray-300 text-gray-600 hover:bg-pink-50 hover:border-pink-300 hover:text-pink-600"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-gray-800">${(item.price * item.quantity).toLocaleString()}</div>
                      {item.quantity > 1 && (
                        <div className="text-xs text-gray-500">${item.price.toLocaleString()} c/u</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="p-4 border-t border-gray-200 space-y-4 bg-gray-50">
        {/* Resumen de totales */}
        <div className="space-y-2">
          <div className="flex justify-between text-gray-700">
            <span>Subtotal</span>
            <span className="font-medium">${subtotal.toLocaleString()}</span>
          </div>
          {isDelivery && deliveryCost > 0 && (
            <div className="flex justify-between text-blue-600">
              <span>Delivery</span>
              <span className="font-medium">+${deliveryCost.toLocaleString()}</span>
            </div>
          )}
          {appliedDiscount && discountAmount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Descuento ({appliedDiscount.code})</span>
              <span className="font-medium">-${discountAmount.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-lg text-gray-800 border-t pt-2">
            <span>Total</span>
            <span className="text-pink-600">${totalFinal.toLocaleString()}</span>
          </div>
        </div>

        {/* Switch para elegir entre Retirar y Delivery */}
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Store className={`w-5 h-5 ${!isDelivery ? "text-pink-600" : "text-gray-400"}`} />
              <span className={`font-medium ${!isDelivery ? "text-gray-800" : "text-gray-500"}`}>Retirar</span>
            </div>
            <Switch checked={isDelivery} onCheckedChange={setIsDelivery} />
            <div className="flex items-center space-x-2">
              <span className={`font-medium ${isDelivery ? "text-gray-800" : "text-gray-500"}`}>Delivery</span>
              <Truck className={`w-5 h-5 ${isDelivery ? "text-pink-600" : "text-gray-400"}`} />
            </div>
          </div>
        </div>

        {/* Botones condicionales */}
        {isAuthenticated ? (
          <Button
            className="w-full bg-pink-600 text-white hover:bg-pink-700 font-bold py-3 rounded-lg shadow-md hover:shadow-lg transition-all"
            onClick={handleContinue}
          >
            Continuar
          </Button>
        ) : (
          <Button
            className="w-full bg-pink-600 text-white hover:bg-pink-700 font-bold py-3 rounded-lg shadow-md hover:shadow-lg transition-all text-sm"
            onClick={handleLoginRedirect}
          >
            Inicia sesión para continuar
          </Button>
        )}
      </div>
      {/* Modal de edición */}
      {isEditModalOpen && editingItem && (
        <PizzaConfigModal
          isOpen={isEditModalOpen}
          onClose={handleEditCancel}
          pizzaType={editingItem.pizzaType}
          isEditing={true}
          currentConfig={{
            id: editingItem.id, // Agregar el ID del item original
            size: editingItem.size,
            ingredients: editingItem.ingredients || [],
            premiumIngredients: editingItem.premiumIngredients || [],
            sauces: editingItem.sauces || [],
            drinks: editingItem.drinks || [],
            extras: editingItem.extras || [],
            comments: editingItem.comments || "",
            pizza1: editingItem.pizza1, // Para pizzas DUO
            pizza2: editingItem.pizza2, // Para pizzas DUO
            pizzaType: editingItem.pizzaType, // Asegurar que se pase el tipo
          }}
        />
      )}
    </div>
  )
}

export default Cart

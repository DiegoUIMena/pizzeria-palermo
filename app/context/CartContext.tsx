"use client"

import { createContext, useContext, useEffect, useReducer, useState, type ReactNode } from "react"
import { type Order, type OrderItem } from "../../lib/orders"
import { functions } from "../../lib/firebase"
import { httpsCallable } from "firebase/functions"

interface CartItem {
  id: string
  name: string
  price: number
  image: string
  quantity: number
  // Agregar nuevos campos para detalles
  size?: string
  variant?: string
  ingredients?: string[]
  premiumIngredients?: string[]
  sauces?: string[]
  drinks?: string[]
  extras?: string[]
  basePrice?: number
  ingredientsPrice?: number
  extrasPrice?: number
  pizzaType?: "promo" | "premium" | "duo"
  pizza1?: string  // Para pizzas DUO
  pizza2?: string  // Para pizzas DUO
  selectedMenuPizza?: string | null  // Pizza base seleccionada para Premium/Promo
  comments?: string
  // Opciones de personalización
  sinOregano?: boolean
  sinQueso?: boolean
  sinSalsaTomate?: boolean
}

interface CartState {
  items: CartItem[]
}

const CART_STORAGE_KEY = "pizzeria-palermo-cart-v1"

type CartAction =
  | { type: "ADD_ITEM"; payload: CartItem }
  | { type: "UPDATE_QUANTITY"; payload: { id: string; quantity: number } }
  | { type: "UPDATE_ITEM"; payload: CartItem }
  | { type: "REMOVE_ITEM"; payload: string }
  | { type: "HYDRATE_ITEMS"; payload: CartItem[] }
  | { type: "CLEAR_CART" }

const CartContext = createContext<{
  items: CartItem[]
  addItem: (item: CartItem) => void
  updateQuantity: (id: string, quantity: number) => void
  updateItem: (item: CartItem) => void
  removeItem: (id: string) => void
  clearCart: () => void
  getTotal: () => number
  createOrder: (orderData: CreateOrderData) => Promise<{id: string, orderNumber: number, success: boolean, error?: string, validationDetails?: any, guestAccessToken?: string, guestTokenExpiresAt?: string}>
} | null>(null)

// Tipo para los datos necesarios para crear un pedido
interface CreateOrderData {
  userId?: string
  customerType?: "guest" | "registered"
  voucherId?: string
  voucherCode?: string
  voucherDiscount?: number
  cliente: {
    nombre: string
    telefono: string
    email: string
  }
  tipoEntrega: "Delivery" | "Retiro"
  direccion?: {
    calle: string
    numero: string
    comuna: string
    referencia?: string
  }
  metodoPago: "Efectivo" | "Webpay Plus" | "Transferencia"
  paymentDetails?: {
    cashAmount?: number
    change?: number
  }
  tiempoEstimado?: string
  notas?: string
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD_ITEM":
      const existingItem = state.items.find((item) => item.id === action.payload.id)
      if (existingItem) {
        return {
          ...state,
          items: state.items.map((item) =>
            item.id === action.payload.id ? { ...item, quantity: item.quantity + action.payload.quantity } : item,
          ),
        }
      }
      return {
        ...state,
        items: [...state.items, action.payload],
      }

    case "UPDATE_QUANTITY":
      if (action.payload.quantity === 0) {
        return {
          ...state,
          items: state.items.filter((item) => item.id !== action.payload.id),
        }
      }
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.payload.id ? { ...item, quantity: action.payload.quantity } : item,
        ),
      }

    case "UPDATE_ITEM":
      const itemExists = state.items.find(item => item.id === action.payload.id)
      
      if (!itemExists) {
        return {
          ...state,
          items: [...state.items, action.payload],
        }
      }
      
      const updatedItems = state.items.map((item) =>
        item.id === action.payload.id ? { ...action.payload } : item
      )
      
      return {
        ...state,
        items: updatedItems,
      }

    case "REMOVE_ITEM":
      return {
        ...state,
  items: state.items.filter((item) => item.id !== action.payload),
      }

    case "HYDRATE_ITEMS":
      return {
        ...state,
        items: action.payload,
      }

    case "CLEAR_CART":
      return { items: [] }

    default:
      return state
  }
}

function sanitizeCartItem(raw: any): CartItem | null {
  if (!raw || typeof raw !== "object") return null
  if (typeof raw.id !== "string" || typeof raw.name !== "string") return null
  if (typeof raw.price !== "number" || !Number.isFinite(raw.price)) return null

  const quantity = Number(raw.quantity)
  if (!Number.isFinite(quantity) || quantity <= 0) return null

  return {
    id: raw.id,
    name: raw.name,
    price: raw.price,
    image: typeof raw.image === "string" ? raw.image : "/placeholder.svg",
    quantity,
    size: raw.size,
    variant: raw.variant,
    ingredients: Array.isArray(raw.ingredients) ? raw.ingredients : undefined,
    premiumIngredients: Array.isArray(raw.premiumIngredients) ? raw.premiumIngredients : undefined,
    sauces: Array.isArray(raw.sauces) ? raw.sauces : undefined,
    drinks: Array.isArray(raw.drinks) ? raw.drinks : undefined,
    extras: Array.isArray(raw.extras) ? raw.extras : undefined,
    basePrice: typeof raw.basePrice === "number" ? raw.basePrice : undefined,
    ingredientsPrice: typeof raw.ingredientsPrice === "number" ? raw.ingredientsPrice : undefined,
    extrasPrice: typeof raw.extrasPrice === "number" ? raw.extrasPrice : undefined,
    pizzaType: raw.pizzaType,
    pizza1: raw.pizza1,
    pizza2: raw.pizza2,
    selectedMenuPizza: raw.selectedMenuPizza,
    comments: raw.comments,
    sinOregano: raw.sinOregano,
    sinQueso: raw.sinQueso,
    sinSalsaTomate: raw.sinSalsaTomate,
  }
}

function getInitialCartState(): CartState {
  if (typeof window === "undefined") {
    return { items: [] }
  }

  try {
    const stored = window.localStorage.getItem(CART_STORAGE_KEY)
    if (!stored) {
      return { items: [] }
    }

    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed)) {
      return { items: [] }
    }

    const items = parsed
      .map(sanitizeCartItem)
      .filter((item): item is CartItem => item !== null)

    return { items }
  } catch {
    return { items: [] }
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [] })
  const [storageHydrated, setStorageHydrated] = useState(false)

  useEffect(() => {
    const initialState = getInitialCartState()
    if (initialState.items.length > 0) {
      dispatch({ type: "HYDRATE_ITEMS", payload: initialState.items })
    }
    setStorageHydrated(true)
  }, [])

  useEffect(() => {
    if (!storageHydrated) return
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.items))
    } catch {
      // Ignorar errores de storage (modo privado, cuota, etc.)
    }
  }, [state.items, storageHydrated])

  const addItem = (item: CartItem) => {
    dispatch({ type: "ADD_ITEM", payload: item })
  }

  const updateQuantity = (id: string, quantity: number) => {
    dispatch({ type: "UPDATE_QUANTITY", payload: { id, quantity } })
  }

  const updateItem = (item: CartItem) => {
    dispatch({ type: "UPDATE_ITEM", payload: item })
  }

  const removeItem = (id: string) => {
    dispatch({ type: "REMOVE_ITEM", payload: id })
  }

  const clearCart = () => {
    dispatch({ type: "CLEAR_CART" })
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(CART_STORAGE_KEY)
      } catch {
        // Ignorar errores de storage
      }
    }
  }

  const getTotal = () => {
    return state.items.reduce((total, item) => total + item.price * item.quantity, 0)
  }

  const createOrder = async (orderData: CreateOrderData): Promise<{id: string, orderNumber: number, success: boolean, error?: string, validationDetails?: any, guestAccessToken?: string, guestTokenExpiresAt?: string}> => {
    try {
      // Convertir CartItem[] a OrderItem[]
      const orderItems: OrderItem[] = state.items.map(item => ({
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
        pizzaType: item.pizzaType,
        pizza1: item.pizza1,
        pizza2: item.pizza2,
        selectedMenuPizza: item.selectedMenuPizza, // [ADDED] Pizza base seleccionada
        // Opciones de personalización
        sinOregano: item.sinOregano,
        sinQueso: item.sinQueso,
        sinSalsaTomate: item.sinSalsaTomate
      }))

      // Llamar a la Cloud Function createOrder
      const createOrderFunction = httpsCallable(functions, 'createOrder')
      
      const payloadToSend = {
        userId: orderData.userId,
        customerType: orderData.customerType || "registered",
        cliente: orderData.cliente,
        tipoEntrega: orderData.tipoEntrega,
        direccion: orderData.direccion,
        items: orderItems,
        total: getTotal(),
        metodoPago: orderData.metodoPago,
        voucherId: orderData.voucherId,
        voucherCode: orderData.voucherCode,
        voucherDiscount: orderData.voucherDiscount,
        paymentDetails: orderData.paymentDetails,
        tiempoEstimado: orderData.tiempoEstimado,
        notas: orderData.notas
      }
      
      const functionResponse = await createOrderFunction(payloadToSend)

      const result = functionResponse.data as {id: string, orderNumber: number, success: boolean, error?: string, validationDetails?: any, details?: any, guestAccessToken?: string, guestTokenExpiresAt?: string}

      // Limpiar el carrito solo si el pedido fue exitoso
      if (result.success) {
        clearCart()
      }

      // Mapear 'details' a 'validationDetails' si existe
      return {
        ...result,
        validationDetails: result.validationDetails || result.details
      }
    } catch (error: any) {
      // Extraer el mensaje de error de Firebase Functions
      let errorMessage = 'Error desconocido al crear el pedido'
      let errorCode = ''
      let validationDetails = null
      
      if (error?.code === 'functions/unauthenticated') {
        errorMessage = 'Debes iniciar sesión para crear un pedido'
        errorCode = 'UNAUTHENTICATED'
      } else if (error?.code === 'functions/failed-precondition') {
        // Distinguir entre error de horario e inventario
        const message = error?.message || ''
        
        if (message.includes('horario comercial') || message.includes('Fuera de horario')) {
          errorMessage = message
          errorCode = 'BUSINESS_HOURS'
        } else {
          // Este es el error de inventario insuficiente
          errorMessage = message || 'No hay suficiente stock disponible'
          errorCode = 'INVENTORY_UNAVAILABLE'
          // Los detalles de validación vienen en error.details
          validationDetails = error?.details || null
        }
      } else if (error?.message) {
        errorMessage = error.message
      }
      
      return {
        id: '',
        orderNumber: 0,
        success: false,
        error: errorCode || errorMessage,
        validationDetails: validationDetails
      }
    }
  }

  return (
    <CartContext.Provider
      value={{
        items: state.items,
        addItem,
        updateQuantity,
        updateItem,
        removeItem,
        clearCart,
        getTotal,
        createOrder,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error("useCart must be used within a CartProvider")
  }
  return context
}

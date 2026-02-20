"use client"

import { createContext, useContext, useReducer, type ReactNode } from "react"
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
  comments?: string
}

interface CartState {
  items: CartItem[]
}

type CartAction =
  | { type: "ADD_ITEM"; payload: CartItem }
  | { type: "UPDATE_QUANTITY"; payload: { id: string; quantity: number } }
  | { type: "UPDATE_ITEM"; payload: CartItem }
  | { type: "REMOVE_ITEM"; payload: string }
  | { type: "CLEAR_CART" }

const CartContext = createContext<{
  items: CartItem[]
  addItem: (item: CartItem) => void
  updateQuantity: (id: string, quantity: number) => void
  updateItem: (item: CartItem) => void
  removeItem: (id: string) => void
  clearCart: () => void
  getTotal: () => number
  createOrder: (orderData: CreateOrderData) => Promise<{id: string, orderNumber: number, success: boolean, error?: string, validationDetails?: any}>
} | null>(null)

// Tipo para los datos necesarios para crear un pedido
interface CreateOrderData {
  userId: string
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
      console.log("[CART] UPDATE_ITEM action received:", action.payload)
      console.log("[CART] Current items:", state.items.map(item => ({ id: item.id, name: item.name })))
      console.log("[CART] Looking for item with ID:", action.payload.id)
      
      const itemExists = state.items.find(item => item.id === action.payload.id)
      console.log("[CART] Item exists:", itemExists ? "YES" : "NO")
      
      if (!itemExists) {
        console.log("[CART] Item not found! Adding as new item instead")
        return {
          ...state,
          items: [...state.items, action.payload],
        }
      }
      
      const updatedItems = state.items.map((item) =>
        item.id === action.payload.id ? { ...action.payload } : item
      )
      
      console.log("[CART] Updated items:", updatedItems.map(item => ({ id: item.id, name: item.name, price: item.price })))
      
      return {
        ...state,
        items: updatedItems,
      }

    case "REMOVE_ITEM":
      return {
        ...state,
  items: state.items.filter((item) => item.id !== action.payload),
      }

    case "CLEAR_CART":
      return { items: [] }

    default:
      return state
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [] })

  const addItem = (item: CartItem) => {
    dispatch({ type: "ADD_ITEM", payload: item })
  }

  const updateQuantity = (id: string, quantity: number) => {
    dispatch({ type: "UPDATE_QUANTITY", payload: { id, quantity } })
  }

  const updateItem = (item: CartItem) => {
    console.log("[CART] updateItem called with:", item)
    console.log("[CART] Current cart items before update:", state.items.map(i => ({ id: i.id, name: i.name })))
    dispatch({ type: "UPDATE_ITEM", payload: item })
  }

  const removeItem = (id: string) => {
    dispatch({ type: "REMOVE_ITEM", payload: id })
  }

  const clearCart = () => {
    dispatch({ type: "CLEAR_CART" })
  }

  const getTotal = () => {
    return state.items.reduce((total, item) => total + item.price * item.quantity, 0)
  }

  const createOrder = async (orderData: CreateOrderData): Promise<{id: string, orderNumber: number, success: boolean, error?: string, validationDetails?: any}> => {
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
        pizza2: item.pizza2
      }))

      // Llamar a la Cloud Function createOrder
      const createOrderFunction = httpsCallable(functions, 'createOrder')
      
      const functionResponse = await createOrderFunction({
        userId: orderData.userId,
        cliente: orderData.cliente,
        tipoEntrega: orderData.tipoEntrega,
        direccion: orderData.direccion,
        items: orderItems,
        total: getTotal(),
        metodoPago: orderData.metodoPago,
        paymentDetails: orderData.paymentDetails,
        tiempoEstimado: orderData.tiempoEstimado,
        notas: orderData.notas
      })

      const result = functionResponse.data as {id: string, orderNumber: number, success: boolean, error?: string, validationDetails?: any, details?: any}

      console.log('✅ Cloud Function response:', result)
      console.log('Success:', result.success)
      console.log('Error:', result.error)
      console.log('Validation details:', result.validationDetails || result.details)

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
      console.error('❌ Error creating order:', error)
      console.log('Error code:', error?.code)
      console.log('Error message:', error?.message)
      console.log('Error details:', error?.details)
      
      // Extraer el mensaje de error de Firebase Functions
      let errorMessage = 'Error desconocido al crear el pedido'
      let errorCode = ''
      let validationDetails = null
      
      if (error?.code === 'functions/unauthenticated') {
        console.log('🔒 Error de autenticación detectado')
        errorMessage = 'Debes iniciar sesión para crear un pedido'
        errorCode = 'UNAUTHENTICATED'
      } else if (error?.code === 'functions/failed-precondition') {
        console.log('📦 Error de inventario detectado')
        // Este es el error de inventario insuficiente
        errorMessage = error?.message || 'No hay suficiente stock disponible'
        errorCode = 'INVENTORY_UNAVAILABLE'
        // Los detalles de validación vienen en error.details
        validationDetails = error?.details || null
        console.log('Detalles de validación de inventario:', validationDetails)
      } else if (error?.message) {
        console.log('⚠️ Error genérico:', error.message)
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

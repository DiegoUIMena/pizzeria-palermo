"use client"

import { createContext, useContext, useReducer, type ReactNode } from "react"
import { createOrder as createOrderInFirestore, type Order, type OrderItem } from "../../lib/orders"

interface CartItem {
  id: number
  name: string
  price: number
  image: string
  quantity: number
  // Agregar nuevos campos para detalles
  size?: string
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
  | { type: "UPDATE_QUANTITY"; payload: { id: number; quantity: number } }
  | { type: "UPDATE_ITEM"; payload: CartItem }
  | { type: "REMOVE_ITEM"; payload: number }
  | { type: "CLEAR_CART" }

const CartContext = createContext<{
  items: CartItem[]
  addItem: (item: CartItem) => void
  updateQuantity: (id: number, quantity: number) => void
  updateItem: (item: CartItem) => void
  removeItem: (id: number) => void
  clearCart: () => void
  getTotal: () => number
  createOrder: (orderData: CreateOrderData) => Promise<{id: string, orderNumber: number}>
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

  const updateQuantity = (id: number, quantity: number) => {
    dispatch({ type: "UPDATE_QUANTITY", payload: { id, quantity } })
  }

  const updateItem = (item: CartItem) => {
    console.log("[CART] updateItem called with:", item)
    console.log("[CART] Current cart items before update:", state.items.map(i => ({ id: i.id, name: i.name })))
    dispatch({ type: "UPDATE_ITEM", payload: item })
  }

  const removeItem = (id: number) => {
    dispatch({ type: "REMOVE_ITEM", payload: id })
  }

  const clearCart = () => {
    dispatch({ type: "CLEAR_CART" })
  }

  const getTotal = () => {
    return state.items.reduce((total, item) => total + item.price * item.quantity, 0)
  }

  const createOrder = async (orderData: CreateOrderData): Promise<{id: string, orderNumber: number}> => {
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
        pizzaType: item.pizzaType
      }))

      // Crear el pedido en Firestore
      const result = await createOrderInFirestore({
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

      // Limpiar el carrito después de crear el pedido exitosamente
      clearCart()

      return result
    } catch (error) {
      console.error('Error creating order:', error)
      throw error
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

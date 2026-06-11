// Tipos compartidos para pedidos

export interface OrderItem {
  name: string
  quantity: number
  price: number
  size?: string
  ingredients?: string[]
  premiumIngredients?: string[]
  sauces?: string[]
  drinks?: string[]
  extras?: string[]
  comments?: string
  pizzaType?: string
  pizza1?: string
  pizza2?: string
  half1?: {
    baseType: "menu" | "custom"
    variety: string | null
    simpleIngredients: string[]
    premiumIngredients: string[]
  }
  half2?: {
    baseType: "menu" | "custom"
    variety: string | null
    simpleIngredients: string[]
    premiumIngredients: string[]
  }
  selectedMenuPizza?: string | null
  sinOregano?: boolean
  sinQueso?: boolean
  sinSalsaTomate?: boolean
}

export interface FormattedOrder {
  id: string
  documentId?: string
  date: string
  status: "Pendiente" | "En preparación" | "En camino" | "Pedido Listo" | "Entregado" | "Cancelado" | "Pago Pendiente" | "Pago Rechazado"
  items: OrderItem[]
  total: number
  estimatedTime?: string
  hasEstimatedTime: boolean
  deliveryType: "Delivery" | "Retiro"
  deliveryAddress?: {
    calle: string
    numero: string
    comuna: string
    referencia?: string
  }
  paymentMethod?: string
  paymentStatus?: "pending" | "paid" | "refunded" | "failed" | null
  notes?: string
  refundInfo?: {
    refundedAt: string
    refundType: string
    amount: number
  }
}

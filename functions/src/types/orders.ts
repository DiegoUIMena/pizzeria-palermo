/**
 * Tipos compartidos para Pedidos
 * Estos tipos deben coincidir con los del frontend
 */

export interface OrderItem {
  nombre: string;
  cantidad: number;
  precio: number;
  size?: string;
  ingredients?: string[];
  premiumIngredients?: string[];
  sauces?: string[];
  drinks?: string[];
  extras?: string[];
  comments?: string;
  pizzaType?: string;
}

export interface OrderAddress {
  calle: string;
  numero: string;
  comuna: string;
  referencia?: string;
  lat?: number;
  lng?: number;
}

export interface ClientInfo {
  nombre: string;
  telefono: string;
  email: string;
}

export interface CreateOrderData {
  userId: string;
  cliente: ClientInfo;
  tipoEntrega: "Delivery" | "Retiro";
  direccion?: OrderAddress;
  items: OrderItem[];
  metodoPago: "Efectivo" | "Webpay Plus" | "Transferencia";
  paymentDetails?: {
    cashAmount?: number;
    change?: number;
  };
  notas?: string;
}

export interface Order extends CreateOrderData {
  id?: string;
  orderNumber: number;
  total: number;
  estado: "Pendiente" | "En preparación" | "En camino" | "Pedido Listo" | "Entregado" | "Cancelado";
  fechaCreacion: string;
  timestamps: {
    created: string;
    confirmed?: string;
    preparing?: string;
    ready?: string;
    delivered?: string;
  };
  tiempoEstimado?: string;
  tiempoEstimadoMinutos?: number;
  inventoryProcessed?: boolean;
  inventoryStatus?: "pending" | "processed" | "failed" | "reverted" | "cancelled_before_processing";
}

export interface ValidationResult {
  success: boolean;
  error?: string;
  details?: any;
}

export interface PriceCalculationResult {
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  breakdown: {
    itemsBreakdown: Array<{
      nombre: string;
      cantidad: number;
      precioUnitario: number;
      subtotal: number;
    }>;
  };
}

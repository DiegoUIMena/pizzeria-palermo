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
  pizza1?: string;  // Para pizzas DUO
  pizza2?: string;  // Para pizzas DUO
  half1?: {
    baseType: 'menu' | 'custom';
    variety: string | null;
    simpleIngredients: string[];
    premiumIngredients: string[];
  };
  half2?: {
    baseType: 'menu' | 'custom';
    variety: string | null;
    simpleIngredients: string[];
    premiumIngredients: string[];
  };
  selectedMenuPizza?: string | null;  // Pizza base seleccionada para Premium/Promo
  isCanje?: boolean;
  canjePoints?: number;
}

export interface OrderAddress {
  calle: string;
  numero: string;
  comuna: string;
  referencia?: string;
  lat?: number;
  lng?: number;
}

export type PaymentProviderType = 'webpay' | 'khipu';

export type PaymentStatus = 
  | 'pending'      // Pago creado, esperando acción del cliente
  | 'processing'   // Pago en proceso en la pasarela externa
  | 'paid'         // Pago confirmado y validado con éxito
  | 'failed'       // Pago fallido o rechazado
  | 'expired'      // Pago expirado por límite de tiempo
  | 'cancelled'    // Pago abortado por el usuario
  | 'refunded';    // Transacción devuelta (soporte futuro de devoluciones)

export interface PaymentDetails {
  provider: PaymentProviderType;
  providerPaymentId: string;       // ID entregado por la pasarela (ej. token de Webpay, paymentId de Khipu)
  paymentReference: string;        // Identificador interno propio del sistema (UUID/Correlativo)
  providerStatus: string;          // Estado nativo retornado por el proveedor
  updatedAt: string;               // Timestamp en formato ISO
  paymentExpiresAt?: string;       // Timestamp en formato ISO para la expiración del pago (opcional)
  providerMetadata?: Record<string, string | number | boolean>; // Datos mínimos estructurados
}

export interface ClientInfo {
  nombre: string;
  telefono: string;
  email: string;
}

export interface CreateOrderData {
  userId?: string;
  customerType?: "guest" | "registered";
  cliente: ClientInfo;
  tipoEntrega: "Delivery" | "Retiro";
  direccion?: OrderAddress;
  items: OrderItem[];
  metodoPago: "Efectivo" | "Webpay Plus" | "Transferencia";
  isKhipu?: boolean;
  paymentDetails?: {
    cashAmount?: number;
    change?: number;
  };
  notas?: string;
  discountCode?: string;
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
    paid?: string;
  };
  tiempoEstimado?: string;
  tiempoEstimadoMinutos?: number;
  inventoryProcessed?: boolean;
  inventoryStatus?: "pending" | "processed" | "failed" | "reverted" | "cancelled_before_processing";
  guestCheckout?: {
    webpayTokenHash?: string;
    webpayTokenExpiresAt?: string;
    webpayInitAttempts?: number;
    webpayTokenCreatedAt?: string;
    lastFailedAttemptAt?: string;
    lastSuccessfulInitAt?: string;
  };
  paymentStatus?: PaymentStatus;
  paymentDetailsData?: PaymentDetails; // Renombrado para evitar conflicto de nombres con el paymentDetails heredado
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

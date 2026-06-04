import { 
  collection, 
  addDoc, 
  getDocs,
  getDoc, 
  doc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  startAfter,
  onSnapshot,
  Timestamp 
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from './firebase'
import { validateInventoryForOrder, consumeInventoryForOrder } from './inventory-service'
import { revertInventoryConsumption } from './inventory-reversal'

// Tipos para los pedidos
export interface OrderItem {
  nombre: string
  cantidad: number
  precio: number
  size?: string
  ingredients?: string[]
  premiumIngredients?: string[]
  sauces?: string[]
  drinks?: string[]
  extras?: string[]
  comments?: string
  pizzaType?: string
  pizza1?: string  // Para pizzas DUO
  pizza2?: string  // Para pizzas DUO
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
  selectedMenuPizza?: string | null  // Pizza base seleccionada para Premium/Promo
  // Opciones de personalización
  sinOregano?: boolean
  sinQueso?: boolean
  sinSalsaTomate?: boolean
}

export interface Order {
  id?: string
  orderNumber: number
  
  // Usuario
  userId: string
  cliente: {
    nombre: string
    telefono: string
    email: string
  }
  
  // Entrega
  tipoEntrega: "Delivery" | "Retiro"
  direccion?: {
    calle: string
    numero: string
    comuna: string
    referencia?: string
    lat?: number
    lng?: number
  }
  
  // Productos
  items: OrderItem[]
  
  // Totales
  total: number
  
  // Pago
  metodoPago: "Efectivo" | "Webpay Plus" | "Transferencia"
  paymentDetails?: {
    cashAmount?: number
    change?: number
  }
  paymentStatus?: "pending" | "paid" | "failed"
  
  // Webpay Plus (solo cuando se usa este método de pago)
  webpay?: {
    token?: string
    status?: "pending" | "approved" | "rejected"
    responseCode?: number
    authorizationCode?: string
    amount?: number
    cardDetail?: {
      card_number?: string
    }
    transactionDate?: string
    createdAt?: string
    confirmedAt?: string
  }
  
  // Estados
  estado: "Pago Pendiente" | "Pago Rechazado" | "Pendiente" | "En preparación" | "En camino" | "Pedido Listo" | "Entregado" | "Cancelado"
  
  // Timestamps
  fechaCreacion: string
  timestamps: {
    created: string
    confirmed?: string
    preparing?: string
    ready?: string
    delivered?: string
    paid?: string
  }
  
  // Tiempo
  tiempoEstimado?: string
  tiempoEstimadoMinutos?: number
  tiempoEstimadoInicio?: string
  tiempoEstimadoFin?: string
  
  // Notas
  notas?: string
  
  // Control de inventario
  inventoryProcessed?: boolean
  inventorySuccess?: boolean
  inventoryIssue?: boolean
  inventoryError?: string
  inventoryStatus?: 'pending' | 'processed' | 'failed' | 'reverted' | 'cancelled_before_processing'
  inventoryCancellationNote?: string
  inventoryReverted?: boolean
  inventoryReversionSuccess?: boolean
  inventoryReversionIssue?: boolean
  inventoryReversionError?: string
}

// Función para generar número de pedido único
const generateOrderNumber = (): number => {
  return Math.floor(10000 + Math.random() * 90000)
}

// Función para crear un nuevo pedido
export const createOrder = async (orderData: Omit<Order, 'id' | 'orderNumber' | 'fechaCreacion' | 'timestamps' | 'estado'>): Promise<{id: string, orderNumber: number, success: boolean, error?: string, validationDetails?: any}> => {
  try {
    // Validar disponibilidad de inventario
    const validation = await validateInventoryForOrder(orderData.items)
    if (!validation.success) {
      return {
        id: '',
        orderNumber: 0,
        success: false,
        error: 'INVENTORY_UNAVAILABLE',
        validationDetails: validation.insufficientItems
      }
    }

    const now = new Date()
    const orderNumber = generateOrderNumber()
    
    // Asegurarse de que los datos del cliente tengan el formato correcto
    let clienteData = orderData.cliente;
    
    // Si no hay datos de cliente, crear un objeto con valores por defecto
    if (!clienteData) {
      clienteData = { 
        nombre: 'Usuario Anónimo', 
        telefono: 'No disponible', 
        email: '' 
      };
    } 
    // Si el cliente es un string, asumimos que es el nombre
    else if (typeof clienteData === 'string') {
      clienteData = { 
        nombre: clienteData || 'Usuario Anónimo', 
        telefono: 'No disponible', 
        email: '' 
      };
    } 
    // Si es un objeto, asegurarse de que tenga las propiedades correctas
    else if (typeof clienteData === 'object') {
      // Asegurarse de que las propiedades tengan los nombres correctos
      const tempCliente: any = { ...clienteData };
      
      // Normalizar nombre
      if (!tempCliente.nombre && (tempCliente.name || tempCliente.fullName || tempCliente.nombreCompleto)) {
        tempCliente.nombre = tempCliente.name || tempCliente.fullName || tempCliente.nombreCompleto;
      }
      
      // Normalizar teléfono
      if (!tempCliente.telefono && (tempCliente.phone || tempCliente.tel || tempCliente.celular || tempCliente.mobile)) {
        tempCliente.telefono = tempCliente.phone || tempCliente.tel || tempCliente.celular || tempCliente.mobile;
      }
      
      // Normalizar email
      if (!tempCliente.email && (tempCliente.correo || tempCliente.mail)) {
        tempCliente.email = tempCliente.correo || tempCliente.mail;
      }
      
      // Asignar valores normalizados
      clienteData = {
        nombre: tempCliente.nombre || 'Usuario Anónimo',
        telefono: tempCliente.telefono || 'No disponible',
        email: tempCliente.email || ''
      };
    }
    
    const newOrder: any = {
      ...orderData,
      cliente: clienteData, // Usar los datos normalizados
      orderNumber,
      estado: "Pendiente",
      fechaCreacion: now.toLocaleString('es-CL', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }),
      timestamps: {
        created: now.toISOString(),
      }
    }
    
    // Función recursiva para remover campos undefined
    const cleanUndefinedFields = (obj: any): any => {
      if (obj === null || obj === undefined) {
        return null
      }
      
      if (Array.isArray(obj)) {
        return obj.map(item => cleanUndefinedFields(item)).filter(item => item !== null && item !== undefined)
      }
      
      if (typeof obj === 'object') {
        const cleaned: any = {}
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            const value = cleanUndefinedFields(obj[key])
            if (value !== null && value !== undefined) {
              cleaned[key] = value
            }
          }
        }
        return cleaned
      }
      
      return obj
    }
    
    // Limpiar campos undefined de manera recursiva
    const cleanedOrder = cleanUndefinedFields(newOrder)
    
    console.log('Pedido a crear:', cleanedOrder)
    console.log('Datos del cliente:', cleanedOrder.cliente)
    
    console.log('Creando pedido sin procesar inventario automáticamente...')
    const docRef = await addDoc(collection(db, 'orders'), cleanedOrder)
    console.log('Pedido creado con ID:', docRef.id)
    
    // Ya no consumimos inventario automáticamente al crear el pedido
    // Solo marcamos el pedido como pendiente de procesar inventario
    await updateDoc(docRef, {
      inventoryProcessed: false,
      inventoryStatus: 'pending' // Estado explícito para facilitar seguimiento
    })
    console.log('Pedido creado con ID', docRef.id, 'sin consumir inventario. Se procesará cuando el administrador confirme el pedido.')
    
    return {
      id: docRef.id, 
      orderNumber,
      success: true
    }
  } catch (error) {
    console.error('Error al crear pedido:', error)
    return {
      id: '',
      orderNumber: 0,
      success: false,
      error: 'UNEXPECTED_ERROR',
      validationDetails: error instanceof Error ? error.message : String(error)
    }
  }
}

// Función para obtener pedidos de un usuario
export const getUserOrders = async (userId: string): Promise<Order[]> => {
  try {
    const q = query(
      collection(db, 'orders'),
      where('userId', '==', userId),
      orderBy('timestamps.created', 'desc')
    )
    
    const querySnapshot = await getDocs(q)
    const orders: Order[] = []
    
    querySnapshot.forEach((doc) => {
      orders.push({
        id: doc.id,
        ...doc.data()
      } as Order)
    })
    
    return orders
  } catch (error) {
    console.error('Error al obtener pedidos del usuario:', error)
    throw error
  }
}

// Función para obtener todos los pedidos (Admin) - SIN PAGINACIÓN (Legacy)
export const getAllOrders = async (): Promise<Order[]> => {
  try {
    const q = query(
      collection(db, 'orders'),
      orderBy('timestamps.created', 'desc')
    )
    
    const querySnapshot = await getDocs(q)
    const orders: Order[] = []
    
    querySnapshot.forEach((doc) => {
      const orderData = {
        id: doc.id,
        ...doc.data()
      } as Order
      
      // Filtrar pedidos que están en "Pago Pendiente" (esperando confirmación de Webpay)
      if (orderData.estado !== "Pago Pendiente") {
        orders.push(orderData)
      }
    })
    
    return orders
  } catch (error) {
    console.error('Error al obtener pedidos:', error)
    throw error
  }
}

// ✅ OPTIMIZACIÓN: Función para obtener pedidos con paginación
export interface GetOrdersOptions {
  limitCount?: number // Límite de pedidos por página (default: 50)
  estados?: Array<Order['estado']> // Filtrar por estados específicos
  lastVisible?: any // Cursor para paginación (último documento de la página anterior)
}

export const getOrdersPaginated = async (options: GetOrdersOptions = {}): Promise<{
  orders: Order[]
  lastVisible: any
  hasMore: boolean
}> => {
  try {
    const {
      limitCount = 50,
      estados,
      lastVisible
    } = options

    // Construir query base
    let q = query(
      collection(db, 'orders'),
      orderBy('timestamps.created', 'desc')
    )

    // Agregar filtro de estados si se especifica
    if (estados && estados.length > 0) {
      // Excluir "Pago Pendiente" siempre
      const estadosFiltrados = estados.filter(e => e !== "Pago Pendiente")
      if (estadosFiltrados.length > 0) {
        q = query(q, where('estado', 'in', estadosFiltrados))
      }
    } else {
      // Por defecto, excluir "Pago Pendiente"
      // Nota: Firestore no soporta != con orderBy, usamos filtro en cliente
    }

    // Agregar cursor de paginación si existe
    q = lastVisible
      ? query(q, startAfter(lastVisible), limit(limitCount + 1)) // +1 para saber si hay más
      : query(q, limit(limitCount + 1))

    const querySnapshot = await getDocs(q)
    const orders: Order[] = []
    let newLastVisible = null
    let index = 0

    querySnapshot.forEach((doc) => {
      // Saltar el último si llegamos al límite (es solo para saber si hay más)
      if (index < limitCount) {
        const orderData = {
          id: doc.id,
          ...doc.data()
        } as Order

        // Filtrar "Pago Pendiente" en el cliente
        if (orderData.estado !== "Pago Pendiente") {
          orders.push(orderData)
          newLastVisible = doc // Guardar último documento
        }
      }
      index++
    })

    // Verificar si hay más resultados
    const hasMore = querySnapshot.size > limitCount

    return {
      orders,
      lastVisible: newLastVisible,
      hasMore
    }
  } catch (error) {
    console.error('Error al obtener pedidos paginados:', error)
    throw error
  }
}

// Función para actualizar el estado de un pedido
/**
 * Actualiza el estado de un pedido y procesa el inventario según corresponda.
 * 
 * REGLAS IMPORTANTES SOBRE EL INVENTARIO:
 * - El inventario se consume SOLO cuando el pedido pasa de "Pendiente" a "En preparación"
 * - Si un pedido se cancela DESPUÉS de estar en preparación, NO se revierte el consumo de inventario
 *   ya que los insumos ya fueron utilizados para preparar la comida
 * - Si un pedido se cancela ANTES de estar en preparación, no hay cambios en el inventario
 * 
 * Ver más detalles en inventory-policy.md
 */
export const updateOrderStatus = async (orderId: string, newStatus: Order['estado']): Promise<void> => {
  try {
    // Llamar a la Cloud Function updateOrderStatus
    const updateOrderStatusFunction = httpsCallable(functions, 'updateOrderStatus')
    
    // Determinar si se debe consumir inventario basado en el nuevo estado
    const consumeInventory = newStatus === "En preparación"
    
    const result = await updateOrderStatusFunction({
      orderId,
      newStatus,
      consumeInventory
    })
    
    const response = result.data as { success: boolean; error?: string }
    
    if (!response.success) {
      throw new Error(response.error || 'Error al actualizar estado del pedido')
    }
    
    console.log('Estado del pedido actualizado mediante Cloud Function:', orderId, newStatus)
  } catch (error: any) {
    console.error('Error al actualizar estado del pedido:', error)
    
    // Extraer mensaje de error de Firebase Functions
    if (error?.code === 'functions/unauthenticated') {
      throw new Error('Debes iniciar sesión para actualizar el estado del pedido')
    } else if (error?.code === 'functions/permission-denied') {
      throw new Error('No tienes permisos para actualizar el estado del pedido')
    } else if (error?.message) {
      throw new Error(error.message)
    } else {
      throw new Error('Error desconocido al actualizar el estado del pedido')
    }
  }
}

// Función para escuchar cambios en pedidos de un usuario en tiempo real
export const listenToUserOrders = (userId: string, callback: (orders: Order[]) => void): () => void => {
  const q = query(
    collection(db, 'orders'),
    where('userId', '==', userId),
    orderBy('timestamps.created', 'desc')
  )
  
  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const orders: Order[] = []
    querySnapshot.forEach((doc) => {
      orders.push({
        id: doc.id,
        ...doc.data()
      } as Order)
    })
    callback(orders)
  })
  
  return unsubscribe
}

// Función para escuchar cambios en todos los pedidos en tiempo real (Admin)
export const listenToAllOrders = (callback: (orders: Order[]) => void): () => void => {
  return subscribeToSharedAllOrders(callback)
}

// ✅ OPTIMIZACIÓN: Listener con límite para pedidos recientes
export const listenToRecentOrders = (
  callback: (orders: Order[]) => void,
  limitCount: number = 100,
  estadoFiltro?: string // Nuevo parámetro para filtrar por estado
): () => void => {
  // Cargar últimos pedidos ordenados por fecha
  // Filtrado se hace en cliente para evitar error de índice compuesto
  const q = query(
    collection(db, 'orders'),
    orderBy('timestamps.created', 'desc'),
    limit(limitCount)
  )
  
  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const orders: Order[] = []
    const ahora = new Date()
    // Para Entregados/Cancelados: mostrar últimos 7 días
    const hace7Dias = new Date(ahora.getTime() - (7 * 24 * 60 * 60 * 1000))
    
    querySnapshot.forEach((doc) => {
      const orderData = {
        id: doc.id,
        ...doc.data()
      } as Order
      
      // Si filtro es "todos", mostrar TODOS los pedidos
      if (estadoFiltro === 'todos') {
        orders.push(orderData)
      }
      // Si no hay filtro o filtro es "activos", mostrar solo activos
      else if (!estadoFiltro || estadoFiltro === 'activos') {
        const estadosActivos = ['Pendiente', 'En preparación', 'En camino', 'Pedido Listo']
        if (estadosActivos.includes(orderData.estado)) {
          orders.push(orderData)
        }
      }
      // Si el filtro es Entregado o Cancelado, mostrar últimos 7 días
      else if (estadoFiltro === 'Entregado' || estadoFiltro === 'Cancelado') {
        if (orderData.estado === estadoFiltro) {
          // Intentar obtener la fecha del pedido de múltiples fuentes
          let fechaPedido: Date | null = null
          
          if (orderData.timestamps?.created) {
            const createdTimestamp = orderData.timestamps.created as any

            // Si es un string ISO (formato '2026-01-22T03:44:25.954Z')
            if (typeof createdTimestamp === 'string') {
              fechaPedido = new Date(createdTimestamp)
            }
            // Si es un Timestamp de Firestore con método toDate()
            else if (typeof createdTimestamp.toDate === 'function') {
              fechaPedido = createdTimestamp.toDate()
            } 
            // Si ya es un objeto Date
            else if (createdTimestamp instanceof Date) {
              fechaPedido = createdTimestamp
            }
          }
          
          // Fallback a fechaCreacion si existe
          if (!fechaPedido && orderData.fechaCreacion) {
            fechaPedido = new Date(orderData.fechaCreacion)
          }
          
          // Si tenemos fecha válida y es de los últimos 7 días, incluir
          if (fechaPedido && !isNaN(fechaPedido.getTime()) && fechaPedido >= hace7Dias) {
            orders.push(orderData)
          } else if (!fechaPedido || isNaN(fechaPedido.getTime())) {
            // Si no hay fecha válida, incluir de todas formas (es reciente si está en los últimos 100)
            orders.push(orderData)
          }
        }
      }
      // Para otros filtros específicos (Pendiente, En preparación, etc.)
      else {
        if (orderData.estado === estadoFiltro) {
          orders.push(orderData)
        }
      }
    })
    callback(orders)
  }, (error) => {
    console.error('Error en listener de pedidos recientes:', error)
  })
  
  return unsubscribe
}

// Función para obtener un pedido específico
export const getOrderById = async (orderId: string): Promise<Order | null> => {
  try {
    const orderRef = doc(db, 'orders', orderId)
    const orderDoc = await getDoc(orderRef)

    if (orderDoc.exists()) {
      return {
        id: orderDoc.id,
        ...orderDoc.data()
      } as Order
    }
    
    return null
  } catch (error) {
    console.error('Error al obtener pedido por ID:', error)
    throw error
  }
}

let sharedAllOrdersSnapshot: Order[] | null = null
let sharedAllOrdersUnsubscribe: (() => void) | null = null
const sharedAllOrdersSubscribers = new Set<(orders: Order[]) => void>()

function mapOrdersSnapshotToArray(querySnapshot: any): Order[] {
  const orders: Order[] = []
  querySnapshot.forEach((docSnap: any) => {
    orders.push({
      id: docSnap.id,
      ...docSnap.data()
    } as Order)
  })
  return orders
}

function subscribeToSharedAllOrders(callback: (orders: Order[]) => void): () => void {
  sharedAllOrdersSubscribers.add(callback)

  if (sharedAllOrdersSnapshot) {
    callback(sharedAllOrdersSnapshot)
  }

  if (!sharedAllOrdersUnsubscribe) {
    const sharedQuery = query(
      collection(db, 'orders'),
      orderBy('timestamps.created', 'desc')
    )

    sharedAllOrdersUnsubscribe = onSnapshot(sharedQuery, (querySnapshot) => {
      const orders = mapOrdersSnapshotToArray(querySnapshot)
      sharedAllOrdersSnapshot = orders

      sharedAllOrdersSubscribers.forEach((subscriber) => {
        try {
          subscriber(orders)
        } catch (error) {
          console.error('Error en callback de listenToAllOrders compartido:', error)
        }
      })
    }, (error) => {
      console.error('Error en listener compartido de pedidos:', error)
    })
  }

  return () => {
    sharedAllOrdersSubscribers.delete(callback)

    if (sharedAllOrdersSubscribers.size === 0 && sharedAllOrdersUnsubscribe) {
      sharedAllOrdersUnsubscribe()
      sharedAllOrdersUnsubscribe = null
      sharedAllOrdersSnapshot = null
    }
  }
}

// Función para obtener pedidos activos (para dashboard)
export const getActiveOrders = async (): Promise<Order[]> => {
  try {
    const q = query(
      collection(db, 'orders'),
      where('estado', 'in', ['Pendiente', 'En preparación', 'En camino', 'Pedido Listo']),
      orderBy('timestamps.created', 'desc')
    )
    
    const querySnapshot = await getDocs(q)
    const orders: Order[] = []
    
    querySnapshot.forEach((doc) => {
      orders.push({
        id: doc.id,
        ...doc.data()
      } as Order)
    })
    
    return orders
  } catch (error) {
    console.error('Error al obtener pedidos activos:', error)
    throw error
  }
}

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
  onSnapshot,
  Timestamp 
} from 'firebase/firestore'
import { db } from './firebase'
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
  
  // Estados
  estado: "Pendiente" | "En preparación" | "En camino" | "Pedido Listo" | "Entregado" | "Cancelado"
  
  // Timestamps
  fechaCreacion: string
  timestamps: {
    created: string
    confirmed?: string
    preparing?: string
    ready?: string
    delivered?: string
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

// Función para obtener todos los pedidos (Admin)
export const getAllOrders = async (): Promise<Order[]> => {
  try {
    const q = query(
      collection(db, 'orders'),
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
    console.error('Error al obtener todos los pedidos:', error)
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
    const orderRef = doc(db, 'orders', orderId)
    const now = new Date()
    
    // Primero obtenemos el pedido para verificar si ya se procesó el inventario
    // Usar getDoc directamente con el documento de referencia es más eficiente
    const orderDoc = await getDoc(orderRef)
    
    if (!orderDoc.exists()) {
      throw new Error('Pedido no encontrado');
    }
    
    const orderData = orderDoc.data() as Order;
    // Usar una verificación explícita porque inventoryProcessed podría ser undefined
    const inventoryProcessed = Boolean(orderData.inventoryProcessed);
    const previousStatus = orderData.estado;
    
    const updateData: any = {
      estado: newStatus
    }
    
    // Agregar timestamp específico según el estado
    switch (newStatus) {
      case "En preparación":
        updateData['timestamps.preparing'] = now.toISOString()
        
        // Si cambiamos a "En preparación", consumimos el inventario
        // Solo si no se ha procesado antes y estamos cambiando desde "Pendiente"
        if (!inventoryProcessed && previousStatus === "Pendiente") {
          console.log('Procesando inventario para pedido confirmado:', orderId);
          try {
            const inventoryResult = await consumeInventoryForOrder(
              orderData.items,
              orderId,
              orderData.orderNumber
            );
            
            // Marcar como procesado y actualizar resultado
            updateData.inventoryProcessed = true;
            updateData.inventorySuccess = inventoryResult.success;
            updateData.inventoryStatus = inventoryResult.success ? 'processed' : 'failed';
            
            if (!inventoryResult.success) {
              console.error('Error consumiendo inventario:', inventoryResult.error);
              updateData.inventoryIssue = true;
              updateData.inventoryError = inventoryResult.error;
            } else {
              console.log('Inventario procesado correctamente para el pedido:', orderId);
            }
          } catch (inventoryError) {
            console.error('Error procesando inventario:', inventoryError);
            updateData.inventoryIssue = true;
            updateData.inventoryError = inventoryError instanceof Error ? 
              inventoryError.message : 'Error desconocido procesando inventario';
          }
        } else if (inventoryProcessed) {
          console.log('El inventario ya fue procesado previamente para el pedido:', orderId);
        } else {
          console.log('El pedido no estaba en estado "Pendiente", no se procesa inventario:', orderId, 'Estado previo:', previousStatus);
        }
        break
      case "Pedido Listo":
        updateData['timestamps.ready'] = now.toISOString()
        break
      case "En camino":
        updateData['timestamps.ready'] = now.toISOString()
        break
      case "Entregado":
        updateData['timestamps.delivered'] = now.toISOString()
        // Para pedidos entregados, eliminar la información de tiempo restante
        updateData['tiempoRestante'] = null
        break
      case "Cancelado":
        // Para pedidos cancelados, eliminar la información de tiempo restante
        updateData['tiempoRestante'] = null
        
        // IMPORTANTE: Si el pedido se cancela ANTES de ser confirmado ("En preparación"),
        // no hay nada que revertir porque el inventario nunca se consumió.
        // Si el pedido se cancela DESPUÉS de ser confirmado, NO debemos revertir el inventario,
        // porque los insumos ya fueron utilizados para preparar la pizza.
        
        // Verificamos si el pedido está en estado "Pendiente"
        if (previousStatus === "Pendiente") {
          // Si está en Pendiente y se cancela, marcamos explícitamente que no se procesó inventario
          console.log('Cancelando pedido pendiente. No se realizó consumo de inventario:', orderId);
          updateData.inventoryProcessed = false;
          updateData.inventoryStatus = 'cancelled_before_processing';
        } else {
          // Si el pedido ya estaba en preparación o más allá, ya se consumió el inventario
          // y NO debemos revertirlo porque los insumos ya se utilizaron
          console.log('Cancelando pedido que ya estaba en preparación o entrega. Inventario YA CONSUMIDO se mantiene:', orderId);
          updateData.inventoryCancellationNote = 'Pedido cancelado después de preparación, inventario no se revierte';
        }
        break
    }
    
    await updateDoc(orderRef, updateData)
    console.log('Estado del pedido actualizado:', orderId, newStatus)
  } catch (error) {
    console.error('Error al actualizar estado del pedido:', error)
    throw error
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
  const q = query(
    collection(db, 'orders'),
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

// Función para obtener un pedido específico
export const getOrderById = async (orderId: string): Promise<Order | null> => {
  try {
    const orderDoc = await getDocs(query(collection(db, 'orders'), where('__name__', '==', orderId)))
    
    if (!orderDoc.empty) {
      const doc = orderDoc.docs[0]
      return {
        id: doc.id,
        ...doc.data()
      } as Order
    }
    
    return null
  } catch (error) {
    console.error('Error al obtener pedido por ID:', error)
    throw error
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

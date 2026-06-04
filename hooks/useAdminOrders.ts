import { useState, useEffect, useCallback } from 'react'
import { Order, getAllOrders, updateOrderStatus, listenToRecentOrders } from '../lib/orders'

function formatOrderCreatedAt(order: Order): string {
  const createdRaw: any = (order as any)?.timestamps?.created

  let createdDate: Date | null = null

  if (typeof createdRaw === 'string') {
    const parsed = new Date(createdRaw)
    if (!isNaN(parsed.getTime())) {
      createdDate = parsed
    }
  } else if (createdRaw && typeof createdRaw?.toDate === 'function') {
    try {
      createdDate = createdRaw.toDate()
    } catch {
      createdDate = null
    }
  } else if (createdRaw instanceof Date) {
    createdDate = createdRaw
  }

  // Priorizar timestamp UTC real y renderizar en zona horaria local de Chile.
  if (createdDate) {
    return createdDate.toLocaleString('es-CL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/Santiago',
    })
  }

  // Fallback legacy: mantener lo almacenado si no hay timestamp válido.
  return order.fechaCreacion || ''
}

// Hook para obtener todos los pedidos (Admin) - OPTIMIZADO
export const useAdminOrders = (estadoFiltro?: string) => {
  const [pedidos, setPedidos] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Función para cargar pedidos iniciales (solo para refetch manual)
  const loadOrders = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const allOrders = await getAllOrders()
      // Filtrar solo activos
      const estadosActivos = ['Pendiente', 'En preparación', 'En camino', 'Pedido Listo']
      const activosOrders = allOrders.filter(order => estadosActivos.includes(order.estado))
      setPedidos(activosOrders)
    } catch (err) {
      setError('Error al cargar pedidos')
      console.error('Error loading admin orders:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // ✅ OPTIMIZACIÓN: Escuchar pedidos con filtro dinámico en tiempo real
  useEffect(() => {
    setIsLoading(true)
    const unsubscribe = listenToRecentOrders((updatedOrders) => {
      setPedidos(updatedOrders)
      setIsLoading(false)
    }, 100, estadoFiltro) // Pasar filtro de estado al listener

    return () => unsubscribe()
  }, [estadoFiltro]) // Re-ejecutar cuando cambie el filtro

  // Función para actualizar estado de un pedido con Optimistic Update
  const actualizarEstado = async (pedidoId: string, nuevoEstado: Order['estado']) => {
    try {
      // 🚀 OPTIMISTIC UPDATE: Actualizar UI inmediatamente
      setPedidos(prevPedidos => 
        prevPedidos.map(pedido => 
          pedido.id === pedidoId 
            ? { ...pedido, estado: nuevoEstado }
            : pedido
        )
      )
      
      // Luego actualizar en el servidor (en segundo plano)
      // El listener en tiempo real corregirá si hay algún error
      updateOrderStatus(pedidoId, nuevoEstado).catch(error => {
        console.error('Error al actualizar estado en servidor:', error)
        // El listener revertirá el cambio si falla
      })
    } catch (error) {
      console.error('Error al actualizar estado:', error)
      throw error
    }
  }

  return {
    pedidos,
    isLoading,
    error,
    actualizarEstado,
    refetch: loadOrders
  }
}

// Hook para formatear datos de Order a la interfaz esperada por la página admin
export const useFormattedAdminOrders = (estadoFiltro?: string) => {
  const { pedidos, isLoading, error, actualizarEstado } = useAdminOrders(estadoFiltro)

  const formattedPedidos = pedidos.map(order => {
    // Asegurar que el cliente tenga la estructura correcta
    let clienteFormatted = { nombre: 'Usuario anónimo', telefono: 'No disponible', email: '' };
    
    // Verificar si cliente existe
    if (order.cliente) {
      // Si es un string (algunos sistemas antiguos podrían guardar solo el nombre como string)
      if (typeof order.cliente === 'string') {
        clienteFormatted.nombre = order.cliente;
      } 
      // Si es un objeto (formato normal)
      else if (typeof order.cliente === 'object' && order.cliente !== null) {
        // Usar any para acceder a posibles diferentes nombres de propiedades
        const clienteAny = order.cliente as any;
        
        // Extraer nombre con diferentes posibles nombres de campo
        if (clienteAny.nombre && clienteAny.nombre !== '') 
          clienteFormatted.nombre = clienteAny.nombre;
        else if (clienteAny.name && clienteAny.name !== '') 
          clienteFormatted.nombre = clienteAny.name;
        else if (clienteAny.fullName && clienteAny.fullName !== '') 
          clienteFormatted.nombre = clienteAny.fullName;
        else if (clienteAny.nombreCompleto && clienteAny.nombreCompleto !== '') 
          clienteFormatted.nombre = clienteAny.nombreCompleto;
        
        // Extraer teléfono con diferentes posibles nombres de campo
        if (clienteAny.telefono && clienteAny.telefono !== '') 
          clienteFormatted.telefono = clienteAny.telefono;
        else if (clienteAny.phone && clienteAny.phone !== '') 
          clienteFormatted.telefono = clienteAny.phone;
        else if (clienteAny.tel && clienteAny.tel !== '') 
          clienteFormatted.telefono = clienteAny.tel;
        else if (clienteAny.celular && clienteAny.celular !== '') 
          clienteFormatted.telefono = clienteAny.celular;
        else if (clienteAny.mobile && clienteAny.mobile !== '') 
          clienteFormatted.telefono = clienteAny.mobile;
        
        // Extraer email con diferentes posibles nombres de campo
        if (clienteAny.email && clienteAny.email !== '') 
          clienteFormatted.email = clienteAny.email;
        else if (clienteAny.correo && clienteAny.correo !== '') 
          clienteFormatted.email = clienteAny.correo;
        else if (clienteAny.mail && clienteAny.mail !== '') 
          clienteFormatted.email = clienteAny.mail;
      }
    }
    
    // Si no se pudo obtener un nombre válido, usar partes del ID como último recurso
    if (clienteFormatted.nombre === 'Usuario anónimo' || !clienteFormatted.nombre) {
      if (order.userId && typeof order.userId === 'string') {
        // Si el userId parece un email, usar la parte antes de @
        if (order.userId.includes('@')) {
          const username = order.userId.split('@')[0];
          clienteFormatted.nombre = `Usuario: ${username}`;
          
          // Si no tenemos email, usar el userId completo
          if (!clienteFormatted.email) {
            clienteFormatted.email = order.userId;
          }
        } else if (order.userId.length > 6) {
          // Usar parte del ID como identificador
          clienteFormatted.nombre = `Usuario: ${order.userId.substring(0, 6)}...`;
        }
      }
    }
    
    // Limpiar cualquier string vacío
    if (clienteFormatted.nombre === '') clienteFormatted.nombre = 'Usuario anónimo';
    if (clienteFormatted.telefono === '') clienteFormatted.telefono = 'No disponible';
    
    return {
      id: `#${order.orderNumber}`,
      documentId: order.id!, // ID real del documento en Firestore
      paymentStatus: order.paymentStatus || null,
      webpay: order.webpay || null,
      cliente: clienteFormatted,
      direccion: order.direccion,
      items: order.items.map(item => ({
        nombre: item.nombre,
        cantidad: item.cantidad,
        precio: item.precio,
        size: item.size,
        ingredients: item.ingredients,
        premiumIngredients: item.premiumIngredients,
        half1: item.half1,
        half2: item.half2,
        selectedMenuPizza: item.selectedMenuPizza, // ⭐ AGREGADO: Pizza base para Premium/Promo
        sauces: item.sauces,
        drinks: item.drinks,
        extras: item.extras,
        comments: item.comments,
        pizzaType: item.pizzaType,
        pizza1: item.pizza1,
        pizza2: item.pizza2,
        sinOregano: item.sinOregano,
        sinQueso: item.sinQueso,
        sinSalsaTomate: item.sinSalsaTomate
      })),
      total: order.total,
      estado: order.estado,
      tipoEntrega: order.tipoEntrega,
      metodoPago: order.metodoPago,
      fechaCreacion: formatOrderCreatedAt(order),
      tiempoEstimado: order.tiempoEstimado,
      tiempoEstimadoMinutos: order.tiempoEstimadoMinutos,
      tiempoEstimadoInicio: order.tiempoEstimadoInicio,
      tiempoEstimadoFin: order.tiempoEstimadoFin,
      notas: order.notas
    };
  });

  return {
    pedidos: formattedPedidos,
    isLoading,
    error,
    actualizarEstado
  }
}

import { useState, useEffect, useCallback } from 'react'
import { Order, getAllOrders, updateOrderStatus, listenToAllOrders } from '../lib/orders'

// Hook para obtener todos los pedidos (Admin)
export const useAdminOrders = () => {
  const [pedidos, setPedidos] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Función para cargar pedidos iniciales
  const loadOrders = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const allOrders = await getAllOrders()
      setPedidos(allOrders)
    } catch (err) {
      setError('Error al cargar pedidos')
      console.error('Error loading admin orders:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Cargar pedidos al montar el componente
  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  // Escuchar cambios en tiempo real
  useEffect(() => {
    const unsubscribe = listenToAllOrders((updatedOrders) => {
      setPedidos(updatedOrders)
      setIsLoading(false)
    })

    return () => unsubscribe()
  }, [])

  // Función para actualizar estado de un pedido
  const actualizarEstado = async (pedidoId: string, nuevoEstado: Order['estado']) => {
    try {
      await updateOrderStatus(pedidoId, nuevoEstado)
      // El estado se actualizará automáticamente por el listener en tiempo real
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
export const useFormattedAdminOrders = () => {
  const { pedidos, isLoading, error, actualizarEstado } = useAdminOrders()

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
      cliente: clienteFormatted,
      direccion: order.direccion,
      items: order.items.map(item => ({
        nombre: item.nombre,
        cantidad: item.cantidad,
        precio: item.precio,
        size: item.size,
        ingredients: item.ingredients,
        premiumIngredients: item.premiumIngredients,
        sauces: item.sauces,
        drinks: item.drinks,
        extras: item.extras,
        comments: item.comments,
        pizzaType: item.pizzaType
      })),
      total: order.total,
      estado: order.estado,
      tipoEntrega: order.tipoEntrega,
      metodoPago: order.metodoPago,
      fechaCreacion: order.fechaCreacion,
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

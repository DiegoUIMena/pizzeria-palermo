import { useState, useEffect, useCallback } from 'react'
import { Order, getUserOrders, listenToUserOrders } from '../lib/orders'

// Hook para obtener pedidos del usuario
export const useUserOrders = (userId: string | undefined) => {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Función para cargar pedidos iniciales
  const loadOrders = useCallback(async () => {
    if (!userId) return
    
    try {
      setIsLoading(true)
      setError(null)
      const userOrders = await getUserOrders(userId)
      setOrders(userOrders)
    } catch (err) {
      setError('Error al cargar pedidos')
      console.error('Error loading orders:', err)
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  // Cargar pedidos cuando cambie el userId
  useEffect(() => {
    if (userId) {
      loadOrders()
    }
  }, [userId, loadOrders])

  // Escuchar cambios en tiempo real
  useEffect(() => {
    if (!userId) return

    const unsubscribe = listenToUserOrders(userId, (updatedOrders) => {
      setOrders(updatedOrders)
      setIsLoading(false)
    })

    return () => unsubscribe()
  }, [userId])

  return {
    orders,
    isLoading,
    error,
    refetch: loadOrders
  }
}

// Hook para formatear datos de Order a la interfaz esperada por la página
export const useFormattedOrders = (userId: string | undefined) => {
  const { orders, isLoading, error } = useUserOrders(userId)

  // En este hook, solo utilizamos el tiempo estimado seleccionado por el administrador (tiempoEstimadoMinutos)
  // y NO implementamos ninguna cuenta regresiva. El cliente solo verá el tiempo total estimado.
  const formattedOrders = orders.map(order => {
    // Verificamos si el administrador ha establecido un tiempo estimado
    // Importante: solo consideramos que hay tiempo estimado si tiempoEstimadoMinutos tiene un valor
    const hasEstimatedTime = typeof order.tiempoEstimadoMinutos === 'number' && order.tiempoEstimadoMinutos > 0;
    
    // Inicializamos el tiempo estimado como cadena vacía
    let estimatedTimeDisplay = "";
    
    // Solo establecemos el tiempo si realmente hay un tiempo estimado
    if (hasEstimatedTime) {
      estimatedTimeDisplay = `${order.tiempoEstimadoMinutos} minutos`;
    }
    
    return {
      id: `#${order.orderNumber}`,
      documentId: order.id,
      date: new Date(order.timestamps.created).toLocaleDateString('es-CL', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      status: order.estado,
      items: order.items.map(item => ({
        name: item.nombre,
        quantity: item.cantidad,
        price: item.precio,
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
      estimatedTime: estimatedTimeDisplay,
      hasEstimatedTime: hasEstimatedTime,
      deliveryType: order.tipoEntrega,
      deliveryAddress: order.direccion,
      paymentMethod: order.metodoPago,
      notes: order.notas
    };
  })

  return {
    orders: formattedOrders,
    isLoading,
    error
  }
}

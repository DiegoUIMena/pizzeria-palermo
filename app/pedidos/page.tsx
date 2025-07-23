"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Package, Clock, CheckCircle, Truck, ChevronDown, ChevronUp, Utensils } from "lucide-react"
import Header from "../components/Header"
import Footer from "../components/Footer"
import { useAuth } from "../context/AuthContext"
import { useRouter } from "next/navigation"
import { useFormattedOrders } from "../../hooks/useUserOrders"

// Tipos para los pedidos
interface OrderItem {
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
}

interface Order {
  id: string
  documentId?: string
  date: string
  status: "Pendiente" | "En preparación" | "En camino" | "Pedido Listo" | "Entregado" | "Cancelado"
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
  notes?: string
}

export default function PedidosPage() {
  const router = useRouter()
  const { isAuthenticated, user } = useAuth()
  const [isRedirecting, setIsRedirecting] = useState(false)
  // Estado para controlar qué pedidos están expandidos
  const [expandedOrders, setExpandedOrders] = useState<{ [key: string]: boolean }>({})

  // Función para expandir/contraer un pedido
  const toggleOrderExpansion = (orderId: string) => {
    setExpandedOrders(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }))
  }

  // Usar el hook para obtener pedidos del usuario
  const { orders, isLoading, error } = useFormattedOrders(user?.id)

  // Efecto para manejar la autenticación
  useEffect(() => {
    if (!isAuthenticated) {
      setIsRedirecting(true)
      router.push("/auth")
    }
  }, [isAuthenticated, router])

  // Mostrar error si hay algún problema
  useEffect(() => {
    if (error) {
      console.error('Error loading orders:', error)
    }
  }, [error])

  const getStatusIcon = (status: Order["status"]) => {
    switch (status) {
      case "Pendiente":
        return <Clock className="w-5 h-5 text-gray-500" />
      case "En preparación":
        return <Package className="w-5 h-5 text-pink-400" />
      case "En camino":
        return <Truck className="w-5 h-5 text-pink-500" />
      case "Pedido Listo":
        return <CheckCircle className="w-5 h-5 text-green-400" />
      case "Entregado":
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case "Cancelado":
        return <Clock className="w-5 h-5 text-red-500" />
      default:
        return <Clock className="w-5 h-5 text-gray-500" />
    }
  }

  const getStatusColor = (status: Order["status"]) => {
    switch (status) {
      case "Pendiente":
        return "bg-gray-500"
      case "En preparación":
        return "bg-pink-400"
      case "En camino":
        return "bg-pink-500"
      case "Pedido Listo":
        return "bg-green-400"
      case "Entregado":
        return "bg-green-600"
      case "Cancelado":
        return "bg-red-500"
      default:
        return "bg-gray-500"
    }
  }

  // Mostrar loading mientras se redirige o no hay usuario
  if (!isAuthenticated || isRedirecting) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-12">
          <div className="max-w-3xl mx-auto text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando...</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <Link href="/" className="flex items-center text-gray-600 mb-6 hover:text-pink-600 transition-colors">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al inicio
          </Link>

          <h1 className="text-3xl font-bold text-gray-800 mb-2">Mis Pedidos</h1>
          <p className="text-gray-600 mb-8">Historial de tus pedidos y su estado</p>

          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500 mx-auto mb-4"></div>
              <p className="text-gray-600">Cargando tus pedidos...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {orders.length > 0 ? (
                orders.map((order) => (
                  <Card key={order.id} className={`border-gray-200 hover:shadow-md transition-shadow ${expandedOrders[order.id] ? 'border-pink-200 shadow-md' : ''}`}>
                    <CardHeader className={`border-b border-gray-200 ${expandedOrders[order.id] ? 'bg-pink-50' : 'bg-gray-50'}`}>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg text-gray-800 flex items-center gap-2">
                          {getStatusIcon(order.status)}
                          Pedido {order.id}
                          {order.deliveryType === "Delivery" ? (
                            <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-800">
                              <Truck className="h-3 w-3 mr-1" /> Delivery
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="ml-2 bg-amber-100 text-amber-800">
                              <Utensils className="h-3 w-3 mr-1" /> Retiro
                            </Badge>
                          )}
                        </CardTitle>
                        <Badge className={`${getStatusColor(order.status)} text-white`}>{order.status}</Badge>
                      </div>
                      <div className="text-gray-500 text-sm">{order.date}</div>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="space-y-3">
                        {/* Productos */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <h4 className="text-gray-700 font-medium">Productos:</h4>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="p-0 h-auto text-gray-500 hover:text-pink-600"
                              onClick={() => toggleOrderExpansion(order.id)}
                            >
                              {expandedOrders[order.id] ? (
                                <span className="flex items-center">Ver menos <ChevronUp className="ml-1 h-4 w-4" /></span>
                              ) : (
                                <span className="flex items-center">Ver detalles <ChevronDown className="ml-1 h-4 w-4" /></span>
                              )}
                            </Button>
                          </div>
                          
                          {/* Vista resumida (siempre visible) */}
                          {order.items.map((item, index) => (
                            <div key={index} className="flex justify-between text-sm">
                              <span className="text-gray-600 flex items-center">
                                {item.quantity}x {item.name}
                                {item.size && <span className="ml-1 text-xs text-gray-500">({item.size})</span>}
                              </span>
                              <span className="text-gray-800">${item.price.toLocaleString()}</span>
                            </div>
                          ))}
                          
                          {/* Detalles expandibles */}
                          {expandedOrders[order.id] && (
                            <div className="mt-3 bg-gray-50 p-3 rounded-md text-sm">
                              <h5 className="font-medium text-gray-700 mb-2">Detalles completos:</h5>
                              
                              {/* Información de entrega y pago */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 pb-3 border-b border-gray-200">
                                {/* Método de pago */}
                                {order.paymentMethod && (
                                  <div className="text-xs">
                                    <span className="font-medium text-gray-700">Método de pago:</span>{" "}
                                    {order.paymentMethod}
                                  </div>
                                )}
                                
                                {/* Dirección de entrega (solo si es delivery) */}
                                {order.deliveryType === "Delivery" && order.deliveryAddress && (
                                  <div className="text-xs">
                                    <span className="font-medium text-gray-700">Dirección:</span>{" "}
                                    {order.deliveryAddress.calle} {order.deliveryAddress.numero}, {order.deliveryAddress.comuna}
                                    {order.deliveryAddress.referencia && (
                                      <div className="mt-1">
                                        <span className="font-medium text-gray-700">Referencia:</span>{" "}
                                        {order.deliveryAddress.referencia}
                                      </div>
                                    )}
                                  </div>
                                )}
                                
                                {/* Notas generales del pedido */}
                                {order.notes && (
                                  <div className="text-xs col-span-full">
                                    <span className="font-medium text-gray-700">Notas del pedido:</span>{" "}
                                    {order.notes}
                                  </div>
                                )}
                              </div>
                              
                              {order.items.map((item, index) => (
                                <div key={`detail-${index}`} className="mb-4 pb-3 border-b border-gray-200 last:border-0 last:pb-0">
                                  <div className="flex justify-between mb-2">
                                    <span className="font-medium text-gray-800">
                                      {item.quantity}x {item.name}
                                      {item.size && <span className="ml-1">({item.size})</span>}
                                      {item.pizzaType && <span className="ml-1 text-xs bg-pink-100 text-pink-800 px-1.5 py-0.5 rounded">{item.pizzaType}</span>}
                                    </span>
                                    <span className="font-medium">${item.price.toLocaleString()}</span>
                                  </div>
                                  
                                  {/* Detalles específicos del ítem */}
                                  <div className="ml-4 text-xs text-gray-600 space-y-1">
                                    {/* Ingredientes */}
                                    {item.ingredients && item.ingredients.length > 0 && (
                                      <div>
                                        <span className="font-medium text-gray-700">Ingredientes:</span>{" "}
                                        {item.ingredients.join(", ")}
                                      </div>
                                    )}
                                    
                                    {/* Ingredientes premium */}
                                    {item.premiumIngredients && item.premiumIngredients.length > 0 && (
                                      <div>
                                        <span className="font-medium text-gray-700">Ingredientes Premium:</span>{" "}
                                        {item.premiumIngredients.join(", ")}
                                      </div>
                                    )}
                                    
                                    {/* Salsas */}
                                    {item.sauces && item.sauces.length > 0 && (
                                      <div>
                                        <span className="font-medium text-gray-700">Salsas:</span>{" "}
                                        {item.sauces.join(", ")}
                                      </div>
                                    )}
                                    
                                    {/* Bebidas */}
                                    {item.drinks && item.drinks.length > 0 && (
                                      <div>
                                        <span className="font-medium text-gray-700">Bebidas:</span>{" "}
                                        {item.drinks.join(", ")}
                                      </div>
                                    )}
                                    
                                    {/* Extras */}
                                    {item.extras && item.extras.length > 0 && (
                                      <div>
                                        <span className="font-medium text-gray-700">Extras:</span>{" "}
                                        {item.extras.join(", ")}
                                      </div>
                                    )}
                                    
                                    {/* Comentarios */}
                                    {item.comments && (
                                      <div className="mt-1 pt-1 border-t border-dotted border-gray-200">
                                        <span className="font-medium text-gray-700">Comentarios:</span>{" "}
                                        {item.comments}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          <div className="border-t border-gray-200 pt-2 flex justify-between font-bold">
                            <span className="text-gray-800">Total:</span>
                            <span className="text-pink-600">${order.total.toLocaleString()}</span>
                          </div>
                        </div>

                        {/* Tiempo estimado según el estado del pedido */}
                        {(order.status === "Pendiente" || order.status === "En preparación" || order.status === "En camino" || order.status === "Pedido Listo") && (
                          <div className={`p-3 rounded-lg border ${order.status === "Pedido Listo" ? 'bg-green-50 border-green-200' : 'bg-pink-50 border-pink-200'}`}>
                            <div className={`flex items-center justify-between ${order.status === "Pedido Listo" ? 'text-green-700' : 'text-pink-700'}`}>
                              <div className="flex items-center">
                                <Clock className="h-4 w-4 mr-2" />
                                {order.status === "Pendiente" && (
                                  <div>
                                    <span className="font-medium">Tiempo de preparación estimado: {order.hasEstimatedTime ? order.estimatedTime : ""}</span>
                                  </div>
                                )}
                                {order.status === "En preparación" && (
                                  <div>
                                    <span className="font-medium">Tiempo estimado de preparación: {order.hasEstimatedTime ? order.estimatedTime : ""}</span>
                                  </div>
                                )}
                                {order.status === "En camino" && (
                                  <div>
                                    <span className="font-medium">Tiempo estimado de entrega: {order.hasEstimatedTime ? order.estimatedTime : ""}</span>
                                  </div>
                                )}
                                {order.status === "Pedido Listo" && order.deliveryType === "Retiro" && (
                                  <span className="font-medium">¡Su pedido está listo para retirar en el local!</span>
                                )}
                                {order.status === "Pedido Listo" && order.deliveryType === "Delivery" && (
                                  <span className="font-medium">¡Su pedido está listo y pronto saldrá para entrega!</span>
                                )}
                              </div>
                              
                              {/* Botón de seguimiento para pedidos activos */}
                              {(order.status === "Pendiente" || order.status === "En preparación" || order.status === "En camino") && (
                                <Link 
                                  href={`/seguimiento?id=${order.documentId}`}
                                  className="bg-white text-pink-600 text-xs px-3 py-1.5 rounded-full border border-pink-200 hover:bg-pink-50 transition-colors"
                                >
                                  Seguir pedido
                                </Link>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-12">
                  <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">No tienes pedidos aún</h3>
                  <p className="text-gray-500 mb-6">
                    Cuando realices un pedido, aparecerá aquí para que puedas seguir su progreso.
                  </p>
                  <Link href="/menu">
                    <Button className="bg-pink-600 text-white hover:bg-pink-700">Ver Menú</Button>
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}

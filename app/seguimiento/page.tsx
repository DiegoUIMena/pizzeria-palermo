"use client"

import { useState, useEffect } from "react"
import Header from "../components/Header"
import Footer from "../components/Footer"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Clock, CheckCircle, Truck, Package } from "lucide-react"

const mockOrders = [
  {
    id: "#3102",
    customer: "Sophia Anderson",
    date: "23 de Junio, 2022",
    status: "En preparación",
    progress: 50,
    items: [
      { name: "Pizza Suprema", quantity: 2, price: 25980 },
      { name: "Coca-Cola 1.5L", quantity: 1, price: 1990 },
    ],
    total: 27970,
    estimatedTime: "25-30 min",
  },
  {
    id: "#3103",
    customer: "Carlos Rodriguez",
    date: "23 de Junio, 2022",
    status: "En camino",
    progress: 75,
    items: [{ name: "Promo Duo Especial", quantity: 1, price: 18990 }],
    total: 18990,
    estimatedTime: "10-15 min",
  },
  {
    id: "#3104",
    customer: "María González",
    date: "23 de Junio, 2022",
    status: "Entregado",
    progress: 100,
    items: [
      { name: "Pizza Hawaiana", quantity: 1, price: 11990 },
      { name: "Palitos de Ajo", quantity: 1, price: 3390 },
    ],
    total: 15380,
    estimatedTime: "Completado",
  },
]

const getStatusIcon = (status: string) => {
  switch (status) {
    case "En preparación":
      return <Package className="w-5 h-5 text-pink-400" />
    case "En camino":
      return <Truck className="w-5 h-5 text-pink-500" />
    case "Entregado":
      return <CheckCircle className="w-5 h-5 text-pink-600" />
    default:
      return <Clock className="w-5 h-5 text-gray-500" />
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "En preparación":
      return "bg-pink-400"
    case "En camino":
      return "bg-pink-500"
    case "Entregado":
      return "bg-pink-600"
    default:
      return "bg-gray-500"
  }
}

export default function SeguimientoPage() {
  const [orders, setOrders] = useState(mockOrders)

  // Simular actualizaciones en tiempo real
  useEffect(() => {
    const interval = setInterval(() => {
      setOrders((prevOrders) =>
        prevOrders.map((order) => {
          if (order.status === "En preparación" && Math.random() > 0.8) {
            return { ...order, status: "En camino", progress: 75 }
          }
          if (order.status === "En camino" && Math.random() > 0.9) {
            return { ...order, status: "Entregado", progress: 100, estimatedTime: "Completado" }
          }
          return order
        }),
      )
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-black">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Seguimiento de Pedidos</h1>
          <p className="text-gray-400">Monitorea el estado de tus pedidos en tiempo real</p>
        </div>

        <div className="grid gap-6">
          {orders.map((order) => (
            <Card key={order.id} className="bg-gray-900 border-gray-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white flex items-center gap-2">
                    {getStatusIcon(order.status)}
                    Pedido {order.id}
                  </CardTitle>
                  <Badge className={`${getStatusColor(order.status)} text-white`}>{order.status}</Badge>
                </div>
                <div className="text-gray-400 text-sm">
                  {order.customer} • {order.date}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Progreso del pedido</span>
                    <span className="text-white">{order.estimatedTime}</span>
                  </div>
                  <Progress value={order.progress} className="h-2" />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Confirmado</span>
                    <span>Preparando</span>
                    <span>En camino</span>
                    <span>Entregado</span>
                  </div>
                </div>

                {/* Order Items */}
                <div className="space-y-2">
                  <h4 className="text-white font-medium">Productos:</h4>
                  {order.items.map((item, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span className="text-gray-300">
                        {item.quantity}x {item.name}
                      </span>
                      <span className="text-white">${item.price.toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="border-t border-gray-700 pt-2 flex justify-between font-bold">
                    <span className="text-white">Total:</span>
                    <span className="text-pink-400">${order.total.toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {orders.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No tienes pedidos activos</h3>
            <p className="text-gray-400">
              Cuando realices un pedido, aparecerá aquí para que puedas seguir su progreso.
            </p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}

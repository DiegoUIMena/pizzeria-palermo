"use client"

import { Suspense, useMemo } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import Header from "../components/Header"
import Footer from "../components/Footer"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { ArrowLeft, CheckCircle, Clock, Package, Store, Truck } from "lucide-react"
import { useAuth } from "../context/AuthContext"
import { useFormattedOrders } from "../../hooks/useUserOrders"
import type { FormattedOrder } from "../../lib/types"

const ACTIVE_ORDER_STATUSES = new Set<FormattedOrder["status"]>([
  "Pago Pendiente",
  "Pendiente",
  "En preparación",
  "En camino",
  "Pedido Listo",
])

type StepState = "completed" | "current" | "pending"

function normalizeStatus(status: string) {
  return status
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

function getTrackingSteps(order: FormattedOrder) {
  const status = normalizeStatus(order.status)
  const isDelivery = order.deliveryType === "Delivery"
  const baseSteps = [
    { key: "received", label: "Pedido recibido", icon: Package },
    { key: "preparing", label: "En preparación", icon: Clock },
    { key: "ready", label: "Pedido listo", icon: Store },
  ]
  const steps = isDelivery
    ? [...baseSteps, { key: "onTheWay", label: "En camino", icon: Truck }]
    : baseSteps

  const reached = {
    received: ["pago pendiente", "pendiente", "en preparacion", "pedido listo", "en camino"].includes(status),
    preparing: ["en preparacion", "pedido listo", "en camino"].includes(status),
    ready: ["pedido listo", "en camino"].includes(status),
    onTheWay: status === "en camino",
  }

  const reachedCount = steps.filter((step) => reached[step.key as keyof typeof reached]).length
  const currentIndex = Math.min(Math.max(reachedCount, 1), steps.length) - 1

  return {
    progress: Math.round((reachedCount / steps.length) * 100),
    steps: steps.map((step, index) => {
      let state: StepState = "pending"
      if (reached[step.key as keyof typeof reached]) state = "completed"
      else if (index === currentIndex) state = "current"
      return { ...step, state }
    }),
  }
}

function getStatusColor(status: FormattedOrder["status"]) {
  switch (status) {
    case "Pago Pendiente":
      return "bg-yellow-500"
    case "Pendiente":
      return "bg-gray-600"
    case "En preparación":
      return "bg-pink-500"
    case "En camino":
      return "bg-blue-600"
    case "Pedido Listo":
      return "bg-green-600"
    default:
      return "bg-gray-500"
  }
}

function SeguimientoContent() {
  const searchParams = useSearchParams()
  const requestedOrderId = searchParams.get("id")
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const { orders, isLoading, error } = useFormattedOrders(user?.id)

  const activeOrder = useMemo(() => {
    const activeOrders = orders.filter((order) => ACTIVE_ORDER_STATUSES.has(order.status))
    if (requestedOrderId) {
      return activeOrders.find((order) => order.documentId === requestedOrderId) || null
    }
    return activeOrders[0] || null
  }, [orders, requestedOrderId])

  const tracking = activeOrder ? getTrackingSteps(activeOrder) : null

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <Link href="/" className="flex items-center text-gray-600 mb-6 hover:text-pink-600 transition-colors">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al inicio
          </Link>

          <h1 className="text-3xl font-bold text-gray-800 mb-2">Seguimiento de pedido</h1>
          <p className="text-gray-600 mb-8">Estado en vivo de tu pedido en curso.</p>

          {authLoading || isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500 mx-auto mb-4"></div>
              <p className="text-gray-600">Cargando seguimiento...</p>
            </div>
          ) : !isAuthenticated ? (
            <Card className="border-gray-200">
              <CardContent className="text-center py-12">
                <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-800 mb-2">Inicia sesión para ver tu pedido</h2>
                <p className="text-gray-600 mb-6">El seguimiento de clientes registrados se muestra con tu sesión activa.</p>
                <Link href="/auth">
                  <Button className="bg-pink-600 text-white hover:bg-pink-700">Iniciar sesión</Button>
                </Link>
              </CardContent>
            </Card>
          ) : error ? (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="py-8">
                <p className="font-semibold text-red-700">No se pudo cargar el seguimiento.</p>
                <p className="text-sm text-red-600 mt-1">{error}</p>
              </CardContent>
            </Card>
          ) : activeOrder && tracking ? (
            <Card className="border-pink-200 shadow-sm">
              <CardHeader className="border-b border-pink-100 bg-white">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-gray-900 flex items-center gap-2">
                      <Package className="h-5 w-5 text-pink-600" />
                      Pedido {activeOrder.id}
                    </CardTitle>
                    <p className="text-sm text-gray-500 mt-1">{activeOrder.date}</p>
                  </div>
                  <Badge className={`${getStatusColor(activeOrder.status)} text-white`}>{activeOrder.status}</Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-6 pt-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-700">Progreso del pedido</span>
                    <span className="text-gray-600">
                      {activeOrder.hasEstimatedTime ? activeOrder.estimatedTime : "En actualización"}
                    </span>
                  </div>
                  <Progress value={tracking.progress} className="h-2" />
                </div>

                <div className={`grid grid-cols-1 sm:grid-cols-2 ${tracking.steps.length === 4 ? "md:grid-cols-4" : "md:grid-cols-3"} gap-3`}>
                  {tracking.steps.map((step) => {
                    const Icon = step.icon
                    const isDone = step.state === "completed"
                    const isCurrent = step.state === "current"

                    return (
                      <div
                        key={step.key}
                        className={`rounded-lg border p-4 text-center ${
                          isDone
                            ? "border-green-300 bg-green-50"
                            : isCurrent
                              ? "border-pink-300 bg-pink-50"
                              : "border-gray-200 bg-white"
                        }`}
                      >
                        <div
                          className={`mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full ${
                            isDone
                              ? "bg-green-500 text-white"
                              : isCurrent
                                ? "bg-pink-500 text-white"
                                : "bg-gray-100 text-gray-400"
                          }`}
                        >
                          <Icon className="h-6 w-6" />
                        </div>
                        <p className="text-sm font-semibold text-gray-800">{step.label}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {isDone ? "Completado" : isCurrent ? "En curso" : "Pendiente"}
                        </p>
                      </div>
                    )
                  })}
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span>Entrega: <strong>{activeOrder.deliveryType}</strong></span>
                    <span>Total: <strong>${activeOrder.total.toLocaleString("es-CL")}</strong></span>
                  </div>
                  {activeOrder.deliveryType === "Delivery" && activeOrder.deliveryAddress && (
                    <p className="mt-2">
                      Dirección: {activeOrder.deliveryAddress.calle} {activeOrder.deliveryAddress.numero}, {activeOrder.deliveryAddress.comuna}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-gray-200">
              <CardContent className="text-center py-12">
                <CheckCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-800 mb-2">No tienes pedidos en curso</h2>
                <p className="text-gray-600 mb-6">Cuando tengas un pedido activo, aparecerá aquí para seguir su avance.</p>
                <Link href="/pedidos">
                  <Button variant="outline">Ver historial de pedidos</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default function SeguimientoPage() {
  return (
    <Suspense fallback={null}>
      <SeguimientoContent />
    </Suspense>
  )
}

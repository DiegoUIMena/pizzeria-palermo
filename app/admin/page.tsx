"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ShoppingCart,
  Package,
  AlertTriangle,
  TrendingUp,
  Clock,
  CheckCircle,
  Truck,
  Users,
  DollarSign,
} from "lucide-react"

// Tipos para el dashboard
interface DashboardStats {
  totalPedidos: number
  pedidosPendientes: number
  pedidosEnProceso: number
  pedidosEntregados: number
  ventasHoy: number
  stockBajo: number
  clientesActivos: number
}

interface PedidoResumen {
  id: string
  cliente: string
  total: number
  estado: "Pendiente" | "En preparación" | "En camino" | "Entregado"
  tiempo: string
}

interface InventarioAlerta {
  id: number
  nombre: string
  stockActual: number
  stockMinimo: number
  unidad: string
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalPedidos: 0,
    pedidosPendientes: 0,
    pedidosEnProceso: 0,
    pedidosEntregados: 0,
    ventasHoy: 0,
    stockBajo: 0,
    clientesActivos: 0,
  })

  const [pedidosRecientes, setPedidosRecientes] = useState<PedidoResumen[]>([])
  const [alertasInventario, setAlertasInventario] = useState<InventarioAlerta[]>([])

  // Simular carga de datos
  useEffect(() => {
    // Simular datos del dashboard
    setStats({
      totalPedidos: 156,
      pedidosPendientes: 8,
      pedidosEnProceso: 12,
      pedidosEntregados: 136,
      ventasHoy: 2450000,
      stockBajo: 5,
      clientesActivos: 89,
    })

    // Simular pedidos recientes
    setPedidosRecientes([
      {
        id: "#3105",
        cliente: "María González",
        total: 18990,
        estado: "Pendiente",
        tiempo: "Hace 5 min",
      },
      {
        id: "#3104",
        cliente: "Carlos Rodríguez",
        total: 25980,
        estado: "En preparación",
        tiempo: "Hace 12 min",
      },
      {
        id: "#3103",
        cliente: "Ana Silva",
        total: 15380,
        estado: "En camino",
        tiempo: "Hace 18 min",
      },
      {
        id: "#3102",
        cliente: "Pedro Martínez",
        total: 22990,
        estado: "Entregado",
        tiempo: "Hace 25 min",
      },
    ])

    // Simular alertas de inventario
    setAlertasInventario([
      { id: 1, nombre: "Queso Mozzarella", stockActual: 2, stockMinimo: 5, unidad: "kg" },
      { id: 2, nombre: "Pepperoni", stockActual: 1, stockMinimo: 3, unidad: "kg" },
      { id: 3, nombre: "Masa para Pizza", stockActual: 8, stockMinimo: 15, unidad: "unidades" },
      { id: 4, nombre: "Salsa de Tomate", stockActual: 3, stockMinimo: 6, unidad: "litros" },
      { id: 5, nombre: "Champiñones", stockActual: 1, stockMinimo: 4, unidad: "kg" },
    ])
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Pendiente":
        return <Clock className="w-4 h-4 text-yellow-500" />
      case "En preparación":
        return <Package className="w-4 h-4 text-blue-500" />
      case "En camino":
        return <Truck className="w-4 h-4 text-purple-500" />
      case "Entregado":
        return <CheckCircle className="w-4 h-4 text-green-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Pendiente":
        return "bg-yellow-500"
      case "En preparación":
        return "bg-blue-500"
      case "En camino":
        return "bg-purple-500"
      case "Entregado":
        return "bg-green-500"
      default:
        return "bg-gray-500"
    }
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Panel de Administración</h1>
        <p className="text-gray-500 dark:text-gray-400">Gestiona tu negocio desde un solo lugar</p>
      </div>

      {/* Estadísticas Principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pedidos</CardTitle>
            <ShoppingCart className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.totalPedidos}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Hoy</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas del Día</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">${stats.ventasHoy.toLocaleString()}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">+12% vs ayer</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pedidos Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.pedidosPendientes}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Requieren atención</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Bajo</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.stockBajo}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Ingredientes</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Pedidos Recientes */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl">Pedidos Recientes</CardTitle>
                <CardDescription>Últimos pedidos recibidos</CardDescription>
              </div>
              <Link href="/admin/pedidos">
                <Button variant="outline" size="sm">
                  Ver todos
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pedidosRecientes.map((pedido) => (
                  <div
                    key={pedido.id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      {getStatusIcon(pedido.estado)}
                      <div>
                        <div className="font-medium text-gray-800 dark:text-gray-200">
                          {pedido.id} - {pedido.cliente}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{pedido.tiempo}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <div className="font-bold text-gray-800 dark:text-gray-200">${pedido.total.toLocaleString()}</div>
                        <Badge className={`${getStatusColor(pedido.estado)} text-white text-xs`}>
                          {pedido.estado}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alertas de Inventario */}
        <div>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl text-red-600 dark:text-red-400">Alertas de Stock</CardTitle>
                <CardDescription>Ingredientes con stock bajo</CardDescription>
              </div>
              <Link href="/admin/inventario">
                <Button variant="outline" size="sm">
                  Gestionar
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {alertasInventario.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <div>
                        <div className="font-medium text-gray-800 dark:text-gray-200 text-sm">{item.nombre}</div>
                        <div className="text-xs text-red-600 dark:text-red-400">
                          {item.stockActual} {item.unidad} restantes
                        </div>
                      </div>
                    </div>
                    <Badge variant="destructive" className="text-xs">
                      Bajo
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Estadísticas Adicionales */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Estadísticas del Día</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-300">Clientes Activos</span>
                </div>
                <span className="font-bold text-blue-600 dark:text-blue-400">{stats.clientesActivos}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Package className="h-4 w-4 text-purple-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-300">En Proceso</span>
                </div>
                <span className="font-bold text-purple-600 dark:text-purple-400">{stats.pedidosEnProceso}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-300">Entregados</span>
                </div>
                <span className="font-bold text-green-600 dark:text-green-400">{stats.pedidosEntregados}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-4 w-4 text-pink-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-300">Eficiencia</span>
                </div>
                <span className="font-bold text-pink-600 dark:text-pink-400">94%</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

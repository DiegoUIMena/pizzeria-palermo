"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  BarChart3,
  PieChart,
  Download,
  Calendar,
  TrendingUp,
  TrendingDown,
  Pizza,
  DollarSign,
  Users,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react"
import VentasChart from "./components/VentasChart"
import ProductosChart from "./components/ProductosChart"
import InventarioChart from "./components/InventarioChart"
import ClientesChart from "./components/ClientesChart"

export default function AdminReportes() {
  const [isLoading, setIsLoading] = useState(true)
  const [periodoVentas, setPeriodoVentas] = useState("semana")
  const [periodoProductos, setPeriodoProductos] = useState("mes")
  const [reporteActivo, setReporteActivo] = useState("ventas")

  // Datos simulados para KPIs
  const [kpis, setKpis] = useState({
    ventasTotal: 0,
    ventasCrecimiento: 0,
    ticketPromedio: 0,
    ticketCrecimiento: 0,
    clientesNuevos: 0,
    clientesCrecimiento: 0,
    tiempoEntrega: 0,
    tiempoEntregaCrecimiento: 0,
  })

  // Simular carga de datos
  useEffect(() => {
    setTimeout(() => {
      setKpis({
        ventasTotal: 12450000,
        ventasCrecimiento: 12.5,
        ticketPromedio: 15980,
        ticketCrecimiento: 8.3,
        clientesNuevos: 87,
        clientesCrecimiento: 15.2,
        tiempoEntrega: 28,
        tiempoEntregaCrecimiento: -5.4,
      })
      setIsLoading(false)
    }, 1000)
  }, [])

  const handleExportarReporte = () => {
    alert("Exportando reporte en formato CSV...")
    // Aquí iría la lógica real de exportación
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900">
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Cargando reportes...</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">Reportes y Análisis</h1>
            <p className="text-gray-600 dark:text-gray-400">Estadísticas y métricas de rendimiento del negocio</p>
          </div>
          <Button onClick={handleExportarReporte} variant="outline" className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Exportar Datos
          </Button>
        </div>

        {/* KPIs Principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white dark:bg-gray-800 border dark:border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium dark:text-gray-200">Ventas Totales</CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold dark:text-white">${kpis.ventasTotal.toLocaleString()}</div>
              <div className="flex items-center mt-1">
                {kpis.ventasCrecimiento > 0 ? (
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 hover:bg-green-100 dark:hover:bg-green-900">
                    <ArrowUpRight className="w-3 h-3 mr-1" />+{kpis.ventasCrecimiento}%
                  </Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100 hover:bg-red-100 dark:hover:bg-red-900">
                    <ArrowDownRight className="w-3 h-3 mr-1" />
                    {kpis.ventasCrecimiento}%
                  </Badge>
                )}
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">vs mes anterior</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border dark:border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium dark:text-gray-200">Ticket Promedio</CardTitle>
              <Pizza className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold dark:text-white">${kpis.ticketPromedio.toLocaleString()}</div>
              <div className="flex items-center mt-1">
                {kpis.ticketCrecimiento > 0 ? (
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 hover:bg-green-100 dark:hover:bg-green-900">
                    <ArrowUpRight className="w-3 h-3 mr-1" />+{kpis.ticketCrecimiento}%
                  </Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100 hover:bg-red-100 dark:hover:bg-red-900">
                    <ArrowDownRight className="w-3 h-3 mr-1" />
                    {kpis.ticketCrecimiento}%
                  </Badge>
                )}
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">vs mes anterior</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border dark:border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium dark:text-gray-200">Clientes Nuevos</CardTitle>
              <Users className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold dark:text-white">{kpis.clientesNuevos}</div>
              <div className="flex items-center mt-1">
                {kpis.clientesCrecimiento > 0 ? (
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 hover:bg-green-100 dark:hover:bg-green-900">
                    <ArrowUpRight className="w-3 h-3 mr-1" />+{kpis.clientesCrecimiento}%
                  </Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100 hover:bg-red-100 dark:hover:bg-red-900">
                    <ArrowDownRight className="w-3 h-3 mr-1" />
                    {kpis.clientesCrecimiento}%
                  </Badge>
                )}
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">vs mes anterior</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border dark:border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium dark:text-gray-200">Tiempo de Entrega</CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold dark:text-white">{kpis.tiempoEntrega} min</div>
              <div className="flex items-center mt-1">
                {kpis.tiempoEntregaCrecimiento < 0 ? (
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 hover:bg-green-100 dark:hover:bg-green-900">
                    <ArrowDownRight className="w-3 h-3 mr-1" />
                    {kpis.tiempoEntregaCrecimiento}%
                  </Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100 hover:bg-red-100 dark:hover:bg-red-900">
                    <ArrowUpRight className="w-3 h-3 mr-1" />+{kpis.tiempoEntregaCrecimiento}%
                  </Badge>
                )}
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">vs mes anterior</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs de Reportes */}
        <Tabs defaultValue="ventas" className="space-y-6" onValueChange={setReporteActivo}>
          <TabsList className="grid grid-cols-4 md:w-[600px] bg-gray-100 dark:bg-gray-800">
            <TabsTrigger value="ventas" className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Ventas</span>
            </TabsTrigger>
            <TabsTrigger value="productos" className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700">
              <PieChart className="w-4 h-4" />
              <span className="hidden sm:inline">Productos</span>
            </TabsTrigger>
            <TabsTrigger value="inventario" className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4" />
              <span className="hidden sm:inline">Inventario</span>
            </TabsTrigger>
            <TabsTrigger value="clientes" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">Clientes</span>
            </TabsTrigger>
          </TabsList>

          {/* Reporte de Ventas */}
          <TabsContent value="ventas">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xl">Reporte de Ventas</CardTitle>
                  <CardDescription>Análisis de ventas por período</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <Select value={periodoVentas} onValueChange={setPeriodoVentas}>
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Seleccionar período" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="semana">Última semana</SelectItem>
                      <SelectItem value="mes">Último mes</SelectItem>
                      <SelectItem value="trimestre">Último trimestre</SelectItem>
                      <SelectItem value="anual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <VentasChart periodo={periodoVentas} />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-sm font-medium text-gray-500 mb-1">Ventas Totales</div>
                      <div className="text-2xl font-bold">$12,450,000</div>
                      <div className="text-xs text-green-600 mt-1">+12.5% vs período anterior</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-sm font-medium text-gray-500 mb-1">Pedidos</div>
                      <div className="text-2xl font-bold">782</div>
                      <div className="text-xs text-green-600 mt-1">+8.3% vs período anterior</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-sm font-medium text-gray-500 mb-1">Ticket Promedio</div>
                      <div className="text-2xl font-bold">$15,980</div>
                      <div className="text-xs text-green-600 mt-1">+4.2% vs período anterior</div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reporte de Productos */}
          <TabsContent value="productos">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xl">Productos Más Vendidos</CardTitle>
                  <CardDescription>Análisis de ventas por producto</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <Select value={periodoProductos} onValueChange={setPeriodoProductos}>
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Seleccionar período" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="semana">Última semana</SelectItem>
                      <SelectItem value="mes">Último mes</SelectItem>
                      <SelectItem value="trimestre">Último trimestre</SelectItem>
                      <SelectItem value="anual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <ProductosChart periodo={periodoProductos} />

                <div className="mt-8">
                  <h4 className="font-medium text-gray-800 mb-4">Top 5 Productos</h4>
                  <div className="space-y-4">
                    {[
                      { nombre: "Pizza Suprema", cantidad: 245, porcentaje: 18.5 },
                      { nombre: "Pizza Hawaiana", cantidad: 187, porcentaje: 14.1 },
                      { nombre: "Promo Duo Especial", cantidad: 156, porcentaje: 11.8 },
                      { nombre: "Pizza Pepperoni", cantidad: 134, porcentaje: 10.1 },
                      { nombre: "Pizza Vegetariana", cantidad: 98, porcentaje: 7.4 },
                    ].map((producto, index) => (
                      <div key={index} className="flex items-center">
                        <div className="w-1/2">
                          <div className="font-medium">{producto.nombre}</div>
                          <div className="text-sm text-gray-500">{producto.cantidad} unidades</div>
                        </div>
                        <div className="w-1/2">
                          <div className="flex items-center">
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                              <div
                                className="bg-pink-600 h-2.5 rounded-full"
                                style={{ width: `${producto.porcentaje}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-medium text-gray-700 ml-2">{producto.porcentaje}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reporte de Inventario */}
          <TabsContent value="inventario">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Análisis de Inventario</CardTitle>
                <CardDescription>Consumo y rotación de ingredientes</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <InventarioChart />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                  <div>
                    <h4 className="font-medium text-gray-800 mb-4">Ingredientes con Mayor Rotación</h4>
                    <div className="space-y-3">
                      {[
                        { nombre: "Queso Mozzarella", rotacion: "Alta", consumo: "45 kg/semana" },
                        { nombre: "Masa para Pizza", rotacion: "Alta", consumo: "320 unidades/semana" },
                        { nombre: "Salsa de Tomate", rotacion: "Alta", consumo: "38 litros/semana" },
                        { nombre: "Pepperoni", rotacion: "Media", consumo: "22 kg/semana" },
                        { nombre: "Jamón", rotacion: "Media", consumo: "18 kg/semana" },
                      ].map((item, index) => (
                        <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                          <div>
                            <div className="font-medium">{item.nombre}</div>
                            <div className="text-xs text-gray-500">{item.consumo}</div>
                          </div>
                          <Badge
                            className={
                              item.rotacion === "Alta"
                                ? "bg-green-100 text-green-800 hover:bg-green-100"
                                : "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
                            }
                          >
                            {item.rotacion}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-800 mb-4">Ingredientes con Stock Crítico</h4>
                    <div className="space-y-3">
                      {[
                        { nombre: "Aceitunas Negras", stock: "0 kg", minimo: "2 kg" },
                        { nombre: "Pepperoni", stock: "1 kg", minimo: "3 kg" },
                        { nombre: "Champiñones", stock: "1 kg", minimo: "4 kg" },
                        { nombre: "Queso Mozzarella", stock: "2 kg", minimo: "5 kg" },
                        { nombre: "Masa para Pizza", stock: "8 unidades", minimo: "15 unidades" },
                      ].map((item, index) => (
                        <div key={index} className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                          <div>
                            <div className="font-medium">{item.nombre}</div>
                            <div className="text-xs text-gray-500">
                              Stock: {item.stock} (Mín: {item.minimo})
                            </div>
                          </div>
                          <Badge variant="destructive">Crítico</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reporte de Clientes */}
          <TabsContent value="clientes">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Análisis de Clientes</CardTitle>
                <CardDescription>Comportamiento y retención de clientes</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <ClientesChart />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-sm font-medium text-gray-500 mb-1">Clientes Activos</div>
                      <div className="text-2xl font-bold">1,245</div>
                      <div className="text-xs text-green-600 mt-1">+15.2% vs mes anterior</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-sm font-medium text-gray-500 mb-1">Tasa de Retención</div>
                      <div className="text-2xl font-bold">68%</div>
                      <div className="text-xs text-green-600 mt-1">+3.5% vs mes anterior</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-sm font-medium text-gray-500 mb-1">Valor Cliente</div>
                      <div className="text-2xl font-bold">$24,500</div>
                      <div className="text-xs text-green-600 mt-1">+7.8% vs mes anterior</div>
                    </CardContent>
                  </Card>
                </div>

                <div className="mt-8">
                  <h4 className="font-medium text-gray-800 mb-4">Segmentación de Clientes</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h5 className="font-medium mb-3">Por Frecuencia</h5>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Clientes frecuentes (4+ pedidos/mes)</span>
                          <span className="font-medium">28%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Clientes regulares (2-3 pedidos/mes)</span>
                          <span className="font-medium">42%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Clientes ocasionales (1 pedido/mes)</span>
                          <span className="font-medium">30%</span>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h5 className="font-medium mb-3">Por Ticket Promedio</h5>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Premium ($25,000+)</span>
                          <span className="font-medium">15%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Medio ($15,000-$25,000)</span>
                          <span className="font-medium">55%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Básico (menos de $15,000)</span>
                          <span className="font-medium">30%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

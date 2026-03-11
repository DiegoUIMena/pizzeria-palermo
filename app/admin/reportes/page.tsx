"use client"

import { useState } from "react"
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
import { useAdminReports } from '@/hooks/useAdminReports'
import GeneralSalesReport from './components/GeneralSalesReport'

export default function AdminReportes() {
  const [periodoVentas, setPeriodoVentas] = useState("semana")
  const [periodoProductos, setPeriodoProductos] = useState("mes")
  const [reporteActivo, setReporteActivo] = useState("ventas")
  const { orders, kpis, getSalesSeries, getProductShare, inventory, clientesSeries, loading, getTopProducts, getVentasResumen, getCriticalInventory, getHighRotationInventory, getClientesResumen, getClientesSegmentacion } = useAdminReports()
  const ventasResumen = getVentasResumen(periodoVentas as any)
  const topProductos = getTopProducts(periodoProductos as any)
  const criticos = getCriticalInventory()
  const rotacion = getHighRotationInventory()
  const clientesResumen = getClientesResumen('mes') // usamos mes para cards principales de clientes
  const segmentacion = getClientesSegmentacion('mes')

  const handleExportarReporte = () => {
    alert("Exportando reporte en formato CSV...")
    // Aquí iría la lógica real de exportación
  }

  if (loading) {
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
        <div className="no-print flex justify-between items-center mb-8">
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
        <div className="no-print grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
          <TabsList className="no-print grid grid-cols-4 md:w-[600px] bg-gray-100 dark:bg-gray-800">
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
            <Card className="no-print">
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
                <VentasChart data={getSalesSeries(periodoVentas as any)} />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                  {[{
                    label: 'Ventas Totales',
                    valor: `$${ventasResumen.ventas.toLocaleString()}`,
                    crecimiento: ventasResumen.ventasCrecimiento
                  }, {
                    label: 'Pedidos',
                    valor: ventasResumen.pedidos.toString(),
                    crecimiento: ventasResumen.pedidosCrecimiento
                  }, {
                    label: 'Ticket Promedio',
                    valor: `$${ventasResumen.ticket.toLocaleString()}`,
                    crecimiento: ventasResumen.ticketCrecimiento
                  }].map((c, i) => (
                    <Card key={i} className="bg-white dark:bg-gray-800 border dark:border-gray-700">
                      <CardContent className="p-4">
                        <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{c.label}</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">{c.valor}</div>
                        <div className={`text-xs mt-1 font-medium ${c.crecimiento >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{c.crecimiento >= 0 ? '+' : ''}{c.crecimiento}% vs período anterior</div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
            {/* Reportes de Ventas Generales (gráfico de líneas, comparativas y subida de datos) */}
            <GeneralSalesReport getSalesSeries={getSalesSeries} orders={orders} />
          </TabsContent>

          {/* Reporte de Productos */}
          <TabsContent value="productos" className="no-print">
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
                <ProductosChart data={getProductShare(periodoProductos as any)} />

                <div className="mt-8">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-4">Top 5 Productos</h4>
                  <div className="space-y-4">
                    {topProductos.map((producto, index) => (
                      <div key={index} className="flex items-center">
                        <div className="w-1/2">
                          <div className="font-medium text-gray-800 dark:text-gray-200">{producto.nombre}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{producto.unidades} unidades</div>
                        </div>
                        <div className="w-1/2">
                          <div className="flex items-center">
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                              <div
                                className="bg-pink-600 h-2.5 rounded-full"
                                style={{ width: `${producto.porcentaje}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-2">{producto.porcentaje}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {!topProductos.length && (
                      <div className="text-sm text-gray-500 dark:text-gray-400">No hay datos en este período.</div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reporte de Inventario */}
          <TabsContent value="inventario" className="no-print">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Análisis de Inventario</CardTitle>
                <CardDescription>Consumo y rotación de ingredientes</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <InventarioChart data={inventory} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-4">Ingredientes con Mayor Rotación (aprox)</h4>
                    <div className="space-y-3">
                      {rotacion.map(item => (
                        <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg">
                          <div>
                            <div className="font-medium text-gray-800 dark:text-gray-200">{item.nombre}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Stock mín: {item.stockMinimo}</div>
                          </div>
                          <Badge className={item.rotacion === 'Alta' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' : item.rotacion === 'Media' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100' : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200'}>{item.rotacion}</Badge>
                        </div>
                      ))}
                      {!rotacion.length && <div className="text-sm text-gray-500 dark:text-gray-400">Sin datos.</div>}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-4">Ingredientes con Stock Crítico</h4>
                    <div className="space-y-3">
                      {criticos.map(item => (
                        <div key={item.id} className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/30 rounded-lg">
                          <div>
                            <div className="font-medium text-gray-800 dark:text-gray-200">{item.nombre}</div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">Stock: {item.stockActual} (Mín: {item.stockMinimo})</div>
                          </div>
                          <Badge variant="destructive">Crítico</Badge>
                        </div>
                      ))}
                      {!criticos.length && <div className="text-sm text-gray-500 dark:text-gray-400">No hay ingredientes críticos.</div>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reporte de Clientes */}
          <TabsContent value="clientes" className="no-print">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Análisis de Clientes</CardTitle>
                <CardDescription>Comportamiento y retención de clientes</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <ClientesChart data={clientesSeries} />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                  {[{
                    label: 'Clientes Activos', valor: clientesResumen.activos.toString(), crecimiento: clientesResumen.activosCrecimiento
                  }, {
                    label: 'Tasa de Retención', valor: `${clientesResumen.retencion}%`, crecimiento: clientesResumen.retencionCrecimiento
                  }, {
                    label: 'Valor Cliente', valor: `$${clientesResumen.valorCliente.toLocaleString()}`, crecimiento: clientesResumen.valorClienteCrecimiento
                  }].map((c,i)=>(
                    <Card key={i} className="bg-white dark:bg-gray-800 border dark:border-gray-700">
                      <CardContent className="p-4">
                        <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{c.label}</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">{c.valor}</div>
                        <div className={`text-xs mt-1 font-medium ${c.crecimiento >=0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{c.crecimiento>=0?'+':''}{c.crecimiento}% vs mes anterior</div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="mt-8">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-4">Segmentación de Clientes (último mes)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/60 rounded-lg">
                      <h5 className="font-medium mb-3 text-gray-800 dark:text-gray-200">Por Frecuencia</h5>
                      <div className="space-y-2">
                        {segmentacion.frecuencia.map(f=> (
                          <div key={f.label} className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">{f.label}</span>
                            <span className="font-medium text-gray-800 dark:text-gray-200">{f.porcentaje}%</span>
                          </div>
                        ))}
                        {!segmentacion.frecuencia.length && <div className="text-sm text-gray-500 dark:text-gray-400">Sin datos.</div>}
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/60 rounded-lg">
                      <h5 className="font-medium mb-3 text-gray-800 dark:text-gray-200">Por Ticket Promedio</h5>
                      <div className="space-y-2">
                        {segmentacion.ticket.map(t=> (
                          <div key={t.label} className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">{t.label}</span>
                            <span className="font-medium text-gray-800 dark:text-gray-200">{t.porcentaje}%</span>
                          </div>
                        ))}
                        {!segmentacion.ticket.length && <div className="text-sm text-gray-500 dark:text-gray-400">Sin datos.</div>}
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

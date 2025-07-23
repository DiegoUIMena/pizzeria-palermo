"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertTriangle, Package, Plus, Edit, Search, Filter, TrendingDown, CheckCircle } from "lucide-react"

interface Ingrediente {
  id: number
  nombre: string
  categoria: string
  stockActual: number
  stockMinimo: number
  stockMaximo: number
  unidad: string
  precioUnitario: number
  proveedor: string
  fechaVencimiento?: string
  estado: "Disponible" | "Stock Bajo" | "Agotado" | "Vencido"
}

export default function AdminInventario() {
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([])
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas")
  const [filtroEstado, setFiltroEstado] = useState<string>("todos")
  const [busqueda, setBusqueda] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<Ingrediente | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Formulario para nuevo/editar ingrediente
  const [formData, setFormData] = useState({
    nombre: "",
    categoria: "",
    stockActual: 0,
    stockMinimo: 0,
    stockMaximo: 0,
    unidad: "",
    precioUnitario: 0,
    proveedor: "",
    fechaVencimiento: "",
  })

  // Simular carga de inventario
  useEffect(() => {
    setTimeout(() => {
      setIngredientes([
        {
          id: 1,
          nombre: "Queso Mozzarella",
          categoria: "Lácteos",
          stockActual: 2,
          stockMinimo: 5,
          stockMaximo: 20,
          unidad: "kg",
          precioUnitario: 8500,
          proveedor: "Lácteos del Sur",
          fechaVencimiento: "2025-01-20",
          estado: "Stock Bajo",
        },
        {
          id: 2,
          nombre: "Pepperoni",
          categoria: "Carnes",
          stockActual: 1,
          stockMinimo: 3,
          stockMaximo: 15,
          unidad: "kg",
          precioUnitario: 12000,
          proveedor: "Carnes Premium",
          fechaVencimiento: "2025-01-18",
          estado: "Stock Bajo",
        },
        {
          id: 3,
          nombre: "Masa para Pizza",
          categoria: "Harinas",
          stockActual: 8,
          stockMinimo: 15,
          stockMaximo: 50,
          unidad: "unidades",
          precioUnitario: 800,
          proveedor: "Panadería Central",
          estado: "Stock Bajo",
        },
        {
          id: 4,
          nombre: "Salsa de Tomate",
          categoria: "Salsas",
          stockActual: 12,
          stockMinimo: 6,
          stockMaximo: 30,
          unidad: "litros",
          precioUnitario: 2500,
          proveedor: "Conservas del Valle",
          fechaVencimiento: "2025-03-15",
          estado: "Disponible",
        },
        {
          id: 5,
          nombre: "Champiñones",
          categoria: "Vegetales",
          stockActual: 1,
          stockMinimo: 4,
          stockMaximo: 10,
          unidad: "kg",
          precioUnitario: 3200,
          proveedor: "Verduras Frescas",
          fechaVencimiento: "2025-01-15",
          estado: "Stock Bajo",
        },
        {
          id: 6,
          nombre: "Aceitunas Negras",
          categoria: "Vegetales",
          stockActual: 0,
          stockMinimo: 2,
          stockMaximo: 8,
          unidad: "kg",
          precioUnitario: 4500,
          proveedor: "Importadora Mediterránea",
          estado: "Agotado",
        },
        {
          id: 7,
          nombre: "Pimientos Rojos",
          categoria: "Vegetales",
          stockActual: 6,
          stockMinimo: 3,
          stockMaximo: 12,
          unidad: "kg",
          precioUnitario: 2800,
          proveedor: "Verduras Frescas",
          fechaVencimiento: "2025-01-16",
          estado: "Disponible",
        },
        {
          id: 8,
          nombre: "Jamón",
          categoria: "Carnes",
          stockActual: 4,
          stockMinimo: 2,
          stockMaximo: 10,
          unidad: "kg",
          precioUnitario: 9500,
          proveedor: "Carnes Premium",
          fechaVencimiento: "2025-01-22",
          estado: "Disponible",
        },
      ])
      setIsLoading(false)
    }, 1000)
  }, [])

  const categorias = ["Lácteos", "Carnes", "Vegetales", "Harinas", "Salsas", "Bebidas", "Otros"]

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case "Disponible":
        return "bg-green-500"
      case "Stock Bajo":
        return "bg-yellow-500"
      case "Agotado":
        return "bg-red-500"
      case "Vencido":
        return "bg-gray-500"
      default:
        return "bg-gray-500"
    }
  }

  const getEstadoIcon = (estado: string) => {
    switch (estado) {
      case "Disponible":
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case "Stock Bajo":
        return <TrendingDown className="w-4 h-4 text-yellow-500" />
      case "Agotado":
        return <AlertTriangle className="w-4 h-4 text-red-500" />
      case "Vencido":
        return <AlertTriangle className="w-4 h-4 text-gray-500" />
      default:
        return <Package className="w-4 h-4 text-gray-500" />
    }
  }

  const actualizarStock = (id: number, nuevoStock: number) => {
    setIngredientes((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          let nuevoEstado: Ingrediente["estado"] = "Disponible"
          if (nuevoStock === 0) nuevoEstado = "Agotado"
          else if (nuevoStock <= item.stockMinimo) nuevoEstado = "Stock Bajo"

          return { ...item, stockActual: nuevoStock, estado: nuevoEstado }
        }
        return item
      }),
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (editingItem) {
      // Editar ingrediente existente
      setIngredientes((prev) =>
        prev.map((item) =>
          item.id === editingItem.id
            ? {
                ...item,
                ...formData,
                estado:
                  formData.stockActual === 0
                    ? "Agotado"
                    : formData.stockActual <= formData.stockMinimo
                      ? "Stock Bajo"
                      : "Disponible",
              }
            : item,
        ),
      )
    } else {
      // Agregar nuevo ingrediente
      const nuevoIngrediente: Ingrediente = {
        id: Math.max(...ingredientes.map((i) => i.id)) + 1,
        ...formData,
        estado:
          formData.stockActual === 0
            ? "Agotado"
            : formData.stockActual <= formData.stockMinimo
              ? "Stock Bajo"
              : "Disponible",
      }
      setIngredientes((prev) => [...prev, nuevoIngrediente])
    }

    // Reset form
    setFormData({
      nombre: "",
      categoria: "",
      stockActual: 0,
      stockMinimo: 0,
      stockMaximo: 0,
      unidad: "",
      precioUnitario: 0,
      proveedor: "",
      fechaVencimiento: "",
    })
    setEditingItem(null)
    setShowModal(false)
  }

  const openEditModal = (ingrediente: Ingrediente) => {
    setEditingItem(ingrediente)
    setFormData({
      nombre: ingrediente.nombre,
      categoria: ingrediente.categoria,
      stockActual: ingrediente.stockActual,
      stockMinimo: ingrediente.stockMinimo,
      stockMaximo: ingrediente.stockMaximo,
      unidad: ingrediente.unidad,
      precioUnitario: ingrediente.precioUnitario,
      proveedor: ingrediente.proveedor,
      fechaVencimiento: ingrediente.fechaVencimiento || "",
    })
    setShowModal(true)
  }

  const ingredientesFiltrados = ingredientes.filter((ingrediente) => {
    const matchCategoria = filtroCategoria === "todas" || ingrediente.categoria === filtroCategoria
    const matchEstado = filtroEstado === "todos" || ingrediente.estado === filtroEstado
    const matchBusqueda = ingrediente.nombre.toLowerCase().includes(busqueda.toLowerCase())
    return matchCategoria && matchEstado && matchBusqueda
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando inventario...</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">Gestión de Inventario</h1>
              <p className="text-gray-600 dark:text-gray-400">Administra el stock de ingredientes y materias primas</p>
            </div>
            <Button
              onClick={() => {
                setEditingItem(null)
                setFormData({
                  nombre: "",
                  categoria: "",
                  stockActual: 0,
                  stockMinimo: 0,
                  stockMaximo: 0,
                  unidad: "",
                  precioUnitario: 0,
                  proveedor: "",
                  fechaVencimiento: "",
                })
                setShowModal(true)
              }}
              className="bg-pink-600 text-white hover:bg-pink-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Agregar Ingrediente
            </Button>
          </div>
        </div>

        {/* Estadísticas Rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="border-l-4 border-l-green-500 bg-white dark:bg-gray-800 dark:border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Disponibles</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {ingredientes.filter((i) => i.estado === "Disponible").length}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-yellow-500 bg-white dark:bg-gray-800 dark:border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Stock Bajo</p>
                  <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {ingredientes.filter((i) => i.estado === "Stock Bajo").length}
                  </p>
                </div>
                <TrendingDown className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Agotados</p>
                  <p className="text-2xl font-bold text-red-600">
                    {ingredientes.filter((i) => i.estado === "Agotado").length}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Items</p>
                  <p className="text-2xl font-bold text-blue-600">{ingredientes.length}</p>
                </div>
                <Package className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros y Búsqueda */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar ingredientes..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las categorías</SelectItem>
                {categorias.map((categoria) => (
                  <SelectItem key={categoria} value={categoria}>
                    {categoria}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                <SelectItem value="Disponible">Disponible</SelectItem>
                <SelectItem value="Stock Bajo">Stock Bajo</SelectItem>
                <SelectItem value="Agotado">Agotado</SelectItem>
                <SelectItem value="Vencido">Vencido</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Lista de Ingredientes */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ingredientesFiltrados.map((ingrediente) => (
            <Card key={ingrediente.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {getEstadoIcon(ingrediente.estado)}
                    <CardTitle className="text-lg">{ingrediente.nombre}</CardTitle>
                  </div>
                  <Badge className={`${getEstadoColor(ingrediente.estado)} text-white text-xs`}>
                    {ingrediente.estado}
                  </Badge>
                </div>
                <CardDescription>{ingrediente.categoria}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Stock Actual:</span>
                    <div className="flex items-center space-x-2">
                      <Input
                        type="number"
                        value={ingrediente.stockActual}
                        onChange={(e) => actualizarStock(ingrediente.id, Number.parseInt(e.target.value) || 0)}
                        className="w-20 h-8 text-center"
                        min="0"
                      />
                      <span className="text-sm text-gray-500">{ingrediente.unidad}</span>
                    </div>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Mínimo:</span>
                    <span className="font-medium">
                      {ingrediente.stockMinimo} {ingrediente.unidad}
                    </span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Máximo:</span>
                    <span className="font-medium">
                      {ingrediente.stockMaximo} {ingrediente.unidad}
                    </span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Precio:</span>
                    <span className="font-medium">${ingrediente.precioUnitario.toLocaleString()}</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Proveedor:</span>
                    <span className="font-medium text-right">{ingrediente.proveedor}</span>
                  </div>

                  {ingrediente.fechaVencimiento && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Vencimiento:</span>
                      <span className="font-medium">{ingrediente.fechaVencimiento}</span>
                    </div>
                  )}

                  {/* Barra de progreso del stock */}
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Stock</span>
                      <span>{Math.round((ingrediente.stockActual / ingrediente.stockMaximo) * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          ingrediente.stockActual <= ingrediente.stockMinimo
                            ? "bg-red-500"
                            : ingrediente.stockActual <= ingrediente.stockMinimo * 2
                              ? "bg-yellow-500"
                              : "bg-green-500"
                        }`}
                        style={{
                          width: `${Math.min((ingrediente.stockActual / ingrediente.stockMaximo) * 100, 100)}%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  <Button
                    onClick={() => openEditModal(ingrediente)}
                    variant="outline"
                    className="w-full mt-4"
                    size="sm"
                  >
                    <Edit className="w-3 h-3 mr-2" />
                    Editar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {ingredientesFiltrados.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No se encontraron ingredientes</h3>
            <p className="text-gray-500">No hay ingredientes que coincidan con los filtros seleccionados.</p>
          </div>
        )}

        {/* Modal para Agregar/Editar Ingrediente */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingItem ? "Editar Ingrediente" : "Agregar Nuevo Ingrediente"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre</Label>
                  <Input
                    id="nombre"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="categoria">Categoría</Label>
                  <Select
                    value={formData.categoria}
                    onValueChange={(value) => setFormData({ ...formData, categoria: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {categorias.map((categoria) => (
                        <SelectItem key={categoria} value={categoria}>
                          {categoria}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stockActual">Stock Actual</Label>
                  <Input
                    id="stockActual"
                    type="number"
                    value={formData.stockActual}
                    onChange={(e) => setFormData({ ...formData, stockActual: Number.parseInt(e.target.value) || 0 })}
                    min="0"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stockMinimo">Stock Mínimo</Label>
                  <Input
                    id="stockMinimo"
                    type="number"
                    value={formData.stockMinimo}
                    onChange={(e) => setFormData({ ...formData, stockMinimo: Number.parseInt(e.target.value) || 0 })}
                    min="0"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stockMaximo">Stock Máximo</Label>
                  <Input
                    id="stockMaximo"
                    type="number"
                    value={formData.stockMaximo}
                    onChange={(e) => setFormData({ ...formData, stockMaximo: Number.parseInt(e.target.value) || 0 })}
                    min="0"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="unidad">Unidad</Label>
                  <Input
                    id="unidad"
                    value={formData.unidad}
                    onChange={(e) => setFormData({ ...formData, unidad: e.target.value })}
                    placeholder="kg, litros, unidades, etc."
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="precioUnitario">Precio Unitario</Label>
                  <Input
                    id="precioUnitario"
                    type="number"
                    value={formData.precioUnitario}
                    onChange={(e) => setFormData({ ...formData, precioUnitario: Number.parseInt(e.target.value) || 0 })}
                    min="0"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="proveedor">Proveedor</Label>
                  <Input
                    id="proveedor"
                    value={formData.proveedor}
                    onChange={(e) => setFormData({ ...formData, proveedor: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fechaVencimiento">Fecha de Vencimiento (Opcional)</Label>
                  <Input
                    id="fechaVencimiento"
                    type="date"
                    value={formData.fechaVencimiento}
                    onChange={(e) => setFormData({ ...formData, fechaVencimiento: e.target.value })}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-pink-600 text-white hover:bg-pink-700">
                  {editingItem ? "Actualizar" : "Agregar"} Ingrediente
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}

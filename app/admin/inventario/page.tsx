"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { listenIngredientes, addIngrediente, updateIngrediente, deleteIngrediente, type Ingrediente as IngredienteFS, computeEstado } from '@/lib/inventory'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertTriangle, Package, Plus, Edit, Search, Filter, TrendingDown, CheckCircle } from "lucide-react"

// Se utilizará la interfaz IngredienteFS desde Firestore.

export default function AdminInventario() {
  const [ingredientes, setIngredientes] = useState<IngredienteFS[]>([])
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas")
  const [filtroEstado, setFiltroEstado] = useState<string>("todos")
  const [busqueda, setBusqueda] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<IngredienteFS | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [fuente, setFuente] = useState<'ingredientes' | 'inventory'>('ingredientes')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const { toast } = useToast()

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

  // Suscripción en tiempo real Firestore
  useEffect(() => {
    const unsubscribe = listenIngredientes((items, f) => {
      setFuente(f)
      setIngredientes(items.map(i => ({ ...i, estado: computeEstado(i) })))
      setIsLoading(false)
    })
    return () => unsubscribe()
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

  const actualizarStock = async (id: string, nuevoStock: number) => {
    const item = ingredientes.find(i => i.id === id)
    if (!item) return
    await updateIngrediente(id, { stockActual: nuevoStock, estado: computeEstado({ stockActual: nuevoStock, stockMinimo: item.stockMinimo, fechaVencimiento: item.fechaVencimiento }) })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      if (editingItem) {
        console.log('Actualizando ingrediente', editingItem.id, formData)
        await updateIngrediente(editingItem.id, { ...formData, fechaVencimiento: formData.fechaVencimiento || undefined })
      } else {
        console.log('Creando ingrediente', formData)
        await addIngrediente({
          nombre: formData.nombre,
          categoria: formData.categoria,
          stockActual: formData.stockActual,
          stockMinimo: formData.stockMinimo,
          stockMaximo: formData.stockMaximo,
          unidad: formData.unidad,
          precioUnitario: formData.precioUnitario,
          proveedor: formData.proveedor,
          fechaVencimiento: formData.fechaVencimiento || undefined,
        })
  setShowSuccess(true)
      }
      toast({ title: editingItem ? 'Ingrediente actualizado' : 'Ingrediente agregado', description: formData.nombre })
    } catch (err: any) {
      console.error('Error guardando ingrediente', err)
      toast({ title: 'Error', description: err?.message || 'No se pudo guardar', variant: 'destructive' })
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

  const openEditModal = (ingrediente: IngredienteFS) => {
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
            <div className='flex items-center gap-3'>
              <Badge variant='outline' className='text-xs'>Fuente: {fuente}</Badge>
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
                {editingItem && (
                  <Button
                    type="button"
                    variant="outline"
                    className="border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                    onClick={() => {
                      setPendingDeleteId(editingItem.id)
                      setShowDeleteConfirm(true)
                    }}
                  >
                    Eliminar
                  </Button>
                )}
                <div className="ml-auto flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="bg-pink-600 text-white hover:bg-pink-700">
                    {editingItem ? "Actualizar" : "Agregar"} Ingrediente
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        {/* Confirmación de eliminación */}
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Eliminar ingrediente</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              ¿Seguro que deseas eliminar <span className="font-semibold">{editingItem?.nombre}</span>? Esta acción no se puede deshacer.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancelar</Button>
              <Button
                className="bg-red-600 text-white hover:bg-red-700"
                onClick={async () => {
                  if (pendingDeleteId) {
                    try {
                      await deleteIngrediente(pendingDeleteId)
                      toast({ title: 'Ingrediente eliminado', description: editingItem?.nombre })
                    } catch (e: any) {
                      console.error('Error eliminando ingrediente', e)
                      toast({ title: 'Error al eliminar', description: e?.message || 'Intenta nuevamente', variant: 'destructive' })
                    }
                  }
                  setShowDeleteConfirm(false)
                  setShowModal(false)
                  setEditingItem(null)
                  setPendingDeleteId(null)
                }}
              >
                Eliminar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Modal de éxito al agregar */}
        <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Ingrediente agregado</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-600 dark:text-gray-300">Se agregó correctamente el ingrediente <span className="font-semibold">{formData.nombre || ''}</span>.</p>
            <DialogFooter>
              <Button onClick={() => setShowSuccess(false)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}

"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { listenIngredientes, addIngrediente, updateIngrediente, deleteIngrediente, type Ingrediente as IngredienteFS, computeEstado } from '@/lib/inventory'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertTriangle, Package, Plus, Edit, Search, Filter, TrendingDown, CheckCircle, Trash2 } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/hooks/use-toast"
import RecipeEditor from "./RecipeEditor"
import AddPizzaModal from "./AddPizzaModal"
import { useFirestorePizzaConfig } from '@/hooks/useFirestorePizzaConfig'
import { getAgregadosConfig, saveAgregadosConfig } from "@/lib/agregados-config"
import { db } from "@/lib/firebase"
import { doc, updateDoc } from "firebase/firestore"

// Se utilizará la interfaz IngredienteFS desde Firestore.

export default function AdminInventario() {
  const [ingredientes, setIngredientes] = useState<IngredienteFS[]>([])
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas")
  const [filtroEstado, setFiltroEstado] = useState<string>("todos")
  const [busqueda, setBusqueda] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<IngredienteFS | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<IngredienteFS | null>(null)
  const [showAddedModal, setShowAddedModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showRecipeEditor, setShowRecipeEditor] = useState(false)
  const [showAddPizzaModal, setShowAddPizzaModal] = useState(false)
  const [deletePizzaTarget, setDeletePizzaTarget] = useState<{ id: string; nombre: string } | null>(null)
  const [editorInitialPizza, setEditorInitialPizza] = useState<string | null>(null)
  const [rollitosPackStock, setRollitosPackStock] = useState(99)
  const [gauchitosDisponible, setGauchitosDisponible] = useState(true)
  const [loadingAgregados, setLoadingAgregados] = useState(true)
  const [savingAgregados, setSavingAgregados] = useState(false)
  const [salsasDisponibles, setSalsasDisponibles] = useState({
    ajo: true,
    chimichurri: true,
    bbq: true,
    pesto: true,
  })
  const { itemsMenu: pizzasFromHook = [], refreshData } = useFirestorePizzaConfig()

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
    const unsubscribe = listenIngredientes(items => {
      setIngredientes(items.map(i => ({ ...i, estado: computeEstado(i) })))
      setIsLoading(false)
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    let mounted = true

    const loadAgregadosConfig = async () => {
      try {
        setLoadingAgregados(true)
        const config = await getAgregadosConfig()

        if (!mounted) return

        setRollitosPackStock(config.rollitosPackStock)
        setGauchitosDisponible(config.gauchitosDisponible)
        setSalsasDisponibles(config.salsasDisponibles)
      } catch (error) {
        console.error("Error cargando configuración de agregados:", error)
        toast({
          title: "Error",
          description: "No se pudo cargar la configuración de agregados.",
          variant: "destructive",
        })
      } finally {
        if (mounted) {
          setLoadingAgregados(false)
        }
      }
    }

    loadAgregadosConfig()

    return () => {
      mounted = false
    }
  }, [])

  const handleSaveAgregadosConfig = async () => {
    try {
      setSavingAgregados(true)
      await saveAgregadosConfig({
        rollitosPackStock: Math.max(0, Math.floor(rollitosPackStock || 0)),
        gauchitosDisponible,
        salsasDisponibles,
      })

      toast({
        title: "Configuración guardada",
        description: "Los agregados se actualizaron correctamente.",
      })
    } catch (error) {
      console.error("Error guardando configuración de agregados:", error)
      toast({
        title: "Error",
        description: "No se pudo guardar la configuración de agregados.",
        variant: "destructive",
      })
    } finally {
      setSavingAgregados(false)
    }
  }

  const handleGauchitosToggle = async (checked: boolean) => {
    setGauchitosDisponible(checked)

    try {
      await saveAgregadosConfig({
        rollitosPackStock: Math.max(0, Math.floor(rollitosPackStock || 0)),
        gauchitosDisponible: checked,
        salsasDisponibles,
      })
    } catch (error) {
      console.error("Error guardando disponibilidad de Gauchitos:", error)
      toast({
        title: "Error",
        description: "No se pudo guardar la disponibilidad de Gauchitos.",
        variant: "destructive",
      })
    }
  }

  const handleSalsaToggle = async (
    key: keyof typeof salsasDisponibles,
    checked: boolean
  ) => {
    const nextSalsas = {
      ...salsasDisponibles,
      [key]: checked,
    }

    setSalsasDisponibles(nextSalsas)

    try {
      await saveAgregadosConfig({
        rollitosPackStock: Math.max(0, Math.floor(rollitosPackStock || 0)),
        gauchitosDisponible,
        salsasDisponibles: nextSalsas,
      })
    } catch (error) {
      console.error("Error guardando disponibilidad de salsas:", error)
      toast({
        title: "Error",
        description: "No se pudo guardar la disponibilidad de la salsa.",
        variant: "destructive",
      })
    }
  }

  const handleRollitosStockBlur = async () => {
    const safeStock = Math.max(0, Math.floor(rollitosPackStock || 0))

    if (safeStock !== rollitosPackStock) {
      setRollitosPackStock(safeStock)
    }

    try {
      await saveAgregadosConfig({
        rollitosPackStock: safeStock,
        gauchitosDisponible,
        salsasDisponibles,
      })
    } catch (error) {
      console.error("Error guardando stock de Rollitos:", error)
      toast({
        title: "Error",
        description: "No se pudo guardar el stock de Rollitos.",
        variant: "destructive",
      })
    }
  }

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

  const eliminarIngrediente = async (id: string) => {
    try {
      await deleteIngrediente(id)
    } catch (e) {
      console.error('Error eliminando ingrediente', e)
    }
  }

  const eliminarPizza = async (id: string) => {
    try {
      const db = (await import('@/lib/firebase')).db
      const { doc, deleteDoc } = await import('firebase/firestore')
      await deleteDoc(doc(db, 'items_menu', id))
      refreshData()
    } catch (e) {
      console.error('Error eliminando pizza', e)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      if (editingItem) {
        await updateIngrediente(editingItem.id, { ...formData, estado: computeEstado({ stockActual: formData.stockActual, stockMinimo: formData.stockMinimo, fechaVencimiento: formData.fechaVencimiento }) })
      } else {
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
        setShowAddedModal(true)
      }
    } catch (err) {
      console.error('Error guardando ingrediente', err)
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
    setSaving(false)
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
              <div className="ml-4">
                <Button 
                  onClick={() => setShowAddPizzaModal(true)} 
                  className="bg-blue-600 text-white hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar Pizza
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

        {/* Lista de Ingredientes (vista compacta con detalles expandibles) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ingredientesFiltrados.map(ing => {
            const isOpen = expanded.has(ing.id)
            const toggle = () => {
              setExpanded(prev => {
                const next = new Set(prev)
                if (next.has(ing.id)) next.delete(ing.id); else next.add(ing.id)
                return next
              })
            }
            const pct = ing.stockMaximo > 0 ? Math.min((ing.stockActual / ing.stockMaximo) * 100, 100) : 0
            // Color coherente con el porcentaje: verde > 50%, amarillo 20-50%, rojo < 20%
            const barColor = pct === 0 ? 'bg-red-600' : pct < 20 ? 'bg-red-500' : pct <= 50 ? 'bg-yellow-500' : 'bg-green-500'
            return (
              <Card key={ing.id} className="group border border-gray-200 dark:border-gray-700 hover:shadow-sm transition-all">
                <CardHeader className="py-3 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {getEstadoIcon(ing.estado)}
                        <CardTitle className="text-sm truncate font-semibold">{ing.nombre}</CardTitle>
                        <Badge className={`ml-auto ${getEstadoColor(ing.estado)} text-white text-[10px] px-2 py-0.5 tracking-wide`}>{ing.estado}</Badge>
                      </div>
                      <div className="mt-2">
                        <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400 mb-1 font-medium">
                          <span>{ing.stockActual}{ing.unidad && ' ' + ing.unidad}</span>
                          <span>{Math.round(pct)}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                          <div className={`h-2 ${barColor} transition-all`} style={{ width: pct + '%' }} />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex gap-1">
                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => openEditModal(ing)} title="Editar">
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={toggle} className="text-[10px] h-6 px-2">
                          {isOpen ? 'Ocultar' : 'Detalles'}
                        </Button>
                      </div>
                      {/* Botón de eliminar debajo de "Detalles" */}
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-6 w-6 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950" 
                        onClick={() => setDeleteTarget(ing)}
                        title="Eliminar ingrediente"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {isOpen && (
                  <CardContent className="pt-0 pb-3">
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="space-y-1">
                        <p className="text-gray-500 dark:text-gray-400">Categoría</p>
                        <p className="font-medium">{ing.categoria}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-gray-500 dark:text-gray-400">Proveedor</p>
                        <p className="font-medium truncate" title={ing.proveedor}>{ing.proveedor}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-gray-500 dark:text-gray-400">Mín / Máx</p>
                        <p className="font-medium">{ing.stockMinimo} / {ing.stockMaximo} {ing.unidad}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-gray-500 dark:text-gray-400">Precio Unit.</p>
                        <p className="font-medium">${ing.precioUnitario.toLocaleString()}</p>
                      </div>
                      {ing.fechaVencimiento && (
                        <div className="space-y-1 col-span-2">
                          <p className="text-gray-500 dark:text-gray-400">Vencimiento</p>
                          <p className="font-medium">{ing.fechaVencimiento}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })}
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
              <DialogDescription className="sr-only">
                Formulario para {editingItem ? 'editar' : 'agregar'} ingrediente en Firestore. Completa los campos requeridos y guarda los cambios.
              </DialogDescription>
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
                <Button disabled={saving} type="submit" className="bg-pink-600 text-white hover:bg-pink-700 disabled:opacity-60">
                  {saving ? 'Guardando...' : editingItem ? "Actualizar" : "Agregar"} Ingrediente
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal Confirmación Eliminación */}
        <Dialog open={!!deleteTarget} onOpenChange={(open) => { if(!open) setDeleteTarget(null) }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Eliminar Ingrediente</DialogTitle>
              <DialogDescription>
                Esta acción eliminará permanentemente el ingrediente {deleteTarget?.nombre}. No se puede deshacer.
              </DialogDescription>
            </DialogHeader>
            <div className="text-sm text-gray-600 dark:text-gray-300">
              ¿Confirmas que deseas eliminarlo?
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={async () => { if(deleteTarget){ await eliminarIngrediente(deleteTarget.id); setDeleteTarget(null) } }}>Eliminar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal Éxito Agregado */}
        <Dialog open={showAddedModal} onOpenChange={(open) => setShowAddedModal(open)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Ingrediente Agregado</DialogTitle>
              <DialogDescription>
                El nuevo ingrediente se guardó correctamente en la base de datos.
              </DialogDescription>
            </DialogHeader>
            <div className="text-sm text-gray-600 dark:text-gray-300">
              Ahora puedes editarlo, agregar otro o cerrar esta ventana.
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={() => { setShowAddedModal(false); setShowModal(true) }}>Agregar Otro</Button>
              <Button onClick={() => setShowAddedModal(false)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal Confirmación Eliminación Pizza */}
        <Dialog open={!!deletePizzaTarget} onOpenChange={(open) => { if(!open) setDeletePizzaTarget(null) }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Eliminar Pizza</DialogTitle>
              <DialogDescription>
                Esta acción eliminará permanentemente la pizza {deletePizzaTarget?.nombre}. No se puede deshacer.
              </DialogDescription>
            </DialogHeader>
            <div className="text-sm text-gray-600 dark:text-gray-300">
              ¿Confirmas que deseas eliminarla?
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={() => setDeletePizzaTarget(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={async () => { 
                if(deletePizzaTarget){ 
                  await eliminarPizza(deletePizzaTarget.id); 
                  setDeletePizzaTarget(null) 
                } 
              }}>Eliminar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
      {/* Lista de pizzas y acceso a sus recetas */}
      <div className="container mx-auto px-4 py-8">
        <h2 className="text-2xl font-semibold mb-4">Agregados</h2>
        <Card className="mb-8 border border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle>Configuración de Agregados</CardTitle>
            <CardDescription>
              Define stock de Rollitos de Canela (packs) y disponibilidad de Gauchitos para habilitar su compra en el carrito.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {loadingAgregados ? (
              <p className="text-sm text-gray-500">Cargando configuración...</p>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border rounded p-4 flex items-center gap-3 bg-white dark:bg-gray-900">
                    <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200 dark:border-gray-700">
                      <img
                        src="/pizzas/canela.jpg"
                        alt="Rollitos de Canela"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = "/placeholder.svg"
                        }}
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="rollitosPackStock">Rollitos de Canela - Packs disponibles</Label>
                      <Input
                        id="rollitosPackStock"
                        type="number"
                        min="0"
                        value={rollitosPackStock}
                        onChange={(e) => setRollitosPackStock(Number.parseInt(e.target.value) || 0)}
                        onBlur={handleRollitosStockBlur}
                      />
                    </div>
                  </div>

                  <div className="border rounded p-4 flex items-center gap-3 bg-white dark:bg-gray-900">
                    <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200 dark:border-gray-700">
                      <img
                        src="/pizzas/gauchitos.jpg"
                        alt="Gauchitos"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = "/placeholder.svg"
                        }}
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="gauchitosDisponible">Gauchitos</Label>
                      <div className="h-10 px-3 border rounded-md flex items-center justify-between">
                        <span className={`text-sm font-medium ${gauchitosDisponible ? 'text-green-600' : 'text-red-600'}`}>
                          {gauchitosDisponible ? 'Disponible' : 'Sin Stock'}
                        </span>
                        <Switch
                          id="gauchitosDisponible"
                          checked={gauchitosDisponible}
                          onCheckedChange={handleGauchitosToggle}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border rounded p-4 flex items-center gap-3 bg-white dark:bg-gray-900">
                    <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200 dark:border-gray-700">
                      <img
                        src="/pizzas/salsa de ajo.jpg"
                        alt="Salsa de Ajo"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = "/placeholder.svg"
                        }}
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="salsaAjoDisponible">Salsa de Ajo</Label>
                      <div className="h-10 px-3 border rounded-md flex items-center justify-between">
                        <span className={`text-sm font-medium ${salsasDisponibles.ajo ? 'text-green-600' : 'text-red-600'}`}>
                          {salsasDisponibles.ajo ? 'Disponible' : 'Sin Stock'}
                        </span>
                        <Switch
                          id="salsaAjoDisponible"
                          checked={salsasDisponibles.ajo}
                          onCheckedChange={(checked) => handleSalsaToggle("ajo", checked)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border rounded p-4 flex items-center gap-3 bg-white dark:bg-gray-900">
                    <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200 dark:border-gray-700">
                      <img
                        src="/pizzas/salsa chimichurri.jpg"
                        alt="Salsa Chimichurri"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = "/placeholder.svg"
                        }}
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="salsaChimichurriDisponible">Salsa Chimichurri</Label>
                      <div className="h-10 px-3 border rounded-md flex items-center justify-between">
                        <span className={`text-sm font-medium ${salsasDisponibles.chimichurri ? 'text-green-600' : 'text-red-600'}`}>
                          {salsasDisponibles.chimichurri ? 'Disponible' : 'Sin Stock'}
                        </span>
                        <Switch
                          id="salsaChimichurriDisponible"
                          checked={salsasDisponibles.chimichurri}
                          onCheckedChange={(checked) => handleSalsaToggle("chimichurri", checked)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border rounded p-4 flex items-center gap-3 bg-white dark:bg-gray-900">
                    <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200 dark:border-gray-700">
                      <img
                        src="/pizzas/salsa bbq.jpg"
                        alt="Salsa BBQ"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = "/placeholder.svg"
                        }}
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="salsaBBQDisponible">Salsa BBQ</Label>
                      <div className="h-10 px-3 border rounded-md flex items-center justify-between">
                        <span className={`text-sm font-medium ${salsasDisponibles.bbq ? 'text-green-600' : 'text-red-600'}`}>
                          {salsasDisponibles.bbq ? 'Disponible' : 'Sin Stock'}
                        </span>
                        <Switch
                          id="salsaBBQDisponible"
                          checked={salsasDisponibles.bbq}
                          onCheckedChange={(checked) => handleSalsaToggle("bbq", checked)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border rounded p-4 flex items-center gap-3 bg-white dark:bg-gray-900">
                    <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200 dark:border-gray-700">
                      <img
                        src="/pizzas/salsa pesto.jpg"
                        alt="Salsa Pesto"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = "/placeholder.svg"
                        }}
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="salsaPestoDisponible">Salsa Pesto</Label>
                      <div className="h-10 px-3 border rounded-md flex items-center justify-between">
                        <span className={`text-sm font-medium ${salsasDisponibles.pesto ? 'text-green-600' : 'text-red-600'}`}>
                          {salsasDisponibles.pesto ? 'Disponible' : 'Sin Stock'}
                        </span>
                        <Switch
                          id="salsaPestoDisponible"
                          checked={salsasDisponibles.pesto}
                          onCheckedChange={(checked) => handleSalsaToggle("pesto", checked)}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    type="button"
                    onClick={handleSaveAgregadosConfig}
                    className="bg-pink-600 text-white hover:bg-pink-700"
                    disabled={savingAgregados}
                  >
                    {savingAgregados ? "Guardando..." : "Guardar Agregados"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <h2 className="text-2xl font-semibold mb-4">Recetas de Pizzas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(() => {
            const excludeNames = [
              "Gauchitos",
              "Salsa de Ajo",
              "Rollitos de canela",
              "Coca Cola Lata 350cc",
              "Salsa Chimichurri",
              "Coca Cola 1.5 Litro",
              "Salsa BBQ",
              "Lipton Lata",
              "Lipton Botella",
              "Salsa Pesto",
            ].map(n => n.toLowerCase().trim())

            return pizzasFromHook
              .filter((p: any) => !excludeNames.includes((p.nombre || "").toLowerCase().trim()))
              .map((p: any) => (
                <div key={p.id} className="border rounded p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Imagen de la pizza */}
                    {p.imagen && (
                      <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                        <img 
                          src={p.imagen} 
                          alt={p.nombre}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = "/placeholder.svg";
                          }}
                        />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <p className="font-medium">
                          {p.nombre}
                        {p.nombre === "4 Estaciones" || p.nombre === "Sevillana" || p.nombre === "Entre Ríos" ? (
                          <span className="ml-2 text-xs bg-yellow-200 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded-full">
                            Solo Familiar
                          </span>
                        ) : null}
                      </p>
                      <div className="flex items-center gap-2">
                        <Switch 
                          checked={p.activo !== false}
                          onCheckedChange={async (checked) => {
                            try {
                              await updateDoc(doc(db, 'items_menu', p.id), { activo: checked })
                              toast({
                                title: checked ? "Pizza activada" : "Pizza desactivada",
                                description: `${p.nombre} ${checked ? 'ahora es visible' : 'ya no es visible'} en el menú del cliente`,
                                variant: "default"
                              })
                              refreshData()
                            } catch (error) {
                              console.error('Error al actualizar estado:', error)
                              toast({
                                title: "Error",
                                description: "No se pudo actualizar el estado de la pizza",
                                variant: "destructive"
                              })
                            }
                          }}
                        />
                        <span className={`text-xs font-medium ${
                          p.activo !== false 
                            ? 'text-green-600 dark:text-green-400' 
                            : 'text-gray-400 dark:text-gray-500'
                        }`}>
                          {p.activo !== false ? 'Visible' : 'Oculta'}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs space-x-2">
                      {p.receta && Array.isArray(p.receta) && p.receta.length > 0 ? (
                        <span className="text-green-600 dark:text-green-400">Receta familiar: {p.receta.length} ingredientes</span>
                      ) : (
                        <span className="text-gray-400">Sin receta familiar</span>
                      )}
                      {p.nombre !== "4 Estaciones" && p.nombre !== "Sevillana" && p.nombre !== "Entre Ríos" && (
                        <>
                          {p.recetaMediana && Array.isArray(p.recetaMediana) && p.recetaMediana.length > 0 ? (
                            <span className="text-blue-600 dark:text-blue-400">Receta mediana: {p.recetaMediana.length} ingredientes</span>
                          ) : (
                            <span className="text-gray-400">Sin receta mediana</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => { setEditorInitialPizza(p.id); setShowRecipeEditor(true) }}>Editar receta</Button>
                    <Button 
                      size="icon" 
                      variant="ghost"
                      className="h-9 w-9 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                      onClick={() => setDeletePizzaTarget({ id: p.id, nombre: p.nombre })}
                      title="Eliminar pizza"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
          })()}
        </div>
      </div>
      <RecipeEditor 
        open={showRecipeEditor} 
        onOpenChange={(open) => { 
          setShowRecipeEditor(open); 
          // Si se cierra el editor, limpiar la pizza seleccionada y actualizar datos
          if(!open) {
            setEditorInitialPizza(null);
            // Forzar actualización de datos cuando se cierra el editor
            console.log("Cerrando editor de recetas, actualizando datos...", Date.now());
            
            // Actualizamos los datos inmediatamente
            refreshData();
            
            // Y programamos otra actualización después de un breve momento
            // para asegurarnos de que los cambios se reflejen
            setTimeout(() => {
              console.log("Actualizando datos nuevamente después del cierre del editor", Date.now());
              refreshData();
            }, 500);
          }
        }} 
        initialPizzaId={editorInitialPizza} 
      />
      <AddPizzaModal
        open={showAddPizzaModal}
        onOpenChange={setShowAddPizzaModal}
        onSuccess={() => {
          // Actualizar lista de pizzas después de agregar una nueva
          refreshData();
          setTimeout(() => {
            refreshData();
          }, 500);
        }}
      />
    </div>
  )
}

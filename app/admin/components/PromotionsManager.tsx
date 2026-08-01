"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Edit, Trash2, Loader2, Image as ImageIcon, Sparkles, Check, X, Upload } from "lucide-react"
import { db, storage } from "@/lib/firebase"
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDoc, setDoc } from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { toast } from "@/hooks/use-toast"
import { useFirestorePizzaConfig } from "@/hooks/useFirestorePizzaConfig"
import { listenIngredientes } from "@/lib/inventory"
import { getAgregadosConfig } from "@/lib/agregados-config"

interface PromoProduct {
  productoId: string
  nombre: string
  categoria: string
  cantidad: number
  size?: string
  variant?: string
}

interface Promo {
  id: string
  nombre: string
  descripcion: string
  imagen: string
  precio: number
  activa: boolean
  productos: PromoProduct[]
  createdAt?: any
  updatedAt?: any
}

export default function PromotionsManager() {
  const [promos, setPromos] = useState<Promo[]>([])
  const [promosEnabled, setPromosEnabled] = useState(false)
  const [loadingPromos, setLoadingPromos] = useState(true)
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingPromo, setEditingPromo] = useState<Promo | null>(null)
  
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  
  // Formulario
  const [nombre, setNombre] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [precio, setPrecio] = useState(0)
  const [activa, setActiva] = useState(true)
  const [selectedProducts, setSelectedProducts] = useState<Record<string, { cantidad: number; checked: boolean }>>({})
  
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  // Configuración de productos e inventario
  const { itemsMenu = [] } = useFirestorePizzaConfig()
  const [ingredients, setIngredients] = useState<any[]>([])
  const [agregadosConfig, setAgregadosConfig] = useState<any>(null)

  // Escuchar promociones y configuración
  useEffect(() => {
    const unsubPromos = onSnapshot(collection(db, "promos"), (snapshot) => {
      const fetched = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Promo[]
      setPromos(fetched)
      setLoadingPromos(false)
    }, (error) => {
      console.error("Error al cargar promociones:", error)
      setLoadingPromos(false)
    })

    const loadConfig = async () => {
      try {
        const configDoc = await getDoc(doc(db, "settings", "promos_config"))
        if (configDoc.exists()) {
          setPromosEnabled(configDoc.data().promosEnabled || false)
        }
      } catch (error) {
        console.error("Error al cargar promos_config:", error)
      } finally {
        setLoadingConfig(false)
      }
    }

    loadConfig()

    const unsubIngredients = listenIngredientes((items) => {
      setIngredients(items)
    })

    getAgregadosConfig().then(setAgregadosConfig).catch(console.error)

    return () => {
      unsubPromos()
      unsubIngredients()
    }
  }, [])

  // Guardar configuración global
  const handleTogglePromosEnabled = async (checked: boolean) => {
    try {
      setPromosEnabled(checked)
      await setDoc(doc(db, "settings", "promos_config"), { promosEnabled: checked }, { merge: true })
      toast({
        title: checked ? "Promos activadas en la web" : "Promos desactivadas en la web",
        description: `El botón de Promos ahora ${checked ? 'está' : 'no está'} visible para los clientes.`
      })
    } catch (error) {
      console.error("Error al guardar promos_config:", error)
      toast({
        title: "Error",
        description: "No se pudo actualizar la configuración.",
        variant: "destructive"
      })
    }
  }

  // Generar listado plano de productos seleccionables
  const getSelectableItems = () => {
    const selectable: any[] = []
    itemsMenu.forEach((item: any) => {
      const category = (item.categoria || "").toLowerCase()
      const isPizza = category.includes("pizza") || item.clasificacion
      const isBebida = category.includes("bebid")
      const isAgregado = category.includes("acompañ") || category.includes("agregad") || category.includes("snack")

      if (isPizza) {
        if (item.tieneFamiliar !== false) {
          selectable.push({
            id: item.id,
            nombre: `${item.nombre} (Familiar)`,
            nombreBase: item.nombre,
            precio: item.precioFamiliar || 0,
            categoria: "Pizzas",
            size: "familiar",
            key: `${item.id}_familiar`,
            imagen: item.imagen,
          })
        }
        if (item.tieneMediana === true) {
          selectable.push({
            id: item.id,
            nombre: `${item.nombre} (Mediana)`,
            nombreBase: item.nombre,
            precio: item.precioMediana || 0,
            categoria: "Pizzas",
            size: "mediana",
            key: `${item.id}_mediana`,
            imagen: item.imagen,
          })
        }
      } else if (isBebida) {
        const variants = item.variants || item.variantes || []
        if (variants.length > 0) {
          variants.forEach((v: string) => {
            selectable.push({
              id: item.id,
              nombre: `${item.nombre} (${v === "Zero" ? "Zero" : "Tradicional"})`,
              nombreBase: item.nombre,
              precio: item.precio || 0,
              categoria: "Bebidas",
              variant: v,
              key: `${item.id}_${v}`,
              imagen: item.imagen,
            })
          })
        } else {
          selectable.push({
            id: item.id,
            nombre: item.nombre,
            nombreBase: item.nombre,
            precio: item.precio || 0,
            categoria: "Bebidas",
            key: `${item.id}_default`,
            imagen: item.imagen,
          })
        }
      } else if (isAgregado) {
        selectable.push({
          id: item.id,
          nombre: item.nombre,
          nombreBase: item.nombre,
          precio: item.precio || 0,
          categoria: "Agregados",
          key: `${item.id}`,
          imagen: item.imagen,
        })
      }
    })
    return selectable
  }

  // Calcular stock disponible para cada producto seleccionable
  const ingredientsById = ingredients.reduce((acc, ing) => {
    acc[ing.id] = ing
    return acc
  }, {} as Record<string, any>)

  const getPizzaStock = (item: any) => {
    const matched = itemsMenu.find((i: any) => i.id === item.id)
    if (!matched) return 0
    const recipe = item.size === "mediana" ? (matched.recetaMediana || matched.receta) : matched.receta
    if (!recipe || recipe.length === 0) return 99

    let minStock = Infinity
    recipe.forEach((r: any) => {
      const ing = ingredientsById[r.ingredienteId]
      if (!ing) {
        minStock = 0
      } else {
        const stockVal = Number(ing.stockActual || 0)
        const neededVal = Number(r.cantidad || 1)
        const possible = Math.floor(stockVal / neededVal)
        if (possible < minStock) minStock = possible
      }
    })
    return minStock === Infinity ? 99 : minStock
  }

  const getItemStock = (sItem: any) => {
    if (sItem.categoria === "Pizzas") {
      return getPizzaStock(sItem)
    }
    const nameLower = sItem.nombre.toLowerCase()
    if (nameLower.includes("rollito") || nameLower.includes("canela")) {
      return agregadosConfig?.rollitosPackStock ?? 0
    }
    if (nameLower.includes("gauchito")) {
      return agregadosConfig?.gauchitosDisponible ? 99 : 0
    }
    if (sItem.categoria === "Bebidas" && agregadosConfig?.bebidasDisponibles) {
      if (nameLower.includes("lipton") && nameLower.includes("botella")) {
        return agregadosConfig.bebidasDisponibles.liptonBotella ? 99 : 0
      }
      if (nameLower.includes("lipton") && nameLower.includes("lata")) {
        return agregadosConfig.bebidasDisponibles.liptonLata ? 99 : 0
      }
      if (nameLower.includes("coca") && nameLower.includes("1.5") && nameLower.includes("zero")) {
        return agregadosConfig.bebidasDisponibles.cocaBotellaZero ? 99 : 0
      }
      if (nameLower.includes("coca") && nameLower.includes("1.5")) {
        return agregadosConfig.bebidasDisponibles.cocaBotellaTradicional ? 99 : 0
      }
      if (nameLower.includes("coca") && nameLower.includes("lata") && nameLower.includes("zero")) {
        return agregadosConfig.bebidasDisponibles.cocaLataZero ? 99 : 0
      }
      if (nameLower.includes("coca") && nameLower.includes("lata")) {
        return agregadosConfig.bebidasDisponibles.cocaLataTradicional ? 99 : 0
      }
    }
    if (sItem.categoria === "Agregados" && nameLower.includes("salsa") && agregadosConfig?.salsasDisponibles) {
      if (nameLower.includes("ajo")) return agregadosConfig.salsasDisponibles.ajo ? 99 : 0
      if (nameLower.includes("chimichurri")) return agregadosConfig.salsasDisponibles.chimichurri ? 99 : 0
      if (nameLower.includes("bbq")) return agregadosConfig.salsasDisponibles.bbq ? 99 : 0
      if (nameLower.includes("pesto")) return agregadosConfig.salsasDisponibles.pesto ? 99 : 0
    }
    return 99
  }

  // Previsualización y subida de imágenes
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setSelectedImage(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  // Abrir modal de creación
  const handleOpenCreateModal = () => {
    setEditingPromo(null)
    setNombre("")
    setDescripcion("")
    setPrecio(0)
    setActiva(true)
    setSelectedProducts({})
    setSelectedImage(null)
    setImagePreview(null)
    setShowModal(true)
  }

  // Abrir modal de edición
  const handleOpenEditModal = (promo: Promo) => {
    setEditingPromo(promo)
    setNombre(promo.nombre)
    setDescripcion(promo.descripcion || "")
    setPrecio(promo.precio)
    setActiva(promo.activa)
    
    // Mapear productos seleccionados
    const initialSelection: Record<string, { cantidad: number; checked: boolean }> = {}
    const selectable = getSelectableItems()
    
    promo.productos.forEach(p => {
      // Intentar encontrar el key correcto
      const match = selectable.find(s => 
        s.id === p.productoId && 
        (p.size ? s.size === p.size : true) && 
        (p.variant ? s.variant === p.variant : true)
      )
      if (match) {
        initialSelection[match.key] = { cantidad: p.cantidad, checked: true }
      }
    })
    
    setSelectedProducts(initialSelection)
    setSelectedImage(null)
    setImagePreview(promo.imagen)
    setShowModal(true)
  }

  // Alternar selección de producto
  const handleToggleProduct = (key: string, checked: boolean) => {
    setSelectedProducts(prev => ({
      ...prev,
      [key]: {
        checked,
        cantidad: prev[key]?.cantidad || 1
      }
    }))
  }

  // Cambiar cantidad de producto
  const handleChangeProductQty = (key: string, qty: number) => {
    setSelectedProducts(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        cantidad: Math.max(1, qty)
      }
    }))
  }

  // Guardar promoción
  const handleSavePromo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre || precio <= 0) {
      toast({
        title: "Campos incompletos",
        description: "El nombre y el precio son requeridos.",
        variant: "destructive"
      })
      return
    }

    const selectable = getSelectableItems()
    const finalProductsList: PromoProduct[] = []

    Object.entries(selectedProducts).forEach(([key, val]) => {
      if (val.checked) {
        const match = selectable.find(s => s.key === key)
        if (match) {
          finalProductsList.push({
            productoId: match.id,
            nombre: match.nombre,
            categoria: match.categoria,
            cantidad: val.cantidad,
            ...(match.size && { size: match.size }),
            ...(match.variant && { variant: match.variant })
          })
        }
      }
    })

    if (finalProductsList.length === 0) {
      toast({
        title: "Sin productos",
        description: "Debes seleccionar al menos un producto para la promoción.",
        variant: "destructive"
      })
      return
    }

    if (!imagePreview) {
      toast({
        title: "Falta imagen",
        description: "Debes cargar una imagen para la promoción.",
        variant: "destructive"
      })
      return
    }

    setSaving(true)
    try {
      let imageUrl = editingPromo ? editingPromo.imagen : ""

      // 1. Subir imagen si se seleccionó un nuevo archivo
      if (selectedImage) {
        setUploading(true)
        const imagePath = `Promociones/promo_${Date.now()}_${selectedImage.name}`
        const storageRef = ref(storage, imagePath)
        await uploadBytes(storageRef, selectedImage)
        imageUrl = await getDownloadURL(storageRef)
        setUploading(false)
      }

      const promoData = {
        nombre,
        descripcion,
        precio,
        activa,
        imagen: imageUrl,
        productos: finalProductsList,
        updatedAt: new Date().toISOString()
      } as any

      if (editingPromo) {
        // Editar
        await updateDoc(doc(db, "promos", editingPromo.id), promoData)
        toast({
          title: "Promoción actualizada",
          description: `La promoción "${nombre}" ha sido modificada correctamente.`
        })
      } else {
        // Crear
        promoData.createdAt = new Date().toISOString()
        await addDoc(collection(db, "promos"), promoData)
        toast({
          title: "Promoción creada",
          description: `La promoción "${nombre}" ha sido guardada.`
        })
      }

      setShowModal(false)
    } catch (error) {
      console.error("Error al guardar promoción:", error)
      toast({
        title: "Error al guardar",
        description: "Ocurrió un problema guardando los datos en la base de datos.",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
      setUploading(false)
    }
  }

  // Eliminar promoción
  const handleDeletePromo = async (id: string, name: string) => {
    if (confirm(`¿Estás seguro de que deseas eliminar permanentemente la promoción "${name}"?`)) {
      try {
        await deleteDoc(doc(db, "promos", id))
        toast({
          title: "Promoción eliminada",
          description: `La promoción "${name}" fue eliminada del sistema.`
        })
      } catch (error) {
        console.error("Error al eliminar promoción:", error)
        toast({
          title: "Error",
          description: "No se pudo eliminar la promoción.",
          variant: "destructive"
        })
      }
    }
  }

  // Alternar estado activa/inactiva rápido
  const handleTogglePromoActive = async (id: string, name: string, currentActive: boolean) => {
    try {
      await updateDoc(doc(db, "promos", id), { activa: !currentActive })
      toast({
        title: !currentActive ? "Promoción activada" : "Promoción desactivada",
        description: `La promoción "${name}" ahora ${!currentActive ? 'está visible' : 'está oculta'} en la web.`
      })
    } catch (error) {
      console.error("Error al cambiar estado:", error)
    }
  }

  const selectableItems = getSelectableItems()
  const pizzas = selectableItems.filter(s => s.categoria === "Pizzas")
  const agregados = selectableItems.filter(s => s.categoria === "Agregados")
  const bebidas = selectableItems.filter(s => s.categoria === "Bebidas")

  return (
    <Card className="shadow-lg border border-gray-200 dark:border-gray-800">
      <CardHeader className="bg-gray-50/50 dark:bg-gray-900/50 flex flex-row items-center justify-between pb-6 flex-wrap gap-4 border-b border-gray-100 dark:border-gray-800">
        <div>
          <CardTitle className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-pink-500" />
            Gestión de Promociones y Combos
          </CardTitle>
          <CardDescription>
            Crea ofertas compuestas combinando pizzas, bebidas y agregados.
          </CardDescription>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
            <Label htmlFor="btn-promos-global" className="text-xs sm:text-sm font-semibold cursor-pointer">
              Botón Promos en Cliente:
            </Label>
            {loadingConfig ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
            ) : (
              <Switch
                id="btn-promos-global"
                checked={promosEnabled}
                onCheckedChange={handleTogglePromosEnabled}
              />
            )}
          </div>
          <Button onClick={handleOpenCreateModal} className="bg-pink-600 hover:bg-pink-700 text-white flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Crear Promoción
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {loadingPromos ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-pink-600" />
          </div>
        ) : promos.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No hay promociones creadas. Presiona el botón "Crear Promoción" para comenzar.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {promos.map((promo) => (
              <div
                key={promo.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-40 bg-gray-100 dark:bg-gray-900 flex items-center justify-center border-b border-gray-200 dark:border-gray-700">
                    {promo.imagen ? (
                      <img
                        src={promo.imagen}
                        alt={promo.nombre}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="w-10 h-10 text-gray-400" />
                    )}
                    <div className="absolute top-3 right-3 bg-white/95 dark:bg-gray-900/95 px-2.5 py-1 rounded-full shadow-sm flex items-center gap-2 border border-gray-100 dark:border-gray-800">
                      <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300">Activa</span>
                      <Switch
                        checked={promo.activa}
                        onCheckedChange={() => handleTogglePromoActive(promo.id, promo.nombre, promo.activa)}
                        className="scale-90"
                      />
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    <h3 className="font-bold text-base text-gray-900 dark:text-white leading-tight">{promo.nombre}</h3>
                    <p className="text-xs text-gray-500 line-clamp-2 min-h-[2rem]">{promo.descripcion || "Sin descripción."}</p>
                    <p className="text-pink-600 dark:text-pink-400 font-extrabold text-lg">${promo.precio.toLocaleString()}</p>
                    
                    <div className="border-t border-gray-100 dark:border-gray-700 pt-2.5 mt-2.5">
                      <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">Productos incluidos:</p>
                      <div className="space-y-1 max-h-[100px] overflow-y-auto pr-1">
                        {promo.productos.map((prod, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 px-2 py-1 rounded border border-gray-100 dark:border-gray-800">
                            <span className="font-medium truncate flex-1">{prod.nombre}</span>
                            <span className="bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300 text-[10px] px-1.5 py-0.5 rounded font-bold ml-2">x{prod.cantidad}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-gray-50/50 dark:bg-gray-900/20 border-t border-gray-100 dark:border-gray-700 flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 flex gap-1 items-center" onClick={() => handleOpenEditModal(promo)}>
                    <Edit className="w-3.5 h-3.5" />
                    Editar
                  </Button>
                  <Button variant="outline" size="sm" className="text-red-600 hover:text-white hover:bg-red-600 border-red-200 dark:border-red-800" onClick={() => handleDeletePromo(promo.id, promo.nombre)}>
                    <Trash2 className="w-3.5 h-3.5" />
                    Eliminar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* MODAL CREAR / EDITAR */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-pink-500" />
              {editingPromo ? "Editar Promoción o Combo" : "Crear Nueva Promoción"}
            </DialogTitle>
            <DialogDescription>
              Completa los datos y selecciona los productos que formarán parte de esta oferta.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSavePromo} className="space-y-6 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Columna Izquierda: Datos generales */}
              <div className="md:col-span-1 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="promo-name">Nombre de la Promoción</Label>
                  <Input
                    id="promo-name"
                    placeholder="Ej. Combo Familiar Palermo"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="promo-desc">Descripción (Opcional)</Label>
                  <Input
                    id="promo-desc"
                    placeholder="Ej. 1 Pizza Familiar + Bebida 1.5L"
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="promo-price">Precio Final ($)</Label>
                  <Input
                    id="promo-price"
                    type="number"
                    min="1"
                    placeholder="Ej. 14990"
                    value={precio || ""}
                    onChange={(e) => setPrecio(parseInt(e.target.value, 10) || 0)}
                    required
                  />
                </div>

                <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                  <Label htmlFor="promo-active-switch" className="cursor-pointer font-medium text-sm">
                    Activar Promoción
                  </Label>
                  <Switch
                    id="promo-active-switch"
                    checked={activa}
                    onCheckedChange={setActiva}
                  />
                </div>

                {/* Subida de Imagen */}
                <div className="space-y-2">
                  <Label>Imagen Promocional</Label>
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-4 flex flex-col items-center justify-center gap-2 cursor-pointer bg-gray-50/50 hover:bg-gray-50 dark:bg-gray-900/10 transition-colors relative min-h-[160px]">
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={handleImageChange}
                    />
                    {imagePreview ? (
                      <div className="w-full h-full absolute inset-0 rounded-lg overflow-hidden">
                        <img
                          src={imagePreview}
                          alt="Previsualización"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setSelectedImage(null)
                            setImagePreview(null)
                          }}
                          className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 shadow hover:bg-red-700 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-gray-400" />
                        <span className="text-xs text-gray-500 font-medium">Subir imagen</span>
                        <span className="text-[10px] text-gray-400">Recomendado: 800x500 px</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Columna Derecha: Selección de productos */}
              <div className="md:col-span-2 space-y-4">
                <Label className="text-sm font-semibold">Selecciona los productos a incluir:</Label>

                {/* Lista por categorías */}
                <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden max-h-[460px] overflow-y-auto space-y-4 p-4 bg-gray-50/30 dark:bg-gray-900/10">
                  {/* Categoría: Pizzas */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest border-b border-gray-200 dark:border-gray-800 pb-1">🍕 Pizzas</h4>
                    {pizzas.length === 0 ? (
                      <p className="text-xs text-gray-500 italic">No hay pizzas disponibles.</p>
                    ) : (
                      <div className="space-y-1">
                        {pizzas.map((prod) => {
                          const selection = selectedProducts[prod.key]
                          const isChecked = selection?.checked || false
                          const qty = selection?.cantidad || 1
                          const stock = getItemStock(prod)

                          return (
                            <div key={prod.key} className={`flex items-center justify-between p-2 rounded-lg border transition-colors ${isChecked ? 'bg-white dark:bg-gray-800 border-pink-200 dark:border-pink-900/40 shadow-sm' : 'bg-transparent border-transparent'}`}>
                              <label className="flex items-center gap-3 flex-1 cursor-pointer select-none">
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={(checked) => handleToggleProduct(prod.key, !!checked)}
                                />
                                <div className="min-w-0">
                                  <p className="text-xs sm:text-sm font-semibold truncate text-gray-800 dark:text-gray-200">{prod.nombre}</p>
                                  <p className="text-[10px] text-gray-400">Normal: ${prod.precio.toLocaleString()} | Stock: {stock}</p>
                                </div>
                              </label>
                              {isChecked && (
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="w-6 h-6 p-0"
                                    onClick={() => handleChangeProductQty(prod.key, qty - 1)}
                                  >
                                    <X className="w-2.5 h-2.5" />
                                  </Button>
                                  <span className="text-xs font-bold w-6 text-center">{qty}</span>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="w-6 h-6 p-0"
                                    onClick={() => handleChangeProductQty(prod.key, qty + 1)}
                                  >
                                    <Plus className="w-2.5 h-2.5" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Categoría: Agregados */}
                  <div className="space-y-2 pt-2">
                    <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest border-b border-gray-200 dark:border-gray-800 pb-1">🍟 Agregados / Acompañamientos</h4>
                    {agregados.length === 0 ? (
                      <p className="text-xs text-gray-500 italic">No hay agregados disponibles.</p>
                    ) : (
                      <div className="space-y-1">
                        {agregados.map((prod) => {
                          const selection = selectedProducts[prod.key]
                          const isChecked = selection?.checked || false
                          const qty = selection?.cantidad || 1
                          const stock = getItemStock(prod)

                          return (
                            <div key={prod.key} className={`flex items-center justify-between p-2 rounded-lg border transition-colors ${isChecked ? 'bg-white dark:bg-gray-800 border-pink-200 dark:border-pink-900/40 shadow-sm' : 'bg-transparent border-transparent'}`}>
                              <label className="flex items-center gap-3 flex-1 cursor-pointer select-none">
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={(checked) => handleToggleProduct(prod.key, !!checked)}
                                />
                                <div className="min-w-0">
                                  <p className="text-xs sm:text-sm font-semibold truncate text-gray-800 dark:text-gray-200">{prod.nombre}</p>
                                  <p className="text-[10px] text-gray-400">Normal: ${prod.precio.toLocaleString()} | Stock: {stock}</p>
                                </div>
                              </label>
                              {isChecked && (
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="w-6 h-6 p-0"
                                    onClick={() => handleChangeProductQty(prod.key, qty - 1)}
                                  >
                                    <X className="w-2.5 h-2.5" />
                                  </Button>
                                  <span className="text-xs font-bold w-6 text-center">{qty}</span>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="w-6 h-6 p-0"
                                    onClick={() => handleChangeProductQty(prod.key, qty + 1)}
                                  >
                                    <Plus className="w-2.5 h-2.5" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Categoría: Bebidas */}
                  <div className="space-y-2 pt-2">
                    <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest border-b border-gray-200 dark:border-gray-800 pb-1">🥤 Bebidas</h4>
                    {bebidas.length === 0 ? (
                      <p className="text-xs text-gray-500 italic">No hay bebidas disponibles.</p>
                    ) : (
                      <div className="space-y-1">
                        {bebidas.map((prod) => {
                          const selection = selectedProducts[prod.key]
                          const isChecked = selection?.checked || false
                          const qty = selection?.cantidad || 1
                          const stock = getItemStock(prod)

                          return (
                            <div key={prod.key} className={`flex items-center justify-between p-2 rounded-lg border transition-colors ${isChecked ? 'bg-white dark:bg-gray-800 border-pink-200 dark:border-pink-900/40 shadow-sm' : 'bg-transparent border-transparent'}`}>
                              <label className="flex items-center gap-3 flex-1 cursor-pointer select-none">
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={(checked) => handleToggleProduct(prod.key, !!checked)}
                                />
                                <div className="min-w-0">
                                  <p className="text-xs sm:text-sm font-semibold truncate text-gray-800 dark:text-gray-200">{prod.nombre}</p>
                                  <p className="text-[10px] text-gray-400">Normal: ${prod.precio.toLocaleString()} | Stock: {stock}</p>
                                </div>
                              </label>
                              {isChecked && (
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="w-6 h-6 p-0"
                                    onClick={() => handleChangeProductQty(prod.key, qty - 1)}
                                  >
                                    <X className="w-2.5 h-2.5" />
                                  </Button>
                                  <span className="text-xs font-bold w-6 text-center">{qty}</span>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="w-6 h-6 p-0"
                                    onClick={() => handleChangeProductQty(prod.key, qty + 1)}
                                  >
                                    <Plus className="w-2.5 h-2.5" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 border-t border-gray-100 dark:border-gray-800 pt-4 mt-6">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              <Button disabled={saving || uploading} type="submit" className="bg-pink-600 hover:bg-pink-700 text-white flex gap-2 items-center">
                {(saving || uploading) && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingPromo ? "Guardar Cambios" : "Crear Promoción"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

"use client"

import React, { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { db } from "@/lib/firebase"
import { collection, addDoc } from "firebase/firestore"
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { toast } from "@/hooks/use-toast"
import { Upload, X } from "lucide-react"

type AddPizzaModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export default function AddPizzaModal({ open, onOpenChange, onSuccess }: AddPizzaModalProps) {
  const [saving, setSaving] = useState(false)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    nombre: "",
    categoria: "",
    descripcion: "",
    tieneFamiliar: true,
    precioFamiliar: 0,
    tieneMediana: false,
    precioMediana: 0,
  })

  const categorias = [
    "Pizzas Vegetarianas",
    "Pizzas con Carne",
    "Pizzas del Mar",
    "Combos",
    "Acompañamientos",
    "Bebidas"
  ]

  const resetForm = () => {
    setFormData({
      nombre: "",
      categoria: "",
      descripcion: "",
      tieneFamiliar: true,
      precioFamiliar: 0,
      tieneMediana: false,
      precioMediana: 0,
    })
    setSelectedImage(null)
    setImagePreview(null)
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validar tipo de archivo
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Error",
          description: "Por favor selecciona un archivo de imagen válido",
          variant: "destructive",
        })
        return
      }

      // Validar tamaño (máximo 2MB)
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "La imagen no debe superar los 2MB",
          variant: "destructive",
        })
        return
      }

      setSelectedImage(file)
      
      // Crear preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => {
    setSelectedImage(null)
    setImagePreview(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.nombre.trim() || !formData.categoria) {
      toast({
        title: "Error",
        description: "El nombre y la categoría son obligatorios",
        variant: "destructive",
      })
      return
    }

    if (!formData.tieneFamiliar && !formData.tieneMediana) {
      toast({
        title: "Error",
        description: "Debes seleccionar al menos un tamaño (Familiar o Mediana)",
        variant: "destructive",
      })
      return
    }

    setSaving(true)

    try {
      let imageUrl = "/placeholder.svg?height=200&width=200" // URL por defecto

      // Si hay imagen seleccionada, subirla a Storage
      if (selectedImage) {
        try {
          const storage = getStorage()
          const timestamp = Date.now()
          const fileName = `${timestamp}-${selectedImage.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
          const storageRef = ref(storage, `pizzas/${fileName}`)
          
          await uploadBytes(storageRef, selectedImage)
          imageUrl = await getDownloadURL(storageRef)
          
          console.log("Imagen subida exitosamente:", imageUrl)
        } catch (uploadError) {
          console.error("Error subiendo imagen:", uploadError)
          toast({
            title: "Advertencia",
            description: "La pizza se creará pero hubo un error al subir la imagen",
            variant: "destructive",
          })
        }
      }

      // Crear el objeto de pizza con la misma estructura que las existentes
      const nuevaPizza: any = {
        nombre: formData.nombre.trim(),
        categoria: formData.categoria,
        descripcion: formData.descripcion.trim(),
        imagen: imageUrl, // Agregar URL de la imagen
        receta: [], // Inicialmente vacía, se editará después
        recetaMediana: [], // Inicialmente vacía, se editará después
        createdAt: new Date().toISOString(),
      }

      // Agregar clasificación basada en la categoría para compatibilidad con filtros
      if (formData.categoria === "Pizzas Vegetarianas") {
        nuevaPizza.clasificacion = "vegetariana"
      } else if (formData.categoria === "Pizzas con Carne") {
        nuevaPizza.clasificacion = "carnica"
      } else if (formData.categoria === "Pizzas del Mar") {
        nuevaPizza.clasificacion = "marina"
      }

      // Agregar precios según los tamaños seleccionados
      if (formData.tieneFamiliar) {
        nuevaPizza.precio = formData.precioFamiliar
        nuevaPizza.sizes = nuevaPizza.sizes || []
        nuevaPizza.sizes.push({
          name: "Familiar",
          price: formData.precioFamiliar
        })
      }

      if (formData.tieneMediana) {
        // Si solo tiene mediana, el precio principal es el de mediana
        if (!formData.tieneFamiliar) {
          nuevaPizza.precio = formData.precioMediana
        }
        // Agregar precioMediana para compatibilidad con el código existente
        nuevaPizza.precioMediana = formData.precioMediana
        nuevaPizza.sizes = nuevaPizza.sizes || []
        nuevaPizza.sizes.push({
          name: "Mediana",
          price: formData.precioMediana
        })
      }

      // Si no se agregó sizes, usar estructura simple
      if (!nuevaPizza.sizes || nuevaPizza.sizes.length === 0) {
        delete nuevaPizza.sizes
      }

      console.log("Agregando nueva pizza:", nuevaPizza)

      // Guardar en Firestore
      const docRef = await addDoc(collection(db, "items_menu"), nuevaPizza)

      toast({
        title: "¡Pizza agregada!",
        description: `${formData.nombre} se ha agregado correctamente. Ahora puedes editar su receta.`,
        variant: "default",
      })

      resetForm()
      onSuccess()
      onOpenChange(false)
    } catch (error) {
      console.error("Error al agregar pizza:", error)
      toast({
        title: "Error",
        description: "No se pudo agregar la pizza. Intenta nuevamente.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm()
      onOpenChange(isOpen)
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agregar Nueva Pizza</DialogTitle>
          <DialogDescription>
            Completa los datos de la nueva pizza. Después podrás editar su receta en la sección "Recetas de Pizzas".
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nombre */}
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre de la Pizza *</Label>
            <Input
              id="nombre"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              placeholder="Ej: Margherita, Pepperoni, etc."
              required
            />
          </div>

          {/* Categoría */}
          <div className="space-y-2">
            <Label htmlFor="categoria">Categoría *</Label>
            <Select
              value={formData.categoria}
              onValueChange={(value) => setFormData({ ...formData, categoria: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una categoría" />
              </SelectTrigger>
              <SelectContent>
                {categorias.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Descripción */}
          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción</Label>
            <Textarea
              id="descripcion"
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              placeholder="Describe los ingredientes o características de esta pizza..."
              rows={3}
            />
          </div>

          {/* Imagen */}
          <div className="space-y-2">
            <Label htmlFor="imagen">Imagen de la Pizza</Label>
            {imagePreview ? (
              <div className="relative border-2 border-dashed rounded-lg p-4">
                <img 
                  src={imagePreview} 
                  alt="Preview" 
                  className="w-full h-48 object-cover rounded"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={removeImage}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600 mb-2">
                  Haz clic para seleccionar una imagen
                </p>
                <p className="text-xs text-gray-400 mb-3">
                  PNG, JPG o WEBP (máx. 2MB)
                </p>
                <Input
                  id="imagen"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <Label
                  htmlFor="imagen"
                  className="cursor-pointer inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Seleccionar Imagen
                </Label>
              </div>
            )}
          </div>

          {/* Tamaños y Precios */}
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-semibold">Tamaños y Precios</h3>
            
            {/* Tamaño Familiar */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="tieneFamiliar"
                  checked={formData.tieneFamiliar}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, tieneFamiliar: checked as boolean })
                  }
                />
                <Label htmlFor="tieneFamiliar" className="cursor-pointer">
                  Tamaño Familiar
                </Label>
              </div>
              {formData.tieneFamiliar && (
                <div className="ml-6">
                  <Label htmlFor="precioFamiliar">Precio Familiar ($)</Label>
                  <Input
                    id="precioFamiliar"
                    type="number"
                    value={formData.precioFamiliar}
                    onChange={(e) => setFormData({ ...formData, precioFamiliar: Number(e.target.value) || 0 })}
                    placeholder="0"
                    min="0"
                    required={formData.tieneFamiliar}
                  />
                </div>
              )}
            </div>

            {/* Tamaño Mediana */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="tieneMediana"
                  checked={formData.tieneMediana}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, tieneMediana: checked as boolean })
                  }
                />
                <Label htmlFor="tieneMediana" className="cursor-pointer">
                  Tamaño Mediana
                </Label>
              </div>
              {formData.tieneMediana && (
                <div className="ml-6">
                  <Label htmlFor="precioMediana">Precio Mediana ($)</Label>
                  <Input
                    id="precioMediana"
                    type="number"
                    value={formData.precioMediana}
                    onChange={(e) => setFormData({ ...formData, precioMediana: Number(e.target.value) || 0 })}
                    placeholder="0"
                    min="0"
                    required={formData.tieneMediana}
                  />
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {saving ? "Guardando..." : "Agregar Pizza"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

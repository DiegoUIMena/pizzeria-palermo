"use client"

import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useFirestorePizzaConfig } from "@/hooks/useFirestorePizzaConfig"
import { db } from "@/lib/firebase"
import { doc, updateDoc, getDoc } from "firebase/firestore"
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { toast } from "@/hooks/use-toast"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

type RecetaLinea = {
  ingredienteId: string
  nombre: string
  cantidad: number
  unidad: string
}

export default function RecipeEditor({ open, onOpenChange, initialPizzaId }: { open: boolean; onOpenChange: (open: boolean) => void; initialPizzaId?: string | null }) {
  const { loading, ingredients, itemsMenu, refreshData } = useFirestorePizzaConfig()
  const [selectedPizzaId, setSelectedPizzaId] = useState<string | null>(null)
  const [pizzaName, setPizzaName] = useState<string>("")
  const [lineas, setLineas] = useState<RecetaLinea[]>([])
  const [saving, setSaving] = useState(false)
  const [recetaType, setRecetaType] = useState<"familiar" | "mediana">("familiar")
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [pizzaImage, setPizzaImage] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setSelectedPizzaId(null)
      setLineas([])
      setPizzaName("")
      setRecetaType("familiar")
      setPizzaImage(null)
    } else {
      // si se abre y viene initialPizzaId desde el padre, cargarla
      if (initialPizzaId) setSelectedPizzaId(initialPizzaId)
    }
  }, [open])

  useEffect(() => {
    // cargar receta existente si hay pizza seleccionada
    if (selectedPizzaId) {
      const pizza = itemsMenu.find((p: any) => p.id === selectedPizzaId)
      setPizzaName(pizza?.nombre || "")
      setPizzaImage(pizza?.imagen || null)
      
      if (recetaType === "familiar" && pizza && pizza.receta && Array.isArray(pizza.receta)) {
        setLineas(pizza.receta.map((r: any) => ({ ingredienteId: r.ingredienteId, nombre: r.nombre, cantidad: r.cantidad || 0, unidad: r.unidad || "" })))
      } else if (recetaType === "mediana" && pizza && pizza.recetaMediana && Array.isArray(pizza.recetaMediana)) {
        setLineas(pizza.recetaMediana.map((r: any) => ({ ingredienteId: r.ingredienteId, nombre: r.nombre, cantidad: r.cantidad || 0, unidad: r.unidad || "" })))
      } else {
        setLineas([])
      }
    }
  }, [selectedPizzaId, recetaType, itemsMenu])

  const addLinea = () => setLineas(prev => [...prev, { ingredienteId: ingredients[0]?.id || "", nombre: ingredients[0]?.nombre || "", cantidad: 0, unidad: ingredients[0]?.unidad || "" }])

  const updateLinea = (idx: number, patch: Partial<RecetaLinea>) => {
    setLineas(prev => prev.map((l, i) => i === idx ? { ...l, ...patch } : l))
  }

  const removeLinea = (idx: number) => setLineas(prev => prev.filter((_, i) => i !== idx))

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedPizzaId) return

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Error",
        description: "Por favor selecciona un archivo de imagen válido.",
        variant: "destructive"
      })
      return
    }

    try {
      setIsUploading(true)
      const storage = getStorage()
      const pizza = itemsMenu.find((p: any) => p.id === selectedPizzaId)
      const folderName = (pizza?.categoria === 'Bebidas' || (pizzaName || '').toLowerCase().includes('coca') || (pizzaName || '').toLowerCase().includes('lipton')) ? 'bebidas' : 'pizzas'
      const fileRef = ref(storage, `${folderName}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`)
      const uploadTask = uploadBytesResumable(fileRef, file)

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          setUploadProgress(progress)
        },
        (error) => {
          console.error('Error al subir la imagen:', error)
          toast({
            title: "Error",
            description: "Hubo un error subiendo la imagen.",
            variant: "destructive"
          })
          setIsUploading(false)
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
          await updateDoc(doc(db, 'items_menu', selectedPizzaId), { imagen: downloadURL })
          setPizzaImage(downloadURL)
          setIsUploading(false)
          setUploadProgress(0)
          refreshData()
          toast({ title: "Imagen actualizada", description: "La imagen de la pizza se ha actualizado correctamente." })
        }
      )
    } catch (error) {
      console.error('Error preparando la subida:', error)
      setIsUploading(false)
    }
  }

  const handleSave = async () => {
    if (!selectedPizzaId) return
    setSaving(true)
    try {
      const pizzaRef = doc(db, "items_menu", selectedPizzaId)
      // normalize minimal receta shape
      const recetaData = lineas.map(l => ({ ingredienteId: l.ingredienteId, nombre: l.nombre, cantidad: Number(l.cantidad) || 0, unidad: l.unidad || "" }))
      
      // Determinar qué campo actualizar según el tipo de receta seleccionado
      const updateField = recetaType === "mediana" ? "recetaMediana" : "receta";
      
      console.log(`Guardando receta ${recetaType}...`, { selectedPizzaId, [updateField]: recetaData, timestamp: Date.now() });
      await updateDoc(pizzaRef, { [updateField]: recetaData })
      
      // Leer el documento actualizado para verificar
      const docSnap = await getDoc(pizzaRef);
      console.log("Documento actualizado:", docSnap.data(), "timestamp:", Date.now());
      
      // Actualizar los datos después de guardar
      console.log("Receta guardada exitosamente, actualizando datos...", Date.now())
      
      // Refrescar los datos en el hook para que se actualice la interfaz
      refreshData()
      
      // Mostrar notificación de éxito
      toast({
        title: `Receta ${recetaType} guardada`,
        description: `Los cambios en la receta de pizza ${recetaType} se han guardado correctamente.`,
        variant: "default",
      })
      
      // Aseguramos que los datos se actualizarán antes de cerrar el modal
      setTimeout(() => {
        console.log("Actualizando datos nuevamente antes de cerrar el modal", Date.now())
        refreshData() // Llamamos de nuevo para asegurar la actualización
        
        // Esperamos otro momento para permitir que la UI se actualice
        setTimeout(() => {
          console.log("Cerrando modal de recetas", Date.now())
          // Cerrar el modal
          onOpenChange(false)
        }, 300)
      }, 500)
    } catch (err) {
      console.error("Error guardando receta:", err)
      toast({
        title: "Error al guardar",
        description: "Ha ocurrido un error al guardar la receta. Intenta nuevamente.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Editor de Recetas (Pizzas)</DialogTitle>
          <DialogDescription>Selecciona una pizza y compone su receta con ingredientes y cantidades.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <div>
              <Label>Pizza</Label>
              <Select value={selectedPizzaId ?? ""} onValueChange={(v) => setSelectedPizzaId(v || null)}>
                <SelectTrigger>
                  <SelectValue placeholder={loading ? "Cargando pizzas..." : "Seleccionar pizza"} />
                </SelectTrigger>
                <SelectContent>
                  {itemsMenu.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="mb-4">
              <div className="flex justify-between items-center">
                <Label htmlFor="recetaType">Tipo de Receta</Label>
              </div>
              {pizzaName !== "4 Estaciones" && pizzaName !== "Sevillana" && pizzaName !== "Entre Ríos" && (
                <div>
                  <Select value={recetaType} onValueChange={(value) => setRecetaType(value as "familiar" | "mediana")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo de receta" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="familiar">Familiar</SelectItem>
                      <SelectItem value="mediana">Mediana</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {(pizzaName === "4 Estaciones" || pizzaName === "Sevillana" || pizzaName === "Entre Ríos") && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Esta pizza solo viene en tamaño familiar y no tiene opción mediana.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Ingredientes {recetaType === "familiar" ? "(Familiar)" : "(Mediana)"}</Label>
                <Button size="sm" onClick={addLinea}>Agregar Ingrediente</Button>
              </div>

              <div className="space-y-2">
                {lineas.map((l, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5">
                      <Select value={l.ingredienteId} onValueChange={(v) => {
                        const ing = ingredients.find(i => i.id === v)
                        updateLinea(idx, { ingredienteId: v, nombre: ing?.nombre || "", unidad: ing?.unidad || "" })
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar ingrediente" />
                        </SelectTrigger>
                        <SelectContent>
                          {ingredients.map((ing: any) => (
                            <SelectItem key={ing.id} value={ing.id}>{ing.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3">
                      <Input type="number" value={String(l.cantidad)} onChange={(e) => updateLinea(idx, { cantidad: Number(e.target.value) || 0 })} />
                    </div>
                    <div className="col-span-3">
                      <Input value={l.unidad} onChange={(e) => updateLinea(idx, { unidad: e.target.value })} placeholder="unidad (g, kg, u)" />
                    </div>
                    <div className="col-span-1">
                      <Button variant="destructive" size="icon" onClick={() => removeLinea(idx)}>X</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="md:col-span-1 border-t md:border-t-0 md:border-l border-gray-200 pt-4 md:pt-0 md:pl-6 flex flex-col items-center">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Imagen de la Pizza</h3>
            
            <div className="w-full aspect-square relative rounded-xl overflow-hidden bg-gray-50 border-2 border-dashed border-gray-300 flex items-center justify-center mb-4 shadow-inner">
              {pizzaImage ? (
                <img src={pizzaImage} alt={pizzaName} className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center text-gray-400">
                  <span className="text-4xl mb-2">🍕</span>
                  <span className="text-sm">Sin imagen</span>
                </div>
              )}
            </div>

            <div className="w-full">
              <label className={`block w-full cursor-pointer text-center py-2 px-4 rounded-md transition-colors font-medium text-sm ${(isUploading || !selectedPizzaId) ? 'bg-gray-200 text-gray-600 cursor-not-allowed' : 'bg-pink-600 hover:bg-pink-700 text-white'}`}>
                {isUploading ? `Subiendo... ${Math.round(uploadProgress)}%` : "Cambiar Imagen"}
                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={isUploading || !selectedPizzaId} />
              </label>
            </div>
            
            <p className="text-xs text-gray-500 mt-3 text-center">
              {!selectedPizzaId ? "Selecciona una pizza primero para editar su imagen." : "La imagen se guardará automáticamente en Firebase Storage."}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={saving || !selectedPizzaId} onClick={handleSave} className="bg-pink-600 text-white">{saving ? 'Guardando...' : 'Guardar Receta'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

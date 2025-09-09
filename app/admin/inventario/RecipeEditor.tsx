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

type RecetaLinea = {
  ingredienteId: string
  nombre: string
  cantidad: number
  unidad: string
}

export default function RecipeEditor({ open, onOpenChange, initialPizzaId }: { open: boolean; onOpenChange: (open: boolean) => void; initialPizzaId?: string | null }) {
  const { loading, ingredients, itemsMenu } = useFirestorePizzaConfig()
  const [selectedPizzaId, setSelectedPizzaId] = useState<string | null>(null)
  const [lineas, setLineas] = useState<RecetaLinea[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) {
      setSelectedPizzaId(null)
      setLineas([])
    } else {
      // si se abre y viene initialPizzaId desde el padre, cargarla
      if (initialPizzaId) setSelectedPizzaId(initialPizzaId)
    }
  }, [open])

  useEffect(() => {
    // cargar receta existente si hay pizza seleccionada
    if (selectedPizzaId) {
      const pizza = itemsMenu.find((p: any) => p.id === selectedPizzaId)
      if (pizza && pizza.receta && Array.isArray(pizza.receta)) {
        setLineas(pizza.receta.map((r: any) => ({ ingredienteId: r.ingredienteId, nombre: r.nombre, cantidad: r.cantidad || 0, unidad: r.unidad || "" })))
      } else {
        setLineas([])
      }
    }
  }, [selectedPizzaId, itemsMenu])

  const addLinea = () => setLineas(prev => [...prev, { ingredienteId: ingredients[0]?.id || "", nombre: ingredients[0]?.nombre || "", cantidad: 0, unidad: ingredients[0]?.unidad || "" }])

  const updateLinea = (idx: number, patch: Partial<RecetaLinea>) => {
    setLineas(prev => prev.map((l, i) => i === idx ? { ...l, ...patch } : l))
  }

  const removeLinea = (idx: number) => setLineas(prev => prev.filter((_, i) => i !== idx))

  const handleSave = async () => {
    if (!selectedPizzaId) return
    setSaving(true)
    try {
      const pizzaRef = doc(db, "items_menu", selectedPizzaId)
      // normalize minimal receta shape
      const receta = lineas.map(l => ({ ingredienteId: l.ingredienteId, nombre: l.nombre, cantidad: Number(l.cantidad) || 0, unidad: l.unidad || "" }))
      await updateDoc(pizzaRef, { receta })
      // refresh local by re-reading doc (not strictly necessary)
      await getDoc(pizzaRef)
      onOpenChange(false)
    } catch (err) {
      console.error("Error guardando receta:", err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Editor de Recetas (Pizzas)</DialogTitle>
          <DialogDescription>Selecciona una pizza y compone su receta con ingredientes y cantidades.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Ingredientes</Label>
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={saving || !selectedPizzaId} onClick={handleSave} className="bg-pink-600 text-white">{saving ? 'Guardando...' : 'Guardar Receta'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

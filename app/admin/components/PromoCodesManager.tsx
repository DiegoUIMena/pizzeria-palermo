"use client"

import { useState, useEffect } from "react"
import { collection, onSnapshot, doc, updateDoc, setDoc, deleteDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tag, X, Plus, Trash2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface PromoCode {
  id: string
  code: string
  type: "percentage" | "amount"
  value: number
  active: boolean
  expirationDate: string | null
  minAmount: number | null
  maxUses: number | null
  currentUses: number
}

export default function PromoCodesManager() {
  const [codes, setCodes] = useState<PromoCode[]>([])
  const [isCreating, setIsCreating] = useState(false)
  
  // Estado para el formulario de nuevo código
  const [newCode, setNewCode] = useState({
    code: "",
    type: "percentage" as "percentage" | "amount",
    value: "",
    expirationDate: "",
    minAmount: "",
    maxUses: ""
  })

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "promociones"), (snapshot) => {
      const loadedCodes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PromoCode[]
      setCodes(loadedCodes)
    })
    return () => unsubscribe()
  }, [])

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, "promociones", id), { active: !currentStatus })
    } catch (error) {
      toast({ title: "Error", description: "No se pudo actualizar el estado.", variant: "destructive" })
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm("¿Estás seguro de eliminar este código?")) {
      await deleteDoc(doc(db, "promociones", id))
    }
  }

  const handleCreate = async () => {
    if (!newCode.code || !newCode.value) {
      toast({ title: "Campos requeridos", description: "El código y el valor son obligatorios.", variant: "destructive" })
      return
    }
    
    try {
      const normalizedCode = newCode.code.trim().toUpperCase()
      const payload = {
        code: normalizedCode,
        type: newCode.type,
        value: Number(newCode.value),
        active: true,
        expirationDate: newCode.expirationDate || null,
        minAmount: newCode.minAmount ? Number(newCode.minAmount) : null,
        maxUses: newCode.maxUses ? Number(newCode.maxUses) : null,
        currentUses: 0,
        createdAt: new Date().toISOString()
      }
      
      // Guardamos con el propio nombre del código como ID para evitar duplicados
      await setDoc(doc(db, "promociones", normalizedCode), payload)
      setIsCreating(false)
      setNewCode({ code: "", type: "percentage", value: "", expirationDate: "", minAmount: "", maxUses: "" })
      toast({ title: "¡Éxito!", description: "Código promocional creado." })
    } catch (error) {
      toast({ title: "Error", description: "Ocurrió un error al crear el código.", variant: "destructive" })
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6 dark:bg-gray-800 dark:border-gray-700">
      <div className="flex items-center justify-between mb-6 border-b pb-4 dark:border-gray-700">
        <div className="flex items-center gap-2 text-pink-600 dark:text-pink-400">
          <Tag className="w-5 h-5" />
          <h2 className="text-xl font-bold">Gestión de Códigos de Descuento</h2>
        </div>
        <Button onClick={() => setIsCreating(!isCreating)} className="bg-pink-600 hover:bg-pink-700 text-white">
          {isCreating ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
          {isCreating ? "Cancelar" : "Nuevo Código"}
        </Button>
      </div>

      {isCreating && (
        <div className="bg-pink-50 p-4 rounded-lg border border-pink-200 mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in slide-in-from-top-2 dark:bg-gray-700 dark:border-gray-600">
          <div>
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 block">CÓDIGO *</label>
            <Input placeholder="Ej: DIADELAMADRE" value={newCode.code} onChange={(e) => setNewCode({...newCode, code: e.target.value.toUpperCase()})} />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 block">TIPO *</label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={newCode.type} onChange={(e) => setNewCode({...newCode, type: e.target.value as "percentage"|"amount"})}>
              <option value="percentage">Porcentaje (%)</option>
              <option value="amount">Monto Fijo ($)</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 block">VALOR *</label>
            <Input type="number" placeholder="Ej: 15 (para 15%)" value={newCode.value} onChange={(e) => setNewCode({...newCode, value: e.target.value})} />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 block">EXPIRA (Opcional)</label>
            <Input type="date" value={newCode.expirationDate} onChange={(e) => setNewCode({...newCode, expirationDate: e.target.value})} />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 block">COMPRA MÍNIMA $ (Opcional)</label>
            <Input type="number" placeholder="Ej: 15000" value={newCode.minAmount} onChange={(e) => setNewCode({...newCode, minAmount: e.target.value})} />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 block">LÍMITE DE USOS (Opcional)</label>
            <Input type="number" placeholder="Ej: 50" value={newCode.maxUses} onChange={(e) => setNewCode({...newCode, maxUses: e.target.value})} />
          </div>
          <div className="col-span-full">
            <Button onClick={handleCreate} className="w-full bg-green-600 hover:bg-green-700 text-white mt-2">Guardar Promoción</Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-600 dark:text-gray-300">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600">
            <tr>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Descuento</th>
              <th className="px-4 py-3">Restricciones</th>
              <th className="px-4 py-3 text-center">Usos</th>
              <th className="px-4 py-3 text-center">Estado</th>
              <th className="px-4 py-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {codes.length === 0 ? (
               <tr><td colSpan={6} className="text-center py-6 text-gray-400">No hay códigos creados</td></tr>
            ) : codes.map((c) => (
              <tr key={c.id} className={`border-b dark:border-gray-700 ${!c.active ? 'opacity-60 bg-gray-50 dark:bg-gray-800' : ''}`}>
                <td className="px-4 py-3 font-bold text-pink-700 dark:text-pink-400">{c.code}</td>
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                  {c.type === 'percentage' ? `${c.value}% OFF` : `$${c.value.toLocaleString()} OFF`}
                </td>
                <td className="px-4 py-3 text-xs space-y-1">
                  {c.minAmount ? <div>Mínimo: ${c.minAmount.toLocaleString()}</div> : <div className="text-gray-400">Sin mínimo</div>}
                  {c.expirationDate ? <div>Expira: {new Date(c.expirationDate).toLocaleDateString()}</div> : <div className="text-gray-400">No expira</div>}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded dark:bg-blue-900 dark:text-blue-300">
                    {c.currentUses} / {c.maxUses || '∞'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => handleToggleActive(c.id, c.active)} className={`px-2 py-1 rounded text-xs font-bold transition-colors ${c.active ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300'}`}>
                    {c.active ? 'ACTIVO' : 'INACTIVO'}
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)} className="text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/50">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
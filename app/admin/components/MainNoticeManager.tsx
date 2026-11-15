"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Megaphone, Save, Loader2, Eye } from "lucide-react"
import { doc, onSnapshot, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { toast } from "@/hooks/use-toast"

export default function MainNoticeManager() {
  const [text, setText] = useState("")
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!db) {
      setLoading(false)
      return
    }

    const docRef = doc(db, "settings", "main_notice")
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data()
          setText(typeof data.text === "string" ? data.text : "")
          setEnabled(Boolean(data.enabled))
        }
        setLoading(false)
      },
      (error) => {
        console.error("Error al cargar configuración de Aviso principal:", error)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [])

  const handleToggleEnabled = async (checked: boolean) => {
    const previousState = enabled
    setEnabled(checked)

    try {
      await setDoc(
        doc(db, "settings", "main_notice"),
        {
          enabled: checked,
          text: text.trim(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      )
      toast({
        title: checked ? "Aviso principal activado" : "Aviso principal desactivado",
        description: checked
          ? "El aviso ahora es visible en el encabezado de la tienda pública."
          : "El aviso se ha ocultado de la tienda pública.",
      })
    } catch (error) {
      console.error("Error al cambiar estado del aviso principal:", error)
      setEnabled(previousState)
      toast({
        title: "Error",
        description: "No se pudo actualizar la visibilidad del aviso.",
        variant: "destructive",
      })
    }
  }

  const handleSaveText = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanText = text.trim()

    if (!cleanText) {
      toast({
        title: "Texto requerido",
        description: "El texto del aviso no puede estar vacío.",
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    try {
      await setDoc(
        doc(db, "settings", "main_notice"),
        {
          text: cleanText,
          enabled,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      )
      setText(cleanText)
      toast({
        title: "Aviso actualizado",
        description: "El texto del aviso principal se ha guardado correctamente.",
      })
    } catch (error) {
      console.error("Error al guardar el texto del aviso principal:", error)
      toast({
        title: "Error al guardar",
        description: "Ocurrió un problema al guardar los cambios.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-pink-600" />
            Aviso principal
          </CardTitle>
          <CardDescription>
            Personaliza el mensaje superior del encabezado para promociones, códigos de descuento o anuncios importantes.
          </CardDescription>
        </div>

        <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
          <Label htmlFor="main-notice-switch" className="text-sm font-medium cursor-pointer">
            {enabled ? "Visible en la web" : "Oculto en la web"}
          </Label>
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
          ) : (
            <Switch
              id="main-notice-switch"
              checked={enabled}
              onCheckedChange={handleToggleEnabled}
              className="data-[state=checked]:bg-pink-600"
            />
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-gray-500">Cargando configuración del aviso...</p>
        ) : (
          <>
            <form onSubmit={handleSaveText} className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="main-notice-input">Texto del aviso</Label>
                  <span className="text-xs text-gray-400">{text.length}/200 caracteres</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Input
                    id="main-notice-input"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Ej: ¡Envío gratis en compras sobre $15.000 usando el código PALERMO!"
                    maxLength={200}
                    className="flex-1"
                  />
                  <Button
                    type="submit"
                    disabled={saving || !text.trim()}
                    className="w-full sm:w-auto bg-pink-600 hover:bg-pink-700 text-white"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Guardar Cambios
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>

            {/* Vista previa en tiempo real */}
            <div className="pt-2 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                <Eye className="w-3.5 h-3.5" />
                <span>Vista previa del encabezado {enabled ? "(Activo)" : "(Actualmente desactivado)"}:</span>
              </div>
              <div
                className={`rounded-md overflow-hidden transition-opacity ${
                  enabled ? "opacity-100" : "opacity-50"
                }`}
              >
                <div className="bg-gradient-to-r from-pink-500 to-pink-600 text-white text-center py-2 px-4 text-xs sm:text-sm font-medium shadow-sm">
                  <span className="text-shadow-sm">
                    {text.trim() || "Escribe un mensaje para visualizarlo aquí..."}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

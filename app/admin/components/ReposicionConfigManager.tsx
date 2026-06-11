"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Phone, Save } from "lucide-react"
import { getReposicionPhone, saveReposicionPhone } from "@/lib/reposicion-config"
import { toast } from "@/hooks/use-toast"

export default function ReposicionConfigManager() {
  const [phone, setPhone] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let mounted = true
    async function loadPhone() {
      try {
        const number = await getReposicionPhone()
        if (mounted) {
          setPhone(number)
          setLoading(false)
        }
      } catch (error) {
        console.error("Error al cargar número:", error)
        if (mounted) setLoading(false)
      }
    }
    loadPhone()
    return () => { mounted = false }
  }, [])

  const handleSave = async () => {
    try {
      setSaving(true)
      await saveReposicionPhone(phone)
      toast({
        title: "Guardado exitoso",
        description: "El número del grupo de reposición ha sido actualizado.",
      })
    } catch (error) {
      toast({
        title: "Error al guardar",
        description: "No se pudo actualizar el número. Intenta de nuevo.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-sm text-gray-500">Cargando configuración...</div>

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <Phone className="h-5 w-5 text-green-500" />
          Notificaciones de Reposición
        </CardTitle>
        <CardDescription>
          Configura el número de WhatsApp al que llegarán las listas de reposición del inventario. Usa el código de país (ej. +56912345678).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 w-full space-y-2">
            <Label htmlFor="reposicion-phone">Número de WhatsApp (con código de país)</Label>
            <Input
              id="reposicion-phone"
              placeholder="+56912345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
            {saving ? (
              "Guardando..."
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" /> Guardar Número
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

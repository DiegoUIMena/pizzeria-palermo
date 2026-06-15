"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Clock, Upload, X, Check, AlertCircle } from "lucide-react"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage"
import { db, storage } from "@/lib/firebase"
import Image from "next/image"

interface BusinessHoursConfig {
  openingTime: string // formato HH:MM
  closingTime: string // formato HH:MM
  isOpen: boolean // Control manual: true = abierto, false = cerrado forzado
  closedBannerImages: BannerImage[]
  activeBannerId: string | null
}

interface BannerImage {
  id: string
  url: string
  name: string
  uploadedAt: number
}

export default function BusinessHoursManager() {
  const [config, setConfig] = useState<BusinessHoursConfig>({
    openingTime: "18:00",
    closingTime: "23:30",
    isOpen: true,
    closedBannerImages: [],
    activeBannerId: null,
  })
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Cargar configuración desde Firebase
  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      const docRef = doc(db, "settings", "businessHours")
      const docSnap = await getDoc(docRef)
      
      if (docSnap.exists()) {
        const data = docSnap.data()
        // Asegurar que closedBannerImages sea siempre un array
        setConfig({
          openingTime: data.openingTime || "18:00",
          closingTime: data.closingTime || "23:30",
          isOpen: data.isOpen !== undefined ? data.isOpen : true,
          closedBannerImages: Array.isArray(data.closedBannerImages) ? data.closedBannerImages : [],
          activeBannerId: data.activeBannerId || null,
        })
      }
    } catch (error) {
      console.error("Error al cargar configuración:", error)
      showMessage("error", "Error al cargar la configuración")
    } finally {
      setLoading(false)
    }
  }

  const saveConfig = async () => {
    setSaving(true)
    try {
      const docRef = doc(db, "settings", "businessHours")
      await setDoc(docRef, config)
      
      // Limpiar todos los caches relacionados
      localStorage.removeItem('business_hours_cache')
      
      // Forzar recarga completa en otras pestañas/ventanas
      localStorage.setItem('force_reload_timestamp', Date.now().toString())
      
      showMessage("success", "Configuracion guardada exitosamente")
    } catch (error) {
      console.error("Error al guardar configuracion:", error)
      showMessage("error", "Error al guardar la configuracion")
    } finally {
      setSaving(false)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    try {
      const newImages: BannerImage[] = []

      for (const file of Array.from(files)) {
        // Validar tipo de archivo
        if (!file.type.startsWith("image/")) {
          showMessage("error", "Solo se permiten archivos de imagen")
          continue
        }

        // Validar tamaño (máx 5MB)
        if (file.size > 5 * 1024 * 1024) {
          showMessage("error", `${file.name} es muy grande (máx 5MB)`)
          continue
        }

        const imageId = `banner_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const storageRef = ref(storage, `banners-closed/${imageId}`)
        
        await uploadBytes(storageRef, file)
        const url = await getDownloadURL(storageRef)

        newImages.push({
          id: imageId,
          url,
          name: file.name,
          uploadedAt: Date.now(),
        })
      }

      setConfig((prev) => ({
        ...prev,
        closedBannerImages: [...prev.closedBannerImages, ...newImages],
      }))

      showMessage("success", `${newImages.length} imagen(es) subida(s) exitosamente`)
    } catch (error) {
      console.error("Error al subir imágenes:", error)
      showMessage("error", "Error al subir las imágenes")
    } finally {
      setUploading(false)
    }
  }

  const deleteImage = async (imageId: string) => {
    if (!confirm("¿Estás seguro de eliminar esta imagen?")) return

    try {
      // Eliminar de Storage
      const storageRef = ref(storage, `banners-closed/${imageId}`)
      try {
        await deleteObject(storageRef)
      } catch (storageError: any) {
        // Si el error es porque el archivo ya no existe, continuamos para eliminarlo de la UI
        if (storageError.code === 'storage/object-not-found') {
          console.warn("La imagen ya no existía en Storage, procediendo a eliminarla de la configuración.")
        } else {
          throw storageError
        }
      }

      // Actualizar estado local
      setConfig((prev) => ({
        ...prev,
        closedBannerImages: prev.closedBannerImages.filter((img) => img.id !== imageId),
        activeBannerId: prev.activeBannerId === imageId ? null : prev.activeBannerId,
      }))

      showMessage("success", "Imagen eliminada. Recuerda hacer clic en 'Guardar Configuración'")
    } catch (error) {
      console.error("Error al eliminar imagen:", error)
      showMessage("error", "Error al eliminar la imagen")
    }
  }

  const selectActiveBanner = (imageId: string) => {
    setConfig((prev) => ({
      ...prev,
      activeBannerId: imageId,
    }))
  }

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 5000)
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Gestión de Horarios
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">Cargando configuración...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Gestión de Horarios
        </CardTitle>
        <CardDescription>
          Configura los horarios del local y los banners para cuando esté cerrado
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Mensaje de éxito/error */}
        {message && (
          <div
            className={`p-3 rounded-lg flex items-center gap-2 ${
              message.type === "success"
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {message.type === "success" ? (
              <Check className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <span className="text-sm">{message.text}</span>
          </div>
        )}

        {/* Control Manual de Apertura/Cierre */}
        <div className="space-y-4 p-4 bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg border-2 border-gray-700">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="manual-open" className="text-lg font-semibold flex items-center gap-2 text-white">
                <Clock className="h-5 w-5" />
                Estado del Local
              </Label>
              <p className="text-sm text-gray-300">
                {config.isOpen 
                  ? "El local está ABIERTO y acepta pedidos (respeta horario configurado)" 
                  : "El local está CERRADO MANUALMENTE - No se aceptan pedidos"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`font-semibold ${config.isOpen ? 'text-green-400' : 'text-red-400'}`}>
                {config.isOpen ? 'ABIERTO' : 'CERRADO'}
              </span>
              <Switch
                id="manual-open"
                checked={config.isOpen}
                onCheckedChange={(checked) => 
                  setConfig((prev) => ({ ...prev, isOpen: checked }))
                }
                className="data-[state=checked]:bg-green-500"
              />
            </div>
          </div>
          {!config.isOpen && (
            <div className="flex items-start gap-2 p-3 bg-red-950/50 border border-red-900 rounded-md">
              <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">
                <strong>Atención:</strong> Con el local cerrado manualmente, los clientes NO podrán realizar pedidos sin importar el horario configurado.
              </p>
            </div>
          )}
        </div>

        {/* Configuración de horarios */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Horarios de Atención</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="openingTime">Hora de Apertura</Label>
              <Input
                id="openingTime"
                type="time"
                value={config.openingTime}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, openingTime: e.target.value }))
                }
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="closingTime">Hora de Cierre</Label>
              <Input
                id="closingTime"
                type="time"
                value={config.closingTime}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, closingTime: e.target.value }))
                }
                className="font-mono"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            El local estará abierto desde las {config.openingTime} hasta las {config.closingTime}.
            Fuera de este horario, se mostrará el banner de cierre.
          </p>
        </div>

        {/* Banners de cierre */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Banners de Cierre</h3>
            <Label
              htmlFor="banner-upload"
              className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-pink-500 text-white rounded-md hover:bg-pink-600 transition-colors"
            >
              <Upload className="h-4 w-4" />
              {uploading ? "Subiendo..." : "Subir Imágenes"}
            </Label>
            <Input
              id="banner-upload"
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              disabled={uploading}
              className="hidden"
            />
          </div>

          {(!config.closedBannerImages || config.closedBannerImages.length === 0) ? (
            <div className="p-8 border-2 border-dashed border-gray-300 rounded-lg text-center">
              <Upload className="h-12 w-12 mx-auto text-gray-400 mb-3" />
              <p className="text-sm text-gray-500">
                No hay banners cargados. Sube imágenes para mostrar cuando el local esté cerrado.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {config.closedBannerImages.map((image) => {
                const isActive = config.activeBannerId === image.id
                return (
                  <div
                    key={image.id}
                    className={`relative group rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                      isActive
                        ? "border-pink-500 shadow-lg ring-2 ring-pink-200"
                        : "border-gray-200 hover:border-pink-300"
                    }`}
                    onClick={() => selectActiveBanner(image.id)}
                    role="radio"
                    aria-checked={isActive}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        selectActiveBanner(image.id)
                      }
                    }}
                  >
                    {/* Imagen */}
                    <div className="relative aspect-video bg-gray-100">
                      <Image
                        src={image.url}
                        alt={image.name}
                        fill
                        className="object-cover"
                      />
                      
                      {/* Indicador de selección */}
                      {isActive && (
                        <div className="absolute top-2 right-2 bg-pink-500 text-white rounded-full p-1">
                          <Check className="h-4 w-4" />
                        </div>
                      )}

                      {/* Botón eliminar */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteImage(image.id)
                        }}
                        className="absolute top-2 left-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                        aria-label="Eliminar imagen"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Info */}
                    <div className="p-3 bg-white">
                      <p className="text-xs font-medium text-gray-700 truncate">
                        {image.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(image.uploadedAt).toLocaleDateString()}
                      </p>
                    </div>

                    {/* Radio visual */}
                    <div className="absolute bottom-3 right-3">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          isActive
                            ? "border-pink-500 bg-pink-500"
                            : "border-gray-400 bg-white"
                        }`}
                      >
                        {isActive && <div className="w-2 h-2 bg-white rounded-full" />}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {config.closedBannerImages.length > 0 && !config.activeBannerId && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <p className="text-sm text-amber-800">
                Selecciona un banner para mostrar cuando el local esté cerrado
              </p>
            </div>
          )}
        </div>

        {/* Botón guardar */}
        <div className="flex justify-end pt-4 border-t">
          <Button
            onClick={saveConfig}
            disabled={saving}
            className="bg-pink-500 hover:bg-pink-600"
          >
            {saving ? "Guardando..." : "Guardar Configuración"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

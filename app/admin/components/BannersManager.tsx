"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trash2, Upload, Loader2, Image as ImageIcon } from "lucide-react"
import { db, storage } from "@/lib/firebase"
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage"
import { toast } from "@/hooks/use-toast"
import Image from "next/image"

interface Banner {
  id: string
  desktopUrl: string
  desktopPath: string
  mobileUrl: string
  mobilePath: string
}

export default function BannersManager() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  
  const [desktopFile, setDesktopFile] = useState<File | null>(null)
  const [mobileFile, setMobileFile] = useState<File | null>(null)

  // Obtener Banners desde Firestore
  useEffect(() => {
    const q = query(collection(db, "banners"), orderBy("createdAt", "asc"))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedBanners = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Banner[]
      setBanners(fetchedBanners)
      setLoading(false)
    }, (error) => {
      console.error("Error al obtener banners:", error)
      toast({ title: "Error", description: "No se pudieron cargar los banners", variant: "destructive" })
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const handleUpload = async () => {
    if (!desktopFile || !mobileFile) {
      toast({
        title: "Faltan imágenes",
        description: "Debes seleccionar una imagen para Escritorio y otra para Móvil.",
        variant: "destructive"
      })
      return
    }

    setUploading(true)
    try {
      // Nombres y rutas únicas para el Storage
      const desktopPath = `Banners/desktop_${Date.now()}_${desktopFile.name}`
      const mobilePath = `Banners/mobile_${Date.now()}_${mobileFile.name}`

      const desktopRef = ref(storage, desktopPath)
      const mobileRef = ref(storage, mobilePath)

      // Subir archivos a Storage
      await uploadBytes(desktopRef, desktopFile)
      await uploadBytes(mobileRef, mobileFile)

      // Obtener URLs de descarga
      const desktopUrl = await getDownloadURL(desktopRef)
      const mobileUrl = await getDownloadURL(mobileRef)

      // Guardar registro en Firestore
      await addDoc(collection(db, "banners"), {
        desktopUrl,
        desktopPath,
        mobileUrl,
        mobilePath,
        createdAt: serverTimestamp()
      })

      toast({
        title: "Banners subidos",
        description: "El nuevo banner se ha agregado correctamente al inicio.",
      })

      // Limpiar inputs
      setDesktopFile(null)
      setMobileFile(null)
      const fileInputs = document.querySelectorAll('input[type="file"]') as NodeListOf<HTMLInputElement>;
      fileInputs.forEach(input => input.value = '');

    } catch (error) {
      console.error("Error al subir banners:", error)
      toast({
        title: "Error al subir",
        description: "Ocurrió un problema al subir las imágenes.",
        variant: "destructive"
      })
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (banner: Banner) => {
    if (!window.confirm("¿Estás seguro de que quieres eliminar este banner?")) return

    try {
      // Eliminar de Storage
      if (banner.desktopPath) await deleteObject(ref(storage, banner.desktopPath)).catch(() => console.log("Archivo desktop no encontrado"))
      if (banner.mobilePath) await deleteObject(ref(storage, banner.mobilePath)).catch(() => console.log("Archivo móvil no encontrado"))
      
      // Eliminar de Firestore
      await deleteDoc(doc(db, "banners", banner.id))

      toast({ title: "Banner eliminado", description: "El banner ha sido removido exitosamente." })
    } catch (error) {
      console.error("Error al eliminar banner:", error)
      toast({ title: "Error", description: "No se pudo eliminar el banner completo.", variant: "destructive" })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-pink-600" />
          Gestor de Banners Dinámicos
        </CardTitle>
        <CardDescription>
          Agrega o elimina las imágenes promocionales del inicio. Recomendado: Desktop (1920x600px), Móvil (800x800px).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Formulario de Carga */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
          <h3 className="font-medium text-gray-900 dark:text-gray-100">Subir nuevo banner</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="desktop-banner">Versión Escritorio</Label>
              <Input id="desktop-banner" type="file" accept="image/*" onChange={(e) => setDesktopFile(e.target.files?.[0] || null)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobile-banner">Versión Móvil</Label>
              <Input id="mobile-banner" type="file" accept="image/*" onChange={(e) => setMobileFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
            <Button onClick={handleUpload} disabled={uploading || !desktopFile || !mobileFile} className="w-full sm:w-auto bg-pink-600 hover:bg-pink-700">
              {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              {uploading ? "Guardando y publicando..." : "Guardar y Publicar Banners"}
            </Button>
            {(!desktopFile || !mobileFile) && (
              <span className="text-sm text-amber-600 dark:text-amber-500 font-medium flex items-center">⚠️ Selecciona ambas versiones para habilitar el guardado.</span>
            )}
          </div>
        </div>

        {/* Lista de Banners Activos */}
        <div className="space-y-4">
          <h3 className="font-medium text-gray-900 dark:text-gray-100">Banners Activos ({banners.length})</h3>
          
          {loading ? (
            <p className="text-sm text-gray-500">Cargando banners...</p>
          ) : banners.length === 0 ? (
            <p className="text-sm text-gray-500 italic">No hay banners configurados actualmente.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {banners.map((banner, index) => (
                <div key={banner.id} className="relative group rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-white p-2">
                  <p className="text-xs font-semibold text-gray-500 mb-2">Banner #{index + 1}</p>
                  <div className="flex gap-2 h-24">
                    <div className="relative w-2/3 h-full bg-gray-100 rounded overflow-hidden">
                      <Image src={banner.desktopUrl} alt="Desktop" fill className="object-cover" />
                      <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">Desktop</span>
                    </div>
                    <div className="relative w-1/3 h-full bg-gray-100 rounded overflow-hidden">
                      <Image src={banner.mobileUrl} alt="Mobile" fill className="object-cover" />
                      <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">Móvil</span>
                    </div>
                  </div>
                  <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDelete(banner)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
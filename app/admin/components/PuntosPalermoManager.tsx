"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trash2, Upload, Loader2, Sparkles, Image as ImageIcon } from "lucide-react"
import { db, storage } from "@/lib/firebase"
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage"
import { toast } from "@/hooks/use-toast"
import Image from "next/image"

interface PuntosProducto {
  id: string
  nombre: string
  puntos: number
  imagenUrl: string
  imagenPath: string
}

export default function PuntosPalermoManager() {
  const [productos, setProductos] = useState<PuntosProducto[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  const [nombre, setNombre] = useState("")
  const [puntos, setPuntos] = useState<number | "">("")
  const [imageFile, setImageFile] = useState<File | null>(null)

  // Obtener Productos del catálogo de canjes desde Firestore
  useEffect(() => {
    const q = query(collection(db, "puntos_palermo_catalogo"), orderBy("puntos", "asc"))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedProducts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PuntosProducto[]
      setProductos(fetchedProducts)
      setLoading(false)
    }, (error) => {
      console.error("Error al obtener productos canjeables:", error)
      toast({ title: "Error", description: "No se pudieron cargar los productos del catálogo", variant: "destructive" })
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const handleUpload = async () => {
    if (!nombre.trim()) {
      toast({ title: "Falta información", description: "Por favor ingresa el nombre del producto.", variant: "destructive" })
      return
    }
    if (!puntos || Number(puntos) <= 0) {
      toast({ title: "Falta información", description: "Por favor ingresa una cantidad de puntos válida.", variant: "destructive" })
      return
    }
    if (!imageFile) {
      toast({ title: "Falta información", description: "Debes seleccionar una imagen para el producto.", variant: "destructive" })
      return
    }

    setUploading(true)
    try {
      // Ruta única para guardar la imagen en Storage
      const fileExtension = imageFile.name.split('.').pop() || 'jpg'
      const imagenPath = `puntos_palermo_catalogo/${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExtension}`
      const storageRef = ref(storage, imagenPath)

      // Subir archivo a Firebase Storage
      await uploadBytes(storageRef, imageFile)

      // Obtener la URL pública de descarga
      const imagenUrl = await getDownloadURL(storageRef)

      // Guardar el registro del producto en Firestore
      await addDoc(collection(db, "puntos_palermo_catalogo"), {
        nombre: nombre.trim(),
        puntos: Number(puntos),
        imagenUrl,
        imagenPath,
        createdAt: serverTimestamp()
      })

      toast({
        title: "Producto agregado",
        description: "El producto se ha agregado correctamente al catálogo de canjes.",
      })

      // Limpiar formulario
      setNombre("")
      setPuntos("")
      setImageFile(null)
      const fileInput = document.getElementById("product-image") as HTMLInputElement
      if (fileInput) fileInput.value = ""

    } catch (error) {
      console.error("Error al subir el producto canjeable:", error)
      toast({
        title: "Error al guardar",
        description: "Hubo un problema al subir la imagen o registrar el producto.",
        variant: "destructive"
      })
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (producto: PuntosProducto) => {
    if (!window.confirm(`¿Estás seguro de que quieres eliminar "${producto.nombre}" del catálogo?`)) return

    try {
      // 1. Eliminar archivo de Storage si existe
      if (producto.imagenPath) {
        await deleteObject(ref(storage, producto.imagenPath)).catch((err) => {
          console.warn("No se pudo eliminar la imagen del Storage (puede que ya no exista):", err)
        })
      }

      // 2. Eliminar registro de Firestore
      await deleteDoc(doc(db, "puntos_palermo_catalogo", producto.id))

      toast({
        title: "Producto eliminado",
        description: "El producto ha sido removido exitosamente del catálogo.",
      })
    } catch (error) {
      console.error("Error al eliminar producto del catálogo:", error)
      toast({
        title: "Error",
        description: "No se pudo eliminar el producto correctamente.",
        variant: "destructive"
      })
    }
  }

  return (
    <Card className="shadow-lg border-2 border-pink-100/50">
      <CardHeader className="border-b border-pink-50 pb-4">
        <CardTitle className="flex items-center gap-2 text-2xl font-bold text-gray-800 dark:text-white">
          <Sparkles className="w-6 h-6 text-pink-600 animate-pulse" />
          Administrador de Catálogo: Puntos Palermo
        </CardTitle>
        <CardDescription className="text-gray-500">
          Agrega, edita y elimina productos que los clientes pueden canjear usando sus Puntos Palermo acumulados.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-8 pt-6">
        
        {/* Formulario para Agregar Nuevo Producto */}
        <div className="p-6 bg-gradient-to-br from-pink-50/20 via-white to-amber-50/10 dark:from-gray-800/40 dark:to-gray-800/20 rounded-2xl border-2 border-pink-50 dark:border-gray-700 space-y-6">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-pink-500" />
            Agregar Producto Canjeable
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Nombre */}
            <div className="space-y-2 col-span-1 md:col-span-2">
              <Label htmlFor="product-name" className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Nombre del Producto
              </Label>
              <Input
                id="product-name"
                placeholder="Ej. Pizza Pepperoni Familiar Gratis, Gauchitos..."
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="focus-visible:ring-pink-500"
              />
            </div>

            {/* Puntos Requeridos */}
            <div className="space-y-2">
              <Label htmlFor="product-points" className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Puntos para Canje
              </Label>
              <Input
                id="product-points"
                type="number"
                min="1"
                placeholder="Ej. 12000"
                value={puntos}
                onChange={(e) => setPuntos(e.target.value === "" ? "" : Number(e.target.value))}
                className="focus-visible:ring-pink-500"
              />
            </div>

            {/* Subida de Imagen */}
            <div className="space-y-2 col-span-1 md:col-span-3">
              <Label htmlFor="product-image" className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Imagen del Producto
              </Label>
              <div className="flex items-center justify-center w-full">
                <label
                  htmlFor="product-image"
                  className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-pink-200 dark:border-gray-600 rounded-2xl cursor-pointer bg-white/50 hover:bg-pink-50/10 dark:bg-gray-800 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 text-pink-500 mb-2" />
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {imageFile ? (
                        <span className="font-semibold text-pink-600">{imageFile.name}</span>
                      ) : (
                        <span>Haz clic para subir la imagen del producto</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">PNG, JPG o WEBP (Recomendado 500x500px)</p>
                  </div>
                  <input
                    id="product-image"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              onClick={handleUpload}
              disabled={uploading || !nombre || !puntos || !imageFile}
              className="w-full sm:w-auto bg-pink-600 hover:bg-pink-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all"
            >
              {uploading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Upload className="w-5 h-5 mr-2" />}
              {uploading ? "Agregando al Catálogo..." : "Agregar al Catálogo de Canjes"}
            </Button>
          </div>
        </div>

        {/* Listado de Productos Registrados */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-pink-500" />
            Catálogo de Canjes Activo ({productos.length})
          </h3>

          {loading ? (
            <div className="flex items-center gap-2 text-gray-500 py-4 italic">
              <Loader2 className="w-5 h-5 animate-spin text-pink-600" />
              <span>Cargando productos del catálogo...</span>
            </div>
          ) : productos.length === 0 ? (
            <p className="text-sm text-gray-400 italic py-6 text-center border-2 border-dashed border-gray-100 rounded-xl bg-gray-50/50">
              No hay productos registrados en el catálogo de canjes. Agrega el primero usando el formulario de arriba.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {productos.map((prod) => (
                <div
                  key={prod.id}
                  className="relative group rounded-2xl overflow-hidden border-2 border-pink-50 dark:border-gray-700 shadow-md hover:shadow-xl hover:border-pink-200 transition-all bg-white dark:bg-gray-850 p-3"
                >
                  <div className="relative aspect-square w-full bg-pink-50/30 rounded-xl overflow-hidden mb-3 border border-pink-50/50">
                    <Image
                      src={prod.imagenUrl}
                      alt={prod.nombre}
                      fill
                      className="object-cover"
                    />
                  </div>
                  
                  <div className="space-y-1.5 px-1">
                    <h4 className="font-extrabold text-black text-base line-clamp-1">
                      {prod.nombre}
                    </h4>
                    
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 bg-pink-50 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 px-2 py-1 rounded-lg text-xs font-black">
                        <Sparkles className="w-3.5 h-3.5" />
                        {prod.puntos.toLocaleString('es-CL')} pts
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-5 right-5 h-8 w-8 opacity-0 group-hover:opacity-100 shadow-md transition-opacity duration-200 rounded-full"
                    onClick={() => handleDelete(prod)}
                    title="Eliminar del catálogo"
                  >
                    <Trash2 className="w-4 h-4" />
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

"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { db } from "@/lib/firebase"
import { collection, onSnapshot, query, orderBy } from "firebase/firestore"

export default function BannerCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)
  const [banners, setBanners] = useState<any[]>([])

  // Sincronizar cache y Firestore de forma segura tras el montaje en el cliente
  // Esto previene errores de hidratación en Next.js (SSR) al asegurar que el primer renderizado
  // del cliente y del servidor coincidan con un arreglo vacío, para luego actualizarse inmediatamente.
  useEffect(() => {
    // 1. Cargar desde la caché local en el cliente inmediatamente
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("cachedBanners")
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          if (Array.isArray(parsed) && parsed.length > 0) {
            setBanners(parsed)
          }
        } catch (e) {
          console.error("Error al parsear banners de localStorage:", e)
        }
      }
    }

    // 2. Establecer listener en tiempo real con Firestore
    const q = query(collection(db, "banners"), orderBy("createdAt", "asc"))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedBanners = snapshot.docs.map(doc => ({
        id: doc.id,
        desktop: doc.data().desktopUrl,
        mobile: doc.data().mobileUrl
      }))

      if (fetchedBanners.length > 0) {
        setBanners(fetchedBanners)
        if (typeof window !== "undefined") {
          localStorage.setItem("cachedBanners", JSON.stringify(fetchedBanners))
        }
      } else {
        setBanners([])
        if (typeof window !== "undefined") {
          localStorage.removeItem("cachedBanners")
        }
      }
    }, (error) => {
      console.error("Error al sincronizar banners con Firestore:", error)
    })

    return () => unsubscribe()
  }, [])

  // Ajustar el slide actual si el índice queda fuera de rango al borrar o cambiar banners
  useEffect(() => {
    if (currentSlide >= banners.length && banners.length > 0) {
      setCurrentSlide(0)
    }
  }, [banners, currentSlide])

  // Autoplay: cambiar slide cada 3 segundos
  useEffect(() => {
    if (!isAutoPlaying || banners.length <= 1) return

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % banners.length)
    }, 3000)

    return () => clearInterval(interval)
  }, [isAutoPlaying, banners.length])

  const goToSlide = (index: number) => {
    setCurrentSlide(index)
    setIsAutoPlaying(false)
    // Reactivar autoplay después de 10 segundos de inactividad
    setTimeout(() => setIsAutoPlaying(true), 10000)
  }

  const goToPrevious = () => {
    const newIndex = currentSlide === 0 ? banners.length - 1 : currentSlide - 1
    goToSlide(newIndex)
  }

  const goToNext = () => {
    const newIndex = (currentSlide + 1) % banners.length
    goToSlide(newIndex)
  }

  // Mientras se obtienen las imágenes, no renderiza nada en el HTML inicial para evitar parpadeos y errores de hidratación
  if (banners.length === 0) return null

  return (
    <section className="relative w-full overflow-hidden bg-gray-950">
      {/* Contenedor del carrusel */}
      <div className="relative w-full h-[300px] sm:h-[400px] md:h-[500px] lg:h-[600px]">
        {/* Slides */}
        <div 
          className="banner-carousel-slides flex h-full"
          style={{ 
            transform: `translateX(-${currentSlide * 100}%)`,
            transition: 'transform 1s ease-in-out'
          }}
        >
          {banners.map((banner, index) => (
            <div key={banner.id} className="min-w-full h-full relative flex-shrink-0">
              {/* Imagen Desktop: Se oculta en móviles nativamente mediante CSS */}
              <Image
                src={banner.desktop}
                alt={`Banner promocional ${index + 1}`}
                fill
                className="hidden md:block object-cover"
                priority={index === 0}
                quality={90}
              />
              {/* Imagen Mobile: Se muestra en móviles nativamente mediante CSS */}
              <Image
                src={banner.mobile}
                alt={`Banner promocional ${index + 1} móvil`}
                fill
                className="block md:hidden object-cover"
                priority={index === 0}
                quality={90}
              />
            </div>
          ))}
        </div>

        {/* Controles de navegación - Flechas */}
        {banners.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-pink-400 transition-all hover:scale-110 z-10 drop-shadow-lg"
              aria-label="Banner anterior"
            >
              <ChevronLeft className="w-8 h-8 sm:w-10 sm:h-10" strokeWidth={3} />
            </button>
            
            <button
              onClick={goToNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-pink-400 transition-all hover:scale-110 z-10 drop-shadow-lg"
              aria-label="Siguiente banner"
            >
              <ChevronRight className="w-8 h-8 sm:w-10 sm:h-10" strokeWidth={3} />
            </button>
          </>
        )}

        {/* Indicadores (dots) */}
        {banners.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 hidden sm:flex gap-3 z-10">
            {banners.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`transition-all rounded-full ${
                  currentSlide === index
                    ? "bg-pink-500 w-10 h-3"
                    : "bg-white/60 hover:bg-white/80 w-3 h-3"
                }`}
                aria-label={`Ir al banner ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

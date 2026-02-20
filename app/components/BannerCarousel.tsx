"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight } from "lucide-react"

export default function BannerCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isMobile, setIsMobile] = useState(false)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)

  // Banners con diferentes diseños
  const banners = [
    { id: 1, desktop: "/banners/desktop_banner.jpg", mobile: "/banners/movil_banner.jpg" },
    { id: 2, desktop: "/banners/desktop_banner2.jpg", mobile: "/banners/movil_banner2.jpg" },
  ]

  // Detectar si es móvil
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener("resize", checkMobile)
    
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // Autoplay: cambiar slide cada 3 segundos (más dinámico)
  useEffect(() => {
    if (!isAutoPlaying) return

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % banners.length)
    }, 3000) // 3 segundos

    return () => clearInterval(interval)
  }, [isAutoPlaying, banners.length])

  const goToSlide = (index: number) => {
    setCurrentSlide(index)
    setIsAutoPlaying(false)
    // Reactivar autoplay después de 10 segundos de interacción manual
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

  return (
    <section className="relative w-full overflow-hidden bg-gray-900">
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
              <Image
                src={isMobile ? banner.mobile : banner.desktop}
                alt={`Banner promocional ${index + 1}`}
                fill
                className="object-cover"
                priority={index === 0}
                quality={90}
              />
            </div>
          ))}
        </div>

        {/* Controles de navegación - Flechas */}
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

        {/* Indicadores (dots) */}
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
      </div>
    </section>
  )
}

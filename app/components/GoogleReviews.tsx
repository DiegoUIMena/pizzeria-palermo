"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface Review {
  id: string
  authorName: string
  authorType: string
  rating: number
  text: string
  timeDescription: string
  bgAvatarColor: string
}

export default function GoogleReviews() {
  const [currentPage, setCurrentPage] = useState(0)
  const [isDesktop, setIsDesktop] = useState(false)
  const touchStartX = useRef<number | null>(null)
  const touchEndX = useRef<number | null>(null)

  const reviews: Review[] = [
    {
      id: "1",
      authorName: "Natalia Orellana",
      authorType: "Local Guide",
      rating: 5,
      text: "Las mejores pizzas de Los Andes, masa e ingredientes exquisitos, además de una excelente atención y rápida entrega. 100% recomendado.",
      timeDescription: "Hace 6 meses",
      bgAvatarColor: "bg-pink-600 text-white"
    },
    {
      id: "2",
      authorName: "N.G. Kostitzer",
      authorType: "Local Guide",
      rating: 5,
      text: "Probé la de carne y es realmente maravillosa. Muy buen tamaño y exquisita masa. Muy atentos. 100% recomendados.",
      timeDescription: "Hace 10 meses",
      bgAvatarColor: "bg-blue-600 text-white"
    },
    {
      id: "3",
      authorName: "Sebastián Astudillo",
      authorType: "Local Guide",
      rating: 5,
      text: "Excelente pizzería, el sabor es espectacular, los tiempos de entrega muy bien coordinados. Todo 10 de 10.",
      timeDescription: "Hace 1 year",
      bgAvatarColor: "bg-amber-500 text-white"
    },
    {
      id: "4",
      authorName: "Diego F.",
      authorType: "Local Guide",
      rating: 5,
      text: "Excelente sabor de las pizzas, buena variedad de ingredientes y muy rápida la entrega. Muy buen servicio al cliente.",
      timeDescription: "Hace 2 semanas",
      bgAvatarColor: "bg-emerald-600 text-white"
    },
    {
      id: "5",
      authorName: "Camila V.",
      authorType: "Local Guide",
      rating: 5,
      text: "Las mejores pizzas que he probado en la zona. La masa es crujiente y deliciosa, y los ingredientes son súper frescos.",
      timeDescription: "Hace 3 meses",
      bgAvatarColor: "bg-purple-600 text-white"
    },
    {
      id: "6",
      authorName: "Juan Pablo M.",
      authorType: "Local Guide",
      rating: 5,
      text: "Muy ricas pizzas, gran atención y la entrega a tiempo. Se nota la dedicación y el cariño con el que trabajan.",
      timeDescription: "Hace 8 meses",
      bgAvatarColor: "bg-cyan-600 text-white"
    },
    {
      id: "7",
      authorName: "Monica Muñoz Ramos",
      authorType: "Cliente",
      rating: 5,
      text: "Muy ricas las pizzas, excelente sabor y atención.",
      timeDescription: "Hace 1 año",
      bgAvatarColor: "bg-orange-600 text-white"
    },
    {
      id: "8",
      authorName: "Armate Tu",
      authorType: "Local Guide",
      rating: 5,
      text: "Las mejores pizzas de Los Andes, muy recomendables. Excelente masa y buena atención.",
      timeDescription: "Hace 1 año",
      bgAvatarColor: "bg-red-600 text-white"
    }
  ]

  // Detectar ancho de pantalla para cambiar la lógica del slider
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024)
    }
    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Controles de navegación del carrusel usando useCallback para evitar closures obsoletos en el timer
  const nextPage = useCallback(() => {
    setCurrentPage((prev) => {
      const maxPages = isDesktop ? 4 : reviews.length
      return (prev + 1) % maxPages
    })
  }, [isDesktop, reviews.length])

  const prevPage = useCallback(() => {
    setCurrentPage((prev) => {
      const maxPages = isDesktop ? 4 : reviews.length
      return (prev - 1 + maxPages) % maxPages
    })
  }, [isDesktop, reviews.length])

  // Ajustar la página actual si cambia de desktop a móvil para evitar desbordes
  useEffect(() => {
    const maxPages = isDesktop ? 4 : reviews.length
    setCurrentPage((prev) => (prev >= maxPages ? 0 : prev))
  }, [isDesktop, reviews.length])

  // Soporte de gestos táctiles (Swipe)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX
  }

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return
    
    const diff = touchStartX.current - touchEndX.current
    const minSwipeDistance = 50 // Distancia mínima en píxeles

    if (diff > minSwipeDistance) {
      nextPage()
    } else if (diff < -minSwipeDistance) {
      prevPage()
    }

    touchStartX.current = null
    touchEndX.current = null
  }

  // Auto avance suave cada 10 segundos
  useEffect(() => {
    const timer = setInterval(() => {
      nextPage()
    }, 10000)

    return () => clearInterval(timer)
  }, [nextPage])

  return (
    <section className="w-full py-12 md:py-16 bg-[#fcfbf9] border-t border-b border-gray-100 relative overflow-hidden select-none">
      {/* Estilos para forzar la animación lenta y el tamaño/reseteo exacto de los dots con !important */}
      <style dangerouslySetInnerHTML={{__html: `
        .reviews-slider-desktop {
          transition: transform 1.8s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
        .reviews-slider-mobile {
          transition: transform 1.4s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
        .reviews-slider-dot-desktop {
          width: 12px !important;
          height: 12px !important;
          min-width: 12px !important;
          min-height: 12px !important;
          max-width: 12px !important;
          max-height: 12px !important;
          padding: 0 !important;
          border: 0 !important;
          margin: 0 6px !important;
          outline: none !important;
          background-color: #d1d5db !important;
          border-radius: 9999px !important;
          box-sizing: border-box !important;
          cursor: pointer !important;
        }
        .reviews-slider-dot-desktop.active {
          width: 32px !important;
          max-width: 32px !important;
          background-color: #e21b70 !important;
        }
        .reviews-slider-dot-mobile {
          width: 10px !important;
          height: 10px !important;
          min-width: 10px !important;
          min-height: 10px !important;
          max-width: 10px !important;
          max-height: 10px !important;
          padding: 0 !important;
          border: 0 !important;
          margin: 0 5px !important;
          outline: none !important;
          background-color: #d1d5db !important;
          border-radius: 9999px !important;
          box-sizing: border-box !important;
          cursor: pointer !important;
        }
        .reviews-slider-dot-mobile.active {
          width: 24px !important;
          max-width: 24px !important;
          background-color: #e21b70 !important;
        }
        .gracias-signature-mobile {
          transform: translateX(-5%) !important;
          align-self: center !important;
        }
        @media (min-width: 1024px) {
          .gracias-signature-mobile {
            transform: translate(20%, 60%) !important;
            align-self: flex-start !important;
            margin-left: 0 !important;
          }
        }
      `}} />
      <div className="container mx-auto px-4 md:px-8">
        
        {/* Composición en Grid: 2 Columnas en Escritorio (lg) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center relative">
          
          {/* COLUMNA IZQUIERDA: Opiniones (ocupa 7 columnas de 12) */}
          <div className="lg:col-span-7 flex flex-col w-full">
            
            {/* Título de la sección */}
            <div className="flex items-center justify-center lg:justify-start gap-4 mb-3">
              {/* Icono de bocadillo fucsia con estrella */}
              <div className="w-12 h-12 bg-[#e21b70] rounded-2xl flex items-center justify-center text-white flex-shrink-0 shadow-md transform hover:scale-105 transition-transform duration-300">
                <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                  <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12l-3.09 1.62.59-3.44-2.5-2.44 3.46-.5L12 4l1.54 3.24 3.46.5-2.5 2.44.59 3.44L12 14z" />
                </svg>
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs md:text-sm font-black uppercase text-gray-900 tracking-wider">
                  LO QUE DICEN
                </span>
                <h2 className="text-2xl md:text-3xl font-black text-[#e21b70] uppercase tracking-tight leading-none">
                  NUESTROS CLIENTES
                </h2>
              </div>
            </div>

            {/* Subtítulo */}
            <p className="text-gray-600 text-xs md:text-sm font-medium mb-8 flex items-center justify-center lg:justify-start gap-1">
              Tu opinión nos ayuda a seguir mejorando cada día <span className="text-[#e21b70] text-sm">❤</span>
            </p>

            {/* VISTA DESKTOP: Carrusel de 4 páginas (2 tarjetas a la vez) con una sola tira continua y gap-4 idéntico entre todas las tarjetas */}
            <div className="hidden lg:block w-full overflow-hidden relative lg:-mx-8 lg:px-8 lg:py-10 -mx-4 px-4 py-4">
              <div 
                className="flex reviews-slider-desktop w-full gap-4"
                style={{ transform: `translateX(calc(-${currentPage * 100}% - ${currentPage * 16}px))` }}
              >
                {reviews.map((review) => (
                  <div key={review.id} className="w-[calc((100%-16px)/2)] flex-shrink-0 lg:pb-8 lg:pt-4 pb-4 pt-2">
                    <ReviewCard review={review} />
                  </div>
                ))}
              </div>
            </div>

            {/* VISTA MÓVIL Y TABLET: Carrusel Interactivo (lg:hidden) */}
            <div 
              className="block lg:hidden w-full overflow-hidden relative -mx-4 px-4 py-4"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div 
                className="flex reviews-slider-mobile"
                style={{ transform: `translateX(-${currentPage * 100}%)` }}
              >
                {reviews.map((review) => (
                  <div key={review.id} className="w-full flex-shrink-0 px-2 pb-4 pt-2">
                    <ReviewCard review={review} isMobile={true} />
                  </div>
                ))}
              </div>
            </div>

            {/* Controles de Navegación del Carrusel (Sólo Dots) para Desktop y Móvil */}
            <div className="flex items-center justify-center mt-6 py-2">
              {/* Dots Indicadores de Posición */}
              <div className="flex gap-1.5 items-center justify-center">
                {isDesktop ? (
                  [0, 1, 2, 3].map((pageIdx) => (
                    <button
                      key={pageIdx}
                      onClick={() => setCurrentPage(pageIdx)}
                      className={`reviews-slider-dot-desktop transition-all duration-300 block ${
                        currentPage === pageIdx ? "active" : ""
                      }`}
                      aria-label={`Ir a página ${pageIdx + 1}`}
                    />
                  ))
                ) : (
                  reviews.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentPage(index)}
                      className={`reviews-slider-dot-mobile transition-all duration-300 block ${
                        currentPage === index ? "active" : ""
                      }`}
                      aria-label={`Ir a opinión ${index + 1}`}
                    />
                  ))
                )}
              </div>
            </div>

          </div>

          {/* DIVISOR VERTICAL (Dashed Border Fucsia) */}
          <div className="hidden lg:block absolute left-[58%] top-0 bottom-0 w-px border-l-2 border-dashed border-[#e21b70]/20 pointer-events-none" />

          {/* COLUMNA DERECHA: Invitación a Opinar (ocupa 5 columnas de 12) */}
          <div className="lg:col-span-5 flex flex-col items-center text-center lg:pl-10 relative pb-12 lg:pb-16 mt-6 lg:mt-0">
            
            {/* Cinco estrellas de valoración grandes */}
            <div className="flex gap-1.5 justify-center mb-4">
              {[...Array(5)].map((_, i) => (
                <svg key={i} className="w-6 h-6 text-amber-400 fill-amber-400 transform hover:scale-110 transition-transform duration-200" viewBox="0 0 24 24">
                  <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                </svg>
              ))}
            </div>

            {/* Títulos */}
            <h3 className="text-xl md:text-2xl font-black text-gray-950 uppercase tracking-tight leading-none mb-1">
              ¿QUÉ TE PARECIÓ
            </h3>
            <h3 className="text-2xl md:text-3xl font-black text-[#e21b70] uppercase tracking-tight leading-none mb-4">
              PALERMO?
            </h3>

            {/* Texto Explicativo */}
            <p className="text-gray-600 text-xs md:text-sm font-medium leading-relaxed max-w-sm mb-6">
              Tu opinión en Google ayuda a otros clientes a conocernos y nos motiva a seguir entregando lo mejor.
            </p>

            {/* Botón de Llamado a la Acción (CTA) */}
            <Link 
              href="https://short.do/-vfk8Z"
              target="_blank"
              rel="noopener noreferrer"
              className="relative w-full max-w-xs group z-20"
            >
              <button 
                className="w-full flex items-center justify-between bg-[#e21b70] hover:bg-[#c2145d] text-white py-3.5 px-6 rounded-full font-black text-[11px] md:text-[12px] uppercase tracking-wider transition-all duration-300 shadow-[0_4px_15px_rgba(226,27,112,0.3)] hover:shadow-[0_8px_25px_rgba(226,27,112,0.4)] hover:scale-[1.03] active:scale-[0.98] outline-none"
              >
                {/* Logo Google en círculo blanco a la izquierda */}
                <div className="w-7 h-7 bg-white rounded-full flex items-center justify-center flex-shrink-0 shadow-sm transition-transform duration-300 group-hover:rotate-12">
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                </div>
                
                {/* Texto del Botón */}
                <span className="flex-1 text-center font-bold px-2 whitespace-nowrap">
                  DEJAR UNA OPINIÓN EN GOOGLE MAPS
                </span>

                {/* Flecha derecha indicadora a la derecha */}
                <ChevronRight className="w-5 h-5 flex-shrink-0 transition-transform duration-300 group-hover:translate-x-1" />
              </button>
            </Link>

            {/* Frase animada de Palermo (¡Gracias por elegirnos!) */}
            <div className="mt-6 relative gracias-signature-mobile pointer-events-none select-none z-10 w-[216px] md:w-36 lg:w-64 xl:w-[300px]">
              <Image 
                src="/banners/gracias.gif"
                alt="¡Gracias por elegirnos!"
                width={216}
                height={65}
                className="h-auto w-full object-contain opacity-95"
                unoptimized
              />
            </div>

          </div>

        </div>

      </div>

      {/* Gata de Palermo con gorra y collar - Asoma en la esquina inferior derecha (Hijo directo de section para tocar la guarda de abajo) */}
      <div className="absolute right-0 md:right-4 lg:right-[2%] xl:right-[6%] bottom-0 w-28 md:w-36 lg:w-48 xl:w-56 -translate-x-[20%] md:translate-x-0 lg:translate-x-4 translate-y-1 lg:translate-y-2 pointer-events-none select-none z-10 overflow-visible">
        <Image 
          src="/banners/gata_google.gif"
          alt="Gata Palermo"
          width={160}
          height={160}
          className="h-auto w-full object-contain drop-shadow-md"
          unoptimized
        />
      </div>
    </section>
  )
}

// Componente Interno para la tarjeta de opinión
interface ReviewCardProps {
  review: Review
  isMobile?: boolean
}

function ReviewCard({ review, isMobile = false }: ReviewCardProps) {
  return (
    <div 
      className={`bg-white border border-gray-100 rounded-2xl p-6 flex flex-col justify-between min-h-[285px] h-full transition-all duration-300 ${
        isMobile 
          ? 'max-w-md mx-auto w-full shadow-[0_4px_20px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_25px_rgba(0,0,0,0.10)]' 
          : 'w-full shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:shadow-[0_15px_35px_rgba(0,0,0,0.12)] border-gray-100/90 transform hover:-translate-y-1.5'
      }`}
    >
      <div>
        {/* Cabecera del Autor (Avatar, Nombre y Valoración vertical) */}
        <div className="flex items-start gap-3.5 mb-3">
          {/* Avatar */}
          <div className={`w-10 h-10 rounded-full ${review.bgAvatarColor} flex items-center justify-center font-black text-sm shadow-inner flex-shrink-0 mt-0.5`}>
            {review.authorName.split(' ').map(n => n[0]).join('')}
          </div>
          {/* Info de Autor */}
          <div className="flex flex-col text-left flex-1 min-w-0">
            <span className="font-extrabold text-sm text-gray-900 leading-tight truncate">
              {review.authorName}
            </span>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
                {review.authorType}
              </span>
              {/* Estrellas de valoración */}
              <div className="flex gap-0.5 flex-shrink-0">
                {[...Array(review.rating)].map((_, i) => (
                  <svg key={i} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" viewBox="0 0 24 24">
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                  </svg>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Texto de la opinión */}
        <p className="text-gray-600 text-xs sm:text-[13px] font-semibold leading-relaxed text-left">
          &ldquo;{review.text}&rdquo;
        </p>
      </div>

      {/* Fila inferior: Logo Google y Fecha (Garantizado dentro de la tarjeta) */}
      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100 flex-shrink-0">
        <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider flex-shrink-0">
          {review.timeDescription}
        </span>
      </div>
    </div>
  )
}

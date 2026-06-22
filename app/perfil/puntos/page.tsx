'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/app/context/AuthContext'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import Header from '@/app/components/Header'
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'

const BANNERS = [
  '/banners/carrrusel1.gif',
  '/banners/carrrusel2.gif',
  '/banners/carrrusel3.gif',
  '/banners/carrrusel4.gif',
  '/banners/carrrusel5.gif',
]

export default function PuntosPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [totalPoints, setTotalPoints] = useState<number | null>(null)
  const [pointsLoading, setPointsLoading] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Redirección si no está logueado
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth')
      return
    }

    if (user?.id) {
      const loadPoints = async () => {
        try {
          const userRef = doc(db, 'users', user.id)
          const userDoc = await getDoc(userRef)
          if (userDoc.exists()) {
            setTotalPoints(userDoc.data().totalPoints || 0)
          } else {
            setTotalPoints(0)
          }
        } catch (error) {
          console.error('[PUNTOS] Error al cargar los puntos:', error)
          setTotalPoints(0)
        } finally {
          setPointsLoading(false)
        }
      }
      loadPoints()
    }
  }, [user, isLoading, router])

  // Lógica del carrusel automático de 3 segundos
  const resetTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
  }

  useEffect(() => {
    resetTimeout()
    timeoutRef.current = setTimeout(
      () =>
        setActiveIndex((prevIndex) =>
          prevIndex === BANNERS.length - 1 ? 0 : prevIndex + 1
        ),
      3000
    )

    return () => {
      resetTimeout()
    }
  }, [activeIndex])

  const nextSlide = () => {
    setActiveIndex((prev) => (prev === BANNERS.length - 1 ? 0 : prev + 1))
    resetTimeout()
  }

  const prevSlide = () => {
    setActiveIndex((prev) => (prev === 0 ? BANNERS.length - 1 : prev - 1))
    resetTimeout()
  }

  if (isLoading || pointsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-600 mb-4"></div>
            <p className="text-gray-600 font-medium">Cargando tus Puntos Palermo...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50/30 to-amber-50/20 text-[#1F2937] flex flex-col">
      {/* Cabecera Principal */}
      <Header />

      <main className="flex-1 container mx-auto px-4 py-12 max-w-5xl">
        {/* Sección de Puntos */}
        <div className="bg-white/95 backdrop-blur-sm border-2 border-pink-100 rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(219,39,119,0.06)] flex flex-col sm:flex-row items-center gap-6 sm:gap-8 hover:shadow-xl transition-all duration-300">
          <div className="relative flex-shrink-0">
            <img
              src="/iconos/puntos_palermo.svg"
              alt="Icono Puntos Palermo"
              className="w-[299px] h-auto sm:w-[377px] lg:w-[422px] object-contain hover:scale-105 transition-transform duration-300"
            />
          </div>

          <div className="flex-1 text-center sm:text-left space-y-1">
            <span className="text-gray-500 text-sm sm:text-base font-bold tracking-wider uppercase block">
              {user.name} tienes:
            </span>
            <div className="flex flex-col justify-center sm:justify-start">
              <span className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight text-pink-600 filter drop-shadow-sm leading-none">
                {totalPoints !== null ? totalPoints.toLocaleString('es-CL') : '0'}
              </span>
              <span className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-[#374151] mt-2 block">
                Puntos Palermo
              </span>
            </div>
          </div>
        </div>

        {/* Sección Destacados */}
        <div className="mt-16 space-y-6">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-wider">
              DESTACADOS
            </h2>
            <div className="flex-1 h-0.5 bg-gradient-to-r from-pink-300 to-transparent rounded" />
          </div>

          {/* Carrusel */}
          <div className="relative group overflow-hidden w-full py-2">
            <div
              className="flex transition-transform duration-500 ease-in-out"
              style={{
                transform: `translateX(-${activeIndex * 100}%)`,
              }}
            >
              {BANNERS.map((src, index) => (
                <div key={index} className="min-w-full flex-shrink-0 px-1">
                  <div className="relative overflow-hidden rounded-3xl border-2 border-pink-100 shadow-lg bg-white p-2 sm:p-3 hover:shadow-xl transition-all duration-300">
                    <div className="aspect-[16/9] sm:aspect-[2.5/1] w-full overflow-hidden rounded-2xl relative bg-gray-50">
                      <img
                        src={src}
                        alt={`Destacado ${index + 1}`}
                        className="w-full h-full object-cover select-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Controles de navegación lateral (desktop) */}
            <button
              onClick={prevSlide}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-800 p-3 rounded-full shadow-lg border border-gray-200 hover:text-pink-600 transition-all duration-200 hidden md:flex items-center justify-center opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 animate-fade-in"
              aria-label="Anterior destacado"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={nextSlide}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-800 p-3 rounded-full shadow-lg border border-gray-200 hover:text-pink-600 transition-all duration-200 hidden md:flex items-center justify-center opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 animate-fade-in"
              aria-label="Siguiente destacado"
            >
              <ChevronRight className="w-6 h-6" />
            </button>

            {/* Indicadores (dots) */}
            <div className="mt-8 flex justify-center items-center gap-2.5">
              {BANNERS.map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setActiveIndex(index)
                    resetTimeout()
                  }}
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    activeIndex === index
                      ? 'bg-pink-600 w-8 shadow-sm shadow-pink-500/50'
                      : 'bg-pink-200 w-2.5 hover:bg-pink-300'
                  }`}
                  aria-label={`Ir al banner ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

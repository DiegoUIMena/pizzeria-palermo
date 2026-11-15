"use client"

import { useState, useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { X } from "lucide-react"
import { useBusinessHours } from "@/hooks/useBusinessHours"

export default function ClosedBanner() {
  const pathname = usePathname()
  const { isOpen, config, activeBannerUrl } = useBusinessHours()
  const [shouldRender, setShouldRender] = useState(false)
  const [isAnimatingIn, setIsAnimatingIn] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // [DEBUG] Logging del estado
  useEffect(() => {
    console.log('[ClosedBanner] Estado actual:', {
      isOpen,
      activeBannerUrl,
      shouldRender,
      isAnimatingIn,
      isDismissed,
      config
    })
  }, [isOpen, activeBannerUrl, shouldRender, isAnimatingIn, isDismissed, config])

  // Precargar la imagen en cuanto se detecte
  useEffect(() => {
    if (activeBannerUrl && !isOpen) {
      const link = document.createElement('link')
      link.rel = 'preload'
      link.as = 'image'
      link.href = activeBannerUrl
      document.head.appendChild(link)
      
      return () => {
        if (document.head.contains(link)) {
          document.head.removeChild(link)
        }
      }
    }
  }, [activeBannerUrl, isOpen])

  const triggerCloseAnimation = (markDismissed = false) => {
    setIsAnimatingIn(false)
    if (markDismissed) {
      setIsDismissed(true)
    }
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current)
    }
    exitTimerRef.current = setTimeout(() => {
      setShouldRender(false)
    }, 450)
  }

  useEffect(() => {
    // Mostrar banner suavemente cuando el local esté cerrado
    if (!isOpen && activeBannerUrl && !isDismissed) {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current)
      }
      setShouldRender(true)

      // Pequeño delay en el siguiente frame para activar la transición de entrada fluida
      const enterFrame = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimatingIn(true)
        })
      })

      const autoHideTimer = setTimeout(() => {
        triggerCloseAnimation(false)
      }, 60000)

      return () => {
        cancelAnimationFrame(enterFrame)
        clearTimeout(autoHideTimer)
      }
    }
  }, [isOpen, activeBannerUrl, isDismissed])

  useEffect(() => {
    if (isOpen) {
      setIsDismissed(false)
      if (shouldRender) {
        triggerCloseAnimation(false)
      }
    }
  }, [isOpen, shouldRender])

  useEffect(() => {
    return () => {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current)
      }
    }
  }, [])

  const handleDismiss = () => {
    triggerCloseAnimation(true)
  }

  // No mostrar en rutas de administracion (MOVER DESPUES DE LOS HOOKS)
  const isAdminRoute = pathname?.startsWith('/admin')
  
  if (isAdminRoute) {
    return null
  }

  if (!activeBannerUrl || !shouldRender) {
    return null
  }

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 ${
        isAnimatingIn ? "pointer-events-auto" : "pointer-events-none"
      }`}
    >
      {/* Fondo oscuro con desenfoque progresivo */}
      <div 
        className={`closed-banner-backdrop absolute inset-0 bg-black/55 ${
          isAnimatingIn ? "is-open" : "is-closed"
        }`}
        onClick={handleDismiss}
      />
      
      {/* Contenedor del modal con animación elástica suave */}
      <div
        className={`closed-banner-card relative z-10 w-[95%] max-w-2xl flex flex-col items-center ${
          isAnimatingIn ? "is-open" : "is-closed"
        }`}
      >
        <div className="relative bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-100 w-fit max-w-full min-w-[280px] sm:min-w-[350px]">
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/75 text-white transition-all hover:scale-110 active:scale-95 p-2 rounded-full shadow-lg backdrop-blur-[2px]"
            aria-label="Cerrar banner"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-full flex items-center justify-center bg-gray-50 overflow-hidden">
            <img
              src={activeBannerUrl}
              alt="Local cerrado"
              className="w-auto max-w-full h-auto max-h-[65vh] object-contain block mx-auto"
            />
          </div>

          {config && (
            <div className="p-4 bg-gradient-to-r from-pink-500 to-pink-600 text-white text-center">
              <p className="text-sm sm:text-base font-semibold">
                Horario de atención: {config.openingTime} - {config.closingTime}
              </p>
              <p className="text-xs sm:text-sm opacity-90 mt-1 font-medium">
                ¡Vuelve pronto! Te esperamos con las mejores pizzas
              </p>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .closed-banner-backdrop {
          opacity: 0;
          backdrop-filter: blur(0px);
          -webkit-backdrop-filter: blur(0px);
          transition: opacity 420ms cubic-bezier(0.16, 1, 0.3, 1),
                      backdrop-filter 420ms cubic-bezier(0.16, 1, 0.3, 1),
                      -webkit-backdrop-filter 420ms cubic-bezier(0.16, 1, 0.3, 1) !important;
          will-change: opacity, backdrop-filter;
        }

        .closed-banner-backdrop.is-open {
          opacity: 1;
          backdrop-filter: blur(5px);
          -webkit-backdrop-filter: blur(5px);
        }

        .closed-banner-backdrop.is-closed {
          opacity: 0;
          backdrop-filter: blur(0px);
          -webkit-backdrop-filter: blur(0px);
        }

        .closed-banner-card {
          opacity: 0;
          transform: translate3d(0, 24px, 0) scale(0.92);
          transition: opacity 420ms cubic-bezier(0.16, 1, 0.3, 1),
                      transform 450ms cubic-bezier(0.16, 1, 0.3, 1) !important;
          will-change: opacity, transform;
        }

        .closed-banner-card.is-open {
          opacity: 1;
          transform: translate3d(0, 0, 0) scale(1);
        }

        .closed-banner-card.is-closed {
          opacity: 0;
          transform: translate3d(0, 18px, 0) scale(0.94);
          transition: opacity 360ms cubic-bezier(0.4, 0, 0.2, 1),
                      transform 380ms cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
      `}</style>
    </div>
  )
}

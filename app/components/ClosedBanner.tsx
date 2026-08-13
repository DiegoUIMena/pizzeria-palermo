"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { X } from "lucide-react"
import { useBusinessHours } from "@/hooks/useBusinessHours"

export default function ClosedBanner() {
  const pathname = usePathname()
  const { isOpen, config, activeBannerUrl } = useBusinessHours()
  const [isVisible, setIsVisible] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  // [DEBUG] Logging del estado
  useEffect(() => {
    console.log('[ClosedBanner] Estado actual:', {
      isOpen,
      activeBannerUrl,
      isVisible,
      isDismissed,
      config
    })
  }, [isOpen, activeBannerUrl, isVisible, isDismissed, config])

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

  useEffect(() => {
    // Mostrar banner inmediatamente cuando el local este cerrado
    if (!isOpen && activeBannerUrl && !isDismissed) {
      setIsVisible(true)

      const timer = setTimeout(() => {
        setIsVisible(false)
      }, 60000)

      return () => clearTimeout(timer)
    }
  }, [isOpen, activeBannerUrl, isDismissed])

  useEffect(() => {
    if (isOpen) {
      setIsDismissed(false)
      setIsVisible(false)
    }
  }, [isOpen])

  const handleDismiss = () => {
    setIsVisible(false)
    setIsDismissed(true)
  }

  // No mostrar en rutas de administracion (MOVER DESPUES DE LOS HOOKS)
  const isAdminRoute = pathname?.startsWith('/admin')
  
  if (isAdminRoute) {
    return null
  }

  if (isOpen || !activeBannerUrl || !isVisible) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[100]">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-[4px] animate-[fadeIn_0.3s_ease-out]"
        onClick={handleDismiss}
      />
      
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95%] max-w-2xl animate-[slideIn_0.4s_ease-out] flex flex-col items-center">
        <div className="relative bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-100 w-fit max-w-full min-w-[280px] sm:min-w-[350px]">
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/75 text-white transition-all hover:scale-110 p-2 rounded-full shadow-lg backdrop-blur-[2px]"
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
    </div>
  )
}


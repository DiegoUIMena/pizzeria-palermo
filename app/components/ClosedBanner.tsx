"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { X } from "lucide-react"
import Image from "next/image"
import { useBusinessHours } from "@/hooks/useBusinessHours"

export default function ClosedBanner() {
  const pathname = usePathname()
  const { isOpen, config, activeBannerUrl } = useBusinessHours()
  const [isVisible, setIsVisible] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  // 🔍 DEBUG: Logging del estado
  useEffect(() => {
    console.log('🎨 ClosedBanner - Estado actual:', {
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
        document.head.removeChild(link)
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
      
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95%] max-w-2xl animate-[slideIn_0.4s_ease-out]">
        <div className="relative bg-white rounded-lg shadow-2xl overflow-hidden">
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 z-10 text-white hover:text-gray-200 transition-all hover:scale-110"
            aria-label="Cerrar banner"
          >
            <X className="w-6 h-6 drop-shadow-lg" />
          </button>

          <div className="relative w-full aspect-video sm:aspect-[21/9] bg-gray-200">
            <Image
              src={activeBannerUrl}
              alt="Local cerrado"
              fill
              className="object-cover"
              priority
              unoptimized
              loading="eager"
            />
          </div>

          {config && (
            <div className="p-4 bg-gradient-to-r from-pink-500 to-pink-600 text-white text-center">
              <p className="text-sm sm:text-base font-medium">
                Horario de atencion: {config.openingTime} - {config.closingTime}
              </p>
              <p className="text-xs sm:text-sm opacity-90 mt-1">
                Vuelve pronto! Te esperamos con las mejores pizzas
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


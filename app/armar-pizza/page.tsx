"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Sparkles, Crown, Users } from "lucide-react"
import Header from "../components/Header"
import Footer from "../components/Footer"
import PizzaConfigModal from "../components/PizzaConfigModal"

export default function ArmarPizzaPage() {
  const router = useRouter()

  // Estados para el modal
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedPizzaType, setSelectedPizzaType] = useState<"promo" | "premium" | "duo">("promo")

  const handlePromoClick = () => {
    setSelectedPizzaType("promo")
    setIsModalOpen(true)
  }

  const handlePremiumClick = () => {
    setSelectedPizzaType("premium")
    setIsModalOpen(true)
  }

  const handleDuoClick = () => {
    setSelectedPizzaType("duo")
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
  }

  return (
    <div className="min-h-screen">
      <Header />

      {/* Botón de regreso flotante */}
      <div className="fixed top-20 left-4 z-50">
        <Link
          href="/"
          className="flex items-center bg-white/90 backdrop-blur-sm text-gray-700 px-4 py-2 rounded-full shadow-lg hover:bg-white hover:shadow-xl transition-all duration-300"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Volver</span>
        </Link>
      </div>

      {/* Contenedor principal - Grid Layout Responsive */}
      <div className="min-h-screen">
        {/* Grid de 3 secciones */}
        <div className="grid grid-cols-1 lg:grid-cols-3 min-h-screen">
          {/* Primera sección - PIZZA PROMO */}
          <section className="relative h-screen overflow-hidden">
            {/* Imagen de fondo */}
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{
                backgroundImage: `url('/pizza-promo-bg.png')`,
              }}
            >
              {/* Overlay para mejor legibilidad */}
              <div className="absolute inset-0 bg-black/40"></div>
            </div>

            {/* Contenido */}
            <div className="relative z-10 h-full flex flex-col items-center justify-center px-4 text-center">
              <div className="max-w-sm mx-auto">
                {/* Título */}
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-2xl xl:text-3xl 2xl:text-4xl font-bold text-white mb-4 drop-shadow-2xl">
                  Pizza
                  <span className="block text-pink-400">Promocional</span>
                </h1>

                {/* Subtítulo */}
                <p className="text-sm sm:text-base md:text-lg lg:text-sm xl:text-base text-white/90 mb-6 drop-shadow-lg">
                  Deliciosas pizzas con ingredientes frescos a precios increíbles
                </p>

                {/* Botón principal */}
                <Button
                  onClick={handlePromoClick}
                  size="lg"
                  className="bg-pink-600 hover:bg-pink-700 text-white font-bold text-base sm:text-lg lg:text-base xl:text-lg px-6 sm:px-8 lg:px-6 xl:px-8 py-3 sm:py-4 lg:py-3 xl:py-4 rounded-full shadow-2xl hover:shadow-pink-500/25 transform hover:scale-105 transition-all duration-300 min-h-[50px] min-w-[180px]"
                >
                  <Sparkles className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  PIZZA PROMO
                </Button>

                {/* Indicador de scroll - Solo visible en móvil */}
                <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce lg:hidden">
                  <div className="w-6 h-10 border-2 border-white/50 rounded-full flex justify-center">
                    <div className="w-1 h-3 bg-white/70 rounded-full mt-2 animate-pulse"></div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Segunda sección - PIZZA PREMIUM */}
          <section className="relative h-screen overflow-hidden">
            {/* Imagen de fondo */}
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{
                backgroundImage: `url('/pizza-premium-bg.png')`,
              }}
            >
              {/* Overlay para mejor legibilidad */}
              <div className="absolute inset-0 bg-gradient-to-br from-black/50 via-black/30 to-amber-900/40"></div>
            </div>

            {/* Contenido */}
            <div className="relative z-10 h-full flex flex-col items-center justify-center px-4 text-center">
              <div className="max-w-sm mx-auto">
                {/* Título */}
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-2xl xl:text-3xl 2xl:text-4xl font-bold text-white mb-4 drop-shadow-2xl">
                  Pizza
                  <span className="block text-amber-400">Premium</span>
                </h1>

                {/* Subtítulo */}
                <p className="text-sm sm:text-base md:text-lg lg:text-sm xl:text-base text-white/90 mb-6 drop-shadow-lg">
                  Ingredientes gourmet y sabores exclusivos para paladares exigentes
                </p>

                {/* Botón principal */}
                <Button
                  onClick={handlePremiumClick}
                  size="lg"
                  className="bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white font-bold text-base sm:text-lg lg:text-base xl:text-lg px-6 sm:px-8 lg:px-6 xl:px-8 py-3 sm:py-4 lg:py-3 xl:py-4 rounded-full shadow-2xl hover:shadow-amber-500/25 transform hover:scale-105 transition-all duration-300 min-h-[50px] min-w-[180px]"
                >
                  <Crown className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  PIZZA PREMIUM
                </Button>
              </div>
            </div>
          </section>

          {/* Tercera sección - PIZZA DUO */}
          <section className="relative h-screen overflow-hidden">
            {/* Imagen de fondo */}
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{
                backgroundImage: `url('/pizza-duo-bg.png')`,
              }}
            >
              {/* Overlay para mejor legibilidad */}
              <div className="absolute inset-0 bg-gradient-to-br from-purple-900/60 via-blue-900/40 to-indigo-900/50"></div>
            </div>

            {/* Contenido */}
            <div className="relative z-10 h-full flex flex-col items-center justify-center px-4 text-center">
              <div className="max-w-sm mx-auto">
                {/* Título */}
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-2xl xl:text-3xl 2xl:text-4xl font-bold text-white mb-4 drop-shadow-2xl">
                  Pizza
                  <span className="block text-blue-400">DUO</span>
                </h1>

                {/* Subtítulo */}
                <p className="text-sm sm:text-base md:text-lg lg:text-sm xl:text-base text-white/90 mb-6 drop-shadow-lg">
                  Perfecta para compartir, dos sabores en una sola pizza
                </p>

                {/* Botón principal */}
                <Button
                  onClick={handleDuoClick}
                  size="lg"
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold text-base sm:text-lg lg:text-base xl:text-lg px-6 sm:px-8 lg:px-6 xl:px-8 py-3 sm:py-4 lg:py-3 xl:py-4 rounded-full shadow-2xl hover:shadow-blue-500/25 transform hover:scale-105 transition-all duration-300 min-h-[50px] min-w-[180px]"
                >
                  <Users className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  PIZZA DUO
                </Button>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Modal de configuración */}
      <PizzaConfigModal isOpen={isModalOpen} onClose={handleCloseModal} pizzaType={selectedPizzaType} />

      <Footer />
    </div>
  )
}

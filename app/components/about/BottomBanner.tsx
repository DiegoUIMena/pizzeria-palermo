"use client"

import React from "react"

import Link from "next/link"

export default function BottomBanner() {
  return (
    <section className="relative w-full overflow-hidden bg-black">
      {/* Banner de Fondo Responsive con Alto Fluido Proporcional */}
      <picture className="w-full h-auto block pointer-events-none">
        <source srcSet="/conocenos/final_desktop.jpg" media="(min-width: 768px)" />
        <img
          src="/conocenos/final_movil.jpg"
          alt="Gracias por ser parte de esta historia - Acerca de Nosotros"
          className="w-full h-auto block"
        />
      </picture>

      {/* Botón "Ver Menú" para Versión Desktop (con animación de luz fucsia corriendo por el contorno) */}
      <div className="absolute top-1/2 left-[70%] lg:left-[72%] -translate-y-1/2 -translate-x-1/2 z-20 hidden md:block">
        <div className="relative group p-[2.5px] rounded-full overflow-hidden bg-[#e21b70]/20 flex items-center justify-center shadow-xl transition-all duration-300 hover:scale-105 hover:shadow-2xl">
          {/* Luz fucsia/blanca giratoria de fondo con important para asegurar la animación */}
          <div className="absolute inset-[-1000%] bg-[conic-gradient(from_90deg_at_50%_50%,#ffffff_0%,#ff5c93_25%,#e21b70_50%,transparent_80%)] !animate-[spin_2.2s_linear_infinite]" />
          
          {/* Botón real sobrepuesto con color fucsia original */}
          <Link
            href="/"
            className="relative z-10 w-full h-full bg-[#e21b70] hover:bg-[#c8125c] text-white text-sm lg:text-base font-black uppercase tracking-wider py-3.5 px-9 rounded-full transition-colors duration-300 flex items-center justify-center"
          >
            Ver Menú
          </Link>
        </div>
      </div>

      {/* Botón "Ver Menú" para Versión Móvil (con animación de luz fucsia corriendo por el contorno) */}
      <div className="absolute bottom-[16%] sm:bottom-[20%] left-[35%] -translate-x-1/2 z-20 block md:hidden">
        <div className="relative group p-[2.5px] rounded-full overflow-hidden bg-[#e21b70]/20 flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-105">
          {/* Luz fucsia/blanca giratoria de fondo con important */}
          <div className="absolute inset-[-1000%] bg-[conic-gradient(from_90deg_at_50%_50%,#ffffff_0%,#ff5c93_25%,#e21b70_50%,transparent_80%)] !animate-[spin_2.2s_linear_infinite]" />
          
          {/* Botón real sobrepuesto con color fucsia original */}
          <Link
            href="/"
            className="relative z-10 w-full h-full bg-[#e21b70] hover:bg-[#c8125c] text-white text-xs sm:text-sm font-black uppercase tracking-wider py-2.5 px-6 rounded-full transition-colors duration-300 flex items-center justify-center"
          >
            Ver Menú
          </Link>
        </div>
      </div>
    </section>
  )
}

"use client"

import React from "react"

export default function HeroBanner() {
  return (
    <section className="relative w-full overflow-hidden bg-black">
      {/* Banner de Fondo Responsive con Alto Fluido Proporcional para evitar recortes del texto en la imagen */}
      <picture className="w-full h-auto block pointer-events-none">
        <source srcSet="/conocenos/banner_desktop.jpg" media="(min-width: 768px)" />
        <img
          src="/conocenos/banner_movil.jpg"
          alt="Somos Palermo - Acerca de Nosotros"
          className="w-full h-auto block object-contain"
        />
      </picture>
    </section>
  )
}

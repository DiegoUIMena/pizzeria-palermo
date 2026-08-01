"use client"

import React from "react"
import ValueCard from "./ValueCard"

export default function ValuesSection() {
  const values = [
    {
      title: "INGREDIENTES SELECCIONADOS",
      description: "Elegimos lo mejor para que cada pizza tenga sabor y calidad excepcionales.",
      iconPath: "/conocenos/ingredientes.svg",
    },
    {
      title: "ATENCIÓN CERCANA",
      description: "Nos importa cada cliente. Queremos que te sientas como en casa.",
      iconPath: "/conocenos/cercania.svg",
    },
    {
      title: "DELIVERY RESPONSABLE",
      description: "Cumplimos con los tiempos y cuidamos cada pedido como si fuera para nosotros.",
      iconPath: "/conocenos/delivery.svg",
    },
    {
      title: "TECNOLOGÍA PROPIA",
      description: "Desarrollamos nuestro propio sistema para brindarte una experiencia rápida y segura.",
      iconPath: "/conocenos/notebook.svg",
    },
  ]

  return (
    <section className="pt-16 pb-0 md:pt-24 md:pb-0 bg-white">
      <div className="container mx-auto px-6 sm:px-12 lg:px-20">
        
        {/* Título de la Sección */}
        <div className="flex flex-col items-center justify-center text-center mb-12 md:mb-16 animate-fade-in">
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 uppercase tracking-tight">
            NUESTROS VALORES
          </h2>
          {/* Pincelada decorativa fucsia */}
          <svg viewBox="0 0 200 15" preserveAspectRatio="none" className="w-36 sm:w-44 h-2 sm:h-3 text-[#e21b70] mt-1 opacity-90">
            <path d="M5 10 C 50 2, 150 12, 195 5 C 150 7, 50 1, 5 10 Z" fill="currentColor" />
          </svg>
        </div>

        {/* Grid de Valores */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 items-stretch">
          {values.map((val, idx) => {
            const isLast = idx === values.length - 1
            return (
              <div
                key={idx}
                className={`w-full flex animate-fade-up
                  ${!isLast ? "border-b border-gray-100 pb-6 md:pb-8 lg:pb-0 lg:border-b-0 lg:border-r lg:pr-6" : ""}
                  ${idx === 1 ? "md:border-r-0 lg:border-r lg:pr-6" : ""}
                `}
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                <ValueCard
                  title={val.title}
                  description={val.description}
                  iconPath={val.iconPath}
                />
              </div>
            )
          })}
        </div>

      </div>
    </section>
  )
}

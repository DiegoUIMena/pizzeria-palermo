"use client"

import React from "react"
import HistoryImage from "./HistoryImage"
import HistoryText from "./HistoryText"

export default function HistorySection() {
  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="container mx-auto px-6 sm:px-12 lg:px-20">
        
        {/* Título de la Sección */}
        <div className="flex flex-col items-start mb-10 md:mb-14 animate-fade-in">
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 uppercase tracking-tight">
            NUESTRA HISTORIA
          </h2>
          {/* Pincelada decorativa fucsia */}
          <svg viewBox="0 0 200 15" preserveAspectRatio="none" className="w-36 sm:w-44 h-2 sm:h-3 text-[#e21b70] mt-1 opacity-90">
            <path d="M5 10 C 50 2, 150 12, 195 5 C 150 7, 50 1, 5 10 Z" fill="currentColor" />
          </svg>
        </div>

        {/* Distribución en dos columnas */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
          {/* Columna Izquierda: Imagen del Local */}
          <div className="lg:col-span-5 w-full flex justify-center">
            <HistoryImage />
          </div>

          {/* Columna Derecha: Texto e Historia */}
          <div className="lg:col-span-7 w-full flex items-start">
            <HistoryText />
          </div>
        </div>

      </div>
    </section>
  )
}

"use client"

import React from "react"

interface TeamCardProps {
  imagePath: string
  iconPath: string
  name: string
  roles: string[]
  description: string
}

export default function TeamCard({ imagePath, iconPath, name, roles, description }: TeamCardProps) {
  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-md border border-gray-100 flex flex-col sm:flex-row gap-5 items-stretch transform transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      
      {/* Columna Izquierda: Imagen y Círculo con Icono */}
      <div className="relative w-full sm:w-[150px] md:w-[170px] lg:w-[190px] aspect-[4/5] sm:aspect-[3/4] flex-shrink-0 bg-transparent">
        
        {/* Icono flotante en el vértice superior izquierdo, un poco más grande y sobresaliente */}
        <div className="absolute -top-3 -left-3 sm:-top-4 sm:-left-4 z-20 w-11 h-11 sm:w-13 sm:h-13 rounded-full flex items-center justify-center shadow-md overflow-hidden bg-transparent">
          <img
            src={iconPath}
            alt={`Icono de ${name}`}
            className="w-full h-full object-contain"
          />
        </div>

        {/* Imagen del integrante con esquinas redondeadas individuales para no recortar el icono */}
        <div className="w-full h-full rounded-2xl overflow-hidden border border-gray-100/50 bg-gray-50 shadow-sm">
          <img
            src={imagePath}
            alt={`Fotografía de ${name}`}
            className="w-full h-full object-cover object-center"
          />
        </div>
      </div>

      {/* Columna Derecha: Información */}
      <div className="flex-1 flex flex-col justify-between py-1">
        <div>
          {/* Nombre con tipografía manuscrita */}
          <h3 className="font-handwritten text-4xl sm:text-5xl text-[#e21b70] mb-3 leading-none select-none">
            {name}
          </h3>

          {/* Lista de viñetas con estrellas fucsia */}
          <ul className="space-y-1.5 mb-4">
            {roles.map((role, idx) => (
              <li key={idx} className="flex items-center text-gray-700 text-sm sm:text-base font-semibold">
                <span className="text-[#e21b70] text-[11px] sm:text-xs mr-2 select-none">★</span>
                {role}
              </li>
            ))}
          </ul>
        </div>

        {/* Descripción */}
        <p className="text-gray-500 text-xs sm:text-sm leading-relaxed border-t border-gray-100 pt-3">
          {description}
        </p>
      </div>

    </div>
  )
}

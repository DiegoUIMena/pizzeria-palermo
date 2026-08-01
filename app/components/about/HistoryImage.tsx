"use client"

import React from "react"

export default function HistoryImage() {
  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Imagen Principal del Local */}
      <div className="relative w-full overflow-hidden rounded-2xl shadow-lg border border-gray-100 group transition-all duration-300 hover:shadow-xl">
        <div className="aspect-[16/10] w-full bg-gray-100">
          <img
            src="/conocenos/local1.jpg"
            alt="Local Palermo Pizzas Los Andes - Fachada Principal"
            className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
          />
        </div>
      </div>

      {/* Galería Secundaria de Apoyo */}
      <div className="grid grid-cols-2 gap-4 w-full">
        {/* Imagen Secundaria 1 */}
        <div className="relative overflow-hidden rounded-xl shadow-md border border-gray-100 group transition-all duration-300 hover:shadow-lg">
          <div className="aspect-[16/10] w-full bg-gray-100">
            <img
              src="/conocenos/local2.jpg"
              alt="Local Palermo Pizzas Los Andes - Interior y Murales"
              className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        </div>

        {/* Imagen Secundaria 2 */}
        <div className="relative overflow-hidden rounded-xl shadow-md border border-gray-100 group transition-all duration-300 hover:shadow-lg">
          <div className="aspect-[16/10] w-full bg-gray-100">
            <img
              src="/conocenos/local3.jpg"
              alt="Local Palermo Pizzas Los Andes - Detalle de Fachada"
              className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

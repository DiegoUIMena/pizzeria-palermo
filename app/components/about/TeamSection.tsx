"use client"

import React from "react"
import TeamCard from "./TeamCard"

export default function TeamSection() {
  const members = [
    {
      name: "Fran",
      imagePath: "/conocenos/fran.jpg",
      iconPath: "/conocenos/corona.svg",
      roles: ["Cocinero", "Sommelier", "Diseñador", "Artista"],
      description: "El alma creativa detrás de nuestras recetas y sabores únicos.",
    },
    {
      name: "Diego",
      imagePath: "/conocenos/diego.jpg",
      iconPath: "/conocenos/rayito.svg",
      roles: ["Analista Programador", "Desarrollo del sistema web", "Tecnología", "Automatización"],
      description: "El cerebro tecnológico que hace posible tu experiencia en nuestra web.",
    },
    {
      name: "Silvy",
      imagePath: "/conocenos/silvy.jpg",
      iconPath: "/conocenos/corazon.svg",
      roles: ["Nuestra mascota", "Imagen de Palermo", "Estrella de marketing y redes sociales"],
      description: "La reina de la casa y la encargada de robarse todas las miradas.",
    },
  ]

  return (
    <section className="py-16 md:py-24 bg-gray-50 border-t border-b border-gray-100">
      <div className="container mx-auto px-6 sm:px-12 lg:px-20">
        
        {/* Título de la Sección */}
        <div className="flex flex-col items-center justify-center text-center mb-12 md:mb-16 animate-fade-in">
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 uppercase tracking-tight">
            QUIÉNES SOMOS
          </h2>
          {/* Pincelada decorativa fucsia */}
          <svg viewBox="0 0 200 15" preserveAspectRatio="none" className="w-32 sm:w-40 h-2 sm:h-3 text-[#e21b70] mt-1 opacity-90">
            <path d="M5 10 C 50 2, 150 12, 195 5 C 150 7, 50 1, 5 10 Z" fill="currentColor" />
          </svg>
        </div>

        {/* Grid de Miembros del Equipo */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10">
          {members.map((member, idx) => (
            <div 
              key={idx} 
              className="w-full flex justify-center animate-fade-up" 
              style={{ animationDelay: `${idx * 150}ms` }}
            >
              <TeamCard
                name={member.name}
                imagePath={member.imagePath}
                iconPath={member.iconPath}
                roles={member.roles}
                description={member.description}
              />
            </div>
          ))}
        </div>

      </div>
    </section>
  )
}

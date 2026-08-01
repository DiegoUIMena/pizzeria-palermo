"use client"

import React from "react"

export default function HistoryText() {
  return (
    <div className="relative w-full overflow-visible py-4">
      {/* Columna de Texto con Z-Index superior para asegurar la legibilidad del texto sobre la marca de agua */}
      <div className="relative z-10 w-full space-y-5 text-gray-700 text-sm sm:text-base leading-relaxed text-justify sm:text-left pr-4 sm:pr-8">
        <p>
          <span className="font-bold text-gray-950">Palermo Pizzas</span> nació en uno de los momentos más desafiantes de los últimos años: la pandemia. Lo que comenzó como una microempresa familiar impulsada por la convicción de seguir adelante, con el tiempo se transformó en un proyecto donde la pasión, la creatividad y la tecnología trabajan en conjunto para ofrecer una experiencia diferente.
        </p>
        <p>
          En el corazón de Palermo están <span className="font-bold text-[#e21b70]">Fran</span>, chileno, artista y diseñador por naturaleza, además de cocinero y sommelier, quien aporta la creatividad, el cuidado por los detalles y el compromiso con la calidad de cada preparación; y <span className="font-bold text-[#e21b70]">Diego</span>, argentino, apasionado por la programación y la tecnología, responsable de desarrollar las herramientas digitales que hacen posible una experiencia de compra moderna, rápida y segura.
        </p>
        <p>
          Junto a ellos está <span className="font-bold text-[#e21b70]">Silvy</span>, nuestra mascota y el rostro de Palermo Pizzas. Más que un personaje, representa el espíritu cercano, alegre y familiar que buscamos transmitir en cada detalle de nuestra marca y en la experiencia de nuestros clientes.
        </p>
        <p>
          Hoy seguimos siendo una empresa familiar, convencidos de que la mejor pizza no solo depende de buenos ingredientes, sino también de las personas que la hacen posible. Por eso trabajamos cada día para combinar <span className="font-bold text-gray-950">tradición, innovación y un servicio de calidad</span>, con el mismo entusiasmo con el que comenzó este proyecto.
        </p>
      </div>

      {/* Sello Decorativo - Posicionado de forma absoluta como Marca de Agua de Fondo Gigante Fucsia */}
      <div className="absolute top-4 sm:top-8 -right-24 sm:-right-36 lg:-right-48 z-0 w-80 h-80 sm:w-[440px] sm:h-[440px] flex items-center justify-center rotate-45 blur-[0.8px] opacity-[0.10] select-none pointer-events-none">
        {/* SVG del Sello Circular Hecho con Amor */}
        <svg viewBox="0 0 100 100" className="w-full h-full text-[#e21b70] fill-current">
          <defs>
            <path
              id="circlePath"
              d="M 50, 50 m -37, 0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0"
              fill="none"
            />
          </defs>
          <text className="text-[8.5px] font-black uppercase tracking-[0.36em] fill-current">
            <textPath href="#circlePath" startOffset="0%">
              HECHO CON AMOR • DESDE 2020 •
            </textPath>
          </text>
          {/* Corazón en el centro */}
          <path
            d="M 50, 58 
               C 50, 58 61, 49 59, 44
               C 57.5, 40 52, 40.5 50, 44.5
               C 48, 40.5 42.5, 40 41, 44
               C 39, 49 50, 58 50, 58 Z"
            fill="currentColor"
          />
        </svg>
      </div>
    </div>
  )
}

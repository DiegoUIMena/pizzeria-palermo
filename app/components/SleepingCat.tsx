"use client"

import { useEffect, useState } from 'react'
import Image from 'next/image'

export default function SleepingCat() {
  const [zPositions, setZPositions] = useState<Array<{ id: number; delay: number; left: string }>>([])

  useEffect(() => {
    // Generar símbolos Z con delays aleatorios
    const generateZ = () => {
      const id = Date.now()
      const delay = Math.random() * 3 // 0-3 segundos de delay
      const left = `${45 + Math.random() * 30}%` // Posición horizontal aleatoria cerca de la gatita
      
      setZPositions(prev => [...prev, { id, delay, left }])
      
      // Remover después de la animación
      setTimeout(() => {
        setZPositions(prev => prev.filter(z => z.id !== id))
      }, 4000 + delay * 1000)
    }

    // Generar Z cada 2-5 segundos (irregular)
    const scheduleNext = () => {
      const nextDelay = 2000 + Math.random() * 3000
      setTimeout(() => {
        generateZ()
        scheduleNext()
      }, nextDelay)
    }

    scheduleNext()
  }, [])

  return (
    <div className="relative inline-block">
      {/* Sombra proyectada - primero para que esté detrás */}
      <div 
        className="absolute left-1/2 -translate-x-1/2 bottom-1 w-[48px] h-[7px] sm:w-[58px] sm:h-[8px] rounded-full opacity-50 z-0"
        style={{
          background: 'radial-gradient(ellipse, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.4) 40%, transparent 100%)',
          filter: 'blur(1px)',
        }}
      />

      {/* Gatita durmiendo con animación de respiración */}
      <div className="cat-breathing relative z-10">
        <Image
          src="/iconos/gatita.svg"
          alt="Gatita durmiendo - Local cerrado"
          width={64}
          height={64}
          className="w-[52px] h-[52px] sm:w-[62px] sm:h-[62px]"
          priority
        />
      </div>

      {/* Símbolos Z flotantes */}
      <div className="absolute inset-0 pointer-events-none">
        {zPositions.map((z) => (
          <div
            key={z.id}
            className="absolute text-gray-400 font-bold z-floating"
            style={{
              left: z.left,
              bottom: '50%',
              animationDelay: `${z.delay}s`,
              fontSize: `${12 + Math.random() * 4}px`,
            }}
          >
            z
          </div>
        ))}
      </div>

      <style jsx>{`
        @keyframes breathing {
          0%, 100% {
            transform: scale(1) translateY(0);
          }
          50% {
            transform: scale(1.05) translateY(-2px);
          }
        }

        @keyframes floatZ {
          0% {
            opacity: 0;
            transform: translateY(0) translateX(0) rotate(0deg);
          }
          20% {
            opacity: 0.7;
          }
          80% {
            opacity: 0.5;
          }
          100% {
            opacity: 0;
            transform: translateY(-45px) translateX(10px) rotate(12deg);
          }
        }

        :global(.cat-breathing) {
          animation: breathing 3.5s ease-in-out infinite !important;
          will-change: transform;
        }

        :global(.z-floating) {
          animation: floatZ 4s ease-out forwards !important;
          will-change: transform, opacity;
        }

        /* Forzar animaciones incluso con prefers-reduced-motion */
        @media (prefers-reduced-motion: reduce) {
          :global(.cat-breathing) {
            animation: breathing 3.5s ease-in-out infinite !important;
          }
          
          :global(.z-floating) {
            animation: floatZ 4s ease-out forwards !important;
          }
        }
      `}</style>
    </div>
  )
}

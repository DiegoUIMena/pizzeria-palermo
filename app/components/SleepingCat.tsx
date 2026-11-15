"use client"

import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'

export default function SleepingCat() {
  const [zPositions, setZPositions] = useState<Array<{ id: number; delay: number; left: string }>>([])
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragOriginRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout>
    const timeoutIds: ReturnType<typeof setTimeout>[] = []

    // Generar símbolos Z con delays aleatorios
    const generateZ = () => {
      const id = Date.now() + Math.random()
      const delay = Math.random() * 3 // 0-3 segundos de delay
      const left = `${45 + Math.random() * 30}%` // Posición horizontal aleatoria cerca de la gatita
      
      setZPositions(prev => [...prev, { id, delay, left }])
      
      // Remover después de la animación
      const removeTimer = setTimeout(() => {
        setZPositions(prev => prev.filter(z => z.id !== id))
      }, 4000 + delay * 1000)
      timeoutIds.push(removeTimer)
    }

    // Generar Z cada 2-5 segundos (irregular)
    const scheduleNext = () => {
      const nextDelay = 2000 + Math.random() * 3000
      timerId = setTimeout(() => {
        generateZ()
        scheduleNext()
      }, nextDelay)
    }

    scheduleNext()

    return () => {
      clearTimeout(timerId)
      timeoutIds.forEach(clearTimeout)
    }
  }, [])

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Solo botón izquierdo en mouse, o toque en pantalla táctil
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()

    e.currentTarget.setPointerCapture(e.pointerId)
    setIsDragging(true)
    dragOriginRef.current = {
      x: e.clientX - offset.x,
      y: e.clientY - offset.y,
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return
    e.preventDefault()

    setOffset({
      x: e.clientX - dragOriginRef.current.x,
      y: e.clientY - dragOriginRef.current.y,
    })
  }

  const handlePointerUpOrCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return
    setIsDragging(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUpOrCancel}
      onPointerCancel={handlePointerUpOrCancel}
      className={`relative inline-block select-none touch-none ${
        isDragging ? 'cursor-grabbing z-50' : 'cursor-grab z-50'
      }`}
      style={{
        transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
      }}
    >
      {/* Sombra proyectada - primero para que esté detrás */}
      <div 
        className="absolute left-1/2 -translate-x-1/2 bottom-1 w-[96px] h-[14px] sm:w-[116px] sm:h-[16px] rounded-full opacity-50 z-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.4) 40%, transparent 100%)',
          filter: 'blur(1px)',
        }}
      />

      {/* Gatita durmiendo con animación de respiración */}
      <div className="cat-breathing relative z-10 pointer-events-none">
        <Image
          src="/iconos/gatita.svg"
          alt="Gatita durmiendo - Local cerrado"
          width={128}
          height={128}
          draggable={false}
          className="w-[104px] h-[104px] sm:w-[124px] sm:h-[124px] select-none pointer-events-none"
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
              fontSize: `calc(${12 + Math.random() * 4}px * var(--z-scale, 1))`,
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
            transform: translateY(-80px) translateX(15px) rotate(12deg);
          }
        }

        @keyframes floatZDesktop {
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
            transform: translateY(-90px) translateX(20px) rotate(12deg);
          }
        }

        :global(.cat-breathing) {
          animation: breathing 3.5s ease-in-out infinite !important;
          will-change: transform;
        }

        :global(.z-floating) {
          --z-scale: 1.6;
          animation: floatZ 4s ease-out forwards !important;
          will-change: transform, opacity;
        }

        @media (min-width: 640px) {
          :global(.z-floating) {
            --z-scale: 2;
            animation: floatZDesktop 4s ease-out forwards !important;
          }
        }

        /* Forzar animaciones incluso con prefers-reduced-motion */
        @media (prefers-reduced-motion: reduce) {
          :global(.cat-breathing) {
            animation: breathing 3.5s ease-in-out infinite !important;
          }
          
          :global(.z-floating) {
            animation: floatZ 4s ease-out forwards !important;
          }

          @media (min-width: 640px) {
            :global(.z-floating) {
              animation: floatZDesktop 4s ease-out forwards !important;
            }
          }
        }
      `}</style>
    </div>
  )
}

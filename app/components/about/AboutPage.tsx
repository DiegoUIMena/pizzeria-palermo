"use client"

import React, { useEffect } from "react"
import HeroBanner from "./HeroBanner"
import HistorySection from "./HistorySection"
import TeamSection from "./TeamSection"
import ValuesSection from "./ValuesSection"
import BottomBanner from "./BottomBanner"

export default function AboutPage() {
  
  // Efecto de Intersection Observer para animaciones al hacer scroll
  useEffect(() => {
    const observerOptions = {
      threshold: 0.05, // Se activa cuando un 5% del elemento es visible
      rootMargin: "0px 0px -40px 0px", // Margen inferior para disparar ligeramente antes
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible")
          // Dejar de observar una vez que ya se ha animado
          observer.unobserve(entry.target)
        }
      })
    }, observerOptions)

    // Seleccionamos todos los elementos marcados para animación
    const animatedElements = document.querySelectorAll(".animate-on-scroll")
    animatedElements.forEach((el) => observer.observe(el))

    return () => {
      animatedElements.forEach((el) => observer.unobserve(el))
    }
  }, [])

  return (
    <div className="w-full bg-white min-h-screen flex flex-col antialiased">
      
      {/* 1. Hero Banner Superior */}
      <div className="w-full">
        <HeroBanner />
      </div>

      {/* 2. Sección Nuestra Historia */}
      <div className="w-full animate-on-scroll fade-up-scroll">
        <HistorySection />
      </div>

      {/* 3. Sección Quiénes Somos */}
      <div className="w-full animate-on-scroll fade-up-scroll">
        <TeamSection />
      </div>

      {/* 4. Sección Nuestros Valores */}
      <div className="w-full animate-on-scroll fade-up-scroll">
        <ValuesSection />
      </div>

      {/* 5. Banner Inferior Final */}
      <div className="w-full animate-on-scroll fade-in-scroll md:-mb-2">
        <BottomBanner />
      </div>

    </div>
  )
}

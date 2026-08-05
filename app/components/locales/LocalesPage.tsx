"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { MapPin, Star, Calendar, Clock, Snowflake, Sun, ChevronRight, ExternalLink } from "lucide-react"

export default function LocalesPage() {
  const [selectedPhoto, setSelectedPhoto] = useState("/conocenos/local1.jpg")

  const photos = [
    "/conocenos/local1.jpg",
    "/conocenos/local2.jpg",
    "/conocenos/local3.jpg",
  ]

  // Efecto de Intersection Observer para animaciones al hacer scroll
  useEffect(() => {
    const observerOptions = {
      threshold: 0.05,
      rootMargin: "0px 0px -40px 0px",
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible")
          observer.unobserve(entry.target)
        }
      })
    }, observerOptions)

    const animatedElements = document.querySelectorAll(".animate-on-scroll")
    animatedElements.forEach((el) => observer.observe(el))

    return () => {
      animatedElements.forEach((el) => observer.unobserve(el))
    }
  }, [])

  return (
    <div className="w-full bg-white min-h-screen flex flex-col antialiased text-gray-800 dark:text-gray-200">

      {/* 1. HERO SECTION (Banner Superior) */}
      <section className="relative w-full overflow-hidden select-none bg-[#111111]">
        <picture className="w-full h-auto block">
          <source media="(max-width: 767px)" srcSet="/local_horarios/banner_inicio_movil.jpg" />
          <img
            src="/local_horarios/banner_inicio_desktop.jpg"
            alt="Hero Local y Horarios Pizzería Palermo"
            className="w-full h-auto object-cover min-h-[300px] sm:min-h-auto"
            loading="eager"
          />
        </picture>
        {/* Botón "CÓMO LLEGAR" para Versión Desktop (con animación de luz fucsia corriendo por el contorno) */}
        <div className="absolute bottom-[5%] md:bottom-[5%] lg:bottom-[8%] left-[25%] lg:left-[13%] -translate-x-1/2 z-20 hidden md:block">
          <div className="relative group p-[2.5px] rounded-full overflow-hidden bg-[#e21b70]/20 flex items-center justify-center shadow-xl transition-all duration-300 hover:scale-105 hover:shadow-2xl">
            {/* Luz fucsia/blanca giratoria de fondo con important para asegurar la animación */}
            <div className="absolute inset-[-1000%] bg-[conic-gradient(from_90deg_at_50%_50%,#ffffff_0%,#ff5c93_25%,#e21b70_50%,transparent_80%)] !animate-[spin_2.2s_linear_infinite]" />

            {/* Botón real sobrepuesto con color negro */}
            <Link
              href="https://maps.app.goo.gl/G47JBTGr1KKpVJLY7"
              target="_blank"
              rel="noopener noreferrer"
              className="relative z-10 w-full h-full bg-black text-white text-xs lg:text-sm font-black uppercase tracking-wider py-3.5 px-8 rounded-full transition-colors duration-300 flex items-center justify-center gap-2 border border-black hover:bg-[#111111]"
            >
              <MapPin className="w-4 h-4 text-[#e21b70] fill-[#e21b70]" />
              CÓMO LLEGAR
            </Link>
          </div>
        </div>

        {/* Botón "CÓMO LLEGAR" para Versión Móvil (con animación de luz fucsia corriendo por el contorno) */}
        <div className="absolute top-[58%] left-[25%] -translate-x-1/2 -translate-y-1/2 z-20 block md:hidden">
          <div className="relative group p-[2.5px] rounded-full overflow-hidden bg-[#e21b70]/20 flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-105">
            {/* Luz fucsia/blanca giratoria de fondo con important */}
            <div className="absolute inset-[-1000%] bg-[conic-gradient(from_90deg_at_50%_50%,#ffffff_0%,#ff5c93_25%,#e21b70_50%,transparent_80%)] !animate-[spin_2.2s_linear_infinite]" />

            {/* Botón real sobrepuesto con color negro */}
            <Link
              href="https://maps.app.goo.gl/G47JBTGr1KKpVJLY7"
              target="_blank"
              rel="noopener noreferrer"
              className="relative z-10 w-full h-full bg-black text-white text-[10px] sm:text-xs font-black uppercase tracking-wider py-2.5 px-4 rounded-full transition-colors duration-300 flex items-center justify-center gap-1.5 border border-black hover:bg-[#111111] whitespace-nowrap"
            >
              <MapPin className="w-3.5 h-3.5 text-[#e21b70] fill-[#e21b70]" />
              CÓMO LLEGAR
            </Link>
          </div>
        </div>
      </section>

      {/* 2. NUESTRO LOCAL */}
      <section className="py-16 md:py-24 bg-white dark:bg-gray-950">
        <div className="container mx-auto px-6 sm:px-12 lg:px-20">

          {/* Título de Sección */}
          <div className="flex flex-col items-center md:items-start justify-center md:justify-start text-center md:text-left mb-16 animate-on-scroll fade-up-scroll">
            <h2 className="text-2xl sm:text-3xl font-black text-gray-950 dark:text-white uppercase tracking-tight">
              NUESTRO LOCAL
            </h2>
            <svg viewBox="0 0 200 15" preserveAspectRatio="none" className="w-36 sm:w-44 h-2 sm:h-3 text-[#e21b70] mt-1 opacity-90">
              <path d="M5 10 C 50 2, 150 12, 195 5 C 150 7, 50 1, 5 10 Z" fill="currentColor" />
            </svg>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">

            {/* Columna Izquierda: Galería */}
            <div className="w-full flex flex-col gap-4 animate-on-scroll fade-up-scroll">
              <div className="w-full aspect-[16/10] rounded-2xl overflow-hidden shadow-md border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 transition-all duration-300">
                <img
                  src={selectedPhoto}
                  alt="Fotografía destacada del local de Pizzería Palermo"
                  className="w-full h-full object-cover transition-all duration-300"
                  loading="lazy"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                {photos.map((photo, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedPhoto(photo)}
                    className={`aspect-[16/10] rounded-xl overflow-hidden border shadow-sm transition-all duration-300 hover:scale-105 ${selectedPhoto === photo
                      ? "border-[#e21b70] ring-2 ring-[#e21b70]/20"
                      : "border-gray-200 dark:border-gray-800 hover:border-gray-400"
                      }`}
                  >
                    <img
                      src={photo}
                      alt={`Miniatura local ${idx + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Columna Derecha: Contenido y Tarjetas */}
            <div className="w-full flex flex-col gap-6 animate-on-scroll fade-up-scroll" style={{ animationDelay: "150ms" }}>
              <div>
                <h3 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white mb-4">
                  Tu pizzeria de barrio con ONDA...
                </h3>
                <div className="space-y-4 text-gray-600 dark:text-gray-400 text-sm sm:text-base leading-relaxed">
                  <p>
                    Ubicados al final del Pasaje Hermano Michaelis, en la Villa Hermanos Maristas de Los Andes, Palermo es una pizzería de barrio que nació de un proyecto familiar y funciona en una casa adaptada para atender con dedicación a quienes nos visitan. No somos un gran restaurante, pero sí un lugar pensado para que cada pizza salga con el mismo cuidado y pasión con la que comenzamos.
                  </p>
                  <p>
                    Creemos que las mejores experiencias no siempre se encuentran en los lugares más grandes. Nos gusta ser ese pequeño rincón que sorprende por la calidad, la variedad de nuestras pizzas y una atención cercana, amable y sin apuros. Cada cliente que cruza nuestra puerta es recibido como nos gustaría ser recibidos nosotros.
                  </p>
                  <p>
                    En Palermo nos esforzamos cada día por mantener esa esencia: ingredientes de calidad, recetas que buscan ofrecer algo diferente y un compromiso constante por mejorar. Porque, al final, lo que hace grande a un lugar no es su tamaño, sino el cariño y la dedicación que hay detrás de cada detalle.
                  </p>
                </div>
              </div>

              {/* Tarjetas Informativas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* Tarjeta Dirección */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 md:p-8 border border-gray-100 dark:border-gray-800 shadow-sm transition-all duration-300 hover:shadow-md">
                  <div className="flex items-center gap-4 mb-5">
                    <div className="w-14 h-14 rounded-full bg-pink-50 dark:bg-pink-950/20 flex items-center justify-center text-[#e21b70] flex-shrink-0">
                      <MapPin className="w-7 h-7" />
                    </div>
                    <h4 className="font-black text-sm sm:text-base tracking-wider text-gray-700 dark:text-gray-300 uppercase">
                      DIRECCIÓN
                    </h4>
                  </div>
                  <div className="text-gray-800 dark:text-gray-200 text-sm sm:text-base font-semibold space-y-1 leading-relaxed">
                    <p>Hermano Michaelis N° 33</p>
                    <p>Villa Hermanos Maristas, Los Andes</p>
                    <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm font-medium">Región de Valparaíso</p>
                  </div>
                </div>

                {/* Tarjeta Referencias */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 md:p-8 border border-gray-100 dark:border-gray-800 shadow-sm transition-all duration-300 hover:shadow-md">
                  <div className="flex items-center gap-4 mb-5">
                    <div className="w-14 h-14 rounded-full bg-pink-50 dark:bg-pink-950/20 flex items-center justify-center text-[#e21b70] flex-shrink-0">
                      <Star className="w-7 h-7" />
                    </div>
                    <h4 className="font-black text-sm sm:text-base tracking-wider text-gray-700 dark:text-gray-300 uppercase">
                      REFERENCIAS
                    </h4>
                  </div>
                  <ul className="space-y-2 text-gray-700 dark:text-gray-300 text-xs sm:text-sm font-bold">
                    <li className="flex items-start gap-1.5 leading-relaxed">
                      <span className="text-[#e21b70] select-none">✓</span>
                      <span>Villa al costado izquierdo del cementerio</span>
                    </li>
                    <li className="flex items-start gap-1.5 leading-relaxed">
                      <span className="text-[#e21b70] select-none">✓</span>
                      <span>Cuarto pasaje de la villa al final.</span>
                    </li>
                    <li className="flex items-start gap-1.5 leading-relaxed">
                      <span className="text-[#e21b70] select-none">✓</span>
                      <span>Cercano a Terminal de Buses</span>
                    </li>
                  </ul>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 3. MAPA ("¿Cómo llegar?") */}
      <section className="py-16 md:py-24 bg-gray-50 dark:bg-gray-900/50">
        <div className="container mx-auto px-6 sm:px-12 lg:px-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">

            {/* Columna Izquierda: Textos y Dibujo */}
            <div className="lg:col-span-4 flex flex-col gap-6 animate-on-scroll fade-up-scroll">
              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-gray-950 dark:text-white uppercase tracking-tight mb-2">
                  ¿CÓMO LLEGAR?
                </h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed max-w-sm">
                  Encuéntranos fácilmente utilizando el mapa interactivo.
                </p>
              </div>

              {/* Dibujo de línea punteada e icono - Recreado de la referencia visual */}
              <div className="hidden lg:flex items-center pl-6 select-none">
                <svg width="200" height="80" viewBox="0 0 200 80" fill="none" className="text-gray-300 dark:text-gray-700">
                  <path
                    d="M10 70 Q 70 80 90 40 T 160 15"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeDasharray="6 6"
                  />
                  <circle cx="10" cy="70" r="4.5" fill="#e21b70" />
                  <path
                    d="M165 5 C 160 10 162 18 168 18 C 174 18 176 10 171 5 Z"
                    fill="#e21b70"
                    transform="scale(0.8) translate(40, -10)"
                  />
                </svg>
                <div className="w-32 h-32 rounded-full bg-pink-50 dark:bg-pink-950/20 flex items-center justify-center text-[#e21b70] shadow-md ml-4 flex-shrink-0">
                  <MapPin className="w-16 h-16" />
                </div>
              </div>
            </div>

            {/* Columna Derecha: Imagen del mapa */}
            <div className="lg:col-span-8 flex flex-col items-center gap-6 animate-on-scroll fade-up-scroll" style={{ animationDelay: "150ms" }}>
              <div className="w-full rounded-2xl overflow-hidden shadow-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-2">
                <img
                  src="/local_horarios/mapa.jpg"
                  alt="Mapa de ubicación de Pizzería Palermo en Los Andes"
                  className="w-full h-auto object-cover rounded-xl"
                  loading="lazy"
                />
              </div>

              {/* Botón Abrir en Google Maps */}
              <Link
                href="https://maps.app.goo.gl/G47JBTGr1KKpVJLY7"
                target="_blank"
                rel="noopener noreferrer"
              >
                <button className="flex items-center gap-2 px-6 py-3 rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-pink-600 dark:text-pink-400 font-extrabold text-xs tracking-wider uppercase shadow-sm transition-all duration-300 hover:text-white hover:bg-[#e21b70] dark:hover:bg-[#e21b70] hover:scale-[1.03] hover:shadow-md">
                  <ExternalLink className="w-4 h-4" />
                  ABRIR EN GOOGLE MAPS
                </button>
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* 4. HORARIOS DE ATENCIÓN */}
      <section className="py-16 md:py-24 bg-white dark:bg-gray-950">
        <div className="container mx-auto px-6 sm:px-12 lg:px-20">

          {/* Título y Descripción */}
          <div className="flex flex-col items-center justify-center text-center mb-16 animate-on-scroll fade-up-scroll">
            <h2 className="text-2xl sm:text-3xl font-black text-gray-950 dark:text-white uppercase tracking-tight mb-2">
              HORARIOS DE ATENCIÓN
            </h2>
            <div className="space-y-1 text-gray-500 dark:text-gray-400 text-sm max-w-lg leading-relaxed font-medium">
              <p>Nuestro horno se enciende todos los días para preparar tus pizzas.</p>
              <p>Solo descansamos los martes.</p>
            </div>
          </div>

          {/* Tarjetas Horarios */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto animate-on-scroll fade-up-scroll" style={{ animationDelay: "150ms" }}>

            {/* Horario Invierno */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 sm:p-6 border border-gray-100 dark:border-gray-800 shadow-sm flex flex-row items-center gap-4 sm:gap-6 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
              <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full flex-shrink-0 flex items-center justify-center bg-blue-50 dark:bg-blue-950/20 text-blue-500">
                <Snowflake className="w-8 h-8 sm:w-12 sm:h-12" />
              </div>
              <div className="flex-1 flex flex-col items-start text-left">
                <h3 className="font-extrabold text-sm sm:text-base text-blue-600 dark:text-blue-400 tracking-wider uppercase mb-2">
                  HORARIO INVIERNO
                </h3>
                <div className="flex flex-row flex-wrap gap-x-6 gap-y-2 items-center w-full">
                  <div className="flex flex-col">
                    <span className="text-gray-500 dark:text-gray-400 text-[10px] font-bold uppercase tracking-wide">TODOS LOS DÍAS</span>
                    <span className="text-gray-900 dark:text-gray-100 text-sm sm:text-lg font-black tracking-tight">18:00 — 23:00</span>
                  </div>
                  <div className="w-px h-8 bg-gray-200 dark:bg-gray-800 hidden xs:block" />
                  <div className="flex flex-col">
                    <span className="text-gray-500 dark:text-gray-400 text-[10px] font-bold uppercase tracking-wide">MARTES</span>
                    <span className="text-red-600 dark:text-red-500 text-sm sm:text-lg font-black tracking-tight">CERRADO</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Horario Verano */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 sm:p-6 border border-gray-100 dark:border-gray-800 shadow-sm flex flex-row items-center gap-4 sm:gap-6 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
              <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full flex-shrink-0 flex items-center justify-center bg-amber-50 dark:bg-amber-950/20 text-amber-500">
                <Sun className="w-8 h-8 sm:w-12 sm:h-12" />
              </div>
              <div className="flex-1 flex flex-col items-start text-left">
                <h3 className="font-extrabold text-sm sm:text-base text-amber-600 dark:text-amber-400 tracking-wider uppercase mb-2">
                  HORARIO VERANO
                </h3>
                <div className="flex flex-row flex-wrap gap-x-6 gap-y-2 items-center w-full">
                  <div className="flex flex-col">
                    <span className="text-gray-500 dark:text-gray-400 text-[10px] font-bold uppercase tracking-wide">TODOS LOS DÍAS</span>
                    <span className="text-gray-900 dark:text-gray-100 text-sm sm:text-lg font-black tracking-tight">17:30 — 23:30</span>
                  </div>
                  <div className="w-px h-8 bg-gray-200 dark:bg-gray-800 hidden xs:block" />
                  <div className="flex flex-col">
                    <span className="text-gray-500 dark:text-gray-400 text-[10px] font-bold uppercase tracking-wide">MARTES</span>
                    <span className="text-red-600 dark:text-red-500 text-sm sm:text-lg font-black tracking-tight">CERRADO</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 5. INFORMACIÓN ÚTIL */}
      <section className="py-16 md:py-24 bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-gray-900">
        <div className="container mx-auto px-6 sm:px-12 lg:px-20">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">

            {/* Tarjeta 1 */}
            <div className="flex flex-col items-center text-center p-4 animate-on-scroll fade-up-scroll" style={{ animationDelay: "0ms" }}>
              <div className="w-28 h-28 rounded-full flex items-center justify-center bg-transparent mb-4 shadow-sm border border-gray-100/50 p-3 hover:scale-105 transition-all duration-300">
                <img
                  src="/local_horarios/retiro.svg"
                  alt="Icono Retiro en Local"
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              </div>
              <h3 className="font-extrabold text-sm tracking-wide text-gray-900 dark:text-white uppercase mb-2">
                RETIRO EN LOCAL
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm leading-relaxed max-w-[220px]">
                Realiza tu pedido desde la web y retíralo cuando esté listo.
              </p>
            </div>

            {/* Tarjeta 2 */}
            <div className="flex flex-col items-center text-center p-4 animate-on-scroll fade-up-scroll" style={{ animationDelay: "100ms" }}>
              <div className="w-28 h-28 rounded-full flex items-center justify-center bg-transparent mb-4 shadow-sm border border-gray-100/50 p-3 hover:scale-105 transition-all duration-300">
                <img
                  src="/local_horarios/mediodepago.svg"
                  alt="Icono Medios de Pago"
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              </div>
              <h3 className="font-extrabold text-sm tracking-wide text-gray-900 dark:text-white uppercase mb-2">
                MEDIOS DE PAGO
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm leading-relaxed max-w-[220px]">
                Aceptamos efectivo, tarjetas y pagos online.
              </p>
            </div>

            {/* Tarjeta 3 */}
            <div className="flex flex-col items-center text-center p-4 animate-on-scroll fade-up-scroll" style={{ animationDelay: "200ms" }}>
              <div className="w-28 h-28 rounded-full flex items-center justify-center bg-transparent mb-4 shadow-sm border border-gray-100/50 p-3 hover:scale-105 transition-all duration-300">
                <img
                  src="/local_horarios/delivery.svg"
                  alt="Icono Delivery"
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              </div>
              <h3 className="font-extrabold text-sm tracking-wide text-gray-900 dark:text-white uppercase mb-2">
                DELIVERY
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm leading-relaxed max-w-[220px]">
                También llevamos Palermo hasta tu domicilio.
              </p>
            </div>

            {/* Tarjeta 4 */}
            <div className="flex flex-col items-center text-center p-4 animate-on-scroll fade-up-scroll" style={{ animationDelay: "300ms" }}>
              <div className="w-28 h-28 rounded-full flex items-center justify-center bg-transparent mb-4 shadow-sm border border-gray-100/50 p-3 hover:scale-105 transition-all duration-300">
                <img
                  src="/local_horarios/atencion.svg"
                  alt="Icono Atención"
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              </div>
              <h3 className="font-extrabold text-sm tracking-wide text-gray-900 dark:text-white uppercase mb-2">
                ATENCIÓN
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm leading-relaxed max-w-[220px]">
                Si tenés alguna duda preguntale a nuestro asistente. ¡Está aprendiendo todo el tiempo sobre tus preguntas!
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* 6. BANNER INFERIOR */}
      <section className="relative w-full overflow-hidden select-none bg-[#111111] animate-on-scroll fade-in-scroll md:-mb-2">
        <Link href="/">
          <picture className="w-full h-auto block cursor-pointer">
            <source media="(max-width: 767px)" srcSet="/local_horarios/banner_final_movil.jpg" />
            <img
              src="/local_horarios/banner_final_desktop.jpg"
              alt="Footer local y horarios"
              className="w-full h-auto object-cover min-h-[160px] sm:min-h-auto hover:brightness-95 transition-all duration-300"
              loading="lazy"
            />
          </picture>
        </Link>
      </section>

    </div>
  )
}

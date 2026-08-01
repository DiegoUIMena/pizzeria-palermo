"use client"

import React from "react"

interface ValueCardProps {
  iconPath: string
  title: string
  description: string
}

export default function ValueCard({ iconPath, title, description }: ValueCardProps) {
  return (
    <div className="flex flex-row items-center sm:items-start gap-4 p-2 w-full transition-transform duration-300 hover:scale-[1.02]">
      
      {/* Pictograma SVG Rosa - Tamaño duplicado para mayor impacto visual */}
      <div className="w-28 h-28 sm:w-36 sm:h-36 flex-shrink-0 flex items-center justify-center bg-gray-50 rounded-2xl p-3.5 sm:p-5 border border-gray-100/50 shadow-sm">
        <img
          src={iconPath}
          alt={title}
          className="w-full h-full object-contain"
        />
      </div>

      {/* Textos */}
      <div className="flex-1 flex flex-col justify-center">
        <h3 className="font-extrabold text-sm sm:text-base text-gray-900 tracking-tight leading-snug uppercase mb-1">
          {title}
        </h3>
        <p className="text-gray-500 text-xs sm:text-sm leading-relaxed font-medium">
          {description}
        </p>
      </div>

    </div>
  )
}

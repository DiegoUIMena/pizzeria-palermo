"use client";

import { ReactNode } from 'react';

interface PizzaTypeCardProps {
  type: 'normal' | 'duo';
  title: string;
  description: string;
  icon: ReactNode;
  selected: boolean;
  onClick: () => void;
}

export function PizzaTypeCard({
  type,
  title,
  description,
  icon,
  selected,
  onClick,
}: PizzaTypeCardProps) {
  return (
    <button
      onClick={onClick}
      className={`
        group relative p-8 rounded-2xl border-2 transition-all duration-300
        transform hover:scale-105 hover:shadow-2xl text-left
        ${
          selected
            ? 'border-orange-500 bg-gradient-to-br from-orange-50 to-red-50 shadow-xl ring-4 ring-orange-200'
            : 'border-gray-200 bg-white hover:border-orange-300'
        }
      `}
    >
      {/* Icono */}
      <div className="text-6xl mb-4 transform transition-transform group-hover:scale-110">
        {icon}
      </div>

      {/* Título */}
      <h3 className="text-2xl font-bold text-gray-900 mb-2">{title}</h3>

      {/* Descripción */}
      <p className="text-gray-600 mb-4">{description}</p>

      {/* Indicador de selección */}
      {selected && (
        <div className="flex items-center gap-2 text-orange-600 font-semibold">
          <span className="text-xl">✓</span>
          <span>Seleccionado</span>
        </div>
      )}

      {/* Badge de popularidad (opcional) */}
      {type === 'duo' && (
        <div className="absolute top-4 right-4 bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-xs font-bold">
          ⭐ Popular
        </div>
      )}
    </button>
  );
}

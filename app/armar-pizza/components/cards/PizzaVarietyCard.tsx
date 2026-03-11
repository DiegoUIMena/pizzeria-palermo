"use client";

import Image from 'next/image';

interface PizzaVarietyCardProps {
  id: string;
  name: string;
  description: string;
  ingredients: string[];
  image?: string;
  popular?: boolean;
  selected: boolean;
  onClick: () => void;
}

export function PizzaVarietyCard({
  name,
  description,
  ingredients,
  image,
  popular = false,
  selected,
  onClick,
}: PizzaVarietyCardProps) {
  return (
    <button
      onClick={onClick}
      className={`
        relative p-4 rounded-xl border-2 transition-all duration-300
        transform hover:scale-102 hover:shadow-lg text-left overflow-hidden
        ${
          selected
            ? 'border-orange-500 bg-gradient-to-br from-orange-50 to-red-50 shadow-lg ring-2 ring-orange-300'
            : 'border-gray-200 bg-white hover:border-orange-300'
        }
      `}
    >
      {/* Badge de popularidad */}
      {popular && (
        <div className="absolute top-3 right-3 bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full text-xs font-bold z-10">
          ⭐ Popular
        </div>
      )}

      {/* Contenedor con imagen y contenido */}
      <div className="flex gap-4">
        {/* Imagen */}
        {image && (
          <div className="flex-shrink-0 w-24 h-24 relative rounded-lg overflow-hidden bg-gray-100">
            <Image
              src={image}
              alt={name}
              fill
              className="object-cover"
              onError={(e: any) => {
                if (e.target.src !== '/placeholder.svg') {
                  e.target.src = '/placeholder.svg';
                }
              }}
            />
          </div>
        )}

        {/* Contenido */}
        <div className="flex-1 min-w-0">
          {/* Nombre */}
          <h4 className="text-lg font-bold text-gray-900 mb-1">{name}</h4>

          {/* Descripción */}
          {description && (
            <p className="text-xs text-gray-600 mb-2 line-clamp-2">{description}</p>
          )}

          {/* Ingredientes */}
          {ingredients && ingredients.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {ingredients.slice(0, 3).map((ingredient, index) => (
                <span
                  key={index}
                  className="text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded-md"
                >
                  {ingredient}
                </span>
              ))}
              {ingredients.length > 3 && (
                <span className="text-xs text-gray-500 px-1.5 py-0.5">
                  +{ingredients.length - 3} más
                </span>
              )}
            </div>
          )}

          {/* Indicador de selección */}
          {selected && (
            <div className="mt-2 flex items-center gap-2 text-orange-600 font-semibold">
              <span className="text-lg">✓</span>
              <span className="text-xs">Seleccionada</span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

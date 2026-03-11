"use client";

import { PizzaVarietyCard } from '../cards/PizzaVarietyCard';
import { usePizzaBuilderData } from '../../hooks/usePizzaBuilderData';

interface Step3MenuSelectorProps {
  selected: string | null;
  onSelect: (variety: string) => void;
  onBack: () => void;
  isDuo?: boolean; // Para determinar qué pizzas mostrar
}

export function Step3MenuSelector({ selected, onSelect, onBack, isDuo = false }: Step3MenuSelectorProps) {
  const { loading, pizzasParaNormal, pizzasParaDuo } = usePizzaBuilderData();

  // Seleccionar el conjunto correcto de pizzas según el tipo
  const pizzas = isDuo ? pizzasParaDuo : pizzasParaNormal;

  // Normalizar texto para comparaciones
  const normalizeText = (text: string): string => {
    return (text || '')
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  };

  // Pizzas que deben marcarse como populares
  const pizzasPopulares = [
    'chilena',
    '4 estaciones',
    'cuatro estaciones',
    'cuyana',
    'bariloche',
    'entre rios',
    'entre ríos',
    'buenos aires',
    'centroamericana',
    'veggie 2'
  ];

  // Detectar pizzas populares por nombre
  const pizzasConPopular = pizzas.map((pizza) => {
    const nombreNormalizado = normalizeText(pizza.nombre);
    const esPopular = pizzasPopulares.some(popular => nombreNormalizado.includes(popular));
    return {
      ...pizza,
      popular: esPopular,
    };
  });

  return (
    <div className="space-y-6">
      {/* Título */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Elige tu pizza favorita
        </h2>
        <p className="text-gray-600">
          Selecciona una variedad del menú (luego podrás agregarle extras)
        </p>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
          <p className="mt-4 text-gray-600">Cargando pizzas del menú...</p>
        </div>
      )}

      {/* Grid de pizzas */}
      {!loading && pizzas.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 max-h-[500px] overflow-y-auto pr-2">
          {pizzasConPopular.map((variety) => (
            <PizzaVarietyCard
              key={variety.id}
              id={variety.id}
              name={variety.nombre}
              description={variety.descripcion}
              ingredients={variety.ingredientes}
              image={variety.imagen}
              popular={variety.popular}
              selected={selected === variety.nombre}
              onClick={() => onSelect(variety.nombre)}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && pizzas.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-600">No se encontraron pizzas disponibles</p>
        </div>
      )}

      {/* Info */}
      <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
        <p className="text-sm text-blue-800 text-center">
          💡 Todas las pizzas pueden personalizarse con ingredientes extras
        </p>
      </div>

      {/* Botón volver */}
      <div className="flex justify-center mt-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-6 py-3 text-gray-600 hover:text-gray-900 font-medium transition-colors"
        >
          ← Volver
        </button>
      </div>
    </div>
  );
}

"use client";

import { SizeCard } from '../cards/SizeCard';
import { usePizzaBuilderData } from '../../hooks/usePizzaBuilderData';
import { useMemo } from 'react';

interface Step4SizeSelectorProps {
  selected: 'mediana' | 'familiar' | null;
  onSelect: (size: 'mediana' | 'familiar') => void;
  onBack: () => void;
  variety?: string | null; // Pizza seleccionada del menú
  baseType?: 'menu' | 'custom' | null; // Tipo de base
  isDuo?: boolean; // Si es pizza DUO
}

export function Step4SizeSelector({ 
  selected, 
  onSelect, 
  onBack, 
  variety = null,
  baseType = null,
  isDuo = false
}: Step4SizeSelectorProps) {
  const { pizzasParaNormal, pizzasParaDuo } = usePizzaBuilderData();

  // Normalizar texto para comparaciones
  const normalizeText = (text: string): string => {
    return (text || '')
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  };

  // Verificar si el tamaño Mediana está disponible
  const medianaDisponible = useMemo(() => {
    // Si es personalizada, siempre está disponible
    if (baseType === 'custom') return true;

    // Si no hay variedad seleccionada, permitir ambos tamaños
    if (!variety) return true;

    // Pizzas que SOLO están disponibles en tamaño Familiar (Mediana deshabilitada)
    const nombreNormalizado = normalizeText(variety);
    const pizzasSoloFamiliar = [
      '4 estaciones',
      'cuatro estaciones',
      '4 quesos',
      'cuatro quesos',
      'entre rios',
      'entre ríos'
    ];

    // Si la pizza está en la lista, Mediana NO está disponible
    const soloFamiliar = pizzasSoloFamiliar.some(pizza => nombreNormalizado.includes(pizza));
    if (soloFamiliar) return false;

    return true;
  }, [variety, baseType]);

  // Verificar si el tamaño familiar está disponible
  const familiarDisponible = useMemo(() => {
    // Si es personalizada, siempre está disponible
    if (baseType === 'custom') return true;

    // Si no hay variedad seleccionada, permitir ambos tamaños
    if (!variety) return true;

    // Buscar la pizza en el catálogo correcto
    const pizzas = isDuo ? pizzasParaDuo : pizzasParaNormal;
    const pizzaEncontrada = pizzas.find(p => p.nombre === variety);

    // Si no se encuentra la pizza o no tiene el campo, asumir que está disponible
    if (!pizzaEncontrada) return true;

    // Retornar el valor de disponibleFamiliar (por defecto true)
    return pizzaEncontrada.disponibleFamiliar !== false;
  }, [variety, baseType, isDuo, pizzasParaNormal, pizzasParaDuo]);
  return (
    <div className="space-y-6">
      {/* Título */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          ¿Qué tamaño prefieres?
        </h2>
        <p className="text-gray-600">
          Elige el tamaño ideal para ti
        </p>
      </div>

      {/* Opciones de tamaño */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <SizeCard
          size="mediana"
          title="Mediana"
          slices="8 Porciones"
          icon="🍕"
          subtitle="Ideal para 2-3 personas"
          selected={selected === 'mediana'}
          onClick={() => {
            if (medianaDisponible) {
              onSelect('mediana');
            }
          }}
          disabled={!medianaDisponible}
        />

        <SizeCard
          size="familiar"
          title="Familiar"
          slices="8 Porciones"
          icon="🍕🍕"
          subtitle="Ideal para 4-6 personas"
          popular
          selected={selected === 'familiar'}
          onClick={() => {
            if (familiarDisponible) {
              onSelect('familiar');
            }
          }}
          disabled={!familiarDisponible}
        />
      </div>

      {/* Mensaje si mediana no está disponible */}
      {!medianaDisponible && variety && (
        <div className="mt-6 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
          <p className="text-sm text-yellow-800 text-center">
            ⚠️ La pizza <strong>{variety}</strong> solo está disponible en tamaño Familiar
          </p>
        </div>
      )}

      {/* Mensaje si familiar no está disponible */}
      {!familiarDisponible && variety && (
        <div className="mt-6 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
          <p className="text-sm text-yellow-800 text-center">
            ⚠️ La pizza <strong>{variety}</strong> solo está disponible en tamaño Mediana
          </p>
        </div>
      )}

      {/* Comparación visual */}
      <div className="mt-8 p-6 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl">
        <h3 className="font-semibold text-gray-800 mb-4 text-center">
          Comparación de tamaños
        </h3>
        <div className="flex justify-center items-end gap-8">
          <div className="text-center">
            <div className="w-24 h-24 bg-orange-300 rounded-full mb-2 flex items-center justify-center">
              <span className="text-3xl">🍕</span>
            </div>
            <p className="text-sm font-medium text-gray-700">Mediana</p>
            <p className="text-xs text-gray-500">32 cm</p>
          </div>
          <div className="text-center">
            <div className="w-32 h-32 bg-orange-400 rounded-full mb-2 flex items-center justify-center">
              <span className="text-4xl">🍕</span>
            </div>
            <p className="text-sm font-medium text-gray-700">Familiar</p>
            <p className="text-xs text-gray-500">38 cm</p>
          </div>
        </div>
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

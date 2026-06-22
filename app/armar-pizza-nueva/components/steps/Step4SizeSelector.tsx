"use client";

import Image from 'next/image';
import { SizeCard } from '../cards/SizeCard';
import { usePizzaBuilderData } from '../../hooks/usePizzaBuilderData';
import { useBoxInventory } from '@/hooks/useBoxInventory';
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
  const { stockFamiliar, stockMediana, loading } = useBoxInventory();

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
      'entre ríos',
      'sevillana'
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

  // Verificación real de stock de cajas
  const canSelectMediana = medianaDisponible && stockMediana > 0;
  const canSelectFamiliar = familiarDisponible && stockFamiliar > 0;

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

      {/* Mensaje de carga de stock */}
      {loading && (
        <div className="text-center text-sm text-gray-500">
          Verificando disponibilidad de empaques...
        </div>
      )}

      {/* Opciones de tamaño */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <SizeCard
          size="mediana"
          title="Mediana"
          slices="8 Porciones"
          icon={<Image src="/iconos/pizza-entera.svg" alt="Mediana" width={80} height={80} className="mx-auto" />}
          subtitle="Ideal para 2-3 personas"
          selected={selected === 'mediana'}
          onClick={() => {
            if (canSelectMediana) {
              onSelect('mediana');
            }
          }}
          disabled={!canSelectMediana}
        />

        <SizeCard
          size="familiar"
          title="Familiar"
          slices="8 Porciones"
          icon={<Image src="/iconos/pizza-entera.svg" alt="Familiar" width={112} height={112} className="mx-auto" />}
          subtitle="Ideal para 4-6 personas"
          popular
          selected={selected === 'familiar'}
          onClick={() => {
            if (canSelectFamiliar) {
              onSelect('familiar');
            }
          }}
          disabled={!canSelectFamiliar}
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

      {/* Mensaje si mediana no tiene stock de caja */}
      {medianaDisponible && stockMediana <= 0 && !loading && (
        <div className="mt-2 p-4 bg-red-50 rounded-xl border border-red-200">
          <p className="text-sm text-red-800 text-center font-medium">
            ❌ Agotado temporalmente: No hay empaques disponibles para pizzas Medianas.
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

      {/* Mensaje si familiar no tiene stock de caja */}
      {familiarDisponible && stockFamiliar <= 0 && !loading && (
        <div className="mt-2 p-4 bg-red-50 rounded-xl border border-red-200">
          <p className="text-sm text-red-800 text-center font-medium">
            ❌ Agotado temporalmente: No hay empaques disponibles para pizzas Familiares.
          </p>
        </div>
      )}

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

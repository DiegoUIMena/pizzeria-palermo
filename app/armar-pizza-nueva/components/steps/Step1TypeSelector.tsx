"use client";

import Image from 'next/image';
import { PizzaTypeCard } from '../cards/PizzaTypeCard';

interface Step1TypeSelectorProps {
  selected: 'normal' | 'duo' | null;
  onSelect: (type: 'normal' | 'duo') => void;
}

export function Step1TypeSelector({ selected, onSelect }: Step1TypeSelectorProps) {
  return (
    <div className="space-y-6">
      {/* Título del paso */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          ¿Qué tipo de pizza quieres?
        </h2>
        <p className="text-gray-600">
          Elige la opción que más te guste
        </p>
      </div>

      {/* Opciones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <PizzaTypeCard
          type="normal"
          title="Pizza Normal"
          description="Una pizza completa con tus ingredientes favoritos"
          icon={<Image src="/iconos/pizza-entera.svg" alt="Pizza Normal" width={128} height={128} className="mx-auto lg:mx-0" />}
          selected={selected === 'normal'}
          onClick={() => onSelect('normal')}
        />

        <PizzaTypeCard
          type="duo"
          title="Pizza DUO"
          description="Mitad y mitad con dos combinaciones diferentes"
          icon={<Image src="/iconos/pizza-duo.svg" alt="Pizza DUO" width={128} height={128} className="mx-auto lg:mx-0" />}
          selected={selected === 'duo'}
          onClick={() => onSelect('duo')}
        />
      </div>

      {/* Ayuda visual */}
      <div className="mt-8 p-4 bg-gradient-to-r from-orange-50 to-red-50 rounded-xl border border-orange-200">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div>
            <p className="font-semibold text-gray-800 mb-1">Consejo</p>
            <p className="text-sm text-gray-600">
              Si no puedes decidirte entre dos sabores, ¡la Pizza DUO es perfecta para ti!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

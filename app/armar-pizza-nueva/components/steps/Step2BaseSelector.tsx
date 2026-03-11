"use client";

interface Step2BaseSelectorProps {
  selected: 'menu' | 'custom' | null;
  onSelect: (baseType: 'menu' | 'custom') => void;
  onBack: () => void;
}

export function Step2BaseSelector({ selected, onSelect, onBack }: Step2BaseSelectorProps) {
  return (
    <div className="space-y-6">
      {/* Título */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Elige tu punto de partida
        </h2>
        <p className="text-gray-600">
          ¿Prefieres una pizza clásica o crear la tuya?
        </p>
      </div>

      {/* Opciones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <BaseOptionCard
          type="menu"
          title="Del Menú"
          description="Comienza con una de nuestras pizzas clásicas y personalizala a tu gusto"
          icon="📋"
          features={['Variedad probadas', 'Puedes agregar extras', 'Combinaciones perfectas']}
          selected={selected === 'menu'}
          onClick={() => onSelect('menu')}
        />

        <BaseOptionCard
          type="custom"
          title="Personalizada"
          description="Crea tu pizza desde cero con masa, salsa, queso y orégano"
          icon="⭐"
          features={['100% a tu medida', 'Elige cada ingrediente', 'Total libertad']}
          selected={selected === 'custom'}
          onClick={() => onSelect('custom')}
        />
      </div>

      {/* Botón volver */}
      <div className="flex justify-center mt-8">
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

interface BaseOptionCardProps {
  type: 'menu' | 'custom';
  title: string;
  description: string;
  icon: string;
  features: string[];
  selected: boolean;
  onClick: () => void;
}

function BaseOptionCard({
  type,
  title,
  description,
  icon,
  features,
  selected,
  onClick,
}: BaseOptionCardProps) {
  return (
    <button
      onClick={onClick}
      className={`
        relative p-8 rounded-2xl border-2 transition-all duration-300
        transform hover:scale-105 hover:shadow-2xl text-left
        ${
          selected
            ? 'border-orange-500 bg-gradient-to-br from-orange-50 to-red-50 shadow-xl ring-4 ring-orange-200'
            : 'border-gray-200 bg-white hover:border-orange-300'
        }
      `}
    >
      {/* Icono */}
      <div className="text-5xl mb-4">{icon}</div>

      {/* Título y descripción */}
      <h3 className="text-2xl font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 mb-4">{description}</p>

      {/* Features */}
      <ul className="space-y-2">
        {features.map((feature, index) => (
          <li key={index} className="flex items-center gap-2 text-sm text-gray-700">
            <span className="text-green-500">✓</span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {/* Indicador de selección */}
      {selected && (
        <div className="mt-4 flex items-center gap-2 text-orange-600 font-semibold">
          <span className="text-xl">✓</span>
          <span>Seleccionado</span>
        </div>
      )}
    </button>
  );
}

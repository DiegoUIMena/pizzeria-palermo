"use client";

interface SizeCardProps {
  size: 'mediana' | 'familiar';
  title: string;
  slices: string;
  icon: string;
  subtitle: string;
  popular?: boolean;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export function SizeCard({
  title,
  slices,
  icon,
  subtitle,
  popular = false,
  selected,
  onClick,
  disabled = false,
}: SizeCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        relative p-8 rounded-2xl border-2 transition-all duration-300
        transform text-center
        ${disabled 
          ? 'border-gray-200 bg-gray-100 cursor-not-allowed opacity-50' 
          : selected
            ? 'border-orange-500 bg-gradient-to-br from-orange-50 to-red-50 shadow-xl ring-4 ring-orange-200 hover:scale-105 hover:shadow-2xl'
            : 'border-gray-200 bg-white hover:border-orange-300 hover:scale-105 hover:shadow-2xl'
        }
      `}
    >
      {/* Badge popular */}
      {popular && !disabled && (
        <div className="absolute top-4 right-4 bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-xs font-bold">
          ⭐ Popular
        </div>
      )}

      {/* Badge no disponible */}
      {disabled && (
        <div className="absolute top-4 right-4 bg-gray-400 text-white px-3 py-1 rounded-full text-xs font-bold">
          No disponible
        </div>
      )}

      {/* Icono */}
      <div className="text-6xl mb-4">{icon}</div>

      {/* Título */}
      <h3 className="text-2xl font-bold text-gray-900 mb-2">{title}</h3>

      {/* Porciones */}
      <p className="text-orange-600 font-semibold mb-3">{slices}</p>

      {/* Subtítulo */}
      <p className="text-gray-600 text-sm">{subtitle}</p>

      {/* Indicador de selección */}
      {selected && (
        <div className="mt-4 flex items-center justify-center gap-2 text-orange-600 font-semibold">
          <span className="text-xl">✓</span>
          <span>Seleccionado</span>
        </div>
      )}
    </button>
  );
}

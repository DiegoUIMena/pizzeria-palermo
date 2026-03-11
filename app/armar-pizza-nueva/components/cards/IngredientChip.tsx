"use client";

interface IngredientChipProps {
  name: string;
  price: number;
  type: 'simple' | 'premium';
  selected: boolean;
  onClick: () => void;
}

export function IngredientChip({ name, price, type, selected, onClick }: IngredientChipProps) {
  const colors = {
    simple: {
      bg: selected ? 'bg-green-500' : 'bg-white',
      border: selected ? 'border-green-500' : 'border-gray-300',
      text: selected ? 'text-white' : 'text-gray-700',
      hover: 'hover:border-green-400',
    },
    premium: {
      bg: selected ? 'bg-purple-500' : 'bg-white',
      border: selected ? 'border-purple-500' : 'border-gray-300',
      text: selected ? 'text-white' : 'text-gray-700',
      hover: 'hover:border-purple-400',
    },
  };

  const currentColors = colors[type];

  return (
    <button
      onClick={onClick}
      className={`
        px-4 py-2 rounded-full border-2 transition-all duration-200
        ${currentColors.bg} ${currentColors.border} ${currentColors.text}
        ${!selected ? currentColors.hover : ''}
        transform hover:scale-105 active:scale-95
        font-medium text-sm
        ${selected ? 'ring-2 ring-offset-2' : ''}
        ${type === 'premium' && selected ? 'ring-purple-300' : ''}
        ${type === 'simple' && selected ? 'ring-green-300' : ''}
      `}
    >
      <span className="flex items-center gap-2">
        {selected && <span>✓</span>}
        <span>{name}</span>
      </span>
    </button>
  );
}

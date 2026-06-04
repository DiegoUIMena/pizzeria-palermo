"use client";

import { useState, useEffect } from 'react';
import { PizzaConfig } from '../PizzaBuilderWizard';
import { usePizzaBuilderData } from '../../hooks/usePizzaBuilderData';

interface Step6CustomizationOptionsProps {
  config: PizzaConfig;
  onUpdate: (updates: Partial<PizzaConfig>) => void;
  onBack: () => void;
}

export function Step6CustomizationOptions({
  config,
  onUpdate,
  onBack,
}: Step6CustomizationOptionsProps) {
  const { salsas, bebidas, otrosExtras, loading } = usePizzaBuilderData();

  // Estados locales para extras seleccionados (inicializados desde config)
  const [salsasSeleccionadas, setSalsasSeleccionadas] = useState<string[]>(
    config.extrasSeleccionados?.salsas || []
  );
  const [bebidasSeleccionadas, setBebidasSeleccionadas] = useState<string[]>(
    config.extrasSeleccionados?.bebidas || []
  );
  const [otrosSeleccionados, setOtrosSeleccionados] = useState<string[]>(
    config.extrasSeleccionados?.otros || []
  );

  // Actualizar config cuando cambien los extras seleccionados
  useEffect(() => {
    onUpdate({
      extrasSeleccionados: {
        salsas: salsasSeleccionadas,
        bebidas: bebidasSeleccionadas,
        otros: otrosSeleccionados,
      },
    });
  }, [salsasSeleccionadas, bebidasSeleccionadas, otrosSeleccionados]);

  const toggleCustomization = (key: 'sinOregano' | 'sinQueso' | 'sinSalsaTomate') => {
    onUpdate({
      customizations: {
        ...config.customizations,
        [key]: !config.customizations[key],
      },
    });
  };

  // Toggle para seleccionar/deseleccionar extras
  const toggleExtra = (id: string, type: 'salsa' | 'bebida' | 'otro') => {
    if (type === 'salsa') {
      setSalsasSeleccionadas(prev =>
        prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
      );
    } else if (type === 'bebida') {
      setBebidasSeleccionadas(prev =>
        prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
      );
    } else {
      setOtrosSeleccionados(prev =>
        prev.includes(id) ? prev.filter(o => o !== id) : [...prev, id]
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Título */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Personaliza tu pizza
        </h2>
        <p className="text-gray-600">
          ¿Quieres hacer algún ajuste especial? (opcional)
        </p>
      </div>

      {/* Opciones de personalización */}
      <div className="mt-8 space-y-4">
        <CustomizationOption
          label="Sin orégano"
          description="Tu pizza no llevará orégano"
          icon="🌿"
          checked={config.customizations.sinOregano}
          onChange={() => toggleCustomization('sinOregano')}
        />

        <CustomizationOption
          label="Sin queso"
          description="Tu pizza no llevará queso"
          icon="🧀"
          checked={config.customizations.sinQueso}
          onChange={() => toggleCustomization('sinQueso')}
        />

        <CustomizationOption
          label="Sin salsa de tomate"
          description="Tu pizza no llevará salsa de tomate"
          icon="🍅"
          checked={config.customizations.sinSalsaTomate}
          onChange={() => toggleCustomization('sinSalsaTomate')}
        />
      </div>

      {/* Sección de Extras: Salsas */}
      {!loading && salsas.length > 0 && (
        <div className="mt-8">
          <h3 className="font-bold text-gray-900 mb-3 text-lg">
            🥫 Agrega Salsas (Opcional)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {salsas.map((salsa) => (
              <ExtraCard
                key={salsa.id}
                id={salsa.id}
                nombre={salsa.nombre}
                precio={salsa.precio}
                imagen={salsa.imagen}
                selected={salsasSeleccionadas.includes(salsa.id)}
                onToggle={() => toggleExtra(salsa.id, 'salsa')}
              />
            ))}
          </div>
        </div>
      )}

      {/* Sección de Extras: Bebidas */}
      {!loading && bebidas.length > 0 && (
        <div className="mt-8">
          <h3 className="font-bold text-gray-900 mb-3 text-lg">
            🥤 Agrega Bebidas (Opcional)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {bebidas.map((bebida) => {
              // Si la bebida tiene variantes (por ejemplo Tradicional / Zero), mostrar botones separados
              if (bebida.variantes && !bebida.nombre.toLowerCase().includes('lipton')) {
                // Devolver dos elementos separados para que cada uno ocupe su propia celda del grid
                return [
                  <ExtraCard
                    key={`${bebida.id}-familiar`}
                    id={`${bebida.id}-familiar`}
                    nombre={`${bebida.nombre} Tradicional`}
                    precio={bebida.precio}
                    imagen={bebida.imagen}
                    selected={bebidasSeleccionadas.includes(`${bebida.id}-familiar`)}
                    onToggle={() => toggleExtra(`${bebida.id}-familiar`, 'bebida')}
                  />,
                  <ExtraCard
                    key={`${bebida.id}-mediana`}
                    id={`${bebida.id}-mediana`}
                    nombre={`${bebida.nombre} Zero`}
                    precio={bebida.precio}
                    imagen={bebida.imagen}
                    selected={bebidasSeleccionadas.includes(`${bebida.id}-mediana`)}
                    onToggle={() => toggleExtra(`${bebida.id}-mediana`, 'bebida')}
                  />
                ]
              }

              return (
                <ExtraCard
                  key={bebida.id}
                  id={bebida.id}
                  nombre={bebida.nombre}
                  precio={bebida.precio}
                  imagen={bebida.imagen}
                  selected={bebidasSeleccionadas.includes(bebida.id)}
                  onToggle={() => toggleExtra(bebida.id, 'bebida')}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Sección de Extras: Otros (Gauchitos, Rollitos, etc.) */}
      {!loading && otrosExtras.length > 0 && (
        <div className="mt-8">
          <h3 className="font-bold text-gray-900 mb-3 text-lg">
            🍰 Otros Acompañamientos (Opcional)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {otrosExtras.map((extra) => (
              <ExtraCard
                key={extra.id}
                id={extra.id}
                nombre={extra.nombre}
                precio={extra.precio}
                imagen={extra.imagen}
                selected={otrosSeleccionados.includes(extra.id)}
                onToggle={() => toggleExtra(extra.id, 'otro')}
              />
            ))}
          </div>
        </div>
      )}

      {/* Botón de navegación */}
      <div className="flex justify-start items-center mt-8 pt-6 border-t">
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

interface CustomizationOptionProps {
  label: string;
  description: string;
  icon: string;
  checked: boolean;
  onChange: () => void;
}

function CustomizationOption({
  label,
  description,
  icon,
  checked,
  onChange,
}: CustomizationOptionProps) {
  return (
    <label
      className={`
        flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all
        ${checked ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-white hover:border-gray-300'}
      `}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
      />
      <span className="text-2xl">{icon}</span>
      <div className="flex-1">
        <p className="font-semibold text-gray-900">{label}</p>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
      {checked && (
        <span className="text-orange-500 font-bold">✓</span>
      )}
    </label>
  );
}

interface ExtraCardProps {
  id: string;
  nombre: string;
  precio: number;
  imagen: string;
  selected: boolean;
  onToggle: () => void;
}

function ExtraCard({ id, nombre, precio, imagen, selected, onToggle }: ExtraCardProps) {
  return (
    <button
      onClick={onToggle}
      className={`
        relative p-3 rounded-lg border-2 transition-all text-left
        ${selected 
          ? 'border-green-500 bg-green-50' 
          : 'border-gray-300 bg-white hover:border-orange-300'
        }
      `}
    >
      {selected && (
        <div className="absolute top-2 right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
          <span className="text-white text-sm font-bold">✓</span>
        </div>
      )}
      <div className="flex flex-col gap-2">
        <div className="w-full h-20 bg-gray-100 rounded flex items-center justify-center overflow-hidden">
          {imagen && imagen !== '/placeholder.svg' ? (
            <img src={imagen} alt={nombre} className="w-full h-full object-cover" />
          ) : (
            <span className="text-3xl">🍽️</span>
          )}
        </div>
        <div>
          <p className="font-semibold text-sm text-gray-900 line-clamp-2">{nombre}</p>
          <p className="text-orange-600 font-bold text-sm mt-1">
            ${precio.toLocaleString('es-CL')}
          </p>
        </div>
      </div>
    </button>
  );
}

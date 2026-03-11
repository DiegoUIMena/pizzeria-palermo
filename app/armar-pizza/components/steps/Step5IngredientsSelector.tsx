"use client";

import { PizzaConfig } from '../PizzaBuilderWizard';
import { IngredientChip } from '../cards/IngredientChip';
import { usePizzaBuilderData } from '../../hooks/usePizzaBuilderData';

interface Step5IngredientsSelectorProps {
  config: PizzaConfig;
  onUpdate: (updates: Partial<PizzaConfig>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Step5IngredientsSelector({
  config,
  onUpdate,
  onNext,
  onBack,
}: Step5IngredientsSelectorProps) {
  const { loading, ingredientesSimples, ingredientesPremium, getPreciosSegunTamano } = usePizzaBuilderData();

  // Normalizar texto para comparaciones
  const normalizeText = (text: string): string => {
    return (text || '')
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  };

  // Verificar si la pizza seleccionada es "4 Estaciones"
  const es4Estaciones = config.variety ? 
    normalizeText(config.variety).includes('4 estaciones') || 
    normalizeText(config.variety).includes('cuatro estaciones')
    : false;

  // Obtener precios según el tamaño seleccionado
  const tamano = (config.size || 'mediana') as 'mediana' | 'familiar';
  const precios = getPreciosSegunTamano(tamano);
  const simplePrice = precios.simple;
  const premiumPrice = precios.premium;

  const toggleSimpleIngredient = (ingredient: string) => {
    const current = config.simpleIngredients || [];
    const updated = current.includes(ingredient)
      ? current.filter((i) => i !== ingredient)
      : [...current, ingredient];
    onUpdate({ simpleIngredients: updated });
  };

  const togglePremiumIngredient = (ingredient: string) => {
    const current = config.premiumIngredients || [];
    const updated = current.includes(ingredient)
      ? current.filter((i) => i !== ingredient)
      : [...current, ingredient];
    onUpdate({ premiumIngredients: updated });
  };

  return (
    <div className="space-y-6">
      {/* Título */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Agrega ingredientes extra
        </h2>
        <p className="text-gray-600">
          {es4Estaciones 
            ? 'La pizza 4 Estaciones tiene una receta única que no permite modificaciones'
            : 'Personaliza tu pizza con tus ingredientes favoritos (opcional)'}
        </p>
      </div>

      {/* Mensaje especial para 4 Estaciones */}
      {es4Estaciones && (
        <div className="mt-6 p-6 bg-gradient-to-r from-orange-50 to-red-50 rounded-xl border-2 border-orange-200">
          <div className="text-center">
            <span className="text-4xl mb-3 block">🍕✨</span>
            <h3 className="text-xl font-bold text-orange-800 mb-2">
              Pizza 4 Estaciones
            </h3>
            <p className="text-orange-700 mb-4">
              La pizza <strong>4 Estaciones</strong> no permite personalización de ingredientes.<br />
              Esta pizza especial tiene una receta única que no puede ser modificada.
            </p>
            <p className="text-sm text-orange-600">
              💡 Continúa al paso 6 para finalizar tu pedido
            </p>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && !es4Estaciones && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
          <p className="mt-4 text-gray-600">Cargando ingredientes...</p>
        </div>
      )}

      {!loading && !es4Estaciones && (
        <>
          {/* Ingredientes Simples */}
          {ingredientesSimples.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800">
                  🥬 Ingredientes Simples
                </h3>
                <span className="text-sm font-semibold text-green-600 bg-green-50 px-3 py-1 rounded-full">
                  ${simplePrice.toLocaleString('es-CL')} c/u
                </span>
              </div>
              <div className="flex flex-wrap gap-3">
                {ingredientesSimples.map((ingredient) => (
                  <IngredientChip
                    key={ingredient.id}
                    name={ingredient.nombre}
                    price={simplePrice}
                    type="simple"
                    selected={config.simpleIngredients.includes(ingredient.nombre)}
                    onClick={() => toggleSimpleIngredient(ingredient.nombre)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Ingredientes Premium */}
          {ingredientesPremium.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800">
                  ✨ Ingredientes Premium
                </h3>
                <span className="text-sm font-semibold text-purple-600 bg-purple-50 px-3 py-1 rounded-full">
                  ${premiumPrice.toLocaleString('es-CL')} c/u
                </span>
              </div>
              <div className="flex flex-wrap gap-3">
                {ingredientesPremium.map((ingredient) => (
                  <IngredientChip
                    key={ingredient.id}
                    name={ingredient.nombre}
                    price={premiumPrice}
                    type="premium"
                    selected={config.premiumIngredients.includes(ingredient.nombre)}
                    onClick={() => togglePremiumIngredient(ingredient.nombre)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {ingredientesSimples.length === 0 && ingredientesPremium.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-600">No se encontraron ingredientes disponibles</p>
            </div>
          )}
        </>
      )}

      {/* Resumen de extras */}
      {(config.simpleIngredients.length > 0 || config.premiumIngredients.length > 0) && (
        <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
          <p className="text-sm text-blue-800 font-medium">
            Has agregado{' '}
            {config.simpleIngredients.length + config.premiumIngredients.length} ingrediente
            {config.simpleIngredients.length + config.premiumIngredients.length > 1 ? 's' : ''}{' '}
            extra
          </p>
        </div>
      )}

      {/* Botones de navegación */}
      <div className="flex justify-between items-center mt-8 pt-6 border-t">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-6 py-3 text-gray-600 hover:text-gray-900 font-medium transition-colors"
        >
          ← Volver
        </button>
        <button
          onClick={onNext}
          className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
        >
          Continuar →
        </button>
      </div>
    </div>
  );
}

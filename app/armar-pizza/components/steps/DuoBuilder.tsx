"use client";

import { useState } from 'react';
import { PizzaConfig } from '../PizzaBuilderWizard';
import { IngredientChip } from '../cards/IngredientChip';
import { usePizzaBuilderData } from '../../hooks/usePizzaBuilderData';
import { useCart } from '@/app/context/CartContext';
import { useRouter } from 'next/navigation';

// Mapeo de nombres de pizzas a archivos de imagen (igual que en PizzaBuilderWizard)
const imageMap: Record<string, string> = {
  'chilena': 'chilena',
  'bariloche': 'bariloche',
  'buenos aires': 'buenos aires',
  'cuyana': 'cuyana',
  '4 estaciones': '4 estaciones',
  'sevillana': 'sevillana',
  'amalfitana': 'amalfitana',
  'del pibe': 'del-pibe.jpg',
  'napolitana': 'napolitana',
  'palermo': 'palermo',
  'capresse': 'capresse',
  'margarita': 'margarita',
  'hawaiana': 'hawaiana',
  'vegetariana': 'vegetariana',
  'porteña': 'porteña',
  'fugazzeta': 'fugazzeta',
  'calabresa': 'calabresa',
  'pepperoni': 'pepperoni',
  'champiñones': 'champiñones',
  'cuatro quesos': 'cuatro-quesos',
  'española': 'española',
  'francesa': 'francesa',
  'italiana': 'italiana',
  'mexicana': 'mexicana',
  'rúcula': 'rucula',
  'atún': 'atun',
  'mariscos': 'mariscos',
  'anchoas': 'anchoas',
  'salmón': 'salmon'
};

// Función auxiliar para obtener la ruta de la imagen correcta
function getPizzaImagePath(imagePath?: string, pizzaName?: string): string {
  if (imagePath && imagePath.includes('firebasestorage.googleapis.com')) {
    return imagePath;
  }
  
  if (imagePath && 
      imagePath !== '/placeholder.svg' && 
      !imagePath.includes('placeholder') &&
      imagePath.startsWith('/')) {
    return imagePath;
  }
  
  if (pizzaName) {
    const cleanName = pizzaName.toLowerCase().trim();
    const mappedName = imageMap[cleanName] || cleanName;
    const imagePath = `/pizzas/${encodeURIComponent(mappedName + '.jpg')}`;
    return imagePath;
  }
  
  return "/pizza-promo-bg.png";
}

interface DuoBuilderProps {
  config: PizzaConfig;
  onUpdate: (updates: Partial<PizzaConfig>) => void;
  onBack: () => void;
}

export function DuoBuilder({ config, onUpdate, onBack }: DuoBuilderProps) {
  const [activeHalf, setActiveHalf] = useState<1 | 2>(1);
  const {
    loading,
    pizzasParaDuo,
    ingredientesSimples,
    ingredientesPremium,
    getPreciosSegunTamano,
  } = usePizzaBuilderData();
  const { addItem } = useCart();
  const router = useRouter();

  // Obtener precios según el tamaño
  const tamano = (config.size || 'mediana') as 'mediana' | 'familiar';
  const precios = getPreciosSegunTamano(tamano);
  const simplePrice = precios.simple;
  const premiumPrice = precios.premium;

  // Inicializar mitades si no existen
  if (!config.half1) {
    onUpdate({
      half1: {
        baseType: 'menu',
        variety: null,
        simpleIngredients: [],
        premiumIngredients: [],
      },
    });
  }
  if (!config.half2) {
    onUpdate({
      half2: {
        baseType: 'menu',
        variety: null,
        simpleIngredients: [],
        premiumIngredients: [],
      },
    });
  }

  const updateHalf = (half: 1 | 2, updates: any) => {
    const key = half === 1 ? 'half1' : 'half2';
    onUpdate({
      [key]: {
        ...(config[key] || {
          baseType: 'menu',
          variety: null,
          simpleIngredients: [],
          premiumIngredients: [],
        }),
        ...updates,
      },
    });
  };

  const currentHalf = activeHalf === 1 ? config.half1 : config.half2;

  const toggleIngredient = (ingredient: string, type: 'simple' | 'premium') => {
    if (!currentHalf) return;

    const key = type === 'simple' ? 'simpleIngredients' : 'premiumIngredients';
    const current = currentHalf[key] || [];
    const updated = current.includes(ingredient)
      ? current.filter((i) => i !== ingredient)
      : [...current, ingredient];

    updateHalf(activeHalf, { [key]: updated });
  };

  // Calcular precio de una mitad
  const calculateHalfPrice = (half: any) => {
    if (!half) return 0;
    let halfTotal = 0;

    if (half.baseType === 'custom') {
      halfTotal = precios.baseCustom;
    } else if (half.variety) {
      const pizzaEncontrada = pizzasParaDuo.find(p => p.nombre === half.variety);
      if (pizzaEncontrada) {
        halfTotal = tamano === 'mediana' ? pizzaEncontrada.precioMediana : pizzaEncontrada.precio;
      } else {
        halfTotal = precios.baseMenu;
      }
    }

    halfTotal += (half.simpleIngredients?.length || 0) * precios.simple;
    halfTotal += (half.premiumIngredients?.length || 0) * precios.premium;
    return halfTotal;
  };

  const handleComplete = () => {
    // Validar que ambas mitades estén configuradas
    if (config.half1?.baseType === 'menu' && !config.half1?.variety) {
      alert('Por favor selecciona una pizza para la Mitad 1');
      return;
    }
    if (config.half2?.baseType === 'menu' && !config.half2?.variety) {
      alert('Por favor selecciona una pizza para la Mitad 2');
      return;
    }

    try {
      // Calcular precio (el mayor de las dos mitades)
      const price1 = calculateHalfPrice(config.half1);
      const price2 = calculateHalfPrice(config.half2);
      const price = Math.max(price1, price2);

      // Generar nombre de la pizza DUO
      const mitad1Name = config.half1?.variety || 'Personalizada';
      const mitad2Name = config.half2?.variety || 'Personalizada';
      const name = `Pizza DUO: ${mitad1Name} / ${mitad2Name}`;

      // Combinar ingredientes de ambas mitades para el carrito
      const allSimpleIngredients = [
        ...(config.half1?.simpleIngredients || []),
        ...(config.half2?.simpleIngredients || []),
      ];
      const allPremiumIngredients = [
        ...(config.half1?.premiumIngredients || []),
        ...(config.half2?.premiumIngredients || []),
      ];

      // Determinar imagen (usar la de la primera mitad si es del menú)
      const duoImage = (() => {
        console.log("🍕 [DUO - IMAGEN] Determinando imagen...");
        console.log("🍕 [DUO] Mitad 1:", mitad1Name, "- Tipo:", config.half1?.baseType);
        console.log("🍕 [DUO] Mitad 2:", mitad2Name, "- Tipo:", config.half2?.baseType);
        
        // Intentar obtener imagen de la primera mitad si es del menú
        if (config.half1?.baseType === 'menu' && config.half1?.variety) {
          const pizza1 = pizzasParaDuo.find(p => p.nombre === config.half1?.variety);
          console.log("🍕 [DUO] Pizza1 encontrada:", pizza1?.nombre);
          console.log("🍕 [DUO] Imagen disponible:", pizza1?.imagen);
          
          if (pizza1 && pizza1.imagen) {
            const finalPath = getPizzaImagePath(pizza1.imagen, pizza1.nombre);
            console.log("🍕 [DUO] Path final generado:", finalPath);
            return finalPath;
          } else if (pizza1) {
            console.log("⚠️ [DUO] Pizza1 sin imagen, buscando por nombre");
            const finalPath = getPizzaImagePath(undefined, pizza1.nombre);
            console.log("🍕 [DUO] Path fallback por nombre:", finalPath);
            return finalPath;
          }
        }
        
        // Si la primera no tiene, intentar con la segunda
        if (config.half2?.baseType === 'menu' && config.half2?.variety) {
          const pizza2 = pizzasParaDuo.find(p => p.nombre === config.half2?.variety);
          console.log("🍕 [DUO] Intentando con Pizza2:", pizza2?.nombre);
          
          if (pizza2 && pizza2.imagen) {
            const finalPath = getPizzaImagePath(pizza2.imagen, pizza2.nombre);
            console.log("🍕 [DUO] Path final desde Pizza2:", finalPath);
            return finalPath;
          } else if (pizza2) {
            const finalPath = getPizzaImagePath(undefined, pizza2.nombre);
            console.log("🍕 [DUO] Path fallback desde Pizza2:", finalPath);
            return finalPath;
          }
        }
        
        // Si ambas son personalizadas, usar imagen genérica
        const genericPath = "/pizza-duo-bg.png";
        console.log("🍕 [DUO] Usando imagen genérica:", genericPath);
        return genericPath;
      })();

      // Agregar al carrito
      const duoPizzaType: 'duo' = 'duo';
      const cartItem = {
        id: `pizza-duo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name,
        price,
        image: duoImage,
        quantity: 1,
        size: (config.size || 'mediana') as string,
        pizzaType: duoPizzaType,
        pizza1: mitad1Name,
        pizza2: mitad2Name,
        ingredients: allSimpleIngredients,
        premiumIngredients: allPremiumIngredients,
      };
      
      console.log("🛒 [DUO - CARRITO] Item a agregar:");
      console.table({
        name: cartItem.name,
        image: cartItem.image,
        price: cartItem.price,
        pizza1: cartItem.pizza1,
        pizza2: cartItem.pizza2
      });
      
      addItem(cartItem);

      // Redirigir a la página principal
      router.push('/');
    } catch (error) {
      console.error('Error al agregar Pizza DUO al carrito:', error);
      alert('Hubo un error al agregar la pizza al carrito. Por favor intenta de nuevo.');
    }
  };

  if (!currentHalf) return null;

  return (
    <div className="space-y-6">
      {/* Título */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Configura tu Pizza DUO
        </h2>
        <p className="text-gray-600">
          Elige los sabores para cada mitad de forma independiente
        </p>
      </div>

      {/* Selector de mitad activa */}
      <div className="flex gap-3 bg-gray-100 p-2 rounded-xl">
        <button
          onClick={() => setActiveHalf(1)}
          className={`
            flex-1 py-3 px-4 rounded-lg font-semibold transition-all
            ${
              activeHalf === 1
                ? 'bg-white text-orange-600 shadow-md'
                : 'text-gray-600 hover:text-gray-900'
            }
          `}
        >
          ◀️ Mitad 1 (Izquierda)
        </button>
        <button
          onClick={() => setActiveHalf(2)}
          className={`
            flex-1 py-3 px-4 rounded-lg font-semibold transition-all
            ${
              activeHalf === 2
                ? 'bg-white text-orange-600 shadow-md'
                : 'text-gray-600 hover:text-gray-900'
            }
          `}
        >
          Mitad 2 (Derecha) ▶️
        </button>
      </div>

      {/* Configuración de la mitad activa */}
      <div className="bg-gray-50 rounded-2xl p-6 border-2 border-gray-200">
        {/* Tipo de base */}
        <div className="mb-6">
          <h3 className="font-bold text-gray-900 mb-3">Punto de partida</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => updateHalf(activeHalf, { baseType: 'menu', variety: null })}
              className={`
                p-4 rounded-lg border-2 transition-all
                ${
                  currentHalf.baseType === 'menu'
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-300 bg-white hover:border-orange-300'
                }
              `}
            >
              <span className="block text-2xl mb-1">📋</span>
              <span className="font-semibold text-sm">Del Menú</span>
            </button>
            <button
              onClick={() => updateHalf(activeHalf, { baseType: 'custom', variety: null })}
              className={`
                p-4 rounded-lg border-2 transition-all
                ${
                  currentHalf.baseType === 'custom'
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-300 bg-white hover:border-orange-300'
                }
              `}
            >
              <span className="block text-2xl mb-1">⭐</span>
              <span className="font-semibold text-sm">Personalizada</span>
            </button>
          </div>
        </div>

        {/* Selección de variedad (solo si baseType === 'menu') */}
        {currentHalf?.baseType === 'menu' && (
          <div className="mb-6">
            <h3 className="font-bold text-gray-900 mb-3">Selecciona la variedad</h3>
            {loading ? (
              <div className="text-center py-4">
                <p className="text-sm text-gray-600">Cargando variedades...</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                {pizzasParaDuo.map((variety) => (
                  <button
                    key={variety.id}
                    onClick={() => updateHalf(activeHalf, { variety: variety.nombre })}
                    className={`
                      p-3 rounded-lg border-2 transition-all text-sm font-medium
                      ${
                        currentHalf.variety === variety.nombre
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-gray-300 bg-white hover:border-orange-300 text-gray-700'
                      }
                    `}
                  >
                    {variety.nombre}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Selección de ingredientes */}
        <div className="mb-6">
          <h3 className="font-bold text-gray-900 mb-3">Ingredientes adicionales</h3>
          {loading ? (
            <p className="text-sm text-gray-600">Cargando ingredientes...</p>
          ) : (
            <>
              {/* Simples */}
              {ingredientesSimples.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">Simples (${simplePrice.toLocaleString('es-CL')})</p>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {ingredientesSimples.map((ing) => (
                      <IngredientChip
                        key={ing.id}
                        name={ing.nombre}
                        price={simplePrice}
                        type="simple"
                        selected={currentHalf?.simpleIngredients?.includes(ing.nombre) || false}
                        onClick={() => toggleIngredient(ing.nombre, 'simple')}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Premium */}
              {ingredientesPremium.length > 0 && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">Premium (${premiumPrice.toLocaleString('es-CL')})</p>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {ingredientesPremium.map((ing) => (
                      <IngredientChip
                        key={ing.id}
                        name={ing.nombre}
                        price={premiumPrice}
                        type="premium"
                        selected={currentHalf?.premiumIngredients?.includes(ing.nombre) || false}
                        onClick={() => toggleIngredient(ing.nombre, 'premium')}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Status de configuración */}
      <div className="grid grid-cols-2 gap-4">
        <div
          className={`
          p-4 rounded-xl border-2
          ${
            config.half1?.variety || config.half1?.baseType === 'custom'
              ? 'border-green-500 bg-green-50'
              : 'border-gray-300 bg-gray-50'
          }
        `}
        >
          <p className="text-sm font-semibold text-gray-700 mb-1">◀️ Mitad 1</p>
          <p className="text-xs text-gray-600">
            {config.half1?.variety || config.half1?.baseType === 'custom'
              ? config.half1.variety || 'Personalizada'
              : 'No configurada'}
          </p>
        </div>
        <div
          className={`
          p-4 rounded-xl border-2
          ${
            config.half2?.variety || config.half2?.baseType === 'custom'
              ? 'border-green-500 bg-green-50'
              : 'border-gray-300 bg-gray-50'
          }
        `}
        >
          <p className="text-sm font-semibold text-gray-700 mb-1">▶️ Mitad 2</p>
          <p className="text-xs text-gray-600">
            {config.half2?.variety || config.half2?.baseType === 'custom'
              ? config.half2.variety || 'Personalizada'
              : 'No configurada'}
          </p>
        </div>
      </div>

      {/* Botones */}
      <div className="flex justify-between items-center pt-6 border-t">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-6 py-3 text-gray-600 hover:text-gray-900 font-medium transition-colors"
        >
          ← Volver
        </button>
        <button
          onClick={handleComplete}
          className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
        >
          ✓ Agregar al Carrito
        </button>
      </div>
    </div>
  );
}

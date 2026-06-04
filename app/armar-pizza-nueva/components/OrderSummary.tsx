"use client";

import { PizzaConfig } from './PizzaBuilderWizard';
import { useEffect, useMemo, useState } from 'react';
import { usePizzaBuilderData } from '../hooks/usePizzaBuilderData';
import { functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';

function normalizeMenuName(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

interface OrderSummaryProps {
  config: PizzaConfig;
  onAddToCart?: () => void;
}

export function OrderSummary({ config, onAddToCart }: OrderSummaryProps) {
  const { getPreciosSegunTamano, pizzasParaNormal, pizzasParaDuo, salsas, bebidas, otrosExtras } = usePizzaBuilderData();
  const [serverPrice, setServerPrice] = useState<number | null>(null);
  const [isServerPriceLoading, setIsServerPriceLoading] = useState(false);
  const [serverPriceError, setServerPriceError] = useState<string | null>(null);

  // Función para calcular el precio
  const localPrice = useMemo(() => {
    let total = 0;

    if (!config.size) return 0;

    const tamano = config.size as 'mediana' | 'familiar';
    const precios = getPreciosSegunTamano(tamano);

    if (config.type === 'normal') {
      // Precio base según tipo
      if (config.baseType === 'custom') {
        total = precios.baseCustom;
      } else if (config.variety) {
        // Buscar el precio real de la variedad
        const targetName = normalizeMenuName(config.variety);
        const pizzaEncontrada = pizzasParaNormal.find((p) => normalizeMenuName(p.nombre) === targetName);
        
        if (pizzaEncontrada) {
          total = tamano === 'mediana' 
            ? pizzaEncontrada.precioMediana 
            : pizzaEncontrada.precio;
        } else {
          // Fallback al precio base del menú
          total = precios.baseMenu;
        }
      }

      // Agregar ingredientes simples
      total += config.simpleIngredients.length * precios.simple;

      // Agregar ingredientes premium
      total += config.premiumIngredients.length * precios.premium;
    } else if (config.type === 'duo' && config.half1 && config.half2) {
      // Calcular precio de cada mitad
      const calculateHalfPrice = (half: any) => {
        let halfTotal = 0;
        if (half.baseType === 'custom') {
          halfTotal = precios.baseCustom;
        } else if (half.variety) {
          // Buscar el precio real de la variedad
          const targetName = normalizeMenuName(half.variety);
          const pizzaEncontrada = pizzasParaDuo.find((p) => normalizeMenuName(p.nombre) === targetName);
          if (pizzaEncontrada) {
            halfTotal = tamano === 'mediana' 
              ? pizzaEncontrada.precioMediana 
              : pizzaEncontrada.precio;
          } else {
            halfTotal = precios.baseMenu;
          }
        }
        halfTotal += half.simpleIngredients.length * precios.simple;
        halfTotal += half.premiumIngredients.length * precios.premium;
        return halfTotal;
      };

      const price1 = calculateHalfPrice(config.half1);
      const price2 = calculateHalfPrice(config.half2);
      
      // El precio final es el MAYOR de las dos mitades
      total = Math.max(price1, price2);
    }

    // Agregar precio de extras (salsas, bebidas, otros)
    if (config.extrasSeleccionados) {
      // Sumar salsas
      config.extrasSeleccionados.salsas?.forEach(salsaId => {
        const salsa = salsas.find(s => s.id === salsaId);
        if (salsa) total += salsa.precio;
      });

      // Sumar bebidas (soportando variantes con sufijo -familiar / -mediana)
      config.extrasSeleccionados.bebidas?.forEach(bebidaId => {
        // Buscar por id exacto
        let bebida = bebidas.find(b => b.id === bebidaId);
        // Si no existe, puede ser una variante con sufijo
        if (!bebida) {
          const m = String(bebidaId).match(/^(.*)-(familiar|mediana)$/);
          if (m) {
            const baseId = m[1];
            bebida = bebidas.find(b => b.id === baseId);
          }
        }
        if (bebida) total += bebida.precio;
      });

      // Sumar otros
      config.extrasSeleccionados.otros?.forEach(extraId => {
        const extra = otrosExtras.find(e => e.id === extraId);
        if (extra) total += extra.precio;
      });
    }

    return total;
  }, [config, getPreciosSegunTamano, pizzasParaNormal, pizzasParaDuo, salsas, bebidas, otrosExtras]);

  const orderItems = useMemo(() => {
    if (!config.size) return [];

    const items: Array<{ nombre: string; cantidad: number; precio: number; size?: string; ingredients?: string[]; premiumIngredients?: string[]; pizzaType?: string; selectedMenuPizza?: string | null }> = [];

    let pizzaType: string | undefined;
    let nombre = '';

    if (config.type === 'normal') {
      pizzaType = 'premium';
      nombre = config.baseType === 'menu' && config.variety ? config.variety : 'Pizza Personalizada';
    } else if (config.type === 'duo') {
      pizzaType = 'duo';
      nombre = 'Pizza DUO';
    }

    const baseItem: {
      nombre: string;
      cantidad: number;
      precio: number;
      size?: string;
      ingredients?: string[];
      premiumIngredients?: string[];
      pizzaType?: string;
      selectedMenuPizza?: string | null;
      half1?: PizzaConfig['half1'];
      half2?: PizzaConfig['half2'];
    } = {
      nombre,
      cantidad: 1,
      precio: 0,
      size: config.size,
      ingredients: config.simpleIngredients,
      premiumIngredients: config.premiumIngredients,
      pizzaType,
      selectedMenuPizza: config.baseType === 'menu' ? (config.variety || null) : null,
    };

    if (config.type === 'duo') {
      baseItem.half1 = config.half1;
      baseItem.half2 = config.half2;
    }

    items.push(baseItem);

    config.extrasSeleccionados?.salsas?.forEach((salsaId) => {
      const salsa = salsas.find((s) => s.id === salsaId);
      if (salsa) {
        items.push({ nombre: salsa.nombre, cantidad: 1, precio: salsa.precio });
      }
    });

    config.extrasSeleccionados?.bebidas?.forEach((bebidaId) => {
      // Soportar variantes con sufijo -familiar / -mediana
      let bebida = bebidas.find((b) => b.id === bebidaId) as any;
      let displayName: string | null = null;
      if (!bebida) {
        const m = String(bebidaId).match(/^(.*)-(familiar|mediana)$/);
        if (m) {
          const baseId = m[1];
          const variant = m[2];
            bebida = bebidas.find((b) => b.id === baseId) as any;
          if (bebida) {
            displayName = variant === 'familiar' ? `${bebida.nombre} Tradicional` : `${bebida.nombre} Zero`;
          }
        }
      }

      if (bebida) {
        items.push({ nombre: displayName || bebida.nombre, cantidad: 1, precio: bebida.precio });
      }
    });

    config.extrasSeleccionados?.otros?.forEach((extraId) => {
      const extra = otrosExtras.find((e) => e.id === extraId);
      if (extra) {
        items.push({ nombre: extra.nombre, cantidad: 1, precio: extra.precio });
      }
    });

    return items;
  }, [config, salsas, bebidas, otrosExtras]);

  useEffect(() => {
    let isActive = true;

    if (!orderItems.length) {
      setServerPrice(null);
      setServerPriceError(null);
      setIsServerPriceLoading(false);
      return () => {
        isActive = false;
      };
    }

    const calculateServerPrice = async () => {
      setIsServerPriceLoading(true);
      setServerPriceError(null);

      try {
        const calculatePriceFn = httpsCallable(functions, 'calculatePrice');
        const response = await calculatePriceFn({
          items: orderItems,
          tipoEntrega: 'Retiro',
        });

        const data = response.data as any;
        if (!isActive) return;

        if (data?.success) {
          setServerPrice(Number(data.total || 0));
        } else {
          setServerPrice(null);
          setServerPriceError('No se pudo calcular el total en el servidor');
        }
      } catch (error) {
        if (!isActive) return;
        setServerPrice(null);
        setServerPriceError('No se pudo calcular el total en el servidor');
      } finally {
        if (isActive) setIsServerPriceLoading(false);
      }
    };

    calculateServerPrice();

    return () => {
      isActive = false;
    };
  }, [orderItems]);

  const price = serverPrice ?? localPrice;

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6 border-2 border-orange-100">
      <div className="flex items-center gap-2 mb-6">
        <span className="text-2xl">🛒</span>
        <h3 className="text-xl font-bold text-gray-900">Tu Pedido</h3>
      </div>

      {/* Contenido del pedido */}
      <div className="space-y-4 mb-6">
        {/* Tipo de pizza */}
        {config.type && (
          <div className="flex items-start gap-3 pb-3 border-b border-gray-100">
            <span className="text-lg">🍕</span>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">
                {config.type === 'normal' ? 'Pizza Normal' : 'Pizza DUO'}
              </p>
              {config.size && (
                <p className="text-sm text-gray-600 capitalize">{config.size}</p>
              )}
              {config.type === 'normal' && config.baseType === 'menu' && config.variety && (
                <p className="text-sm text-gray-600">{config.variety}</p>
              )}
            </div>
          </div>
        )}

        {/* Base seleccionada */}
        {config.type === 'normal' && config.baseType && (
          <div className="flex items-start gap-3 pb-3 border-b border-gray-100">
            <span className="text-lg">📋</span>
            <div className="flex-1">
              <p className="font-medium text-gray-800">
                {config.baseType === 'menu' ? 'Del Menú' : 'Personalizada'}
              </p>
              {config.variety && (
                <p className="text-sm text-gray-600">{config.variety}</p>
              )}
            </div>
          </div>
        )}

        {/* Configuración DUO */}
        {config.type === 'duo' && (
          <>
            {config.half1 && (
              <div className="flex items-start gap-3 pb-3 border-b border-gray-100">
                <span className="text-lg">◀️</span>
                <div className="flex-1">
                  <p className="font-medium text-gray-800">Mitad 1</p>
                  <p className="text-sm text-gray-600">
                    {config.half1.variety || 'Personalizada'}
                  </p>
                  {config.half1.simpleIngredients.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      + {config.half1.simpleIngredients.length} simples
                    </p>
                  )}
                  {config.half1.premiumIngredients.length > 0 && (
                    <p className="text-xs text-gray-500">
                      + {config.half1.premiumIngredients.length} premium
                    </p>
                  )}
                </div>
              </div>
            )}
            {config.half2 && (
              <div className="flex items-start gap-3 pb-3 border-b border-gray-100">
                <span className="text-lg">▶️</span>
                <div className="flex-1">
                  <p className="font-medium text-gray-800">Mitad 2</p>
                  <p className="text-sm text-gray-600">
                    {config.half2.variety || 'Personalizada'}
                  </p>
                  {config.half2.simpleIngredients.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      + {config.half2.simpleIngredients.length} simples
                    </p>
                  )}
                  {config.half2.premiumIngredients.length > 0 && (
                    <p className="text-xs text-gray-500">
                      + {config.half2.premiumIngredients.length} premium
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Ingredientes extras (solo para normal) */}
        {config.type === 'normal' && (
          <>
            {config.simpleIngredients.length > 0 && (
              <div className="flex items-start gap-3 pb-3 border-b border-gray-100">
                <span className="text-lg">🥬</span>
                <div className="flex-1">
                  <p className="font-medium text-gray-800">Ingredientes Simples</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {config.simpleIngredients.map((ing) => (
                      <span
                        key={ing}
                        className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full"
                      >
                        {ing}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {config.premiumIngredients.length > 0 && (
              <div className="flex items-start gap-3 pb-3 border-b border-gray-100">
                <span className="text-lg">✨</span>
                <div className="flex-1">
                  <p className="font-medium text-gray-800">Ingredientes Premium</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {config.premiumIngredients.map((ing) => (
                      <span
                        key={ing}
                        className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full"
                      >
                        {ing}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Customizaciones */}
        {(config.customizations.sinOregano ||
          config.customizations.sinQueso ||
          config.customizations.sinSalsaTomate) && (
          <div className="flex items-start gap-3 pb-3 border-b border-gray-100">
            <span className="text-lg">⚙️</span>
            <div className="flex-1">
              <p className="font-medium text-gray-800">Personalizaciones</p>
              <ul className="text-xs text-gray-600 mt-1 space-y-1">
                {config.customizations.sinOregano && <li>• Sin orégano</li>}
                {config.customizations.sinQueso && <li>• Sin queso</li>}
                {config.customizations.sinSalsaTomate && <li>• Sin salsa de tomate</li>}
              </ul>
            </div>
          </div>
        )}

        {/* Extras: Salsas */}
        {config.extrasSeleccionados?.salsas && config.extrasSeleccionados.salsas.length > 0 && (
          <div className="flex items-start gap-3 pb-3 border-b border-gray-100">
            <span className="text-lg">🥫</span>
            <div className="flex-1">
              <p className="font-medium text-gray-800">Salsas</p>
              <div className="mt-1 space-y-1">
                {config.extrasSeleccionados.salsas.map((salsaId) => {
                  const salsa = salsas.find(s => s.id === salsaId);
                  return salsa ? (
                    <div key={salsaId} className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">{salsa.nombre}</span>
                      <span className="text-orange-600 font-semibold">
                        ${salsa.precio.toLocaleString('es-CL')}
                      </span>
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          </div>
        )}

        {/* Extras: Bebidas */}
        {config.extrasSeleccionados?.bebidas && config.extrasSeleccionados.bebidas.length > 0 && (
          <div className="flex items-start gap-3 pb-3 border-b border-gray-100">
            <span className="text-lg">🥤</span>
            <div className="flex-1">
              <p className="font-medium text-gray-800">Bebidas</p>
              <div className="mt-1 space-y-1">
                {config.extrasSeleccionados.bebidas.map((bebidaId) => {
                  let bebida = bebidas.find(b => b.id === bebidaId);
                  let displayName: string | null = null;
                  if (!bebida) {
                    const m = String(bebidaId).match(/^(.*)-(familiar|mediana)$/);
                    if (m) {
                      const baseId = m[1];
                      const variant = m[2];
                      bebida = bebidas.find(b => b.id === baseId);
                      if (bebida) {
                        displayName = variant === 'familiar' ? `${bebida.nombre} Tradicional` : `${bebida.nombre} Zero`;
                      }
                    }
                  }
                  return bebida ? (
                    <div key={bebidaId} className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">{displayName || bebida.nombre}</span>
                      <span className="text-orange-600 font-semibold">
                        ${bebida.precio.toLocaleString('es-CL')}
                      </span>
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          </div>
        )}

        {/* Extras: Otros */}
        {config.extrasSeleccionados?.otros && config.extrasSeleccionados.otros.length > 0 && (
          <div className="flex items-start gap-3 pb-3 border-b border-gray-100">
            <span className="text-lg">🍰</span>
            <div className="flex-1">
              <p className="font-medium text-gray-800">Acompañamientos</p>
              <div className="mt-1 space-y-1">
                {config.extrasSeleccionados.otros.map((extraId) => {
                  const extra = otrosExtras.find(e => e.id === extraId);
                  return extra ? (
                    <div key={extraId} className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">{extra.nombre}</span>
                      <span className="text-orange-600 font-semibold">
                        ${extra.precio.toLocaleString('es-CL')}
                      </span>
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Precio total */}
      <div className="pt-4 border-t-2 border-orange-200">
        <div className="flex justify-between items-center mb-4">
          <span className="text-lg font-semibold text-gray-700">Total</span>
          <span className="text-3xl font-bold text-orange-600">
            {isServerPriceLoading ? 'Calculando...' : `$${price.toLocaleString('es-CL')}`}
          </span>
        </div>
        {serverPriceError && (
          <div className="text-xs text-red-600 text-center mb-3">{serverPriceError}</div>
        )}

        {/* Botón de agregar al carrito (solo visible en step 6) */}
        {onAddToCart && (
          <button
            onClick={onAddToCart}
            className={`
              w-full py-4 rounded-xl font-bold text-lg transition-all duration-300
              ${
                price > 0
                  ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }
            `}
            disabled={price === 0 || isServerPriceLoading}
          >
            {price > 0 && !isServerPriceLoading ? 'Agregar al Carrito 🛒' : 'Configura tu pizza'}
          </button>
        )}
      </div>

      {/* Info adicional */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <p className="text-xs text-blue-700 text-center">
          💡 Los precios se actualizan en tiempo real
        </p>
      </div>
    </div>
  );
}

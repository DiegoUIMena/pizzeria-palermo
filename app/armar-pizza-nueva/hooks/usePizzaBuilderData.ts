"use client";

import { useMemo } from "react";
import { useFirestorePizzaConfig } from "@/hooks/useFirestorePizzaConfig";

/**
 * Hook personalizado para la nueva experiencia de pizza builder
 * Filtra y formatea los datos de Firebase según las reglas de negocio:
 * - Excluye "4 Estaciones" para pizzas normales
 * - Excluye "4 Estaciones", "4 Quesos", "Entre Rios" para pizzas DUO
 * - Separa ingredientes simples y premium
 * - Proporciona precios según tamaño
 */
export function usePizzaBuilderData() {
  const { loading, ingredients, itemsMenu, preciosConfig } = useFirestorePizzaConfig();

  // Normalizar texto para comparaciones (sin acentos, minúsculas)
  const normalizeText = (text: string): string => {
    return (text || '')
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Eliminar acentos
      .trim();
  };

  // Filtrar pizzas del menú para Pizza Normal (INCLUIR "4 Estaciones", excluir productos no-pizza)
  const pizzasParaNormal = useMemo(() => {
    if (!Array.isArray(itemsMenu) || itemsMenu.length === 0) return [];

    const pizzasSoloFamiliarList = [
      '4 estaciones',
      'cuatro estaciones',
      'entre rios',
      'entre ríos',
      'sevillana',
      'gaucha'
    ];

    return itemsMenu
      .filter((pizza: any) => {
        // Solo pizzas activas
        if (pizza.activo === false) return false;

        // Excluir productos que NO son pizzas (bebidas, acompañamientos, etc.)
        const categoria = (pizza.categoria || '').toLowerCase();
        if (categoria === 'bebidas' || categoria === 'acompañamientos') {
          return false;
        }

        return true;
      })
      .map((pizza: any) => {
        const nombreNorm = normalizeText(pizza.nombre || '');
        const esSoloFamiliar = pizzasSoloFamiliarList.some(p => nombreNorm.includes(p));
        const tieneMediana = pizza.disponibleMediana !== false && !esSoloFamiliar;

        return {
          id: pizza.id,
          nombre: pizza.nombre,
          descripcion: pizza.descripcion || '',
          precio: pizza.precio || 0,
          precioMediana: tieneMediana ? (pizza.precioMediana || pizza.precio || 0) : 0,
          disponibleMediana: tieneMediana,
          disponibleFamiliar: pizza.disponibleFamiliar !== false,
          imagen: pizza.imagen || '/placeholder.svg',
          categoria: pizza.categoria || '',
          ingredientes: pizza.ingredientes || [],
        };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [itemsMenu]);

  // Filtrar pizzas del menú para Pizza DUO (excluir más pizzas y productos no-pizza)
  const pizzasParaDuo = useMemo(() => {
    if (!Array.isArray(itemsMenu) || itemsMenu.length === 0) return [];

    const exclusionesDuo = ['4 estaciones', 'cuatro estaciones', '4 quesos', 'cuatro quesos', 'entre rios', 'entre ríos', 'gaucha'];

    return itemsMenu
      .filter((pizza: any) => {
        // Solo pizzas activas
        if (pizza.activo === false) return false;

        // Excluir productos que NO son pizzas (bebidas, acompañamientos, etc.)
        const categoria = (pizza.categoria || '').toLowerCase();
        if (categoria === 'bebidas' || categoria === 'acompañamientos') {
          return false;
        }

        // Excluir pizzas en la lista de exclusiones
        const nombreNormalizado = normalizeText(pizza.nombre || '');
        const excluida = exclusionesDuo.some(exclusion => nombreNormalizado.includes(exclusion));

        if (excluida) {
          return false;
        }

        return true;
      })
      .map((pizza: any) => ({
        id: pizza.id,
        nombre: pizza.nombre,
        descripcion: pizza.descripcion || '',
        precio: pizza.precio || 0,
        precioMediana: pizza.precioMediana || pizza.precio || 0,
        disponibleMediana: true,
        disponibleFamiliar: pizza.disponibleFamiliar !== false,
        imagen: pizza.imagen || '/placeholder.svg',
        categoria: pizza.categoria || '',
        ingredientes: pizza.ingredientes || [],
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [itemsMenu]);

  // Separar ingredientes simples
  const ingredientesSimples = useMemo(() => {
    if (!Array.isArray(ingredients) || ingredients.length === 0) return [];

    return ingredients
      .filter((ing: any) => {
        const c = normalizeText(ing.clase || '');
        const t = normalizeText(ing.tipo || '');
        const cat = normalizeText(ing.categoria || '');
        
        const isPremium = c === 'premium' || t === 'premium' || cat === 'premium';
        if (isPremium) return false;

        return c === 'simple' || t === 'simple' || cat === 'simple' || c === 'ingrediente' || t === 'ingrediente';
      })
      .map((ing: any) => ({
        id: ing.id,
        nombre: ing.nombre,
        categoria: 'simple',
        clase: 'simple',
        tipo: 'simple',
        esPrecioEspecial: Boolean(ing.esPrecioEspecial),
        precioPorcionFamiliar: ing.precioPorcionFamiliar || 0,
        precioPorcionMediana: ing.precioPorcionMediana || 0,
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [ingredients]);

  // Separar ingredientes premium
  const ingredientesPremium = useMemo(() => {
    if (!Array.isArray(ingredients) || ingredients.length === 0) return [];

    return ingredients
      .filter((ing: any) => {
        const c = normalizeText(ing.clase || '');
        const t = normalizeText(ing.tipo || '');
        const cat = normalizeText(ing.categoria || '');
        return c === 'premium' || t === 'premium' || cat === 'premium';
      })
      .map((ing: any) => ({
        id: ing.id,
        nombre: ing.nombre,
        categoria: 'premium',
        clase: 'premium',
        tipo: 'premium',
        esPrecioEspecial: Boolean(ing.esPrecioEspecial),
        precioPorcionFamiliar: ing.precioPorcionFamiliar || 0,
        precioPorcionMediana: ing.precioPorcionMediana || 0,
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [ingredients]);

  // Obtener precios según tamaño
  const getPreciosSegunTamano = (tamano: 'mediana' | 'familiar') => {
    if (!preciosConfig) {
      // Precios por defecto mientras se carga
      return tamano === 'mediana'
        ? {
            baseCustom: 8000,
            baseMenu: 10000,
            simple: 700,
            premium: 2500,
          }
        : {
            baseCustom: 10000,
            baseMenu: 12000,
            simple: 1000,
            premium: 3500,
          };
    }

    const sizeConfig = preciosConfig.pizzaSizes[tamano];
    return {
      baseCustom: sizeConfig.simpleBasePrice,
      baseMenu: sizeConfig.premiumBasePrice,
      simple: sizeConfig.simpleExtraPrice,
      premium: sizeConfig.premiumExtraPrice,
    };
  };

  // Filtrar salsas del menú (Acompañamientos que contienen "salsa")
  const salsas = useMemo(() => {
    if (!Array.isArray(itemsMenu) || itemsMenu.length === 0) return [];

    return itemsMenu
      .filter((item: any) => {
        if (item.activo === false) return false;
        const categoria = (item.categoria || '').toLowerCase();
        const nombre = (item.nombre || '').toLowerCase();
        return categoria === 'acompañamientos' && nombre.includes('salsa');
      })
      .map((item: any) => ({
        id: item.id,
        nombre: item.nombre,
        precio: item.precio || 0,
        imagen: item.imagen || '/placeholder.svg',
        descripcion: item.descripcion || '',
      }));
  }, [itemsMenu]);

  // Filtrar bebidas del menú
  const bebidas = useMemo(() => {
    if (!Array.isArray(itemsMenu) || itemsMenu.length === 0) return [];

    return itemsMenu
      .filter((item: any) => {
        if (item.activo === false) return false;
        const categoria = (item.categoria || '').toLowerCase();
        return categoria === 'bebidas';
      })
      .map((item: any) => ({
        id: item.id,
        nombre: item.nombre,
        precio: item.precio || 0,
        imagen: item.imagen || '/placeholder.svg',
        descripcion: item.descripcion || '',
        variantes: item.variantes || item.variants || null,
      }));
  }, [itemsMenu]);

  // Filtrar otros acompañamientos (gauchitos, rollitos, etc.)
  const otrosExtras = useMemo(() => {
    if (!Array.isArray(itemsMenu) || itemsMenu.length === 0) return [];

    return itemsMenu
      .filter((item: any) => {
        if (item.activo === false) return false;
        const categoria = (item.categoria || '').toLowerCase();
        const nombre = (item.nombre || '').toLowerCase();
        return categoria === 'acompañamientos' && !nombre.includes('salsa');
      })
      .map((item: any) => ({
        id: item.id,
        nombre: item.nombre,
        precio: item.precio || 0,
        imagen: item.imagen || '/placeholder.svg',
        descripcion: item.descripcion || '',
      }));
  }, [itemsMenu]);

  // Mapa completo de ingredientes indexado por nombre normalizado
  const ingredientesMap = useMemo(() => {
    const map: Record<string, any> = {};
    if (Array.isArray(ingredients)) {
      ingredients.forEach((ing: any) => {
        if (ing.nombre) {
          map[normalizeText(ing.nombre)] = ing;
        }
      });
    }
    return map;
  }, [ingredients]);

  /**
   * Obtiene el precio de un ingrediente según tamaño, respetando precios especiales
   */
  const getIngredientPrice = (ing: any | string, tamano: 'mediana' | 'familiar', isPremiumDefault = false): number => {
    const standardPrices = getPreciosSegunTamano(tamano);
    let ingObj: any = typeof ing === 'object' && ing !== null ? ing : ingredientesMap[normalizeText(ing)];

    if (!ingObj && typeof ing === 'string') {
      // Buscar en arrays
      ingObj = ingredientesPremium.find(p => normalizeText(p.nombre) === normalizeText(ing)) ||
               ingredientesSimples.find(s => normalizeText(s.nombre) === normalizeText(ing));
    }

    if (ingObj && ingObj.esPrecioEspecial) {
      const specialPrice = tamano === 'mediana' 
        ? Number(ingObj.precioPorcionMediana || ingObj.precioPorcionFamiliar || 0)
        : Number(ingObj.precioPorcionFamiliar || 0);
      if (specialPrice > 0) {
        return specialPrice;
      }
    }

    const isPrem = ingObj ? (
      normalizeText(ingObj.clase || '') === 'premium' || 
      normalizeText(ingObj.tipo || '') === 'premium' || 
      normalizeText(ingObj.categoria || '') === 'premium'
    ) : isPremiumDefault;
    return isPrem ? standardPrices.premium : standardPrices.simple;
  };

  /**
   * Obtiene el nombre a mostrar para el ingrediente.
   * Regla de negocio del usuario:
   * Solo si el ingrediente tiene precio especial muestra su valor (ej. "Camarones (+$6.000)").
   * Los ingredientes estándar (simples o premium) NO muestran el valor al lado de su nombre.
   */
  const getIngredientDisplayName = (ing: any | string, tamano: 'mediana' | 'familiar' = 'familiar', isPremiumDefault = false): string => {
    const rawName = typeof ing === 'object' && ing !== null ? ing.nombre : String(ing);
    let ingObj: any = typeof ing === 'object' && ing !== null ? ing : ingredientesMap[normalizeText(rawName)];

    if (!ingObj && typeof rawName === 'string') {
      ingObj = ingredientesPremium.find(p => normalizeText(p.nombre) === normalizeText(rawName)) ||
               ingredientesSimples.find(s => normalizeText(s.nombre) === normalizeText(rawName));
    }

    if (ingObj && ingObj.esPrecioEspecial) {
      const price = getIngredientPrice(ingObj, tamano, isPremiumDefault);
      return `${rawName} (+$${price.toLocaleString('es-CL')})`;
    }

    return rawName;
  };

  return {
    loading,
    pizzasParaNormal,
    pizzasParaDuo,
    ingredientesSimples,
    ingredientesPremium,
    ingredientesMap,
    salsas,
    bebidas,
    otrosExtras,
    getPreciosSegunTamano,
    getIngredientPrice,
    getIngredientDisplayName,
    preciosConfig,
  };
}

"use client";

import { useMemo } from "react";
import { useFirestorePizzaConfig } from "@/hooks/useFirestorePizzaConfig";

/**
 * Hook personalizado para la nueva experiencia de pizza builder
 * Filtra y formatea los datos de Firebase según las reglas de negocio:
 * - Excluye "4 Estaciones" para pizzas normales
 * - Excluye "4 Estaciones", "4 Quesos", "Entre Ríos" para pizzas DUO
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

    return itemsMenu
      .filter((pizza: any) => {
        // Solo pizzas activas
        if (pizza.activo === false) return false;

        // Excluir productos que NO son pizzas (bebidas, acompañamientos, etc.)
        const categoria = (pizza.categoria || '').toLowerCase();
        if (categoria === 'bebidas' || categoria === 'acompañamientos') {
          return false;
        }

        // INCLUIR "4 Estaciones" para Pizza Normal (solo estará disponible en tamaño Familiar)
        // No excluir nada más aquí

        return true;
      })
      .map((pizza: any) => ({
        id: pizza.id,
        nombre: pizza.nombre,
        descripcion: pizza.descripcion || '',
        precio: pizza.precio || 0,
        precioMediana: pizza.precioMediana || pizza.precio || 0,
        imagen: pizza.imagen || '/placeholder.svg',
        // Verificar disponibilidad de tamaño familiar
        disponibleFamiliar: pizza.disponibleFamiliar !== false, // Por defecto true si no está definido
        categoria: pizza.categoria || '',
        ingredientes: pizza.ingredientes || [],
      }));
  }, [itemsMenu]);

  // Filtrar pizzas del menú para Pizza DUO (excluir más pizzas y productos no-pizza)
  const pizzasParaDuo = useMemo(() => {
    if (!Array.isArray(itemsMenu) || itemsMenu.length === 0) return [];

    const exclusionesDuo = ['4 estaciones', 'cuatro estaciones', '4 quesos', 'cuatro quesos', 'entre rios', 'entre ríos'];

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
        imagen: pizza.imagen || '/placeholder.svg',
        disponibleFamiliar: pizza.disponibleFamiliar !== false,
        categoria: pizza.categoria || '',
        ingredientes: pizza.ingredientes || [],
      }));
  }, [itemsMenu]);

  // Separar ingredientes simples
  const ingredientesSimples = useMemo(() => {
    if (!Array.isArray(ingredients) || ingredients.length === 0) return [];

    return ingredients
      .filter((ing: any) => {
        // Priorizar el campo 'clase' si existe
        if (ing.clase) {
          return normalizeText(ing.clase) === 'simple';
        }
        // Si no hay campo clase, usar categoría como fallback
        return ing.categoria === 'simple';
      })
      .map((ing: any) => ({
        id: ing.id,
        nombre: ing.nombre,
        categoria: 'simple',
        clase: 'simple',
      }));
  }, [ingredients]);

  // Separar ingredientes premium
  const ingredientesPremium = useMemo(() => {
    if (!Array.isArray(ingredients) || ingredients.length === 0) return [];

    return ingredients
      .filter((ing: any) => {
        // Priorizar el campo 'clase' si existe
        if (ing.clase) {
          return normalizeText(ing.clase) === 'premium';
        }
        // Si no hay campo clase, usar categoría como fallback
        return ing.categoria === 'premium';
      })
      .map((ing: any) => ({
        id: ing.id,
        nombre: ing.nombre,
        categoria: 'premium',
        clase: 'premium',
      }));
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
        variantes: item.variantes || null,
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

  return {
    loading,
    pizzasParaNormal,
    pizzasParaDuo,
    ingredientesSimples,
    ingredientesPremium,
    salsas,
    bebidas,
    otrosExtras,
    getPreciosSegunTamano,
    preciosConfig,
  };
}

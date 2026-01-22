'use client'

import { useQuery } from '@tanstack/react-query'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/app/lib/firebase'
import type { MenuItem, Ingredient, Category } from '@/app/lib/firebase'

/**
 * Hook optimizado con React Query para obtener items del menú
 * Cache: 5 minutos (los items del menú cambian raramente)
 */
export function useMenuItems() {
  return useQuery({
    queryKey: ['menu-items'],
    queryFn: async (): Promise<MenuItem[]> => {
      const itemsSnapshot = await getDocs(
        query(collection(db, 'items_menu'), where('activo', '==', true))
      )
      return itemsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as MenuItem[]
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  })
}

/**
 * Hook optimizado para obtener ingredientes
 * Cache: 5 minutos
 */
export function useIngredients() {
  return useQuery({
    queryKey: ['ingredients'],
    queryFn: async (): Promise<Ingredient[]> => {
      const ingredientsSnapshot = await getDocs(collection(db, 'ingredientes'))
      return ingredientsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Ingredient[]
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}

/**
 * Hook optimizado para obtener categorías
 * Cache: 5 minutos
 */
export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async (): Promise<Category[]> => {
      const categoriesSnapshot = await getDocs(collection(db, 'categorias'))
      return categoriesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Category[]
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}

/**
 * Hook optimizado para obtener un item específico del menú
 * Útil para páginas de detalle de producto
 */
export function useMenuItem(itemId: string | undefined) {
  return useQuery({
    queryKey: ['menu-item', itemId],
    queryFn: async (): Promise<MenuItem | null> => {
      if (!itemId) return null
      
      const itemsSnapshot = await getDocs(
        query(
          collection(db, 'items_menu'),
          where('__name__', '==', itemId)
        )
      )
      
      if (itemsSnapshot.empty) return null
      
      const doc = itemsSnapshot.docs[0]
      return {
        id: doc.id,
        ...doc.data(),
      } as MenuItem
    },
    enabled: !!itemId, // Solo ejecutar si hay itemId
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}

/**
 * Hook para obtener items del menú por categoría
 */
export function useMenuItemsByCategory(categoryId: string | undefined) {
  return useQuery({
    queryKey: ['menu-items-by-category', categoryId],
    queryFn: async (): Promise<MenuItem[]> => {
      if (!categoryId) return []
      
      const itemsSnapshot = await getDocs(
        query(
          collection(db, 'items_menu'),
          where('categoria', '==', categoryId),
          where('activo', '==', true)
        )
      )
      
      return itemsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as MenuItem[]
    },
    enabled: !!categoryId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}

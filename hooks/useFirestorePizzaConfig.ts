import { useEffect, useState } from "react"
import { useFirebase } from "../app/context/FirebaseContext"
import { realtimeManager } from "../lib/realtime-manager"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { collection, getDocs, doc, getDoc } from "firebase/firestore"
import { db } from "../lib/firebase"

export interface PizzaSizeConfig {
  id: string
  name: string
  simpleBasePrice: number
  premiumBasePrice: number
  simpleExtraPrice: number
  premiumExtraPrice: number
  description?: string
}

export interface PreciosConfiguracion {
  pizzaSizes: {
    mediana: PizzaSizeConfig
    familiar: PizzaSizeConfig
  }
  extras: Record<string, number>
  lastUpdated?: string
  version?: string
}

/**
 * Hook optimizado con React Query y patrón singleton
 * Reduce ~30,000 lecturas/mes eliminando suscripciones duplicadas
 */
export function useFirestorePizzaConfig() {
  const { initialized } = useFirebase()
  const queryClient = useQueryClient()
  const [itemsMenu, setItemsMenu] = useState<any[]>([])

  // Cargar ingredientes con React Query (cache de 5 minutos)
  const { 
    data: ingredients = [], 
    isLoading: ingredientsLoading,
    error: ingredientsError 
  } = useQuery({
    queryKey: ['ingredientes'],
    queryFn: async () => {
      const snapshot = await getDocs(collection(db, "ingredientes"))
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    },
    enabled: initialized,
    staleTime: 5 * 60 * 1000, // Cache válido por 5 minutos
    gcTime: 10 * 60 * 1000, // Mantener en cache 10 minutos
  })

  // Cargar categorías con React Query (cache de 10 minutos)
  const { 
    data: categories = [], 
    isLoading: categoriesLoading,
    error: categoriesError 
  } = useQuery({
    queryKey: ['categorias_menu'],
    queryFn: async () => {
      const snapshot = await getDocs(collection(db, "categorias_menu"))
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    },
    enabled: initialized,
    staleTime: 10 * 60 * 1000, // Cache válido por 10 minutos
    gcTime: 30 * 60 * 1000, // Mantener en cache 30 minutos (cambia poco)
  })

  // Cargar configuración de precios con React Query (cache de 15 minutos)
  const { 
    data: preciosConfig, 
    isLoading: preciosLoading,
    error: preciosError 
  } = useQuery<PreciosConfiguracion | null>({
    queryKey: ['precios_configuracion'],
    queryFn: async () => {
      const docRef = doc(db, "settings", "precios_configuracion")
      const docSnap = await getDoc(docRef)
      
      if (docSnap.exists()) {
        return docSnap.data() as PreciosConfiguracion
      }
      
      // Fallback a valores por defecto si no existe la configuración
      console.warn('⚠️ No se encontró precios_configuracion en Firebase, usando valores por defecto')
      return {
        pizzaSizes: {
          mediana: {
            id: 'mediana',
            name: 'Mediana',
            simpleBasePrice: 8000,
            premiumBasePrice: 8000,
            simpleExtraPrice: 700,
            premiumExtraPrice: 2500,
            description: 'Perfecta para 1-2 personas'
          },
          familiar: {
            id: 'familiar',
            name: 'Familiar',
            simpleBasePrice: 10000,
            premiumBasePrice: 10000,
            simpleExtraPrice: 1000,
            premiumExtraPrice: 3500,
            description: 'Ideal para 3-4 personas'
          }
        },
        extras: {}
      }
    },
    enabled: initialized,
    staleTime: 15 * 60 * 1000, // Cache válido por 15 minutos
    gcTime: 60 * 60 * 1000, // Mantener en cache 1 hora (precios cambian raramente)
  })

  // items_menu usa listener en tiempo real con singleton pattern
  useEffect(() => {
    if (!initialized) return

    console.log("Suscribiendo a items_menu con singleton pattern")
    
    const unsubscribe = realtimeManager.subscribe<any>(
      'items_menu',
      (data) => {
        console.log(`Actualización recibida: ${data.length} pizzas`)
        setItemsMenu(data)
        // Invalidar cache de React Query si es necesario
        queryClient.invalidateQueries({ queryKey: ['items_menu'] })
      }
    )

    return () => {
      console.log("Desuscribiendo de items_menu")
      unsubscribe()
    }
  }, [initialized, queryClient])

  // Función para refrescar datos manualmente
  const refreshData = () => {
    console.log("Forzando actualización de datos")
    queryClient.invalidateQueries({ queryKey: ['ingredientes'] })
    queryClient.invalidateQueries({ queryKey: ['categorias_menu'] })
    queryClient.invalidateQueries({ queryKey: ['items_menu'] })
    queryClient.invalidateQueries({ queryKey: ['precios_configuracion'] })
  }

  const loading = ingredientsLoading || categoriesLoading || preciosLoading || itemsMenu.length === 0
  const error = ingredientsError || categoriesError || preciosError

  return { 
    loading, 
    error: error instanceof Error ? error : null, 
    ingredients, 
    itemsMenu, 
    categories,
    preciosConfig,
    refreshData
  }
}

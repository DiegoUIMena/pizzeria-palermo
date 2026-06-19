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

  // Carga inicial de items_menu para evitar depender solo del listener realtime
  const {
    data: initialItemsMenu = [],
    isLoading: itemsMenuInitialLoading,
    error: itemsMenuInitialError,
  } = useQuery({
    queryKey: ['items_menu_initial'],
    queryFn: async () => {
      const snapshot = await getDocs(collection(db, 'items_menu'))
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    },
    enabled: initialized,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

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

  // Si el realtime aún no entrega datos, usar carga inicial como fallback
  useEffect(() => {
    if (!initialized) return
    if (itemsMenu.length === 0 && initialItemsMenu.length > 0) {
      setItemsMenu(initialItemsMenu)
    }
  }, [initialized, itemsMenu.length, initialItemsMenu])

  // Pre-cargar imágenes para evitar delay al cambiar de categoría
  useEffect(() => {
    if (typeof window !== "undefined" && itemsMenu && itemsMenu.length > 0) {
      console.log(`🚀 Iniciando precarga de ${itemsMenu.length} imágenes del menú...`);
      const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'pizzeria-palermo-17f6d.appspot.com';
      
      const normalizeText = (text: string): string => {
        return (text || '')
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim();
      };

      const imageMap: Record<string, string> = {
        'chilena': 'chilena', 'bariloche': 'bariloche', 'buenos aires': 'buenos aires', 'cuyana': 'cuyana',
        '4 estaciones': '4 estaciones', 'sevillana': 'sevillana', 'amalfitana': 'amalfitana', 'calabresa': 'calabresa',
        'napolitana': 'napolitana', 'hawaiana': 'hawaiana', 'neuquen': 'neuquén', 'la rioja': 'la rioja',
        'cordobesa': 'cordobesa', 'lujan': 'luján', 'veggie 1': 'veggie 1', 'veggie 2': 'veggie 2',
        'recoleta': 'recoleta', 'entre rios': 'entre rios', 'centroamericana': 'centroamericana', 'messi': 'messi',
        'de charly': 'de-charly', 'del pibe': 'del-pibe', 'pepperoni cheese': 'pepperoni cheese',
        'pesto margarita': 'pesto margarita', 'doble muzza': 'doble muzza', 'chicken bbq': 'chicken bbq',
        '4 quesos': '4 quesos', 'coca cola lata': 'coca_cola_lata', 'coca cola zero lata 350cc': 'coca_cola_lata_zero',
        'coca cola 1.5 litro': 'coca_cola_1.5_litro', 'coca cola zero 1.5 litro': 'coca_cola_1.5_litro_zero',
        'lipton lata': 'lipton_lata', 'lipton botella': 'lipton_botella', 'salsa de ajo': 'salsa_de_ajo',
        'salsa chimichurri': 'salsa_chimichurri', 'salsa bbq': 'salsa_bbq', 'salsa pesto': 'salsa_pesto',
        'gauchitos': 'gauchitos', 'rollitos de canela': 'canela', 'canela': 'canela'
      };

      const getImagePath = (itemName: string, defaultImage?: string): string => {
        if (defaultImage && (defaultImage.includes('firebasestorage.googleapis.com') || defaultImage.startsWith('http'))) {
          return defaultImage;
        }
        
        const lowerName = normalizeText(itemName || '');
        if (defaultImage && !defaultImage.includes('placeholder') && !defaultImage.startsWith('http')) {
          if (defaultImage.startsWith('/iconos/')) return defaultImage;
          const parts = defaultImage.split('/').filter(Boolean);
          if (parts.length >= 2) {
            let folder = parts[0];
            const fileName = parts.slice(1).join('/');
            const isBebidaFallback = lowerName.includes('sprite') || lowerName.includes('fanta') || lowerName.includes('jugo') || lowerName.includes('bebida') || lowerName.includes('lata') || lowerName.includes('botella');
            const isAcompFallback = lowerName.includes('salsa') || lowerName.includes('empanada') || lowerName.includes('palo');
            if (isBebidaFallback) folder = 'bebidas';
            else if (isAcompFallback) folder = 'acompañamientos';
            return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(folder)}%2F${encodeURIComponent(fileName)}?alt=media`;
          }
        }
        
        const cleanName = itemName
          .replace(/\s*\((Familiar|Mediana|Personal|Grande)\)/gi, '')
          .replace(/\s*(Tradicional|Zero)$/gi, '')
          .toLowerCase()
          .trim();
        const normalizedName = normalizeText(cleanName);
        const mappedName = imageMap[normalizedName] || normalizedName;
        const isBebidaFallback = ['coca_cola_lata', 'coca_cola_lata_zero', 'coca_cola_1.5_litro', 'coca_cola_1.5_litro_zero', 'lipton_lata', 'lipton_botella'].includes(mappedName) || 
                                 normalizedName.includes('coca') || normalizedName.includes('sprite') || normalizedName.includes('fanta') || normalizedName.includes('jugo') || normalizedName.includes('bebida') || normalizedName.includes('lata') || normalizedName.includes('botella');
        const isAcompFallback = ['canela', 'gauchitos', 'salsa_de_ajo', 'salsa_chimichurri', 'salsa_bbq', 'salsa_pesto'].includes(mappedName) || 
                                normalizedName.includes('salsa') || normalizedName.includes('empanada') || normalizedName.includes('palo') || normalizedName.includes('rollito') || normalizedName.includes('gauchito');
        let folder = 'pizzas';
        if (isBebidaFallback) folder = 'bebidas';
        else if (isAcompFallback) folder = 'acompañamientos';
        return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(folder)}%2F${encodeURIComponent(mappedName + '.jpg')}?alt=media`;
      };

      itemsMenu.forEach((it: any) => {
        const imageUrl = getImagePath(it.nombre || it.name, it.imagen || it.image);
        if (imageUrl) {
          const img = new window.Image();
          img.src = imageUrl;
        }
      });
    }
  }, [itemsMenu])

  // Función para refrescar datos manualmente
  const refreshData = () => {
    console.log("Forzando actualización de datos")
    queryClient.invalidateQueries({ queryKey: ['ingredientes'] })
    queryClient.invalidateQueries({ queryKey: ['categorias_menu'] })
    queryClient.invalidateQueries({ queryKey: ['items_menu'] })
    queryClient.invalidateQueries({ queryKey: ['precios_configuracion'] })
  }

  const waitingForItemsMenu = initialized && itemsMenu.length === 0 && itemsMenuInitialLoading
  const loading = ingredientsLoading || categoriesLoading || preciosLoading || waitingForItemsMenu
  const error = ingredientsError || categoriesError || preciosError || itemsMenuInitialError

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

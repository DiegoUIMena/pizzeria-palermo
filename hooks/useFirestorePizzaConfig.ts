import { useEffect, useState, useCallback, useRef } from "react"
import { db } from "../lib/firebase"
import { collection, getDocs, query, onSnapshot } from "firebase/firestore"
import { useFirebase } from "../app/context/FirebaseContext"

export function useFirestorePizzaConfig() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [ingredients, setIngredients] = useState<any[]>([])
  const [itemsMenu, setItemsMenu] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const { initialized } = useFirebase()
  // Añadir un contador de actualizaciones para forzar re-renders
  const [refreshCounter, setRefreshCounter] = useState(0)
  // Use a ref to track when refresh is in progress to prevent duplicate fetches
  const refreshingRef = useRef(false)

  // Función para forzar una recarga de datos
  const refreshData = useCallback(() => {
    const timestamp = Date.now()
    console.log("Forzando actualización de datos de pizzas con timestamp:", timestamp)
    
    // Incrementar el contador y asegurarnos de que sea un valor nuevo cada vez
    setRefreshCounter(oldValue => {
      // Asegurarse de que el nuevo valor sea diferente del anterior
      return oldValue === timestamp ? timestamp + 1 : timestamp
    })
    
    // Programar otra actualización después de un breve momento
    // para asegurarnos de que los cambios se reflejen
    setTimeout(() => {
      console.log("Actualizando datos nuevamente después del timeout:", Date.now())
      setRefreshCounter(Date.now())
    }, 500)
  }, [])

  // Cargar datos de Firestore
  const fetchData = useCallback(async () => {
    if (!initialized || refreshingRef.current) return

    try {
      refreshingRef.current = true
      setLoading(true)
      setError(null)
      
      console.log("Realizando consulta a Firestore para obtener datos actualizados...", Date.now())
      
      // No-cache query options
      const queryOptions = {
        source: 'server' as const  // Force server fetch, not cache
      };
      
      const [ingredientsSnap, itemsMenuSnap, categoriesSnap] = await Promise.all([
        getDocs(collection(db, "ingredientes")),
        getDocs(collection(db, "items_menu")),
        getDocs(collection(db, "categorias_menu")),
      ])
      
      const ingredientsData = ingredientsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const itemsMenuData = itemsMenuSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const categoriesData = categoriesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      
      console.log(`Datos obtenidos de Firestore (${Date.now()}):`, {
        ingredientes: ingredientsData.length,
        itemsMenu: itemsMenuData.length,
        categorias: categoriesData.length
      })
      
      setIngredients(ingredientsData);
      setItemsMenu(itemsMenuData);
      setCategories(categoriesData);
      console.log("Datos de pizzas actualizados correctamente")
    } catch (err) {
      console.error("Error al cargar datos de configuración:", err)
      setError(err instanceof Error ? err : new Error("Error desconocido al cargar datos"))
      // Establecer datos vacíos para evitar que la aplicación falle
      setIngredients([])
      setItemsMenu([])
      setCategories([])
    } finally {
      setLoading(false)
      refreshingRef.current = false
    }
  }, [initialized])

  // Set up an effect for one-time queries and refreshes
  useEffect(() => {
    console.log("Efecto de fetchData ejecutado, refreshCounter:", refreshCounter)
    fetchData()
  }, [fetchData, initialized, refreshCounter])

  // Set up real-time listeners for pizza data changes
  useEffect(() => {
    if (!initialized) return;
    
    console.log("Configurando listener en tiempo real para items_menu", Date.now())
    
    // Set up a real-time listener for the items_menu collection
    const itemsMenuQuery = query(collection(db, "items_menu"));
    const unsubscribe = onSnapshot(itemsMenuQuery, (snapshot) => {
      const itemsMenuData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      console.log(`Actualización en tiempo real recibida para items_menu (${Date.now()}):`, {
        itemsMenu: itemsMenuData.length
      });
      setItemsMenu(itemsMenuData);
    }, (error) => {
      console.error("Error en listener de items_menu:", error);
    });
    
    // Return cleanup function
    return () => {
      console.log("Eliminando listener de items_menu");
      unsubscribe();
    };
  }, [initialized]);

  return { 
    loading, 
    error, 
    ingredients, 
    itemsMenu, 
    categories, 
    refreshData // Exportar la función para que pueda ser utilizada por los componentes
  }
}

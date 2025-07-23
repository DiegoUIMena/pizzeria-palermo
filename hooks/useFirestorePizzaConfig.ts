import { useEffect, useState } from "react"
import { db } from "../lib/firebase"
import { collection, getDocs } from "firebase/firestore"
import { useFirebase } from "../app/context/FirebaseContext"

export function useFirestorePizzaConfig() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [ingredients, setIngredients] = useState<any[]>([])
  const [itemsMenu, setItemsMenu] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const { initialized } = useFirebase()

  useEffect(() => {
    if (!initialized) {
      return; // No realizar la consulta hasta que Firebase esté inicializado
    }

    async function fetchData() {
      try {
        setLoading(true)
        setError(null)
        
        const [ingredientsSnap, itemsMenuSnap, categoriesSnap] = await Promise.all([
          getDocs(collection(db, "ingredientes")),
          getDocs(collection(db, "items_menu")),
          getDocs(collection(db, "categorias_menu")),
        ])
        
        setIngredients(ingredientsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
        setItemsMenu(itemsMenuSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
        setCategories(categoriesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
      } catch (err) {
        console.error("Error al cargar datos de configuración:", err)
        setError(err instanceof Error ? err : new Error("Error desconocido al cargar datos"))
        // Establecer datos vacíos para evitar que la aplicación falle
        setIngredients([])
        setItemsMenu([])
        setCategories([])
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
  }, [initialized])

  return { loading, error, ingredients, itemsMenu, categories }
}

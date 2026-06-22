"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { X, Plus, Minus, ShoppingCart } from "lucide-react"
import Image from "next/image"
import { useCart } from "../context/CartContext"
import { useFirestorePizzaConfig } from "../../hooks/useFirestorePizzaConfig"

// Mapeo de nombres de pizzas a archivos de imagen (normalizados sin acentos)
const imageMap: Record<string, string> = {
  'chilena': 'chilena',
  'bariloche': 'bariloche',
  'buenos aires': 'buenos aires',
  'cuyana': 'cuyana',
  '4 estaciones': '4 estaciones',
  'sevillana': 'sevillana',
  'amalfitana': 'amalfitana',
  'calabresa': 'calabresa',
  'napolitana': 'napolitana',
  'hawaiana': 'hawaiana',
  'neuquen': 'neuquén',
  'la rioja': 'la rioja',
  'cordobesa': 'cordobesa',
  'lujan': 'luján',
  'veggie 1': 'veggie 1',
  'veggie 2': 'veggie 2',
  'recoleta': 'recoleta',
  'entre rios': 'entre rios',
  'centroamericana': 'centroamericana',
  'messi': 'messi',
  'de charly': 'de-charly',
  'del pibe': 'del-pibe jpg',
  'pepperoni cheese': 'pepperoni cheese',
  'pesto margarita': 'pesto margarita',
  'doble muzza': 'doble muzza',
  'chicken bbq': 'chicken bbq',
  '4 quesos': '4 quesos',
}

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

const displayPizzaNameMap: Record<string, string> = {
  'neuquen': 'Neuquén',
  'lujan': 'Luján',
  'entre rios': 'Entre Ríos'
}

const formatPizzaName = (name: string): string => {
  const normalized = normalizeText(name)
  return displayPizzaNameMap[normalized] || name
}

// Función helper para obtener la ruta correcta de la imagen de pizzas
const getPizzaImagePath = (imagePath?: string, pizzaName?: string): string => {

  // Si ya tiene una URL completa de Firebase Storage, usarla directamente
  if (imagePath && imagePath.includes('firebasestorage.googleapis.com')) {
    return imagePath
  }
  
  const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'pizzeria-palermo-17f6d.appspot.com'

  // Si ya tiene una ruta de imagen válida (empieza con /pizzas/) y NO es placeholder
  if (imagePath && !imagePath.includes('placeholder') && !imagePath.startsWith('http')) {
    const parts = imagePath.split('/').filter(Boolean);
    if (parts.length >= 2) {
      const folder = parts[0]; 
      const fileName = parts.slice(1).join('/');
      const url = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(folder)}%2F${encodeURIComponent(fileName)}?alt=media`;
      return url;
    }
  }
  
  // Si es un placeholder o no tiene imagen, buscar por nombre de pizza
  if (pizzaName) {
    const cleanName = normalizeText(pizzaName)
    const mappedName = imageMap[cleanName] || cleanName
    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/pizzas%2F${encodeURIComponent(mappedName + '.jpg')}?alt=media`;
    return url;
  }
  
  // Último recurso: usar fondo genérico
  return "/pizza-promo-bg.png"
}

function getExtraImagePath(itemName: string, imagePath?: string): string {

  if (imagePath && imagePath.includes('firebasestorage.googleapis.com')) {
    return imagePath
  }
  
  const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'pizzeria-palermo-17f6d.appspot.com'
  const lowerName = (itemName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

  if (imagePath && !imagePath.includes('placeholder') && !imagePath.startsWith('http')) {
    if (imagePath.startsWith('/iconos/')) return imagePath;
    const parts = imagePath.split('/').filter(Boolean);
    if (parts.length >= 2) {
      let folder = parts[0]; 
      const fileName = parts.slice(1).join('/');
      
      const isBebidaFallback = lowerName.includes('sprite') || lowerName.includes('fanta') || lowerName.includes('jugo') || lowerName.includes('bebida') || lowerName.includes('lata') || lowerName.includes('botella');
      const isAcompFallback = lowerName.includes('salsa') || lowerName.includes('empanada') || lowerName.includes('palo');
      
      if (isBebidaFallback) folder = 'bebidas';
      else if (isAcompFallback) folder = 'acompañamientos';
      
      const url = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(folder)}%2F${encodeURIComponent(fileName)}?alt=media`;
      return url;
    }
  }

  // Fallback inteligente para nombres genéricos sin imagen
  if (!imagePath || imagePath.includes('placeholder')) {
    const isBebidaFallback = lowerName.includes('coca') || lowerName.includes('sprite') || lowerName.includes('fanta') || lowerName.includes('jugo') || lowerName.includes('bebida') || lowerName.includes('lata') || lowerName.includes('botella') || lowerName.includes('lipton');
    const isAcompFallback = lowerName.includes('salsa') || lowerName.includes('empanada') || lowerName.includes('palo') || lowerName.includes('rollito') || lowerName.includes('gauchito') || lowerName.includes('canela');
    
    const cleanName = itemName.replace(/\s+/g, '_').toLowerCase();
    
    if (isBebidaFallback) {
      const url = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/bebidas%2F${encodeURIComponent(cleanName + '.jpg')}?alt=media`;
      return url;
    } else if (isAcompFallback) {
      const url = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/acompa%C3%B1amientos%2F${encodeURIComponent(cleanName + '.jpg')}?alt=media`;
      return url;
    }
  }

  return imagePath || "/placeholder.svg?height=200&width=200"
}

// Tipos
interface Ingredient {
  id: number
  name: string
  category: "simple" | "premium"
}

interface Extra {
  id: number
  name: string
  price: number
  category: "salsa" | "bebida" | "agregado"
}

interface PizzaSize {
  id: string
  name: string
  simpleBasePrice: number
  premiumBasePrice: number
  simpleExtraPrice: number
  premiumExtraPrice: number
  description?: string
}

interface PizzaConfigModalProps {
  isOpen: boolean
  onClose: () => void
  pizzaType: "promo" | "premium" | "duo"
  isEditing?: boolean
  currentConfig?: {
    id?: number // Added for updating existing item
    size?: string
    ingredients?: string[]
    premiumIngredients?: string[]
    sauces?: string[]
    drinks?: string[]
    extras?: string[]
    comments?: string
    pizzaType?: "promo" | "premium" | "duo"
    pizza1?: string  // Nombre de la primera pizza para DUO
    pizza2?: string  // Nombre de la segunda pizza para DUO
    selectedMenuPizza?: string  // Pizza base seleccionada para Premium/Promo
    sinOregano?: boolean
    sinQueso?: boolean
    sinSalsaTomate?: boolean
  }
}

export default function PizzaConfigModal({
  isOpen,
  onClose,
  pizzaType: initialPizzaType,
  isEditing = false,
  currentConfig,
}: PizzaConfigModalProps) {
  const { addItem, updateItem } = useCart()
  const { loading, ingredients, itemsMenu, categories, preciosConfig } = useFirestorePizzaConfig()

  // Convertir preciosConfig a array de PizzaSize[]
  const pizzaSizes: PizzaSize[] = useMemo(() => {
    if (!preciosConfig) {
      // Fallback mientras se cargan los precios
      return [
        {
          id: "mediana",
          name: "Mediana",
          simpleBasePrice: 8000,
          premiumBasePrice: 8000,
          simpleExtraPrice: 700,
          premiumExtraPrice: 2500,
          description: "Perfecta para 1-2 personas",
        },
        {
          id: "familiar",
          name: "Familiar",
          simpleBasePrice: 10000,
          premiumBasePrice: 10000,
          simpleExtraPrice: 1000,
          premiumExtraPrice: 3500,
          description: "Ideal para 3-4 personas",
        },
      ]
    }
    
    return [
      preciosConfig.pizzaSizes.mediana,
      preciosConfig.pizzaSizes.familiar
    ]
  }, [preciosConfig])

  // Tipar los datos de Firestore
  type FirestoreIngredient = { id: string, nombre: string, categoria: string, clase?: string }
  type FirestoreItem = { id: string, nombre: string, precio: number, precioMediana?: number, categoria: string, imagen?: string, activo?: boolean }

  // Mapear ingredientes desde Firestore (memoizado)
  // Mapear ingredientes simples desde Firestore (memoizado)
  const promoIngredients = useMemo(() => {
    // Verificar que ingredients es un array y tiene elementos
    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return [];
    }
    
    // Filtrar SOLO ingredientes simples usando el campo 'clase'
    const simpleIngredients = (ingredients as FirestoreIngredient[])
      .filter((i) => {
        // Priorizar el campo 'clase' si existe
        if (i.clase) {
          const esSimplePorClase = i.clase.toLowerCase() === "simple";
          return esSimplePorClase;
        }
        
        // Si no hay campo clase, usar categoría como fallback
        const esSimplePorCategoria = i.categoria === "simple";
        return esSimplePorCategoria;
      })
      .map((i, idx) => ({ 
        id: idx + 1, 
        name: i.nombre, 
        category: "simple" as const 
      }));
    
    // Si no se encontraron ingredientes simples, aplicar fallback
    if (simpleIngredients.length === 0) {
      // Como fallback, considerar los ingredientes que NO son premium como simples
      const fallbackSimples = (ingredients as FirestoreIngredient[])
        .filter(i => {
          // Verificar que no sea premium por campo clase o categoría
          const esPremiumPorClase = i.clase && i.clase.toLowerCase() === "premium";
          const esPremiumPorCategoria = !i.clase && i.categoria === "premium";
          return !(esPremiumPorClase || esPremiumPorCategoria);
        })
        .map((i, idx) => ({ 
          id: idx + 1, 
          name: i.nombre, 
          category: "simple" as const 
        }));
      
      return fallbackSimples;
    }
    
    return simpleIngredients;
  }, [ingredients])
  
  // Mapear todos los ingredientes (premium y simples) para la pizza premium
  const premiumIngredients = useMemo(() => {
    // Verificar que ingredients es un array y tiene elementos
    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return [];
    }
    
    // Mapear todos los ingredientes preservando su categoría exacta
    const mappedIngredients = (ingredients as FirestoreIngredient[])
      .filter(i => i && i.nombre)
      .map((i, idx) => {
        // Determinar si es premium o simple, priorizando el campo clase
        let esPremium = false;
        let esSimple = false;
        
        if (i.clase) {
          // Usar primero el campo clase si existe
          esPremium = i.clase.toLowerCase() === "premium";
          esSimple = i.clase.toLowerCase() === "simple";
        } else if (i.categoria) {
          // Si no hay campo clase, usar categoría como fallback
          esPremium = i.categoria === "premium";
          esSimple = i.categoria === "simple";
        }
        
        // Si es premium o simple lo incluimos con su categoría respectiva
        if (esPremium || esSimple) {
          // Mapear "Pollo BBQ" a "Pechuga de Pollo"
          let nombreFinal = i.nombre;
          if (i.nombre === "Pollo BBQ") {
            nombreFinal = "Pechuga de Pollo";
          }
          
          return { 
            id: idx + 1, 
            name: nombreFinal, 
            category: esPremium ? "premium" as const : "simple" as const
          };
        }
        return null;
      })
      .filter((i): i is { id: number; name: string; category: "premium" | "simple" } => i !== null); // Eliminar los null con type guard
    
    return mappedIngredients;
  }, [ingredients])

  // Extras: Salsas, bebidas y agregados desde itemsMenu (memoizado)
  const promoExtras = useMemo(() => {
    
    // FILTRAR SOLO ITEMS ACTIVOS
    const activeItemsMenu = (itemsMenu as FirestoreItem[]).filter((i) => i.activo !== false);
    
    const salsas = activeItemsMenu.filter((i) => i.categoria === "Acompañamientos" && i.nombre.toLowerCase().includes("salsa"));
    
    const bebidas = activeItemsMenu.filter((i) => i.categoria === "Bebidas");
    
    const otrosAcompañamientos = activeItemsMenu.filter((i) => i.categoria === "Acompañamientos" && !i.nombre.toLowerCase().includes("salsa"));
    
    const resultado = [
      ...salsas,
      ...bebidas,
      ...otrosAcompañamientos
    ].map((item, idx) => ({
      id: idx + 1,
      name: item.nombre,
      price: item.precio,
      imagen: item.imagen || "/placeholder.svg",
      category: item.categoria.toLowerCase().includes("bebida") ? "bebida" : item.nombre.toLowerCase().includes("salsa") ? "salsa" : "agregado"
    }));
    
    return resultado;
  }, [itemsMenu])

  // Lista global de pizzas que no deben estar disponibles para DUO
  // Lista global de pizzas que no deben estar disponibles para DUO
  const PIZZAS_EXCLUIDAS = ["4 Estaciones", "Puerto Madryn", "Patagonia", "Entre Ríos"];

  // Función para verificar si una pizza está en la lista de excluidas (insensible a acentos y mayúsculas/minúsculas)
  const isPizzaExcluida = (pizzaName: string) => {
    // Normalizar el texto: convertir a minúsculas y quitar acentos
    const normalizar = (texto: string) => 
      texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    return PIZZAS_EXCLUIDAS.some(excluida => 
      normalizar(pizzaName) === normalizar(excluida));
  };

  // Función para verificar si la pizza es solo familiar
  const isPizzaSoloFamiliar = (pizzaName: string) => {
    const normalizar = (texto: string) => 
      texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    const pizzasSoloFamiliar = ["4 Quesos", "Entre Ríos", "Sevillana"];
    return pizzasSoloFamiliar.some(pizza => 
      normalizar(pizzaName) === normalizar(pizza));
  };

  // Función para verificar si la pizza es "4 Estaciones"
  const is4Estaciones = (pizzaName: string) => {
    const normalizar = (texto: string) => 
      texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    return normalizar(pizzaName) === normalizar("4 Estaciones");
  };

  // Pizzas para DUO (memoizado)
  const palermoTradicionalPizzas = useMemo(() => {
    
    // FILTRAR SOLO PIZZAS ACTIVAS
    const activePizzas = (itemsMenu as FirestoreItem[])
      .filter((i) => i.activo !== false)
      .filter((i) => i.categoria.includes("Pizza"))
      .map((item, idx) => ({
        id: idx + 1,
        name: item.nombre,
        familiarPrice: item.precio,
        medianaPrice: item.precioMediana ?? item.precio,
        image: item.imagen || "/placeholder.svg"
      }));
    
    
    const pizzas = activePizzas
      // Filtrar las pizzas excluidas usando la función mejorada
      .filter(pizza => !isPizzaExcluida(pizza.name));
    
    return pizzas;
  }, [itemsMenu])

  const activePizzaType = isEditing && currentConfig?.pizzaType ? currentConfig.pizzaType : initialPizzaType

  // Estados
  const [selectedSize, setSelectedSize] = useState<PizzaSize>(pizzaSizes[1]) // Familiar por defecto
  const [selectedIngredients, setSelectedIngredients] = useState<{ [key: number]: number }>({})
  const [selectedExtras, setSelectedExtras] = useState<{ [key: number]: number }>({})
  const [comments, setComments] = useState("")
  const [isAdding, setIsAdding] = useState(false)
  const [sinOregano, setSinOregano] = useState(false)
  const [sinQueso, setSinQueso] = useState(false)
  const [sinSalsaTomate, setSinSalsaTomate] = useState(false)

  // Agregar después de los estados existentes
  const [selectedPizza1, setSelectedPizza1] = useState<number | null>(null)
  const [selectedPizza2, setSelectedPizza2] = useState<number | null>(null)
  const [selectedMenuPizza, setSelectedMenuPizza] = useState<string>("")

  // Función para extraer nombre y cantidad de un string como "Jamón (2)"
  const parseItemString = (itemString: string): { name: string; quantity: number } => {
    // Regex corregido: usa \( y \) para paréntesis literales
    const match = itemString.match(/^(.+?)\s*\((\d+)\)$/)
    if (match && match[1] && match[2]) {
      return {
        name: match[1].trim(),
        quantity: Number.parseInt(match[2]),
      }
    }
    // Si no hay cantidad en paréntesis, asumir cantidad 1
    return {
      name: itemString.trim(),
      quantity: 1,
    }
  }

  // Función para resetear estados
  const resetStates = () => {
    setSelectedIngredients({})
    setSelectedExtras({})
    setComments("")
    setSelectedSize(pizzaSizes[1]) // Familiar por defecto
    setSelectedPizza1(null)
    setSelectedPizza2(null)
    setSelectedMenuPizza("") // Resetear pizza base seleccionada
    setSinOregano(false)
    setSinQueso(false)
    setSinSalsaTomate(false)
  }

  // Verificar selecciones cuando cambia el tamaño
  useEffect(() => {
    if (!isOpen || activePizzaType !== "duo") return;
    
    // Obtener pizzas disponibles para el tamaño actual
    const availablePizzas = getAvailablePizzasForSize(selectedSize.id as "familiar" | "mediana")
      .filter(pizza => !PIZZAS_EXCLUIDAS.includes(pizza.name)); // Filtrar pizzas excluidas
    
    const availablePizzaIds = availablePizzas.map(p => p.id);
    
    // Verificar si las pizzas seleccionadas están en la lista de disponibles
    if (selectedPizza1 !== null) {
      const pizza1 = palermoTradicionalPizzas.find(p => p.id === selectedPizza1);
      if (pizza1 && isPizzaExcluida(pizza1.name)) {
        setSelectedPizza1(null);
      } else if (!availablePizzaIds.includes(selectedPizza1)) {
        setSelectedPizza1(null);
      }
    }
    
    if (selectedPizza2 !== null) {
      const pizza2 = palermoTradicionalPizzas.find(p => p.id === selectedPizza2);
      if (pizza2 && isPizzaExcluida(pizza2.name)) {
        setSelectedPizza2(null);
      } else if (!availablePizzaIds.includes(selectedPizza2)) {
        setSelectedPizza2(null);
      }
    }
    
    // Verificar si pizza1 sigue siendo válida
    if (selectedPizza1 && !availablePizzaIds.includes(selectedPizza1)) {
      setSelectedPizza1(null);
    }
    
    // Verificar si pizza2 sigue siendo válida
    if (selectedPizza2 && !availablePizzaIds.includes(selectedPizza2)) {
      setSelectedPizza2(null);
    }
  }, [isOpen, activePizzaType, selectedSize, selectedPizza1, selectedPizza2, PIZZAS_EXCLUIDAS, palermoTradicionalPizzas, isPizzaExcluida]);

  // Efecto para diagnosticar el estado al abrir el modal
  useEffect(() => {
    if (isOpen) {
      // Verificar explícitamente que ninguna pizza seleccionada sea una excluida
      if (activePizzaType === "duo") {
        if (selectedPizza1) {
          const pizza1 = palermoTradicionalPizzas.find(p => p.id === selectedPizza1);
          if (pizza1 && isPizzaExcluida(pizza1.name)) {
            setSelectedPizza1(null);
          }
        }
        
        if (selectedPizza2) {
          const pizza2 = palermoTradicionalPizzas.find(p => p.id === selectedPizza2);
          if (pizza2 && isPizzaExcluida(pizza2.name)) {
            setSelectedPizza2(null);
          }
        }
      }

      // Si el modal se abre pero los ingredientes aún están cargando,
      // podríamos implementar un retraso o indicador de carga aquí
    }
  }, [isOpen, activePizzaType, loading, ingredients, promoIngredients, premiumIngredients, selectedPizza1, selectedPizza2, palermoTradicionalPizzas, isPizzaExcluida]);

  // Efecto principal: maneja la apertura del modal
  useEffect(() => {
    if (!isOpen) return

    if (!isEditing) {
      // NUEVO PEDIDO: Resetear inmediatamente
      resetStates()
    } else if (currentConfig && !loading) {
      // EDICIÓN: Cargar datos del pedido solo cuando los datos de Firestore estén disponibles
      const loadEditData = () => {

        // Set size
        if (currentConfig.size) {
          const size = pizzaSizes.find((s) => s.name === currentConfig.size)
          if (size) {
            setSelectedSize(size)
          }
        }

        // Set ingredients for PROMO/PREMIUM
        if (activePizzaType === "promo" || activePizzaType === "premium") {
          const ingredientsMap: { [key: number]: number } = {}
          const availableIngredientsForType = getAvailableIngredients(activePizzaType)

          // Process simple ingredients
          currentConfig.ingredients?.forEach((ingredientStr) => {
            const parsed = parseItemString(ingredientStr)
            const found = availableIngredientsForType.find(
              (ing) => ing.name.toLowerCase() === parsed.name.toLowerCase() && ing.category === "simple"
            )
            if (found) {
              ingredientsMap[found.id] = parsed.quantity
            }
          })

          // Process premium ingredients
          currentConfig.premiumIngredients?.forEach((ingredientStr) => {
            const parsed = parseItemString(ingredientStr)
            const found = availableIngredientsForType.find(
              (ing) => ing.name.toLowerCase() === parsed.name.toLowerCase() && ing.category === "premium"
            )
            if (found) {
              ingredientsMap[found.id] = parsed.quantity
            }
          })

          setSelectedIngredients(ingredientsMap)
        }

        // Process extras
        const extrasMap: { [key: number]: number } = {}
        const allCartExtras = [
          ...(currentConfig.sauces || []),
          ...(currentConfig.drinks || []),
          ...(currentConfig.extras || []),
        ]
        
        allCartExtras.forEach((extraStr) => {
          const parsed = parseItemString(extraStr)
          const found = promoExtras.find((e) => e.name.toLowerCase() === parsed.name.toLowerCase())
          if (found) {
            extrasMap[found.id] = parsed.quantity
          }
        })
        setSelectedExtras(extrasMap)

        // Set comments
        setComments(currentConfig.comments || "")
        
        // Set personalization options
        setSinOregano(currentConfig.sinOregano || false)
        setSinQueso(currentConfig.sinQueso || false)
        setSinSalsaTomate(currentConfig.sinSalsaTomate || false)
        
        // Set selected menu pizza for Premium/Promo
        if (currentConfig.selectedMenuPizza) {
          setSelectedMenuPizza(currentConfig.selectedMenuPizza)
        }

        // Set DUO pizzas if applicable
        if (activePizzaType === "duo") {
          
          // Obtener pizzas disponibles para el tamaño seleccionado
          const availablePizzas = getAvailablePizzasForSize(selectedSize.id as "familiar" | "mediana");
          
          if (currentConfig.pizza1) {
            const pizza1 = availablePizzas.find(
              (p) => p.name.toLowerCase() === currentConfig.pizza1?.toLowerCase()
            )
            if (pizza1) {
              setSelectedPizza1(pizza1.id)
            } else {
              setSelectedPizza1(null) // Resetear si la pizza ya no está disponible
            }
          }
          if (currentConfig.pizza2) {
            const pizza2 = availablePizzas.find(
              (p) => p.name.toLowerCase() === currentConfig.pizza2?.toLowerCase()
            )
            if (pizza2) {
              setSelectedPizza2(pizza2.id)
            } else {
              setSelectedPizza2(null) // Resetear si la pizza ya no está disponible
            }
          }
        }
      }

      // Ejecutar con un pequeño delay para evitar bucles infinitos
      const timeoutId = setTimeout(loadEditData, 100)
      return () => clearTimeout(timeoutId)
    }
  }, [isOpen, isEditing, currentConfig, activePizzaType, loading, promoExtras, palermoTradicionalPizzas]) // Agregamos loading y las dependencias necesarias

  // Obtener los ingredientes disponibles según el tipo de pizza
  const getAvailableIngredients = (type: "promo" | "premium" | "duo") => {
    if (type === "duo") {
      return [] // DUO no tiene ingredientes seleccionables
    }
    if (type === "promo") {
      // Solo ingredientes simples para pizza promocional
      return promoIngredients
    }
    // Para pizza premium, mostrar tanto ingredientes premium como simples
    return premiumIngredients.filter(i => i.category === "premium" || i.category === "simple")
  }

  const getAvailablePizzasForSize = (size: "familiar" | "mediana") => {
    // Ya no necesitamos filtrar por nombre ya que lo hacemos en palermoTradicionalPizzas
    return palermoTradicionalPizzas.filter((pizza) => {
      if (size === "familiar") return true; // Todas tienen familiar
      return pizza.medianaPrice !== null; // Solo las que tienen precio mediana
    });
  }

  const calculateDuoPrice = () => {
    if (!selectedPizza1 || !selectedPizza2) return 0

    const pizza1 = palermoTradicionalPizzas.find((p) => p.id === selectedPizza1)
    const pizza2 = palermoTradicionalPizzas.find((p) => p.id === selectedPizza2)

    if (!pizza1 || !pizza2) return 0

    const size = selectedSize.id as "familiar" | "mediana"
    const price1 = size === "familiar" ? pizza1.familiarPrice : pizza1.medianaPrice || pizza1.familiarPrice
    const price2 = size === "familiar" ? pizza2.familiarPrice : pizza2.medianaPrice || pizza2.familiarPrice

    return Math.max(price1, price2)
  }

  const calculateTotal = () => {
    if (activePizzaType === "duo") {
      const basePrice = calculateDuoPrice()

      // Agregar costo de extras para Pizza DUO
      const extrasCost = Object.entries(selectedExtras).reduce((sum, [id, quantity]) => {
        const extra = promoExtras.find((e) => e.id === Number(id))
        return sum + (extra ? extra.price * quantity : 0)
      }, 0)

      return basePrice + extrasCost
    }

    // Si hay una pizza del menú seleccionada, usar su precio como base
    let basePrice = activePizzaType === "promo" ? selectedSize.simpleBasePrice : selectedSize.premiumBasePrice
    
    if (selectedMenuPizza && selectedMenuPizza !== "base") {
      const pizzaDelMenu = itemsMenu.find((item) => item.nombre === selectedMenuPizza)
      if (pizzaDelMenu) {
        // Usar precioMediana si el tamaño es mediana, de lo contrario usar precio (familiar)
        basePrice = selectedSize.id === "mediana" 
          ? (pizzaDelMenu.precioMediana ?? pizzaDelMenu.precio) 
          : pizzaDelMenu.precio
      }
    }

    let ingredientsCost = 0
    const currentDisplayIngredients = getAvailableIngredients(activePizzaType)

    if (activePizzaType === "promo") {
      let simpleCount = 0
      Object.entries(selectedIngredients).forEach(([id, quantity]) => {
        const ing = currentDisplayIngredients.find((i) => i.id === Number(id))
        if (ing?.category === "simple") simpleCount += quantity
      })
      const extraSimple = Math.max(0, simpleCount - 2)
      ingredientsCost += extraSimple * selectedSize.simpleExtraPrice
    } else {
      // Premium
      let simpleCount = 0
      let premiumCount = 0
      Object.entries(selectedIngredients).forEach(([id, quantity]) => {
        const ing = currentDisplayIngredients.find((i) => i.id === Number(id))
        if (ing?.category === "simple") simpleCount += quantity
        else if (ing?.category === "premium") premiumCount += quantity
      })
      ingredientsCost += simpleCount * selectedSize.simpleExtraPrice
      ingredientsCost += premiumCount * selectedSize.premiumExtraPrice
    }

    const extrasCost = Object.entries(selectedExtras).reduce((sum, [id, quantity]) => {
      const extra = promoExtras.find((e) => e.id === Number(id))
      return sum + (extra ? extra.price * quantity : 0)
    }, 0)

    return basePrice + ingredientsCost + extrasCost
  }

  const handleIngredientChange = (ingredientId: number, change: number) => {
    setSelectedIngredients((prev) => {
      const currentQuantity = prev[ingredientId] || 0
      const newQuantity = Math.max(0, currentQuantity + change)
      if (newQuantity === 0) {
        const { [ingredientId]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [ingredientId]: newQuantity }
    })
  }

  const handleExtraChange = (extraId: number, change: number) => {
    setSelectedExtras((prev) => {
      const currentQuantity = prev[extraId] || 0
      const newQuantity = Math.max(0, currentQuantity + change)
      if (newQuantity === 0) {
        const { [extraId]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [extraId]: newQuantity }
    })
  }

  const handleSave = async () => {
    setIsAdding(true)

    if (activePizzaType === "duo") {
      if (!selectedPizza1 || !selectedPizza2) {
        alert("Por favor selecciona ambas mitades de la pizza")
        setIsAdding(false)
        return
      }

      const pizza1Name = palermoTradicionalPizzas.find((p) => p.id === selectedPizza1)?.name || "Mitad 1"
      const pizza2Name = palermoTradicionalPizzas.find((p) => p.id === selectedPizza2)?.name || "Mitad 2"
      const pizza1Image = palermoTradicionalPizzas.find((p) => p.id === selectedPizza1)?.image
      const pizzaName = `Pizza Duo ${selectedSize.name} (${pizza1Name} / ${pizza2Name})`

      const cartItemPayload = {
        id: isEditing && currentConfig?.id ? String(currentConfig.id) : String(Date.now()),
        name: pizzaName,
        price: calculateTotal(), // Ahora incluye extras
        image: getPizzaImagePath(pizza1Image, pizza1Name),
        quantity: 1,
        size: selectedSize.name,
        pizzaType: "duo" as const,
        pizza1: pizza1Name,
        pizza2: pizza2Name,
        sauces: Object.entries(selectedExtras)
          .filter(([, quantity]) => quantity > 0)
          .map(([id, quantity]) => {
            const extra = promoExtras.find((e) => e.id === Number(id) && e.category === "salsa")
            return extra ? `${extra.name} (${quantity})` : null
          })
          .filter(Boolean) as string[],
        drinks: Object.entries(selectedExtras)
          .filter(([, quantity]) => quantity > 0)
          .map(([id, quantity]) => {
            const extra = promoExtras.find((e) => e.id === Number(id) && e.category === "bebida")
            return extra ? `${extra.name} (${quantity})` : null
          })
          .filter(Boolean) as string[],
        extras: Object.entries(selectedExtras)
          .filter(([, quantity]) => quantity > 0)
          .map(([id, quantity]) => {
            const extra = promoExtras.find((e) => e.id === Number(id) && e.category === "agregado")
            return extra ? `${extra.name} (${quantity})` : null
          })
          .filter(Boolean) as string[],
        comments: comments,
        basePrice: calculateDuoPrice(), // Agregar esta línea
        sinOregano: sinOregano,
        sinQueso: sinQueso,
        sinSalsaTomate: sinSalsaTomate,
      }

      if (isEditing) {
        updateItem(cartItemPayload)
      } else {
        addItem(cartItemPayload)
      }
    } else {
      const pizzaName = `Pizza ${selectedSize.name} ${activePizzaType === "premium" ? "Premium" : "Promo"}`
      const currentDisplayIngredients = getAvailableIngredients(activePizzaType)

      const ingredientsForCart = Object.entries(selectedIngredients)
        .filter(([, quantity]) => quantity > 0)
        .map(([id, quantity]) => {
          const ing = currentDisplayIngredients.find((i) => i.id === Number(id))
          return ing ? { name: `${ing.name} (${quantity})`, category: ing.category } : null
        })
        .filter(Boolean)

      // Para pizzas Premium/Promo, usar imagen de la pizza del menú si está seleccionada, sino imagen genérica
      const cartItemPayload = {
        id: isEditing && currentConfig?.id ? String(currentConfig.id) : String(Date.now()),
        name: pizzaName,
        price: calculateTotal(),
        image: (() => {
          
          // Si el usuario seleccionó una pizza del menú como base
          if (selectedMenuPizza && selectedMenuPizza !== "base") {
            const pizzaDelMenu = itemsMenu.find((item) => item.nombre === selectedMenuPizza)
            
            if (pizzaDelMenu && pizzaDelMenu.imagen) {
              const finalPath = getPizzaImagePath(pizzaDelMenu.imagen, pizzaDelMenu.nombre)
              return finalPath
            } else if (pizzaDelMenu) {
              // Si encontramos la pizza pero no tiene imagen, usar el nombre para buscar en imageMap
              const finalPath = getPizzaImagePath(undefined, pizzaDelMenu.nombre)
              return finalPath
            } else {
              // Si no encontramos la pizza en itemsMenu, intentar buscar directamente por el nombre seleccionado
              const finalPath = getPizzaImagePath(undefined, selectedMenuPizza)
              return finalPath
            }
          }
          // Si es completamente personalizada, usar imagen genérica
          const genericPath = activePizzaType === "promo" ? "/pizza-promo-bg.png" : "/pizza-premium-bg.png"
          return genericPath
        })(),
        quantity: 1, // Assuming quantity 1 for simplicity, or get from currentConfig if editing
        size: selectedSize.name,
        ingredients: ingredientsForCart.filter((i) => i!.category === "simple").map((i) => i!.name),
        premiumIngredients: ingredientsForCart.filter((i) => i!.category === "premium").map((i) => i!.name),
        sauces: Object.entries(selectedExtras)
          .filter(([, quantity]) => quantity > 0)
          .map(([id, quantity]) => {
            const extra = promoExtras.find((e) => e.id === Number(id) && e.category === "salsa")
            return extra ? `${extra.name} (${quantity})` : null
          })
          .filter(Boolean) as string[],
        drinks: Object.entries(selectedExtras)
          .filter(([, quantity]) => quantity > 0)
          .map(([id, quantity]) => {
            const extra = promoExtras.find((e) => e.id === Number(id) && e.category === "bebida")
            return extra ? `${extra.name} (${quantity})` : null
          })
          .filter(Boolean) as string[],
        extras: Object.entries(selectedExtras)
          .filter(([, quantity]) => quantity > 0)
          .map(([id, quantity]) => {
            const extra = promoExtras.find((e) => e.id === Number(id) && e.category === "agregado")
            return extra ? `${extra.name} (${quantity})` : null
          })
          .filter(Boolean) as string[],
        comments: comments,
        basePrice: (() => {
          // Si hay pizza base seleccionada, usar su precio
          if (selectedMenuPizza && selectedMenuPizza !== "base") {
            const pizzaDelMenu = itemsMenu.find((item) => item.nombre === selectedMenuPizza)
            if (pizzaDelMenu) {
              return selectedSize.id === "mediana" 
                ? (pizzaDelMenu.precioMediana ?? pizzaDelMenu.precio) 
                : pizzaDelMenu.precio
            }
          }
          // Sino, usar precio genérico
          return activePizzaType === "promo" ? selectedSize.simpleBasePrice : selectedSize.premiumBasePrice
        })(),
        // ingredientsPrice and extrasPrice can be recalculated or stored if needed
        pizzaType: activePizzaType,
        selectedMenuPizza: selectedMenuPizza || null, // Guardar la pizza base seleccionada
        sinOregano: sinOregano,
        sinQueso: sinQueso,
        sinSalsaTomate: sinSalsaTomate,
      }

      if (isEditing) {
        updateItem(cartItemPayload)
      } else {
        addItem(cartItemPayload)
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 300))
    setIsAdding(false)
    onClose()
    // alert(isEditing ? "¡Pedido actualizado!" : "¡Pizza agregada al carrito!");
  }

  // Para el render, si es duo, no mostrar ingredientes
  const displayIngredients =
    activePizzaType === "promo" || activePizzaType === "premium"
      ? getAvailableIngredients(activePizzaType)
      : []
  const currentTotal = calculateTotal()

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-md mx-auto h-[95vh] flex flex-col p-0 [&>button]:hidden">
        <div className="relative h-40 bg-gradient-to-br from-pink-400 to-pink-600 flex-shrink-0">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-6xl">🍕</div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/20 z-10"
            onClick={onClose}
          >
            <X className="h-6 w-6" />
          </Button>
        </div>

        <div className="p-4 border-b bg-white flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-800 mb-2">
            {isEditing ? "Editar Pizza" : "BASE DE LA PIZZA"}
          </h2>
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-4">
              <p className="text-gray-600 text-sm mb-1">
                MASA + SALSA + QUESO + ORÉGANO
              </p>
              {activePizzaType === "duo" && (
                <p className="text-gray-800 text-sm font-medium">
                  {selectedPizza1 && selectedPizza2
                    ? `${palermoTradicionalPizzas.find((p) => p.id === selectedPizza1)?.name || "Mitad 1"} / ${palermoTradicionalPizzas.find((p) => p.id === selectedPizza2)?.name || "Mitad 2"}`
                    : "Selecciona tus dos variedades"}
                </p>
              )}
            </div>
            <span className="text-xl font-bold text-pink-600 min-w-[120px] text-right flex-shrink-0">
              ${currentTotal.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-6">
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">ELIGE EL TAMAÑO</h3>
              <div className="grid grid-cols-2 gap-3">
                {pizzaSizes.map((size) => {
                  // Deshabilitar Mediana si se seleccionó "4 Quesos" o "Entre Ríos"
                  const isMedianaDisabled = size.id === "mediana" && isPizzaSoloFamiliar(selectedMenuPizza);
                  
                  return (
                    <Button
                      key={size.id}
                      variant={selectedSize.id === size.id ? "default" : "outline"}
                      className={`p-3 ${selectedSize.id === size.id ? "bg-pink-600 text-white" : "border-gray-200 hover:border-pink-300"} ${isMedianaDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                      onClick={() => {
                        if (!isMedianaDisabled) {
                          setSelectedSize(size);
                        }
                      }}
                      disabled={isMedianaDisabled}
                    >
                      {size.name}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-800 mb-3">MENU DE VARIEDADES</h3>
              <p className="text-sm text-red-600 mb-3">Elije la variedad u omite éste paso y continua con la base</p>
              <Select value={selectedMenuPizza} onValueChange={(value) => {
                setSelectedMenuPizza(value);
                // Si se selecciona "4 Quesos" o "Entre Ríos", cambiar automáticamente a Familiar
                if (isPizzaSoloFamiliar(value) && selectedSize.id === "mediana") {
                  setSelectedSize(pizzaSizes[1]); // Familiar
                }
              }}>
                <SelectTrigger className="w-full text-sm">
                  <SelectValue placeholder="Selecciona una variedad como base" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="base">Solo valor base</SelectItem>
                  {itemsMenu
                    .filter((item) => item.activo !== false)
                    .filter((item) => item.categoria.includes("Pizza"))
                    .filter((item) => !is4Estaciones(item.nombre))
                    .map((pizza, index) => (
                      <SelectItem key={index} value={pizza.nombre}>
                        {formatPizzaName(pizza.nombre)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {selectedMenuPizza && isPizzaSoloFamiliar(selectedMenuPizza) && (
                <p className="text-sm text-amber-600 mt-2">⚠️ Esta pizza solo está disponible en tamaño Familiar</p>
              )}
            </div>

            {activePizzaType === "duo" && (
              <>
                <div className="mb-4">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>
                      Mitad 1: {selectedPizza1 ? 
                        // Verificar explícitamente que la pizza no está en la lista de excluidas
                        palermoTradicionalPizzas.find((p) => p.id === selectedPizza1)?.name || "Sin seleccionar" 
                        : "Sin seleccionar"}
                    </span>
                    <span>
                      Mitad 2: {selectedPizza2 ? 
                        // Verificar explícitamente que la pizza no está en la lista de excluidas
                        palermoTradicionalPizzas.find((p) => p.id === selectedPizza2)?.name || "Sin seleccionar" 
                        : "Sin seleccionar"}
                    </span>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 mb-3">ESCOGE PIZZA DUO</h3>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mitad 1</label>
                      <select
                        value={selectedPizza1 || ""}
                        onChange={(e) => setSelectedPizza1(Number(e.target.value) || null)}
                        className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="">Seleccionar pizza</option>
                        {/* Usar directamente palermoTradicionalPizzas que ya tiene las pizzas excluidas filtradas */}
                        {palermoTradicionalPizzas
                          .filter(pizza => selectedSize.id === "familiar" || pizza.medianaPrice !== null)
                          .filter(pizza => !isPizzaExcluida(pizza.name)) // Filtro adicional para asegurar
                          .map((pizza) => (
                            <option key={pizza.id} value={pizza.id}>
                              {formatPizzaName(pizza.name)}
                            </option>
                          ))
                        }
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mitad 2</label>
                      <select
                        value={selectedPizza2 || ""}
                        onChange={(e) => setSelectedPizza2(Number(e.target.value) || null)}
                        className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="">Seleccionar pizza</option>
                        {/* Usar directamente palermoTradicionalPizzas que ya tiene las pizzas excluidas filtradas */}
                        {palermoTradicionalPizzas
                          .filter(pizza => selectedSize.id === "familiar" || pizza.medianaPrice !== null)
                          .filter(pizza => !isPizzaExcluida(pizza.name)) // Filtro adicional para asegurar
                          .map((pizza) => (
                            <option key={pizza.id} value={pizza.id}>
                              {formatPizzaName(pizza.name)}
                            </option>
                          ))
                        }
                      </select>
                    </div>
                  </div>
                </div>
              </>
            )}

            {activePizzaType !== "duo" && (
              <div>
                <h3 className="font-semibold text-gray-800 mb-1">
                  {activePizzaType === "premium" ? "AGREGA INGREDIENTES" : "ESCOGE INGREDIENTES"}
                </h3>
                
                
                {/* Mostrar ingredientes categorías separadas para pizza premium */}
                {activePizzaType === "premium" && (
                  <>
                    {/* Sección de ingredientes premium */}
                    <div className="mb-4">
                      
                      <div className="space-y-3">
                        {loading ? (
                          <div className="py-2 text-center text-gray-500">
                            <p>Cargando ingredientes...</p>
                          </div>
                        ) : displayIngredients.filter(i => i.category === "premium").length === 0 ? (
                          <div className="py-2 text-center text-gray-500">
                            <p>No hay ingredientes premium disponibles.</p>
                          </div>
                        ) : (
                          displayIngredients
                            .filter(i => i.category === "premium")
                            .map((ingredient) => (
                              <div key={ingredient.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                                <div className="flex items-center space-x-3">
                                  <span className="text-gray-800 text-sm">{ingredient.name}</span>
                                  <span className="text-pink-600 font-semibold text-xs">${selectedSize.premiumExtraPrice.toLocaleString('es-CL')}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="w-7 h-7 rounded-full"
                                    onClick={() => handleIngredientChange(ingredient.id, -1)}
                                    disabled={(selectedIngredients[ingredient.id] || 0) === 0}
                                  >
                                    <Minus className="w-3 h-3" />
                                  </Button>
                                  <span className="w-6 text-center font-medium text-sm">
                                    {selectedIngredients[ingredient.id] || 0}
                                  </span>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="w-7 h-7 rounded-full"
                                    onClick={() => handleIngredientChange(ingredient.id, 1)}
                                  >
                                    <Plus className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            ))
                        )}
                      </div>
                    </div>
                    
                    {/* Sección de ingredientes simples */}
                    <div className="mb-4">
                      <div className="space-y-3">
                        {loading ? (
                          <div className="py-2 text-center text-gray-500">
                            <p>Cargando ingredientes...</p>
                          </div>
                        ) : displayIngredients.filter(i => i.category === "simple").length === 0 ? (
                          <div className="py-2 text-center text-gray-500">
                            <p>No hay ingredientes simples disponibles.</p>
                          </div>
                        ) : (
                          displayIngredients
                            .filter(i => i.category === "simple")
                            .map((ingredient) => (
                              <div key={ingredient.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                                <div className="flex items-center space-x-3">
                                  <span className="text-gray-800 text-sm">{ingredient.name}</span>
                                  <span className="text-pink-600 font-semibold text-xs">${selectedSize.simpleExtraPrice.toLocaleString('es-CL')}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="w-7 h-7 rounded-full"
                                    onClick={() => handleIngredientChange(ingredient.id, -1)}
                                    disabled={(selectedIngredients[ingredient.id] || 0) === 0}
                                  >
                                    <Minus className="w-3 h-3" />
                                  </Button>
                                  <span className="w-6 text-center font-medium text-sm">
                                    {selectedIngredients[ingredient.id] || 0}
                                  </span>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="w-7 h-7 rounded-full"
                                    onClick={() => handleIngredientChange(ingredient.id, 1)}
                                  >
                                    <Plus className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            ))
                        )}
                      </div>
                    </div>
                  </>
                )}
                
                {/* Mostrar todos los ingredientes (simples) para pizza promocional */}
                {activePizzaType === "promo" && (
                  <div className="space-y-3">
                    {loading ? (
                      <div className="py-4 text-center text-gray-500">
                        <p>Cargando ingredientes...</p>
                      </div>
                    ) : displayIngredients.length === 0 ? (
                      <div className="py-4 text-center text-gray-500">
                        <p>No hay ingredientes simples disponibles.</p>
                      </div>
                    ) : (
                      displayIngredients.map((ingredient) => (
                        <div key={ingredient.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                          <div className="flex items-center space-x-3">
                            <span className="text-gray-800 text-sm">{ingredient.name}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="w-7 h-7 rounded-full"
                              onClick={() => handleIngredientChange(ingredient.id, -1)}
                              disabled={(selectedIngredients[ingredient.id] || 0) === 0}
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <span className="w-6 text-center font-medium text-sm">
                              {selectedIngredients[ingredient.id] || 0}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="w-7 h-7 rounded-full"
                              onClick={() => handleIngredientChange(ingredient.id, 1)}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {["SALSAS", "BEBIDAS", "AGREGADOS"].map((categoryTitle) => {
              const categoryKey = categoryTitle.toLowerCase().slice(0, -1) as "salsa" | "bebida" | "agregado"
              const itemsForCategory = promoExtras.filter((extra) => extra.category === categoryKey)
              
              if (itemsForCategory.length === 0) return null
              return (
                <div key={categoryKey}>
                  <h3 className="font-semibold text-gray-800 mb-3">{categoryTitle}</h3>
                  <div className="space-y-3">
                    {itemsForCategory.map((extra) => (
                      <div key={extra.id} className="flex items-center justify-between py-2">
                        <div className="flex items-center space-x-3">
                          {/* Imagen del extra */}
                          <div className="w-12 h-12 rounded-md overflow-hidden flex-shrink-0 border border-gray-200">
                            <Image 
                              src={getExtraImagePath(extra.name, extra.imagen)} 
                              alt={extra.name}
                              width={48}
                              height={48}
                              className="w-full h-full object-cover"
                              onError={(e: any) => {
                                if (!e.currentTarget.src.includes("placeholder.svg")) {
                                  e.currentTarget.src = "/placeholder.svg"
                                }
                              }}
                            />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-gray-800 text-sm font-medium">{extra.name}</span>
                            <span className="text-xs text-pink-600">${extra.price.toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="w-7 h-7 rounded-full"
                            onClick={() => handleExtraChange(extra.id, -1)}
                            disabled={(selectedExtras[extra.id] || 0) === 0}
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="w-6 text-center font-medium text-sm">{selectedExtras[extra.id] || 0}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="w-7 h-7 rounded-full"
                            onClick={() => handleExtraChange(extra.id, 1)}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}

            <div>
              <h3 className="font-semibold text-gray-800 mb-3">Opciones de Personalización</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSinOregano(!sinOregano)}
                  className={`px-3 py-1.5 text-xs rounded-md border transition-all cursor-pointer ${
                    sinOregano
                      ? 'bg-pink-600 text-white border-pink-600 font-semibold'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-pink-400'
                  }`}
                >
                  Sin Orégano
                </button>
                
                <button
                  type="button"
                  onClick={() => setSinQueso(!sinQueso)}
                  className={`px-3 py-1.5 text-xs rounded-md border transition-all cursor-pointer ${
                    sinQueso
                      ? 'bg-pink-600 text-white border-pink-600 font-semibold'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-pink-400'
                  }`}
                >
                  Sin Queso
                </button>
                
                <button
                  type="button"
                  onClick={() => setSinSalsaTomate(!sinSalsaTomate)}
                  className={`px-3 py-1.5 text-xs rounded-md border transition-all cursor-pointer ${
                    sinSalsaTomate
                      ? 'bg-pink-600 text-white border-pink-600 font-semibold'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-pink-400'
                  }`}
                >
                  Sin Salsa Tomate
                </button>
              </div>
            </div>
            <div className="h-4"></div>
          </div>
        </div>

        <div className="border-t bg-gray-50 p-4 flex-shrink-0">
          <Button
            onClick={handleSave}
            disabled={isAdding || loading}
            className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 rounded-lg text-base"
          >
            {isAdding ? (
              "Guardando..."
            ) : loading ? (
              "Cargando datos..."
            ) : (
              <>
                <ShoppingCart className="w-4 h-4 mr-2" />
                {isEditing
                  ? `Actualizar pedido $${currentTotal.toLocaleString()}`
                  : `Agregar a mi pedido $${currentTotal.toLocaleString()}`}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

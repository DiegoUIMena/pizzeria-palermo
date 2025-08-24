"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { X, Plus, Minus, ShoppingCart } from "lucide-react"
import { useCart } from "../context/CartContext"
import { useFirestorePizzaConfig } from "../../hooks/useFirestorePizzaConfig"

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
  description: string
}

// Tamaños de pizza
const pizzaSizes: PizzaSize[] = [
  {
    id: "mediana",
    name: "Mediana",
    simpleBasePrice: 8000,
    premiumBasePrice: 9000,
    simpleExtraPrice: 1000,
    premiumExtraPrice: 1500,
    description: "Perfecta para 1-2 personas",
  },
  {
    id: "familiar",
    name: "Familiar",
    simpleBasePrice: 10000,
    premiumBasePrice: 13000,
    simpleExtraPrice: 1500,
    premiumExtraPrice: 2000,
    description: "Ideal para 3-4 personas",
  },
]

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
  const { loading, ingredients, itemsMenu, categories } = useFirestorePizzaConfig()

  // Tipar los datos de Firestore
  type FirestoreIngredient = { id: string, nombre: string, categoria: string }
  type FirestoreItem = { id: string, nombre: string, precio: number, precioMediana?: number, categoria: string }

  // Mapear ingredientes desde Firestore (memoizado)
  const promoIngredients = useMemo(() => 
    (ingredients as FirestoreIngredient[]).filter((i) => i.categoria === "simple").map((i, idx) => ({ id: idx + 1, name: i.nombre, category: "simple" as const }))
  , [ingredients])
  
  const premiumIngredients = useMemo(() => 
    (ingredients as FirestoreIngredient[]).map((i, idx) => ({ id: idx + 1, name: i.nombre, category: i.categoria as "simple" | "premium" }))
  , [ingredients])

  // Extras: Salsas, bebidas y agregados desde itemsMenu (memoizado)
  const promoExtras = useMemo(() => [
    ...(itemsMenu as FirestoreItem[]).filter((i) => i.categoria === "Acompañamientos" && i.nombre.toLowerCase().includes("salsa")),
    ...(itemsMenu as FirestoreItem[]).filter((i) => i.categoria === "Bebidas"),
    ...(itemsMenu as FirestoreItem[]).filter((i) => i.categoria === "Acompañamientos" && !i.nombre.toLowerCase().includes("salsa")),
  ].map((item, idx) => ({
    id: idx + 1,
    name: item.nombre,
    price: item.precio,
    category: item.categoria.toLowerCase().includes("bebida") ? "bebida" : item.nombre.toLowerCase().includes("salsa") ? "salsa" : "agregado"
  })), [itemsMenu])

  // Pizzas para DUO (memoizado)
  const palermoTradicionalPizzas = useMemo(() => 
    (itemsMenu as FirestoreItem[]).filter((i) => i.categoria.includes("Pizza"))
      .map((item, idx) => ({
        id: idx + 1,
        name: item.nombre,
        familiarPrice: item.precio,
        medianaPrice: item.precioMediana ?? item.precio
      }))
  , [itemsMenu])

  const activePizzaType = isEditing && currentConfig?.pizzaType ? currentConfig.pizzaType : initialPizzaType

  // Estados
  const [selectedSize, setSelectedSize] = useState<PizzaSize>(pizzaSizes[1]) // Familiar por defecto
  const [selectedIngredients, setSelectedIngredients] = useState<{ [key: number]: number }>({})
  const [selectedExtras, setSelectedExtras] = useState<{ [key: number]: number }>({})
  const [comments, setComments] = useState("")
  const [isAdding, setIsAdding] = useState(false)

  // Agregar después de los estados existentes
  const [selectedPizza1, setSelectedPizza1] = useState<number | null>(null)
  const [selectedPizza2, setSelectedPizza2] = useState<number | null>(null)

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
  }

  // Efecto principal: maneja la apertura del modal
  useEffect(() => {
    if (!isOpen) return

    if (!isEditing) {
      // NUEVO PEDIDO: Resetear inmediatamente
      console.log("--- [NEW ORDER] Resetting states ---")
      resetStates()
    } else if (currentConfig && !loading) {
      // EDICIÓN: Cargar datos del pedido solo cuando los datos de Firestore estén disponibles
      const loadEditData = () => {
        console.log("--- [EDIT MODE] Loading order data ---")
        console.log("[EDIT MODE] currentConfig:", JSON.stringify(currentConfig))
        console.log("[EDIT MODE] activePizzaType:", activePizzaType)
        console.log("[EDIT MODE] promoExtras length:", promoExtras.length)
        console.log("[EDIT MODE] palermoTradicionalPizzas length:", palermoTradicionalPizzas.length)

        // Set size
        if (currentConfig.size) {
          const size = pizzaSizes.find((s) => s.name === currentConfig.size)
          if (size) {
            setSelectedSize(size)
            console.log(`[EDIT MODE] Size set to: ${size.name}`)
          }
        }

        // Set ingredients for PROMO/PREMIUM
        if (activePizzaType === "promo" || activePizzaType === "premium") {
          const ingredientsMap: { [key: number]: number } = {}
          const availableIngredientsForType = getAvailableIngredients(activePizzaType)
          console.log("[EDIT MODE] Available ingredients:", availableIngredientsForType.map(i => i.name))

          // Process simple ingredients
          currentConfig.ingredients?.forEach((ingredientStr) => {
            const parsed = parseItemString(ingredientStr)
            console.log(`[EDIT MODE] Processing simple ingredient: "${ingredientStr}" -> ${JSON.stringify(parsed)}`)
            const found = availableIngredientsForType.find(
              (ing) => ing.name.toLowerCase() === parsed.name.toLowerCase() && ing.category === "simple"
            )
            if (found) {
              ingredientsMap[found.id] = parsed.quantity
              console.log(`[EDIT MODE] ✓ Found simple ingredient: ${found.name} (ID: ${found.id})`)
            } else {
              console.log(`[EDIT MODE] ✗ Simple ingredient not found: ${parsed.name}`)
            }
          })

          // Process premium ingredients
          currentConfig.premiumIngredients?.forEach((ingredientStr) => {
            const parsed = parseItemString(ingredientStr)
            console.log(`[EDIT MODE] Processing premium ingredient: "${ingredientStr}" -> ${JSON.stringify(parsed)}`)
            const found = availableIngredientsForType.find(
              (ing) => ing.name.toLowerCase() === parsed.name.toLowerCase() && ing.category === "premium"
            )
            if (found) {
              ingredientsMap[found.id] = parsed.quantity
              console.log(`[EDIT MODE] ✓ Found premium ingredient: ${found.name} (ID: ${found.id})`)
            } else {
              console.log(`[EDIT MODE] ✗ Premium ingredient not found: ${parsed.name}`)
            }
          })

          setSelectedIngredients(ingredientsMap)
          console.log("[EDIT MODE] Final ingredientsMap:", ingredientsMap)
        }

        // Process extras
        const extrasMap: { [key: number]: number } = {}
        const allCartExtras = [
          ...(currentConfig.sauces || []),
          ...(currentConfig.drinks || []),
          ...(currentConfig.extras || []),
        ]
        console.log("[EDIT MODE] Processing extras:", allCartExtras)
        console.log("[EDIT MODE] Available extras:", promoExtras.map(e => e.name))
        
        allCartExtras.forEach((extraStr) => {
          const parsed = parseItemString(extraStr)
          console.log(`[EDIT MODE] Processing extra: "${extraStr}" -> ${JSON.stringify(parsed)}`)
          const found = promoExtras.find((e) => e.name.toLowerCase() === parsed.name.toLowerCase())
          if (found) {
            extrasMap[found.id] = parsed.quantity
            console.log(`[EDIT MODE] ✓ Found extra: ${found.name} (ID: ${found.id})`)
          } else {
            console.log(`[EDIT MODE] ✗ Extra not found: ${parsed.name}`)
          }
        })
        setSelectedExtras(extrasMap)
        console.log("[EDIT MODE] Final extrasMap:", extrasMap)

        // Set comments
        setComments(currentConfig.comments || "")

        // Set DUO pizzas if applicable
        if (activePizzaType === "duo") {
          console.log("[EDIT MODE] Processing DUO pizzas")
          console.log("[EDIT MODE] Available pizzas:", palermoTradicionalPizzas.map(p => p.name))
          
          if (currentConfig.pizza1) {
            const pizza1 = palermoTradicionalPizzas.find(
              (p) => p.name.toLowerCase() === currentConfig.pizza1?.toLowerCase()
            )
            if (pizza1) {
              setSelectedPizza1(pizza1.id)
              console.log(`[EDIT MODE] ✓ Found pizza1: ${pizza1.name} (ID: ${pizza1.id})`)
            } else {
              console.log(`[EDIT MODE] ✗ Pizza1 not found: ${currentConfig.pizza1}`)
            }
          }
          if (currentConfig.pizza2) {
            const pizza2 = palermoTradicionalPizzas.find(
              (p) => p.name.toLowerCase() === currentConfig.pizza2?.toLowerCase()
            )
            if (pizza2) {
              setSelectedPizza2(pizza2.id)
              console.log(`[EDIT MODE] ✓ Found pizza2: ${pizza2.name} (ID: ${pizza2.id})`)
            } else {
              console.log(`[EDIT MODE] ✗ Pizza2 not found: ${currentConfig.pizza2}`)
            }
          }
        }

        console.log("--- [EDIT MODE] Load complete ---")
      }

      // Ejecutar con un pequeño delay para evitar bucles infinitos
      const timeoutId = setTimeout(loadEditData, 100)
      return () => clearTimeout(timeoutId)
    }
  }, [isOpen, isEditing, currentConfig, activePizzaType, loading, promoExtras, palermoTradicionalPizzas]) // Agregamos loading y las dependencias necesarias

  // Solo permitir promo o premium
  const getAvailableIngredients = (type: "promo" | "premium" | "duo") => {
    if (type === "duo") {
      return [] // DUO no tiene ingredientes seleccionables
    }
    if (type === "promo") {
      return promoIngredients
    }
    return premiumIngredients // Contains both simple and premium for "premium" type
  }

  const getAvailablePizzasForSize = (size: "familiar" | "mediana") => {
    return palermoTradicionalPizzas.filter((pizza) => {
      // Filtrar "4 Estaciones"
      if (pizza.name === "4 Estaciones") return false

      if (size === "familiar") return true // Todas tienen familiar
      return pizza.medianaPrice !== null // Solo las que tienen precio mediana
    })
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

    const basePrice = activePizzaType === "promo" ? selectedSize.simpleBasePrice : selectedSize.premiumBasePrice

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
      const extraPremium = Math.max(0, premiumCount - 1)
      ingredientsCost += extraPremium * selectedSize.premiumExtraPrice
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

      const pizza1Name = palermoTradicionalPizzas.find((p) => p.id === selectedPizza1)?.name
      const pizza2Name = palermoTradicionalPizzas.find((p) => p.id === selectedPizza2)?.name
      const pizzaName = `Pizza Duo ${selectedSize.name} (${pizza1Name} / ${pizza2Name})`

      const cartItemPayload = {
  id: isEditing && currentConfig?.id ? String(currentConfig.id) : String(Date.now()),
        name: pizzaName,
        price: calculateTotal(), // Ahora incluye extras
        image: "/pizza-duo-bg.png",
        quantity: 1,
        size: selectedSize.name,
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
        pizzaType: activePizzaType,
      }

      if (isEditing) {
        console.log("[EDIT MODE] About to update DUO item")
        console.log("[EDIT MODE] isEditing:", isEditing)
        console.log("[EDIT MODE] currentConfig?.id:", currentConfig?.id)
        console.log("[EDIT MODE] Payload ID:", cartItemPayload.id)
        updateItem(cartItemPayload)
        console.log("[EDIT MODE] Updating DUO item:", cartItemPayload)
      } else {
        console.log("[NEW] Adding new DUO item")
        addItem(cartItemPayload)
        console.log("Adding new DUO item:", cartItemPayload)
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

      const cartItemPayload = {
        id: isEditing && currentConfig?.id ? String(currentConfig.id) : String(Date.now()),
        name: pizzaName,
        price: calculateTotal(),
        image: activePizzaType === "promo" ? "/pizza-promo-bg.png" : "/pizza-premium-bg.png",
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
        basePrice: activePizzaType === "promo" ? selectedSize.simpleBasePrice : selectedSize.premiumBasePrice,
        // ingredientsPrice and extrasPrice can be recalculated or stored if needed
        pizzaType: activePizzaType,
      }

      if (isEditing) {
        console.log("[EDIT MODE] About to update regular item")
        console.log("[EDIT MODE] isEditing:", isEditing)
        console.log("[EDIT MODE] currentConfig?.id:", currentConfig?.id)
        console.log("[EDIT MODE] Payload ID:", cartItemPayload.id)
        updateItem(cartItemPayload)
        console.log("[EDIT MODE] Updating item:", cartItemPayload)
      } else {
        console.log("[NEW] Adding new regular item")
        addItem(cartItemPayload)
        console.log("Adding new item:", cartItemPayload)
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
            {isEditing ? "Editar Pizza" : "Arma tu Pizza"}{" "}
            {activePizzaType === "premium"
              ? "Premium"
              : activePizzaType === "duo"
              ? "Duo"
              : "Promo"}
          </h2>
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-4">
              <p className="text-gray-600 text-sm mb-1">
                {activePizzaType === "promo"
                  ? "Incluye masa, salsa, queso y 2 ingredientes simples"
                  : activePizzaType === "premium"
                  ? "Incluye masa, salsa, queso y 1 ingrediente premium"
                  : "Dos variedades en una pizza"}
              </p>
              {activePizzaType === "duo" && (
                <p className="text-gray-800 text-sm font-medium">
                  {selectedPizza1 && selectedPizza2
                    ? `${palermoTradicionalPizzas.find((p) => p.id === selectedPizza1)?.name} / ${palermoTradicionalPizzas.find((p) => p.id === selectedPizza2)?.name}`
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
              {activePizzaType === "duo" ? (
                <div className="grid grid-cols-2 gap-3">
                  {pizzaSizes.map((size) => (
                    <Button
                      key={size.id}
                      variant={selectedSize.id === size.id ? "default" : "outline"}
                      className={`p-3 ${selectedSize.id === size.id ? "bg-pink-600 text-white" : "border-gray-200 hover:border-pink-300"}`}
                      onClick={() => setSelectedSize(size)}
                    >
                      {size.name}
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {pizzaSizes.map((size) => (
                    <div
                      key={size.id}
                      className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${selectedSize.id === size.id ? "border-pink-500 bg-pink-50" : "border-gray-200 hover:border-pink-300"}`}
                      onClick={() => setSelectedSize(size)}
                    >
                      <div className="flex-1">
                        <div className="font-medium text-gray-800">{size.name}</div>
                        <div className="text-sm text-gray-600">{size.description}</div>
                      </div>
                      <div className="w-4 h-4 border-2 rounded-full border-gray-300 flex items-center justify-center">
                        {selectedSize.id === size.id && <div className="w-2 h-2 bg-pink-500 rounded-full"></div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {activePizzaType === "duo" && (
              <>
                <div className="mb-4">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>
                      Mitad 1: {selectedPizza1 ? palermoTradicionalPizzas.find((p) => p.id === selectedPizza1)?.name : "Sin seleccionar"}
                    </span>
                    <span>
                      Mitad 2: {selectedPizza2 ? palermoTradicionalPizzas.find((p) => p.id === selectedPizza2)?.name : "Sin seleccionar"}
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
                        {getAvailablePizzasForSize(selectedSize.id as "familiar" | "mediana").map((pizza) => (
                          <option key={pizza.id} value={pizza.id}>
                            {pizza.name}
                          </option>
                        ))}
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
                        {getAvailablePizzasForSize(selectedSize.id as "familiar" | "mediana").map((pizza) => (
                          <option key={pizza.id} value={pizza.id}>
                            {pizza.name}
                          </option>
                        ))}
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
                <p className="text-sm text-gray-600 mb-3">
                  {activePizzaType === "promo"
                    ? "Selecciona ingredientes adicionales (incluye 2 gratis)"
                    : "Selecciona ingredientes premium y simples (incluye 1 premium gratis)"}
                </p>
                <div className="space-y-3">
                  {displayIngredients.map((ingredient) => (
                    <div key={ingredient.id} className="flex items-center justify-between py-2">
                      <div className="flex items-center space-x-3">
                        <span className="text-gray-800 text-sm">{ingredient.name}</span>
                        {ingredient.category === "premium" && (
                          <Badge className="bg-yellow-500 text-white text-xs">Premium</Badge>
                        )}
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
                  ))}
                </div>
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
                          <span className="text-gray-800 text-sm">{extra.name}</span>
                          <span className="text-xs text-pink-600">${extra.price.toLocaleString()}</span>
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
              <h3 className="font-semibold text-gray-800 mb-3">Comentarios</h3>
              <Textarea
                placeholder="Agrega comentarios especiales para tu pizza..."
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                className="min-h-[60px] resize-none text-sm"
              />
            </div>
            <div className="h-4"></div>
          </div>
        </div>

        <div className="border-t bg-gray-50 p-4 flex-shrink-0">
          <Button
            onClick={handleSave}
            disabled={isAdding}
            className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 rounded-lg text-base"
          >
            {isAdding ? (
              "Guardando..."
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

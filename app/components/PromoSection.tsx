"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Plus } from "lucide-react"
import { useCart } from "../context/CartContext"
import { useFirestorePizzaConfig } from "../../hooks/useFirestorePizzaConfig"
import { isItemAvailable } from '../../lib/recipes'

const promos = [
  {
    id: 1,
    name: "Promo Duo Especial",
    description: "Elige 2 Pizzas Especiales y un acompañamiento",
    price: 18990,
    originalPrice: 20570,
    image: "/placeholder.svg?height=200&width=200",
    category: "Promos",
  },
  {
    id: 2,
    name: "Promo Trio Especial",
    description: "Elige 3 Pizzas Especiales",
    price: 22990,
    originalPrice: 26970,
    image: "/placeholder.svg?height=200&width=200",
    category: "Promos",
  },
  {
    id: 3,
    name: "Mega Promo Especial",
    description: "Elige 3 Pizzas Especiales y 2 acompañamientos",
    price: 28990,
    originalPrice: 33760,
    image: "/placeholder.svg?height=200&width=200",
    category: "Promos",
  },
  {
    id: 4,
    name: "Promo Rollitos Especial",
    description: "Elige 1 Pizza Familiar Especial, agrega unos rollitos de canela y unos palitos de ajo",
    price: 14990,
    originalPrice: 16970,
    image: "/placeholder.svg?height=200&width=200",
    category: "Promos",
  },
  {
    id: 5,
    name: "Promo Duo Clásico",
    description: "Elige 2 Pizzas Clásicas y un acompañamiento",
    price: 15990,
    originalPrice: 18970,
    image: "/placeholder.svg?height=200&width=200",
    category: "Promos",
  },
  {
    id: 6,
    name: "Promo Trio Clásico",
    description: "Elige 3 Pizzas Clásicas",
    price: 18490,
    originalPrice: 21470,
    image: "/placeholder.svg?height=200&width=200",
    category: "Promos",
  },
]

const combos = [
  {
    id: 7,
    name: "Super Combo Border Queso",
    description: "Elige 1 Pizza Border Queso, 1 mix de papas y empanaditas y 1 bebida de 1.5L",
    price: 15990,
    originalPrice: 18970,
    image: "/placeholder.svg?height=200&width=200",
    category: "Combos",
  },
  {
    id: 8,
    name: "Combo Border Queso",
    description: "Elige 1 Pizza Border Queso, agrega Palitos de Ajo o Canela y 1 bebida de 1.5L",
    price: 14490,
    originalPrice: 16970,
    image: "/placeholder.svg?height=200&width=200",
    category: "Combos",
  },
]

const pizzasPalermo = [
  {
    id: 101,
    name: "Chilena",
    description: "Salsa, queso, carne de vacuno, tomate fresco, aceitunas, cebolla morada, orégano",
    price: 17900,
    mediumPrice: 13900,
    image: "/placeholder.svg?height=200&width=200",
    category: "Pizzas Palermo",
  },
  {
    id: 102,
    name: "Bariloche",
    description: "Salsa, queso, vacuno asado desmechado, tocino, choricillo, aceitunas, pimentón, orégano",
    price: 17900,
    mediumPrice: 13900,
    image: "/placeholder.svg?height=200&width=200",
    category: "Pizzas Palermo",
  },
  {
    id: 103,
    name: "Buenos Aires",
    description: "Salsa, queso, mechada de vacuno, champiñón, choricillo, aceitunas negras, orégano",
    price: 16900,
    mediumPrice: 13500,
    image: "/placeholder.svg?height=200&width=200",
    category: "Pizzas Palermo",
  },
  {
    id: 104,
    name: "Cuyana",
    description: "Salsa, queso, pechuga de pollo, choricillo, pimentón, tocino, orégano",
    price: 15900,
    mediumPrice: 13500,
    image: "/placeholder.svg?height=200&width=200",
    category: "Pizzas Palermo",
  },
  {
    id: 105,
    name: "4 Estaciones",
    description: "Mechada, pollo BBQ, Amalfitana, Hawaiana",
    price: 15900,
    mediumPrice: null,
    image: "/placeholder.svg?height=200&width=200",
    category: "Pizzas Palermo",
  },
  {
    id: 106,
    name: "Sevillana",
    description: "Salsa, queso, jamón serrano, aceituna sevillana, cebolla morada, choricillo, rúcula, orégano",
    price: 16900,
    mediumPrice: null,
    image: "/placeholder.svg?height=200&width=200",
    category: "Pizzas Palermo",
  },
  {
    id: 107,
    name: "Amalfitana",
    description: "Salsa, queso, jamón artesanal, aceitunas negras, pesto de albahaca, rúcula, orégano",
    price: 15900,
    mediumPrice: 13000,
    image: "/placeholder.svg?height=200&width=200",
    category: "Pizzas Palermo",
  },
  {
    id: 108,
    name: "Calabresa",
    description: "Salsa, queso, tomate fresco, chorizo calabresa, chorizo artesanal, aceitunas negras, orégano",
    price: 16900,
    mediumPrice: 13500,
    image: "/placeholder.svg?height=200&width=200",
    category: "Pizzas Palermo",
  },
  {
    id: 109,
    name: "Entre Ríos",
    description: "Salsa, queso, tomate fresco, camarón al ajillo, aceitunas verdes, toque de perejil, orégano",
    price: 17900,
    mediumPrice: null,
    image: "/placeholder.svg?height=200&width=200",
    category: "Pizzas Palermo",
  },
  {
    id: 110,
    name: "Patagonia",
    description: "Salsa, queso, tomate fresco, salmón ahumado, aceitunas verdes, rúcula, alcaparras, orégano",
    price: 17900,
    mediumPrice: 13900,
    image: "/placeholder.svg?height=200&width=200",
    category: "Pizzas Palermo",
  },
  {
    id: 111,
    name: "Puerto Madryn",
    description: "Salsa bechamel (blanca), queso, espinaca fresca, filete de atún a la mantequilla, champiñón, eneldo",
    price: 17900,
    mediumPrice: 13900,
    image: "/placeholder.svg?height=200&width=200",
    category: "Pizzas Palermo",
  },
  {
    id: 112,
    name: "Recoleta",
    description: "Salsa, queso gouda, queso azul, mermelada de cebolla",
    price: 16900,
    mediumPrice: 13500,
    image: "/placeholder.svg?height=200&width=200",
    category: "Pizzas Palermo",
  },
  {
    id: 113,
    name: "4 Quesos",
    description: "Salsa bechamel, queso gouda, queso azul, queso grana padano, queso de cabra",
    price: 17900,
    mediumPrice: 13900,
    image: "/placeholder.svg?height=200&width=200",
    category: "Pizzas Palermo",
  },
  {
    id: 114,
    name: "Neuquén",
    description: "Salsa, queso, queso de cabra, tomate fresco, pesto de albahaca, orégano (ajo opcional)",
    price: 15900,
    mediumPrice: 13000,
    image: "/placeholder.svg?height=200&width=200",
    category: "Pizzas Palermo",
  },
  {
    id: 115,
    name: "La Rioja",
    description: "Salsa, queso, nueces, queso azul, miel de abeja",
    price: 17900,
    mediumPrice: 13900,
    image: "/placeholder.svg?height=200&width=200",
    category: "Pizzas Palermo",
  },
  {
    id: 116,
    name: "Cordobesa",
    description: "Salsa, queso, láminas de zapallo italiano, arándanos frescos, queso azul",
    price: 16900,
    mediumPrice: 13500,
    image: "/placeholder.svg?height=200&width=200",
    category: "Pizzas Palermo",
  },
  {
    id: 117,
    name: "Luján",
    description: "Salsa, queso, jamón serrano, rúcula, tomate fresco, queso grana padano, orégano",
    price: 17900,
    mediumPrice: 13900,
    image: "/placeholder.svg?height=200&width=200",
    category: "Pizzas Palermo",
  },
  {
    id: 118,
    name: "Hawaiana",
    description: "Salsa, queso, jamón artesanal, piña caramelizada en panela, shot de caramelo",
    price: 13900,
    mediumPrice: 12000,
    image: "/placeholder.svg?height=200&width=200",
    category: "Pizzas Palermo",
  },
  {
    id: 119,
    name: "Veggie 1",
    description: "Salsa, queso, choclo, champiñón, espárragos, pesto de albahaca, rúcula, orégano",
    price: 15900,
    mediumPrice: 13000,
    image: "/placeholder.svg?height=200&width=200",
    category: "Pizzas Palermo",
  },
  {
    id: 120,
    name: "Veggie 2",
    description: "Salsa, queso, champiñón salteado al ajillo, aceitunas negras, cebolla morada, orégano",
    price: 15900,
    mediumPrice: 13000,
    image: "/placeholder.svg?height=200&width=200",
    category: "Pizzas Palermo",
  },
  {
    id: 121,
    name: "Messi",
    description: "Salsa, extra queso, tomate fresco, cebolla morada, aceitunas verdes, orégano",
    price: 15900,
    mediumPrice: 13000,
    image: "/placeholder.svg?height=200&width=200",
    category: "Pizzas Palermo",
  },
]

const pizzasTradicionales = [
  {
    id: 201,
    name: "Pepperoni Cheese",
    description: "Salsa tomate, doble queso, doble pepperoni americano, orégano",
    price: 14500,
    mediumPrice: 12000,
    image: "/placeholder.svg?height=200&width=200",
    category: "Pizzas Tradicionales",
  },
  {
    id: 202,
    name: "Centroamericana",
    description: "Salsa tomate, doble queso, jamón, choclo, pimentón, tocino, orégano",
    price: 15900,
    mediumPrice: 13000,
    image: "/placeholder.svg?height=200&width=200",
    category: "Pizzas Tradicionales",
  },
  {
    id: 203,
    name: "Napolitana",
    description: "Salsa tomate, queso, jamón, aceituna negra, orégano",
    price: 10000,
    mediumPrice: 8500,
    image: "/placeholder.svg?height=200&width=200",
    category: "Pizzas Tradicionales",
  },
  {
    id: 204,
    name: "Pesto Margarita",
    description: "Salsa tomate, doble queso, tomate fresco, orégano, pesto de albahaca",
    price: 14500,
    mediumPrice: 12000,
    image: "/placeholder.svg?height=200&width=200",
    category: "Pizzas Tradicionales",
  },
  {
    id: 205,
    name: "Chicken BBQ",
    description: "Salsa tomate, queso, pechuga de pollo, salsa bbq, cebolla morada, tocino",
    price: 15900,
    mediumPrice: 13000,
    image: "/placeholder.svg?height=200&width=200",
    category: "Pizzas Tradicionales",
  },
  {
    id: 206,
    name: "Doble Muzza",
    description: "Salsa tomate, doble queso, aceituna verde, chimichurri, orégano",
    price: 13000,
    mediumPrice: 10000,
    image: "/placeholder.svg?height=200&width=200",
    category: "Pizzas Tradicionales",
  },
  {
    id: 207,
    name: "De Charly",
    description: "Salsa tomate, doble queso, salame, choclo, aceituna negra, orégano",
    price: 15900,
    mediumPrice: 13000,
    image: "/placeholder.svg?height=200&width=200",
    category: "Pizzas Tradicionales",
  },
  {
    id: 208,
    name: "Del Pibe",
    description: "Salsa tomate, doble queso, jamón artesanal, orégano",
    price: 14500,
    mediumPrice: 12000,
    image: "/placeholder.svg?height=200&width=200",
    category: "Pizzas Tradicionales",
  },
]

const acompanamientos = [
  {
    id: 15,
    name: "Rollitos de Canela",
    description: "Pack de 4 rollitos de canela, dos cobertura glasé canela y dos de chocolate",
    price: 4900,
    originalPrice: null,
    image: "/placeholder.svg?height=200&width=200",
    category: "Acompañamientos",
  },
  {
    id: 16,
    name: "Gauchitos",
    description: "Nuestra versión de palitos de ajo al estilo Tortafrita Argentina",
    price: 4000,
    originalPrice: null,
    image: "/placeholder.svg?height=200&width=200",
    category: "Acompañamientos",
  },
  {
    id: 17,
    name: "Salsa de Ajo",
    description: "Deliciosa salsa de ajo para acompañar tus pizzas",
    price: 700,
    originalPrice: null,
    image: "/placeholder.svg?height=200&width=200",
    category: "Acompañamientos",
  },
  {
    id: 18,
    name: "Salsa Chimichurri",
    description: "Tradicional salsa chimichurri argentina",
    price: 700,
    originalPrice: null,
    image: "/placeholder.svg?height=200&width=200",
    category: "Acompañamientos",
  },
  {
    id: 19,
    name: "Salsa BBQ",
    description: "Salsa barbacoa dulce y ahumada",
    price: 700,
    originalPrice: null,
    image: "/placeholder.svg?height=200&width=200",
    category: "Acompañamientos",
  },
  {
    id: 20,
    name: "Salsa Pesto",
    description: "Salsa pesto de albahaca fresca",
    price: 1000,
    originalPrice: null,
    image: "/placeholder.svg?height=200&width=200",
    category: "Acompañamientos",
  },
  // bebidas moved to the `bebidas` array below
]

const bebidas = [
  {
    id: 401,
    name: "Coca Cola Lata 350cc",
    description: "Disfruta el sabor de tu bebida Coca Cola en lata de 350cc",
    price: 1500,
    originalPrice: null,
    image: "/placeholder.svg?height=200&width=200",
    category: "Acompañamientos",
    variants: ["Tradicional", "Zero"],
  },
  {
    id: 402,
    name: "Coca Cola 1.5 Litro",
    description: "Disfruta el sabor de tu bebida Coca Cola en botella de 1.5 litros",
    price: 2900,
    originalPrice: null,
    image: "/placeholder.svg?height=200&width=200",
    category: "Acompañamientos",
    variants: ["Tradicional", "Zero"],
  },
]

export default function PromoSection() {
  const initialCategoryKey = "🥬" // placeholder, will set below
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const { addItem } = useCart()
  const [selectedSizes, setSelectedSizes] = useState<{ [key: number]: "familiar" | "mediana" }>({})
  const { loading: configLoading, itemsMenu, ingredients } = useFirestorePizzaConfig()

  // Categories = key (internal) and label (display)
  const categories = [
    { key: "Pizzas Vegetarianas", label: "🥬 Pizzas Vegetarianas" },
    { key: "Pizzas con Carne", label: "🥩 Pizzas con Carne" },
    { key: "Pizzas del Mar", label: "🐟 Pizzas del Mar" },
    { key: "Quiero armar mi pizza", label: "🍕 Quiero armar mi pizza", href: "/armar-pizza" },
    { key: "Combos", label: "🎁 Combos" },
    { key: "Acompañamientos", label: "🍟 Acompañamientos" },
    { key: "Bebidas", label: "🥤 Bebidas" },
  ]

  // Inicializar activeCategory con la primera categoría (si no se setea aún)
  useEffect(() => {
    if (activeCategory === null && categories.length > 0) {
      setActiveCategory(categories[0].key)
    }
  }, [activeCategory, categories])

  // Leer query param ?category=... y mapear a keys internas
  const searchParams = useSearchParams()
  useEffect(() => {
    const q = searchParams?.get("category")
    if (!q) return

    const map: Record<string, string> = {
      vegetarianas: "Pizzas Vegetarianas",
      carne: "Pizzas con Carne",
      delmar: "Pizzas del Mar",
      armar: "Quiero armar mi pizza",
      combos: "Combos",
      acompanamientos: "Acompañamientos",
      bebidas: "Bebidas",
    }

    const mapped = map[q.toLowerCase()]
    if (mapped) {
      setActiveCategory(mapped)
    }
  }, [searchParams])

  const pizzaCategoryKeys = [
    "Pizzas Palermo",
    "Pizzas Tradicionales",
    "Pizzas Vegetarianas",
    "Pizzas con Carne",
    "Pizzas del Mar",
  ]

  const mapFirestoreItemToUI = (it: any) => ({
    id: it.id || it.nombre || Math.random(),
    name: it.nombre || it.name || "Item",
    description: it.descripcion || it.description || "",
    price: typeof it.precio === 'number' ? it.precio : it.price || 0,
    mediumPrice: it.precioMediana || it.mediumPrice || null,
    image: it.image || it.imagen || "/placeholder.svg?height=200&width=200",
    variants: it.variants || it.variantes,
    category: it.categoria || it.category,
    clasificacion: it.clasificacion,
  })

  const getCurrentItems = () => {
    // If Firestore items are not available, fallback to static arrays
    if (!itemsMenu || itemsMenu.length === 0) {
      switch (activeCategory) {
        case "Promos":
          return promos
        case "Combos":
          return combos
        case "Pizzas Palermo":
          return pizzasPalermo
        case "Pizzas Tradicionales":
          return pizzasTradicionales
        case "Acompañamientos":
          return acompanamientos
        case "Bebidas":
          return (acompanamientos as any[]).filter(a => a.variants)
        default:
          return promos
      }
    }

    // If firestore items exist, use classification filters for pizza categories
    if (activeCategory === "Pizzas del Mar") {
      return itemsMenu.filter((it: any) => it.clasificacion === "marina").map(mapFirestoreItemToUI)
    }
    if (activeCategory === "Pizzas con Carne") {
      return itemsMenu.filter((it: any) => it.clasificacion === "carnica").map(mapFirestoreItemToUI)
    }
    if (activeCategory === "Pizzas Vegetarianas") {
      return itemsMenu.filter((it: any) => it.clasificacion === "vegetariana").map(mapFirestoreItemToUI)
    }

    // Other categories: try to match by categoria field
    switch (activeCategory) {
      case "Combos":
        return combos
      case "Promos":
        return promos
      case "Acompañamientos":
        return acompanamientos
      case "Bebidas":
        return itemsMenu
          .filter((it: any) => (it.categoria || it.category || "").toLowerCase().includes("bebid"))
          .map(mapFirestoreItemToUI)
      case "Pizzas Palermo":
        return itemsMenu
          .filter((it: any) => (it.categoria || it.category || "").toLowerCase().includes("palermo") || (it.categoria || it.category || "").toLowerCase().includes("especial"))
          .map(mapFirestoreItemToUI)
      case "Pizzas Tradicionales":
        return itemsMenu
          .filter((it: any) => (it.categoria || it.category || "").toLowerCase().includes("tradicional") || (it.categoria || it.category || "").toLowerCase().includes("clasica"))
          .map(mapFirestoreItemToUI)
      default:
        return promos
    }
  }

  const ingredientsById = (ingredients || []).reduce((acc: any, ing: any) => {
    acc[ing.id] = ing
    return acc
  }, {})

  const currentItems: any[] = getCurrentItems()

  const handleSizeChange = (itemId: number, size: "familiar" | "mediana") => {
    setSelectedSizes((prev) => ({
      ...prev,
      [itemId]: size,
    }))
  }

  const handleAddToCart = (item: any) => {
  if (pizzaCategoryKeys.includes(activeCategory || "")) {
      const selectedSize = selectedSizes[item.id] || "familiar"
      const finalPrice = selectedSize === "mediana" && item.mediumPrice ? item.mediumPrice : item.price

      addItem({
        id: `${item.id}-${selectedSize}`,
        name: `${item.name} (${selectedSize === "familiar" ? "Familiar" : "Mediana"})`,
        price: finalPrice,
        image: item.image,
        quantity: 1,
        size: selectedSize === "familiar" ? "Familiar" : "Mediana",
      })
    } else if (item.variants) {
      // Manejar bebidas con variantes en cualquier categoría
      const selectedVariant = selectedSizes[item.id] || "familiar" // "familiar" = "Tradicional"
      const variantName = selectedVariant === "familiar" ? "Tradicional" : "Zero"

      addItem({
        id: `${item.id}-${selectedVariant}`,
        name: `${item.name} ${variantName}`,
        price: item.price,
        image: item.image,
        quantity: 1,
        variant: variantName,
      })
    } else {
      addItem({
        id: item.id,
        name: item.name,
        price: item.price,
        image: item.image,
        quantity: 1,
      })
    }
  }

  return (
    <section id="promo-section" className="py-12 bg-gray-50">
      <div className="container mx-auto px-4">
        {/* Category Tabs */}
        <div className="mb-8">
          {/* Desktop - Botones en línea (ahora permiten wrap) */}
          <div className="hidden md:flex md:flex-wrap gap-4 justify-center">
            {categories.map((cat) => (
              cat.href ? (
                <Link href={cat.href} key={cat.key}>
                  <Button
                    variant={activeCategory === cat.key ? "default" : "outline"}
                    className={`px-4 lg:px-8 py-3 font-bold rounded-full transition-all whitespace-nowrap ${
                      activeCategory === cat.key
                        ? "bg-pink-600 text-white hover:bg-pink-700 shadow-lg"
                        : "border-pink-300 text-pink-600 hover:bg-pink-50 hover:border-pink-400"
                    }`}
                  >
                    {cat.label}
                  </Button>
                </Link>
              ) : (
                <Button
                  key={cat.key}
                  data-category={cat.key}
                  variant={activeCategory === cat.key ? "default" : "outline"}
                  onClick={() => setActiveCategory(cat.key)}
                  className={`px-4 lg:px-8 py-3 font-bold rounded-full transition-all whitespace-nowrap ${
                    activeCategory === cat.key
                      ? "bg-pink-600 text-white hover:bg-pink-700 shadow-lg"
                      : "border-pink-300 text-pink-600 hover:bg-pink-50 hover:border-pink-400"
                  }`}
                >
                  {cat.label}
                </Button>
              )
            ))}

            {/* 'Armar pizza' está incluido en categories; no se necesita botón duplicado */}
          </div>

          {/* Mobile - Grid de botones (ovalados y adaptativos) */}
          <div className="md:hidden grid grid-cols-2 gap-3 px-4">
            {categories.map((cat) => (
              cat.href ? (
                <Link href={cat.href} key={cat.key} className="col-span-1">
                  <Button
                    variant={activeCategory === cat.key ? "default" : "outline"}
                    className={`px-2 py-3 font-bold rounded-full transition-all text-xs leading-tight text-center whitespace-normal break-words ${
                      activeCategory === cat.key
                        ? "bg-pink-600 text-white hover:bg-pink-700 shadow-lg"
                        : "border-pink-300 text-pink-600 hover:bg-pink-50 hover:border-pink-400"
                    }`}
                  >
                    <span className="text-center break-words">{cat.label}</span>
                  </Button>
                </Link>
              ) : (
                <Button
                  key={cat.key}
                  data-category={cat.key}
                  variant={activeCategory === cat.key ? "default" : "outline"}
                  onClick={() => setActiveCategory(cat.key)}
                  className={`px-2 py-3 font-bold rounded-full transition-all text-xs leading-tight text-center whitespace-normal break-words ${
                    activeCategory === cat.key
                      ? "bg-pink-600 text-white hover:bg-pink-700 shadow-lg"
                      : "border-pink-300 text-pink-600 hover:bg-pink-50 hover:border-pink-400"
                  }`}
                >
                  <span className="text-center break-words">{cat.label}</span>
                </Button>
              )
            ))}

            {/* 'Armar pizza' incluido en categories; se omite botón duplicado en móvil */}
          </div>
        </div>

        <h2 className="text-4xl font-bold text-gray-800 mb-12 text-center">{activeCategory}</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {currentItems.map((item) => {
            // Determine availability if item has receta (from Firestore items may have receta field)
            const recipe = (item.receta) ? item.receta : undefined
            const avail = recipe ? isItemAvailable(recipe, ingredientsById, 1) : { available: true }
            const disabled = !avail.available

            return (
            <Card key={item.id} className={`card-enhanced overflow-hidden group ${disabled ? 'opacity-60 grayscale' : ''}`}>
              <CardContent className="p-0">
                <div className="flex flex-col h-full">
                  <div className="w-full h-48 relative flex-shrink-0 overflow-hidden">
                    <Image
                      src={item.image || "/placeholder.svg"}
                      alt={item.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="flex-1 p-6 bg-white">
                    <h3 className="font-bold text-xl mb-3 text-gray-800">{item.name}</h3>
                    <p className="text-sm mb-4 text-gray-600 leading-relaxed">{item.description}</p>
                    <div className="flex flex-col space-y-3">
                      {/* Mostrar precios para pizzas Palermo y Tradicionales */}
                      {pizzaCategoryKeys.includes(activeCategory || "") && (
                        <div className="bg-gray-100 rounded-lg p-3 border-l-4 border-pink-500">
                          {item.mediumPrice ? (
                            <div className="space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="font-semibold text-gray-800">Familiar</span>
                                <span className="text-lg font-bold text-pink-600">${(item.price ?? 0).toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="font-semibold text-gray-800">Mediana</span>
                                <span className="text-lg font-bold text-pink-600">
                                  ${(item.mediumPrice ?? 0).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-between items-center">
                              <span className="font-semibold text-gray-800">Familiar</span>
                              <span className="text-lg font-bold text-pink-600">${(item.price ?? 0).toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Selector de tamaño para pizzas Palermo y Tradicionales */}
                      {pizzaCategoryKeys.includes(activeCategory || "") &&
                        item.mediumPrice && (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleSizeChange(item.id, "familiar")}
                              className={`flex-1 px-3 py-2 text-xs rounded-lg font-medium transition-colors ${
                                (selectedSizes[item.id] || "familiar") === "familiar"
                                  ? "bg-pink-600 text-white shadow-md"
                                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                              }`}
                            >
                              Familiar
                            </button>
                            <button
                              onClick={() => handleSizeChange(item.id, "mediana")}
                              className={`flex-1 px-3 py-2 text-xs rounded-lg font-medium transition-colors ${
                                selectedSizes[item.id] === "mediana"
                                  ? "bg-pink-600 text-white shadow-md"
                                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                              }`}
                            >
                              Mediana
                            </button>
                          </div>
                        )}

                      {/* Selector de variantes para bebidas */}
                      {activeCategory === "Acompañamientos" && item.variants && (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleSizeChange(item.id, "familiar")}
                            className={`flex-1 px-3 py-2 text-xs rounded-lg font-medium transition-colors ${
                              (selectedSizes[item.id] || "familiar") === "familiar"
                                ? "bg-pink-600 text-white shadow-md"
                                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                            }`}
                          >
                            Tradicional
                          </button>
                          <button
                            onClick={() => handleSizeChange(item.id, "mediana")}
                            className={`flex-1 px-3 py-2 text-xs rounded-lg font-medium transition-colors ${
                              selectedSizes[item.id] === "mediana"
                                ? "bg-pink-600 text-white shadow-md"
                                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                            }`}
                          >
                            Zero
                          </button>
                        </div>
                      )}

                      {/* Precio y botón para otras categorías */}
                      <div className="flex items-center justify-between">
                        {!pizzaCategoryKeys.includes(activeCategory || "") ? (
                          <>
                            <div className="flex flex-col">
                              <span className="text-2xl font-bold text-pink-600">${(item.price ?? 0).toLocaleString()}</span>
                              {item.originalPrice && (
                                <span className="text-sm line-through text-gray-400">
                                  ${(item.originalPrice ?? 0).toLocaleString()}
                                </span>
                              )}
                            </div>
                            {disabled ? (
                              <div className="text-sm text-gray-500 font-semibold">No disponible</div>
                            ) : (
                              <Button
                                size="icon"
                                className="bg-pink-600 text-white hover:bg-pink-700 rounded-full shadow-md hover:shadow-lg transition-all transform hover:-translate-y-1"
                                onClick={() => handleAddToCart(item)}
                              >
                                <Plus className="w-5 h-5" />
                              </Button>
                            )}
                          </>
                        ) : (
                          disabled ? (
                            <div className="text-sm text-gray-500 font-semibold ml-auto">No disponible</div>
                          ) : (
                            <Button
                              size="icon"
                              className="bg-pink-600 text-white hover:bg-pink-700 rounded-full shadow-md hover:shadow-lg transition-all transform hover:-translate-y-1 ml-auto"
                              onClick={() => handleAddToCart(item)}
                            >
                              <Plus className="w-5 h-5" />
                            </Button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )})}
        </div>
      </div>
      {/* Estilos CSS para el efecto neon */}
      <style jsx>{`
        @keyframes pulse-neon {
          0%,
          100% {
            box-shadow: 0 0 20px rgba(236, 72, 153, 0.5), 0 0 40px rgba(236, 72, 153, 0.3),
              0 0 60px rgba(236, 72, 153, 0.1);
          }
          50% {
            box-shadow: 0 0 30px rgba(236, 72, 153, 0.8), 0 0 60px rgba(236, 72, 153, 0.5),
              0 0 90px rgba(236, 72, 153, 0.3);
          }
        }

        .animate-pulse-neon {
          animation: pulse-neon 2s ease-in-out infinite;
        }

        .shadow-neon {
          box-shadow: 0 0 20px rgba(236, 72, 153, 0.5), 0 0 40px rgba(236, 72, 153, 0.3);
        }

        .shadow-neon-intense {
          box-shadow: 0 0 30px rgba(236, 72, 153, 0.8), 0 0 60px rgba(236, 72, 153, 0.5),
              0 0 90px rgba(236, 72, 153, 0.3);
        }

        @media (max-width: 768px) {
          .animate-pulse-neon {
            animation-duration: 3s;
          }
        }
      `}</style>
    </section>
  )
}

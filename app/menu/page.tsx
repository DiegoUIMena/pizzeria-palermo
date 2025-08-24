"use client"

import { useState } from "react"
import Image from "next/image"
import Header from "../components/Header"
import Footer from "../components/Footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Plus } from "lucide-react"
import { useCart } from "../context/CartContext"

const menuCategories = [
  {
    name: "Pizzas Palermo",
    items: [
      {
        id: 101,
        name: "Chilena",
        description: "Salsa, queso, carne de vacuno, tomate fresco, aceitunas, cebolla morada, orégano",
        price: 17900,
        mediumPrice: 13900,
        image: "/placeholder.svg?height=200&width=200",
      },
      {
        id: 102,
        name: "Bariloche",
        description: "Salsa, queso, vacuno asado desmechado, tocino, choricillo, aceitunas, pimentón, orégano",
        price: 17900,
        mediumPrice: 13900,
        image: "/placeholder.svg?height=200&width=200",
      },
      {
        id: 103,
        name: "Buenos Aires",
        description: "Salsa, queso, mechada de vacuno, champiñón, choricillo, aceitunas negras, orégano",
        price: 16900,
        mediumPrice: 13500,
        image: "/placeholder.svg?height=200&width=200",
      },
      {
        id: 104,
        name: "Cuyana",
        description: "Salsa, queso, pechuga de pollo, choricillo, pimentón, tocino, orégano",
        price: 15900,
        mediumPrice: 13500,
        image: "/placeholder.svg?height=200&width=200",
      },
      {
        id: 105,
        name: "4 Estaciones",
        description: "Mechada, pollo BBQ, Amalfitana, Hawaiana",
        price: 15900,
        mediumPrice: null, // solo familiar
        image: "/placeholder.svg?height=200&width=200",
      },
      {
        id: 106,
        name: "Sevillana",
        description: "Salsa, queso, jamón serrano, aceituna sevillana, cebolla morada, choricillo, rúcula, orégano",
        price: 16900,
        mediumPrice: null, // solo familiar
        image: "/placeholder.svg?height=200&width=200",
      },
      {
        id: 107,
        name: "Amalfitana",
        description: "Salsa, queso, jamón artesanal, aceitunas negras, pesto de albahaca, rúcula, orégano",
        price: 15900,
        mediumPrice: 13000,
        image: "/placeholder.svg?height=200&width=200",
      },
      {
        id: 108,
        name: "Calabresa",
        description: "Salsa, queso, tomate fresco, chorizo calabresa, chorizo artesanal, aceitunas negras, orégano",
        price: 16900,
        mediumPrice: 13500,
        image: "/placeholder.svg?height=200&width=200",
      },
      {
        id: 109,
        name: "Entre Ríos",
        description: "Salsa, queso, tomate fresco, camarón al ajillo, aceitunas verdes, toque de perejil, orégano",
        price: 17900,
        mediumPrice: null, // solo familiar
        image: "/placeholder.svg?height=200&width=200",
      },
      {
        id: 110,
        name: "Patagonia",
        description: "Salsa, queso, tomate fresco, salmón ahumado, aceitunas verdes, rúcula, alcaparras, orégano",
        price: 17900,
        mediumPrice: 13900,
        image: "/placeholder.svg?height=200&width=200",
      },
      {
        id: 111,
        name: "Puerto Madryn",
        description:
          "Salsa bechamel (blanca), queso, espinaca fresca, filete de atún a la mantequilla, champiñón, eneldo",
        price: 17900,
        mediumPrice: 13900,
        image: "/placeholder.svg?height=200&width=200",
      },
      {
        id: 112,
        name: "Recoleta",
        description: "Salsa, queso gouda, queso azul, mermelada de cebolla",
        price: 16900,
        mediumPrice: 13500,
        image: "/placeholder.svg?height=200&width=200",
      },
      {
        id: 113,
        name: "4 Quesos",
        description: "Salsa bechamel, queso gouda, queso azul, queso grana padano, queso de cabra",
        price: 17900,
        mediumPrice: 13900,
        image: "/placeholder.svg?height=200&width=200",
      },
      {
        id: 114,
        name: "Neuquén",
        description: "Salsa, queso, queso de cabra, tomate fresco, pesto de albahaca, orégano (ajo opcional)",
        price: 15900,
        mediumPrice: 13000,
        image: "/placeholder.svg?height=200&width=200",
      },
      {
        id: 115,
        name: "La Rioja",
        description: "Salsa, queso, nueces, queso azul, miel de abeja",
        price: 17900,
        mediumPrice: 13900,
        image: "/placeholder.svg?height=200&width=200",
      },
      {
        id: 116,
        name: "Cordobesa",
        description: "Salsa, queso, láminas de zapallo italiano, arándanos frescos, queso azul",
        price: 16900,
        mediumPrice: 13500,
        image: "/placeholder.svg?height=200&width=200",
      },
      {
        id: 117,
        name: "Luján",
        description: "Salsa, queso, jamón serrano, rúcula, tomate fresco, queso grana padano, orégano",
        price: 17900,
        mediumPrice: 13900,
        image: "/placeholder.svg?height=200&width=200",
      },
      {
        id: 118,
        name: "Hawaiana",
        description: "Salsa, queso, jamón artesanal, piña caramelizada en panela, shot de caramelo",
        price: 13900,
        mediumPrice: 12000,
        image: "/placeholder.svg?height=200&width=200",
      },
      {
        id: 119,
        name: "Veggie 1",
        description: "Salsa, queso, choclo, champiñón, espárragos, pesto de albahaca, rúcula, orégano",
        price: 15900,
        mediumPrice: 13000,
        image: "/placeholder.svg?height=200&width=200",
      },
      {
        id: 120,
        name: "Veggie 2",
        description: "Salsa, queso, champiñón salteado al ajillo, aceitunas negras, cebolla morada, orégano",
        price: 15900,
        mediumPrice: 13000,
        image: "/placeholder.svg?height=200&width=200",
      },
      {
        id: 121,
        name: "Messi",
        description: "Salsa, extra queso, tomate fresco, cebolla morada, aceitunas verdes, orégano",
        price: 15900,
        mediumPrice: 13000,
        image: "/placeholder.svg?height=200&width=200",
      },
    ],
  },
  {
    name: "Pizzas Tradicionales",
    items: [
      {
        id: 201,
        name: "Pepperoni Cheese",
        description: "Salsa tomate, doble queso, doble pepperoni americano, orégano",
        price: 14500,
        mediumPrice: 12000,
        image: "/placeholder.svg?height=200&width=200",
      },
      {
        id: 202,
        name: "Centroamericana",
        description: "Salsa tomate, doble queso, jamón, choclo, pimentón, tocino, orégano",
        price: 15900,
        mediumPrice: 13000,
        image: "/placeholder.svg?height=200&width=200",
      },
      {
        id: 203,
        name: "Napolitana",
        description: "Salsa tomate, queso, jamón, aceituna negra, orégano",
        price: 10000,
        mediumPrice: 8500,
        image: "/placeholder.svg?height=200&width=200",
      },
      {
        id: 204,
        name: "Pesto Margarita",
        description: "Salsa tomate, doble queso, tomate fresco, orégano, pesto de albahaca",
        price: 14500,
        mediumPrice: 12000,
        image: "/placeholder.svg?height=200&width=200",
      },
      {
        id: 205,
        name: "Chicken BBQ",
        description: "Salsa tomate, queso, pechuga de pollo, salsa bbq, cebolla morada, tocino",
        price: 15900,
        mediumPrice: 13000,
        image: "/placeholder.svg?height=200&width=200",
      },
      {
        id: 206,
        name: "Doble Muzza",
        description: "Salsa tomate, doble queso, aceituna verde, chimichurri, orégano",
        price: 13000,
        mediumPrice: 10000,
        image: "/placeholder.svg?height=200&width=200",
      },
      {
        id: 207,
        name: "De Charly",
        description: "Salsa tomate, doble queso, salame, choclo, aceituna negra, orégano",
        price: 15900,
        mediumPrice: 13000,
        image: "/placeholder.svg?height=200&width=200",
      },
      {
        id: 208,
        name: "Del Pibe",
        description: "Salsa tomate, doble queso, jamón artesanal, orégano",
        price: 14500,
        mediumPrice: 12000,
        image: "/placeholder.svg?height=200&width=200",
      },
    ],
  },
  {
    name: "Acompañamientos",
    items: [
      {
        id: 301,
        name: "Rollitos de Canela",
        description: "Pack de 4 rollitos de canela, dos cobertura glasé canela y dos de chocolate",
        price: 4900,
        image: "/placeholder.svg?height=200&width=200",
      },
      {
        id: 302,
        name: "Gauchitos",
        description: "Nuestra versión de palitos de ajo al estilo Tortafrita Argentina",
        price: 4000,
        image: "/placeholder.svg?height=200&width=200",
      },
      {
        id: 303,
        name: "Salsa de Ajo",
        description: "Deliciosa salsa de ajo para acompañar tus pizzas",
        price: 700,
        image: "/placeholder.svg?height=200&width=200",
      },
      {
        id: 304,
        name: "Salsa Chimichurri",
        description: "Tradicional salsa chimichurri argentina",
        price: 700,
        image: "/placeholder.svg?height=200&width=200",
      },
      {
        id: 305,
        name: "Salsa BBQ",
        description: "Salsa barbacoa dulce y ahumada",
        price: 700,
        image: "/placeholder.svg?height=200&width=200",
      },
      {
        id: 306,
        name: "Salsa Pesto",
        description: "Salsa pesto de albahaca fresca",
        price: 1000,
        image: "/placeholder.svg?height=200&width=200",
      },
    ],
  },
  {
    name: "Bebidas",
    items: [
      {
        id: 401,
        name: "Coca Cola Lata 350cc",
        description: "Disfruta el sabor de tu bebida Coca Cola en lata de 350cc",
        price: 1500,
        mediumPrice: 1500, // Mismo precio para ambas opciones
        image: "/placeholder.svg?height=200&width=200",
        variants: ["Tradicional", "Zero"],
      },
      {
        id: 402,
        name: "Coca Cola 1.5 Litro",
        description: "Disfruta el sabor de tu bebida Coca Cola en botella de 1.5 litros",
        price: 2900,
        mediumPrice: 2900, // Mismo precio para ambas opciones
        image: "/placeholder.svg?height=200&width=200",
        variants: ["Tradicional", "Zero"],
      },
    ],
  },
]

export default function MenuPage() {
  const [activeCategory, setActiveCategory] = useState("Pizzas Palermo")
  const { addItem } = useCart()
  const [selectedSizes, setSelectedSizes] = useState<{ [key: number]: "familiar" | "mediana" }>({})

  const handleSizeChange = (itemId: number, size: "familiar" | "mediana") => {
    setSelectedSizes((prev) => ({
      ...prev,
      [itemId]: size,
    }))
  }

  const handleAddToCart = (item: any) => {
    if (activeCategory === "Pizzas Palermo" || activeCategory === "Pizzas Tradicionales") {
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
    } else if (activeCategory === "Bebidas" && "variants" in item && Array.isArray(item.variants)) {
      const selectedVariant = selectedSizes[item.id] || "familiar" // Reutilizamos el estado pero "familiar" = "Tradicional"
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

  const currentCategory = menuCategories.find((cat) => cat.name === activeCategory)

  return (
    <div className="min-h-screen bg-black">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-white mb-8">Nuestro Menú</h1>

        {/* Category Navigation */}
        <div className="flex flex-wrap gap-2 mb-8">
          {menuCategories.map((category) => (
            <Button
              key={category.name}
              variant={activeCategory === category.name ? "default" : "outline"}
              onClick={() => setActiveCategory(category.name)}
              className={`${
                activeCategory === category.name
                  ? "bg-pink-400 text-white hover:bg-pink-500"
                  : "border-pink-400 text-pink-400 hover:bg-pink-400 hover:text-white"
              }`}
            >
              {category.name}
            </Button>
          ))}
        </div>

        {/* Menu Items */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {currentCategory?.items.map((item) => (
            <Card key={item.id} className="bg-gradient-to-br from-pink-400 to-pink-500 border-none overflow-hidden">
              <CardContent className="p-0">
                <div className="relative h-48">
                  <Image src={item.image || "/placeholder.svg"} alt={item.name} fill className="object-cover" />
                </div>
                <div className="p-4 text-white">
                  <h3 className="font-bold text-lg mb-2">{item.name}</h3>
                  <p className="text-sm mb-3 opacity-80">{item.description}</p>
                  <div className="flex flex-col space-y-3">
                    {/* Mostrar precios para pizzas Palermo, Tradicionales y Bebidas */}
                    {(activeCategory === "Pizzas Palermo" ||
                      activeCategory === "Pizzas Tradicionales" ||
                      activeCategory === "Bebidas") && (
                      <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 border-l-4 border-white">
                        {"variants" in item && Array.isArray(item.variants) ? (
                          <div className="space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="font-semibold text-white">Tradicional</span>
                              <span className="text-lg font-bold text-white">${item.price.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="font-semibold text-white">Zero</span>
                              <span className="text-lg font-bold text-white">${item.price.toLocaleString()}</span>
                            </div>
                          </div>
                        ) : ("mediumPrice" in item && typeof item.mediumPrice === "number") ? (
                          <div className="space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="font-semibold text-white">Familiar</span>
                              <span className="text-lg font-bold text-white">${item.price.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="font-semibold text-white">Mediana</span>
                              <span className="text-lg font-bold text-white">${item.mediumPrice.toLocaleString()}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-white">Familiar</span>
                            <span className="text-lg font-bold text-white">${item.price.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Selector de tamaño para pizzas y variantes para bebidas */}
                    {(activeCategory === "Pizzas Palermo" || activeCategory === "Pizzas Tradicionales") &&
                      ("mediumPrice" in item && typeof item.mediumPrice === "number") && (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleSizeChange(item.id, "familiar")}
                            className={`flex-1 px-3 py-2 text-xs rounded-lg font-medium transition-colors ${
                              (selectedSizes[item.id] || "familiar") === "familiar"
                                ? "bg-white text-pink-500 shadow-md"
                                : "bg-white/30 text-white hover:bg-white/40"
                            }`}
                          >
                            Familiar
                          </button>
                          <button
                            onClick={() => handleSizeChange(item.id, "mediana")}
                            className={`flex-1 px-3 py-2 text-xs rounded-lg font-medium transition-colors ${
                              selectedSizes[item.id] === "mediana"
                                ? "bg-white text-pink-500 shadow-md"
                                : "bg-white/30 text-white hover:bg-white/40"
                            }`}
                          >
                            Mediana
                          </button>
                        </div>
                      )}

                    {activeCategory === "Bebidas" && "variants" in item && Array.isArray(item.variants) && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleSizeChange(item.id, "familiar")}
                          className={`flex-1 px-3 py-2 text-xs rounded-lg font-medium transition-colors ${
                            (selectedSizes[item.id] || "familiar") === "familiar"
                              ? "bg-white text-pink-500 shadow-md"
                              : "bg-white/30 text-white hover:bg-white/40"
                          }`}
                        >
                          Tradicional
                        </button>
                        <button
                          onClick={() => handleSizeChange(item.id, "mediana")}
                          className={`flex-1 px-3 py-2 text-xs rounded-lg font-medium transition-colors ${
                            selectedSizes[item.id] === "mediana"
                              ? "bg-white text-pink-500 shadow-md"
                              : "bg-white/30 text-white hover:bg-white/40"
                          }`}
                        >
                          Zero
                        </button>
                      </div>
                    )}

                    {/* Precio y botón para otras categorías */}
                    <div className="flex items-center justify-between">
                      {activeCategory !== "Pizzas Palermo" &&
                      activeCategory !== "Pizzas Tradicionales" &&
                      activeCategory !== "Bebidas" ? (
                        <>
                          <span className="text-xl font-bold">${item.price.toLocaleString()}</span>
                          <Button
                            size="icon"
                            className="bg-black text-pink-400 hover:bg-gray-800 rounded-full"
                            onClick={() => handleAddToCart(item)}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="icon"
                          className="bg-black text-pink-400 hover:bg-gray-800 rounded-full ml-auto"
                          onClick={() => handleAddToCart(item)}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  )
}

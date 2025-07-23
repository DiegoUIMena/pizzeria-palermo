"use client"

import { useState, useMemo } from "react"
import { Search, X, Plus } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCart } from "../context/CartContext"

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
}

// Base de datos de productos para búsqueda
const allProducts = [
  // Pizzas Palermo
  {
    id: 1,
    name: "Palermo Especial",
    category: "Pizzas Palermo",
    price: 8990,
    image: "/placeholder.svg?height=80&width=80&text=Pizza",
    sizes: ["Personal", "Mediana", "Familiar"],
  },
  {
    id: 2,
    name: "Mediterránea",
    category: "Pizzas Palermo",
    price: 9490,
    image: "/placeholder.svg?height=80&width=80&text=Pizza",
    sizes: ["Personal", "Mediana", "Familiar"],
  },
  {
    id: 3,
    name: "Prosciutto",
    category: "Pizzas Palermo",
    price: 9990,
    image: "/placeholder.svg?height=80&width=80&text=Pizza",
    sizes: ["Personal", "Mediana", "Familiar"],
  },
  {
    id: 4,
    name: "Quattro Formaggi",
    category: "Pizzas Palermo",
    price: 9290,
    image: "/placeholder.svg?height=80&width=80&text=Pizza",
    sizes: ["Personal", "Mediana", "Familiar"],
  },
  {
    id: 5,
    name: "Capricciosa",
    category: "Pizzas Palermo",
    price: 8790,
    image: "/placeholder.svg?height=80&width=80&text=Pizza",
    sizes: ["Personal", "Mediana", "Familiar"],
  },

  // Pizzas Tradicionales
  {
    id: 6,
    name: "Margherita",
    category: "Pizzas Tradicionales",
    price: 6990,
    image: "/placeholder.svg?height=80&width=80&text=Pizza",
    sizes: ["Personal", "Mediana", "Familiar"],
  },
  {
    id: 7,
    name: "Pepperoni",
    category: "Pizzas Tradicionales",
    price: 7490,
    image: "/placeholder.svg?height=80&width=80&text=Pizza",
    sizes: ["Personal", "Mediana", "Familiar"],
  },
  {
    id: 8,
    name: "Hawaiana",
    category: "Pizzas Tradicionales",
    price: 7990,
    image: "/placeholder.svg?height=80&width=80&text=Pizza",
    sizes: ["Personal", "Mediana", "Familiar"],
  },
  {
    id: 9,
    name: "Americana",
    category: "Pizzas Tradicionales",
    price: 8490,
    image: "/placeholder.svg?height=80&width=80&text=Pizza",
    sizes: ["Personal", "Mediana", "Familiar"],
  },
  {
    id: 10,
    name: "Vegetariana",
    category: "Pizzas Tradicionales",
    price: 7790,
    image: "/placeholder.svg?height=80&width=80&text=Pizza",
    sizes: ["Personal", "Mediana", "Familiar"],
  },

  // Acompañamientos
  {
    id: 11,
    name: "Rollitos de Ajo",
    category: "Acompañamientos",
    price: 2990,
    image: "/placeholder.svg?height=80&width=80&text=Rollitos",
  },
  {
    id: 12,
    name: "Gauchitos",
    category: "Acompañamientos",
    price: 3490,
    image: "/placeholder.svg?height=80&width=80&text=Gauchitos",
  },
  {
    id: 13,
    name: "Papas Fritas",
    category: "Acompañamientos",
    price: 2490,
    image: "/placeholder.svg?height=80&width=80&text=Papas",
  },
  {
    id: 14,
    name: "Alitas BBQ",
    category: "Acompañamientos",
    price: 4990,
    image: "/placeholder.svg?height=80&width=80&text=Alitas",
  },
  {
    id: 15,
    name: "Nuggets",
    category: "Acompañamientos",
    price: 3990,
    image: "/placeholder.svg?height=80&width=80&text=Nuggets",
  },

  // Bebidas
  {
    id: 16,
    name: "Coca Cola Lata 350cc",
    category: "Bebidas",
    price: 1490,
    image: "/placeholder.svg?height=80&width=80&text=Coca+Lata",
    variants: ["Tradicional", "Zero"],
  },
  {
    id: 17,
    name: "Coca Cola 1.5 Litro",
    category: "Bebidas",
    price: 2900,
    image: "/placeholder.svg?height=80&width=80&text=Coca+1.5L",
    variants: ["Tradicional", "Zero"],
  },
  {
    id: 18,
    name: "Agua Mineral",
    category: "Bebidas",
    price: 990,
    image: "/placeholder.svg?height=80&width=80&text=Agua",
  },
  {
    id: 19,
    name: "Jugo Natural",
    category: "Bebidas",
    price: 1990,
    image: "/placeholder.svg?height=80&width=80&text=Jugo",
  },

  // Ingredientes Premium
  {
    id: 20,
    name: "Jamón Serrano",
    category: "Ingredientes Premium",
    price: 1500,
    image: "/placeholder.svg?height=80&width=80&text=Serrano",
  },
  {
    id: 21,
    name: "Queso de Cabra",
    category: "Ingredientes Premium",
    price: 1200,
    image: "/placeholder.svg?height=80&width=80&text=Cabra",
  },
  {
    id: 22,
    name: "Rúcula",
    category: "Ingredientes Premium",
    price: 800,
    image: "/placeholder.svg?height=80&width=80&text=Rucula",
  },
  {
    id: 23,
    name: "Tomates Cherry",
    category: "Ingredientes Premium",
    price: 900,
    image: "/placeholder.svg?height=80&width=80&text=Cherry",
  },
  {
    id: 24,
    name: "Aceitunas Kalamata",
    category: "Ingredientes Premium",
    price: 1000,
    image: "/placeholder.svg?height=80&width=80&text=Aceitunas",
  },
]

export default function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedSize, setSelectedSize] = useState<{ [key: number]: string }>({})
  const [selectedVariant, setSelectedVariant] = useState<{ [key: number]: string }>({})
  const { addItem } = useCart()

  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return []

    return allProducts.filter(
      (product) =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category.toLowerCase().includes(searchTerm.toLowerCase()),
    )
  }, [searchTerm])

  const handleAddToCart = (product: any) => {
    const size = selectedSize[product.id] || (product.sizes ? product.sizes[0] : undefined)
    const variant = selectedVariant[product.id] || (product.variants ? product.variants[0] : undefined)

    let finalPrice = product.price
    if (size === "Mediana") finalPrice = Math.round(product.price * 1.3)
    if (size === "Familiar") finalPrice = Math.round(product.price * 1.6)

    const cartItem = {
      id: Date.now() + Math.random(),
      name: `${product.name}${size ? ` (${size})` : ""}${variant ? ` - ${variant}` : ""}`,
      price: finalPrice,
      image: product.image,
      quantity: 1,
      size,
      basePrice: finalPrice,
    }

    addItem(cartItem)
  }

  const handleSizeChange = (productId: number, size: string) => {
    setSelectedSize((prev) => ({ ...prev, [productId]: size }))
  }

  const handleVariantChange = (productId: number, variant: string) => {
    setSelectedVariant((prev) => ({ ...prev, [productId]: variant }))
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-gray-800">
            <Search className="w-5 h-5 text-pink-600" />
            Buscar productos
          </DialogTitle>
        </DialogHeader>

        {/* Barra de búsqueda */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            type="text"
            placeholder="Buscar pizzas, acompañamientos, bebidas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-3 text-base border-2 border-gray-200 focus:border-pink-500 rounded-lg"
            autoFocus
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Resultados de búsqueda */}
        <div className="flex-1 overflow-y-auto">
          {!searchTerm.trim() ? (
            <div className="text-center py-12 text-gray-500">
              <Search className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">Escribe para buscar productos</p>
              <p className="text-sm">Pizzas, acompañamientos, bebidas y más...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Search className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">No se encontraron productos</p>
              <p className="text-sm">Intenta con otros términos de búsqueda</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-4">
                    <img
                      src={product.image || "/placeholder.svg"}
                      alt={product.name}
                      className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-gray-800 text-lg">{product.name}</h3>
                          <p className="text-sm text-gray-500">{product.category}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg text-pink-600">
                            $
                            {(selectedSize[product.id] === "Mediana"
                              ? Math.round(product.price * 1.3)
                              : selectedSize[product.id] === "Familiar"
                                ? Math.round(product.price * 1.6)
                                : product.price
                            ).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {/* Selector de tamaño para pizzas */}
                      {product.sizes && (
                        <div className="mb-3">
                          <p className="text-sm font-medium text-gray-700 mb-2">Tamaño:</p>
                          <div className="flex gap-2">
                            {product.sizes.map((size) => (
                              <button
                                key={size}
                                onClick={() => handleSizeChange(product.id, size)}
                                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                                  (selectedSize[product.id] || product.sizes[0]) === size
                                    ? "bg-pink-500 text-white border-pink-500"
                                    : "bg-white text-gray-600 border-gray-300 hover:border-pink-300"
                                }`}
                              >
                                {size}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Selector de variante para bebidas */}
                      {product.variants && (
                        <div className="mb-3">
                          <p className="text-sm font-medium text-gray-700 mb-2">Tipo:</p>
                          <div className="flex gap-2">
                            {product.variants.map((variant) => (
                              <button
                                key={variant}
                                onClick={() => handleVariantChange(product.id, variant)}
                                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                                  (selectedVariant[product.id] || product.variants[0]) === variant
                                    ? "bg-pink-500 text-white border-pink-500"
                                    : "bg-white text-gray-600 border-gray-300 hover:border-pink-300"
                                }`}
                              >
                                {variant}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <Button
                        onClick={() => handleAddToCart(product)}
                        className="w-full bg-pink-500 hover:bg-pink-600 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Agregar al carrito
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

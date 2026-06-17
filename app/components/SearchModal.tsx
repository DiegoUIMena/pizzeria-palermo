"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import Image from "next/image"
import { useFirestorePizzaConfig } from "../../hooks/useFirestorePizzaConfig"
import { scrollToSection } from "@/lib/scroll-utils"
import { getImagePath } from "./PromoSection"

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
}

/*
// Promos y combos guardados como referencia hasta que se configuren en la BD
// Productos estáticos (Promos y Combos)
const staticProducts = [
  {
    id: 1,
    name: "Promo Duo Especial",
    category: "Promos",
    price: 18990,
    image: "/placeholder.svg?height=80&width=80",
  },
  {
    id: 3,
    name: "Mega Promo Especial",
    category: "Promos",
    price: 28990,
    image: "/placeholder.svg?height=80&width=80",
  },
  {
    id: 4,
    name: "Promo Rollitos Especial",
    category: "Promos",
    price: 14990,
    image: "/placeholder.svg?height=80&width=80",
  },
  {
    id: 5,
    name: "Promo Duo Clásico",
    category: "Promos",
    price: 15990,
    image: "/placeholder.svg?height=80&width=80",
  },
  {
    id: 6,
    name: "Promo Trio Clásico",
    category: "Promos",
    price: 18490,
    image: "/placeholder.svg?height=80&width=80",
  },
  {
    id: 7,
    name: "Super Combo Border Queso",
    category: "Combos",
    price: 15990,
    image: "/placeholder.svg?height=80&width=80",
  },
  {
    id: 8,
    name: "Combo Border Queso",
    category: "Combos",
    price: 14490,
    image: "/placeholder.svg?height=80&width=80",
  },
]
*/

export default function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const router = useRouter()
  
  // Obtener datos de Firestore
  const { itemsMenu, loading } = useFirestorePizzaConfig()

  // Construir lista de todos los productos
  const allProducts = useMemo(() => {
    const firestoreProducts = (itemsMenu || [])
      .filter((item: any) => {
        // Excluir ingredientes individuales y items inactivos
        const categoria = (item.categoria || item.category || "").toLowerCase()
        return !categoria.includes("ingrediente") && 
               item.disponible !== false && 
               item.activo !== false
      })
      .map((item: any) => {
        // Mapear clasificación a categoría legible
        let category = item.categoria || item.category || "Otros"
        if (item.clasificacion === "vegetariana") category = "Pizzas Vegetarianas"
        if (item.clasificacion === "carnica") category = "Pizzas con Carne"
        if (item.clasificacion === "marina") category = "Pizzas del Mar"

        return {
          id: item.id,
          name: item.nombre || item.name || "Sin nombre",
          category,
          price: item.precioFamiliar || item.price || 0,
          mediumPrice: item.precioMediana || null,
          image: getImagePath(item.nombre || item.name || "Sin nombre", item.image || item.imagen),
          hasSizes: !!(item.precioFamiliar && item.precioMediana),
          variants: item.variantes || item.variants || null,
        }
      })

    return firestoreProducts
  }, [itemsMenu])

  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return []

    const term = searchTerm.toLowerCase()
    return allProducts.filter(
      (product) =>
        product.name.toLowerCase().includes(term) ||
        product.category.toLowerCase().includes(term),
    )
  }, [searchTerm, allProducts])

  const handleProductClick = (product: any) => {
    // Cerrar modal
    onClose()
    
    // Mapear categoría a key para URL
    const categoryMap: Record<string, string> = {
      "Pizzas Vegetarianas": "vegetarianas",
      "Pizzas con Carne": "carne",  
      "Pizzas del Mar": "delmar",
      "Combos": "combos",
      "Acompañamientos": "acompanamientos",
      "Bebidas": "bebidas",
      "Promos": "palermo",
      "Todas las Pizzas": "palermo"
    }
    
    const categoryKey = categoryMap[product.category] || "palermo"
    
    // Si no estamos en la página principal, navegar
    if (window.location.pathname !== "/") {
      router.push(`/?category=${categoryKey}`)
      // Esperar a que cargue y hacer scroll al producto específico
      setTimeout(() => {
        scrollToProduct(productId)
      }, 800)
    } else {
      // Ya estamos en inicio, activar categoría y hacer scroll
      activateCategoryAndScrollToProduct(product.category, product.id)
    }
  }

  const scrollToProduct = (productId: number) => {
    const productCard = document.querySelector(`[data-product-id="${productId}"]`) as HTMLElement
    if (productCard) {
      const yOffset = -120
      const y = productCard.getBoundingClientRect().top + window.pageYOffset + yOffset
      
      // Animación de scroll personalizada con requestAnimationFrame
      const startY = window.pageYOffset
      const targetY = y
      const distance = targetY - startY
      const duration = 1000 // Duración de la animación en ms
      let start: number | null = null

      function step(timestamp: number) {
        if (!start) start = timestamp
        const progress = timestamp - start
        const percent = Math.min(progress / duration, 1)
        
        // Función de easing (ease-in-out cubic)
        const ease = percent < 0.5
          ? 4 * percent * percent * percent
          : 1 - Math.pow(-2 * percent + 2, 3) / 2
        
        window.scrollTo(0, startY + distance * ease)
        
        if (progress < duration) {
          window.requestAnimationFrame(step)
        } else {
          // Al terminar el scroll, aplicar efecto de resaltado tipo balisa
          const originalBoxShadow = productCard.style.boxShadow
          const originalTransition = productCard.style.transition
          const originalFilter = productCard.style.filter
          const originalTransform = productCard.style.transform
          const originalZIndex = productCard.style.zIndex
          
          // Asegurar que el producto esté por encima de otros
          productCard.style.zIndex = '50'
          
          // Crear efecto de parpadeo tipo balisa (2 pulsos suaves)
          let pulseCount = 0
          const totalPulses = 2
          
          function pulse() {
            if (pulseCount < totalPulses) {
              // Fase de encendido - Neon fucsia intenso pero suave
              productCard.style.transition = 'all 0.4s ease-in-out'
              productCard.style.boxShadow = '0 0 0 6px rgba(236, 72, 153, 0.9), 0 0 30px rgba(236, 72, 153, 0.8), 0 0 50px rgba(236, 72, 153, 0.6), 0 0 80px rgba(236, 72, 153, 0.4), 0 0 120px rgba(236, 72, 153, 0.2)'
              productCard.style.filter = 'brightness(1.2) saturate(1.3)'
              productCard.style.transform = 'scale(1.04)'
              
              setTimeout(() => {
                // Fase de apagado
                productCard.style.transition = 'all 0.4s ease-in-out'
                productCard.style.boxShadow = '0 0 0 2px rgba(236, 72, 153, 0.3), 0 0 10px rgba(236, 72, 153, 0.2)'
                productCard.style.filter = 'brightness(0.9)'
                productCard.style.transform = 'scale(1)'
                
                pulseCount++
                if (pulseCount < totalPulses) {
                  setTimeout(pulse, 400) // Pausa entre pulsos
                } else {
                  // Último estado: mantener resaltado suave
                  setTimeout(() => {
                    productCard.style.transition = 'all 0.8s ease-out'
                    productCard.style.boxShadow = '0 0 0 3px rgba(236, 72, 153, 0.5), 0 0 20px rgba(236, 72, 153, 0.4), 0 0 40px rgba(236, 72, 153, 0.2)'
                    productCard.style.filter = 'brightness(1.1)'
                    productCard.style.transform = 'scale(1.02)'
                    
                    // Remover efecto completamente después
                    setTimeout(() => {
                      productCard.style.transition = 'all 0.6s ease-out'
                      productCard.style.boxShadow = originalBoxShadow
                      productCard.style.filter = originalFilter
                      productCard.style.transform = originalTransform
                      
                      setTimeout(() => {
                        productCard.style.transition = originalTransition
                        productCard.style.zIndex = originalZIndex
                      }, 600)
                    }, 1500)
                  }, 400)
                }
              }, 500) // Duración del pulso encendido
            }
          }
          
          // Iniciar secuencia de parpadeo
          pulse()
        }
      }
      
      window.requestAnimationFrame(step)
    }
  }

  const activateCategoryAndScrollToProduct = (category: string, productId: number) => {
    // Buscar el elemento de categoría y hacer click
    const categoryElement = document.querySelector(`[data-category="${category}"]`) as HTMLElement
    if (categoryElement) {
      // Si es un div con onclick (no un link), hacer click
      if (categoryElement.onclick) {
        categoryElement.click()
      } else {
        // Si es un div dentro de un link o no tiene onclick, simular el click del padre
        categoryElement.parentElement?.click()
      }
      
      // Esperar a que se actualice la categoría y hacer scroll
      setTimeout(() => {
        scrollToProduct(productId)
      }, 300)
    } else {
      // Si no encuentra la categoría, solo hacer scroll a la sección
      scrollToSection("promo-section")
    }
  }

  // Bloquear scroll del body cuando el modal está abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Cerrar con tecla Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay con blur */}
      <div
        className="fixed inset-0 bg-black/80"
        style={{
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          animation: 'fadeIn 0.2s ease-out',
        }}
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div
        className="fixed bg-white rounded-lg shadow-xl"
        style={{
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          maxWidth: '56rem',
          width: '90%',
          maxHeight: '80vh',
          animation: 'zoomFadeIn 0.2s ease-out',
          zIndex: 51,
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-bold text-gray-800">
              <Search className="w-5 h-5 text-pink-600" />
              Buscar productos
            </h2>
            <button
              onClick={onClose}
              className="rounded-sm opacity-70 hover:opacity-100 transition-opacity"
            >
              <X className="h-5 w-5 text-gray-500 hover:text-gray-700" />
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-hidden flex flex-col px-6 py-4">
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
            {loading ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg">Cargando productos...</p>
              </div>
            ) : !searchTerm.trim() ? (
              <div className="text-center py-12 text-gray-500">
                <Search className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg">Escribe para buscar productos</p>
                <p className="text-sm">Pizzas, promos, combos, acompañamientos, bebidas...</p>
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
                  <button
                    key={product.id}
                    onClick={() => handleProductClick(product)}
                    className="w-full bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md hover:border-pink-400 hover:bg-pink-50 transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <Image
                        src={product.image || "/placeholder.svg"}
                        alt={product.name}
                        width={56}
                        height={56}
                        onError={(e: any) => {
                          if (!e.currentTarget.src.includes("placeholder.svg")) {
                            e.currentTarget.src = "/placeholder.svg"
                          }
                        }}
                        className="w-14 h-14 object-cover rounded-lg flex-shrink-0"
                      />
                      <p className="font-medium text-gray-800 text-base">{product.name}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
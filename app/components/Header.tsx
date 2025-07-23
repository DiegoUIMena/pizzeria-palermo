"use client"
import Link from "next/link"
import { Search, User, ShoppingCart, ChevronDown, LogOut, ShoppingBag, UserCircle, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { useCart } from "../context/CartContext"
import { useAuth } from "../context/AuthContext"
import { useState } from "react"
import Cart from "./Cart"
import SearchModal from "./SearchModal"

export default function Header() {
  const { items } = useCart()
  const { isAuthenticated, user, logout } = useAuth()
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)

  const categories = [
    { name: "Pizzas Palermo", href: "/menu?category=especiales" },
    { name: "Pizzas Tradicionales", href: "/menu?category=clasicas" },
    { name: "🍕 Quiero armar mi pizza", href: "/armar-pizza" },
    { name: "Promociones", href: "/#promos" },
    { name: "Acompañamientos", href: "/menu?category=acompañamientos" },
    { name: "Bebidas", href: "/menu?category=bebidas" },
  ]

  return (
    <>
      {/* Promotional Banner */}
      <div className="bg-gradient-to-r from-pink-500 to-pink-600 text-white text-center py-2 px-4 text-xs sm:text-sm font-medium shadow-sm">
        <span className="text-shadow-sm">
          ¿Primera compra? Empanaditas Familiares GRATIS usando el código VECINOJUNIO. Compra mínima de $6.990
        </span>
      </div>

      <header className="bg-white shadow-lg sticky top-0 z-40 border-b border-gray-200">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center">
              <div className="bg-gray-900 text-pink-500 px-2 py-1 sm:px-4 sm:py-2 rounded-lg font-bold text-sm sm:text-xl shadow-md hover:bg-black transition-colors">
                <span className="hidden sm:inline">PIZZERÍA PALERMO</span>
                <span className="sm:hidden">PALERMO</span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:block">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="bg-gray-50 text-gray-700 border-gray-300 hover:bg-pink-50 hover:text-pink-600 hover:border-pink-300 font-medium transition-all"
                  >
                    Categorías
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-white border-gray-200 shadow-lg">
                  {categories.map((category) => (
                    <DropdownMenuItem key={category.name} asChild>
                      <Link
                        href={category.href}
                        className="w-full cursor-pointer text-gray-700 hover:text-pink-600 hover:bg-pink-50"
                      >
                        {category.name}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Mobile Menu Button */}
            <div className="lg:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-gray-50 text-gray-600 border-gray-300 hover:bg-pink-50 hover:text-pink-600 hover:border-pink-300 transition-all"
                  >
                    <Menu className="w-4 h-4" />
                    <span className="ml-1 text-xs">Menú</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72">
                  <div className="py-4">
                    <h3 className="font-bold text-lg mb-4 text-gray-800">Categorías</h3>
                    <div className="space-y-2">
                      {categories.map((category) => (
                        <Link
                          key={category.name}
                          href={category.href}
                          className="block px-4 py-3 text-gray-700 hover:text-pink-600 hover:bg-pink-50 rounded-lg transition-colors"
                        >
                          {category.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              {/* Search Button */}
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsSearchOpen(true)}
                className="bg-gray-50 text-gray-600 border-gray-300 hover:bg-pink-50 hover:text-pink-600 hover:border-pink-300 transition-all w-8 h-8 sm:w-10 sm:h-10"
              >
                <Search className="w-3 h-3 sm:w-4 sm:h-4" />
              </Button>

              {/* User Account */}
              {isAuthenticated ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="bg-pink-50 text-pink-600 border-pink-300 hover:bg-pink-100 hover:text-pink-700 hover:border-pink-400 transition-all w-8 h-8 sm:w-10 sm:h-10"
                    >
                      <UserCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64 p-2">
                    <div className="px-2 py-1.5">
                      <p className="font-medium text-gray-900 text-sm">{user?.name}</p>
                      <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/pedidos" className="cursor-pointer flex items-center text-sm">
                        <ShoppingBag className="mr-2 h-4 w-4" />
                        <span>Mis compras</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/perfil" className="cursor-pointer flex items-center text-sm">
                        <User className="mr-2 h-4 w-4" />
                        <span>Mi cuenta</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={logout}
                      className="cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50 text-sm"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Cerrar sesión</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Link href="/auth">
                  <Button
                    variant="outline"
                    size="icon"
                    className="bg-gray-50 text-gray-600 border-gray-300 hover:bg-pink-50 hover:text-pink-600 hover:border-pink-300 transition-all w-8 h-8 sm:w-10 sm:h-10"
                  >
                    <User className="w-3 h-3 sm:w-4 sm:h-4" />
                  </Button>
                </Link>
              )}

              {/* Shopping Cart */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="bg-gray-50 text-gray-600 border-gray-300 hover:bg-pink-50 hover:text-pink-600 hover:border-pink-300 transition-all relative w-8 h-8 sm:w-10 sm:h-10"
                  >
                    <ShoppingCart className="w-3 h-3 sm:w-4 sm:h-4" />
                    {itemCount > 0 && (
                      <span className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 bg-pink-500 text-white rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center text-xs font-bold shadow-md">
                        {itemCount}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full sm:w-96">
                  <Cart />
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      {/* Search Modal */}
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  )
}

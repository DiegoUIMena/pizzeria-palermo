"use client"
import Link from "next/link"
import Image from "next/image"
import { Search, User, ShoppingCart, LogOut, ShoppingBag, UserCircle, Ticket } from "lucide-react"
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
import { useEffect, useRef, useState } from "react"
import Cart from "./Cart"
import SearchModal from "./SearchModal"
import SleepingCat from "./SleepingCat"
import { useBusinessHours } from "@/hooks/useBusinessHours"

export default function Header() {
  const { items } = useCart()
  const { isAuthenticated, user, logout } = useAuth()
  const { isOpen } = useBusinessHours()
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [showCartHint, setShowCartHint] = useState(false)
  const previousItemCount = useRef(0)
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)

  useEffect(() => {
    const hadNoItemsBefore = previousItemCount.current === 0
    const nowHasItems = itemCount > 0

    if (hadNoItemsBefore && nowHasItems) {
      setShowCartHint(true)
    }

    if (!nowHasItems) {
      setShowCartHint(false)
    }

    previousItemCount.current = itemCount
  }, [itemCount])

  useEffect(() => {
    if (isCartOpen) {
      setShowCartHint(false)
    }
  }, [isCartOpen])

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
          <div className="flex items-center justify-between h-[70px] sm:h-[80px]">
            {/* Logo con Gatita */}
            <div className="flex items-center gap-3 relative -ml-5 sm:ml-0">
              <Link href="/" className="flex items-center">
                <Image
                  src="/iconos/logo.png"
                  alt="Pizzería Palermo"
                  width={540}
                  height={180}
                  className="w-auto h-[85px] sm:h-[100px]"
                  priority
                />
              </Link>
              
              {/* Gatita durmiendo - solo cuando está cerrado */}
              {!isOpen && (
                <div className="absolute -right-3 top-full -mt-14 sm:relative sm:top-11 sm:-ml-4 sm:left-auto sm:right-auto">
                  <SleepingCat />
                </div>
              )}
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
                        <span>Mi perfil</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/perfil/puntos" className="cursor-pointer flex items-center text-sm">
                        <Ticket className="mr-2 h-4 w-4" />
                        <span>Puntos Palermo</span>
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
              <div className="relative">
                {showCartHint && itemCount > 0 && (
                  <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 z-50">
                    <div className="relative rounded-lg bg-pink-600 px-3 py-2 text-xs sm:text-sm font-semibold text-white shadow-lg whitespace-nowrap animate-cart-hint-horizontal">
                      Continua tu compra aqui
                      <span className="absolute left-full top-1/2 -translate-y-1/2 h-0 w-0 border-t-[7px] border-b-[7px] border-l-[8px] border-t-transparent border-b-transparent border-l-pink-600" />
                    </div>
                  </div>
                )}

                <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className={`bg-gray-50 text-gray-600 border-gray-300 hover:bg-pink-50 hover:text-pink-600 hover:border-pink-300 transition-all relative w-8 h-8 sm:w-10 sm:h-10 ${
                        itemCount > 0 ? 'animate-pulse-glow' : ''
                      }`}
                    >
                      <ShoppingCart className="w-3 h-3 sm:w-4 sm:h-4" />
                      {itemCount > 0 && (
                        <span className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 bg-pink-500 text-white rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center text-xs font-bold shadow-md">
                          {itemCount}
                        </span>
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent
                    side="right"
                    className="w-full sm:w-96 p-0"
                    onInteractOutside={(event) => event.preventDefault()}
                  >
                    <Cart onClose={() => setIsCartOpen(false)} />
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Search Modal */}
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  )
}

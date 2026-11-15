"use client"
import Link from "next/link"
import Image from "next/image"
import { Search, User, ShoppingCart, LogOut, ShoppingBag, UserCircle, Ticket } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { useCart } from "../context/CartContext"
import { useAuth } from "../context/AuthContext"
import { useEffect, useRef, useState } from "react"
import Cart from "./Cart"
import SearchModal from "./SearchModal"
import SleepingCat from "./SleepingCat"
import { useBusinessHours } from "@/hooks/useBusinessHours"
import { doc, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"

export default function Header() {
  const { items } = useCart()
  const { isAuthenticated, user, logout } = useAuth()
  const { isOpen } = useBusinessHours()
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [showCartHint, setShowCartHint] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const [mainNotice, setMainNotice] = useState<{ text: string; enabled: boolean }>({
    text: "",
    enabled: false,
  })
  const previousItemCount = useRef(0)
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)

  useEffect(() => {
    if (!db) return

    const docRef = doc(db, "settings", "main_notice")
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data()
          setMainNotice({
            text: typeof data.text === "string" ? data.text.trim() : "",
            enabled: Boolean(data.enabled),
          })
        } else {
          setMainNotice({ text: "", enabled: false })
        }
      },
      (error) => {
        console.error("Error al escuchar main_notice en Header:", error)
      }
    )

    return () => unsubscribe()
  }, [])

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

  useEffect(() => {
    const handleOpenCart = () => setIsCartOpen(true)
    window.addEventListener('openCart', handleOpenCart)
    return () => window.removeEventListener('openCart', handleOpenCart)
  }, [])

  useEffect(() => {
    if (!isUserMenuOpen) return

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsUserMenuOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("touchstart", handleClickOutside)
    document.addEventListener("keydown", handleEscape)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("touchstart", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [isUserMenuOpen])

  return (
    <>
      {/* Promotional Banner */}
      {mainNotice.enabled && mainNotice.text && (
        <div className="bg-gradient-to-r from-pink-500 to-pink-600 text-white text-center py-2 px-4 text-xs sm:text-sm font-medium shadow-sm">
          <span className="text-shadow-sm">
            {mainNotice.text}
          </span>
        </div>
      )}

      <header className="bg-white shadow-lg sticky top-0 z-40 border-b border-gray-200">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-[70px] sm:h-[80px]">
            {/* Logo con Gatita */}
            <div className="flex items-center gap-3 relative -ml-2 sm:ml-0">
              <Link href="/" className="flex items-center">
                <Image
                  src="/iconos/logo.png"
                  alt="Pizzería Palermo"
                  width={540}
                  height={180}
                  className="w-auto h-[50px] sm:h-[75px] md:h-[90px] lg:h-[100px]"
                  priority
                />
              </Link>
              
              {/* Gatita durmiendo - solo cuando está cerrado */}
              {!isOpen && (
                <div className="relative top-3 -ml-2 sm:top-3 sm:-ml-3">
                  <SleepingCat />
                </div>
              )}
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center space-x-1.5 xs:space-x-2 sm:space-x-3">
              {/* Search Button */}
              <button
                onClick={() => setIsSearchOpen(true)}
                className={`user-icon-trigger relative flex items-center justify-center rounded-full focus:outline-none w-[36px] h-[36px] xs:w-[44px] xs:h-[44px] sm:w-[52px] sm:h-[52px] md:w-[57px] md:h-[57px] ${
                  isSearchOpen ? "is-active" : ""
                }`}
                title="Buscar"
              >
                <Image
                  src="/iconos/header/buscar.svg"
                  alt="Buscar"
                  width={58}
                  height={58}
                  className="w-[36px] h-[36px] xs:w-[44px] xs:h-[44px] sm:w-[52px] sm:h-[52px] md:w-[57px] md:h-[57px] object-contain"
                />
              </button>

              {/* Puntos Palermo Icon (Solo registrados) */}
              {isAuthenticated && (
                <Link
                  href="/perfil/puntos"
                  className="user-icon-trigger relative flex items-center justify-center rounded-full focus:outline-none w-[36px] h-[36px] xs:w-[44px] xs:h-[44px] sm:w-[52px] sm:h-[52px] md:w-[57px] md:h-[57px]"
                  title="Puntos Palermo"
                >
                  <Image
                    src="/iconos/header/puntos.svg"
                    alt="Puntos Palermo"
                    width={58}
                    height={58}
                    className="w-[36px] h-[36px] xs:w-[44px] xs:h-[44px] sm:w-[52px] sm:h-[52px] md:w-[57px] md:h-[57px] object-contain"
                  />
                </Link>
              )}

              {/* User Account */}
              {isAuthenticated ? (
                <div className="relative" ref={userMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsUserMenuOpen((prev) => !prev)}
                    aria-expanded={isUserMenuOpen}
                    aria-haspopup="menu"
                    className={`user-icon-trigger relative flex items-center justify-center rounded-full focus:outline-none w-[36px] h-[36px] xs:w-[44px] xs:h-[44px] sm:w-[52px] sm:h-[52px] md:w-[57px] md:h-[57px] ${
                      isUserMenuOpen ? "is-active" : ""
                    }`}
                    title="Mi Cuenta"
                  >
                    <Image
                      src="/iconos/header/usuario.svg"
                      alt="Usuario"
                      width={58}
                      height={58}
                      className="w-[36px] h-[36px] xs:w-[44px] xs:h-[44px] sm:w-[52px] sm:h-[52px] md:w-[57px] md:h-[57px] object-contain"
                    />
                  </button>

                  {/* Menú desplegable anclado directamente al botón de usuario */}
                  <div
                    role="menu"
                    aria-hidden={!isUserMenuOpen}
                    className={`user-dropdown-panel absolute right-0 top-full mt-2.5 w-64 rounded-xl bg-white border border-gray-200/90 shadow-xl p-2 z-50 origin-top-right ${
                      isUserMenuOpen
                        ? "is-open pointer-events-auto"
                        : "is-closed pointer-events-none"
                    }`}
                  >
                    <div className="px-3 py-2.5 bg-gradient-to-r from-pink-50/80 to-white rounded-lg mb-1 border border-pink-100/60">
                      <p className="font-bold text-gray-900 text-sm truncate">{user?.name}</p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{user?.email}</p>
                    </div>

                    <div className="my-1 h-px bg-gray-100" />

                    <Link
                      href="/pedidos"
                      onClick={() => setIsUserMenuOpen(false)}
                      role="menuitem"
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:text-pink-600 hover:bg-pink-50/70 transition-colors cursor-pointer"
                    >
                      <ShoppingBag className="h-4 w-4 text-pink-500 shrink-0" />
                      <span>Mis compras</span>
                    </Link>

                    <Link
                      href="/perfil"
                      onClick={() => setIsUserMenuOpen(false)}
                      role="menuitem"
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:text-pink-600 hover:bg-pink-50/70 transition-colors cursor-pointer"
                    >
                      <User className="h-4 w-4 text-pink-500 shrink-0" />
                      <span>Mi perfil</span>
                    </Link>

                    <div className="my-1 h-px bg-gray-100" />

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsUserMenuOpen(false)
                        logout()
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer text-left"
                    >
                      <LogOut className="h-4 w-4 shrink-0" />
                      <span>Cerrar sesión</span>
                    </button>
                  </div>
                </div>
              ) : (
                <Link
                  href="/auth"
                  className="user-icon-trigger relative flex items-center justify-center rounded-full focus:outline-none w-[36px] h-[36px] xs:w-[44px] xs:h-[44px] sm:w-[52px] sm:h-[52px] md:w-[57px] md:h-[57px]"
                  title="Iniciar sesión"
                >
                  <Image
                    src="/iconos/header/usuario.svg"
                    alt="Acceder"
                    width={58}
                    height={58}
                    className="w-[36px] h-[36px] xs:w-[44px] xs:h-[44px] sm:w-[52px] sm:h-[52px] md:w-[57px] md:h-[57px] object-contain"
                  />
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
                  <SheetTrigger
                    className={`user-icon-trigger relative flex items-center justify-center rounded-full focus:outline-none w-[36px] h-[36px] xs:w-[44px] xs:h-[44px] sm:w-[52px] sm:h-[52px] md:w-[57px] md:h-[57px] ${
                      itemCount > 0 ? "animate-pulse-glow" : ""
                    } ${isCartOpen ? "is-active" : ""}`}
                    title="Carrito de compras"
                  >
                    <Image
                      src="/iconos/header/carro.svg"
                      alt="Carrito"
                      width={58}
                      height={58}
                      className="w-[36px] h-[36px] xs:w-[44px] xs:h-[44px] sm:w-[52px] sm:h-[52px] md:w-[57px] md:h-[57px] object-contain"
                    />
                    {itemCount > 0 && (
                      <span className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 bg-pink-500 text-white rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center text-xs font-bold shadow-md">
                        {itemCount}
                      </span>
                    )}
                  </SheetTrigger>
                  <SheetContent
                    side="right"
                    className="cart-sheet w-full sm:w-[480px] md:w-[520px] max-w-full p-0 flex flex-col h-full"
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

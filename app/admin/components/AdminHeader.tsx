"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Home, ShoppingCart, Package, BarChart3, Settings, LogOut, User, MapPin, Bug, Moon, Sun, MessageCircle, Sliders, Sparkles, Mail, Store, ChevronDown, UserPlus } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState, useRef } from 'react'
import { httpsCallable } from "firebase/functions"
import { functions } from "@/lib/firebase"
import { useAuth } from "@/app/context/AuthContext"
import AdminUsersModal from "./AdminUsersModal"

export default function AdminHeader() {
  const pathname = usePathname()
  const { logout, user } = useAuth()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  const cycleTheme = () => setTheme((theme === 'dark') ? 'light' : 'dark')
  const themeIcon = () => {
    if (!mounted) return (
      <span className="relative w-4 h-4 inline-flex items-center justify-center">
        <Sun className="w-4 h-4" />
      </span>
    )
    return theme === 'dark' ? (
      <span className="relative w-4 h-4 inline-flex items-center justify-center">
        <Moon className="w-4 h-4" />
      </span>
    ) : (
      <span className="relative w-4 h-4 inline-flex items-center justify-center">
        <Sun className="w-4 h-4" />
      </span>
    )
  }

  const [pendingContactsCount, setPendingContactsCount] = useState<number>(0)
  const [openInventario, setOpenInventario] = useState(false)
  const inventarioRef = useRef<HTMLDivElement>(null)

  const [openUserMenu, setOpenUserMenu] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const [isUsersModalOpen, setIsUsersModalOpen] = useState(false)

  // Cierre automático al hacer clic fuera de los menús desplegables
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (inventarioRef.current && !inventarioRef.current.contains(target)) {
        setOpenInventario(false)
      }
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setOpenUserMenu(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Cierre automático al cambiar de ruta
  useEffect(() => {
    setOpenInventario(false)
    setOpenUserMenu(false)
  }, [pathname])

  // Consulta económica de contactos pendientes (sin listener permanente)
  useEffect(() => {
    const fetchPendingContactsCount = async () => {
      try {
        const obtenerConteoFn = httpsCallable(functions, "obtenerConteoPendientes")
        const res = await obtenerConteoFn()
        setPendingContactsCount((res.data as { count: number }).count)
      } catch (error) {
        console.error("Error al obtener conteo de contactos pendientes:", error)
      }
    }

    fetchPendingContactsCount()
    
    // Consultar cada 2 minutos
    const interval = setInterval(fetchPendingContactsCount, 120000)
    return () => clearInterval(interval)
  }, [pathname])

  const navigation = [
    { name: "Dashboard", href: "/admin", icon: Home },
    { name: "Pedidos", href: "/admin/pedidos", icon: ShoppingCart },
    { name: "Ventas Presencial", href: "/admin/ventas-presencial", icon: Store },
    { 
      name: "Inventario", 
      icon: Package,
      submenu: [
        { name: "Gestión", href: "/admin/inventario" },
        { name: "Config. Cantidades", href: "/admin/configurar-cantidades" },
        { name: "Depurador", href: "/admin/depurador-inventario" },
      ]
    },
    { name: "Zonas Delivery", href: "/admin/zonas-delivery", icon: MapPin },
    { name: "Puntos Palermo", href: "/admin/puntos-palermo", icon: Sparkles },
    { name: "Chatbot", href: "/admin/chatbot", icon: MessageCircle },
    { name: "Contacto", href: "/admin/contacto", icon: Mail },
    { name: "Reportes", href: "/admin/reportes", icon: BarChart3 },
  ]

  return (
    <header className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-800">
      {/* Estilos dedicados con !important para forzar posición y animación perfecta sin desfasaje por zoom */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes adminInventoryDropdownIn {
          0% {
            opacity: 0 !important;
            transform: translateY(-8px) scale(0.97) !important;
          }
          100% {
            opacity: 1 !important;
            transform: translateY(0) scale(1) !important;
          }
        }
        .admin-inventory-dropdown {
          position: absolute !important;
          top: calc(100% + 6px) !important;
          left: 0 !important;
          z-index: 99999 !important;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;
          animation: adminInventoryDropdownIn 180ms cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
          transform-origin: top left !important;
        }

        @keyframes adminUserDropdownIn {
          0% {
            opacity: 0 !important;
            transform: translateY(-8px) scale(0.96) !important;
          }
          100% {
            opacity: 1 !important;
            transform: translateY(0) scale(1) !important;
          }
        }
        .admin-user-dropdown {
          position: absolute !important;
          top: calc(100% + 8px) !important;
          right: 0 !important;
          left: auto !important;
          z-index: 99999 !important;
          box-shadow: 0 12px 28px -4px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;
          animation: adminUserDropdownIn 200ms cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
          transform-origin: top right !important;
        }
      `}} />

      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/admin" className="flex items-center space-x-2 shrink-0 mr-2 lg:mr-4">
            <div className="bg-pink-600 text-white px-3 py-1 rounded font-bold text-lg">ADMIN PALERMO</div>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {navigation.map((item) => {
              const Icon = item.icon
              
              // Si tiene submenú (Inventario), renderizar menú relativo sin portal descalibrado
              if (item.submenu) {
                const isActive = item.submenu.some(sub => pathname === sub.href)
                
                return (
                  <div key={item.name} ref={inventarioRef} className="relative inline-block text-left">
                    <Button
                      type="button"
                      variant={isActive ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setOpenInventario(prev => !prev)}
                      className={`flex items-center space-x-1.5 px-2.5 xl:px-3 h-9 text-xs xl:text-sm font-medium ${
                        isActive
                          ? "bg-pink-600 text-white hover:bg-pink-700"
                          : "text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.name}</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
                          openInventario ? "rotate-180 text-pink-500 dark:text-pink-400" : "opacity-60"
                        }`}
                      />
                    </Button>

                    {/* Menú Desplegable con posición relativa directa y animación fluida */}
                    {openInventario && (
                      <div className="admin-inventory-dropdown bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md py-1 shadow-xl min-w-[170px] overflow-hidden">
                        {item.submenu.map((subItem) => {
                          const isSubActive = pathname === subItem.href
                          return (
                            <Link
                              key={subItem.name}
                              href={subItem.href}
                              onClick={() => setOpenInventario(false)}
                              className={`block px-3.5 py-2 text-xs xl:text-sm font-medium transition-colors ${
                                isSubActive
                                  ? "bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 font-semibold"
                                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/60 hover:text-gray-900 dark:hover:text-white"
                              }`}
                            >
                              {subItem.name}
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              }
              
              // Si no tiene submenú, renderizar link normal
              const isActive = pathname === item.href
              
              return (
                <Link key={item.name} href={item.href!}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    className={`flex items-center space-x-1.5 px-2.5 xl:px-3 h-9 text-xs xl:text-sm font-medium relative ${
                      isActive
                        ? "bg-pink-600 text-white hover:bg-pink-700"
                        : "text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.name}</span>
                    {item.name === "Contacto" && pendingContactsCount > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold text-white bg-red-500 rounded-full animate-pulse">
                        {pendingContactsCount}
                      </span>
                    )}
                  </Button>
                </Link>
              )
            })}
          </nav>

          {/* Mobile Navigation */}
          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {navigation.map((item) => {
                  const Icon = item.icon
                  
                  // Si tiene submenú, renderizar items del submenú
                  if (item.submenu) {
                    return (
                      <React.Fragment key={item.name}>
                        <div className="px-2 py-1.5 text-sm font-semibold text-gray-500 dark:text-gray-400">
                          <Icon className="inline mr-2 h-4 w-4" />
                          {item.name}
                        </div>
                        {item.submenu.map((subItem) => (
                          <DropdownMenuItem key={subItem.name} asChild>
                            <Link href={subItem.href} className="flex items-center pl-8">
                              <span>{subItem.name}</span>
                            </Link>
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                      </React.Fragment>
                    )
                  }
                  
                  return (
                    <DropdownMenuItem key={item.name} asChild>
                      <Link href={item.href!} className="flex items-center justify-between">
                        <span className="flex items-center">
                          <Icon className="mr-2 h-4 w-4" />
                          <span>{item.name}</span>
                        </span>
                        {item.name === "Contacto" && pendingContactsCount > 0 && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold text-white bg-red-500 rounded-full">
                            {pendingContactsCount}
                          </span>
                        )}
                      </Link>
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Theme Button + User Menu (con adecuada separación y divisor vertical respecto a navegación) */}
          <div className="flex items-center gap-2.5 ml-3 lg:ml-6 pl-3 lg:pl-6 border-l border-gray-200 dark:border-gray-800 shrink-0">
            <Button
              variant="outline"
              size="icon"
              onClick={cycleTheme}
              className="rounded-full relative group"
              title={mounted ? `Tema actual: ${theme || 'light'} (clic para cambiar)` : 'Cambiar tema'}
              suppressHydrationWarning
            >
              {themeIcon()}
              <span className="sr-only">Cambiar tema</span>
              <span className="pointer-events-none select-none absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-medium text-gray-500 dark:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                {mounted ? (theme || 'light') : 'light'}
              </span>
            </Button>
            {/* Menú de Usuario relativo sin Portal descalibrado por zoom */}
            <div ref={userMenuRef} className="relative inline-block text-left">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setOpenUserMenu((prev) => !prev)}
                className="rounded-full relative"
                aria-label="Menú de usuario"
              >
                <User className="w-4 h-4" />
              </Button>

              {openUserMenu && (
                <div className="admin-user-dropdown bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl w-60 py-1.5 overflow-hidden">
                  <div className="px-3.5 py-2 border-b border-gray-100 dark:border-gray-800">
                    <p className="font-semibold text-xs text-gray-900 dark:text-gray-100">
                      {user?.role === 'admin' ? 'Administrador' : user?.role === 'staff' ? 'Staff' : 'Usuario'}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate font-mono" title={user?.email || ''}>
                      {user?.email || 'admin@pizzeriapalermo.cl'}
                    </p>
                  </div>

                  <div className="py-1">
                    {/* Crear usuario administrador */}
                    <button
                      type="button"
                      onClick={() => {
                        setOpenUserMenu(false)
                        setIsUsersModalOpen(true)
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-pink-50 dark:hover:bg-pink-950/30 hover:text-pink-600 dark:hover:text-pink-400 transition-colors text-left"
                    >
                      <UserPlus className="w-4 h-4 text-pink-500 shrink-0" />
                      <span>Crear usuario</span>
                    </button>

                    <Link
                      href="/admin/debug-clientes"
                      onClick={() => setOpenUserMenu(false)}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
                    >
                      <Bug className="w-4 h-4 text-gray-500 shrink-0" />
                      <span>Debug Clientes</span>
                    </Link>
                  </div>

                  <div className="border-t border-gray-100 dark:border-gray-800 pt-1">
                    <button
                      type="button"
                      onClick={async () => {
                        setOpenUserMenu(false)
                        try {
                          await logout()
                        } catch (err) {
                          console.error('Error al cerrar sesión:', err)
                        }
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-left"
                    >
                      <LogOut className="w-4 h-4 shrink-0" />
                      <span>Cerrar Sesión</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Administración de Usuarios Administradores */}
      <AdminUsersModal
        isOpen={isUsersModalOpen}
        onClose={() => setIsUsersModalOpen(false)}
      />
    </header>
  )
}

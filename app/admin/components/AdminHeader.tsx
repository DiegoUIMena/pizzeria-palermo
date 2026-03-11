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
import { Home, ShoppingCart, Package, BarChart3, Settings, LogOut, User, MapPin, Bug, Moon, Sun, MessageCircle, Sliders } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from 'react'

export default function AdminHeader() {
  const pathname = usePathname()
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

  const navigation = [
    { name: "Dashboard", href: "/admin", icon: Home },
    { name: "Pedidos", href: "/admin/pedidos", icon: ShoppingCart },
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
    { name: "Chatbot", href: "/admin/chatbot", icon: MessageCircle },
    { name: "Reportes", href: "/admin/reportes", icon: BarChart3 },
  ]

  return (
    <header className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-800">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/admin" className="flex items-center space-x-2">
            <div className="bg-pink-600 text-white px-3 py-1 rounded font-bold text-lg">ADMIN PALERMO</div>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex space-x-1">
            {navigation.map((item) => {
              const Icon = item.icon
              
              // Si tiene submenú, renderizar dropdown
              if (item.submenu) {
                const isActive = item.submenu.some(sub => pathname === sub.href)
                
                return (
                  <DropdownMenu key={item.name}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant={isActive ? "default" : "ghost"}
                        className={`flex items-center space-x-2 ${
                          isActive
                            ? "bg-pink-600 text-white hover:bg-pink-700"
                            : "text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.name}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {item.submenu.map((subItem) => (
                        <DropdownMenuItem key={subItem.name} asChild>
                          <Link href={subItem.href} className="cursor-pointer">
                            {subItem.name}
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )
              }
              
              // Si no tiene submenú, renderizar link normal
              const isActive = pathname === item.href
              
              return (
                <Link key={item.name} href={item.href!}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    className={`flex items-center space-x-2 ${
                      isActive
                        ? "bg-pink-600 text-white hover:bg-pink-700"
                        : "text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.name}</span>
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
                      <Link href={item.href!} className="flex items-center">
                        <Icon className="mr-2 h-4 w-4" />
                        <span>{item.name}</span>
                      </Link>
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Theme Button + User Menu (sin opciones de tema duplicadas) */}
          <div className="flex items-center gap-2">
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-full">
                  <User className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="font-medium text-gray-900 dark:text-gray-100">Administrador</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">admin@pizzeriapalermo.cl</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Configuración</span>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/admin/debug-clientes" className="flex items-center">
                    <Bug className="mr-2 h-4 w-4" />
                    <span>Debug Clientes</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Cerrar Sesión</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  )
}

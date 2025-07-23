"use client"

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
import { Home, ShoppingCart, Package, BarChart3, Settings, LogOut, User, MapPin, Bug, Moon, Sun } from "lucide-react"
import { ThemeToggleSwitch } from "@/components/theme-toggle"
import { useTheme } from "next-themes"

export default function AdminHeader() {
  const pathname = usePathname()
  const { theme } = useTheme()

  const navigation = [
    { name: "Dashboard", href: "/admin", icon: Home },
    { name: "Pedidos", href: "/admin/pedidos", icon: ShoppingCart },
    { name: "Inventario", href: "/admin/inventario", icon: Package },
    { name: "Zonas Delivery", href: "/admin/zonas-delivery", icon: MapPin },
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
              const isActive = pathname === item.href
              return (
                <Link key={item.name} href={item.href}>
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
                  return (
                    <DropdownMenuItem key={item.name} asChild>
                      <Link href={item.href} className="flex items-center">
                        <Icon className="mr-2 h-4 w-4" />
                        <span>{item.name}</span>
                      </Link>
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* User Menu */}
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
                <div className="flex items-center w-full justify-between">
                  <div className="flex items-center">
                    <Moon className="mr-2 h-4 w-4" />
                    <span>Modo Oscuro</span>
                  </div>
                  <ThemeToggleSwitch />
                </div>
              </DropdownMenuItem>
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
    </header>
  )
}

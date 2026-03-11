'use client'

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ThemeProvider } from "@/components/theme-provider"
import AdminHeader from "./components/AdminHeader"
import { AlarmsProvider } from "./context/AlarmsContext"
import GlobalOrderMonitor from "./components/GlobalOrderMonitor"
import { useAuth } from "../context/AuthContext"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    // Verificar autorización cuando el usuario esté cargado
    if (!isLoading) {
      // Si no está autenticado, redirigir a login
      if (!isAuthenticated) {
        console.log('[AdminLayout] Usuario no autenticado, redirigiendo a /auth')
        setIsChecking(false) // ✅ Detener loading antes del redirect
        router.push('/auth?redirect=/admin')
        return
      }

      // Si está autenticado pero no es admin, redirigir a inicio
      if (user?.role !== 'admin') {
        console.log('[AdminLayout] Usuario no es admin (rol:', user?.role, '), redirigiendo a inicio')
        setIsChecking(false) // ✅ Detener loading antes del redirect
        router.push('/')
        return
      }

      // Usuario es admin, permitir acceso
      setIsAuthorized(true)
      setIsChecking(false)
    }
  }, [user, isAuthenticated, isLoading, router])

  // Mostrar pantalla de carga mientras verifica
  if (isLoading || isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando permisos de administrador...</p>
        </div>
      </div>
    )
  }

  // Si no está autorizado, no renderizar nada (ya se redirigió)
  if (!isAuthorized) {
    return null
  }

  // Usuario autorizado, renderizar panel admin
  return (
    <div className="min-h-screen flex flex-col">
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <AlarmsProvider>
          <AdminHeader />
          {/* Componente invisible que monitorea pedidos nuevos globalmente */}
          <GlobalOrderMonitor />
          <main className="flex-1 p-4">{children}</main>
        </AlarmsProvider>
      </ThemeProvider>
    </div>
  )
}

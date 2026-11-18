'use client'

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ThemeProvider } from "@/components/theme-provider"
import AdminHeader from "./components/AdminHeader"
import { AlarmsProvider } from "./context/AlarmsContext"
import GlobalOrderMonitor from "./components/GlobalOrderMonitor"
import { useAuth } from "../context/AuthContext"
import AdminLogin from "./components/AdminLogin"
import { ShieldCheck, Loader2 } from "lucide-react"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  const isTestHost =
    typeof window !== 'undefined' &&
    (
      window.location.hostname === 'pizzeria-palermo-test-20260401.web.app' ||
      window.location.hostname === 'pizzeria-palermo-test-20260401.firebaseapp.com'
    )
  const isTestProject =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === 'pizzeria-palermo-test-20260401' ||
    isTestHost

  useEffect(() => {
    document.body.classList.add('admin-body')
    return () => {
      document.body.classList.remove('admin-body')
    }
  }, [])

  useEffect(() => {
    if (isLoading || isChecking) {
      document.documentElement.classList.add('admin-login-active')
      document.body.classList.add('admin-login-active')
      return () => {
        document.documentElement.classList.remove('admin-login-active')
        document.body.classList.remove('admin-login-active')
      }
    }
  }, [isLoading, isChecking])

  useEffect(() => {
    if (isTestProject) {
      // Entorno de pruebas aislado: permitir acceso admin para QA sin bloquear por Auth.
      setIsAuthorized(true)
      setIsChecking(false)
      return
    }

    // Verificar autorización cuando la sesión inicial haya cargado
    if (!isLoading) {
      if (isAuthenticated && (user?.role === 'admin' || user?.role === 'staff')) {
        setIsAuthorized(true)
      } else {
        setIsAuthorized(false)
      }
      setIsChecking(false)
    }
  }, [user, isAuthenticated, isLoading, isTestProject])

  // Mostrar pantalla de carga minimalista y fluida mientras verifica
  if (isLoading || isChecking) {
    return (
      <div
        className="admin-login-active"
        style={{
          position: 'fixed',
          inset: 0,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
          zIndex: 99999,
          backgroundColor: '#08090d',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {/* Fondo difuminado a pantalla completa sin cortes */}
        <div
          style={{
            position: 'absolute',
            inset: '-50vh -50vw',
            top: '-50vh',
            left: '-50vw',
            width: '200vw',
            height: '200vh',
            pointerEvents: 'none',
            background:
              'radial-gradient(circle at 50% 30%, rgba(219, 39, 119, 0.32) 0%, rgba(190, 24, 93, 0.16) 40%, rgba(8, 9, 13, 0) 75%), radial-gradient(circle at 80% 75%, rgba(244, 63, 94, 0.24) 0%, rgba(8, 9, 13, 0) 70%)',
          }}
        />
        <div className="relative z-10 flex flex-col items-center gap-3">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-pink-600/25 via-pink-500/20 to-rose-500/15 border border-pink-500/35 flex items-center justify-center text-pink-500 shadow-lg shadow-pink-600/20">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div className="absolute -bottom-1 -right-1">
              <Loader2 className="w-4 h-4 animate-spin text-pink-500" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-medium">
            <span className="font-semibold text-zinc-200">PALERMO</span>
            <span className="text-zinc-600">•</span>
            <span>Acceso seguro</span>
          </div>
        </div>
      </div>
    )
  }

  // Si no está autorizado (no autenticado o no es admin/staff), mostrar login especial para admin
  if (!isAuthorized) {
    return <AdminLogin onSuccess={() => setIsAuthorized(true)} />
  }

  // Usuario autorizado, renderizar panel admin completo
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

'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ShieldCheck,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  Store,
  Loader2,
  AlertCircle,
  CheckCircle2,
  LogOut,
  ShieldAlert,
} from 'lucide-react'
import { useAuth } from '@/app/context/AuthContext'

interface AdminLoginProps {
  onSuccess?: () => void
}

export default function AdminLogin({ onSuccess }: AdminLoginProps) {
  const router = useRouter()
  const { user, isAuthenticated, loginAdmin, logout } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  // Asegurar fondo consistente mientras se muestra el login
  useEffect(() => {
    document.documentElement.classList.add('admin-login-active')
    document.body.classList.add('admin-login-active')
    return () => {
      document.documentElement.classList.remove('admin-login-active')
      document.body.classList.remove('admin-login-active')
    }
  }, [])

  // Si el usuario ya está autenticado pero no es admin ni staff
  const isUnauthorizedUser = isAuthenticated && user && user.role !== 'admin' && user.role !== 'staff'

  // Sacudida (shake) mediante Web Animations API nativa del navegador:
  // Es 100% inmune a conflictos de CSS, re-renders de React o especificidad de hojas de estilo
  const triggerShake = () => {
    const el = cardRef.current
    if (!el) return

    if (typeof el.animate === 'function') {
      el.animate(
        [
          { transform: 'translate3d(0, 0, 0)', borderColor: 'rgba(244, 63, 94, 0.9)' },
          { transform: 'translate3d(-24px, 0, 0)', borderColor: 'rgba(244, 63, 94, 0.9)' },
          { transform: 'translate3d(24px, 0, 0)', borderColor: 'rgba(244, 63, 94, 0.9)' },
          { transform: 'translate3d(-18px, 0, 0)', borderColor: 'rgba(244, 63, 94, 0.9)' },
          { transform: 'translate3d(18px, 0, 0)', borderColor: 'rgba(244, 63, 94, 0.9)' },
          { transform: 'translate3d(-10px, 0, 0)', borderColor: 'rgba(244, 63, 94, 0.9)' },
          { transform: 'translate3d(10px, 0, 0)', borderColor: 'rgba(244, 63, 94, 0.9)' },
          { transform: 'translate3d(-4px, 0, 0)', borderColor: 'rgba(244, 63, 94, 0.9)' },
          { transform: 'translate3d(4px, 0, 0)', borderColor: 'rgba(244, 63, 94, 0.9)' },
          { transform: 'translate3d(0, 0, 0)', borderColor: 'rgba(39, 39, 42, 0.9)' },
        ],
        {
          duration: 520,
          easing: 'cubic-bezier(0.36, 0.07, 0.19, 0.97)',
        }
      )
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting || isSuccess) return

    setErrorMessage(null)

    const cleanEmail = email.trim()
    if (!cleanEmail || !password) {
      setErrorMessage('Correo o contraseña incorrectos.')
      triggerShake()
      return
    }

    setIsSubmitting(true)

    try {
      await loginAdmin(cleanEmail, password)
      setIsSuccess(true)
      if (onSuccess) {
        onSuccess()
      }
    } catch (err: any) {
      console.error('[AdminLogin] Error de autenticación:', err)
      setErrorMessage('Correo o contraseña incorrectos.')
      triggerShake()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSwitchAccount = async () => {
    try {
      setIsSubmitting(true)
      await logout()
      setEmail('')
      setPassword('')
      setErrorMessage(null)
    } catch (err) {
      console.error('[AdminLogin] Error al cerrar sesión previa:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="admin-login-viewport">
      {/* Estilos dedicados de fondo y animación */}
      <style dangerouslySetInnerHTML={{ __html: `
        .admin-login-viewport {
          position: fixed !important;
          inset: 0 !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 100% !important;
          height: 100% !important;
          min-width: 100vw !important;
          min-height: 100vh !important;
          z-index: 99999 !important;
          background-color: #08090d !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          padding: 1rem !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          user-select: none !important;
          -webkit-user-select: none !important;
        }

        /* Capa de fondo ambiental difuminado a escala 300% para evitar cualquier corte */
        .admin-bg-viewport {
          position: fixed !important;
          top: -100% !important;
          left: -100% !important;
          width: 300% !important;
          height: 300% !important;
          pointer-events: none !important;
          overflow: hidden !important;
          z-index: 1 !important;
        }

        .admin-gradient-layer {
          position: absolute !important;
          inset: 0 !important;
          width: 100% !important;
          height: 100% !important;
          background: 
            radial-gradient(circle at 50% 50%, rgba(219, 39, 119, 0.30) 0%, rgba(190, 24, 93, 0.16) 20%, rgba(8, 9, 13, 0) 45%),
            radial-gradient(circle at 65% 65%, rgba(244, 63, 94, 0.22) 0%, rgba(136, 19, 55, 0.12) 25%, rgba(8, 9, 13, 0) 50%),
            radial-gradient(circle at 35% 65%, rgba(190, 24, 93, 0.22) 0%, rgba(136, 19, 55, 0.10) 25%, rgba(8, 9, 13, 0) 50%) !important;
        }

        .admin-orb-top {
          position: absolute !important;
          top: 30% !important;
          left: 50% !important;
          transform: translateX(-50%) !important;
          width: 80% !important;
          height: 50% !important;
          background: radial-gradient(circle, rgba(236, 72, 153, 0.35) 0%, rgba(219, 39, 119, 0.18) 40%, transparent 65%) !important;
          filter: blur(100px) !important;
          border-radius: 9999px !important;
        }

        /* Animaciones con !important para asegurar visibilidad */
        @keyframes adminEntranceAnim {
          0% {
            opacity: 0 !important;
            transform: translateY(16px) scale(0.97) !important;
          }
          100% {
            opacity: 1 !important;
            transform: translateY(0) scale(1) !important;
          }
        }

        @keyframes adminGlowPulseAnim {
          0%, 100% {
            opacity: 0.5 !important;
            transform: translateX(-50%) scale(1) !important;
          }
          50% {
            opacity: 0.85 !important;
            transform: translateX(-50%) scale(1.08) !important;
          }
        }

        @keyframes adminIconPulseAnim {
          0%, 100% {
            transform: scale(1) !important;
            box-shadow: 0 6px 18px -4px rgba(219, 39, 119, 0.35) !important;
          }
          50% {
            transform: scale(1.05) !important;
            box-shadow: 0 10px 24px -4px rgba(219, 39, 119, 0.6) !important;
          }
        }

        @keyframes adminFadeInDownAnim {
          0% {
            opacity: 0 !important;
            transform: translateY(-6px) !important;
          }
          100% {
            opacity: 1 !important;
            transform: translateY(0) !important;
          }
        }

        .admin-login-card {
          position: relative !important;
          z-index: 10 !important;
          animation: adminEntranceAnim 300ms ease-out forwards;
        }

        .admin-glow-ambient {
          animation: adminGlowPulseAnim 5s ease-in-out infinite !important;
          will-change: transform, opacity !important;
        }

        .admin-icon-container {
          animation: adminIconPulseAnim 3s ease-in-out infinite !important;
          will-change: transform, box-shadow !important;
        }

        .admin-error-badge {
          animation: adminFadeInDownAnim 200ms ease-out forwards !important;
          will-change: transform, opacity !important;
        }
      `}} />

      {/* Halo ambiental multicapa continuo */}
      <div className="admin-bg-viewport">
        <div className="admin-gradient-layer" />
        <div className="admin-orb-top admin-glow-ambient" />
      </div>

      {/* Tarjeta Central Flotante Compacta y Refinada */}
      <div
        ref={cardRef}
        className="admin-login-card w-full max-w-[340px] bg-zinc-900/90 backdrop-blur-2xl border border-zinc-800/90 rounded-2xl p-6 sm:p-7 shadow-2xl shadow-black/90"
      >
        {/* Cabecera / Identidad Visual */}
        <div className="flex flex-col items-center text-center mb-5">
          <div className="relative mb-3">
            {isUnauthorizedUser ? (
              <div className="admin-icon-container w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center">
                <ShieldAlert className="w-6 h-6 text-amber-500" />
              </div>
            ) : isSuccess ? (
              <div className="admin-icon-container w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
            ) : (
              <img
                src="/iconos/logo_blanco.png"
                alt="Logo"
                className="h-28 w-auto object-contain mx-auto"
              />
            )}
          </div>

          <div className="flex items-center justify-center">
            <span className="text-sm font-black tracking-wider text-white uppercase">
              PANEL ADMINISTRADOR
            </span>
          </div>
        </div>

        {/* Caso A: Usuario autenticado pero sin rol admin/staff */}
        {isUnauthorizedUser ? (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-center text-xs space-y-1">
              <p className="font-semibold text-amber-200">Acceso no autorizado</p>
              <p className="text-zinc-400 text-[11px]">
                La cuenta <span className="text-zinc-200 font-mono font-medium">{user.email}</span> no cuenta con privilegios de administrador.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSwitchAccount}
              disabled={isSubmitting}
              className="w-full h-10 rounded-lg bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-semibold text-xs tracking-wide shadow-md shadow-pink-600/25 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Cambiar de cuenta</span>
                </>
              )}
            </button>

            <div className="pt-1 flex justify-center">
              <Link
                href="/"
                className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <Store className="w-3 h-3" />
                <span>Volver a la tienda</span>
              </Link>
            </div>
          </div>
        ) : (
          /* Caso B: Formulario de credenciales para admin */
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Mensaje de error visual conciso */}
            {errorMessage && (
              <div className="admin-error-badge p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/35 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                <span className="font-medium text-[11px]">{errorMessage}</span>
              </div>
            )}

            {/* Input Email */}
            <div className="space-y-1">
              <div className="relative flex items-center group">
                <div className="absolute left-3 text-zinc-500 group-focus-within:text-pink-400 transition-colors pointer-events-none">
                  <Mail className="w-3.5 h-3.5" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@pizzeriapalermo.cl"
                  autoComplete="email"
                  disabled={isSubmitting || isSuccess}
                  className="w-full h-10 pl-9 pr-3 bg-zinc-950/70 border border-zinc-800 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 rounded-lg text-zinc-100 placeholder:text-zinc-500 text-xs outline-none transition-all duration-200 disabled:opacity-50"
                  required
                />
              </div>
            </div>

            {/* Input Password */}
            <div className="space-y-1">
              <div className="relative flex items-center group">
                <div className="absolute left-3 text-zinc-500 group-focus-within:text-pink-400 transition-colors pointer-events-none">
                  <Lock className="w-3.5 h-3.5" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  disabled={isSubmitting || isSuccess}
                  className="w-full h-10 pl-9 pr-9 bg-zinc-950/70 border border-zinc-800 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 rounded-lg text-zinc-100 placeholder:text-zinc-500 text-xs outline-none transition-all duration-200 disabled:opacity-50"
                  required
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2.5 text-zinc-500 hover:text-zinc-300 focus:outline-none p-1 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Botón de Ingreso */}
            <button
              type="submit"
              disabled={isSubmitting || isSuccess}
              className="group relative w-full h-10 mt-1.5 rounded-lg bg-gradient-to-r from-pink-600 via-rose-600 to-pink-600 hover:from-pink-500 hover:to-rose-500 text-white font-semibold text-xs tracking-wide shadow-md shadow-pink-600/30 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-1.5 disabled:opacity-60 overflow-hidden"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              ) : isSuccess ? (
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                  <span>Accediendo...</span>
                </div>
              ) : (
                <>
                  <span>Ingresar</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-200" />
                </>
              )}
            </button>

            {/* Enlace de Retorno */}
            <div className="pt-3 flex items-center justify-center border-t border-zinc-800/80">
              <Link
                href="/"
                className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <Store className="w-3 h-3" />
                <span>Tienda Palermo</span>
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

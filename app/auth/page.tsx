"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, ChevronLeft } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { httpsCallable } from "firebase/functions"
import { functions } from "@/lib/firebase"
import Header from "../components/Header"
import Footer from "../components/Footer"
import { useAuth } from "../context/AuthContext"

export default function AuthPage() {
  const router = useRouter()
  const { login, register, loginWithGoogle } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [activeTab, setActiveTab] = useState<"login" | "register">("login")

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      const tab = params.get("tab")
      if (tab === "register" || tab === "login") {
        setActiveTab(tab)
      }
    }
  }, [])

  // Login form state
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")

  // Register form state
  const [registerName, setRegisterName] = useState("")
  const [registerEmail, setRegisterEmail] = useState("")
  const [registerPassword, setRegisterPassword] = useState("")
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("")
  const [registerPhone, setRegisterPhone] = useState("") // 8 dígitos después del +56 9
  const [registerAddress, setRegisterAddress] = useState("")

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let digits = e.target.value.replace(/\D/g, "")
    // Si el usuario pega el número completo con +569 o 569, removemos el prefijo automáticamente
    if (digits.startsWith("569") && digits.length > 8) {
      digits = digits.slice(3)
    } else if (digits.startsWith("9") && digits.length === 9) {
      digits = digits.slice(1)
    }
    setRegisterPhone(digits.slice(0, 8))
  }

  const switchMode = (mode: "login" | "register") => {
    setActiveTab(mode)
    setShowPassword(false)
    setShowConfirmPassword(false)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      await login(loginEmail.trim(), loginPassword)
      toast({
        title: "¡Bienvenido de vuelta!",
        description: "Has iniciado sesión correctamente.",
      })
      router.push("/")
    } catch (error: any) {
      console.error("Error al iniciar sesión:", error)
      toast({
        variant: "destructive",
        title: "Error al iniciar sesión",
        description: error.message || "Por favor verifica tus credenciales.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setIsLoading(true)
    try {
      await loginWithGoogle()
      toast({
        title: "¡Bienvenido!",
        description: "Has iniciado sesión con Google correctamente.",
      })
      router.push("/")
    } catch (error: any) {
      console.error("Error al iniciar sesión con Google:", error)
      toast({
        variant: "destructive",
        title: "Error al iniciar sesión",
        description: error.message || "No se pudo autenticar con Google. Intenta de nuevo.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()

    const cleanName = registerName.trim()
    const cleanEmail = registerEmail.trim()
    const cleanPhoneDigits = registerPhone.replace(/\D/g, "")

    if (!cleanName) {
      toast({
        variant: "destructive",
        title: "Nombre requerido",
        description: "Por favor ingresa tu nombre completo.",
      })
      return
    }

    if (cleanPhoneDigits.length !== 8) {
      toast({
        variant: "destructive",
        title: "Teléfono inválido",
        description: "Debes ingresar los 8 dígitos de tu celular después del +56 9.",
      })
      return
    }

    if (registerPassword.length < 6) {
      toast({
        variant: "destructive",
        title: "Contraseña muy corta",
        description: "La contraseña debe tener al menos 6 caracteres.",
      })
      return
    }

    if (registerPassword !== registerConfirmPassword) {
      toast({
        variant: "destructive",
        title: "Las contraseñas no coinciden",
        description: "Verifica que ambas contraseñas sean idénticas.",
      })
      return
    }

    const fullPhone = `+569${cleanPhoneDigits}`
    setIsLoading(true)

    try {
      const userData = await register({
        name: cleanName,
        email: cleanEmail,
        password: registerPassword,
        phone: fullPhone,
        address: registerAddress.trim(),
      })

      // Mostrar toast de confirmación
      toast({
        title: "✅ ¡Registro exitoso!",
        description: `Bienvenido ${cleanName}. Tu cuenta ha sido creada correctamente.`,
      })

      // Enviar notificaciones de bienvenida en segundo plano
      // No bloqueamos si hay errores en el envío
      try {
        // Enviar email de bienvenida
        const sendEmailFunction = httpsCallable(functions, "sendWelcomeEmailToUser")
        sendEmailFunction({
          email: userData.email,
          name: userData.name,
          password: userData.password,
        }).catch((error) => {
          console.warn("No se pudo enviar email de bienvenida:", error)
        })

        // Enviar WhatsApp de bienvenida (si se proporcionó teléfono)
        if (userData.phone) {
          const sendWhatsAppFunction = httpsCallable(functions, "sendWelcomeWhatsAppToUser")
          sendWhatsAppFunction({
            phone: userData.phone,
            name: userData.name,
            email: userData.email,
            password: userData.password,
          }).catch((error) => {
            console.warn("No se pudo enviar WhatsApp de bienvenida:", error)
          })
        }
      } catch (notificationError) {
        console.error("Error enviando notificaciones:", notificationError)
        // No mostramos error al usuario, las notificaciones son secundarias
      }

      // Redirigir al inicio
      setTimeout(() => {
        router.push("/")
      }, 1500)
    } catch (error: any) {
      console.error("Error al registrarse:", error)
      toast({
        variant: "destructive",
        title: "Error al registrarse",
        description: error.message || "No se pudo crear la cuenta. Intenta nuevamente.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const isRegister = activeTab === "register"

  return (
    <div className="min-h-screen flex flex-col bg-transparent">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8 md:py-14 flex items-center justify-center">
        <div className="auth-card-enter w-full max-w-5xl rounded-3xl overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.35)] border border-gray-200/80 bg-white grid grid-cols-1 lg:grid-cols-12">
          {/* Panel Izquierdo Oscuro - Branding & Puntos Palermo */}
          <div className="lg:col-span-5 bg-[#141416] text-white p-7 sm:p-10 flex flex-col justify-between relative overflow-hidden">
            {/* Decoración sutil de fondo */}
            <div className="pointer-events-none absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-pink-600/10 blur-3xl" />
            <div className="pointer-events-none absolute -top-20 -right-20 w-52 h-52 rounded-full bg-pink-500/10 blur-3xl" />

            <div className="relative z-10 space-y-7">
              {/* Cabecera con botón volver y título */}
              <div className="flex items-center gap-3.5">
                <Link
                  href="/"
                  className="w-10 h-10 rounded-full bg-[#242428] hover:bg-pink-600 text-white flex items-center justify-center transition-colors duration-200 shrink-0 shadow-sm"
                  aria-label="Volver al inicio"
                  title="Volver al inicio"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Link>
                <h1 className="font-arial-narrow text-2xl sm:text-3xl md:text-[32px] font-extrabold tracking-wide uppercase leading-none text-white">
                  {isRegister ? "CREAR CUENTA" : "INICIAR SESIÓN"}
                </h1>
              </div>

              {/* Tarjeta / Badge Puntos Palermo */}
              <div className="rounded-2xl bg-[#1e1e22] border border-white/10 px-4 py-3.5 flex items-center gap-3.5 shadow-inner">
                <div className="relative w-12 h-12 shrink-0 flex items-center justify-center rounded-xl bg-black/40 p-1.5 border border-pink-500/20">
                  <Image
                    src="/iconos/header/puntos.svg"
                    alt="Puntos Palermo"
                    width={44}
                    height={44}
                    className="w-9 h-9 object-contain"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-extrabold tracking-wider uppercase text-white leading-tight">
                    ÚNETE Y SUMA <span className="text-pink-400">PTS</span>
                  </p>
                  <p className="text-[11px] text-gray-400 font-medium truncate mt-0.5">
                    Programa Puntos Palermo
                  </p>
                </div>
              </div>

              {/* Descripción */}
              <p className="text-sm sm:text-[15px] text-gray-300 leading-relaxed font-normal">
                Suma <span className="text-white font-semibold">Puntos Palermo</span> en cada pedido en{" "}
                <span className="text-pink-400 font-semibold">Palermo Pizzas</span> y canjéalos por tus favoritos.
              </p>
            </div>

            {/* Pie del panel izquierdo en desktop */}
            <div className="relative z-10 hidden lg:block pt-10">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="w-2 h-2 rounded-full bg-pink-500 inline-block" />
                <span>Palermo Pizzas · Las mejores pizzas artesanales</span>
              </div>
            </div>
          </div>

          {/* Panel Derecho Blanco - Formularios */}
          <div className="lg:col-span-7 bg-white p-6 sm:p-10 md:p-12 flex flex-col justify-center">
            {isRegister ? (
              /* FORMULARIO CREAR CUENTA */
              <form onSubmit={handleRegister} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                  {/* Nombre completo */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="register-name" className="text-xs font-bold text-gray-800">
                      Nombre completo
                    </Label>
                    <Input
                      id="register-name"
                      placeholder="Ej. Juan Pérez"
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                      required
                      disabled={isLoading}
                      className="h-11 rounded-lg border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 focus-visible:ring-pink-500 focus-visible:border-pink-500"
                    />
                  </div>

                  {/* Correo electrónico */}
                  <div className="space-y-1.5">
                    <Label htmlFor="register-email" className="text-xs font-bold text-gray-800">
                      Correo electrónico
                    </Label>
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="Ej. nombre@mail.com"
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      required
                      disabled={isLoading}
                      className="h-11 rounded-lg border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 focus-visible:ring-pink-500 focus-visible:border-pink-500"
                    />
                  </div>

                  {/* Teléfono con prefijo +56 9 */}
                  <div className="space-y-1.5">
                    <Label htmlFor="register-phone" className="text-xs font-bold text-gray-800">
                      Teléfono
                    </Label>
                    <div className="flex h-11 w-full rounded-lg border border-gray-300 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-pink-500 focus-within:border-pink-500 transition-all">
                      <span className="inline-flex items-center justify-center px-3.5 bg-gray-100 text-gray-700 font-bold text-sm border-r border-gray-300 select-none shrink-0">
                        +56 9
                      </span>
                      <input
                        id="register-phone"
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9]{8}"
                        maxLength={8}
                        placeholder="12345678"
                        value={registerPhone}
                        onChange={handlePhoneChange}
                        required
                        disabled={isLoading}
                        className="w-full px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-transparent focus:outline-none"
                      />
                    </div>
                    <p className="text-[11px] text-gray-500 leading-tight">
                      Celular de 8 dígitos después del +56 9.
                    </p>
                  </div>

                  {/* Contraseña */}
                  <div className="space-y-1.5">
                    <Label htmlFor="register-password" className="text-xs font-bold text-gray-800">
                      Contraseña
                    </Label>
                    <div className="relative">
                      <Input
                        id="register-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={registerPassword}
                        onChange={(e) => setRegisterPassword(e.target.value)}
                        required
                        disabled={isLoading}
                        className="h-11 pr-10 rounded-lg border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 focus-visible:ring-pink-500 focus-visible:border-pink-500"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors !min-h-0 !min-w-0"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  {/* Confirmar contraseña */}
                  <div className="space-y-1.5">
                    <Label htmlFor="register-confirm-password" className="text-xs font-bold text-gray-800">
                      Confirmar contraseña
                    </Label>
                    <div className="relative">
                      <Input
                        id="register-confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={registerConfirmPassword}
                        onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                        required
                        disabled={isLoading}
                        className="h-11 pr-10 rounded-lg border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 focus-visible:ring-pink-500 focus-visible:border-pink-500"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors !min-h-0 !min-w-0"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        aria-label={showConfirmPassword ? "Ocultar confirmación de contraseña" : "Mostrar confirmación de contraseña"}
                      >
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  {/* Dirección (opcional) */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="register-address" className="text-xs font-bold text-gray-800">
                      Dirección (opcional)
                    </Label>
                    <Input
                      id="register-address"
                      placeholder="Av. Principal 123, Los Andes"
                      value={registerAddress}
                      onChange={(e) => setRegisterAddress(e.target.value)}
                      disabled={isLoading}
                      className="h-11 rounded-lg border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 focus-visible:ring-pink-500 focus-visible:border-pink-500"
                    />
                  </div>
                </div>

                {/* Nota legal de privacidad y términos */}
                <div className="pt-2 border-t border-gray-200 text-xs text-gray-500 leading-relaxed space-y-1">
                  <p>
                    Al registrarte en <span className="font-semibold text-gray-700">Palermo Pizzas</span>, aceptas nuestros{" "}
                    <Link href="/terminos" className="text-gray-800 font-bold underline hover:text-pink-600">
                      Términos y Condiciones
                    </Link>{" "}
                    y nuestra{" "}
                    <Link href="/privacidad" className="text-gray-800 font-bold underline hover:text-pink-600">
                      Política de Privacidad
                    </Link>
                    .
                  </p>
                </div>

                {/* Botón Crear Cuenta + Link Inicia sesión */}
                <div className="pt-2 flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full sm:w-auto sm:min-w-[230px] h-12 bg-pink-600 hover:bg-pink-700 text-white font-extrabold tracking-wide uppercase rounded-lg shadow-md hover:shadow-lg transition-all"
                  >
                    {isLoading ? "CREANDO CUENTA..." : "CREAR CUENTA"}
                  </Button>

                  <div className="text-sm text-gray-600 text-center sm:text-left">
                    ¿Ya tienes cuenta?{" "}
                    <button
                      type="button"
                      onClick={() => switchMode("login")}
                      className="font-extrabold text-gray-900 hover:text-pink-600 transition-colors !min-h-0 !min-w-0"
                    >
                      Inicia sesión
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              /* FORMULARIO INICIAR SESIÓN */
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-bold text-gray-800">
                      Correo electrónico
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Ej. nombre@mail.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      disabled={isLoading}
                      className="h-11 rounded-lg border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 focus-visible:ring-pink-500 focus-visible:border-pink-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="password" className="text-xs font-bold text-gray-800">
                        Contraseña
                      </Label>
                      <Link
                        href="/auth/reset-password"
                        className="text-xs font-semibold text-pink-600 hover:text-pink-700 hover:underline"
                      >
                        ¿Olvidaste tu contraseña?
                      </Link>
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                        disabled={isLoading}
                        className="h-11 pr-10 rounded-lg border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 focus-visible:ring-pink-500 focus-visible:border-pink-500"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors !min-h-0 !min-w-0"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full sm:w-auto sm:min-w-[230px] h-12 bg-pink-600 hover:bg-pink-700 text-white font-extrabold tracking-wide uppercase rounded-lg shadow-md hover:shadow-lg transition-all"
                  >
                    {isLoading ? "INICIANDO SESIÓN..." : "INICIAR SESIÓN"}
                  </Button>

                  <div className="text-sm text-gray-600 text-center sm:text-left">
                    ¿No tienes cuenta?{" "}
                    <button
                      type="button"
                      onClick={() => switchMode("register")}
                      className="font-extrabold text-gray-900 hover:text-pink-600 transition-colors !min-h-0 !min-w-0"
                    >
                      Crear cuenta
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Separador y Botón de Google */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-3 text-gray-400 font-semibold tracking-wider">
                  O continuar con
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full h-11 border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <svg className="h-5 w-5 mr-1" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                <g transform="matrix(1, 0, 0, 1, 0, 0)">
                  <path d="M21.35,11.1H12v2.7h5.38c-0.24,1.28 -0.96,2.37 -2.04,3.1v2.6h3.3c1.92,-1.78 3.02,-4.4 3.02,-7.4C21.66,11.83 21.55,11.45 21.35,11.1z" fill="#4285F4" />
                  <path d="M12,20.6c2.59,0 4.77,-0.86 6.36,-2.3l-3.3,-2.6c-0.91,0.61 -2.08,0.98 -3.06,0.98 -2.35,0 -4.35,-1.59 -5.06,-3.72H3.5v2.6C5.1,18.71 8.35,20.6 12,20.6z" fill="#34A853" />
                  <path d="M6.94,12.96c-0.18,-0.54 -0.28,-1.11 -0.28,-1.7c0,-0.59 0.1,-1.16 0.28,-1.7V6.96H3.5C2.88,8.2 2.53,9.6 2.53,11.26c0,1.66 0.35,3.06 0.97,4.3L6.94,12.96z" fill="#FBBC05" />
                  <path d="M12,5.2c1.41,0 2.68,0.49 3.68,1.44l2.76,-2.76C16.76,2.32 14.59,1.4 12,1.4c-3.65,0 -6.9,1.89 -8.5,5.2l3.44,2.6c0.71,-2.13 2.71,-3.72 5.06,-3.72z" fill="#EA4335" />
                </g>
              </svg>
              <span>Continuar con Google</span>
            </Button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}


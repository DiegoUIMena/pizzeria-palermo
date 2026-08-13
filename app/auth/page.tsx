"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Eye, EyeOff, ArrowLeft } from "lucide-react"
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
  const [activeTab, setActiveTab] = useState("login")

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
  const [registerPhone, setRegisterPhone] = useState("")
  const [registerAddress, setRegisterAddress] = useState("")

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      await login(loginEmail, loginPassword)
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
    setIsLoading(true)

    try {
      const userData = await register({
        name: registerName,
        email: registerEmail,
        password: registerPassword,
        phone: registerPhone,
        address: registerAddress,
      })

      // Mostrar toast de confirmación
      toast({
        title: "✅ ¡Registro exitoso!",
        description: `Bienvenido ${registerName}. Tu cuenta ha sido creada correctamente.`,
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

  return (
    <div className="min-h-screen bg-black">
      <Header />

      <main className="container mx-auto px-4 py-12">
        <div className="flex justify-center">
          <Card className="w-full max-w-md border-pink-400">
            <CardHeader className="bg-gradient-to-r from-pink-400 to-pink-500 text-white">
              <Link href="/" className="flex items-center text-white mb-4 hover:text-pink-200">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver al inicio
              </Link>
              <CardTitle className="text-2xl font-bold">Bienvenido a Pizzería Palermo</CardTitle>
              <CardDescription className="text-pink-100">
                Inicia sesión o regístrate para realizar pedidos y seguir tu historial
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="login">Iniciar Sesión</TabsTrigger>
                  <TabsTrigger value="register">Registrarse</TabsTrigger>
                </TabsList>

                {/* Login Form */}
                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Correo electrónico</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="tu@email.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label htmlFor="password">Contraseña</Label>
                        <Link href="/auth/reset-password" className="text-xs text-pink-500 hover:underline">
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
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-pink-500 hover:bg-pink-600 text-white"
                      disabled={isLoading}
                    >
                      {isLoading ? "Iniciando sesión..." : "Iniciar Sesión"}
                    </Button>
                  </form>
                </TabsContent>

                {/* Register Form */}
                <TabsContent value="register">
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="register-name">Nombre completo</Label>
                      <Input
                        id="register-name"
                        placeholder="Juan Pérez"
                        value={registerName}
                        onChange={(e) => setRegisterName(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="register-email">Correo electrónico</Label>
                      <Input
                        id="register-email"
                        type="email"
                        placeholder="tu@email.com"
                        value={registerEmail}
                        onChange={(e) => setRegisterEmail(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="register-password">Contraseña</Label>
                      <div className="relative">
                        <Input
                          id="register-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          value={registerPassword}
                          onChange={(e) => setRegisterPassword(e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="register-phone">Teléfono</Label>
                      <Input
                        id="register-phone"
                        type="tel"
                        placeholder="+56 9 1234 5678"
                        value={registerPhone}
                        onChange={(e) => setRegisterPhone(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="register-address">Dirección (opcional)</Label>
                      <Input
                        id="register-address"
                        placeholder="Av. Principal 123, Santiago"
                        value={registerAddress}
                        onChange={(e) => setRegisterAddress(e.target.value)}
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-pink-500 hover:bg-pink-600 text-white"
                      disabled={isLoading}
                    >
                      {isLoading ? "Registrando..." : "Registrarse"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

              {/* Botón de Autenticación con Google */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-200 dark:border-gray-800" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white dark:bg-gray-900 px-2 text-gray-500 dark:text-gray-400">
                    O continuar con
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl flex items-center justify-center gap-2"
              >
                <svg className="h-5 w-5 mr-1" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                  <g transform="matrix(1, 0, 0, 1, 0, 0)">
                    <path d="M21.35,11.1H12v2.7h5.38c-0.24,1.28 -0.96,2.37 -2.04,3.1v2.6h3.3c1.92,-1.78 3.02,-4.4 3.02,-7.4C21.66,11.83 21.55,11.45 21.35,11.1z" fill="#4285F4" />
                    <path d="M12,20.6c2.59,0 4.77,-0.86 6.36,-2.3l-3.3,-2.6c-0.91,0.61 -2.08,0.98 -3.06,0.98 -2.35,0 -4.35,-1.59 -5.06,-3.72H3.5v2.6C5.1,18.71 8.35,20.6 12,20.6z" fill="#34A853" />
                    <path d="M6.94,12.96c-0.18,-0.54 -0.28,-1.11 -0.28,-1.7c0,-0.59 0.1,-1.16 0.28,-1.7V6.96H3.5C2.88,8.2 2.53,9.6 2.53,11.26c0,1.66 0.35,3.06 0.97,4.3L6.94,12.96z" fill="#FBBC05" />
                    <path d="M12,5.2c1.41,0 2.68,0.49 3.68,1.44l2.76,-2.76C16.76,2.32 14.59,1.4 12,1.4c-3.65,0 -6.9,1.89 -8.5,5.2l3.44,2.6c0.71,-2.13 2.71,-3.72 5.06,-3.72z" fill="#EA4335" />
                  </g>
                </svg>
                <span>Google</span>
              </Button>
            </CardContent>

            <CardFooter className="flex flex-col space-y-4 border-t pt-4">
              <div className="text-center text-sm text-gray-500">
                Al continuar, aceptas nuestros{" "}
                <Link href="/terminos" className="text-pink-500 hover:underline">
                  Términos y Condiciones
                </Link>{" "}
                y{" "}
                <Link href="/privacidad" className="text-pink-500 hover:underline">
                  Política de Privacidad
                </Link>
              </div>
            </CardFooter>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  )
}

"use client"

import type React from "react"

import { useState } from "react"
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
  const { login, register } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

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
              <Tabs defaultValue="login" className="w-full">
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

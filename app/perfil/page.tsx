"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Save, User } from "lucide-react"
import Header from "../components/Header"
import Footer from "../components/Footer"
import { useAuth } from "../context/AuthContext"

export default function PerfilPage() {
  const router = useRouter()
  const { user, updateUser, isAuthenticated } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false)

  // Estado del formulario - inicializar con valores vacíos
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")

  // Efecto para manejar la autenticación y cargar datos del usuario
  useEffect(() => {
    if (!isAuthenticated) {
      setIsRedirecting(true)
      router.push("/auth")
    } else if (user) {
      // Cargar datos del usuario cuando esté disponible
      setName(user.name || "")
      setEmail(user.email || "")
      setPhone(user.phone || "")
      setAddress(user.address || "")
    }
  }, [isAuthenticated, user, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Actualizar datos del usuario
      updateUser({
        name,
        email,
        phone,
        address,
      })

      // Simular tiempo de procesamiento
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Mostrar mensaje de éxito (en un caso real usaríamos un toast)
      alert("Perfil actualizado correctamente")
    } catch (error) {
      console.error("Error al actualizar perfil:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Mostrar loading mientras se redirige o no hay usuario
  if (!isAuthenticated || isRedirecting || !user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-12">
          <div className="max-w-2xl mx-auto text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando perfil...</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <Link href="/" className="flex items-center text-gray-600 mb-6 hover:text-pink-600 transition-colors">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al inicio
          </Link>

          <h1 className="text-3xl font-bold text-gray-800 mb-8">Mi Perfil</h1>

          <Card className="border-gray-200">
            <CardHeader className="bg-gray-50 border-b border-gray-200">
              <div className="flex items-center">
                <User className="h-5 w-5 text-pink-600 mr-2" />
                <CardTitle className="text-xl text-gray-800">Información Personal</CardTitle>
              </div>
              <CardDescription className="text-gray-600">Actualiza tus datos personales</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre completo</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tu nombre"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Correo electrónico</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+56 9 1234 5678"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Dirección</Label>
                  <Input
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Av. Principal 123, Santiago"
                  />
                </div>
              </form>
            </CardContent>
            <CardFooter className="flex justify-end border-t border-gray-200 pt-4 bg-gray-50">
              <Button
                onClick={handleSubmit}
                disabled={isLoading}
                className="bg-pink-600 text-white hover:bg-pink-700 font-bold py-3 px-8 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center"
              >
                <Save className="mr-2 h-4 w-4" />
                {isLoading ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  )
}

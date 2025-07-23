"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, MapPin } from "lucide-react"
import Header from "../components/Header"
import Footer from "../components/Footer"

export default function DireccionPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  // Formulario de dirección
  const [calle, setCalle] = useState("")
  const [numero, setNumero] = useState("")
  const [depto, setDepto] = useState("")
  const [comuna, setComuna] = useState("")
  const [referencia, setReferencia] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    // Simulación de procesamiento
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500))
      router.push("/pago")
    } catch (error) {
      console.error("Error al procesar la dirección:", error)
    } finally {
      setIsLoading(false)
    }
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

          <h1 className="text-3xl font-bold text-gray-800 mb-8">Dirección de Entrega</h1>

          <Card className="border-gray-200">
            <CardHeader className="bg-gray-50 border-b border-gray-200">
              <div className="flex items-center">
                <MapPin className="h-5 w-5 text-pink-600 mr-2" />
                <CardTitle className="text-xl text-gray-800">Ingresa tu dirección</CardTitle>
              </div>
              <CardDescription className="text-gray-600">
                Completa los datos para la entrega de tu pedido
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="calle">Calle</Label>
                    <Input
                      id="calle"
                      value={calle}
                      onChange={(e) => setCalle(e.target.value)}
                      placeholder="Av. Principal"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="numero">Número</Label>
                    <Input
                      id="numero"
                      value={numero}
                      onChange={(e) => setNumero(e.target.value)}
                      placeholder="123"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="depto">Departamento/Casa (Opcional)</Label>
                    <Input id="depto" value={depto} onChange={(e) => setDepto(e.target.value)} placeholder="Depto 42" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="comuna">Comuna</Label>
                    <Input
                      id="comuna"
                      value={comuna}
                      onChange={(e) => setComuna(e.target.value)}
                      placeholder="Santiago"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="referencia">Referencia (Opcional)</Label>
                  <Input
                    id="referencia"
                    value={referencia}
                    onChange={(e) => setReferencia(e.target.value)}
                    placeholder="Edificio azul, cerca del parque"
                  />
                </div>

                <div className="pt-4">
                  <p className="text-sm text-gray-500 mb-2">
                    * Recuerda que el tiempo de entrega puede variar según la distancia.
                  </p>
                </div>
              </form>
            </CardContent>
            <CardFooter className="flex justify-end border-t border-gray-200 pt-4 bg-gray-50">
              <Button
                onClick={handleSubmit}
                disabled={isLoading}
                className="bg-pink-600 text-white hover:bg-pink-700 font-bold py-3 px-8 rounded-lg shadow-md hover:shadow-lg transition-all"
              >
                {isLoading ? "Procesando..." : "Continuar al Pago"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  )
}

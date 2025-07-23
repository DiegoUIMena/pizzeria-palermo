"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, Home } from "lucide-react"
import Header from "../components/Header"
import Footer from "../components/Footer"

export default function ConfirmacionPage() {
  const [orderNumber, setOrderNumber] = useState("")
  const [estimatedTime, setEstimatedTime] = useState("")

  useEffect(() => {
    // Generar número de orden aleatorio
    const randomOrderNumber = Math.floor(10000 + Math.random() * 90000).toString()
    setOrderNumber(randomOrderNumber)

    // Tiempo estimado aleatorio entre 15-30 minutos
    const randomMinutes = Math.floor(15 + Math.random() * 15)
    setEstimatedTime(`${randomMinutes} minutos`)
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto text-center">
          <div className="flex justify-center mb-6">
            <div className="bg-green-100 p-4 rounded-full">
              <CheckCircle className="h-16 w-16 text-green-600" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-gray-800 mb-4">¡Pedido Confirmado!</h1>
          <p className="text-gray-600 mb-8">
            Gracias por tu compra. Tu pedido ha sido recibido y está siendo preparado.
          </p>

          <Card className="border-gray-200 mb-8">
            <CardHeader className="bg-gray-50 border-b border-gray-200">
              <CardTitle className="text-xl text-gray-800">Detalles del Pedido</CardTitle>
              <CardDescription className="text-gray-600">Información de tu pedido #{orderNumber}</CardDescription>
            </CardHeader>
            <CardContent className="py-6">
              <div className="space-y-4">
                <div className="bg-pink-50 p-4 rounded-lg border border-pink-200">
                  <h3 className="font-medium text-gray-800 mb-2">Tiempo Estimado de Entrega</h3>
                  <p className="text-2xl font-bold text-pink-600">{estimatedTime}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                  <div>
                    <h3 className="font-medium text-gray-800 mb-2">Método de Entrega</h3>
                    <p className="text-gray-600">Retiro en Local</p>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-800 mb-2">Método de Pago</h3>
                    <p className="text-gray-600">Webpay Plus</p>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-center border-t border-gray-200 pt-4 bg-gray-50">
              <Link href="/seguimiento" className="w-full">
                <Button className="w-full bg-pink-600 text-white hover:bg-pink-700 font-bold py-3 rounded-lg shadow-md hover:shadow-lg transition-all">
                  Seguir mi Pedido
                </Button>
              </Link>
            </CardFooter>
          </Card>

          <Link href="/">
            <Button variant="outline" className="flex items-center space-x-2">
              <Home className="h-4 w-4" />
              <span>Volver al Inicio</span>
            </Button>
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  )
}

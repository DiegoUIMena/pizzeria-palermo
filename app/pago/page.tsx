"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { ArrowLeft, CreditCard, Banknote, ArrowRightCircle, Store } from "lucide-react"
import Header from "../components/Header"
import Footer from "../components/Footer"
import { useCart } from "../context/CartContext"

export default function PagoPage() {
  const router = useRouter()
  const { getTotal } = useCart()
  const [paymentMethod, setPaymentMethod] = useState("webpay")
  const [isProcessing, setIsProcessing] = useState(false)

  const subtotal = getTotal()
  const discount = 1680
  const total = subtotal - discount

  const handlePayment = async () => {
    setIsProcessing(true)

    // Simulación de procesamiento de pago
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Redirigir a página de confirmación
      router.push("/confirmacion")
    } catch (error) {
      console.error("Error al procesar el pago:", error)
      setIsProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <Link href="/" className="flex items-center text-gray-600 mb-6 hover:text-pink-600 transition-colors">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al inicio
          </Link>

          <h1 className="text-3xl font-bold text-gray-800 mb-8">Método de Pago</h1>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Opciones de Pago */}
            <div className="md:col-span-2">
              <Card className="border-gray-200">
                <CardHeader className="bg-gray-50 border-b border-gray-200">
                  <CardTitle className="text-xl text-gray-800">Selecciona tu método de pago</CardTitle>
                  <CardDescription className="text-gray-600">
                    Elige cómo quieres pagar tu pedido para retirar en local
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="webpay" id="webpay" />
                      <Label
                        htmlFor="webpay"
                        className="flex items-center cursor-pointer flex-1 p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <CreditCard className="h-5 w-5 text-pink-600 mr-3" />
                        <div>
                          <div className="font-medium text-gray-800">Webpay Plus</div>
                          <div className="text-sm text-gray-500">Paga con tarjeta de crédito o débito</div>
                        </div>
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="efectivo" id="efectivo" />
                      <Label
                        htmlFor="efectivo"
                        className="flex items-center cursor-pointer flex-1 p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <Banknote className="h-5 w-5 text-pink-600 mr-3" />
                        <div>
                          <div className="font-medium text-gray-800">Efectivo</div>
                          <div className="text-sm text-gray-500">Paga al retirar tu pedido</div>
                        </div>
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="transferencia" id="transferencia" />
                      <Label
                        htmlFor="transferencia"
                        className="flex items-center cursor-pointer flex-1 p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <ArrowRightCircle className="h-5 w-5 text-pink-600 mr-3" />
                        <div>
                          <div className="font-medium text-gray-800">Transferencia Bancaria</div>
                          <div className="text-sm text-gray-500">
                            Transfiere a nuestra cuenta y envía el comprobante
                          </div>
                        </div>
                      </Label>
                    </div>
                  </RadioGroup>

                  {paymentMethod === "transferencia" && (
                    <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <h3 className="font-medium text-gray-800 mb-2">Datos para transferencia:</h3>
                      <ul className="space-y-2 text-sm text-gray-600">
                        <li>
                          <span className="font-medium">Banco:</span> Banco Estado
                        </li>
                        <li>
                          <span className="font-medium">Tipo de cuenta:</span> Cuenta Corriente
                        </li>
                        <li>
                          <span className="font-medium">Número:</span> 123456789
                        </li>
                        <li>
                          <span className="font-medium">RUT:</span> 76.123.456-7
                        </li>
                        <li>
                          <span className="font-medium">Nombre:</span> Pizzería Palermo SpA
                        </li>
                        <li>
                          <span className="font-medium">Email:</span> pagos@pizzeriapalermo.cl
                        </li>
                      </ul>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex justify-end border-t border-gray-200 pt-4 bg-gray-50">
                  <Button
                    onClick={handlePayment}
                    disabled={isProcessing}
                    className="bg-pink-600 text-white hover:bg-pink-700 font-bold py-3 px-8 rounded-lg shadow-md hover:shadow-lg transition-all"
                  >
                    {isProcessing ? "Procesando..." : "Confirmar Pago"}
                  </Button>
                </CardFooter>
              </Card>
            </div>

            {/* Resumen del Pedido */}
            <div>
              <Card className="border-gray-200">
                <CardHeader className="bg-gray-50 border-b border-gray-200">
                  <CardTitle className="text-lg text-gray-800">Resumen del Pedido</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    <div className="flex justify-between text-gray-700">
                      <span>Total Productos</span>
                      <span className="font-medium">${subtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-green-600">
                      <span>Descuentos</span>
                      <span className="font-medium">-${discount.toLocaleString()}</span>
                    </div>
                    <div className="pt-2 border-t border-gray-200 flex justify-between font-bold text-lg text-gray-800">
                      <span>Total</span>
                      <span className="text-pink-600">${total.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="mt-6 p-3 bg-pink-50 rounded-lg border border-pink-200">
                    <div className="flex items-center text-pink-700">
                      <Store className="h-5 w-5 mr-2" />
                      <span className="font-medium">Retiro en Local</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                      Retira tu pedido en nuestra sucursal principal en 15-30 minutos.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

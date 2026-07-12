"use client"

import { useEffect, useState, useRef, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle, Loader2, ArrowRightCircle } from "lucide-react"
import { functions, db } from "@/lib/firebase"
import { httpsCallable } from "firebase/functions"
import { doc, onSnapshot } from "firebase/firestore"
import Link from "next/link"

function KhipuReturnContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [statusMessage, setStatusMessage] = useState("Esperando confirmación de la transferencia...")
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  
  const hasTriggeredVerification = useRef(false)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const paymentId = searchParams.get("paymentId") || searchParams.get("khipuPaymentId")
    const localOrderId = localStorage.getItem("pendingOrderId")

    if (!paymentId && !localOrderId) {
      setError("No se encontró información de la transacción ni identificador del pedido.")
      setLoading(false)
      return
    }

    console.log("Khipu Return: Iniciando monitoreo de pago", { paymentId, localOrderId })

    // 1. Establecer listener en tiempo real de Firestore sobre la orden para detectar cuando pase a 'paid' o 'failed'
    // Esto asegura que la UI se actualice reactivamente en milisegundos cuando el webhook o la verificación manual terminen.
    if (localOrderId) {
      const orderDocRef = doc(db, "orders", localOrderId)
      
      unsubscribeRef.current = onSnapshot(orderDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const orderData = docSnap.data()
          console.log("Khipu Return: Cambio de estado de la orden en Firestore", {
            paymentStatus: orderData.paymentStatus,
            estado: orderData.estado
          })

          if (orderData.paymentStatus === "paid") {
            // El pago fue aprobado y procesado exitosamente por el backend
            setResult({
              success: true,
              amount: orderData.total,
              orderNumber: orderData.orderNumber,
              isGuestOrder: orderData.customerType === "guest",
              // Generar o recuperar datos de invitado
              trackingToken: orderData.guestCheckout?.webpayTokenHash || localOrderId, // fallback
              email: orderData.cliente?.email || ""
            })
            setLoading(false)
            
            // Limpiar datos pendientes locales
            localStorage.removeItem("pendingOrderId")
            localStorage.removeItem("pendingOrderNumber")
            localStorage.removeItem("pendingPaymentProvider")
            
            if (unsubscribeRef.current) {
              unsubscribeRef.current()
              unsubscribeRef.current = null
            }
          } else if (orderData.paymentStatus === "failed") {
            setError("La transferencia bancaria fue rechazada o cancelada en Khipu.")
            setLoading(false)
            if (unsubscribeRef.current) {
              unsubscribeRef.current()
              unsubscribeRef.current = null
            }
          }
        }
      }, (snapError) => {
        console.error("Khipu Return: Error en listener en tiempo real:", snapError)
      })
    }

    // 2. Disparar verificación manual paralela en el backend para acelerar el procesamiento
    // por si el webhook de Khipu se retrasa.
    const triggerBackendVerification = async () => {
      if (hasTriggeredVerification.current || !paymentId) {
        return
      }
      hasTriggeredVerification.current = true

      try {
        console.log("Khipu Return: Llamando a verifyKhipuPayment en backend...", { paymentId })
        setStatusMessage("Verificando transferencia con Khipu...")
        const verifyKhipuFunction = httpsCallable(functions, "verifyKhipuPayment")
        await verifyKhipuFunction({ paymentId })
        console.log("Khipu Return: Finalizó verifyKhipuPayment del backend")
      } catch (err: any) {
        console.error("Khipu Return: Error llamando a verifyKhipuPayment:", err)
        // No mostramos error en la UI de inmediato porque el webhook aún podría procesarlo 
        // y el listener en tiempo real de Firestore resolvería la pantalla a éxito.
      }
    }

    triggerBackendVerification()

    // 3. Timeout de seguridad de 30 segundos
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.log("Khipu Return: Timeout de 30s alcanzado. Estado sigue pendiente.")
        setStatusMessage("El pago está tomando más tiempo de lo esperado en procesarse. Puedes verificar el estado en la sección de seguimiento.")
        setLoading(false)
        setError("Tiempo de espera agotado. Tu pedido está en verificación, pero puedes hacerle seguimiento.")
      }
    }, 30000)

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
    }
  }, [searchParams])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="w-12 h-12 animate-spin text-pink-600" />
              <h2 className="text-xl font-semibold">Procesando pago por transferencia...</h2>
              <p className="text-gray-600 text-center text-sm">
                {statusMessage}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error && !result) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="w-6 h-6" />
              Estado de la Transferencia
            </CardTitle>
            <CardDescription>
              Información sobre tu pago automatizado de Khipu
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600 text-sm leading-relaxed">{error}</p>
            <div className="flex gap-3">
              <Button
                onClick={() => router.push("/")}
                variant="outline"
                className="flex-1"
              >
                Volver al inicio
              </Button>
              <Button
                onClick={() => router.push("/")}
                className="flex-1 bg-pink-600 hover:bg-pink-700"
              >
                Ver Carrito
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (result && result.success) {
    const trackingUrl = result.isGuestOrder 
      ? `/seguimiento-pedido/guest?email=${encodeURIComponent(result.email)}`
      : `/pedidos`

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600 text-xl font-bold">
              <CheckCircle className="w-6 h-6 animate-pulse" />
              ¡Transferencia Recibida con Éxito!
            </CardTitle>
            <CardDescription className="text-gray-600">
              Khipu ha confirmado tu transferencia bancaria de forma 100% automatizada.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-700">Número de pedido:</span>{" "}
                #{result.orderNumber}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-700">Monto total transferido:</span> ${result.amount?.toLocaleString()}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-700">Medio de pago:</span> Transferencia Bancaria Directa (Khipu)
              </p>
            </div>
            
            <p className="text-gray-600 text-sm">
              Tu transferencia ha sido conciliada. El pedido ha ingresado a la cocina de Pizzería Palermo para su preparación. Recibirás tu confirmación de comanda de inmediato.
            </p>

            {/* Puntos de fidelidad Palermo promocional */}
            {result.isGuestOrder && (
              <div className="bg-gradient-to-r from-pink-50 to-pink-100 border-2 border-pink-300 rounded-lg p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">🎁</div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-pink-900">
                      ¡Acumula Puntos Palermo!
                    </h3>
                    <p className="text-sm text-pink-800 mt-2">
                      Si creas una cuenta de cliente registrado, podrás acumular puntos en cada pizza que pidas y canjearlos por pizzas gratis en tus próximas compras.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <Button
                onClick={() => router.push(trackingUrl)}
                className="w-full bg-pink-600 hover:bg-pink-700 font-bold py-3 rounded-lg text-white"
              >
                {result.isGuestOrder ? "Ver estado de mi pedido" : "Ver mis pedidos"}
              </Button>

              <Button
                onClick={() => router.push("/")}
                variant="outline"
                className="w-full font-semibold border-pink-200 text-pink-700 hover:bg-pink-50"
              >
                Volver al inicio
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return null
}

export default function KhipuReturnPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Loader2 className="w-12 h-12 animate-spin text-pink-600" />
      </div>
    }>
      <KhipuReturnContent />
    </Suspense>
  )
}

"use client"

import { useEffect, useState, useRef, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle, Loader2 } from "lucide-react"
import { functions } from "@/lib/firebase"
import { httpsCallable } from "firebase/functions"

function WebpayReturnContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const hasConfirmed = useRef(false)

  useEffect(() => {
    const confirmPayment = async () => {
      // Prevenir doble ejecución (React StrictMode en desarrollo)
      if (hasConfirmed.current) {
        return
      }
      hasConfirmed.current = true

      let timeoutId: any = null;
      try {
        // Si la confirmación tarda más de 30s, mostrar mensaje de timeout
        timeoutId = setTimeout(() => {
          if (!hasConfirmed.current) return;
          console.error('Timeout: confirmWebpayTransaction no respondió en 30s');
          setError('La confirmación del pago está tardando demasiado. Por favor intenta nuevamente.');
          setLoading(false);
        }, 30000);
        // Obtener el token de la URL
        const token = searchParams.get("token_ws") || searchParams.get("TBK_TOKEN")

        if (!token) {
          setError("No se recibió el token de Webpay")
          setLoading(false)
          return
        }

        console.log("Token recibido:", token)

        // Llamar a la Cloud Function para confirmar la transacción
        const confirmWebpayFunction = httpsCallable(functions, "confirmWebpayTransaction")
        const response = await confirmWebpayFunction({ token })

        const data = response.data as any
        console.log("Respuesta de confirmación:", data)
        setResult(data)
      } catch (err: any) {
        console.error("Error confirmando pago:", err)
        setError(err.message || "Error al procesar el pago")
      } finally {
        if (timeoutId) clearTimeout(timeoutId)
        setLoading(false)
      }
    }

    // Solo ejecutar si hay searchParams
    if (searchParams) {
      confirmPayment()
    }
  }, [searchParams])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="w-12 h-12 animate-spin text-pink-600" />
              <h2 className="text-xl font-semibold">Procesando pago...</h2>
              <p className="text-gray-600 text-center">
                Por favor espera mientras confirmamos tu transacción con Webpay
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !result) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="w-6 h-6" />
              Error en el Pago
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">{error || "Ocurrió un error al procesar el pago"}</p>
            <div className="flex gap-3">
              <Button
                onClick={() => router.push("/")}
                variant="outline"
                className="flex-1"
              >
                Volver al inicio
              </Button>
              <Button
                onClick={() => window.location.reload()}
                className="flex-1 bg-pink-600 hover:bg-pink-700"
              >
                Reintentar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (result.success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-6 h-6" />
              ¡Pago Exitoso!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
              <p className="text-sm text-gray-600">
                <span className="font-semibold">Código de autorización:</span>{" "}
                {result.authorizationCode}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-semibold">Monto:</span> ${result.amount?.toLocaleString()}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-semibold">Tarjeta:</span> **** **** **** {result.cardDetail?.card_number}
              </p>
            </div>
            
            <p className="text-gray-600">
              Tu pago ha sido procesado exitosamente. Recibirás una confirmación por correo electrónico.
            </p>

            <div className="flex gap-3">
              <Button
                onClick={() => router.push(`/pedidos`)}
                className="flex-1 bg-pink-600 hover:bg-pink-700"
              >
                Ver mis pedidos
              </Button>
              <Button
                onClick={() => router.push("/")}
                variant="outline"
                className="flex-1"
              >
                Volver al inicio
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Pago rechazado
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <XCircle className="w-6 h-6" />
            Pago Rechazado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">
              <span className="font-semibold">Código de respuesta:</span> {result.responseCode}
            </p>
          </div>
          
          <p className="text-gray-600">
            Tu pago no pudo ser procesado. Por favor verifica los datos de tu tarjeta e intenta nuevamente.
          </p>

          <div className="flex gap-3">
            <Button
              onClick={() => router.push("/")}
              variant="outline"
              className="flex-1"
            >
              Volver al inicio
            </Button>
            <Button
              onClick={() => router.back()}
              className="flex-1 bg-pink-600 hover:bg-pink-700"
            >
              Intentar de nuevo
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function WebpayReturnPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-yellow-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <Loader2 className="w-16 h-16 animate-spin mx-auto mb-4 text-pink-600" />
            <p className="text-lg text-gray-600">Procesando pago...</p>
          </CardContent>
        </Card>
      </div>
    }>
      <WebpayReturnContent />
    </Suspense>
  )
}

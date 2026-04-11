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
    // URL para seguimiento de invitados
    const trackingUrl = result.isGuestOrder && result.trackingToken 
      ? `/seguimiento-pedido/guest?token=${result.trackingToken}`
      : null

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-6 h-6" />
              ¡Pago Exitoso!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Detalles del pago */}
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

            {/* PROMOCIÓN: Puntos Palermo para invitados */}
            {result.isGuestOrder && (
              <div className="bg-gradient-to-r from-pink-50 to-pink-100 border-2 border-pink-300 rounded-lg p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">🎁</div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-pink-900">
                      ¡Bienvenido a Pizzería Palermo!
                    </h3>
                    <p className="text-sm text-pink-800 mt-2">
                      ¿Sabías que los usuarios registrados acumulan{" "}
                      <span className="font-bold text-pink-600">Puntos Palermo</span> con cada compra?
                    </p>
                    
                    <div className="mt-3 bg-white rounded p-3 space-y-2 text-sm">
                      <p className="text-gray-700">
                        <strong>✓</strong> Acumula puntos en cada pedido
                      </p>
                      <p className="text-gray-700">
                        <strong>✓</strong> Canjea puntos por pizzas gratis
                      </p>
                      <p className="text-gray-700">
                        <strong>✓</strong> Acceso al historial de pedidos
                      </p>
                      <p className="text-gray-700">
                        <strong>✓</strong> Solo toma 1 minuto en registrarse
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Botones de acción */}
            <div className="space-y-3">
              {trackingUrl ? (
                // Para invitados: mostrar opción de ver pedido ahora
                <>
                  <Button
                    onClick={() => router.push(trackingUrl)}
                    className="w-full bg-pink-600 hover:bg-pink-700"
                  >
                    Ver estado de mi pedido
                  </Button>
                  
                  <Button
                    onClick={() => router.push(`/auth?email=${encodeURIComponent(result.email || '')}`)}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    Crear cuenta para acumular puntos
                  </Button>
                </>
              ) : (
                // Para usuarios registrados: opción normal
                <Button
                  onClick={() => router.push(`/pedidos`)}
                  className="w-full bg-pink-600 hover:bg-pink-700"
                >
                  Ver mis pedidos
                </Button>
              )}

              <Button
                onClick={() => router.push("/")}
                variant="outline"
                className="w-full"
              >
                Volver al inicio
              </Button>
            </div>

            {/* Nota adicional para invitados */}
            {result.isGuestOrder && (
              <div className="text-xs text-gray-600 bg-gray-100 rounded p-3 text-center">
                Puedes ver el estado de tu pedido en cualquier momento con tu correo y teléfono.
              </div>
            )}
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

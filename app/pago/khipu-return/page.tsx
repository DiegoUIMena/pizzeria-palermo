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
  const [countdown, setCountdown] = useState(5)
  
  const hasTriggeredVerification = useRef(false)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const paymentId = searchParams.get("paymentId") || searchParams.get("payment_id") || searchParams.get("khipuPaymentId")
    const localOrderId = localStorage.getItem("pendingOrderId")
    const isCancelled = searchParams.get("cancel") === "true"

    if (isCancelled) {
      console.log("Khipu Return: Transacción cancelada por el usuario.")
      setStatusMessage("Método de pago cancelado. Volviendo al comercio...")
      setLoading(true)

      const cancelOrder = async () => {
        try {
          if (localOrderId) {
            const cancelKhipuFunction = httpsCallable(functions, "cancelKhipuTransaction")
            await cancelKhipuFunction({ orderId: localOrderId, paymentId })
            console.log("Khipu Return: Pedido marcado como Cancelado exitosamente.")
          }
        } catch (err) {
          console.error("Khipu Return: Error al cancelar el pedido:", err)
        } finally {
          localStorage.removeItem("pendingOrderId")
          localStorage.removeItem("pendingOrderNumber")
          localStorage.removeItem("pendingPaymentProvider")
          setTimeout(() => {
            router.push("/")
          }, 2000)
        }
      }

      cancelOrder()
      return
    }

    if (!paymentId && !localOrderId) {
      setError("No se encontró información de la transacción ni identificador del pedido.")
      setLoading(false)
      return
    }

    console.log(`Khipu Return: Iniciando monitoreo de pago. paymentId: "${paymentId}", localOrderId: "${localOrderId}"`)
    console.time("⏱️ Khipu: tiempo total hasta confirmación")
    console.timeStamp?.("Khipu: inicio monitoreo")
    const startTime = Date.now()
    console.log(`%c⏱️ [T+0ms] INICIO: Esperando confirmación de Khipu`, "color: orange; font-weight: bold")

    // 2. Polling al backend cada 7 segundos hasta confirmar el pago.
    // El backend ahora responde en ~2s (sin reintentos), así que en 75s hacemos ~10 consultas.
    const pollingIntervalRef = { current: null as ReturnType<typeof setInterval> | null }

    const pollKhipuStatus = async (resolvedPaymentId: string) => {
      if (!resolvedPaymentId || resolvedPaymentId === "null") return
      if (hasTriggeredVerification.current) return  // Ya hay una llamada en curso
      hasTriggeredVerification.current = true

      try {
        const elapsed = Date.now() - startTime
        console.log(`%c⏱️ [T+${elapsed}ms] Polling Khipu... paymentId: "${resolvedPaymentId}"`, "color: blue")
        const verifyKhipuFunction = httpsCallable(functions, "verifyKhipuPayment")
        const response = await verifyKhipuFunction({ paymentId: resolvedPaymentId, orderId: localOrderId })
        const data = response.data as any
        const elapsedAfter = Date.now() - startTime
        console.log(`%c⏱️ [T+${elapsedAfter}ms] Respuesta Khipu:`, "color: blue", data)

        if (data && data.success) {
          // Éxito — el listener de Firestore detectará el cambio y mostrará la pantalla verde
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)
        } else {
          // Aún verifying — liberar flag para próximo ciclo
          hasTriggeredVerification.current = false
        }
      } catch (err: any) {
        console.error("Khipu Return: Error en polling:", err)
        hasTriggeredVerification.current = false
      }
    }

    // Guardar referencia del intervalo para limpiarlo en el return del useEffect
    const startPolling = (resolvedPaymentId: string) => {
      // Llamada inmediata
      pollKhipuStatus(resolvedPaymentId)
      // Luego cada 7 segundos
      pollingIntervalRef.current = setInterval(() => {
        pollKhipuStatus(resolvedPaymentId)
      }, 7000)
    }


    // 1. Establecer listener en tiempo real de Firestore sobre la orden para detectar cuando pase a 'paid' o 'failed'
    if (localOrderId) {
      const orderDocRef = doc(db, "orders", localOrderId)
      
      unsubscribeRef.current = onSnapshot(orderDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const orderData = docSnap.data()
          const elapsed = Date.now() - startTime
          console.log(`%c⏱️ [T+${elapsed}ms] Firestore: paymentStatus="${orderData.paymentStatus}", estado="${orderData.estado}"`, "color: purple; font-weight: bold")

          // Si el backend aún no ha verificado el pago y ya tenemos el ID de Khipu guardado en Firestore, gatillamos verificación manual
          const providerPaymentId = orderData.paymentDetailsData?.providerPaymentId || orderData.paymentDetails?.providerPaymentId
          if (orderData.paymentStatus === "pending" && providerPaymentId) {
            startPolling(providerPaymentId)
          }

          if (orderData.paymentStatus === "paid") {
            const elapsed = Date.now() - startTime
            console.log(`%c✅ [T+${elapsed}ms] PAGO CONFIRMADO por Firestore. Mostrando pantalla verde.`, "color: green; font-weight: bold; font-size: 14px")
            console.timeEnd("⏱️ Khipu: tiempo total hasta confirmación")
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
            // Detener polling
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current)
              pollingIntervalRef.current = null
            }

            // Auto-redirección countdown: 5 segundos
            let count = 5
            const countInterval = setInterval(() => {
              count -= 1
              setCountdown(count)
              if (count <= 0) {
                clearInterval(countInterval)
                const isGuest = orderData.customerType === "guest"
                router.push(isGuest ? `/seguimiento-pedido/guest?email=${encodeURIComponent(orderData.cliente?.email || "")}` : "/pedidos")
              }
            }, 1000)
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

    // Si el paymentId ya vino en la URL de forma directa, disparar de inmediato
    if (paymentId && paymentId !== "null") {
      startPolling(paymentId)
    }

    // 3. Tras 75 segundos sin respuesta, redirigimos directamente al inicio
    const timeoutId = setTimeout(() => {
      if (loading) {
        const elapsed = Date.now() - startTime
        console.log(`%c⚠️ [T+${elapsed}ms] TIMEOUT de 75s alcanzado. Redirigiendo al inicio...`, "color: red; font-weight: bold")
        // Detener polling activo
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
          pollingIntervalRef.current = null
        }
        router.push("/")
      }
    }, 75000)

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
    }
  }, [searchParams, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes page-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .page-spinner {
            animation: page-spin 1s linear infinite !important;
          }
        `}} />
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="w-12 h-12 page-spinner text-pink-600" />
              <h2 className="text-xl font-semibold">
                {searchParams.get("cancel") === "true" ? "Método de pago cancelado" : "Procesando pago por transferencia..."}
              </h2>
              <p className="text-gray-600 text-center text-sm">
                {statusMessage}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Si no está cargando, ni tiene error, ni tiene resultado (caso timeout intermedio antes de redirigir)
  if (!loading && !error && !result) {
    router.push("/")
    return null
  }


  if (error && !result) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="w-6 h-6" />
              Transferencia Rechazada
            </CardTitle>
            <CardDescription>
              Información sobre tu pago en Khipu
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
                onClick={() => router.push("/pedidos")}
                className="flex-1 bg-pink-600 hover:bg-pink-700"
              >
                Ver mis pedidos
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
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg border-green-200 shadow-xl">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-3">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-green-700">
              ¡Transferencia Confirmada!
            </CardTitle>
            <CardDescription className="text-gray-600 text-base">
              Khipu concilió tu pago exitosamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Número de pedido</span>
                <span className="font-bold text-gray-800">#{result.orderNumber}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Monto transferido</span>
                <span className="font-bold text-gray-800">${result.amount?.toLocaleString("es-CL")}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Método de pago</span>
                <span className="font-bold text-gray-800">Transferencia (Khipu)</span>
              </div>
            </div>

            <p className="text-gray-600 text-sm text-center">
              Tu pedido ya está en camino a la cocina. ¡Preparando tu pizza! 🍕
            </p>

            {/* Countdown */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
              <p className="text-sm text-gray-500">
                Redirigiendo a tus pedidos en{" "}
                <span className="font-bold text-green-600 text-lg">{countdown}</span>{" "}segundos...
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => router.push(trackingUrl)}
                className="flex-1 bg-green-600 hover:bg-green-700 font-bold py-3 rounded-lg text-white"
              >
                Ver mis pedidos ahora
              </Button>
              <Button
                onClick={() => router.push("/")}
                variant="outline"
                className="flex-1 font-semibold"
              >
                Inicio
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
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes page-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .page-spinner {
            animation: page-spin 1s linear infinite !important;
          }
        `}} />
        <Loader2 className="w-12 h-12 page-spinner text-pink-600" />
      </div>
    }>
      <KhipuReturnContent />
    </Suspense>
  )
}


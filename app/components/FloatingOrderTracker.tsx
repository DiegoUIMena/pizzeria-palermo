"use client"

import { useEffect, useState, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { functions, db } from "@/lib/firebase"
import { httpsCallable } from "firebase/functions"
import { collection, query, where, onSnapshot } from "firebase/firestore"
import { MapPin, Package, CheckCircle, Clock } from "lucide-react"
import { useAuth } from "../context/AuthContext"

export default function FloatingOrderTracker() {
  const { user, isAuthenticated } = useAuth()
  const pathname = usePathname()
  const [trackingData, setTrackingData] = useState<{email: string; phone: string} | null>(null)
  const [activeOrder, setActiveOrder] = useState<any>(null)
  const [playedSound, setPlayedSound] = useState<Set<string>>(new Set())
  const [isRegisteredTracking, setIsRegisteredTracking] = useState(false)
  const [needUnlock, setNeedUnlock] = useState(false)

  const audioUnlockedRef = useRef(false)
  const isAdminRoute = pathname?.startsWith('/admin')

  // Desbloquear el canal de audio del cliente al primer clic o toque en cualquier parte del sitio
  // Esto permite que el navegador acepte reproducir la alerta sonora de pedido listo
  // de forma exitosa aun cuando el cliente tenga la pestaña en segundo plano más adelante.
  useEffect(() => {
    const unlockAudio = () => {
      if (audioUnlockedRef.current) return
      
      const silentAudio = new Audio('/notification.mp3')
      silentAudio.volume = 0
      silentAudio.play()
        .then(() => {
          audioUnlockedRef.current = true
          console.log("🔓 Canal de audio global del cliente desbloqueado por interacción");
        })
        .catch(() => {})

      window.removeEventListener('click', unlockAudio)
      window.removeEventListener('touchstart', unlockAudio)
    }

    window.addEventListener('click', unlockAudio)
    window.addEventListener('touchstart', unlockAudio)

    return () => {
      window.removeEventListener('click', unlockAudio)
      window.removeEventListener('touchstart', unlockAudio)
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated || isAdminRoute) {
      setTrackingData(null)
      return
    }

    const checkStorage = () => {
      const stored = localStorage.getItem('guestTrackingData')
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          if (parsed?.email && parsed?.phone) {
            setTrackingData(parsed)
          }
        } catch (e) { }
      } else {
        setTrackingData(null)
      }
    }

    checkStorage()
    window.addEventListener('storage', checkStorage)
    window.addEventListener('guestOrderCreated', checkStorage)

    // Backup en caso de que se nos escape el evento de localStorage
    const interval = setInterval(checkStorage, 5000)

    return () => {
      window.removeEventListener('storage', checkStorage)
      window.removeEventListener('guestOrderCreated', checkStorage)
      clearInterval(interval)
    }
  }, [isAuthenticated, isAdminRoute])

  useEffect(() => {
    if (!trackingData || isAuthenticated || isAdminRoute) return

    const fetchStatus = async () => {
      try {
        const getGuestOrderTracking = httpsCallable(functions, 'getGuestOrderTracking')
        const response = await getGuestOrderTracking({
          email: trackingData.email,
          phone: trackingData.phone,
        })
        const data = response.data as any
        const orders = Array.isArray(data?.orders) ? data.orders : []
        if (orders.length > 0) {
          // El backend ya filtra y ordena, por lo que el primer elemento es el más reciente
          setActiveOrder(orders[0])
          setIsRegisteredTracking(false)
        } else {
          // Si la orden ya no está activa (Entregada/Cancelada), se oculta el tracker
          setActiveOrder(null)
        }
      } catch (err) {
        console.error("Error fetching guest order tracking", err)
      }
    }

    fetchStatus()

    // Usar un Web Worker para ejecutar el sondeo (polling) en un hilo secundario.
    // Los navegadores no estrangulan los timers en Web Workers, por lo que el seguimiento
    // de invitados seguirá consultando fielmente cada 15 segundos incluso con la pestaña en segundo plano.
    let worker: Worker | null = null
    try {
      const code = `
        let timer = null;
        self.onmessage = function(e) {
          if (e.data === 'start') {
            if (timer) clearInterval(timer);
            timer = setInterval(() => {
              self.postMessage('tick');
            }, 15000);
          } else if (e.data === 'stop') {
            if (timer) clearInterval(timer);
          }
        }
      `
      const blob = new Blob([code], { type: 'application/javascript' })
      worker = new Worker(URL.createObjectURL(blob))
      worker.onmessage = (e) => {
        if (e.data === 'tick') {
          fetchStatus()
        }
      }
      worker.postMessage('start')
    } catch (e) {
      console.warn("No se pudo iniciar el Web Worker de tracking, usando fallback:", e)
    }

    const fallbackInterval = worker ? null : setInterval(fetchStatus, 15000)

    return () => {
      if (worker) {
        worker.postMessage('stop')
        worker.terminate()
      }
      if (fallbackInterval) {
        clearInterval(fallbackInterval)
      }
    }
  }, [trackingData, isAuthenticated, isAdminRoute])

  useEffect(() => {
    if (!isAuthenticated || !user?.id || isAdminRoute) return

    const q = query(
      collection(db, 'orders'),
      where('userId', '==', user.id),
      where('estado', 'in', ['Pago Pendiente', 'Pendiente', 'En preparación', 'En camino', 'Pedido Listo'])
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const activeOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        // Ordenar en el cliente por fecha de creación (los más recientes primero)
        activeOrders.sort((a: any, b: any) => {
          const timeA = a.timestamps?.created ? new Date(a.timestamps.created).getTime() : 0;
          const timeB = b.timestamps?.created ? new Date(b.timestamps.created).getTime() : 0;
          return timeB - timeA;
        })
        setActiveOrder(activeOrders[0])
        setIsRegisteredTracking(true)
      } else {
        setActiveOrder(null)
        setIsRegisteredTracking(false)
      }
    }, (err) => console.error("Error al escuchar pedidos del usuario:", err))

    return () => unsubscribe()
  }, [isAuthenticated, user?.id, isAdminRoute])

  // Reproducir alerta sonora cuando el pedido esté listo.
  // Se ignora si el cliente ya está en las páginas de seguimiento (/seguimiento o /pedidos)
  // para evitar echos/duplicaciones, ya que esas páginas tienen su propio reproductor de alertas.
  useEffect(() => {
    if (activeOrder) {
      const isTrackingPage = pathname?.includes('/seguimiento') || pathname?.includes('/pedidos')
      if (isTrackingPage) return

      const isReadyForPickup = activeOrder.tipoEntrega === 'Retiro' && activeOrder.estado === 'Pedido Listo'
      const isReadyForDelivery = activeOrder.tipoEntrega === 'Delivery' && activeOrder.estado === 'En camino'

      if ((isReadyForPickup || isReadyForDelivery) && !playedSound.has(activeOrder.id)) {
        const audio = new Audio('/notification.mp3')
        audio.play()
          .then(() => {
            // Solo marcar como reproducido tras tener éxito
            setPlayedSound(prev => new Set(prev).add(activeOrder.id))
            setNeedUnlock(false)
            
            audio.onended = () => {
              setTimeout(() => {
                const secondAudio = new Audio('/notification.mp3')
                secondAudio.play().catch(e => console.log('Autoplay blocked second time in tracker:', e))
              }, 1500)
            }
          })
          .catch(e => {
            console.log('Autoplay de alerta de pedido bloqueado en tracker, reintentará en interacción:', e)
            setNeedUnlock(true)
          })
      }
    }
  }, [activeOrder, playedSound, pathname])

  // Ejecutar alarma fallida inmediatamente al primer toque si quedó pendiente
  useEffect(() => {
    if (!needUnlock || !activeOrder) return

    const unlockAndPlay = () => {
      const isReadyForPickup = activeOrder.tipoEntrega === 'Retiro' && activeOrder.estado === 'Pedido Listo'
      const isReadyForDelivery = activeOrder.tipoEntrega === 'Delivery' && activeOrder.estado === 'En camino'

      if ((isReadyForPickup || isReadyForDelivery) && !playedSound.has(activeOrder.id)) {
        const audio = new Audio('/notification.mp3')
        audio.play()
          .then(() => {
            setPlayedSound(prev => new Set(prev).add(activeOrder.id))
            setNeedUnlock(false)
            console.log("🔊 Alerta de pedido flotante reproducida tras interacción de desbloqueo")
            
            audio.onended = () => {
              setTimeout(() => {
                const secondAudio = new Audio('/notification.mp3')
                secondAudio.play().catch(e => console.log('Autoplay blocked second time:', e))
              }, 1500)
            }
          })
          .catch(e => console.warn('Bloqueado aún tras click:', e))
      }
    }

    const handler = () => {
      unlockAndPlay()
      window.removeEventListener('click', handler)
      window.removeEventListener('touchstart', handler)
    }

    window.addEventListener('click', handler)
    window.addEventListener('touchstart', handler)

    return () => {
      window.removeEventListener('click', handler)
      window.removeEventListener('touchstart', handler)
    }
  }, [needUnlock, activeOrder, playedSound])

  const isPaymentProcessingRoute = pathname?.startsWith('/pago')

  if (isAdminRoute || isPaymentProcessingRoute || !activeOrder) return null


  const isReady = (activeOrder.tipoEntrega === 'Retiro' && activeOrder.estado === 'Pedido Listo') || 
                  (activeOrder.tipoEntrega === 'Delivery' && activeOrder.estado === 'En camino')

  const getIcon = () => {
    if (isReady) return <CheckCircle className="w-5 h-5 text-green-600" />
    if (activeOrder.estado === 'En preparación') return <Package className="w-5 h-5 text-pink-600" />
    if (activeOrder.estado === 'Pendiente' || activeOrder.estado === 'Pago Pendiente') return <Clock className="w-5 h-5 text-yellow-600" />
    return <MapPin className="w-5 h-5 text-pink-600" />
  }

  const getStatusText = () => {
    if (isReady) return "¡Pedido listo!"
    return "Seguimiento del pedido aquí"
  }

  const getTrackingLink = () => {
    if (isRegisteredTracking || !trackingData) return `/seguimiento?id=${activeOrder.id}`
    return `/seguimiento-pedido/guest?email=${encodeURIComponent(trackingData.email)}&phone=${encodeURIComponent(trackingData.phone)}`
  }

  return (
    <div className={`fixed right-6 bottom-24 md:bottom-32 z-40 transition-all duration-500 ease-in-out ${isReady ? '' : 'animate-in slide-in-from-bottom-8'}`}>
      <Link href={getTrackingLink()}>
        <div className={`relative flex items-center gap-3 p-3 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.15)] border cursor-pointer hover:scale-105 transition-all duration-300 ${isReady ? 'bg-green-100 border-green-400' : 'bg-white border-pink-300 hover:border-pink-500'}`}>
          <div className={`flex items-center justify-center w-10 h-10 rounded-full ${isReady ? 'bg-green-200' : 'bg-pink-100'}`}>
            {getIcon()}
          </div>
          <div className="pr-3">
            <p className={`text-sm font-bold ${isReady ? 'text-green-800' : 'text-pink-700'}`}>
              {getStatusText()}
            </p>
            <p className="text-xs text-gray-600 font-medium truncate max-w-[150px]">
              Estado: {activeOrder.estado}
            </p>
          </div>
          
          {/* Pequeño triángulo apuntando hacia abajo (efecto globo de diálogo hacia el chatbot) */}
          <div className={`absolute -bottom-2 right-4 md:right-8 w-4 h-4 transform rotate-45 border-b border-r ${isReady ? 'bg-green-100 border-green-400' : 'bg-white border-pink-300'}`}></div>
        </div>
      </Link>
    </div>
  )
}
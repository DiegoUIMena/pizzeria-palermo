"use client"

import { useEffect, useState } from "react"
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

  const isAdminRoute = pathname?.startsWith('/admin')

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
    const intervalId = setInterval(fetchStatus, 15000)

    return () => clearInterval(intervalId)
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

  useEffect(() => {
    if (activeOrder) {
      const isReadyForPickup = activeOrder.tipoEntrega === 'Retiro' && activeOrder.estado === 'Pedido Listo'
      const isReadyForDelivery = activeOrder.tipoEntrega === 'Delivery' && activeOrder.estado === 'En camino'

      if ((isReadyForPickup || isReadyForDelivery) && !playedSound.has(activeOrder.id)) {
        const audio = new Audio('/notification.mp3')
        audio.play().catch(e => console.log('Autoplay blocked:', e))
        
        setPlayedSound(prev => new Set(prev).add(activeOrder.id))
      }
    }
  }, [activeOrder, playedSound])

  if (isAdminRoute || !activeOrder) return null

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
    <div className={`fixed right-6 bottom-24 md:bottom-32 z-40 transition-all duration-500 ease-in-out ${isReady ? 'animate-bounce' : 'animate-in slide-in-from-bottom-8'}`}>
      <Link href={getTrackingLink()}>
        <div className={`relative flex items-center gap-3 p-3 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.15)] border cursor-pointer hover:scale-105 transition-all duration-300 ${isReady ? 'bg-green-100 border-green-400 animate-pulse' : 'bg-white border-pink-300 hover:border-pink-500'}`}>
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
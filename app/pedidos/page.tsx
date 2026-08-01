"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Package, Clock, CheckCircle, Truck, ChevronDown, ChevronUp, Utensils, RefreshCcw, Sparkles, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react"
import Header from "../components/Header"
import Footer from "../components/Footer"
import { useAuth } from "../context/AuthContext"
import { useCart } from "../context/CartContext"
import { toast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { useFormattedOrders } from "../../hooks/useUserOrders"
import { FormattedOrder as Order, OrderItem } from "../../lib/types"
import { getImagePath } from "../components/PromoSection"
import { useFirestorePizzaConfig } from "../../hooks/useFirestorePizzaConfig"
import { db, functions } from "@/lib/firebase"
import { doc, collection, query, onSnapshot } from "firebase/firestore"
import { httpsCallable } from "firebase/functions"

export default function PedidosPage() {
  const router = useRouter()
  const { isAuthenticated, user } = useAuth()
  const { addItem } = useCart()
  const [isRedirecting, setIsRedirecting] = useState(false)
  // Estado para controlar qué pedidos están expandidos
  const [expandedOrders, setExpandedOrders] = useState<{ [key: string]: boolean }>({})
  const [playedSound, setPlayedSound] = useState<Set<string>>(new Set())
  const [needUnlock, setNeedUnlock] = useState(false)
  const audioUnlockedRef = useRef(false)
  const { itemsMenu } = useFirestorePizzaConfig()

  // Estados locales para el catálogo de canjes y puntos
  const [catalogoCanjes, setCatalogoCanjes] = useState<any[]>([])
  const [userPoints, setUserPoints] = useState<number | null>(null)
  
  // Estados para las modales
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [redeemedProducts, setRedeemedProducts] = useState<any[]>([])
  const [pointsNeeded, setPointsNeeded] = useState(0)
  const [userCurrentPoints, setUserCurrentPoints] = useState(0)
  const [isProcessingReorder, setIsProcessingReorder] = useState(false)
  const [reorderingOrderId, setReorderingOrderId] = useState<string | null>(null)

  // Cargar catálogo de canje para buscar IDs
  useEffect(() => {
    const q = query(collection(db, "puntos_palermo_catalogo"))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setCatalogoCanjes(fetched)
    }, (error) => {
      console.error("Error al cargar catálogo en pedidos:", error)
    })
    return () => unsubscribe()
  }, [])

  // Cargar puntos en tiempo real del usuario
  useEffect(() => {
    if (user?.id) {
      const userRef = doc(db, 'users', user.id)
      const unsubscribe = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
          setUserPoints(docSnap.data().totalPoints || 0)
        } else {
          setUserPoints(0)
        }
      }, (error) => {
        console.error("Error al cargar puntos del usuario en pedidos:", error)
      })
      return () => unsubscribe()
    }
  }, [user])

  // Función para expandir/contraer un pedido
  const toggleOrderExpansion = (orderId: string) => {
    setExpandedOrders(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }))
  }

  // Función para volver a pedir exactamente lo mismo
  const handleReorder = async (order: Order) => {
    console.log("=== Click en Pedir Otra Vez ===");
    console.log("Orden ID:", order.id, "documentId:", order.documentId);
    if (isProcessingReorder) {
      console.log("Ya se está procesando un reorder, ignorando clic.");
      return;
    }

    // Activar estados de procesamiento de inmediato para retroalimentación instantánea
    setIsProcessingReorder(true);
    setReorderingOrderId(order.documentId || order.id);
    console.log("Estados de carga activados al inicio:", { isProcessingReorder: true, reorderingOrderId: order.documentId || order.id });

    const normalItems: any[] = [];
    const canjeItems: any[] = [];

    order.items.forEach((item: any) => {
      if (item.isCanje) {
        canjeItems.push(item);
      } else {
        normalItems.push(item);
      }
    });

    // 1. Si hay items de canje, validar puntos y procesar
    if (canjeItems.length > 0) {
      if (!user) {
        toast({
          title: "Inicia sesión",
          description: "Debes iniciar sesión para volver a canjear productos.",
          variant: "destructive"
        });
        setIsProcessingReorder(false);
        setReorderingOrderId(null);
        return;
      }

      // Buscar coincidencia en el catálogo
      const matchedCanjes: Array<{ catalogProduct: any; item: any; quantity: number }> = [];
      let totalPointsNeeded = 0;

      for (const item of canjeItems) {
        const originalName = item.name || item.nombre || "";
        // Limpiar el nombre quitando " (PP)" al final
        const cleanName = originalName.replace(/\s*\(PP\)\s*$/gi, "").trim();
        const quantity = item.quantity || 1;

        // Buscar por nombre
        const matched = catalogoCanjes.find((prod: any) => {
          const pName = (prod.nombre || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
          const cName = cleanName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
          return pName === cName || pName.includes(cName) || cName.includes(pName);
        });

        if (matched) {
          matchedCanjes.push({
            catalogProduct: matched,
            item,
            quantity
          });
          totalPointsNeeded += (matched.puntos || matched.points || item.canjePoints || 0) * quantity;
        } else {
          // Si no se encuentra en el catálogo, usar los puntos del item
          console.warn(`No se encontró "${cleanName}" en el catálogo. Usando fallback.`);
          const points = (item.canjePoints || 0);
          matchedCanjes.push({
            catalogProduct: {
              id: null,
              nombre: cleanName,
              puntos: points,
              imagenUrl: item.image || item.imagen || "/placeholder.svg"
            },
            item,
            quantity
          });
          totalPointsNeeded += points * quantity;
        }
      }

      const currentPoints = userPoints !== null ? userPoints : 0;

      // Caso Negativo: Puntos insuficientes
      if (currentPoints < totalPointsNeeded) {
        setPointsNeeded(totalPointsNeeded);
        setUserCurrentPoints(currentPoints);
        setShowErrorModal(true);
        // Restablecer el estado de carga
        setIsProcessingReorder(false);
        setReorderingOrderId(null);
        return;
      }

      // Caso Positivo: Puntos suficientes
      console.log("Puntos suficientes. Iniciando procesamiento de canje...");
      const newlyRedeemed: any[] = [];

      try {
        const redeemCatalogProductFn = httpsCallable(functions, 'redeemCatalogProduct');

        for (const mc of matchedCanjes) {
          const { catalogProduct, quantity } = mc;
          
          // Repetir el canje según la cantidad indicada en el historial
          for (let i = 0; i < quantity; i++) {
            let resData: any = { success: true };
            
            // Si el producto fue emparejado en el catálogo, hacemos el descuento de puntos real
            if (catalogProduct.id) {
              const result = await redeemCatalogProductFn({ productId: catalogProduct.id });
              resData = result.data as any;
            }

            if (resData.success) {
              // Agregar al carrito con costo 0
              addItem({
                id: `canje-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                name: catalogProduct.nombre,
                price: 0,
                image: resData.imagenUrl || catalogProduct.imagenUrl || '/placeholder.svg',
                quantity: 1,
                isCanje: true,
                canjePoints: resData.puntosCost || catalogProduct.puntos,
              });

              newlyRedeemed.push({
                nombre: catalogProduct.nombre,
                puntos: resData.puntosCost || catalogProduct.puntos,
                imagenUrl: resData.imagenUrl || catalogProduct.imagenUrl || '/placeholder.svg'
              });
            } else {
              throw new Error(resData.error || "No se pudo realizar el canje en lote.");
            }
          }
        }

        // Agregar los items normales
        normalItems.forEach((item: any) => {
          addNormalItemToCart(item);
        });

        // Mostrar la modal de éxito y pausar unos segundos
        setRedeemedProducts(newlyRedeemed);
        setShowSuccessModal(true);

        setTimeout(() => {
          setShowSuccessModal(false);
          setIsProcessingReorder(false);
          setReorderingOrderId(null);
          router.push("/");
        }, 5000); // 5 segundos informando al cliente
        
      } catch (error: any) {
        console.error("Error al procesar reorder con canjes:", error);
        toast({
          title: "Error al procesar",
          description: error?.message || "Hubo un problema al realizar los canjes. Inténtalo de nuevo.",
          variant: "destructive"
        });
        setIsProcessingReorder(false);
        setReorderingOrderId(null);
      }
    } else {
      // 2. Si es un pedido normal sin canjes, agregamos todo directamente
      console.log("Pedido normal sin canjes detectado. Procesando...");
      setIsProcessingReorder(true);
      setReorderingOrderId(order.id);
      console.log("Estados establecidos para pedido normal - isProcessingReorder: true, reorderingOrderId:", order.id);

      order.items.forEach((item: any) => {
        addNormalItemToCart(item);
      });

      toast({
        title: "¡Productos agregados!",
        description: "El pedido ha sido copiado a tu carrito de compras.",
      });

      console.log("Productos normales agregados localmente al carrito. Redirigiendo a home...");
      router.push("/");

      setTimeout(() => {
        setIsProcessingReorder(false);
        setReorderingOrderId(null);
        console.log("Estados de reorder limpiados para pedido normal.");
      }, 1000);
    }
  };

  // Función interna para agregar items normales
  const addNormalItemToCart = (item: any) => {
    let finalImage = item.image || item.imagen;
    
    const originalName = item.name || item.nombre || "";
    const lowerName = originalName.toLowerCase();
    const cleanPizzaName = originalName
      .replace(/^pizza\s+/i, "")
      .replace(/\s*\((Familiar|Mediana|Personal|Grande)\)/gi, '').trim();

    // Normalizar nombre para comparación flexible (quita acentos, tamaños, "cc", etc.)
    const normalizeName = (n: string) =>
      n.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\s*(350cc|1\.5\s*litro|zero|tradicional|lata|botella)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();

    let menuItem = null;
    if (item.selectedMenuPizza && item.selectedMenuPizza !== "base") {
      menuItem = itemsMenu.find((m: any) => m.nombre?.toLowerCase() === item.selectedMenuPizza.toLowerCase());
    } else {
      // 1. Exacto
      menuItem = itemsMenu.find((m: any) => m.nombre?.toLowerCase() === cleanPizzaName.toLowerCase());
      // 2. Fuzzy: comparar nombres normalizados (ignora tamaño, Zero, 350cc, etc.)
      if (!menuItem) {
        const normClean = normalizeName(cleanPizzaName);
        menuItem = itemsMenu.find((m: any) => {
          const normMenu = normalizeName(m.nombre || "");
          return normMenu === normClean || normMenu.includes(normClean) || normClean.includes(normMenu);
        });
      }
    }
    
    if (menuItem && menuItem.imagen && menuItem.imagen.includes('firebasestorage.googleapis.com')) {
      finalImage = menuItem.imagen;
    } else if (lowerName.includes("duo")) {
      finalImage = "/pizzas/palermo.jpg";
    } else if (lowerName.includes("premium") && cleanPizzaName.toLowerCase().includes("premium")) {
      finalImage = "/pizzas/doble muzza.jpg";
    } else if ((lowerName.includes("promo") || lowerName.includes("personalizada")) && cleanPizzaName.toLowerCase().includes("promo")) {
      finalImage = "/pizzas/palermo.jpg";
    } else {
      // Pasar el nombre original (con "Zero", "350cc", etc.) para que getImagePath
      // use su propio mapeo de bebidas/acompañamientos correctamente
      finalImage = getImagePath(originalName, item.image || item.imagen);
    }

    const { image, imagen, name, nombre, ...cleanItem } = item;
    
    addItem({
      ...cleanItem,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: originalName,
      image: finalImage,
    } as any);
  };


  // Usar el hook para obtener pedidos del usuario
  const { orders, isLoading, error } = useFormattedOrders(user?.id)

  // Limitar la visualización a los últimos 3 pedidos realizados
  const displayedOrders = orders.slice(0, 3)

  // Efecto para manejar la autenticación
  useEffect(() => {
    if (!isAuthenticated) {
      setIsRedirecting(true)
      router.push("/auth")
    }
  }, [isAuthenticated, router])

  // Mostrar error si hay algún problema
  useEffect(() => {
    if (error) {
      console.error('Error loading orders:', error)
    }
  }, [error])

  // Desbloquear canal de audio al primer clic o toque en la pantalla
  useEffect(() => {
    const unlockAudio = () => {
      if (audioUnlockedRef.current) return
      const silentAudio = new Audio('/notification.mp3')
      silentAudio.volume = 0
      silentAudio.play()
        .then(() => {
          audioUnlockedRef.current = true
          console.log("🔓 Canal de audio del cliente (pedidos page) desbloqueado por interacción")
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

  // Reproducir sonido cuando el pedido alcanza su estado final de entrega
  useEffect(() => {
    orders.forEach(order => {
      const isReadyForPickup = order.deliveryType === 'Retiro' && order.status === 'Pedido Listo'
      const isReadyForDelivery = order.deliveryType === 'Delivery' && order.status === 'En camino'

      if ((isReadyForPickup || isReadyForDelivery) && !playedSound.has(order.id)) {
        const audio = new Audio('/notification.mp3')
        audio.play()
          .then(() => {
            // Guardar en playedSound solo si se reproduce correctamente
            setPlayedSound(prev => new Set(prev).add(order.id))
            audio.onended = () => {
              setTimeout(() => {
                const secondAudio = new Audio('/notification.mp3')
                secondAudio.play().catch(e => console.log('Autoplay de audio bloqueado por el navegador (segunda vez):', e))
              }, 1500)
            }
          })
          .catch(e => {
            console.log('Autoplay de audio bloqueado por el navegador, activando fallback:', e)
            setNeedUnlock(true)
          })
      }
    })
  }, [orders, playedSound])

  // Fallback para desbloquear y reproducir audio al primer clic/toque del usuario si se bloqueó
  useEffect(() => {
    if (!needUnlock) return

    const playAudioFallback = () => {
      orders.forEach(order => {
        const isReadyForPickup = order.deliveryType === 'Retiro' && order.status === 'Pedido Listo'
        const isReadyForDelivery = order.deliveryType === 'Delivery' && order.status === 'En camino'

        if ((isReadyForPickup || isReadyForDelivery) && !playedSound.has(order.id)) {
          const audio = new Audio('/notification.mp3')
          audio.play()
            .then(() => {
              console.log("✅ Audio reproducido exitosamente tras interacción en pedidos (fallback)")
              setPlayedSound(prev => new Set(prev).add(order.id))
              setNeedUnlock(false)
              audio.onended = () => {
                setTimeout(() => {
                  const secondAudio = new Audio('/notification.mp3')
                  secondAudio.play().catch(e => console.log('Autoplay fallback segunda vez bloqueado:', e))
                }, 1500)
              }
            })
            .catch(e => {
              console.log("Fallo al reproducir audio en fallback:", e)
            })
        }
      })
    }

    const unlockHandler = () => {
      playAudioFallback()
      window.removeEventListener('click', unlockHandler)
      window.removeEventListener('touchstart', unlockHandler)
    }

    window.addEventListener('click', unlockHandler)
    window.addEventListener('touchstart', unlockHandler)

    return () => {
      window.removeEventListener('click', unlockHandler)
      window.removeEventListener('touchstart', unlockHandler)
    }
  }, [needUnlock, orders, playedSound])

  const getStatusIcon = (status: Order["status"]) => {
    switch (status) {
      case "Pago Pendiente":
        return <Clock className="w-5 h-5 text-yellow-500" />
      case "Pago Rechazado":
        return <Clock className="w-5 h-5 text-red-700" />
      case "Pendiente":
        return <Clock className="w-5 h-5 text-gray-500" />
      case "En preparación":
        return <Package className="w-5 h-5 text-pink-400" />
      case "En camino":
        return <Truck className="w-5 h-5 text-pink-500" />
      case "Pedido Listo":
        return <CheckCircle className="w-5 h-5 text-green-400" />
      case "Entregado":
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case "Cancelado":
        return <Clock className="w-5 h-5 text-red-500" />
      default:
        return <Clock className="w-5 h-5 text-gray-500" />
    }
  }

  const getStatusColor = (status: Order["status"]) => {
    switch (status) {
      case "Pago Pendiente":
        return "bg-yellow-500"
      case "Pago Rechazado":
        return "bg-red-700"
      case "Pendiente":
        return "bg-gray-500"
      case "En preparación":
        return "bg-pink-400"
      case "En camino":
        return "bg-pink-500"
      case "Pedido Listo":
        return "bg-green-400"
      case "Entregado":
        return "bg-green-600"
      case "Cancelado":
        return "bg-red-500"
      default:
        return "bg-gray-500"
    }
  }

  // Mostrar loading mientras se redirige o no hay usuario
  if (!isAuthenticated || isRedirecting) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-12">
          <div className="max-w-3xl mx-auto text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando...</p>
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
        <div className="max-w-3xl mx-auto">
          {/* Cabecera de la sección en contenedor legible */}
          <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 mb-8">
            <Link href="/" className="inline-flex items-center text-gray-600 mb-4 hover:text-pink-600 transition-colors text-sm font-medium">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al inicio
            </Link>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Mis Pedidos</h1>
            <p className="text-gray-600 text-sm md:text-base">Historial de tus pedidos y su estado</p>
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500 mx-auto mb-4"></div>
              <p className="text-gray-600">Cargando tus pedidos...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {displayedOrders.length > 0 ? (
                displayedOrders.map((order, index) => (
                  <Card key={`${order.id}-${index}`} className={`border-gray-200 hover:shadow-md transition-shadow ${expandedOrders[order.id] ? 'border-pink-200 shadow-md' : ''}`}>
                    <CardHeader className={`border-b border-gray-200 ${expandedOrders[order.id] ? 'bg-pink-50' : 'bg-gray-50'}`}>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg text-gray-800 flex items-center gap-2">
                          {getStatusIcon(order.status)}
                          Pedido {order.id}
                          {order.deliveryType === "Delivery" ? (
                            <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-800">
                              <Truck className="h-3 w-3 mr-1" /> Delivery
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="ml-2 bg-amber-100 text-amber-800">
                              <Utensils className="h-3 w-3 mr-1" /> Retiro
                            </Badge>
                          )}
                        </CardTitle>
                        <Badge className={`${getStatusColor(order.status)} text-white`}>{order.status}</Badge>
                      </div>
                      <div className="text-gray-500 text-sm">{order.date}</div>
                    </CardHeader>
                    <CardContent className="pt-4">
                      {/* 💳 NOTIFICACIÓN DE REEMBOLSO */}
                      {order.paymentStatus === "refunded" && order.refundInfo && (
                        <div className="mb-4 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-md">
                          <div className="flex items-start">
                            <div className="flex-shrink-0">
                              <svg className="h-5 w-5 text-blue-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <div className="ml-3 flex-1">
                              <h3 className="text-sm font-medium text-blue-800">
                                💳 Pedido Reembolsado
                              </h3>
                              <div className="mt-2 text-sm text-blue-700">
                                <p className="mb-2">Este pedido fue cancelado y se procesó el reembolso automáticamente:</p>
                                <ul className="list-disc list-inside space-y-1 text-xs">
                                  <li><strong>Monto:</strong> ${order.refundInfo.amount.toLocaleString("es-CL")}</li>
                                  <li><strong>Fecha:</strong> {new Date(order.refundInfo.refundedAt).toLocaleString("es-CL", {
                                    dateStyle: "long",
                                    timeStyle: "short"
                                  })}</li>
                                  <li><strong>Método:</strong> {order.refundInfo.refundType === "production" ? "Transbank" : "Desarrollo"}</li>
                                </ul>
                                <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                                  <p className="font-medium text-yellow-800">⏱️ Tiempos estimados de devolución:</p>
                                  <p className="text-yellow-700 mt-1">• Tarjeta de Crédito: 1-3 días hábiles</p>
                                  <p className="text-yellow-700">• Tarjeta de Débito: 1-2 días hábiles</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <div className="space-y-3">
                        {/* Productos */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <h4 className="text-gray-700 font-medium">Productos:</h4>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="p-0 h-auto text-gray-500 hover:text-pink-600"
                              onClick={() => toggleOrderExpansion(order.id)}
                            >
                              {expandedOrders[order.id] ? (
                                <span className="flex items-center">Ver menos <ChevronUp className="ml-1 h-4 w-4" /></span>
                              ) : (
                                <span className="flex items-center">Ver detalles <ChevronDown className="ml-1 h-4 w-4" /></span>
                              )}
                            </Button>
                          </div>
                          
                          {/* Vista resumida (siempre visible) */}
                          {order.items.map((item, index) => (
                            <div key={index} className="flex justify-between text-sm">
                              <span className="text-gray-600 flex items-center">
                                {item.quantity}x {item.name}
                              {item.size && !item.name.toLowerCase().includes(String(item.size).toLowerCase()) && <span className="ml-1 text-xs text-gray-500">({item.size})</span>}
                              </span>
                              <span className="text-gray-800">${item.price.toLocaleString()}</span>
                            </div>
                          ))}
                          
                          {/* Detalles expandibles */}
                          {expandedOrders[order.id] && (
                            <div className="mt-3 bg-gray-50 p-3 rounded-md text-sm">
                              <h5 className="font-medium text-gray-700 mb-2">Detalles completos:</h5>
                              
                              {/* Información de entrega y pago */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 pb-3 border-b border-gray-200">
                                {/* Método de pago */}
                                {order.paymentMethod && (
                                  <div className="text-xs">
                                    <span className="font-medium text-gray-700">Método de pago:</span>{" "}
                                    {order.paymentMethod}
                                  </div>
                                )}
                                
                                {/* Dirección de entrega (solo si es delivery) */}
                                {order.deliveryType === "Delivery" && order.deliveryAddress && (
                                  <div className="text-xs">
                                    <span className="font-medium text-gray-700">Dirección:</span>{" "}
                                    {order.deliveryAddress.calle} {order.deliveryAddress.numero}, {order.deliveryAddress.comuna}
                                    {order.deliveryAddress.referencia && (
                                      <div className="mt-1">
                                        <span className="font-medium text-gray-700">Referencia:</span>{" "}
                                        {order.deliveryAddress.referencia}
                                      </div>
                                    )}
                                  </div>
                                )}
                                
                                {/* Notas generales del pedido */}
                                {order.notes && (
                                  <div className="text-xs col-span-full">
                                    <span className="font-medium text-gray-700">Notas del pedido:</span>{" "}
                                    {order.notes}
                                  </div>
                                )}
                              </div>
                              
                              {order.items.map((item, index) => (
                                <div key={`detail-${index}`} className="mb-4 pb-3 border-b border-gray-200 last:border-0 last:pb-0">
                                  <div className="flex justify-between mb-2">
                                    <span className="font-medium text-gray-800">
                                      {item.quantity}x {item.name}
                                      {item.size && !item.name.toLowerCase().includes(String(item.size).toLowerCase()) && <span className="ml-1">({item.size})</span>}
                                      {item.pizzaType && <span className="ml-1 text-xs bg-pink-100 text-pink-800 px-1.5 py-0.5 rounded">{item.pizzaType}</span>}
                                    </span>
                                    <span className="font-medium">${item.price.toLocaleString()}</span>
                                  </div>
                                  
                                  {/* Detalles específicos del ítem */}
                                  <div className="ml-4 text-xs text-gray-600 space-y-1">
                                    {/* Ingredientes */}
                                    {item.ingredients && item.ingredients.length > 0 && (
                                      <div>
                                        <span className="font-medium text-gray-700">Ingredientes:</span>{" "}
                                        {item.ingredients.join(", ")}
                                      </div>
                                    )}
                                    
                                    {/* Ingredientes premium */}
                                    {item.premiumIngredients && item.premiumIngredients.length > 0 && (
                                      <div>
                                        <span className="font-medium text-gray-700">Ingredientes Premium:</span>{" "}
                                        {item.premiumIngredients.join(", ")}
                                      </div>
                                    )}
                                    
                                    {/* Salsas */}
                                    {item.sauces && item.sauces.length > 0 && (
                                      <div>
                                        <span className="font-medium text-gray-700">Salsas:</span>{" "}
                                        {item.sauces.join(", ")}
                                      </div>
                                    )}
                                    
                                    {/* Bebidas */}
                                    {item.drinks && item.drinks.length > 0 && (
                                      <div>
                                        <span className="font-medium text-gray-700">Bebidas:</span>{" "}
                                        {item.drinks.join(", ")}
                                      </div>
                                    )}
                                    
                                    {/* Extras */}
                                    {item.extras && item.extras.length > 0 && (
                                      <div>
                                        <span className="font-medium text-gray-700">Extras:</span>{" "}
                                        {item.extras.join(", ")}
                                      </div>
                                    )}
                                    
                                    {/* Personalizaciones - SIN orégano, queso o salsa */}
                                    {(item.sinOregano || item.sinQueso || item.sinSalsaTomate) && (
                                      <div className="mt-2 p-2 bg-yellow-50 border border-yellow-300 rounded">
                                        <span className="font-semibold text-yellow-800">⚠️ PERSONALIZACIÓN:</span>
                                        <ul className="list-disc ml-5 mt-1 text-yellow-900 font-medium">
                                          {item.sinOregano && <li>🚫 SIN ORÉGANO</li>}
                                          {item.sinQueso && <li>🚫 SIN QUESO</li>}
                                          {item.sinSalsaTomate && <li>🚫 SIN SALSA TOMATE</li>}
                                        </ul>
                                      </div>
                                    )}
                                    
                                    {/* Comentarios */}
                                    {item.comments && (
                                      <div className="mt-1 pt-1 border-t border-dotted border-gray-200">
                                        <span className="font-medium text-gray-700">Comentarios:</span>{" "}
                                        {item.comments}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          <div className="border-t border-gray-200 mt-2 pt-3 flex flex-col sm:flex-row justify-between items-center gap-3">
                            <div className="flex justify-between w-full sm:w-auto gap-2 font-bold text-lg">
                              <span className="text-gray-800">Total:</span>
                              <span className="text-pink-600">${order.total.toLocaleString()}</span>
                            </div>
                            <Button 
                              onClick={() => handleReorder(order)}
                              disabled={isProcessingReorder}
                              className="w-full sm:w-auto bg-pink-600 text-white hover:bg-pink-700 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                              <RefreshCcw className={`w-4 h-4 mr-2 ${(reorderingOrderId === order.documentId || reorderingOrderId === order.id) ? 'force-spin animate-spin' : ''}`} />
                              {(reorderingOrderId === order.documentId || reorderingOrderId === order.id) ? 'Procesando...' : 'Pedir otra vez'}
                            </Button>
                          </div>
                        </div>

                        {/* Tiempo estimado según el estado del pedido */}
                        {(() => {
                          const showSuccessAnimation = (order.deliveryType === 'Retiro' && order.status === "Pedido Listo") || (order.deliveryType === 'Delivery' && order.status === "En camino");
                          return (order.status === "Pendiente" || order.status === "En preparación" || order.status === "En camino" || order.status === "Pedido Listo") && (
                          <div className={`p-4 rounded-lg border transition-all ${showSuccessAnimation ? 'bg-green-50 border-green-300' : order.status === 'Pedido Listo' ? 'bg-green-50 border-green-200' : 'bg-pink-50 border-pink-200'}`}>
                            {showSuccessAnimation && (
                              <div className="flex flex-col items-center justify-center text-center mb-4 pt-2 animate-in fade-in zoom-in duration-500">
                                <div className="text-5xl mb-2 animate-bounce">👍🏻</div>
                                <h3 className="text-lg font-bold text-green-800 mb-1">¡Excelente!</h3>
                                <p className="text-md text-green-700 font-medium">
                                  {order.deliveryType === 'Retiro' 
                                    ? "Ya puedes pasar a retirar tu pedido."
                                    : "Tu pedido está en camino, llegará en minutos."}
                                </p>
                              </div>
                            )}
                            <div className={`flex items-center justify-between ${showSuccessAnimation || order.status === 'Pedido Listo' ? 'text-green-700' : 'text-pink-700'}`}>
                              <div className="flex items-center">
                                <Clock className="h-4 w-4 mr-2" />
                                {order.status === "Pendiente" && (
                                  <div>
                                    <span className="font-medium">Tiempo de preparación estimado: {order.hasEstimatedTime ? order.estimatedTime : ""}</span>
                                  </div>
                                )}
                                {order.status === "En preparación" && (
                                  <div>
                                    <span className="font-medium">Tiempo estimado de preparación: {order.hasEstimatedTime ? order.estimatedTime : ""}</span>
                                  </div>
                                )}
                                {order.status === "En camino" && (
                                  <div>
                                    <span className="font-medium">Tiempo estimado de entrega: {order.hasEstimatedTime ? order.estimatedTime : ""}</span>
                                  </div>
                                )}
                                {order.status === "Pedido Listo" && order.deliveryType === "Retiro" && (
                                  <span className="font-medium">¡Su pedido está listo para retirar en el local!</span>
                                )}
                                {order.status === "Pedido Listo" && order.deliveryType === "Delivery" && (
                                  <span className="font-medium">¡Su pedido está listo y pronto saldrá para entrega!</span>
                                )}
                              </div>
                              
                              {/* Botón de seguimiento para pedidos activos */}
                              {(order.status === "Pendiente" || order.status === "En preparación" || order.status === "En camino") && (
                                <Link 
                                  href={`/seguimiento?id=${order.documentId}`}
                                  className="bg-white text-pink-600 text-xs px-3 py-1.5 rounded-full border border-pink-200 hover:bg-pink-50 transition-colors"
                                >
                                  Seguir pedido
                                </Link>
                              )}
                            </div>
                          </div>
                        )
                        })()}
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-12">
                  <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">No tienes pedidos aún</h3>
                  <p className="text-gray-500 mb-6">
                    Cuando realices un pedido, aparecerá aquí para que puedas seguir su progreso.
                  </p>
                  <Link href="/">
                    <Button className="bg-pink-600 text-white hover:bg-pink-700">Ver Productos</Button>
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Modal de éxito de canje (reorder) */}
      {showSuccessModal && redeemedProducts.length > 0 && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border-2 border-pink-100 shadow-2xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="inline-block bg-pink-100 p-4 rounded-full text-pink-600 shadow-md">
              <CheckCircle2 className="w-10 h-10 animate-bounce text-pink-600" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-black text-gray-900 tracking-tight leading-tight">
                ¡Canje Realizado Exitosamente!
              </h3>
              <p className="text-gray-600 text-sm font-semibold leading-relaxed">
                Se han descontado los puntos de tu cuenta y los productos se agregaron al carrito.
              </p>
            </div>

            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {redeemedProducts.map((prod, idx) => (
                <div key={idx} className="bg-pink-50/50 border border-pink-100 rounded-2xl p-3 flex items-center gap-3 justify-start text-left">
                  <img
                    src={prod.imagenUrl}
                    alt={prod.nombre}
                    className="w-12 h-12 rounded-xl object-cover border border-pink-200 flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-gray-900 text-sm leading-snug truncate">{prod.nombre}</p>
                    <div className="flex items-center gap-1 mt-0.5 text-pink-600 font-bold text-xs">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{prod.puntos.toLocaleString('es-CL')} Puntos</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 force-spin animate-spin text-pink-600" />
              <p className="text-xs text-gray-500 font-medium animate-pulse">
                Procesando pedido y redirigiendo al inicio...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal de error por puntos insuficientes (reorder) */}
      {showErrorModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border-2 border-red-100 shadow-2xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="inline-block bg-red-100 p-4 rounded-full text-red-600 shadow-md">
              <AlertTriangle className="w-10 h-10 text-red-600 animate-pulse" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-black text-gray-900 tracking-tight leading-tight">
                Puntos Insuficientes
              </h3>
              <p className="text-gray-600 text-sm font-semibold leading-relaxed">
                No posees los Puntos Palermo suficientes para canjear los productos de este pedido.
              </p>
            </div>

            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex flex-col gap-2 justify-center text-center">
              <div className="text-sm text-gray-700 font-semibold">
                Tienes: <span className="text-red-600 font-extrabold">{userCurrentPoints.toLocaleString('es-CL')} pts</span>
              </div>
              <div className="text-sm text-gray-700 font-semibold">
                Necesitas: <span className="text-red-600 font-extrabold">{pointsNeeded.toLocaleString('es-CL')} pts</span>
              </div>
            </div>

            <div className="flex justify-center">
              <button
                onClick={() => setShowErrorModal(false)}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all text-center cursor-pointer text-sm"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}

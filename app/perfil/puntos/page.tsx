'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/app/context/AuthContext'
import { useRouter } from 'next/navigation'
import { db, functions } from '@/lib/firebase'
import { doc, getDoc, collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import Header from '@/app/components/Header'
import { ChevronLeft, ChevronRight, Sparkles, Gift, Lock, User, CheckCircle2 } from 'lucide-react'
import { useCart } from '@/app/context/CartContext'

const BANNERS = [
  '/banners/carrrusel6.gif',
  '/banners/carrrusel1.gif',
  '/banners/carrrusel2.gif',
  '/banners/carrrusel3.gif',
  '/banners/carrrusel4.gif',
  '/banners/carrrusel5.gif',
]

export default function PuntosPage() {
  const { user, isLoading, updateUser } = useAuth()
  const { addItem } = useCart()
  const router = useRouter()
  const [totalPoints, setTotalPoints] = useState<number | null>(null)
  const [pointsLoading, setPointsLoading] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [isMobile, setIsMobile] = useState(true)
  const [catalogo, setCatalogo] = useState<any[]>([])
  const [catalogoLoading, setCatalogoLoading] = useState(true)

  // Estados locales para la activación de cuenta con RUT
  const [mostrarModalActivar, setMostrarModalActivar] = useState(false)
  const [rutInput, setRutInput] = useState('')
  const [rutError, setRutError] = useState('')
  const [isSubmittingRut, setIsSubmittingRut] = useState(false)
  const [mostrarConfeti, setMostrarConfeti] = useState(false)
  const [mensajeExito, setMensajeExito] = useState(false)

  // Estados locales para el flujo de canje
  const [mostrarModalCanjeExito, setMostrarModalCanjeExito] = useState(false)
  const [productoCanjeado, setProductoCanjeado] = useState<any | null>(null)
  const [isRedeeming, setIsRedeeming] = useState<string | null>(null)

  // Función para formatear RUT sobre la marcha
  const handleRutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/[^0-9kK]/g, '')
    if (value.length > 9) {
      value = value.slice(0, 9)
    }
    
    if (value.length <= 1) {
      setRutInput(value)
      setRutError('')
      return
    }

    const cuerpo = value.slice(0, -1)
    const dv = value.slice(-1).toLowerCase()
    const cuerpoFormat = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
    const formatted = `${cuerpoFormat}-${dv}`
    
    setRutInput(formatted)
    setRutError('')
  }

  // Función para validar RUT (Algoritmo Módulo 11)
  const validarRutChileno = (rutCompleto: string): boolean => {
    const cleanRut = rutCompleto.replace(/[^0-9kK]/g, '')
    if (cleanRut.length < 8) return false

    const cuerpo = cleanRut.slice(0, -1)
    const dv = cleanRut.slice(-1).toLowerCase()

    let suma = 0
    let multiplo = 2
    for (let i = cuerpo.length - 1; i >= 0; i--) {
      suma += parseInt(cuerpo[i]) * multiplo
      multiplo = multiplo === 7 ? 2 : multiplo + 1
    }

    const dvEsperado = 11 - (suma % 11)
    let dvCalculado = '0'
    if (dvEsperado === 11) dvCalculado = '0'
    else if (dvEsperado === 10) dvCalculado = 'k'
    else dvCalculado = dvEsperado.toString()

    return dv === dvCalculado
  }

  const handleActivarCuenta = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validarRutChileno(rutInput)) {
      setRutError('Por favor ingresa un RUT válido (ej: 12.345.678-9).')
      return
    }

    setIsSubmittingRut(true)
    try {
      await updateUser({ rut: rutInput })
      setMostrarModalActivar(false)
      setMostrarConfeti(true)
      setMensajeExito(true)
      
      // Desactivar animación de confeti después de 7 segundos
      setTimeout(() => {
        setMostrarConfeti(false)
      }, 7000)
    } catch (error) {
      console.error('Error al activar cuenta:', error)
      setRutError('Hubo un error al activar tu cuenta. Intenta de nuevo.')
    } finally {
      setIsSubmittingRut(false)
    }
  }

  const handleRedeemProduct = async (prod: any) => {
    setIsRedeeming(prod.id)
    try {
      const { httpsCallable } = await import('firebase/functions')
      const redeemCatalogProductFn = httpsCallable(functions, 'redeemCatalogProduct')
      const result = await redeemCatalogProductFn({ productId: prod.id })
      const resData = result.data as any

      if (resData.success) {
        // 1. Actualizar puntos locales
        setTotalPoints(resData.newPoints)

        // 2. Agregar al carrito con valor 0 y marcarlo como canje
        addItem({
          id: `canje-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          name: resData.nombre,
          price: 0,
          image: resData.imagenUrl || prod.imagenUrl || '/placeholder.svg',
          quantity: 1,
          isCanje: true,
          canjePoints: resData.puntosCost,
        })

        // 3. Establecer producto canjeado para el modal
        setProductoCanjeado({
          nombre: resData.nombre,
          puntos: resData.puntosCost,
          imagenUrl: resData.imagenUrl || prod.imagenUrl || '/placeholder.svg',
        })

        // 4. Mostrar confeti y modal de éxito
        setMostrarConfeti(true)
        setMostrarModalCanjeExito(true)

        // Desactivar confeti después de 6 segundos
        setTimeout(() => {
          setMostrarConfeti(false)
        }, 6000)
      } else {
        alert(resData.error || "No se pudo realizar el canje. Intenta de nuevo.")
      }
    } catch (error: any) {
      console.error('Error al canjear producto:', error)
      const errorMsg = error?.message || 'Hubo un error al procesar tu canje. Por favor, intenta de nuevo.'
      alert(errorMsg)
    } finally {
      setIsRedeeming(null)
    }
  }

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Cargar catálogo de canje en tiempo real desde Firestore
  useEffect(() => {
    const q = query(collection(db, "puntos_palermo_catalogo"), orderBy("puntos", "asc"))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setCatalogo(fetched)
      setCatalogoLoading(false)
    }, (error) => {
      console.error("Error al cargar catálogo de puntos:", error)
      setCatalogoLoading(false)
    })
    return () => unsubscribe()
  }, [])

  // Redirección si no está logueado
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth')
      return
    }

    if (user?.id) {
      const loadPoints = async () => {
        try {
          const userRef = doc(db, 'users', user.id)
          const userDoc = await getDoc(userRef)
          if (userDoc.exists()) {
            setTotalPoints(userDoc.data().totalPoints || 0)
          } else {
            setTotalPoints(0)
          }
        } catch (error) {
          console.error('[PUNTOS] Error al cargar los puntos:', error)
          setTotalPoints(0)
        } finally {
          setPointsLoading(false)
        }
      }
      loadPoints()
    }
  }, [user, isLoading, router])

  // Lógica del carrusel automático de 3 segundos
  const resetTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
  }

  useEffect(() => {
    resetTimeout()
    timeoutRef.current = setTimeout(
      () =>
        setActiveIndex((prevIndex) =>
          prevIndex === BANNERS.length - 1 ? 0 : prevIndex + 1
        ),
      6000
    )

    return () => {
      resetTimeout()
    }
  }, [activeIndex])

  const nextSlide = () => {
    setActiveIndex((prev) => (prev === BANNERS.length - 1 ? 0 : prev + 1))
    resetTimeout()
  }

  const prevSlide = () => {
    setActiveIndex((prev) => (prev === 0 ? BANNERS.length - 1 : prev - 1))
    resetTimeout()
  }

  if (isLoading || pointsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-600 mb-4"></div>
            <p className="text-gray-600 font-medium">Cargando tus Puntos Palermo...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const slideWidth = isMobile ? 50 : 30
  const offset = (100 - slideWidth) / 2
  const transformStyle = `translateX(calc(${offset}% - ${activeIndex * slideWidth}%))`

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50/30 to-amber-50/20 text-[#1F2937] flex flex-col overflow-x-hidden">
      {/* Cabecera Principal */}
      <Header />

      <main className="flex-1 container mx-auto px-4 py-12 max-w-7xl">
        {/* Sección de Puntos */}
        <div className="bg-white/95 backdrop-blur-sm border-2 border-pink-100 rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(219,39,119,0.06)] flex flex-col sm:flex-row items-center gap-6 sm:gap-8 hover:shadow-xl transition-all duration-300">
          <div className="relative flex-shrink-0">
            <img
              src="/iconos/puntos_palermo.svg"
              alt="Icono Puntos Palermo"
              className="w-full max-w-[280px] sm:max-w-[377px] lg:max-w-[422px] h-auto object-contain hover:scale-105 transition-transform duration-300"
            />
          </div>

          <div className="flex-1 text-center sm:text-left space-y-1">
            <span className="text-gray-500 text-sm sm:text-base font-bold tracking-wider uppercase block">
              {user.name} tienes:
            </span>
            <div className="flex flex-col justify-center sm:justify-start">
              <span className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight text-pink-600 filter drop-shadow-sm leading-none">
                {totalPoints !== null ? totalPoints.toLocaleString('es-CL') : '0'}
              </span>
              <span className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-[#374151] mt-2 block">
                Puntos Palermo
              </span>
            </div>
          </div>

          {/* Estado de Activación de Cuenta */}
          <div className="flex-shrink-0 w-full sm:w-auto flex justify-center">
            {user.rut ? (
              <div className="flex flex-col items-center justify-center p-3 text-pink-600 w-auto">
                <div className="relative">
                  <img 
                    src="/iconos/puntos.png" 
                    alt="Puntos Activos" 
                    className="w-32 h-32 object-contain"
                  />
                  <span className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-green-500 rounded-full border-2 border-white flex items-center justify-center text-xs text-white font-bold shadow-sm">✓</span>
                </div>
                <span className="mt-3 font-black text-sm tracking-wide text-pink-600 text-center leading-tight">
                  ¡Cuenta de Puntos Activa!
                </span>
                <span className="text-xs text-gray-500 mt-1 font-semibold text-center bg-white px-2 py-0.5 rounded-md border border-gray-100 shadow-sm">
                  RUT: {user.rut}
                </span>
              </div>
            ) : (
              <button 
                onClick={() => {
                  setRutInput('')
                  setRutError('')
                  setMostrarModalActivar(true)
                }}
                className="flex flex-col items-center justify-center p-3 text-gray-400 hover:text-pink-600 transition-all duration-300 group cursor-pointer w-auto relative"
              >
                <div className="relative">
                  <img 
                    src="/iconos/puntos.png" 
                    alt="Activar Puntos" 
                    className="w-32 h-32 object-contain grayscale opacity-75 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
                  />
                  <span className="absolute top-0 right-0 w-4 h-4 bg-amber-500 rounded-full border-2 border-white animate-ping" />
                  <span className="absolute top-0 right-0 w-4 h-4 bg-amber-500 rounded-full border-2 border-white" />
                </div>
                <span className="mt-3 font-extrabold text-sm tracking-wide text-gray-500 group-hover:text-pink-600 transition-colors duration-300 text-center leading-tight">
                  ¡Activa tu cuenta aquí!
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Sección Destacados */}
        <div className="mt-16 space-y-6">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-wider">
              DESTACADOS
            </h2>
            <div className="flex-1 h-0.5 bg-gradient-to-r from-pink-300 to-transparent rounded" />
          </div>

          {/* Carrusel */}
          <div className="relative group overflow-hidden w-screen left-1/2 -translate-x-1/2 py-2">
            <div
              className="flex transform-gpu puntos-carousel-track"
              style={{
                transform: transformStyle,
              }}
            >
              {BANNERS.map((src, index) => {
                const isActive = index === activeIndex
                return (
                  <div 
                    key={index} 
                    className="flex-shrink-0 px-3 transform-gpu puntos-carousel-slide"
                    style={{ 
                      width: `${slideWidth}%`,
                      opacity: isActive ? 1 : 0.4,
                      transform: isActive ? 'scale(1)' : 'scale(0.92)',
                    }}
                  >
                    <div className="relative overflow-hidden rounded-3xl border-2 border-pink-100 shadow-lg bg-white p-2 sm:p-3 hover:shadow-xl transition-all duration-300">
                      <img
                        src={src}
                        alt={`Destacado ${index + 1}`}
                        className="w-full h-auto rounded-2xl object-contain select-none block"
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Controles de navegación lateral (desktop) */}
            <button
              onClick={prevSlide}
              className="absolute left-4 md:left-[33%] top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-800 p-3 rounded-full shadow-lg border border-gray-200 hover:text-pink-600 transition-all duration-200 hidden md:flex items-center justify-center opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 animate-fade-in z-10"
              aria-label="Anterior destacado"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={nextSlide}
              className="absolute right-4 md:right-[33%] top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-800 p-3 rounded-full shadow-lg border border-gray-200 hover:text-pink-600 transition-all duration-200 hidden md:flex items-center justify-center opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 animate-fade-in z-10"
              aria-label="Siguiente destacado"
            >
              <ChevronRight className="w-6 h-6" />
            </button>

            {/* Indicadores (dots) */}
            <div className="mt-8 flex justify-center items-center gap-2.5">
              {BANNERS.map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setActiveIndex(index)
                    resetTimeout()
                  }}
                  className={`h-2.5 rounded-full transition-all duration-300 !min-w-0 !min-h-0 ${
                    activeIndex === index
                      ? 'bg-pink-600 w-8 shadow-sm shadow-pink-500/50'
                      : 'bg-pink-200 w-2.5 hover:bg-pink-300'
                  }`}
                  aria-label={`Ir al banner ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Catálogo de Canjes */}
        <div className="mt-16 space-y-6">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-wider flex items-center gap-2">
              <Gift className="w-6 h-6 text-pink-600 animate-bounce" />
              CATÁLOGO DE CANJES
            </h2>
            <div className="flex-1 h-0.5 bg-gradient-to-r from-pink-300 to-transparent rounded" />
          </div>

          {catalogoLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-pink-600 mb-2"></div>
              <p className="text-gray-500 text-sm">Cargando catálogo canjeable...</p>
            </div>
          ) : catalogo.length === 0 ? (
            <div className="text-center py-12 bg-white/60 backdrop-blur-sm rounded-3xl border-2 border-pink-100/50 p-6">
              <p className="text-gray-500 italic">No hay productos canjeables disponibles en este momento. ¡Vuelve pronto!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {catalogo.map((prod) => {
                const tienePuntosSuficientes = totalPoints !== null && totalPoints >= prod.puntos
                return (
                  <div
                    key={prod.id}
                    className={`relative rounded-3xl border-2 overflow-hidden bg-white p-3 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between ${
                      !user.rut || tienePuntosSuficientes 
                        ? 'border-pink-100 hover:border-pink-200' 
                        : 'border-gray-100 hover:border-gray-200 opacity-90'
                    }`}
                  >
                    <div className="space-y-4">
                      {/* Imagen */}
                      <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-gray-50 border border-pink-50/50">
                        <img
                          src={prod.imagenUrl}
                          alt={prod.nombre}
                          className="w-full h-full object-cover select-none"
                        />
                        {user.rut && !tienePuntosSuficientes && (
                          <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center">
                            <span className="bg-gray-800/90 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5">
                              <Lock className="w-3.5 h-3.5" /> Faltan puntos
                            </span>
                          </div>
                        )}
                      </div>
 
                      {/* Info */}
                      <div className="space-y-1.5">
                        <h3 className="font-extrabold text-gray-900 text-lg line-clamp-2 leading-snug">
                          {prod.nombre}
                        </h3>
                        <div className="flex items-center gap-1.5">
                          <span className="text-pink-600 font-black text-xl flex items-center gap-1">
                            <Sparkles className="w-5 h-5" />
                            {prod.puntos.toLocaleString('es-CL')}
                          </span>
                          <span className="text-gray-500 text-sm font-semibold">Puntos</span>
                        </div>
                      </div>
                    </div>
 
                    {/* Botón de Canje */}
                    <div className="mt-6">
                      {!user.rut ? (
                        <button
                          onClick={() => {
                            alert("Debes activar tu cuenta primero ingresando tu RUT para poder comenzar a canjear tus Puntos Palermo.")
                            setRutInput('')
                            setRutError('')
                            setMostrarModalActivar(true)
                          }}
                          className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 px-4 rounded-2xl shadow-md hover:shadow-lg transition-all active:scale-95 text-center flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Gift className="w-5 h-5" />
                          Canjear Producto
                        </button>
                      ) : tienePuntosSuficientes ? (
                        <button
                          disabled={isRedeeming !== null}
                          onClick={() => handleRedeemProduct(prod)}
                          className={`w-full text-white font-bold py-3 px-4 rounded-2xl shadow-md hover:shadow-lg transition-all active:scale-95 text-center flex items-center justify-center gap-2 cursor-pointer ${
                            isRedeeming === prod.id 
                              ? 'bg-pink-400 cursor-not-allowed' 
                              : isRedeeming !== null
                                ? 'bg-pink-400 opacity-50 cursor-not-allowed'
                                : 'bg-pink-600 hover:bg-pink-700'
                          }`}
                        >
                          {isRedeeming === prod.id ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white" />
                          ) : (
                            <>
                              <Gift className="w-5 h-5" />
                              Canjear Producto
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          disabled
                          className="w-full bg-gray-100 text-gray-400 font-bold py-3 px-4 rounded-2xl border-2 border-gray-100 cursor-not-allowed text-center flex items-center justify-center gap-2"
                        >
                          <Lock className="w-4 h-4" />
                          Puntos Insuficientes
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {/* Modal para Activar Cuenta con RUT */}
      {mostrarModalActivar && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border-2 border-pink-100 shadow-2xl relative space-y-6">
            <button 
              onClick={() => setMostrarModalActivar(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 font-bold text-xl cursor-pointer bg-gray-100 hover:bg-gray-200 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            >
              ✕
            </button>

            <div className="text-center space-y-2">
              <div className="inline-block bg-pink-100 p-4 rounded-full text-pink-600 mb-2 shadow-sm">
                <Gift className="w-8 h-8 animate-bounce" />
              </div>
              <h3 className="text-2xl font-black text-gray-900 tracking-tight leading-tight">
                Confirma tus datos y activa tus beneficios
              </h3>
              <p className="text-gray-500 text-sm font-semibold leading-relaxed">
                Ingresa tu RUT para empezar a canjear tus Puntos Palermo.
              </p>
            </div>

            <form onSubmit={handleActivarCuenta} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="rut" className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                  RUT del Cliente
                </label>
                <input
                  id="rut"
                  type="text"
                  placeholder="12.345.678-9"
                  value={rutInput}
                  onChange={handleRutChange}
                  required
                  disabled={isSubmittingRut}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-pink-500 text-base font-semibold tracking-wide placeholder-gray-400 transition-all text-[#1F2937]"
                />
                {rutError && (
                  <p className="text-red-500 text-xs font-semibold mt-1">
                    {rutError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmittingRut || !rutInput}
                className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 text-center flex items-center justify-center gap-2 cursor-pointer disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                {isSubmittingRut ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white" />
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Activar Beneficios
                  </>
                )}
              </button>
            </form>
            
            <p className="text-[11px] text-gray-400 text-center leading-normal">
              * Al activar tu cuenta, tus compras asociadas a este perfil comenzarán a generar Puntos Palermo de manera automática.
            </p>
          </div>
        </div>
      )}

      {/* Modal de éxito con animación */}
      {mensajeExito && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border-2 border-pink-100 shadow-2xl text-center space-y-6">
            <div className="inline-block bg-green-100 p-4 rounded-full text-green-600 shadow-md">
              <Sparkles className="w-10 h-10 animate-pulse" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-black text-gray-900 tracking-tight leading-tight">
                ¡Cuenta Activada Exitosamente!
              </h3>
              <p className="text-gray-600 text-sm font-semibold leading-relaxed">
                ¡Felicidades! Desde este momento comienzas a acumular puntos Palermo con cada una de tus compras.
              </p>
            </div>

            <div className="bg-pink-50/30 border border-pink-100 rounded-2xl p-4 flex items-center gap-3 justify-center text-left">
              <Gift className="w-6 h-6 text-pink-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tu RUT registrado</p>
                <p className="text-sm font-extrabold text-pink-700">{rutInput}</p>
              </div>
            </div>

            <button
              onClick={() => setMensajeExito(false)}
              className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 text-center cursor-pointer"
            >
              ¡Comenzar a canjear!
            </button>
          </div>
        </div>
      )}

      {/* Modal de éxito de canje */}
      {mostrarModalCanjeExito && productoCanjeado && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border-2 border-pink-100 shadow-2xl text-center space-y-6">
            <div className="inline-block bg-pink-100 p-4 rounded-full text-pink-600 shadow-md">
              <CheckCircle2 className="w-10 h-10 animate-pulse text-pink-600" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-black text-gray-900 tracking-tight leading-tight">
                ¡Canje Realizado!
              </h3>
              <p className="text-gray-600 text-sm font-semibold leading-relaxed">
                Se descontaron los puntos y tu producto se agregó al carrito con costo $0.
              </p>
            </div>

            <div className="bg-pink-50/50 border border-pink-100 rounded-2xl p-4 flex items-center gap-4 justify-start text-left">
              <img
                src={productoCanjeado.imagenUrl}
                alt={productoCanjeado.nombre}
                className="w-16 h-16 rounded-xl object-cover border border-pink-200 flex-shrink-0"
              />
              <div className="min-w-0">
                <p className="font-extrabold text-gray-900 text-base leading-snug truncate">{productoCanjeado.nombre}</p>
                <div className="flex items-center gap-1.5 mt-1 text-pink-600 font-bold text-sm">
                  <Sparkles className="w-4 h-4" />
                  <span>{productoCanjeado.puntos.toLocaleString('es-CL')} Puntos</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setMostrarModalCanjeExito(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 px-4 rounded-xl transition-all text-center cursor-pointer text-sm"
              >
                Seguir viendo
              </button>
              <button
                onClick={() => {
                  setMostrarModalCanjeExito(false)
                  setTimeout(() => {
                    window.dispatchEvent(new Event('openCart'))
                  }, 100)
                }}
                className="flex-1 bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 px-4 rounded-xl shadow-md hover:shadow-lg transition-all text-center cursor-pointer text-sm"
              >
                Ir al Carrito
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Animación Confeti */}
      {mostrarConfeti && <ConfettiAnimation />}
    </div>
  )
}

// Componente de confeti de CSS
const ConfettiAnimation = () => {
  return (
    <>
      <style>{`
        @keyframes confettiFall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        .confetti-particle {
          position: fixed;
          top: -20px;
          z-index: 9999;
          animation: confettiFall linear forwards;
          pointer-events: none;
        }
      `}</style>
      <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
        {Array.from({ length: 80 }).map((_, i) => {
          const left = Math.random() * 100
          const delay = Math.random() * 3
          const duration = Math.random() * 2 + 2.5
          const size = Math.random() * 8 + 6
          const colors = ['#ec4899', '#f59e0b', '#3b82f6', '#10b981', '#a855f7', '#f43f5e', '#ec4899', '#f472b6']
          const color = colors[Math.floor(Math.random() * colors.length)]
          const shape = Math.random() > 0.5 ? 'rounded-full' : 'rounded-sm'
          return (
            <div
              key={i}
              className={`confetti-particle ${shape}`}
              style={{
                left: `${left}%`,
                animationDelay: `${delay}s`,
                animationDuration: `${duration}s`,
                width: `${size}px`,
                height: `${size}px`,
                backgroundColor: color,
              }}
            />
          )
        })}
      </div>
    </>
  )
}

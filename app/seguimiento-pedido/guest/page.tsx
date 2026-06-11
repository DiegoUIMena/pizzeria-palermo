'use client'

import { Suspense, useCallback, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Clock, Package, Truck, CheckCircle, Store } from 'lucide-react'
import { functions } from '@/lib/firebase'
import { httpsCallable } from 'firebase/functions'
import { validateGuestTrackingToken } from '@/lib/guest-tracking'

interface GuestOrder {
  id: string
  orderNumber: number
  total: number
  estado: string
  tipoEntrega?: 'Delivery' | 'Retiro'
  paymentStatus: string
  metodoPago: string
  cliente: {
    nombre: string
    email: string
    telefono: string
  }
  createdAt: string | null
  confirmedAt?: string | null
  inventoryStatus?: string
}

const getGuestOrderTracking = httpsCallable(functions, 'getGuestOrderTracking')

type StepState = 'completed' | 'current' | 'pending'

function normalizeStatus(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function getGuestOrderSteps(order: GuestOrder) {
  const rawStatus = String(order.estado || '')
  const status = normalizeStatus(rawStatus)
  const isDelivery = order.tipoEntrega === 'Delivery'
  const isCancelled = status === 'cancelado' || status === 'pago rechazado'

  const baseSteps = [
    { key: 'received', label: 'Pedido recibido', icon: Package },
    { key: 'confirmed', label: 'Pedido confirmado', icon: CheckCircle },
    { key: 'preparing', label: 'En preparación', icon: Clock },
    { key: 'ready', label: 'Pedido listo', icon: Store },
  ]

  const steps = isDelivery
    ? [...baseSteps, { key: 'onTheWay', label: 'En camino', icon: Truck }]
    : baseSteps

  const receivedStatuses = new Set([
    'pendiente',
    'confirmado',
    'aceptado',
    'en preparacion',
    'pedido listo',
    'en camino',
    'entregado',
  ])

  const confirmedStatuses = new Set([
    'confirmado',
    'aceptado',
    'en preparacion',
    'pedido listo',
    'en camino',
    'entregado',
  ])

  const preparingStatuses = new Set([
    'en preparacion',
    'pedido listo',
    'en camino',
    'entregado',
  ])

  const readyStatuses = new Set(['pedido listo', 'en camino', 'entregado'])
  const onTheWayStatuses = new Set(['en camino', 'entregado'])

  const reached = {
    received: !isCancelled && receivedStatuses.has(status),
    confirmed: !isCancelled && confirmedStatuses.has(status),
    preparing: !isCancelled && preparingStatuses.has(status),
    ready: !isCancelled && readyStatuses.has(status),
    onTheWay: !isCancelled && onTheWayStatuses.has(status),
  }

  const reachedCount = steps.filter((step) => reached[step.key as keyof typeof reached]).length
  const currentIndex = Math.min(Math.max(reachedCount, 1), steps.length) - 1

  return {
    isCancelled,
    steps: steps.map((step, index) => {
      let state: StepState = 'pending'
      if (reached[step.key as keyof typeof reached]) state = 'completed'
      else if (index === currentIndex) state = 'current'
      return { ...step, state }
    }),
    progress: Math.round((reachedCount / steps.length) * 100),
  }
}

function formatDateTime(value?: string | null): string {
  if (!value) return 'N/A'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'N/A'
  return parsed.toLocaleString('es-CL')
}

function SeguimientoPedidoGuestContent() {
  const searchParams = useSearchParams()
  const [orders, setOrders] = useState<GuestOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [searched, setSearched] = useState(false)
  const [authMode, setAuthMode] = useState<'token' | 'manual'>('manual')
  const [lookupData, setLookupData] = useState<{email?: string; phone?: string; token?: string} | null>(null)
  const [playedSound, setPlayedSound] = useState<Set<string>>(new Set())

  const loadOrders = useCallback(async (customerEmail: string, customerPhone: string, silent = false) => {
    try {
      if (!silent) setLoading(true)

      const response = await getGuestOrderTracking({
        email: customerEmail,
        phone: customerPhone,
      })

      const data = response.data as { success: boolean; orders?: GuestOrder[] }
      setOrders(Array.isArray(data?.orders) ? data.orders : [])
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError('Error al cargar pedidos: ' + message)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  const validateTokenAndLoadOrders = useCallback(async (token: string) => {
    setLoading(true)
    setError('')

    try {
      const validation = validateGuestTrackingToken(token)

      if (!validation.valid) {
        setError(validation.error || 'Token inválido o expirado')
        setLoading(false)
        return
      }

      if (validation.email && validation.phone) {
        setEmail(validation.email)
        setPhone(validation.phone)
        await loadOrders(validation.email, validation.phone)
        setSearched(true)
      }
    } catch {
      setError('Error al validar token')
    } finally {
      setLoading(false)
    }
  }, [loadOrders])

  // Intentar validar token si viene en URL
  useEffect(() => {
    const token = searchParams.get('token')
    if (token) {
      setAuthMode('token')
      setLookupData({ token })
      validateTokenAndLoadOrders(token)
      return
    }

    const emailFromQuery = (searchParams.get('email') || '').trim()
    const phoneFromQuery = (searchParams.get('phone') || '').trim()

    if (emailFromQuery && phoneFromQuery) {
      setEmail(emailFromQuery)
      setPhone(phoneFromQuery)
      setSearched(true)
      setAuthMode('manual')
      setLookupData({ email: emailFromQuery, phone: phoneFromQuery })
      setLoading(true)
      loadOrders(emailFromQuery, phoneFromQuery)
      return
    }

    const stored = localStorage.getItem('guestTrackingData')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed?.email) setEmail(parsed.email)
        if (parsed?.phone) setPhone(parsed.phone)
      } catch {
        // Ignorar datos corruptos de storage
      }
    }
  }, [searchParams, validateTokenAndLoadOrders, loadOrders])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthMode('manual')
    setSearched(true)
    setError('')
    setLoading(true)

    // Validar formato
    if (!email || !email.includes('@')) {
      setError('Ingresa un correo válido')
      setLoading(false)
      return
    }

    if (!phone || phone.length < 8) {
      setError('Ingresa un teléfono válido (mínimo 8 dígitos)')
      setLoading(false)
      return
    }

    setLookupData({ email, phone })

    await loadOrders(email, phone)
  }

  useEffect(() => {
    if (!lookupData) return

    const intervalId = window.setInterval(async () => {
      if (lookupData.token) {
        try {
          const response = await getGuestOrderTracking({ token: lookupData.token })
          const data = response.data as { success: boolean; orders?: GuestOrder[] }
          setOrders(Array.isArray(data?.orders) ? data.orders : [])
        } catch {
          // Evitar ruido en cada intervalo
        }
        return
      }

      if (lookupData.email && lookupData.phone) {
        await loadOrders(lookupData.email, lookupData.phone, true)
      }
    }, 15000)

    return () => window.clearInterval(intervalId)
  }, [lookupData, loadOrders])

  const activeOrder = orders[0] || null

  // Reproducir sonido cuando el pedido alcanza su estado final de entrega
  useEffect(() => {
    if (activeOrder) {
      const isReadyForPickup = activeOrder.tipoEntrega === 'Retiro' && activeOrder.estado === 'Pedido Listo'
      const isReadyForDelivery = activeOrder.tipoEntrega === 'Delivery' && activeOrder.estado === 'En camino'

      if ((isReadyForPickup || isReadyForDelivery) && !playedSound.has(activeOrder.id)) {
        // Asumimos que crearás/tendrás un archivo de audio en /public/notification.mp3
        const audio = new Audio('/notification.mp3')
        audio.play().catch(e => console.log('Autoplay de audio bloqueado por el navegador:', e))
        
        setPlayedSound(prev => new Set(prev).add(activeOrder.id))
      }
    }
  }, [activeOrder?.estado, activeOrder?.id, activeOrder?.tipoEntrega, playedSound])

  return (
    <div className='min-h-screen bg-gray-50'>
      <div className='container mx-auto px-4 py-8'>
        <div className='flex items-center gap-4 mb-8'>
          <Link href='/' className='text-pink-600 hover:text-pink-700'>
            <ArrowLeft className='w-6 h-6' />
          </Link>
          <h1 className='text-3xl font-bold'>Seguimiento de tu Pedido</h1>
        </div>

        {/* Formulario de búsqueda */}
        {!searched ? (
          <Card className='max-w-md mx-auto mb-8'>
            <CardHeader>
              <CardTitle>Ingresa tus datos</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearch} className='space-y-4'>
                <div>
                  <label className='block text-sm font-medium mb-2'>Correo electrónico</label>
                  <Input
                    type='email'
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder='tu@email.com'
                    disabled={authMode === 'token'}
                  />
                </div>

                <div>
                  <label className='block text-sm font-medium mb-2'>Teléfono</label>
                  <Input
                    type='tel'
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder='+56912345678'
                    disabled={authMode === 'token'}
                  />
                </div>

                {error && (
                  <div className='bg-red-50 border border-red-200 rounded p-3 text-red-700 text-sm'>
                    {error}
                  </div>
                )}

                <Button
                  type='submit'
                  disabled={loading}
                  className='w-full bg-pink-600 hover:bg-pink-700'
                >
                  {loading ? 'Buscando...' : 'Buscar mis pedidos'}
                </Button>
              </form>

              {/* Incentivo a registrarse */}
              <div className='mt-6 p-4 bg-pink-50 rounded-lg border border-pink-200'>
                <p className='text-sm text-gray-700 mb-3'>
                  <strong>¿Nuevo cliente?</strong> Regístrate para acceder más fácil y acumula{' '}
                  <span className='text-pink-600 font-semibold'>Puntos Palermo</span> con tus compras.
                </p>
                <Link href='/auth'>
                  <Button variant='outline' className='w-full border-pink-600 text-pink-600 hover:bg-pink-50'>
                    Crear cuenta gratis
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Pedido en curso */}
        {searched && activeOrder && (
          <div className='space-y-4'>
            <h2 className='text-xl font-semibold'>Seguimiento en vivo</h2>
            <p className='text-sm text-gray-600'>Actualización automática cada 15 segundos</p>

            <Card key={activeOrder.id} className='hover:shadow-lg transition-shadow border-pink-200'>
                <CardContent className='pt-6'>
                  {(() => {
                    const { isCancelled, steps, progress } = getGuestOrderSteps(activeOrder)

                    return (
                      <div className='space-y-5'>
                        <div className='flex flex-wrap items-end justify-between gap-3'>
                          <div>
                            <p className='text-xs uppercase tracking-wider text-gray-500'>Pedido #{activeOrder.orderNumber}</p>
                            <p className='text-lg font-extrabold text-pink-700'>{activeOrder.estado}</p>
                          </div>
                          <p className='text-sm text-gray-600'>Total ${activeOrder.total?.toLocaleString()}</p>
                        </div>

                        {!isCancelled ? (
                          <>
                            <div className='h-2 w-full rounded-full bg-pink-100 overflow-hidden'>
                              <div
                                className='h-full bg-pink-500 transition-all duration-700'
                                style={{ width: `${progress}%` }}
                              />
                            </div>

                            <div className={`grid grid-cols-2 ${steps.length === 5 ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-3`}>
                              {steps.map((step) => {
                                const Icon = step.icon
                                const isDone = step.state === 'completed'
                                const isCurrent = step.state === 'current'

                                return (
                                  <div
                                    key={step.key}
                                    className={`rounded-xl border p-3 text-center transition-all ${
                                      isDone
                                        ? 'border-green-300 bg-green-50'
                                        : isCurrent
                                          ? 'border-pink-300 bg-pink-50 shadow-md'
                                          : 'border-gray-200 bg-gray-50'
                                    }`}
                                  >
                                    <div
                                      className={`mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full ${
                                        isDone
                                          ? 'bg-green-500 text-white'
                                          : isCurrent
                                            ? 'bg-pink-500 text-white animate-pulse'
                                            : 'bg-white text-gray-400 border border-gray-200'
                                      }`}
                                    >
                                      <Icon className='h-7 w-7' />
                                    </div>
                                    <p className='text-sm font-semibold text-gray-800'>{step.label}</p>
                                    <p className='text-xs text-gray-500 mt-1'>
                                      {isDone ? 'Completado' : isCurrent ? 'En curso' : 'Pendiente'}
                                    </p>
                                  </div>
                                )
                              })}
                            </div>

                          {/* Mensaje final de éxito animado */}
                          {((activeOrder.tipoEntrega === 'Retiro' && activeOrder.estado === 'Pedido Listo') || 
                            (activeOrder.tipoEntrega === 'Delivery' && activeOrder.estado === 'En camino')) && (
                            <div className='mt-8 p-6 bg-green-50 rounded-2xl border-2 border-green-200 text-center animate-in fade-in slide-in-from-bottom-4 duration-700'>
                              <div className='text-6xl mb-4 animate-bounce'>👍🏻</div>
                              <h3 className='text-xl font-bold text-green-800 mb-2'>¡Excelente!</h3>
                              <p className='text-lg text-green-700 font-medium'>
                                {activeOrder.tipoEntrega === 'Retiro' 
                                  ? "Ya puedes pasar a retirar tu pedido."
                                  : "Tu pedido está en camino, llegará en minutos."}
                              </p>
                            </div>
                          )}
                          </>
                        ) : (
                          <div className='rounded-xl border border-red-200 bg-red-50 p-4'>
                            <p className='text-red-700 font-semibold'>Este pedido fue cancelado o rechazado.</p>
                            <p className='text-red-600 text-sm mt-1'>Si necesitas ayuda, contáctanos por WhatsApp.</p>
                          </div>
                        )}

                        <p className='text-xs text-gray-500'>Última actualización: {formatDateTime(new Date().toISOString())}</p>
                      </div>
                    )
                  })()}
                </CardContent>
              </Card>
          </div>
        )}

        {/* Sin pedidos encontrados */}
        {searched && orders.length === 0 && !error && (
          <Card className='max-w-md mx-auto text-center py-12'>
            <CardContent>
              <Package className='w-12 h-12 text-gray-300 mx-auto mb-4' />
              <p className='text-gray-600 mb-4'>No tienes pedidos activos con esos datos.</p>
              <p className='text-xs text-gray-500 mb-4'>Los pedidos entregados, cancelados o antiguos no se muestran aquí.</p>
              <Button
                onClick={() => {
                  setSearched(false)
                  setEmail('')
                  setPhone('')
                  setError('')
                }}
                variant='outline'
                className='mx-auto'
              >
                Intentar nuevamente
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default function SeguimientoPedidoGuest() {
  return (
    <Suspense
      fallback={
        <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
          <p className='text-gray-600'>Cargando seguimiento...</p>
        </div>
      }
    >
      <SeguimientoPedidoGuestContent />
    </Suspense>
  )
}

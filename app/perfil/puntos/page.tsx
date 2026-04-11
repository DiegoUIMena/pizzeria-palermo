'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/app/context/AuthContext'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/firebase'
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Copy, Check } from 'lucide-react'
import Link from 'next/link'

interface RedemptionTier {
  points: number
  label: string
  rewardType: 'fixed_discount' | 'pizza_cap'
  discountAmount: number
  minimumOrderAmount?: number
}

const REDEMPTION_TIERS: RedemptionTier[] = [
  { points: 300, label: '$2.000 descuento', rewardType: 'fixed_discount', discountAmount: 2000 },
  { points: 500, label: '$3.500 descuento', rewardType: 'fixed_discount', discountAmount: 3500 },
  { points: 800, label: '$6.000 descuento', rewardType: 'fixed_discount', discountAmount: 6000, minimumOrderAmount: 10000 },
  { points: 1200, label: '$9.000 descuento', rewardType: 'fixed_discount', discountAmount: 9000, minimumOrderAmount: 10000 },
  { points: 1600, label: '$12.000 descuento', rewardType: 'fixed_discount', discountAmount: 12000, minimumOrderAmount: 15000 },
  { points: 2000, label: 'Pizza gratis hasta $13.000', rewardType: 'pizza_cap', discountAmount: 13000 },
  { points: 2400, label: 'Pizza gratis hasta $15.000', rewardType: 'pizza_cap', discountAmount: 15000 },
]

interface Voucher {
  id: string
  code: string
  rewardType: 'fixed_discount' | 'pizza_cap'
  discountAmount: number
  minimumOrderAmount: number
  rewardLabel: string
  pizzasIncluded: number
  expiresAt: string
  createdAt: string
  used: boolean
  status: 'active' | 'used' | 'expired'
}

interface UserPointsInfo {
  totalPoints: number
  redemptionsAvailable: number
  lastEarned?: string
}

export default function PuntosPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [pointsInfo, setPointsInfo] = useState<UserPointsInfo>({ totalPoints: 0, redemptionsAvailable: 0 })
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [pageLoading, setPageLoading] = useState(true)
  const [pageError, setPageError] = useState<string>('')
  const [redeemingPoints, setRedeemingPoints] = useState<number | null>(null)
  const [copiedVoucherId, setCopiedVoucherId] = useState<string | null>(null)

  useEffect(() => {
    console.log('[PUNTOS] useEffect activado - isLoading:', isLoading, '- user:', user?.id)
    
    if (!isLoading && !user) {
      console.log('[PUNTOS] No hay usuario autenticado, redirigiendo a /auth')
      router.push('/auth')
      return
    }

    if (!isLoading && user?.id) {
      console.log('[PUNTOS] Usuario detectado:', user.id, '- Iniciando carga de puntos')
      loadUserPoints()
    } else if (isLoading) {
      console.log('[PUNTOS] Aun cargando autenticacion...')
    } else {
      console.log('[PUNTOS] Usuario vacio pero isLoading es false - esperando...')
    }
  }, [user?.id, isLoading, router])

  // ✅ REFRESCO AUTOMÁTICO: Cuando el usuario vuelve a la pestaña
  useEffect(() => {
    if (!user?.id) return

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('[PUNTOS] 👁️ Usuario volvió a la pestaña - refrescando datos...')
        loadUserPoints()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [user?.id])

  async function loadUserPoints() {
    try {
      console.log('[PUNTOS] Iniciando carga de puntos para usuario:', user?.id)
      setPageLoading(true)
      setPageError('')
      
      const userRef = doc(db, 'users', user!.id)
      console.log('[PUNTOS] Referencia a usuario:', user!.id)
      console.log('[PUNTOS] Obteniendo documento de usuario...')
      const userDoc = await getDoc(userRef)

      console.log('[PUNTOS] Documento de usuario existe:', userDoc.exists())
      if (userDoc.exists()) {
        const userData = userDoc.data()
        console.log('[PUNTOS] Datos de usuario:', userData)
        const totalPoints = userData.totalPoints || 0
        setPointsInfo({
          totalPoints,
          redemptionsAvailable: REDEMPTION_TIERS.filter((tier) => totalPoints >= tier.points).length,
          lastEarned: userData.lastEarned?.toDate?.().toLocaleDateString('es-CL'),
        })
      } else {
        console.log('[PUNTOS] Documento de usuario no existe, inicializando con 0 puntos')
        setPointsInfo({
          totalPoints: 0,
          redemptionsAvailable: 0,
        })
      }

      // Cargar vouchers
      console.log('[PUNTOS] Buscando vouchers del usuario...')
      const vouchersRef = collection(db, 'users', user!.id, 'vouchers')
      const ordersRef = collection(db, 'orders')
      
      try {
        const vouchersSnap = await getDocs(vouchersRef)
        const userOrdersSnap = await getDocs(query(ordersRef, where('userId', '==', user!.id)))

        // Estado derivado: si un voucher aparece en una orden no fallida/no cancelada,
        // se considera usado aunque el documento de voucher haya quedado desfasado.
        const usedVoucherIds = new Set<string>()
        userOrdersSnap.docs.forEach(orderDoc => {
          const data = orderDoc.data()
          const voucherId = data.voucherId
          if (!voucherId) return

          const isCancelled = data.estado === 'Cancelado'
          const isFailedPayment = data.paymentStatus === 'failed'
          if (!isCancelled && !isFailedPayment) {
            usedVoucherIds.add(voucherId)
          }
        })
        
        console.log('[PUNTOS] Documentos de vouchers:', vouchersSnap.size)
        const vouchersList = vouchersSnap.docs.map(doc => ({
          ...doc.data(),
          id: doc.id,
          code: doc.data().code || doc.id.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase(),
          rewardType: (doc.data().rewardType || ((doc.data().pizzasIncluded || doc.data().pizzasAwarded || 0) > 0 ? 'pizza_cap' : 'fixed_discount')) as 'fixed_discount' | 'pizza_cap',
          discountAmount: doc.data().discountAmount || 0,
          minimumOrderAmount: doc.data().minimumOrderAmount || 0,
          rewardLabel:
            doc.data().rewardLabel ||
            (((doc.data().pizzasIncluded || doc.data().pizzasAwarded || 0) > 0)
              ? 'Pizza gratis'
              : `$${(doc.data().discountAmount || 0).toLocaleString('es-CL')} de descuento`),
          pizzasIncluded: doc.data().pizzasIncluded || doc.data().pizzasAwarded || 1,
          expiresAt: doc.data().expiresAt?.toDate?.()?.toLocaleDateString('es-CL') || '',
          createdAt: doc.data().createdAt?.toDate?.()?.toLocaleDateString('es-CL') || '',
          used: doc.data().used || false,
          status: (usedVoucherIds.has(doc.id) ? 'used' : (doc.data().status || 'active')) as 'active' | 'used' | 'expired',
        }))

        console.log('[PUNTOS] Vouchers obtenidos:', vouchersList.length)
        setVouchers(vouchersList)
      } catch (vouchersError) {
        console.warn('[PUNTOS] No se pudo cargar vouchers (puede no existir):', vouchersError)
        setVouchers([])
      }
      
      setPageLoading(false)
    } catch (error) {
      console.error('[PUNTOS] Error cargando puntos:', error)
      setPageError(error instanceof Error ? error.message : 'Error al cargar puntos')
      setPageLoading(false)
    }
  }

  async function handleRedeemTier(pointsToRedeem: number) {
    if (pointsInfo.totalPoints < pointsToRedeem) return

    try {
      setRedeemingPoints(pointsToRedeem)

      if (!user) {
        alert('Debes estar autenticado')
        return
      }

      // Obtener el token de autenticación del usuario actual
      const currentAuth = getAuth()
      const currentUser = currentAuth.currentUser

      if (!currentUser) {
        alert('Sesión expirada, por favor vuelve a iniciar sesión')
        return
      }

      const token = await currentUser.getIdToken()
      const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'pizzeria-palermo-17f6d'
      const redeemEndpoint = `https://us-central1-${projectId}.cloudfunctions.net/redeemPointsForPizzaHttp`

      // Llamar a la función HTTP con CORS
      console.log('[PUNTOS] Calling redeemPointsForPizzaHttp...')
      const response = await fetch(
        redeemEndpoint,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ pointsToRedeem }),
        }
      )

      console.log('[PUNTOS] Response status:', response.status)
      const data = await response.json()
      console.log('[PUNTOS] Response data:', data)

      if (!response.ok) {
        console.error('[PUNTOS] Error response:', data)
        alert(data.error || 'Error al canjear puntos')
        return
      }

      if (data.success) {
        // Mostrar mensaje de éxito
        alert(`Voucher creado: ${data.voucherCode || data.voucherId}\n\n${data.message}`)
        // Recargar puntos
        await loadUserPoints()
      } else {
        alert(data.error || 'Error al canjear puntos')
      }
    } catch (error) {
      console.error('[PUNTOS] Error redeeming points:', error)
      if (error instanceof Error) {
        console.error('[PUNTOS] Error message:', error.message)
      }
      alert('Error al canjear puntos. Por favor intenta nuevamente.')
    } finally {
      setRedeemingPoints(null)
    }
  }

  async function handleCopyVoucherCode(voucherId: string, code: string) {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedVoucherId(voucherId)
      setTimeout(() => setCopiedVoucherId(null), 1500)
    } catch (error) {
      console.error('[PUNTOS] Error copiando codigo de voucher:', error)
      alert('No se pudo copiar automaticamente. Copia manualmente el codigo: ' + code)
    }
  }

  if (isLoading || pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-600 mb-4"></div>
          <p className="text-gray-600">Cargando tus puntos...</p>
          <p className="text-xs text-gray-500 mt-2">Si esto toma mucho, recarga la pagina</p>
        </div>
      </div>
    )
  }

  if (pageError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">[ERROR]</div>
          <h1 className="text-2xl font-bold text-red-900 mb-2">Error Cargando Puntos</h1>
          <p className="text-red-700 mb-6">{pageError}</p>
          <div className="space-y-2">
            <Button onClick={() => loadUserPoints()} className="w-full bg-amber-600 hover:bg-amber-700">
              Reintentar
            </Button>
            <Link href="/perfil" className="block">
              <Button variant="outline" className="w-full">
                Volver a Perfil
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="text-amber-600 hover:text-amber-700 mb-4 inline-block">
            Volver al Inicio
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Puntos Palermo</h1>
          <p className="text-gray-600">Acumula puntos en cada compra y canjealos por pizzas gratis</p>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Total Points Card */}
          <Card className="border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100">
            <CardHeader>
              <CardDescription className="text-sm">Tus Puntos</CardDescription>
              <CardTitle className="text-5xl text-amber-700">{pointsInfo.totalPoints}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700">
                1 punto = $100 de compra
              </p>
            </CardContent>
          </Card>

          {/* Pizzas Available Card */}
          <Card className="border-2 border-red-200 bg-gradient-to-br from-red-50 to-red-100">
            <CardHeader>
              <CardDescription className="text-sm">Canjes Disponibles</CardDescription>
              <CardTitle className="text-5xl text-red-600">{pointsInfo.redemptionsAvailable}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700">
                Tramos desde 300 puntos
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Redeem Section */}
        {pointsInfo.totalPoints >= 300 ? (
          <Card className="mb-8 border-2 border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="text-lg">Canjear Puntos</CardTitle>
              <CardDescription>Elige el tramo que más te convenga</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {REDEMPTION_TIERS.map((tier) => {
                  const canRedeem = pointsInfo.totalPoints >= tier.points
                  const isRedeemingThisTier = redeemingPoints === tier.points

                  return (
                    <div
                      key={tier.points}
                      className={`bg-white p-4 rounded-lg border ${canRedeem ? 'border-green-200' : 'border-gray-200 opacity-70'}`}
                    >
                      <div className="flex justify-between items-start mb-4 gap-3">
                        <div>
                          <p className="font-semibold text-gray-900">{tier.label}</p>
                          <p className="text-sm text-gray-600">{tier.points} puntos</p>
                          {tier.minimumOrderAmount ? (
                            <p className="text-xs text-amber-700 mt-1">
                              Requiere compra mínima de ${tier.minimumOrderAmount.toLocaleString('es-CL')}
                            </p>
                          ) : null}
                        </div>
                        <Badge className={canRedeem ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}>
                          {canRedeem ? 'Disponible' : 'Insuficiente'}
                        </Badge>
                      </div>
                      <Button
                        onClick={() => handleRedeemTier(tier.points)}
                        disabled={!canRedeem || redeemingPoints !== null}
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        {isRedeemingThisTier ? 'Canjeando...' : 'Canjear'}
                      </Button>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="mb-8 border-2 border-amber-200 bg-amber-50">
            <CardContent className="pt-6">
              <p className="text-center text-gray-700 mb-4">
                Necesitas <span className="font-bold">{300 - pointsInfo.totalPoints}</span> puntos más para tu primer canje
              </p>
              <Link href="/menu">
                <Button className="w-full bg-amber-600 hover:bg-amber-700">
                  Ver Menú y Acumular Puntos
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Mis Vouchers Section */}
        <Card className="mb-8 border-2 border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-lg">Mis Vouchers</CardTitle>
            <CardDescription>
              {vouchers.length === 0 ? 'Aun no tienes vouchers' : `Tienes ${vouchers.filter(v => v.status === 'active').length} voucher(s) activo(s)`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {vouchers.length === 0 ? (
              <div className="text-center py-6">
                <div className="text-3xl mb-2">🎫</div>
                <p className="text-gray-700 mb-4">No tienes vouchers aun</p>
                <p className="text-sm text-gray-600 mb-4">Cuando canjees puntos, tus vouchers aparecerán aquí</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Resumen rápido */}
                <div className="grid grid-cols-2 gap-3 mb-4 md:grid-cols-3">
                  <div className="bg-white p-3 rounded-lg border border-blue-200 text-center">
                    <p className="text-sm text-gray-600">Activos</p>
                    <p className="text-2xl font-bold text-blue-600">{vouchers.filter(v => v.status === 'active').length}</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-blue-200 text-center">
                    <p className="text-sm text-gray-600">Usados</p>
                    <p className="text-2xl font-bold text-gray-600">{vouchers.filter(v => v.status === 'used').length}</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-blue-200 text-center">
                    <p className="text-sm text-gray-600">Expirados</p>
                    <p className="text-2xl font-bold text-red-600">{vouchers.filter(v => v.status === 'expired').length}</p>
                  </div>
                </div>

                {/* Lista de vouchers */}
                <div className="space-y-2">
                  {vouchers.map(voucher => (
                    <div
                      key={voucher.id}
                      className={`p-4 rounded-lg border-2 ${
                        voucher.status === 'active'
                          ? 'bg-white border-green-200'
                          : voucher.status === 'used'
                          ? 'bg-gray-100 border-gray-300 opacity-75'
                          : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-2xl">🍕</span>
                            <div>
                              <p className="font-bold text-gray-900">{voucher.rewardLabel}</p>
                              {voucher.minimumOrderAmount > 0 ? (
                                <p className="text-xs text-amber-700">Compra mínima: ${voucher.minimumOrderAmount.toLocaleString('es-CL')}</p>
                              ) : null}
                            </div>
                          </div>
                          <div className="mb-3 p-3 rounded-lg border border-dashed border-blue-300 bg-blue-50">
                            <p className="text-xs uppercase tracking-wide text-blue-700 mb-1">Codigo</p>
                            <p className="text-2xl md:text-3xl font-black text-blue-900 tracking-widest break-all">{voucher.code}</p>
                          </div>
                          <div className="text-xs text-gray-600 space-y-1">
                            <p>Creado: {voucher.createdAt}</p>
                            <p>Expira: {voucher.expiresAt}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge
                            className={
                              voucher.status === 'active'
                                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                : voucher.status === 'used'
                                ? 'bg-gray-400 text-white hover:bg-gray-500'
                                : 'bg-red-100 text-red-800 hover:bg-red-200'
                            }
                          >
                            {voucher.status === 'active'
                              ? '✓ Activo'
                              : voucher.status === 'used'
                              ? '✓ Usado'
                              : '✕ Expirado'}
                          </Badge>
                          <Button
                            type="button"
                            size="sm"
                            variant={copiedVoucherId === voucher.id ? 'default' : 'outline'}
                            onClick={() => handleCopyVoucherCode(voucher.id, voucher.code)}
                            disabled={voucher.status !== 'active'}
                            className="min-w-[130px]"
                          >
                            {copiedVoucherId === voucher.id ? (
                              <>
                                <Check className="mr-2 h-4 w-4" />
                                Copiado
                              </>
                            ) : (
                              <>
                                <Copy className="mr-2 h-4 w-4" />
                                Copiar código
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Como funciona</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-700">
              <div className="flex gap-2">
                <span className="text-amber-600 font-bold">1.</span>
                <p>Por cada $100 que gastes, ganas 1 punto</p>
              </div>
              <div className="flex gap-2">
                <span className="text-amber-600 font-bold">2.</span>
                <p>Los canjes son escalonados desde 300 puntos</p>
              </div>
              <div className="flex gap-2">
                <span className="text-amber-600 font-bold">3.</span>
                <p>Solo puedes usar 1 voucher por pedido y no combina con promos o combos</p>
              </div>
              <div className="flex gap-2">
                <span className="text-amber-600 font-bold">4.</span>
                <p>Los vouchers expiran en 15 días desde su creación</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

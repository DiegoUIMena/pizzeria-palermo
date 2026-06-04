'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/app/context/AuthContext'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/firebase'
import { doc, getDoc, collection, getDocs } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Copy, Check, Home, Pizza, Gift, Ticket, User, ShoppingBag, Sparkles } from 'lucide-react'
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
  const totalPoints = pointsInfo.totalPoints
  const nextTier = REDEMPTION_TIERS.find((tier) => tier.points > totalPoints)
  const progressPercent = nextTier ? Math.min(100, Math.round((totalPoints / nextTier.points) * 100)) : 100
  const pointsToNext = nextTier ? Math.max(0, nextTier.points - totalPoints) : 0
  const activeVouchers = vouchers.filter((voucher) => voucher.status === 'active')
  const usedVouchers = vouchers.filter((voucher) => voucher.status === 'used')
  const expiredVouchers = vouchers.filter((voucher) => voucher.status === 'expired')
  const primaryVoucher = activeVouchers[0]

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
      
      try {
        const vouchersSnap = await getDocs(vouchersRef)
        
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
          status: (doc.data().status || (doc.data().used ? 'used' : 'active')) as 'active' | 'used' | 'expired',
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
    <div className="min-h-screen bg-[#FFF3DD] text-[#1F2937]">
      <div className="relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(#F4D7B2 1px, transparent 1px), radial-gradient(#FAD9D7 1px, transparent 1px)',
            backgroundSize: '36px 36px, 64px 64px',
            backgroundPosition: '0 0, 16px 20px',
          }}
        />
        <div className="relative">
          <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 lg:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#C7352E] text-white shadow-sm">
                <span className="text-lg font-black">P</span>
              </div>
              <div className="leading-tight">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#C7352E]">Palermo</p>
                <p className="text-base font-bold">Pizzería</p>
              </div>
            </div>
            <nav className="hidden items-center gap-6 text-sm font-semibold text-[#1F2937] lg:flex">
              <Link href="/" className="hover:text-[#C7352E]">Inicio</Link>
              <Link href="/menu" className="hover:text-[#C7352E]">Menú</Link>
              <Link href="/promociones" className="hover:text-[#C7352E]">Promociones</Link>
              <span className="rounded-full bg-[#C7352E]/10 px-3 py-1 text-[#C7352E]">Puntos Palermo</span>
              <Link href="/pedidos" className="hover:text-[#C7352E]">Pedidos</Link>
            </nav>
            <div className="hidden items-center gap-3 lg:flex">
              <Button variant="outline" className="border-[#C7352E] text-[#C7352E] hover:bg-[#C7352E]/10">
                Mi cuenta
              </Button>
              <Button className="bg-[#C7352E] text-white hover:bg-[#b12d27]">
                <ShoppingBag className="mr-2 h-4 w-4" />
                Carrito
              </Button>
            </div>
          </header>

          <main className="mx-auto w-full max-w-6xl px-4 pb-24 lg:px-6">
            <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <PointsHero
                totalPoints={totalPoints}
                redemptionsAvailable={pointsInfo.redemptionsAvailable}
              />
              <div className="relative flex flex-col gap-4">
                <PointsSummaryCard totalPoints={totalPoints} />
                <NextRewardProgress
                  progressPercent={progressPercent}
                  pointsToNext={pointsToNext}
                  nextTier={nextTier}
                />
              </div>
            </section>

            <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <RewardsCarousel
                tiers={REDEMPTION_TIERS}
                totalPoints={totalPoints}
                redeemingPoints={redeemingPoints}
                onRedeem={handleRedeemTier}
              />
              <VoucherSummary
                vouchers={vouchers}
                activeCount={activeVouchers.length}
                usedCount={usedVouchers.length}
                expiredCount={expiredVouchers.length}
                primaryVoucher={primaryVoucher}
                copiedVoucherId={copiedVoucherId}
                onCopy={handleCopyVoucherCode}
              />
            </section>

            <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
              <HowItWorksCard />
              <div className="relative overflow-hidden rounded-[28px] border border-[#F3D8C2] bg-white/80 p-6 shadow-[0_20px_50px_rgba(199,53,46,0.12)]">
                <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#FDE2C7]" />
                <div className="absolute -bottom-10 -left-10 h-28 w-28 rounded-full bg-[#F9D1D1]" />
                <div className="relative z-10 flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-[#1FA652]/10 p-2 text-[#1FA652]">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-semibold text-[#1F2937]">Sumá más puntos con cada pedido</p>
                  </div>
                  <p className="text-sm text-[#6B7280]">
                    Elegí tus favoritos del menú y disfrutá beneficios exclusivos. Cada $100 te suma un nuevo punto.
                  </p>
                  <Link href="/menu">
                    <Button className="w-full rounded-full bg-[#C7352E] text-white hover:bg-[#b12d27]">
                      Ver menú y acumular
                    </Button>
                  </Link>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>

      <nav className="fixed bottom-4 left-1/2 z-50 w-[92%] max-w-md -translate-x-1/2 rounded-full bg-white/90 px-4 py-3 shadow-[0_18px_40px_rgba(31,41,55,0.15)] backdrop-blur lg:hidden">
        <div className="flex items-center justify-between text-xs font-semibold text-[#6B7280]">
          <Link href="/" className="flex flex-col items-center gap-1 text-[#6B7280]">
            <Home className="h-4 w-4" />
            Inicio
          </Link>
          <Link href="/menu" className="flex flex-col items-center gap-1 text-[#6B7280]">
            <Pizza className="h-4 w-4" />
            Menú
          </Link>
          <div className="flex flex-col items-center gap-1 text-[#C7352E]">
            <Gift className="h-4 w-4" />
            Puntos
          </div>
          <Link href="/pedidos" className="flex flex-col items-center gap-1 text-[#6B7280]">
            <Ticket className="h-4 w-4" />
            Pedidos
          </Link>
          <Link href="/perfil" className="flex flex-col items-center gap-1 text-[#6B7280]">
            <User className="h-4 w-4" />
            Cuenta
          </Link>
        </div>
      </nav>
    </div>
  )
}

function PointsHero({ totalPoints, redemptionsAvailable }: { totalPoints: number; redemptionsAvailable: number }) {
  const [hideMascot, setHideMascot] = useState(false)

  return (
    <div className="relative overflow-hidden rounded-[32px] border border-[#F2D7BF] bg-white/90 p-6 shadow-[0_24px_60px_rgba(199,53,46,0.12)]">
      <div className="absolute -left-10 -top-10 h-24 w-24 rounded-full bg-[#F9D1D1]" />
      <div className="absolute right-10 top-6 h-10 w-10 rounded-full bg-[#FDE2C7]" />
      <div className="relative z-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[#FDEDEB] px-3 py-1 text-xs font-semibold text-[#C7352E]">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#C7352E] text-white">P</span>
            Club Palermo
          </div>
          <h1 className="mt-4 text-3xl font-black text-[#C7352E] lg:text-4xl">Puntos Palermo</h1>
          <p className="mt-3 text-sm text-[#6B7280] lg:text-base">
            Comprá, sumá puntos y canjealos por premios increíbles.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <div className="flex items-center gap-3 rounded-full bg-white px-4 py-2 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#D9A441]/20 text-[#D9A441]">
                <span className="text-lg font-black">P</span>
              </div>
              <div>
                <p className="text-xs uppercase text-[#9CA3AF]">Mis puntos</p>
                <p className="text-2xl font-black text-[#1F2937]">{totalPoints.toLocaleString('es-CL')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-full bg-white px-4 py-2 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1FA652]/20 text-[#1FA652]">
                <Gift className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase text-[#9CA3AF]">Canjes</p>
                <p className="text-2xl font-black text-[#1F2937]">{redemptionsAvailable}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="relative flex items-end justify-center">
          <div className="absolute -right-6 bottom-12 hidden h-16 w-16 rounded-full bg-[#FDE2C7] lg:block" />
          <div className="relative flex w-full max-w-xs flex-col items-center rounded-[28px] bg-[#C7352E] px-5 py-6 text-white shadow-[0_24px_60px_rgba(199,53,46,0.35)]">
            <div className="absolute -left-10 top-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#D9A441] text-white shadow-lg">
              <span className="text-xl font-black">P</span>
            </div>
            <p className="text-xs uppercase tracking-wide text-white/80">Mis puntos</p>
            <p className="text-4xl font-black tracking-tight">{totalPoints.toLocaleString('es-CL')}</p>
            <p className="mt-2 text-xs text-white/80">1 punto = $100 de compra</p>
          </div>
          <div className="absolute -right-4 -bottom-8 hidden lg:block">
            <div className="relative h-40 w-40">
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-[#FDE2C7] text-center text-xs font-semibold text-[#C7352E]">
                Mascota Palermo
              </div>
              <img
                src="/mascota-palermo.svg"
                alt="Mascota Palermo"
                className={`relative h-40 w-auto object-contain drop-shadow ${hideMascot ? 'hidden' : ''}`}
                onError={() => setHideMascot(true)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PointsSummaryCard({ totalPoints }: { totalPoints: number }) {
  return (
    <div className="rounded-[28px] border border-[#F2D7BF] bg-white/90 p-5 shadow-[0_18px_40px_rgba(199,53,46,0.12)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-[#9CA3AF]">Mis puntos</p>
          <p className="text-3xl font-black text-[#1F2937]">{totalPoints.toLocaleString('es-CL')}</p>
          <p className="text-xs text-[#6B7280]">1 punto = $100 de compra</p>
        </div>
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#D9A441]/20 text-[#D9A441]">
          <span className="text-2xl font-black">P</span>
        </div>
      </div>
    </div>
  )
}

function NextRewardProgress({
  progressPercent,
  pointsToNext,
  nextTier,
}: {
  progressPercent: number
  pointsToNext: number
  nextTier?: RedemptionTier
}) {
  return (
    <div className="rounded-[28px] border border-[#F2D7BF] bg-white/90 p-5 shadow-[0_18px_40px_rgba(199,53,46,0.12)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Próximo canje</p>
          <p className="text-xs text-[#6B7280]">
            {nextTier ? `Faltan ${pointsToNext} puntos para ${nextTier.label}` : '¡Ya podés canjear todos los tramos!'}
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1FA652]/15 text-[#1FA652]">
          <Sparkles className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-4">
        <div className="h-2 w-full rounded-full bg-[#F3E6D2]">
          <div
            className="h-2 rounded-full bg-[#1FA652] transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-[#6B7280]">
          <span>{progressPercent}%</span>
          <span>{nextTier ? `${nextTier.points} pts` : 'Meta completada'}</span>
        </div>
      </div>
    </div>
  )
}

function RewardsCarousel({
  tiers,
  totalPoints,
  redeemingPoints,
  onRedeem,
}: {
  tiers: RedemptionTier[]
  totalPoints: number
  redeemingPoints: number | null
  onRedeem: (points: number) => void
}) {
  const carouselRef = useRef<HTMLDivElement | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const updateActiveIndex = () => {
    const container = carouselRef.current
    if (!container) return

    const children = Array.from(container.children) as HTMLElement[]
    if (children.length === 0) return

    const scrollLeft = container.scrollLeft
    let closestIndex = 0
    let closestDistance = Number.POSITIVE_INFINITY

    children.forEach((child, index) => {
      const distance = Math.abs(child.offsetLeft - scrollLeft)
      if (distance < closestDistance) {
        closestDistance = distance
        closestIndex = index
      }
    })

    setActiveIndex(closestIndex)
  }

  useEffect(() => {
    updateActiveIndex()
    window.addEventListener('resize', updateActiveIndex)
    return () => window.removeEventListener('resize', updateActiveIndex)
  }, [tiers.length])

  return (
    <div className="rounded-[28px] border border-[#F2D7BF] bg-white/90 p-5 shadow-[0_18px_40px_rgba(199,53,46,0.12)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-bold">Canjea tus premios</p>
          <p className="text-xs text-[#6B7280]">Elegí el tramo perfecto</p>
        </div>
        <Link href="/menu" className="text-xs font-semibold text-[#C7352E]">
          Ver catálogo
        </Link>
      </div>
      <div
        ref={carouselRef}
        onScroll={updateActiveIndex}
        className="mt-4 flex gap-4 overflow-x-auto pb-4 lg:grid lg:grid-cols-4 lg:overflow-visible"
      >
        {tiers.map((tier) => {
          const canRedeem = totalPoints >= tier.points
          const isRedeemingThisTier = redeemingPoints === tier.points

          return (
            <div
              key={tier.points}
              className="min-w-[210px] flex-1 rounded-[22px] border border-[#F1D7C2] bg-white p-4 shadow-sm lg:min-w-0"
            >
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-[#1FA652]/10 px-3 py-1 text-xs font-semibold text-[#1FA652]">
                  {tier.points} pts
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#D9A441]/20 text-[#D9A441]">
                  <span className="text-sm font-black">P</span>
                </div>
              </div>
              <p className="mt-3 text-sm font-semibold text-[#1F2937]">{tier.label}</p>
              {tier.minimumOrderAmount ? (
                <p className="mt-1 text-[11px] text-[#A16207]">
                  Compra mínima ${tier.minimumOrderAmount.toLocaleString('es-CL')}
                </p>
              ) : null}
              <Button
                onClick={() => onRedeem(tier.points)}
                disabled={!canRedeem || redeemingPoints !== null}
                className={`mt-4 w-full rounded-full ${
                  canRedeem ? 'bg-[#1FA652] hover:bg-[#168a45]' : 'bg-[#E5E7EB] text-[#9CA3AF]'
                }`}
              >
                {isRedeemingThisTier ? 'Canjeando...' : 'Canjear'}
              </Button>
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex items-center justify-center gap-2 lg:hidden">
        {tiers.map((tier, index) => (
          <button
            key={tier.points}
            type="button"
            aria-label={`Ir al premio ${index + 1}`}
            onClick={() => {
              const container = carouselRef.current
              const child = container?.children[index] as HTMLElement | undefined
              if (container && child) {
                container.scrollTo({ left: child.offsetLeft, behavior: 'smooth' })
              }
            }}
            className={`h-2 w-2 rounded-full transition ${
              activeIndex === index ? 'bg-[#C7352E]' : 'bg-[#F1D7C2]'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

function VoucherSummary({
  vouchers,
  activeCount,
  usedCount,
  expiredCount,
  primaryVoucher,
  copiedVoucherId,
  onCopy,
}: {
  vouchers: Voucher[]
  activeCount: number
  usedCount: number
  expiredCount: number
  primaryVoucher?: Voucher
  copiedVoucherId: string | null
  onCopy: (voucherId: string, code: string) => void
}) {
  return (
    <div className="rounded-[28px] border border-[#F2D7BF] bg-white/90 p-5 shadow-[0_18px_40px_rgba(199,53,46,0.12)]">
      <div className="flex items-center justify-between">
        <p className="text-lg font-bold">Mis vouchers Palermo</p>
        <Link href="/perfil" className="text-xs font-semibold text-[#C7352E]">
          Ver historial
        </Link>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs font-semibold">
        <div className="rounded-[18px] border border-[#E6F4EC] bg-[#F1FBF5] p-3">
          <p className="text-[#1FA652]">Activos</p>
          <p className="text-lg font-black text-[#1FA652]">{activeCount}</p>
        </div>
        <div className="rounded-[18px] border border-[#FEF1D9] bg-[#FFF7E6] p-3">
          <p className="text-[#B45309]">Usados</p>
          <p className="text-lg font-black text-[#B45309]">{usedCount}</p>
        </div>
        <div className="rounded-[18px] border border-[#FDE2E2] bg-[#FFF1F1] p-3">
          <p className="text-[#DC2626]">Expirados</p>
          <p className="text-lg font-black text-[#DC2626]">{expiredCount}</p>
        </div>
      </div>

      {vouchers.length === 0 ? (
        <div className="mt-6 rounded-[20px] border border-dashed border-[#F2D7BF] bg-white p-6 text-center">
          <div className="text-3xl">🎁</div>
          <p className="mt-2 text-sm font-semibold">Tu primer voucher está por llegar</p>
          <p className="text-xs text-[#6B7280]">Canjea puntos y aparecerá en este espacio.</p>
        </div>
      ) : primaryVoucher ? (
        <div className="mt-6 rounded-[22px] border border-[#DFF3E7] bg-[#F4FFF7] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[#1F2937]">{primaryVoucher.rewardLabel}</p>
              {primaryVoucher.minimumOrderAmount > 0 ? (
                <p className="text-xs text-[#A16207]">
                  Compra mínima ${primaryVoucher.minimumOrderAmount.toLocaleString('es-CL')}
                </p>
              ) : null}
            </div>
            <Badge className="bg-[#1FA652]/15 text-[#1FA652] hover:bg-[#1FA652]/20">✓ Activo</Badge>
          </div>
          <div className="mt-4 rounded-[18px] border border-dashed border-[#A7E7BF] bg-white px-4 py-3">
            <p className="text-[10px] uppercase tracking-wide text-[#6B7280]">Código</p>
            <p className="text-2xl font-black tracking-widest text-[#1F2937]">{primaryVoucher.code}</p>
          </div>
          <div className="mt-4 flex flex-col gap-2 text-xs text-[#6B7280]">
            <p>Creado: {primaryVoucher.createdAt}</p>
            <p>Expira: {primaryVoucher.expiresAt}</p>
          </div>
          <Button
            type="button"
            onClick={() => onCopy(primaryVoucher.id, primaryVoucher.code)}
            className="mt-4 w-full rounded-full bg-[#1FA652] text-white hover:bg-[#168a45]"
          >
            {copiedVoucherId === primaryVoucher.id ? (
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
      ) : null}
    </div>
  )
}

function HowItWorksCard() {
  return (
    <div className="rounded-[28px] border border-[#F2D7BF] bg-white/90 p-6 shadow-[0_18px_40px_rgba(199,53,46,0.12)]">
      <p className="text-lg font-bold">¿Cómo funciona el club?</p>
      <div className="mt-4 grid gap-3 text-sm text-[#4B5563]">
        {[
          'Por cada $100 que gastes, ganas 1 punto.',
          'Los canjes son escalonados desde 300 puntos.',
          'Puedes usar 1 voucher por pedido y no combina con promos.',
          'Los vouchers expiran en 15 días desde su creación.',
        ].map((rule) => (
          <div key={rule} className="flex items-start gap-2">
            <span className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#1FA652]/15 text-xs font-bold text-[#1FA652]">
              ✓
            </span>
            <span>{rule}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

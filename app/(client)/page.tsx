import { Suspense } from "react"
import HeroBanner from "../components/HeroBanner"
import PromoSection from "../components/PromoSection"

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <HeroBanner />
      <Suspense fallback={<div className="text-center py-12 text-gray-600">Cargando promociones...</div>}>
        <PromoSection />
      </Suspense>
    </div>
  )
}

import { Suspense } from "react"
import PromoSection from "../components/PromoSection"

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Suspense fallback={<div className="text-center py-12 text-gray-600">Cargando promociones...</div>}>
        <PromoSection />
      </Suspense>
    </div>
  )
}

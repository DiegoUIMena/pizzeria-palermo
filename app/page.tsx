import { Suspense } from "react"
import Header from "./components/Header"
import HeroBanner from "./components/HeroBanner"
import PromoSection from "./components/PromoSection"
import Footer from "./components/Footer"

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <HeroBanner />
      <main>
        <Suspense fallback={<div className="text-center py-12 text-gray-600">Cargando promociones...</div>}>
          <PromoSection />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}

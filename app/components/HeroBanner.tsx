import { Button } from "@/components/ui/button"

export default function HeroBanner() {
  return (
    <section className="bg-gradient-to-br from-pink-500 via-pink-600 to-pink-700 py-16 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-black bg-opacity-20"></div>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="text-white">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 text-shadow-lg leading-tight">
              Tu PIZZERIA ARTESANAL,
              <span className="block text-pink-100">de BARRIO, con ONDA!</span>
            </h1>
          </div>
          <div className="relative">
            <div className="bg-white text-gray-800 p-8 rounded-2xl text-center shadow-2xl border border-gray-100">
              <h2 className="text-3xl font-bold mb-3 text-pink-600">PROMO TRIO ESPECIAL</h2>
              <p className="text-lg mb-4 text-gray-600">2 PIZZAS ESPECIALES FAMILIARES</p>
              <div className="text-5xl font-bold text-pink-600 mb-4">$22.990</div>
              <Button className="bg-pink-600 text-white hover:bg-pink-700 font-bold px-6 py-3 rounded-full shadow-md hover:shadow-lg transition-all">
                ¡QUIERO ESTA PROMO!
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

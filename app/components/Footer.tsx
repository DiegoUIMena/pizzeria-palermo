import Link from "next/link"
import Image from "next/image"
import { Instagram, Facebook } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function Footer() {
  return (
    <>

      {/* Imagen promocional arriba del footer - patrón repetido */}
      <div
        className="w-full"
        style={{
          backgroundImage: 'url(/banners/footer.jpg)',
          backgroundRepeat: 'repeat-x',
          backgroundSize: 'auto 100%',
          backgroundPosition: 'center',
          height: 'auto',
          minHeight: '100px'
        }}
      >
        <Image
          src="/banners/footer.jpg"
          alt="Promoción Pizzería Palermo"
          width={1200}
          height={300}
          className="invisible"
          quality={90}
        />
      </div>

      <footer className="bg-[#1a1a1a] py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col lg:flex-row justify-between items-start gap-12">
            {/* Lado izquierdo: Logo, Siguenos en, Redes Sociales */}
            <div className="flex flex-col items-center text-center w-full lg:w-auto flex-shrink-0 lg:-mt-8">
              <Image
                src="/iconos/logo_blanco.png"
                alt="Pizzería Palermo"
                width={273}
                height={273}
                className="h-auto object-contain"
                priority
              />
              <span className="text-gray-400 text-xs font-semibold -mt-4 uppercase tracking-wider">siguenos en:</span>
              <div className="flex flex-row space-x-7 mt-5 justify-center items-center">
                <Link href="https://www.facebook.com/palermopizzas.cl" target="_blank" rel="noopener noreferrer">
                  <Button
                    size="icon"
                    variant="outline"
                    className="rounded-full border-pink-500 text-pink-500 hover:bg-pink-500 hover:text-white transition-all duration-300 transform hover:scale-110"
                  >
                    <Facebook className="w-5 h-5" />
                  </Button>
                </Link>
                <Link href="https://www.instagram.com/palermopizzas.cl/" target="_blank" rel="noopener noreferrer">
                  <Button
                    size="icon"
                    variant="outline"
                    className="rounded-full border-pink-500 text-pink-500 hover:bg-pink-500 hover:text-white transition-all duration-300 transform hover:scale-110"
                  >
                    <Instagram className="w-5 h-5" />
                  </Button>
                </Link>
              </div>
              <span className="text-gray-400 text-xs font-semibold mt-6 uppercase tracking-wider">ESTAMOS EN:</span>
              <Link
                href="https://www.pedidosya.cl/restaurantes/los-andes/palermo-pizzas-6a596694-4122-4041-a507-793795a9b935-menu?origin=shop_list"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 block"
              >
                <Image
                  src="/iconos/pedidos_ya.svg"
                  alt="PedidosYa"
                  width={140}
                  height={40}
                  className="rounded-xl object-contain hover:scale-105 transition-transform duration-300 shadow-md"
                />
              </Link>
            </div>

            {/* Lado derecho: 5 Columnas de enlaces */}
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8 w-full">
              {/* Columna 1: Palermo Pizzas */}
              <div>
                <h4 className="font-bold text-white text-base mb-4 uppercase tracking-wider border-b border-gray-800 pb-2">Palermo Pizzas</h4>
                <div className="space-y-2">
                  <Link href="/nosotros" className="block text-gray-400 hover:text-pink-500 text-sm transition-colors duration-200">
                    Acerca de nosotros
                  </Link>
                  <Link href="/locales" className="block text-gray-400 hover:text-pink-500 text-sm transition-colors duration-200">
                    Local y Horarios
                  </Link>
                </div>
              </div>

              {/* Columna 2: Legal */}
              <div>
                <h4 className="font-bold text-white text-base mb-4 uppercase tracking-wider border-b border-gray-800 pb-2">Legal</h4>
                <div className="space-y-2">
                  <Link href="/terminos" className="block text-gray-400 hover:text-pink-500 text-sm transition-colors duration-200 leading-relaxed">
                    Terminos y condiciones
                  </Link>
                  <Link href="/privacidad" className="block text-gray-400 hover:text-pink-500 text-sm transition-colors duration-200 leading-relaxed">
                    Politica de privacidad y Tratamiento de datos personales
                  </Link>
                </div>
              </div>

              {/* Columna 3: Ayuda */}
              <div>
                <h4 className="font-bold text-white text-base mb-4 uppercase tracking-wider border-b border-gray-800 pb-2">Ayuda</h4>
                <div className="space-y-2">
                  <Link href="/preguntas-frecuentes" className="block text-gray-400 hover:text-pink-500 text-sm transition-colors duration-200">
                    Preguntas frecuentes
                  </Link>
                  <Link href="/contacto" className="block text-gray-400 hover:text-pink-500 text-sm transition-colors duration-200">
                    Contacto
                  </Link>
                </div>
              </div>

              {/* Columna 4: Menú */}
              <div>
                <h4 className="font-bold text-white text-base mb-4 uppercase tracking-wider border-b border-gray-800 pb-2">Menú</h4>
                <div className="space-y-2">
                  <Link href="/armar-pizza-nueva" className="block text-gray-400 hover:text-pink-500 text-sm transition-colors duration-200">
                    Arma tu pizza
                  </Link>
                  <Link href="/?category=vegetarianas" className="block text-gray-400 hover:text-pink-500 text-sm transition-colors duration-200">
                    Pizzas Vegetarianas
                  </Link>
                  <Link href="/?category=carne" className="block text-gray-400 hover:text-pink-500 text-sm transition-colors duration-200">
                    Pizzas Tradicionales
                  </Link>
                  <Link href="/?category=delmar" className="block text-gray-400 hover:text-pink-500 text-sm transition-colors duration-200">
                    Pizzas del mar
                  </Link>
                  <Link href="/?category=promos" className="block text-gray-400 hover:text-pink-500 text-sm transition-colors duration-200">
                    Promociones
                  </Link>
                  <Link href="/?category=acompanamientos" className="block text-gray-400 hover:text-pink-500 text-sm transition-colors duration-200">
                    Agregados
                  </Link>
                  <Link href="/?category=bebidas" className="block text-gray-400 hover:text-pink-500 text-sm transition-colors duration-200">
                    Bebidas
                  </Link>
                </div>
              </div>

              {/* Columna 5: Palermo Puntos */}
              <div>
                <h4 className="font-bold text-white text-base mb-4 uppercase tracking-wider border-b border-gray-800 pb-2">Palermo puntos</h4>
                <div className="space-y-2">
                  <Link href="/perfil/puntos" className="block text-gray-400 hover:text-pink-500 text-sm transition-colors duration-200">
                    Unete al programa
                  </Link>
                  <Link href="/preguntas-frecuentes" className="block text-gray-400 hover:text-pink-500 text-sm transition-colors duration-200">
                    Preguntas frecuentes
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Copyright Section */}
          <div className="mt-12 pt-6 border-t border-gray-800 text-center">
            <p className="text-gray-500 text-xs">
              &copy; {new Date().getFullYear()} Pizzería Palermo. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </footer>
    </>
  )
}

import Link from "next/link"
import { Instagram, Facebook } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function Footer() {
  return (
    <footer className="bg-gray-100 py-12">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Company Info */}
          <div>
            <h3 className="font-bold text-lg mb-4">Conócenos</h3>
            <div className="space-y-2">
              <Link href="/locales" className="block text-gray-600 hover:text-black">
                Locales y Horarios
              </Link>
              <Link href="/contacto" className="block text-gray-600 hover:text-black">
                Contacto
              </Link>
              <Link href="/nosotros" className="block text-gray-600 hover:text-black">
                Trabaja con Nosotros
              </Link>
              <Link href="/terminos" className="block text-gray-600 hover:text-black">
                Términos y Condiciones
              </Link>
              <Link href="/privacidad" className="block text-gray-600 hover:text-black">
                Política de privacidad
              </Link>
            </div>
          </div>

          {/* Social Media */}
          <div>
            <h3 className="font-bold text-lg mb-4">Redes sociales</h3>
            <div className="space-y-2">
              <Link
                href="https://www.instagram.com/palermopizzas.cl/"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-gray-600 hover:text-black"
              >
                Instagram
              </Link>
              <Link
                href="https://www.facebook.com/palermopizzas.cl"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-gray-600 hover:text-black"
              >
                Facebook
              </Link>
              <Link href="#" className="block text-gray-600 hover:text-black">
                TikTok
              </Link>
            </div>
          </div>

          {/* Account */}
          <div>
            <h3 className="font-bold text-lg mb-4">Mi cuenta</h3>
            <div className="space-y-2">
              <Link href="/pedidos" className="block text-gray-600 hover:text-black">
                Pedir
              </Link>
              <Link href="/auth" className="block text-gray-600 hover:text-black">
                Iniciar sesión
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="mt-8 pt-8 border-t border-gray-300 flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-4 mb-4 md:mb-0">
            <div className="bg-black text-pink-400 px-3 py-1 rounded font-bold">PIZZERÍA PALERMO</div>
          </div>

          <div className="flex space-x-4">
            <Link href="https://www.instagram.com/palermopizzas.cl/" target="_blank" rel="noopener noreferrer">
              <Button
                size="icon"
                variant="outline"
                className="rounded-full border-pink-400 text-pink-400 hover:bg-pink-400 hover:text-white"
              >
                <Instagram className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="https://www.facebook.com/palermopizzas.cl" target="_blank" rel="noopener noreferrer">
              <Button
                size="icon"
                variant="outline"
                className="rounded-full border-pink-400 text-pink-400 hover:bg-pink-400 hover:text-white"
              >
                <Facebook className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* WhatsApp Button */}
        <div className="fixed bottom-6 right-6">
          <Button size="icon" className="w-14 h-14 rounded-full bg-pink-400 hover:bg-pink-500 shadow-lg text-white">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488" />
            </svg>
          </Button>
        </div>
      </div>
    </footer>
  )
}

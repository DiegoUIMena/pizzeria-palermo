import Link from "next/link"
import Image from "next/image"
import { Instagram, Facebook } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ChatbotWidget } from "./ChatbotWidget"

export default function Footer() {
  return (
    <>
      {/* Chatbot Widget */}
      <ChatbotWidget />
      
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
          <div className="grid md:grid-cols-3 gap-8">
            {/* Company Info */}
            <div>
              <h3 className="font-bold text-lg mb-4 text-white">Conócenos</h3>
              <div className="space-y-2">
                <Link href="/locales" className="block text-gray-300 hover:text-pink-400">
                  Locales y Horarios
                </Link>
                <Link href="/contacto" className="block text-gray-300 hover:text-pink-400">
                  Contacto
                </Link>
                <Link href="/nosotros" className="block text-gray-300 hover:text-pink-400">
                  Trabaja con Nosotros
                </Link>
                <Link href="/terminos" className="block text-gray-300 hover:text-pink-400">
                  Términos y Condiciones
                </Link>
                <Link href="/privacidad" className="block text-gray-300 hover:text-pink-400">
                  Política de privacidad
                </Link>
              </div>
            </div>

            {/* Social Media */}
            <div>
              <h3 className="font-bold text-lg mb-4 text-white">Redes sociales</h3>
              <div className="space-y-2">
                <Link
                  href="https://www.instagram.com/palermopizzas.cl/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-gray-300 hover:text-pink-400"
                >
                  Instagram
                </Link>
                <Link
                  href="https://www.facebook.com/palermopizzas.cl"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-gray-300 hover:text-pink-400"
                >
                  Facebook
                </Link>
                <Link href="#" className="block text-gray-300 hover:text-pink-400">
                  TikTok
                </Link>
              </div>
            </div>

            {/* Account */}
            <div>
              <h3 className="font-bold text-lg mb-4 text-white">Mi cuenta</h3>
              <div className="space-y-2">
                <Link href="/pedidos" className="block text-gray-300 hover:text-pink-400">
                  Pedir
                </Link>
                <Link href="/auth" className="block text-gray-300 hover:text-pink-400">
                  Iniciar sesión
                </Link>
              </div>
            </div>
          </div>

          {/* Bottom Section */}
          <div className="mt-8 pt-8 border-t border-gray-600 flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-4 mb-4 md:mb-0">
              <div className="bg-pink-500 text-white px-3 py-1 rounded font-bold">PIZZERÍA PALERMO</div>
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

        {/* Chatbot Widget - Reemplaza el botón de WhatsApp */}
        {/* El widget se renderiza en su propia posición fixed */}
      </div>
    </footer>
    </>
  )
}

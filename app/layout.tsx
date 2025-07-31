import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import "./styles/map-markers.css" // Importar estilos para marcadores de mapa
import { FirebaseProvider } from "./context/FirebaseContext"
import { AuthProvider } from "./context/AuthContext"
import { CartProvider } from "./context/CartContext"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Pizzería Palermo - Las mejores pizzas artesanales",
  description:
    "Disfruta de nuestras deliciosas pizzas artesanales con ingredientes frescos. Pedidos online con delivery y retiro en local.",
  keywords: "pizza, pizzería, delivery, comida italiana, pedidos online",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.className}>
        <FirebaseProvider>
          <AuthProvider>
            <CartProvider>{children}</CartProvider>
          </AuthProvider>
        </FirebaseProvider>
      </body>
    </html>
  )
}

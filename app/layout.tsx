import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import "./styles/map-markers.css"
import { FirebaseProvider } from "./context/FirebaseContext"
import { AuthProvider } from "./context/AuthContext"
import { CartProvider } from "./context/CartContext"
import { ReactQueryProvider } from "./providers/ReactQueryProvider"
import DeliveryZonesInitializer from "./components/DeliveryZonesInitializer"
import { Toaster } from "@/components/ui/toaster"
import { ClientComponents } from "./components/ClientComponents"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Pizzeria Palermo - Las mejores pizzas artesanales",
  description:
    "Disfruta de nuestras deliciosas pizzas artesanales con ingredientes frescos. Pedidos online con delivery y retiro en local.",
  keywords: "pizza, pizzeria, delivery, comida italiana, pedidos online",
  generator: "v0.dev",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.className}>
        <ReactQueryProvider>
          <FirebaseProvider>
            <AuthProvider>
              <CartProvider>
                <ClientComponents />
                <DeliveryZonesInitializer />
                {children}
                <Toaster />
              </CartProvider>
            </AuthProvider>
          </FirebaseProvider>
        </ReactQueryProvider>
      </body>
    </html>
  )
}

import { ChatbotWidget } from "../../components/ChatbotWidget"

export default function SeguimientoPedidoGuestLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {children}
      <ChatbotWidget />
    </>
  )
}

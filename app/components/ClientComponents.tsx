"use client"

import { usePathname } from "next/navigation"
import ClosedBanner from "./ClosedBanner"
import FloatingOrderTracker from "./FloatingOrderTracker"
import { ChatbotWidget } from "./ChatbotWidget"

export function ClientComponents() {
  const pathname = usePathname()
  const isAdminPage = pathname?.startsWith("/admin")

  return (
    <>
      <ClosedBanner />
      <FloatingOrderTracker />
      {!isAdminPage && <ChatbotWidget />}
    </>
  )
}


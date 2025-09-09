'use client'

import type React from "react"
import { ThemeProvider } from "@/components/theme-provider"
import AdminHeader from "./components/AdminHeader"
import { AlarmsProvider } from "./context/AlarmsContext"
import GlobalOrderMonitor from "./components/GlobalOrderMonitor"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <AlarmsProvider>
          <AdminHeader />
          {/* Componente invisible que monitorea pedidos nuevos globalmente */}
          <GlobalOrderMonitor />
          <main className="flex-1 p-4">{children}</main>
        </AlarmsProvider>
      </ThemeProvider>
    </div>
  )
}

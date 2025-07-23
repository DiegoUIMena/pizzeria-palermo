'use client'

import type React from "react"
import { ThemeProvider } from "@/components/theme-provider"
import AdminHeader from "./components/AdminHeader"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <AdminHeader />
        <main className="flex-1 p-4">{children}</main>
      </ThemeProvider>
    </div>
  )
}

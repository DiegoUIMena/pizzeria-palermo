'use client'

import React from "react"
import Header from "../components/Header"
import Footer from "../components/Footer"
import ClosedBanner from "../components/ClosedBanner"

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <ClosedBanner />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}

"use client"

import { useEffect, useRef } from "react"

interface VentasChartProps {
  periodo: string
}

export default function VentasChart({ periodo }: VentasChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    const ctx = canvasRef.current.getContext("2d")
    if (!ctx) return

    // Limpiar canvas
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)

    // Configuración
    const width = canvasRef.current.width
    const height = canvasRef.current.height
    const padding = 40
    const chartWidth = width - padding * 2
    const chartHeight = height - padding * 2

    // Datos simulados según el período
    let labels: string[] = []
    let data: number[] = []

    switch (periodo) {
      case "semana":
        labels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
        data = [320000, 280000, 350000, 420000, 580000, 650000, 450000]
        break
      case "mes":
        labels = ["Sem 1", "Sem 2", "Sem 3", "Sem 4"]
        data = [1850000, 2100000, 1950000, 2350000]
        break
      case "trimestre":
        labels = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
        data = [
          1850000, 1750000, 2100000, 1950000, 2350000, 2450000, 2650000, 2550000, 2750000, 2850000, 3050000, 3250000,
        ]
        break
      case "anual":
        labels = ["2020", "2021", "2022", "2023", "2024", "2025"]
        data = [18500000, 21000000, 24500000, 28000000, 32500000, 12450000]
        break
    }

    // Encontrar el valor máximo para escalar
    const maxValue = Math.max(...data) * 1.1

    // Dibujar ejes
    ctx.beginPath()
    ctx.strokeStyle = "#e5e7eb"
    ctx.lineWidth = 1
    ctx.moveTo(padding, padding)
    ctx.lineTo(padding, height - padding)
    ctx.lineTo(width - padding, height - padding)
    ctx.stroke()

    // Dibujar líneas de cuadrícula horizontales
    const gridLines = 5
    ctx.textAlign = "right"
    ctx.font = "10px Arial"
    ctx.fillStyle = "#9ca3af"

    for (let i = 0; i <= gridLines; i++) {
      const y = padding + (chartHeight / gridLines) * i
      const value = Math.round(maxValue - (maxValue / gridLines) * i)

      ctx.beginPath()
      ctx.strokeStyle = "#f3f4f6"
      ctx.moveTo(padding, y)
      ctx.lineTo(width - padding, y)
      ctx.stroke()

      // Etiquetas del eje Y (valores)
      ctx.fillText(formatCurrency(value), padding - 5, y + 3)
    }

    // Dibujar barras y etiquetas del eje X
    const barWidth = chartWidth / labels.length / 2
    ctx.textAlign = "center"

    for (let i = 0; i < labels.length; i++) {
      const x = padding + (chartWidth / labels.length) * (i + 0.5)
      const barHeight = (data[i] / maxValue) * chartHeight
      const y = height - padding - barHeight

      // Dibujar barra
      const gradient = ctx.createLinearGradient(0, y, 0, height - padding)
      gradient.addColorStop(0, "#ec4899")
      gradient.addColorStop(1, "#f472b6")

      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.roundRect(x - barWidth / 2, y, barWidth, barHeight, [4, 4, 0, 0])
      ctx.fill()

      // Etiquetas del eje X
      ctx.fillStyle = "#4b5563"
      ctx.fillText(labels[i], x, height - padding + 15)

      // Valores sobre las barras
      ctx.fillStyle = "#6b7280"
      ctx.font = "10px Arial"
      ctx.fillText(formatCurrency(data[i], true), x, y - 5)
    }
  }, [periodo])

  // Función para formatear moneda
  const formatCurrency = (value: number, short = false): string => {
    if (short) {
      if (value >= 1000000) {
        return `$${(value / 1000000).toFixed(1)}M`
      } else if (value >= 1000) {
        return `$${(value / 1000).toFixed(0)}K`
      }
      return `$${value}`
    }
    return `$${value.toLocaleString()}`
  }

  return (
    <div className="w-full h-80 bg-white">
      <canvas ref={canvasRef} width={800} height={400} className="w-full h-full"></canvas>
    </div>
  )
}

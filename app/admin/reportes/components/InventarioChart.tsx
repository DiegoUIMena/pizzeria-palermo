"use client"

import { useEffect, useRef } from "react"

export default function InventarioChart() {
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

    // Datos simulados
    const data = [
      { name: "Queso Mozzarella", actual: 2, minimo: 5, maximo: 20 },
      { name: "Pepperoni", actual: 1, minimo: 3, maximo: 15 },
      { name: "Masa para Pizza", actual: 8, minimo: 15, maximo: 50 },
      { name: "Salsa de Tomate", actual: 12, minimo: 6, maximo: 30 },
      { name: "Champiñones", actual: 1, minimo: 4, maximo: 10 },
      { name: "Aceitunas", actual: 0, minimo: 2, maximo: 8 },
      { name: "Pimientos", actual: 6, minimo: 3, maximo: 12 },
      { name: "Jamón", actual: 4, minimo: 2, maximo: 10 },
    ]

    // Encontrar el valor máximo para escalar
    const maxValue = Math.max(...data.map((item) => item.maximo)) * 1.1

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
      ctx.fillText(value.toString(), padding - 5, y + 3)
    }

    // Dibujar barras y etiquetas del eje X
    const barWidth = chartWidth / data.length / 3
    const groupWidth = barWidth * 3
    ctx.textAlign = "center"

    for (let i = 0; i < data.length; i++) {
      const item = data[i]
      const x = padding + (chartWidth / data.length) * (i + 0.5)

      // Barra de stock mínimo
      const minHeight = (item.minimo / maxValue) * chartHeight
      const minY = height - padding - minHeight

      ctx.fillStyle = "#fcd34d"
      ctx.beginPath()
      ctx.roundRect(x - groupWidth / 2, minY, barWidth, minHeight, [4, 4, 0, 0])
      ctx.fill()

      // Barra de stock actual
      const actualHeight = (item.actual / maxValue) * chartHeight
      const actualY = height - padding - actualHeight

      ctx.fillStyle = item.actual < item.minimo ? "#ef4444" : "#10b981"
      ctx.beginPath()
      ctx.roundRect(x - barWidth / 2, actualY, barWidth, actualHeight, [4, 4, 0, 0])
      ctx.fill()

      // Barra de stock máximo
      const maxHeight = (item.maximo / maxValue) * chartHeight
      const maxY = height - padding - maxHeight

      ctx.fillStyle = "#93c5fd"
      ctx.beginPath()
      ctx.roundRect(x + barWidth / 2, maxY, barWidth, maxHeight, [4, 4, 0, 0])
      ctx.fill()

      // Etiquetas del eje X
      ctx.fillStyle = "#4b5563"
      ctx.font = "10px Arial"
      const shortName = item.name.length > 10 ? item.name.substring(0, 10) + "..." : item.name
      ctx.fillText(shortName, x, height - padding + 15)
    }

    // Leyenda
    const legendX = width - 200
    const legendY = 20
    const legendItemHeight = 20

    // Leyenda - Stock Actual
    ctx.fillStyle = "#10b981"
    ctx.fillRect(legendX, legendY, 15, 15)
    ctx.fillStyle = "#374151"
    ctx.textAlign = "left"
    ctx.font = "12px Arial"
    ctx.fillText("Stock Actual", legendX + 25, legendY + 12)

    // Leyenda - Stock Mínimo
    ctx.fillStyle = "#fcd34d"
    ctx.fillRect(legendX, legendY + legendItemHeight, 15, 15)
    ctx.fillStyle = "#374151"
    ctx.fillText("Stock Mínimo", legendX + 25, legendY + legendItemHeight + 12)

    // Leyenda - Stock Máximo
    ctx.fillStyle = "#93c5fd"
    ctx.fillRect(legendX, legendY + legendItemHeight * 2, 15, 15)
    ctx.fillStyle = "#374151"
    ctx.fillText("Stock Máximo", legendX + 25, legendY + legendItemHeight * 2 + 12)
  }, [])

  return (
    <div className="w-full h-80 bg-white">
      <canvas ref={canvasRef} width={800} height={400} className="w-full h-full"></canvas>
    </div>
  )
}

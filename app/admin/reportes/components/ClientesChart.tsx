"use client"

import { useEffect, useRef } from "react"

export default function ClientesChart() {
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
      { month: "Ene", nuevos: 45, recurrentes: 120 },
      { month: "Feb", nuevos: 52, recurrentes: 135 },
      { month: "Mar", nuevos: 48, recurrentes: 142 },
      { month: "Abr", nuevos: 61, recurrentes: 158 },
      { month: "May", nuevos: 55, recurrentes: 172 },
      { month: "Jun", nuevos: 67, recurrentes: 185 },
      { month: "Jul", nuevos: 72, recurrentes: 198 },
      { month: "Ago", nuevos: 78, recurrentes: 210 },
      { month: "Sep", nuevos: 68, recurrentes: 225 },
      { month: "Oct", nuevos: 75, recurrentes: 238 },
      { month: "Nov", nuevos: 82, recurrentes: 252 },
      { month: "Dic", nuevos: 87, recurrentes: 265 },
    ]

    // Encontrar el valor máximo para escalar
    const maxValue = Math.max(...data.map((item) => item.nuevos + item.recurrentes)) * 1.1

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

    // Dibujar líneas
    const drawLine = (data: { x: number; y: number }[], color: string) => {
      ctx.beginPath()
      ctx.moveTo(data[0].x, data[0].y)
      for (let i = 1; i < data.length; i++) {
        ctx.lineTo(data[i].x, data[i].y)
      }
      ctx.strokeStyle = color
      ctx.lineWidth = 3
      ctx.stroke()

      // Dibujar puntos
      data.forEach((point) => {
        ctx.beginPath()
        ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI)
        ctx.fillStyle = color
        ctx.fill()
        ctx.strokeStyle = "#ffffff"
        ctx.lineWidth = 2
        ctx.stroke()
      })
    }

    // Preparar datos para las líneas
    const totalPoints = data.map((item, i) => {
      const x = padding + (chartWidth / (data.length - 1)) * i
      const y = height - padding - ((item.nuevos + item.recurrentes) / maxValue) * chartHeight
      return { x, y }
    })

    const nuevosPoints = data.map((item, i) => {
      const x = padding + (chartWidth / (data.length - 1)) * i
      const y = height - padding - (item.nuevos / maxValue) * chartHeight
      return { x, y }
    })

    // Dibujar líneas
    drawLine(totalPoints, "#8b5cf6") // Morado para total
    drawLine(nuevosPoints, "#ec4899") // Rosa para nuevos

    // Dibujar etiquetas del eje X
    ctx.textAlign = "center"
    ctx.fillStyle = "#4b5563"
    data.forEach((item, i) => {
      const x = padding + (chartWidth / (data.length - 1)) * i
      ctx.fillText(item.month, x, height - padding + 15)
    })

    // Leyenda
    const legendX = width - 200
    const legendY = 20
    const legendItemHeight = 20

    // Leyenda - Total Clientes
    ctx.fillStyle = "#8b5cf6"
    ctx.fillRect(legendX, legendY, 15, 15)
    ctx.fillStyle = "#374151"
    ctx.textAlign = "left"
    ctx.font = "12px Arial"
    ctx.fillText("Total Clientes", legendX + 25, legendY + 12)

    // Leyenda - Clientes Nuevos
    ctx.fillStyle = "#ec4899"
    ctx.fillRect(legendX, legendY + legendItemHeight, 15, 15)
    ctx.fillStyle = "#374151"
    ctx.fillText("Clientes Nuevos", legendX + 25, legendY + legendItemHeight + 12)
  }, [])

  return (
    <div className="w-full h-80 bg-white">
      <canvas ref={canvasRef} width={800} height={400} className="w-full h-full"></canvas>
    </div>
  )
}

"use client"

import { useEffect, useRef } from "react"

interface ProductosChartProps {
  periodo: string
}

export default function ProductosChart({ periodo }: ProductosChartProps) {
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
    const centerX = width / 2
    const centerY = height / 2
    const radius = Math.min(centerX, centerY) - 40

    // Datos simulados según el período
    let data: { name: string; value: number; color: string }[] = []

    switch (periodo) {
      case "semana":
        data = [
          { name: "Pizza Suprema", value: 18.5, color: "#ec4899" },
          { name: "Pizza Hawaiana", value: 14.1, color: "#f472b6" },
          { name: "Promo Duo", value: 11.8, color: "#fb7185" },
          { name: "Pizza Pepperoni", value: 10.1, color: "#f43f5e" },
          { name: "Pizza Vegetariana", value: 7.4, color: "#e11d48" },
          { name: "Otros", value: 38.1, color: "#be123c" },
        ]
        break
      case "mes":
        data = [
          { name: "Pizza Suprema", value: 17.2, color: "#ec4899" },
          { name: "Pizza Hawaiana", value: 15.3, color: "#f472b6" },
          { name: "Promo Duo", value: 12.5, color: "#fb7185" },
          { name: "Pizza Pepperoni", value: 9.8, color: "#f43f5e" },
          { name: "Pizza Vegetariana", value: 8.1, color: "#e11d48" },
          { name: "Otros", value: 37.1, color: "#be123c" },
        ]
        break
      case "trimestre":
        data = [
          { name: "Pizza Suprema", value: 16.8, color: "#ec4899" },
          { name: "Pizza Hawaiana", value: 15.7, color: "#f472b6" },
          { name: "Promo Duo", value: 13.2, color: "#fb7185" },
          { name: "Pizza Pepperoni", value: 9.5, color: "#f43f5e" },
          { name: "Pizza Vegetariana", value: 8.5, color: "#e11d48" },
          { name: "Otros", value: 36.3, color: "#be123c" },
        ]
        break
      case "anual":
        data = [
          { name: "Pizza Suprema", value: 16.5, color: "#ec4899" },
          { name: "Pizza Hawaiana", value: 15.8, color: "#f472b6" },
          { name: "Promo Duo", value: 14.2, color: "#fb7185" },
          { name: "Pizza Pepperoni", value: 9.2, color: "#f43f5e" },
          { name: "Pizza Vegetariana", value: 8.8, color: "#e11d48" },
          { name: "Otros", value: 35.5, color: "#be123c" },
        ]
        break
    }

    // Dibujar gráfico de pastel
    let startAngle = 0
    data.forEach((item) => {
      // Calcular ángulos
      const sliceAngle = (2 * Math.PI * item.value) / 100

      // Dibujar sector
      ctx.beginPath()
      ctx.fillStyle = item.color
      ctx.moveTo(centerX, centerY)
      ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle)
      ctx.closePath()
      ctx.fill()

      // Calcular posición para la etiqueta
      const midAngle = startAngle + sliceAngle / 2
      const labelRadius = radius * 0.7
      const labelX = centerX + labelRadius * Math.cos(midAngle)
      const labelY = centerY + labelRadius * Math.sin(midAngle)

      // Dibujar etiqueta si el valor es suficientemente grande
      if (item.value > 8) {
        ctx.fillStyle = "#ffffff"
        ctx.font = "bold 12px Arial"
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText(`${item.value}%`, labelX, labelY)
      }

      startAngle += sliceAngle
    })

    // Dibujar círculo central (agujero)
    ctx.beginPath()
    ctx.fillStyle = "#ffffff"
    ctx.arc(centerX, centerY, radius * 0.4, 0, 2 * Math.PI)
    ctx.fill()

    // Dibujar leyenda
    const legendX = width - 150
    const legendY = 30
    const legendItemHeight = 25

    data.forEach((item, index) => {
      const y = legendY + index * legendItemHeight

      // Cuadrado de color
      ctx.fillStyle = item.color
      ctx.fillRect(legendX, y, 15, 15)

      // Texto
      ctx.fillStyle = "#374151"
      ctx.font = "12px Arial"
      ctx.textAlign = "left"
      ctx.fillText(`${item.name} (${item.value}%)`, legendX + 25, y + 12)
    })
  }, [periodo])

  return (
    <div className="w-full h-80 bg-white">
      <canvas ref={canvasRef} width={800} height={400} className="w-full h-full"></canvas>
    </div>
  )
}

"use client"

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

interface InventarioChartProps { data: { nombre: string; stockActual: number; stockMinimo: number; stockMaximo?: number }[] }

export default function InventarioChart({ data }: InventarioChartProps) {
  const chartData = data.map(i => ({
    nombre: i.nombre,
    actual: i.stockActual,
    minimo: i.stockMinimo,
    maximo: i.stockMaximo ?? Math.max(i.stockMinimo * 2, i.stockActual)
  }))
  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} barCategoryGap={16}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="nombre" tick={{ fontSize: 10 }} interval={0} height={60} angle={-25} textAnchor="end" />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="minimo" stackId="a" fill="#fcd34d" radius={[4,4,0,0]} />
          <Bar dataKey="actual" stackId="a" fill="#10b981" radius={[4,4,0,0]} />
          <Bar dataKey="maximo" stackId="a" fill="#93c5fd" radius={[4,4,0,0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

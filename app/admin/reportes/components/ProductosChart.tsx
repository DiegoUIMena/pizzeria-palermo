"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

export interface ProductoShare { name: string; value: number }
interface ProductosChartProps { data: ProductoShare[] }

const COLORS = ['#ec4899','#f472b6','#fb7185','#f43f5e','#e11d48','#be123c']

export default function ProductosChart({ data }: ProductosChartProps) {
  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={70} outerRadius={120} paddingAngle={2}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v:number)=>`${v}%`} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

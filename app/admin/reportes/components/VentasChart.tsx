"use client"

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

export interface VentasPoint { label: string; value: number }
interface VentasChartProps { data: VentasPoint[] }

export default function VentasChart({ data }: VentasChartProps) {
  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barSize={32}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v)=>`$${(v/1000).toFixed(0)}k`} />
          <Tooltip formatter={(v:number)=>`$${v.toLocaleString()}`} labelClassName="text-xs" />
          <Bar dataKey="value" radius={[6,6,0,0]} fill="#ec4899" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

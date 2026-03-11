"use client"

import { useEffect, useMemo, useState } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, TrendingUp, DollarSign, Plus, X, BarChart3, Printer } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

// Tipos
type DataPoint = { date: string; value: number } // date en formato ISO YYYY-MM-DD
type PeriodData = {
  id: string
  label: string
  type: 'month' | 'year'
  year: number
  month?: number // 0-based
  data: DataPoint[]
  color: string
  stats: {
    total: number
    average: number
    peak: number
    peakDate: string
  }
}

interface Props {
  getSalesSeries: (period: any, opts?: any) => any[]
  orders?: any[]
}

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

const COLORS = ['#2563eb', '#16a34a', '#dc2626', '#ea580c', '#9333ea', '#0891b2', '#ca8a04', '#db2777']

const CSV_YEARS = [2021, 2022, 2023, 2024, 2025] // Años con datos en CSV

export default function GeneralSalesReport({ getSalesSeries, orders = [] }: Props) {
  // Estado principal
  const [historicalData, setHistoricalData] = useState<Map<string, DataPoint[]>>(new Map())
  const [loading, setLoading] = useState(true)
  
  // Período principal (el que se muestra siempre)
  const [mainPeriod, setMainPeriod] = useState<PeriodData | null>(null)
  const [mainType, setMainType] = useState<'month' | 'year'>('month')
  const [mainYear, setMainYear] = useState(new Date().getFullYear())
  const [mainMonth, setMainMonth] = useState(new Date().getMonth())
  
  // Períodos de comparación
  const [comparisons, setComparisons] = useState<PeriodData[]>([])
  
  // Diálogo de comparación
  const [showDialog, setShowDialog] = useState(false)
  const [dialogType, setDialogType] = useState<'month' | 'year'>('month')
  const [dialogYear, setDialogYear] = useState(new Date().getFullYear() - 1)
  const [dialogMonth, setDialogMonth] = useState(new Date().getMonth())

  // Cargar datos históricos de CSV al montar
  useEffect(() => {
    loadHistoricalData()
  }, [])

  const loadHistoricalData = async () => {
    setLoading(true)
    const dataMap = new Map<string, DataPoint[]>()

    try {
      // Cargar cada CSV
      for (const year of CSV_YEARS) {
        const response = await fetch(`/ventas_${year}.csv`)
        if (!response.ok) continue
        
        const text = await response.text()
        const lines = text.trim().split('\n')
        
        for (const line of lines) {
          const [dateStr, valueStr] = line.split(';')
          if (!dateStr || !valueStr) continue
          
          // Parsear fecha DD-MM-YYYY
          const [day, month, yearPart] = dateStr.split('-').map(s => parseInt(s, 10))
          const isoDate = `${yearPart}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const value = parseInt(valueStr, 10)
          
          if (!dataMap.has(isoDate)) {
            dataMap.set(isoDate, [])
          }
          dataMap.get(isoDate)!.push({ date: isoDate, value })
        }
      }
      
      setHistoricalData(dataMap)
    } catch (error) {
      console.error('Error cargando datos históricos:', error)
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los datos históricos',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  // Actualizar período principal cuando cambian los selectores
  useEffect(() => {
    if (loading) return
    updateMainPeriod()
  }, [mainType, mainYear, mainMonth, historicalData, orders, loading])

  const updateMainPeriod = () => {
    const data = getPeriodData(mainType, mainYear, mainMonth)
    const stats = calculateStats(data)
    
    const period: PeriodData = {
      id: `main-${mainType}-${mainYear}-${mainMonth}`,
      label: mainType === 'year' 
        ? `${mainYear}` 
        : `${MONTHS[mainMonth]} ${mainYear}`,
      type: mainType,
      year: mainYear,
      month: mainType === 'month' ? mainMonth : undefined,
      data,
      color: COLORS[0],
      stats
    }
    
    setMainPeriod(period)
  }

  // Obtener datos para un período específico
  const getPeriodData = (type: 'month' | 'year', year: number, month?: number): DataPoint[] => {
    const points: DataPoint[] = []
    
    if (year >= 2021 && year <= 2025) {
      // Datos de CSV
      if (type === 'month' && month !== undefined) {
        // Obtener todos los días del mes
        const daysInMonth = new Date(year, month + 1, 0).getDate()
        for (let day = 1; day <= daysInMonth; day++) {
          const isoDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const dayData = historicalData.get(isoDate) || []
          const total = dayData.reduce((sum, p) => sum + p.value, 0)
          points.push({ date: isoDate, value: total })
        }
      } else {
        // Año completo: agregar por mes
        for (let m = 0; m < 12; m++) {
          const monthData = getMonthDataFromCSV(year, m)
          const total = monthData.reduce((sum, p) => sum + p.value, 0)
          const isoDate = `${year}-${String(m + 1).padStart(2, '0')}-01`
          points.push({ date: isoDate, value: total })
        }
      }
    } else {
      // Datos de Firestore (2026+)
      if (type === 'month' && month !== undefined) {
        const raw = getSalesSeries('mes', { 
          month, 
          year, 
          granularity: 'daily' 
        })
        
        return raw.map(p => {
          // Intentar extraer fecha ISO del label o date
          let isoDate = p.date || p.label
          if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
            // Si no es ISO, intentar construir desde day number
            const day = parseInt(p.label, 10)
            if (!isNaN(day)) {
              isoDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            }
          }
          return { date: isoDate, value: p.value || 0 }
        })
      } else {
        const raw = getSalesSeries('anual', { year })
        
        return raw.map(p => {
          let isoDate = p.date || p.label
          if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
            // Intentar parsear mes
            const monthIndex = MONTHS.findIndex(m => m.toLowerCase() === p.label.toLowerCase())
            if (monthIndex >= 0) {
              isoDate = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`
            }
          }
          return { date: isoDate, value: p.value || 0 }
        })
      }
    }
    
    return points
  }

  const getMonthDataFromCSV = (year: number, month: number): DataPoint[] => {
    const points: DataPoint[] = []
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    
    for (let day = 1; day <= daysInMonth; day++) {
      const isoDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const dayData = historicalData.get(isoDate) || []
      const total = dayData.reduce((sum, p) => sum + p.value, 0)
      points.push({ date: isoDate, value: total })
    }
    
    return points
  }

  // Calcular estadísticas de un período
  const calculateStats = (data: DataPoint[]) => {
    if (!data.length) {
      return { total: 0, average: 0, peak: 0, peakDate: '' }
    }
    
    const total = data.reduce((sum, p) => sum + p.value, 0)
    const average = total / data.length
    
    let peak = 0
    let peakDate = ''
    data.forEach(p => {
      if (p.value > peak) {
        peak = p.value
        peakDate = p.date
      }
    })
    
    return { total, average, peak, peakDate }
  }

  // Agregar comparación
  const handleAddComparison = () => {
    const id = `${dialogType}-${dialogYear}-${dialogMonth}`
    
    // Verificar si ya existe
    if (comparisons.find(c => c.id === id)) {
      toast({
        title: 'Ya existe',
        description: 'Este período ya está en la comparación',
        variant: 'destructive'
      })
      return
    }
    
    const data = getPeriodData(dialogType, dialogYear, dialogMonth)
    const stats = calculateStats(data)
    
    const newComparison: PeriodData = {
      id,
      label: dialogType === 'year' 
        ? `${dialogYear}` 
        : `${MONTHS[dialogMonth]} ${dialogYear}`,
      type: dialogType,
      year: dialogYear,
      month: dialogType === 'month' ? dialogMonth : undefined,
      data,
      color: COLORS[comparisons.length + 1] || COLORS[0],
      stats
    }
    
    setComparisons([...comparisons, newComparison])
    setShowDialog(false)
    
    toast({
      title: 'Comparación agregada',
      description: `${newComparison.label} agregado exitosamente`
    })
  }

  // Remover comparación
  const removeComparison = (id: string) => {
    setComparisons(comparisons.filter(c => c.id !== id))
  }

  // Función para imprimir el análisis
  const handlePrint = () => {
    window.print()
  }

  // Preparar datos para el gráfico
  const chartData = useMemo(() => {
    if (!mainPeriod) return []
    
    const allPeriods = [mainPeriod, ...comparisons]
    const dataMap = new Map<string, any>()
    
    if (mainType === 'month') {
      // Vista mensual: alinear por día del mes
      const maxDays = Math.max(...allPeriods.map(p => p.data.length))
      
      for (let day = 1; day <= maxDays; day++) {
        const row: any = { label: day.toString() }
        
        allPeriods.forEach((period, idx) => {
          // Buscar el punto que corresponde a este día
          // Parsear la fecha ISO directamente sin usar Date() para evitar problemas de zona horaria
          const point = period.data.find(p => {
            if (!p.date) return false
            // Extraer el día de la fecha ISO YYYY-MM-DD
            const dateParts = p.date.split('-')
            if (dateParts.length !== 3) return false
            const dayNum = parseInt(dateParts[2], 10)
            return dayNum === day
          })
          row[`v${idx}`] = point?.value || 0
        })
        
        dataMap.set(day.toString(), row)
      }
    } else {
      // Vista anual: alinear por mes
      MONTHS.forEach((monthName, monthIdx) => {
        const row: any = { label: monthName }
        
        allPeriods.forEach((period, idx) => {
          // Buscar el punto que corresponde a este mes
          // Parsear la fecha ISO directamente sin usar Date() para evitar problemas de zona horaria
          const point = period.data.find(p => {
            if (!p.date) return false
            // Extraer el mes de la fecha ISO YYYY-MM-DD
            const dateParts = p.date.split('-')
            if (dateParts.length !== 3) return false
            const monthNum = parseInt(dateParts[1], 10) - 1 // Convertir a 0-based
            return monthNum === monthIdx
          })
          row[`v${idx}`] = point?.value || 0
        })
        
        dataMap.set(monthName, row)
      })
    }
    
    return Array.from(dataMap.values())
  }, [mainPeriod, comparisons, mainType])

  // Formatear moneda
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(value)
  }

  // Formatear fecha
  const formatDate = (isoDate: string) => {
    if (!isoDate) return ''
    const [year, month, day] = isoDate.split('-').map(s => parseInt(s, 10))
    return `${MONTHS[month - 1]} ${year}`
  }

  // Componente de Tooltip personalizado
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null

    // Para vista mensual, mostrar día de la semana para cada período
    if (mainType === 'month') {
      return (
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          border: '1px solid #e5e7eb',
          borderRadius: '6px',
          padding: '12px'
        }}>
          <div style={{ marginBottom: '8px' }}>
            {payload.map((entry: any, index: number) => {
              const period = allPeriods[index]
              if (!period || entry.value === undefined) return null

              const day = parseInt(label)
              if (isNaN(day)) return null

              // Construir fecha completa para este período (usar constructor con parámetros para evitar problemas de zona horaria)
              const date = new Date(period.year, period.month ?? 0, day)
              const dayName = date.toLocaleDateString('es-ES', { weekday: 'long' })
              const dayNameCapitalized = dayName.charAt(0).toUpperCase() + dayName.slice(1)

              return (
                <div key={index} style={{ marginBottom: index < payload.length - 1 ? '6px' : '0' }}>
                  <div style={{ 
                    color: index === 0 ? '#000' : '#666',
                    fontWeight: index === 0 ? 'bold' : 'normal',
                    fontSize: index === 0 ? '13px' : '12px',
                    marginBottom: '2px'
                  }}>
                    {dayNameCapitalized} {day} de {MONTHS[period.month ?? 0]} {period.year}
                  </div>
                  <div style={{ 
                    color: entry.color,
                    fontWeight: 'bold',
                    fontSize: '14px'
                  }}>
                    {formatCurrency(entry.value)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    // Para vista anual, mantener formato simple
    return (
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        border: '1px solid #e5e7eb',
        borderRadius: '6px',
        padding: '12px'
      }}>
        <div style={{ color: '#000', fontWeight: 'bold', marginBottom: '8px' }}>
          {label}
        </div>
        {payload.map((entry: any, index: number) => (
          <div key={index} style={{ 
            color: entry.color,
            fontWeight: 'bold',
            marginBottom: index < payload.length - 1 ? '4px' : '0'
          }}>
            {allPeriods[index]?.label}: {formatCurrency(entry.value)}
          </div>
        ))}
      </div>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
              <p className="text-muted-foreground">Cargando datos históricos...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const allPeriods = mainPeriod ? [mainPeriod, ...comparisons] : []

  return (
    <div className="space-y-6" id="report-container">
      {/* Selector de Período Principal */}
      <Card className="no-print">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Período Principal
          </CardTitle>
          <CardDescription>
            Selecciona el período base que deseas analizar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Tipo de Vista</label>
              <Select 
                value={mainType} 
                onValueChange={(v) => setMainType(v as 'month' | 'year')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Por Mes</SelectItem>
                  <SelectItem value="year">Por Año</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {mainType === 'month' && (
              <div>
                <label className="text-sm font-medium mb-2 block">Mes</label>
                <Select 
                  value={mainMonth.toString()} 
                  onValueChange={(v) => setMainMonth(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((month, idx) => (
                      <SelectItem key={idx} value={idx.toString()}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div>
              <label className="text-sm font-medium mb-2 block">Año</label>
              <Select 
                value={mainYear.toString()} 
                onValueChange={(v) => setMainYear(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 6 }, (_, i) => 2021 + i).map(y => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Métricas del Período Principal */}
      {mainPeriod && (
        <div className="no-print grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Ventas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(mainPeriod.stats.total)}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Promedio {mainType === 'month' ? 'Diario' : 'Mensual'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(mainPeriod.stats.average)}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pico de Ventas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {formatCurrency(mainPeriod.stats.peak)}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Fecha del Pico
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold text-muted-foreground">
                {formatDate(mainPeriod.stats.peakDate)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Gráfico Comparativo */}
      <Card className="print-section" id="chart-section">
        <CardHeader className="print-header">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 no-print-icon" />
                Análisis Comparativo
              </CardTitle>
              <CardDescription>
                {mainType === 'month' ? 'Ventas diarias' : 'Ventas mensuales'} - {mainPeriod?.label}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={handlePrint} size="sm" variant="outline">
                <Printer className="h-4 w-4 mr-2" />
                Imprimir
              </Button>
              <Button onClick={() => setShowDialog(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Agregar Comparación
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Comparaciones activas */}
          {comparisons.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              <Badge variant="default" className="text-sm">
                {mainPeriod?.label} (Principal)
              </Badge>
              {comparisons.map((comp) => (
                <Badge 
                  key={comp.id} 
                  variant="secondary"
                  className="text-sm cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
                  onClick={() => removeComparison(comp.id)}
                >
                  {comp.label}
                  <X className="h-3 w-3 ml-1" />
                </Badge>
              ))}
            </div>
          )}
          
          {/* Gráfico */}
          <div className="h-[500px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="label" 
                  tick={{ fontSize: 14 }}
                  angle={mainType === 'month' ? 0 : -45}
                  textAnchor={mainType === 'month' ? 'middle' : 'end'}
                  height={mainType === 'month' ? 30 : 60}
                />
                <YAxis 
                  tick={{ fontSize: 14 }}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  content={<CustomTooltip />}
                />
                <Legend 
                  wrapperStyle={{ paddingTop: '20px', textAlign: 'center', display: 'flex', justifyContent: 'center' }}
                  formatter={(value, entry, index) => allPeriods[index]?.label || value}
                />
                {allPeriods.map((period, idx) => (
                  <Line
                    key={period.id}
                    type="monotone"
                    dataKey={`v${idx}`}
                    stroke={period.color}
                    strokeWidth={idx === 0 ? 3 : 2}
                    dot={mainType === 'year'}
                    name={period.label}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Tabla Comparativa de Estadísticas */}
      {comparisons.length > 0 && (
        <Card className="print-section" id="table-section">
          <CardHeader className="print-header">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 no-print-icon" />
              Comparación de Métricas
            </CardTitle>
            <CardDescription>
              Comparación detallada entre los períodos seleccionados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Período</th>
                    <th className="text-right py-3 px-4 font-medium">Total</th>
                    <th className="text-right py-3 px-4 font-medium">Promedio</th>
                    <th className="text-right py-3 px-4 font-medium">Pico</th>
                    <th className="text-right py-3 px-4 font-medium">vs Principal</th>
                  </tr>
                </thead>
                <tbody>
                  {allPeriods.map((period, idx) => {
                    const vsMain = idx === 0 ? 0 : 
                      ((period.stats.total - mainPeriod!.stats.total) / mainPeriod!.stats.total) * 100
                    
                    return (
                      <tr key={period.id} className="border-b">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: period.color }}
                            />
                            <span className={idx === 0 ? 'font-semibold' : ''}>
                              {period.label}
                            </span>
                          </div>
                        </td>
                        <td className="text-right py-3 px-4 font-mono">
                          {formatCurrency(period.stats.total)}
                        </td>
                        <td className="text-right py-3 px-4 font-mono">
                          {formatCurrency(period.stats.average)}
                        </td>
                        <td className="text-right py-3 px-4 font-mono">
                          {formatCurrency(period.stats.peak)}
                        </td>
                        <td className="text-right py-3 px-4">
                          {idx === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span className={vsMain >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {vsMain >= 0 ? '+' : ''}{vsMain.toFixed(1)}%
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Diálogo para agregar comparación */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Período de Comparación</DialogTitle>
            <DialogDescription>
              Selecciona un período para comparar con {mainPeriod?.label}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Tipo</label>
              <Select 
                value={dialogType} 
                onValueChange={(v) => setDialogType(v as 'month' | 'year')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Mensual</SelectItem>
                  <SelectItem value="year">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {dialogType === 'month' && (
              <div>
                <label className="text-sm font-medium mb-2 block">Mes</label>
                <Select 
                  value={dialogMonth.toString()} 
                  onValueChange={(v) => setDialogMonth(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((month, idx) => (
                      <SelectItem key={idx} value={idx.toString()}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div>
              <label className="text-sm font-medium mb-2 block">Año</label>
              <Select 
                value={dialogYear.toString()} 
                onValueChange={(v) => setDialogYear(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 6 }, (_, i) => 2021 + i).map(y => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Vista previa:
              </p>
              <p className="text-lg font-bold text-blue-700 dark:text-blue-300 mt-1">
                {dialogType === 'year' 
                  ? `${dialogYear}` 
                  : `${MONTHS[dialogMonth]} ${dialogYear}`}
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddComparison}>
              Agregar Comparación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Estilos para impresión */}
      <style jsx global>{`
        @media print {
          /* Configuración de página */
          @page {
            size: A4 portrait;
            margin: 1.5cm;
          }

          /* Fondo blanco para TODOS los elementos */
          * {
            background: white !important;
            background-color: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Fondo blanco para toda la página */
          html, body {
            background: white !important;
            background-color: white !important;
            color: black !important;
          }

          /* Ocultar navegación y header del admin */
          nav,
          header,
          [role="navigation"],
          [role="banner"],
          aside,
          footer {
            display: none !important;
          }

          /* Ocultar elementos con clase no-print */
          .no-print {
            display: none !important;
          }

          /* Ocultar solo los elementos dentro de #report-container que NO sean print-section */
          #report-container > *:not(.print-section) {
            display: none !important;
          }

          /* Ocultar botones e iconos dentro de print-section */
          .print-section button,
          .print-section .no-print-icon {
            display: none !important;
          }

          /* Título del reporte */
          #report-container::before {
            content: "Reporte de Análisis Comparativo de Ventas";
            display: block;
            font-size: 22px;
            font-weight: bold;
            margin-bottom: 25px;
            padding-bottom: 10px;
            border-bottom: 2px solid #333;
            color: black;
            text-align: center;
            background: white;
          }

          /* Estilos para secciones de impresión */
          .print-section {
            page-break-inside: avoid;
            margin-bottom: 30px;
            border: 1px solid #ddd;
            background: white !important;
            padding: 20px;
            width: 100% !important;
            max-width: 100% !important;
          }

          /* Expandir el gráfico horizontalmente */
          #chart-section {
            width: 100% !important;
          }

          #chart-section .recharts-wrapper {
            width: 100% !important;
            max-width: 100% !important;
          }

          /* Títulos */
          .print-section h1,
          .print-section h2,
          .print-section h3,
          .print-section h4 {
            color: black !important;
            background: white !important;
          }

          /* Texto */
          .print-section p,
          .print-section span,
          .print-section div {
            color: black !important;
            background: transparent !important;
          }

          /* Tablas */
          .print-section table {
            width: 100%;
            border-collapse: collapse;
            background: white !important;
          }

          .print-section th,
          .print-section td {
            border: 1px solid #ddd;
            padding: 8px;
            color: black !important;
            background: white !important;
          }

          .print-section thead {
            background-color: #f5f5f5 !important;
          }

          .print-section tbody tr {
            background: white !important;
          }

          /* Gráficos Recharts */
          .print-section .recharts-wrapper,
          .print-section svg {
            background: white !important;
          }

          .print-section text {
            fill: black !important;
            font-size: 16px !important;
            font-weight: 500 !important;
          }

          /* Aumentar altura del gráfico en impresión */
          #chart-section .h-\[500px\] {
            height: 650px !important;
          }

          /* Mejorar legibilidad de ejes */
          .print-section .recharts-cartesian-axis-tick text {
            font-size: 16px !important;
            font-weight: 600 !important;
          }

          /* Centrar leyenda del gráfico */
          .print-section .recharts-legend-wrapper {
            text-align: center !important;
            justify-content: center !important;
            width: 100% !important;
          }

          .print-section .recharts-default-legend {
            text-align: center !important;
            justify-content: center !important;
            margin: 0 auto !important;
          }

          .print-section .recharts-legend-wrapper ul {
            justify-content: center !important;
            text-align: center !important;
          }

          /* Badges */
          .print-section [class*="badge"] {
            border: 1px solid #666;
            background: white !important;
            color: black !important;
          }
        }
      `}</style>
    </div>
  )
}

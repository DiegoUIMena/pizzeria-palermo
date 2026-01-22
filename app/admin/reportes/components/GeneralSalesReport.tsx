"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Upload, X } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

type Point = { label: string; value: number; date?: string }

interface Props {
  // function that returns series for a given period ('mes'|'anual')
  getSalesSeries: (period: any, opts?: any) => Point[]
  // orders array from hook to compute counts/totals for selected period
  orders?: any[]
}

const MONTHS = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
]

const COLORS = ['#ef4444','#0ea5e9','#f97316','#10b981','#a78bfa','#ec4899']

export default function GeneralSalesReport({ getSalesSeries, orders = [] }: Props) {
  const isDev = process.env.NODE_ENV !== 'production'
  const [mode, setMode] = useState<'mes'|'anio'>('mes')
  const [month, setMonth] = useState<string>((new Date()).getMonth().toString())
  const [year, setYear] = useState<string>((new Date()).getFullYear().toString())
  const [overlays, setOverlays] = useState<any[]>([])
  const [uploadedSeries, setUploadedSeries] = useState<any[]>([])
  const [showAll, setShowAll] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  // helpers to avoid timezone shifts when creating dates from ISO strings
  const parseIsoToLocal = (iso: string) => {
    // expect YYYY-MM-DD
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!m) return new Date(iso)
    const y = parseInt(m[1],10)
    const mm = parseInt(m[2],10)
    const dd = parseInt(m[3],10)
    return new Date(y, mm-1, dd)
  }
    // (moved) helpers to avoid timezone shifts when creating dates from ISO strings
    // NOTE: original definitions appeared later and caused TDZ ReferenceError; kept here

  const parseLabelToLocalDateParts = (label: string) => {
    // try ISO YYYY-MM-DD
    let m = label.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (m) return { y: parseInt(m[1],10), m: parseInt(m[2],10), d: parseInt(m[3],10) }
    // try DD-MM-YYYY or DD/MM/YYYY
    m = label.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/)
    if (m) return { y: parseInt(m[3],10), m: parseInt(m[2],10), d: parseInt(m[1],10) }
    // try Date fallback
    const dd = new Date(label)
    if (!isNaN(dd.getTime())) return { y: dd.getFullYear(), m: dd.getMonth()+1, d: dd.getDate() }
    return null
  }
    // (moved) helpers to avoid timezone shifts when creating dates from ISO strings
    // NOTE: original definitions appeared later and caused TDZ ReferenceError; kept here

  // compute orders filtered for the selected period (used to show counts/totals)
  const filteredOrdersForPeriod = useMemo(() => {
    if (!Array.isArray(orders) || orders.length === 0) return []
    const y = parseInt(year, 10)
    const m = parseInt(month, 10)
    return orders.filter(o => {
      try {
        const d = o && o.timestamps && o.timestamps.created ? new Date(o.timestamps.created) : null
        if (!d || isNaN(d.getTime())) return false
        if (mode === 'mes') return d.getFullYear() === y && d.getMonth() === m
        if (mode === 'anio') return d.getFullYear() === y
        return false
      } catch (e) { return false }
    })
  }, [orders, mode, month, year])

  const ordersCount = filteredOrdersForPeriod.length
  const ordersTotal = filteredOrdersForPeriod.reduce((acc, o) => acc + (Number(o.total) || 0), 0)

  // base series for current selection (keep original labels but also attach ISO dates)
  const baseSeries = useMemo(() => {
    try {
      // Request series for the selected period. Prefer exact historical month/year when provided.
      let raw = mode === 'mes'
        ? getSalesSeries('mes', { month: parseInt(month), year: parseInt(year), granularity: 'daily' })
        : getSalesSeries('anual', { year: parseInt(year) })

      // DEV: if historical month returned empty, fallback to relative 'mes' series (last 30 days)
      try {
        if (isDev && Array.isArray(raw)) {
          // eslint-disable-next-line no-console
          console.log('[GeneralSalesReport] raw getSalesSeries length for', mode, month, year, raw.length)
        }
      } catch (e) {}

      if (mode === 'mes' && Array.isArray(raw) && raw.length === 0) {
        try {
          const fallback = getSalesSeries('mes', { granularity: 'daily' })
          if (fallback && fallback.length > 0) {
            // eslint-disable-next-line no-console
            if (isDev) console.log('[GeneralSalesReport] falling back to relative mes series (last 30 days)')
            raw = fallback
          }
        } catch (e) {}
      }

      // DEV: compare requested raw series vs default series (no opts) to spot differences
      try {
        if (isDev) {
          const defaultSeries = mode === 'mes' ? getSalesSeries('mes') : getSalesSeries('anual')
          // eslint-disable-next-line no-console
          console.log('[GeneralSalesReport] requested raw sample:', (raw || []).slice(0,5))
          // eslint-disable-next-line no-console
          console.log('[GeneralSalesReport] defaultSeries sample:', (defaultSeries || []).slice(0,5))
        }
      } catch (e) {}

      // attach date ISO strings when possible
      const pad = (n: number) => String(n).padStart(2, '0')
      const makeIso = (y:number,m:number,d:number) => `${y}-${pad(m)}-${pad(d)}`
      const monthsShort = MONTHS.map(m => m.substring(0,3).toLowerCase())
      return (raw || []).map((p: Point) => {
        let dateIso: string | undefined = undefined
        try {
          const lbl = String(p.label || '')
          // ISO date YYYY-MM-DD
          if (/^\d{4}-\d{2}-\d{2}$/.test(lbl)) {
            dateIso = lbl
          } else if (mode === 'mes') {
            // label might be day number (legacy) or week label; if day number, build ISO using selected month/year
            const day = parseInt(lbl, 10)
            if (!isNaN(day)) {
              const y = parseInt(year,10)
              const m = parseInt(month,10) + 1
              dateIso = makeIso(y, m, day)
            }
          } else {
            // anual: try short month (ene/feb) or full month name
            const l = lbl.toLowerCase()
            let mi = monthsShort.indexOf(l)
            if (mi < 0) mi = MONTHS.map(m=>m.toLowerCase()).indexOf(l)
            if (mi >= 0) {
              const y = parseInt(year,10)
              dateIso = makeIso(y, mi+1, 1)
            }
          }
        } catch (e) {}
        // if dateIso not found, leave undefined; other code will attempt to parse label
        // compute a visible label based on dateIso or original label
        let visibleLabel = p.label
        if (dateIso) {
          const d = parseIsoToLocal(dateIso)
          visibleLabel = mode === 'mes' ? String(d.getDate()) : MONTHS[d.getMonth()]
        }
        return { ...p, date: dateIso, label: visibleLabel }
      })
    } catch (e) {
      if (isDev) console.error('[GeneralSalesReport] error building baseSeries', e)
      return []
    }
  }, [mode, month, year, getSalesSeries])


  // build combined data for chart: align by label (day or month)
  const chartData = useMemo(() => {
    // collect all labels
    // normalize all series to use ISO date for alignment
    const normSeries = [] as Array<{ label: string; data: Point[]; color?: string }>
    // baseSeries already has date when possible
    normSeries.push({ label: `${mode==='mes' ? 'Actual (mes)' : 'Actual (año)'}`, data: baseSeries, color: COLORS[0] })

    // overlays and uploadedSeries may have items without date; try to keep date if present
    overlays.forEach(o => normSeries.push({ label: o.label, data: (o.data || []).map((p: Point) => ({ ...p })), color: o.color }))
    uploadedSeries.forEach(u => normSeries.push({ label: u.label, data: (u.data || []).map((p: Point) => ({ ...p })) }))

    // YEAR view: aggregate by month (sum values per month)
    if (mode === 'anio') {
      const yearNum = parseInt(year, 10)
      const rows: any[] = Array.from({ length: 12 }).map((_, mi) => {
        const label = MONTHS[mi]
        const row: any = { label }
        normSeries.forEach((s, idx) => {
          const sum = (s.data || []).reduce((acc: number, p: Point) => {
            const parts = p.date ? parseLabelToLocalDateParts(p.date) : parseLabelToLocalDateParts(p.label)
            if (!parts) return acc
            // When showAll is active, include values for that month regardless of year
            if (showAll) {
              if (parts.m === mi + 1) return acc + (p.value || 0)
              return acc
            }
            // Default: only include values for the selected year
            if (parts.y === yearNum && parts.m === mi + 1) return acc + (p.value || 0)
            return acc
          }, 0)
          row[`v${idx}`] = sum
        })
        return row
      })
      return rows
    }

    // DEV: log debug info about collected dates when computing chartData
    try {
      if (isDev) {
        // eslint-disable-next-line no-console
        console.log('[GeneralSalesReport] build chartData', { showAll, dateCount: dateSet.size, sampleDates: Array.from(dateSet).slice(0,10) })
      }
    } catch (e) {}

    // DAILY view (month): collect all dates (ISO) from points; if a point lacks date try to parse its label
    // For comparative overlays from other years we remap their day/month into the currently selected year
    const dateSet = new Set<string>()
    const targetYear = parseInt(year,10)
    const targetMonth = parseInt(month,10) // 0-based

    const pad = (n:number) => String(n).padStart(2,'0')

    // helper: normalize a point into an ISO date relative to the current view
    const pointToIsoForView = (p: Point) : string | null => {
      if (mode === 'mes') {
        // When 'Ver todos' is enabled we WANT to overlay series from other years
        // by remapping their day-of-month into the currently selected month (so comparisons align).
        if (showAll) {
          // determine day of month from point (date or label)
          let day: number | null = null
          if (p.date) {
            const parts = parseLabelToLocalDateParts(p.date)
            if (parts && parts.d) day = parts.d
          }
          if (day === null) {
            const m = String(p.label).match(/^(\d{1,2})$/)
            if (m) day = parseInt(m[1], 10)
          }
          if (day === null || isNaN(day)) return null
          // clamp day to the number of days in the target month
          const lastDay = new Date(targetYear, targetMonth+1, 0).getDate()
          const safeDay = Math.min(Math.max(1, day), lastDay)
          // DEV: small log to verify mapping choices
          try { if (isDev) console.log('[GeneralSalesReport] remap day', { originalDay: day, safeDay, targetMonth: targetMonth+1, targetYear }) } catch(e) {}
          return `${targetYear}-${pad(targetMonth+1)}-${pad(safeDay)}`
        }

        // When 'Ver todos' is disabled, only include points that belong to the selected year/month.
        if (p.date) {
          const parts = parseLabelToLocalDateParts(p.date)
          if (!parts) return null
          if (parts.y === targetYear && parts.m === targetMonth + 1) return `${targetYear}-${pad(parts.m)}-${pad(parts.d)}`
          return null
        }
        // if label is a day number (legacy), map it to the current selected month/year
        const m2 = String(p.label).match(/^(\d{1,2})$/)
        if (m2) {
          const day = parseInt(m2[1],10)
          return `${targetYear}-${pad(targetMonth+1)}-${pad(day)}`
        }
        return null
      }
      // anual view: try to parse month from date or label and return YYYY-MM-01
      if (mode === 'anio') {
        if (p.date) {
          const parts = parseLabelToLocalDateParts(p.date)
          if (!parts) return null
          return `${parts.y}-${pad(parts.m)}-01`
        }
        const parts = parseLabelToLocalDateParts(p.label)
        if (parts) return `${parts.y}-${pad(parts.m)}-01`
        return null
      }
      return null
    }

    normSeries.forEach(s => s.data.forEach((p: Point) => {
      const iso = pointToIsoForView(p)
      if (iso) dateSet.add(iso)
    }))

    // when viewing by month:
    // - if 'Ver todos' is ACTIVE, include all dates from the collected set (all years)
    // - otherwise restrict to the selected year/month only
    let allDates: string[] = []
    if (showAll && mode === 'mes') {
      // When showing all series overlayed by day, use the canonical day list for the selected month
      const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate()
      allDates = Array.from({ length: lastDay }).map((_, i) => `${targetYear}-${pad(targetMonth+1)}-${pad(i+1)}`)
    } else {
      allDates = Array.from(dateSet)
      if (!showAll) {
        allDates = allDates.filter(d => {
          const dt = parseIsoToLocal(d)
          return dt.getFullYear() === targetYear && dt.getMonth() === targetMonth
        })
      }
      allDates = allDates.sort((a,b) => parseIsoToLocal(a).getTime() - parseIsoToLocal(b).getTime())
    }

    const rows = allDates.map(dateIso => {
      const row: any = { label: dateIso }
      normSeries.forEach((s, idx) => {
        const found = (s.data || []).find((p: Point) => {
          const iso = pointToIsoForView(p)
          if (!iso) return false
          return iso === dateIso
        })
        row[`v${idx}`] = found ? found.value : 0
      })
      return row
    })

    // DEV: log some rows for inspection and series mapping
    try {
      if (isDev) {
        // eslint-disable-next-line no-console
        console.log('[GeneralSalesReport] chartData sample rows count', rows.length, rows.slice(0,10))
        // log mapping between lines and normSeries
        // eslint-disable-next-line no-console
        console.log('[GeneralSalesReport] lines keys', lines.map(l=>l.key))
        // eslint-disable-next-line no-console
        console.log('[GeneralSalesReport] visibleMap', visibleMap)
        // compute per-series non-zero counts from rows
        const perSeries = lines.map((l, idx) => {
          const cnt = rows.reduce((acc, r) => acc + ((r[`v${idx}`] || 0) > 0 ? 1 : 0), 0)
          const sum = rows.reduce((acc, r) => acc + (Number(r[`v${idx}`] || 0)), 0)
          return { key: l.key, name: l.name, idx, nonZeroCount: cnt, sum }
        })
        // eslint-disable-next-line no-console
        console.log('[GeneralSalesReport] perSeries summary', perSeries)
          // eslint-disable-next-line no-console
          console.log('[GeneralSalesReport] sample mappings (first 5 points per series):')
          lines.forEach((l, idx) => {
            const s = normSeries[idx]
            if (!s) return
            const samples = (s.data || []).slice(0,5).map(p => ({ original: p.date || p.label, mapped: pointToIsoForView(p), value: p.value }))
            // eslint-disable-next-line no-console
            console.log('[GeneralSalesReport] mapping', l.key, l.name, samples)
          })
      }
    } catch (e) {}

    return rows
  }, [baseSeries, overlays, uploadedSeries, mode, month, year, showAll])

  // DEV: log any chart rows that contain non-zero values to help locate where system sales land
  useEffect(() => {
    try {
      if (isDev) {
        const nonZero = (chartData || []).filter((r: any) => Object.keys(r).some(k => k.startsWith('v') && (r[k] || 0) > 0))
        // eslint-disable-next-line no-console
        console.log('[GeneralSalesReport] chartData non-zero rows count:', nonZero.length, nonZero.slice(0,10))
      }
    } catch (e) {}
  }, [chartData])

  // DEV: deeper inspection — log baseSeries and any non-zero points per series
  useEffect(() => {
    try {
      if (isDev) {
        // eslint-disable-next-line no-console
        console.log('[GeneralSalesReport] baseSeries sample:', (baseSeries || []).slice(0,10))
        const normSeries = [] as Array<{ label: string; data: Point[]; color?: string }>
        normSeries.push({ label: `${mode==='mes' ? 'Actual (mes)' : 'Actual (año)'}`, data: baseSeries, color: COLORS[0] })
        overlays.forEach(o => normSeries.push({ label: o.label, data: (o.data || []).map((p: Point) => ({ ...p })), color: o.color }))
        uploadedSeries.forEach(u => normSeries.push({ label: u.label, data: (u.data || []).map((p: Point) => ({ ...p })) }))
        normSeries.forEach((s, idx) => {
          const nz = (s.data || []).filter(p => (p.value || 0) > 0)
          // eslint-disable-next-line no-console
          console.log('[GeneralSalesReport] normSeries', idx, 'label', s.label, 'non-zero count', nz.length, nz.slice(0,5))
        })
      }
    } catch (e) {}
  }, [baseSeries, overlays, uploadedSeries, mode])

  // prepare lines list
  const lines = useMemo(() => {
    const base = [{ key: 'v0', name: mode==='mes' ? `Actual (${MONTHS[parseInt(month)]} ${year})` : `Actual (${year})`, color: COLORS[0] }]
    const others = overlays.map((o, i) => ({ key: `v${i+1}`, name: o.label, color: COLORS[(i+1)%COLORS.length] }))
    const up = uploadedSeries.map((u, i) => ({ key: `v${i+1+overlays.length}`, name: u.label, color: COLORS[(i+1+overlays.length)%COLORS.length] }))
    return [...base, ...others, ...up]
  }, [mode, month, year, overlays, uploadedSeries])

  // visibility map so we can force-show series in the chart for debugging
  const [visibleMap, setVisibleMap] = useState<Record<string, boolean>>({})
  useEffect(() => {
    // ensure every line has a visibility entry, default true when showAll is active, otherwise true for base only
    const map: Record<string, boolean> = {}
    lines.forEach((l, i) => {
      map[`v${i}`] = showAll ? true : (i === 0)
    })
    setVisibleMap(map)
  }, [lines, showAll])

    const handleAddOverlay = () => {
    // add a simple overlay selector defaulting to previous year same mode
    const lastYear = (new Date()).getFullYear() - 1
    const label = mode === 'mes' ? `Mes ${MONTHS[parseInt(month)]} ${lastYear}` : `Año ${lastYear}`
    const data = getSalesSeries(mode === 'mes' ? 'mes' : 'anual', mode==='mes' ? { month: parseInt(month), year: lastYear, granularity: 'daily' } : { year: lastYear })
    setOverlays(prev => [...prev, { label, data, color: COLORS[prev.length%COLORS.length] }])
  }

  const removeOverlay = (index: number) => {
    setOverlays(prev => prev.filter((_, i) => i !== index))
  }

  const removeUploaded = (index: number) => {
    setUploadedSeries(prev => prev.filter((_, i) => i !== index))
  }

  const clearComparisons = () => {
    setOverlays([])
    setUploadedSeries([])
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    let parsedSeries: Point[] = []
    try {
      parsedSeries = parseCsvText(text)
    } catch (err: any) {
      toast({ title: 'Error al parsear CSV', description: String(err?.message || err) })
      ;(e.target as HTMLInputElement).value = ''
      return
    }
    if (!parsedSeries || parsedSeries.length === 0) {
      toast({ title: 'Archivo sin datos', description: 'El archivo no contiene filas válidas o el formato no es reconocido.' })
      ;(e.target as HTMLInputElement).value = ''
      return
    }
    // attach year to label if possible
    let fileYearLabel = ''
    try {
      const first = parsedSeries.find(p=>p.date || p.label)
      const parts = first?.date ? parseLabelToLocalDateParts(first.date) : first?.label ? parseLabelToLocalDateParts(first.label) : null
      if (parts && parts.y) fileYearLabel = ` (${parts.y})`
    } catch (e) {}
    setUploadedSeries(prev => [...prev, { label: `Archivo: ${file.name}${fileYearLabel}`, data: parsedSeries }]);
    // if parsed file dates don't intersect current selection, switch view to file's first date
    try {
      const firstDateIso = parsedSeries.find(p=>p.date)?.date
      if (firstDateIso) {
        const parts = parseLabelToLocalDateParts(firstDateIso)
        if (parts) {
          const fileYear = parts.y
          const fileMonth0 = parts.m - 1
          if (mode === 'mes') {
            if (fileYear !== parseInt(year,10) || fileMonth0 !== parseInt(month,10)) {
              setYear(String(fileYear))
              setMonth(String(fileMonth0))
              toast({ title: 'Vista cambiada', description: `Mostrando ${MONTHS[fileMonth0]} ${fileYear} para ver los datos cargados.` })
            }
          } else {
            if (fileYear !== parseInt(year,10)) {
              setYear(String(fileYear))
              toast({ title: 'Vista cambiada', description: `Mostrando ${fileYear} para ver los datos cargados.` })
            }
          }
        }
      }
    } catch (e) {}

    // simple CSV parser: date,value (date in ISO or dd/mm/yyyy)
    // clear input
    (e.target as HTMLInputElement).value = ''
  }

  // Helper: parse CSV text into series of Points
  // - auto-detects separator (comma or semicolon)
  // - accepts dates in ISO (YYYY-MM-DD) or DD-MM-YYYY (or DD/MM/YYYY)
  // - normalizes numeric values (removes thousands separators)
  const parseCsvText = (text: string) => {
    if (!text) return []
    const rows = text.split(/\r?\n/).map(r=>r.trim()).filter(r=>r)

    // detect separator by sampling first non-empty row
    let sep = ','
    const sample = rows.find(r => r && r.length > 0) || ''
    const commaCount = (sample.match(/,/g) || []).length
    const semicolonCount = (sample.match(/;/g) || []).length
    if (semicolonCount > commaCount) sep = ';'

    const parsed: Point[] = []

    const parseDateString = (s: string) => {
      const v = (s||'').trim()
      if (!v) return null
      // ISO-like: YYYY-MM-DD or YYYY/MM/DD
      if (/^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}$/.test(v)) {
        const d = new Date(v.replace(/\//g,'-'))
        if (!isNaN(d.getTime())) return d
      }
      // DD-MM-YYYY or DD/MM/YYYY
      if (/^\d{1,2}[-\/]\d{1,2}[-\/]\d{4}$/.test(v)) {
        const parts = v.split(/[-\/]\s*/)
        const dd = parseInt(parts[0],10)
        const mm = parseInt(parts[1],10)
        const yy = parseInt(parts[2],10)
        const d = new Date(yy, mm-1, dd)
        if (!isNaN(d.getTime())) return d
      }
      // fallback to Date constructor
      const d = new Date(v)
      if (!isNaN(d.getTime())) return d
      return null
    }

    rows.forEach((r,i) => {
      // skip header rows that include words like 'date' or 'fecha'
      if (i === 0 && /date|fecha|dia|valor|ventas/i.test(rows[0])) {
        // but only skip if it clearly looks like a header (contains non-numeric tokens)
        if (/[a-zA-Z]/.test(rows[0])) return
      }

      const parts = r.split(sep).map(p=>p.trim())
      const dateStr = parts[0] || ''
      let valueStr = parts[1] || '0'

      // normalize value: remove currency, spaces, and thousands separators
      valueStr = valueStr.replace(/\$/g,'').replace(/\s+/g,'')
      // if value contains both '.' and ',' assume '.' thousands and ',' decimal
      if (valueStr.indexOf('.') !== -1 && valueStr.indexOf(',') !== -1) {
        valueStr = valueStr.replace(/\./g,'').replace(/,/g,'.')
      } else {
        // otherwise remove dots (thousands) and replace comma with dot (decimal)
        valueStr = valueStr.replace(/\./g,'').replace(/,/g,'.')
      }

      const value = parseFloat(valueStr) || 0

      // parse date
      const d = parseDateString(dateStr)
      let label = dateStr
      let dateIso: string | undefined = undefined
      if (d) {
        const pad = (n: number) => String(n).padStart(2, '0')
        dateIso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
        label = mode === 'mes' ? String(d.getDate()) : MONTHS[d.getMonth()]
      }

      parsed.push({ label, value, date: dateIso })
    })

    return parsed
  }

  

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Reportes de Ventas Generales</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Ventas diarias por mes y comparativas entre periodos</p>
          <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Órdenes recibidas: <span className="font-medium">{ordersCount}</span>
            {' — '}Ventas sistema: <span className="font-medium">${ordersTotal.toLocaleString()}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select value={mode} onValueChange={(v:any)=>setMode(v)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mes">Por Mes</SelectItem>
              <SelectItem value="anio">Por Año</SelectItem>
            </SelectContent>
          </Select>

          {mode === 'mes' ? (
            <Select value={month} onValueChange={(v:any)=>setMonth(v)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m,i)=>(<SelectItem key={i} value={String(i)}>{m}</SelectItem>))}
              </SelectContent>
            </Select>
          ) : null}

          <Select value={year} onValueChange={(v:any)=>setYear(v)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({length:6}).map((_,i)=>{
                const y = (new Date()).getFullYear()-i
                return <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              })}
            </SelectContent>
          </Select>

          <input ref={fileInputRef as any} id="file-upload" type="file" accept=".csv,text/csv" onChange={handleUpload} className="hidden" />
          <Button variant="outline" className="flex items-center gap-2" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4"/> Subir datos
          </Button>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="w-4 h-4" checked={showAll} onChange={(e)=>setShowAll(e.target.checked)} />
            <span>Ver todos</span>
          </label>

          <Button onClick={handleAddOverlay} variant="ghost">Agregar periodo para comparar</Button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 p-4 rounded-lg">
        <div className="w-full h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(label:any) => {
                  // when viewing a month, show the weekday name (short) for that date
                  if (mode === 'mes') {
                    // label is expected to be ISO date (YYYY-MM-DD) or day number
                    try {
                      const tryIso = parseIsoToLocal(String(label))
                      if (!isNaN(tryIso.getTime())) {
                        const weekday = tryIso.toLocaleDateString('es-ES', { weekday: 'short' })
                        const clean = weekday.replace('.', '')
                        return clean.charAt(0).toUpperCase() + clean.slice(1)
                      }
                    } catch (e) {}
                    const dayNum = parseInt(String(label))
                    if (!isNaN(dayNum)) {
                      const d = new Date(parseInt(year), parseInt(month), dayNum)
                      if (!isNaN(d.getTime())) {
                        const weekday = d.toLocaleDateString('es-ES', { weekday: 'short' })
                        const clean = weekday.replace('.', '')
                        return clean.charAt(0).toUpperCase() + clean.slice(1)
                      }
                    }
                  }
                  // default: show label as-is
                  return String(label)
                }}
              />
              <YAxis
                width={96}
                tickFormatter={(v:any) => `$${Number(v).toLocaleString()}`}
                tick={{ fontSize: 13, fontWeight: 600, fill: '#111' }}
                tickMargin={8}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(v:any)=>`$${Number(v).toLocaleString()}`}
                // show full weekday + date as tooltip label
                labelFormatter={(label:any) => {
                  try {
                    const d = parseIsoToLocal(String(label))
                    if (!isNaN(d.getTime())) {
                      const weekday = d.toLocaleDateString('es-ES', { weekday: 'long' })
                      const dateStr = d.toLocaleDateString('es-ES')
                      return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)} — ${dateStr}`
                    }
                  } catch (e) {}
                  return String(label)
                }}
              />
              <Legend />
              {lines.map((l, idx) => (
                <Line
                  key={`line-${idx}-${l.key}`}
                  type="monotone"
                  dataKey={l.key}
                  stroke={l.color || COLORS[idx % COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  name={l.name}
                  isAnimationActive={false}
                  hide={!visibleMap[l.key]}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 items-center">
          {/* Base (actual) */}
          <Badge style={{ background: COLORS[0], color: '#fff' }}>{mode==='mes' ? `Actual (${MONTHS[parseInt(month)]} ${year})` : `Actual (${year})`}</Badge>

          {/* Overlays añadidos */}
          {overlays.map((o, i) => (
            <div key={`ov-${i}`} className="flex items-center bg-opacity-90 rounded px-2 py-1" style={{ background: o.color }}>
              <span className="text-white text-sm mr-2">{o.label}</span>
              <button aria-label={`Eliminar ${o.label}`} onClick={()=>removeOverlay(i)} className="text-white opacity-90 hover:opacity-100">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}

          {/* Archivos subidos */}
          {uploadedSeries.map((u, i) => (
            <div key={`up-${i}`} className="flex items-center bg-gray-700/90 rounded px-2 py-1">
              <span className="text-white text-sm mr-2">{u.label}</span>
              <button aria-label={`Eliminar ${u.label}`} onClick={()=>removeUploaded(i)} className="text-white opacity-90 hover:opacity-100">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}

          {/* Visual toggles for each series (debug) */}
          <div className="w-full mt-3">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Series visibles:</div>
            <div className="flex flex-wrap gap-2">
              {lines.map((l, idx) => (
                <label key={`vis-${l.key}`} className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                  <input type="checkbox" checked={!!visibleMap[l.key]} onChange={(e)=>setVisibleMap(prev=>({ ...prev, [l.key]: e.target.checked }))} />
                  <span className="text-sm">{l.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Acciones */}
          {(overlays.length > 0 || uploadedSeries.length > 0) && (
            <Button variant="ghost" onClick={clearComparisons} className="ml-2">Limpiar comparativas</Button>
          )}
        </div>
      </div>
    </div>
  )
}

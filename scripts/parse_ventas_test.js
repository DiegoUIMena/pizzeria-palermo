const fs = require('fs');
const path = require('path');
const file = path.resolve(__dirname, '../public/ventas_2024.csv');
const text = fs.readFileSync(file, 'utf8');

function parseCsvText(text, mode='mes'){
  if (!text) return []
  const rows = text.split(/\r?\n/).map(r=>r.trim()).filter(r=>r)
  let sep = ','
  const sample = rows.find(r => r && r.length > 0) || ''
  const commaCount = (sample.match(/,/g) || []).length
  const semicolonCount = (sample.match(/;/g) || []).length
  if (semicolonCount > commaCount) sep = ';'

  const parsed = []
  const parseDateString = (s) => {
    const v = (s||'').trim()
    if (!v) return null
    if (/^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}$/.test(v)) {
      const d = new Date(v.replace(/\//g,'-'))
      if (!isNaN(d.getTime())) return d
    }
    if (/^\d{1,2}[-\/]\d{1,2}[-\/]\d{4}$/.test(v)) {
      const parts = v.split(/[-\/]\s*/)
      const dd = parseInt(parts[0],10)
      const mm = parseInt(parts[1],10)
      const yy = parseInt(parts[2],10)
      const d = new Date(yy, mm-1, dd)
      if (!isNaN(d.getTime())) return d
    }
    const d = new Date(v)
    if (!isNaN(d.getTime())) return d
    return null
  }

  rows.forEach((r,i)=>{
    if (i === 0 && /date|fecha|dia|valor|ventas/i.test(rows[0])) {
      if (/[a-zA-Z]/.test(rows[0])) return
    }
    const parts = r.split(sep).map(p=>p.trim())
    const dateStr = parts[0] || ''
    let valueStr = parts[1] || '0'
    valueStr = valueStr.replace(/\$/g,'').replace(/\s+/g,'')
    if (valueStr.indexOf('.') !== -1 && valueStr.indexOf(',') !== -1) {
      valueStr = valueStr.replace(/\./g,'').replace(/,/g,'.')
    } else {
      valueStr = valueStr.replace(/\./g,'').replace(/,/g,'.')
    }
    const value = parseFloat(valueStr) || 0
    const d = parseDateString(dateStr)
    let label = dateStr
    let dateIso = undefined
    if (d) {
      const pad = (n) => String(n).padStart(2,'0')
      dateIso = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
      label = mode === 'mes' ? String(d.getDate()) : ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][d.getMonth()]
    }
    parsed.push({ label, value, date: dateIso })
  })
  return parsed
}

const parsed = parseCsvText(text, 'mes')
console.log('Parsed count:', parsed.length)
console.log('Sample first 10:', parsed.slice(0,10))
// Check dates in January 2024
const jan = parsed.filter(p=>p.date && p.date.startsWith('2024-01'))
console.log('January count:', jan.length)
console.log('First Jan sample:', jan.slice(0,5))

// Check if any dates are undefined
const undef = parsed.filter(p=>!p.date)
console.log('Undefined date count:', undef.length)

// Simulate chartData construction for a given month/year
function buildChartDataForMonth(parsedSeries, year, monthIndex){
  // normSeries: only one uploaded series
  const normSeries = [{ label: 'uploaded', data: parsedSeries }]
  const dateSet = new Set()
  normSeries.forEach(s => s.data.forEach(p => {
    if (p.date) dateSet.add(p.date)
    else {
      // attempt parse label like dd
      const m = p.label.match(/^(\d{1,2})$/)
      if (m) {
        const day = parseInt(m[1],10)
        const pad = n=>String(n).padStart(2,'0')
        dateSet.add(`${year}-${pad(monthIndex+1)}-${pad(day)}`)
      }
    }
  }))
  const parseIsoToLocal = (iso) => {
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!m) return new Date(iso)
    return new Date(parseInt(m[1],10), parseInt(m[2],10)-1, parseInt(m[3],10))
  }
  const allDates = Array.from(dateSet).filter(d => {
    const dt = parseIsoToLocal(d)
    return dt.getFullYear() === year && dt.getMonth() === monthIndex
  }).sort((a,b)=>parseIsoToLocal(a)-parseIsoToLocal(b))

  const rows = allDates.map(dateIso => {
    const row = { label: dateIso }
    normSeries.forEach((s, idx)=>{
      const found = (s.data||[]).find(p=> p.date ? p.date === dateIso : (p.label && parseInt(p.label,10)===parseInt(dateIso.split('-')[2],10)))
      row[`v${idx}`] = found ? found.value : 0
    })
    return row
  })
  return rows
}

const chartJan = buildChartDataForMonth(parsed, 2024, 0)
console.log('Chart rows for Jan 2024 count:', chartJan.length)
console.log('Chart Jan sample (first 10):', chartJan.slice(0,10))

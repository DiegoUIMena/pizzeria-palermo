export type Unit = 'g' | 'kg' | 'u' | 'unit' | 'unidad' | string

// Normalize a unit string to a canonical one used by the app
export const normalizeUnit = (u?: string): Unit => {
  if (!u) return 'u'
  const s = u.toLowerCase().trim()
  if (s === 'g' || s === 'gramo' || s === 'gramos') return 'g'
  if (s === 'kg' || s === 'kilogramo' || s === 'kilogramos' || s === 'kilo' || s === 'kilos') return 'kg'
  if (s === 'u' || s === 'unidad' || s === 'unidades' || s === 'unit' || s === 'units') return 'u'
  return s
}

// Convert a quantity from given unit to grams when possible. For units like 'u' return the same numeric value and tag as 'u'.
export const toGrams = (qty: number, unit?: string): { value: number; unit: Unit } => {
  const u = normalizeUnit(unit)
  if (u === 'kg') return { value: qty * 1000, unit: 'g' }
  if (u === 'g') return { value: qty, unit: 'g' }
  // For unit-based (pieces), we keep as 'u' and do not convert to grams
  return { value: qty, unit: 'u' }
}

// Convert between two units when possible; returns undefined if conversion isn't supported
export const convert = (qty: number, fromUnit?: string, toUnit?: string): number | undefined => {
  const f = normalizeUnit(fromUnit)
  const t = normalizeUnit(toUnit)
  if (f === t) return qty
  if ((f === 'g' && t === 'kg')) return qty / 1000
  if ((f === 'kg' && t === 'g')) return qty * 1000
  // No reliable conversion between weight and unit-count
  return undefined
}

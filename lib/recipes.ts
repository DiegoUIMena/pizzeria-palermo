import { db } from './firebase'
import { toGrams, normalizeUnit } from './units'
import { doc, runTransaction, getDoc } from 'firebase/firestore'
import { collection, getDocs } from 'firebase/firestore'

// A recipe line is { ingredienteId, cantidad, unidad }
export interface RecipeLine { ingredienteId: string; cantidad: number; unidad?: string }

// Check if an item (pizza) is available given the current ingredients snapshot.
// ingredientsById: Record<id, { stockActual: number; unidad?: string }>
export const isItemAvailable = (recipe: RecipeLine[] | undefined, ingredientsById: Record<string, any>, qty = 1) => {
  if (!recipe || recipe.length === 0) return { available: true, missing: [] }
  const missing: Array<{ ingredienteId: string; needed: number; available: number; unidad?: string }> = []

  for (const line of recipe) {
    const ing = ingredientsById[line.ingredienteId]
    const neededRaw = (Number(line.cantidad) || 0) * qty
    if (!ing) {
      missing.push({ ingredienteId: line.ingredienteId, needed: neededRaw, available: 0, unidad: line.unidad })
      continue
    }

    // Convert both needed and stock to grams if unit is weight-based
    const neededConv = toGrams(neededRaw, line.unidad)
    const stockConv = toGrams(Number(ing.stockActual || 0), ing.unidad)

    if (neededConv.unit === 'g' && stockConv.unit === 'g') {
      if (stockConv.value < neededConv.value) {
        missing.push({ ingredienteId: line.ingredienteId, needed: neededConv.value, available: stockConv.value, unidad: 'g' })
      }
    } else if (neededConv.unit === 'u' && stockConv.unit === 'u') {
      if (stockConv.value < neededConv.value) {
        missing.push({ ingredienteId: line.ingredienteId, needed: neededConv.value, available: stockConv.value, unidad: 'u' })
      }
    } else {
      // Units mismatch (e.g., recipe in g but stock in unidades) -> treat as missing
      // Try converting if possible
      const tryConv = (() => {
        const c = toGrams(stockConv.value, stockConv.unit)
        if (c.unit === neededConv.unit && c.value >= neededConv.value) return true
        return false
      })()
      if (!tryConv) missing.push({ ingredienteId: line.ingredienteId, needed: neededConv.value, available: stockConv.value, unidad: neededConv.unit })
    }
  }

  return { available: missing.length === 0, missing }
}

// Consume recipe for an order using a Firestore transaction. This will decrement stockActual fields.
// Note: caller must ensure order idempotency (don't call twice for same order).
export const consumeRecipeForOrder = async (recipe: RecipeLine[], qty = 1) => {
  if (!recipe || recipe.length === 0) return { success: true }

  try {
    await runTransaction(db, async (tx) => {
      for (const line of recipe) {
        const ingRef = doc(db, 'ingredientes', line.ingredienteId)
        const snap = await tx.get ? await tx.get(ingRef) : await getDoc(ingRef)
        const data: any = snap.data()
        const stockActual = Number(data?.stockActual || 0)
        // Normalize units to grams when possible
        const neededConv = toGrams((Number(line.cantidad) || 0) * qty, line.unidad)
        const stockConv = toGrams(stockActual, data?.unidad)

        let newStockRaw: number | null = null
        if (neededConv.unit === 'g' && stockConv.unit === 'g') {
          const remaining = stockConv.value - neededConv.value
          newStockRaw = remaining
        } else if (neededConv.unit === 'u' && stockConv.unit === 'u') {
          const remaining = stockConv.value - neededConv.value
          newStockRaw = remaining
        } else {
          // incompatible units: throw to abort transaction
          throw new Error(`Unidad incompatible para ingrediente ${line.ingredienteId}`)
        }

        if (newStockRaw === null) throw new Error(`No se pudo calcular nuevo stock para ${line.ingredienteId}`)

        // Write back in the original unit of the stock (if stock was in kg we convert back)
        const stockUnit = normalizeUnit(data?.unidad)
        let writeValue: number = newStockRaw
        if (stockUnit === 'kg') writeValue = newStockRaw / 1000

        tx.update(ingRef, { stockActual: writeValue, updatedAt: new Date().toISOString() })
      }
    })

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) }
  }
}

// Helper to parse strings like 'Jamón (2)' or 'Jamón' -> { name, quantity }
const parseItemString = (itemString: string): { name: string; quantity: number } => {
  const match = itemString.match(/^(.+?)\s*\((\d+)\)$/)
  if (match && match[1] && match[2]) {
    return { name: match[1].trim(), quantity: Number.parseInt(match[2]) }
  }
  return { name: itemString.trim(), quantity: 1 }
}

// Consume ingredients for a whole order (array of order items). Tries to use items_menu.receta when available,
// otherwise maps ingredient names to ingrediente docs and consumes accordingly.
export const consumeOrderItems = async (orderItems: any[]) => {
  try {
    // Load items_menu and ingredientes once
    const itemsMenuSnap = await getDocs(collection(db, 'items_menu'))
    const itemsMenuDocs: any[] = []
    itemsMenuSnap.forEach(d => itemsMenuDocs.push({ id: d.id, ...(d.data() || {}) }))

    const ingredientesSnap = await getDocs(collection(db, 'ingredientes'))
    const ingredientes: any[] = []
    const ingredientesByName: Record<string, any> = {}
    ingredientesSnap.forEach(d => {
      const data: any = d.data()
      ingredientes.push({ id: d.id, ...data })
      if (data?.nombre) ingredientesByName[String(data.nombre).toLowerCase()] = { id: d.id, ...data }
    })

    const results: any[] = []

    for (const item of orderItems) {
      const qty = item.cantidad || item.quantity || 1

      // Normalize names for matching
      const norm = (s: string) => s ? s.toLowerCase().replace(/[^a-z0-9ñáéíóúü ]+/gi, '').trim() : ''
      const itemName = norm(item.nombre || item.name || '')

      // Try to find matching items_menu doc
      let matchedItem = itemsMenuDocs.find(i => norm(i.nombre || i.name || '') === itemName)
      if (!matchedItem) {
        // fallback: try startsWith
        matchedItem = itemsMenuDocs.find(i => (norm(i.nombre || '') || '').startsWith(itemName.split(' ').slice(0,3).join(' ')))
      }

      if (matchedItem && matchedItem.receta && Array.isArray(matchedItem.receta) && matchedItem.receta.length > 0) {
        // consume recipe from items_menu
        const recipe: RecipeLine[] = matchedItem.receta.map((r: any) => ({ ingredienteId: r.ingredienteId, cantidad: Number(r.cantidad) || 0, unidad: r.unidad }))
        const res = await consumeRecipeForOrder(recipe, qty)
        results.push({ item: itemName, method: 'receta', success: res.success, error: res.error })
        continue
      }

      // Otherwise, build recipe lines from item.ingredients / premiumIngredients / sauces / drinks / extras
      const lines: RecipeLine[] = []
      const collectFromArray = (arr?: string[]) => {
        if (!arr) return
        arr.forEach(s => {
          const parsed = parseItemString(s)
          const ingDoc = ingredientesByName[parsed.name.toLowerCase()]
          if (ingDoc) {
            lines.push({ ingredienteId: ingDoc.id, cantidad: parsed.quantity, unidad: ingDoc.unidad || 'u' })
          }
        })
      }

      collectFromArray(item.ingredients)
      collectFromArray(item.premiumIngredients)
      collectFromArray(item.sauces)
      collectFromArray(item.drinks)
      collectFromArray(item.extras)

      if (lines.length > 0) {
        const res = await consumeRecipeForOrder(lines, qty)
        results.push({ item: itemName, method: 'derived', success: res.success, error: res.error })
      } else {
        results.push({ item: itemName, method: 'none', success: true, note: 'no matching recipe or ingredients found' })
      }
    }

    return { success: true, details: results }
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) }
  }
}

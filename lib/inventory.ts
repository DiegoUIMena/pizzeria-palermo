import { db } from './firebase'
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, Timestamp, getDoc } from 'firebase/firestore'

export interface Ingrediente {
  id: string
  nombre: string
  categoria: string
  stockActual: number
  stockMinimo: number
  stockMaximo: number
  unidad: string
  precioUnitario: number
  proveedor: string
  fechaVencimiento?: string
  estado: 'Disponible' | 'Stock Bajo' | 'Agotado' | 'Vencido'
  createdAt?: string
  updatedAt?: string
}

// Colección principal solicitada por el usuario
export const ingredientesCollection = collection(db, 'ingredientes')
// Colección legacy/fallback si el proyecto ya usaba 'inventory'
export const legacyInventoryCollection = collection(db, 'inventory')

export const computeEstado = (ing: { stockActual: number; stockMinimo: number; fechaVencimiento?: string }): Ingrediente['estado'] => {
  if (ing.stockActual === 0) return 'Agotado'
  if (ing.stockActual <= ing.stockMinimo) return 'Stock Bajo'
  if (ing.fechaVencimiento) {
    const venc = new Date(ing.fechaVencimiento)
    if (!isNaN(venc.getTime()) && venc.getTime() < Date.now()) return 'Vencido'
  }
  return 'Disponible'
}

export const listenIngredientes = (cb: (items: Ingrediente[], fuente: 'ingredientes' | 'inventory') => void): (() => void) => {
  const qMain = query(ingredientesCollection, orderBy('nombre'))
  let usedLegacy = false
  const unsubMain = onSnapshot(qMain, snap => {
    if (!snap.size && !usedLegacy) {
      // Activar listener legacy sólo si principal está vacía (para transición)
      usedLegacy = true
      const qLegacy = query(legacyInventoryCollection, orderBy('nombre'))
      const unsubLegacy = onSnapshot(qLegacy, snapLegacy => {
        const arr: Ingrediente[] = []
        snapLegacy.forEach(d => {
          const data: any = d.data()
          arr.push({
            id: d.id,
            nombre: data.nombre || d.id,
            categoria: data.categoria || 'Otros',
            stockActual: data.stockActual ?? 0,
            stockMinimo: data.stockMinimo ?? 0,
            stockMaximo: data.stockMaximo ?? 0,
            unidad: data.unidad || '',
            precioUnitario: data.precioUnitario ?? 0,
            proveedor: data.proveedor || '',
            fechaVencimiento: data.fechaVencimiento,
            estado: data.estado || computeEstado(data),
            createdAt: data.createdAt,
            updatedAt: data.updatedAt
          })
        })
        cb(arr, 'inventory')
      })
      // Mantener ambos unsub si luego aparece data en principal, seguir mostrando principal (preferencia)
      return () => unsubLegacy()
    }
    const arr: Ingrediente[] = []
    snap.forEach(d => {
      const data: any = d.data()
      arr.push({
        id: d.id,
        nombre: data.nombre || d.id,
        categoria: data.categoria || 'Otros',
        stockActual: data.stockActual ?? 0,
        stockMinimo: data.stockMinimo ?? 0,
        stockMaximo: data.stockMaximo ?? 0,
        unidad: data.unidad || '',
        precioUnitario: data.precioUnitario ?? 0,
        proveedor: data.proveedor || '',
        fechaVencimiento: data.fechaVencimiento,
        estado: data.estado || computeEstado(data),
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      })
    })
    cb(arr, 'ingredientes')
  })
  return () => unsubMain()
}

export const addIngrediente = async (data: Omit<Ingrediente,'id'|'estado'|'createdAt'|'updatedAt'>): Promise<string> => {
  const estado = computeEstado(data)
  const payload: any = {
    nombre: data.nombre,
    categoria: data.categoria,
    stockActual: data.stockActual,
    stockMinimo: data.stockMinimo,
    stockMaximo: data.stockMaximo,
    unidad: data.unidad,
    precioUnitario: data.precioUnitario,
    proveedor: data.proveedor,
    estado,
    createdAt: Timestamp.now().toDate().toISOString(),
    updatedAt: Timestamp.now().toDate().toISOString()
  }
  if (data.fechaVencimiento) payload.fechaVencimiento = data.fechaVencimiento
  const ref = await addDoc(ingredientesCollection, payload)
  return ref.id
}

export const updateIngrediente = async (id: string, data: Partial<Omit<Ingrediente,'id'>>) => {
  const ref = doc(db,'ingredientes',id)
  let current: any
  try { const snap = await getDoc(ref); current = snap.exists() ? snap.data() : {} } catch { current = {} }
  const merged = { ...current, ...data }
  const estado = computeEstado({ stockActual: merged.stockActual ?? 0, stockMinimo: merged.stockMinimo ?? 0, fechaVencimiento: merged.fechaVencimiento })
  const payload: any = { ...data, estado, updatedAt: Timestamp.now().toDate().toISOString() }
  if (payload.fechaVencimiento === '') delete payload.fechaVencimiento
  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k])
  await updateDoc(ref, payload)
}

export const deleteIngrediente = async (id: string) => {
  await deleteDoc(doc(db,'ingredientes',id))
}

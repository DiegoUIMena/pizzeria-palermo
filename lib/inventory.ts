import { db } from './firebase'
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, Timestamp } from 'firebase/firestore'

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

export const ingredientesCollection = collection(db, 'ingredientes')

export const computeEstado = (ing: { stockActual: number; stockMinimo: number; fechaVencimiento?: string }): Ingrediente['estado'] => {
  if (ing.stockActual === 0) return 'Agotado'
  if (ing.stockActual <= ing.stockMinimo) return 'Stock Bajo'
  if (ing.fechaVencimiento) {
    const venc = new Date(ing.fechaVencimiento)
    if (!isNaN(venc.getTime()) && venc.getTime() < Date.now()) return 'Vencido'
  }
  return 'Disponible'
}

export const listenIngredientes = (cb: (items: Ingrediente[]) => void): (() => void) => {
  const q = query(ingredientesCollection, orderBy('nombre'))
  return onSnapshot(q, snap => {
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
    cb(arr)
  })
}

export const addIngrediente = async (data: Omit<Ingrediente,'id'|'estado'|'createdAt'|'updatedAt'>) => {
  const estado = computeEstado(data)
  const docData: any = {
    ...data,
    estado,
    createdAt: Timestamp.now().toDate().toISOString(),
    updatedAt: Timestamp.now().toDate().toISOString()
  }
  // Eliminar campos undefined (Firestore no los acepta)
  Object.keys(docData).forEach(k => docData[k] === undefined && delete docData[k])
  await addDoc(ingredientesCollection, docData)
}

export const updateIngrediente = async (id: string, data: Partial<Omit<Ingrediente,'id'>>) => {
  const ref = doc(db,'ingredientes',id)
  const recalcular = (data.stockActual !== undefined || data.stockMinimo !== undefined || data.fechaVencimiento !== undefined)
  let estado: Ingrediente['estado'] | undefined
  if (recalcular) {
    // Necesitamos campos base; asumimos que vienen en data o se mantienen en Firestore; para simplicidad si faltan no recalculamos.
    if (typeof data.stockActual === 'number' && typeof data.stockMinimo === 'number') {
      estado = computeEstado({ stockActual: data.stockActual, stockMinimo: data.stockMinimo, fechaVencimiento: data.fechaVencimiento })
    }
  }
  const upd: any = {
    ...data,
    ...(estado ? { estado } : {}),
    updatedAt: Timestamp.now().toDate().toISOString()
  }
  Object.keys(upd).forEach(k => upd[k] === undefined && delete upd[k])
  await updateDoc(ref, upd)
}

export const deleteIngrediente = async (id: string) => {
  await deleteDoc(doc(db,'ingredientes',id))
}

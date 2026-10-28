"use client"

import { doc, getDoc, setDoc } from "firebase/firestore"
import { db } from "./firebase"

export interface DriverSettlement {
  id: string
  repartidorIniciales: string
  repartidorId?: string
  repartidorNombre?: string
  fechaPago: string
  fechaPagoTexto: string
  totalPagado: number
  pedidosIds: string[]
  pedidosCount: number
  createdAt: string
  notas?: string
}

export interface DriverSettlementsConfig {
  liquidaciones: DriverSettlement[]
  updatedAt?: string
}

const SETTINGS_COLLECTION = "settings"
const SETTLEMENTS_DOC = "delivery_driver_settlements"
const LOCAL_STORAGE_KEY = "admin_delivery_driver_settlements"

export async function getDriverSettlements(): Promise<DriverSettlement[]> {
  try {
    // 1. Intentar cargar desde Firestore
    const docRef = doc(db, SETTINGS_COLLECTION, SETTLEMENTS_DOC)
    const snapshot = await getDoc(docRef)
    
    if (snapshot.exists()) {
      const data = snapshot.data() as DriverSettlementsConfig
      const list = Array.isArray(data?.liquidaciones) ? data.liquidaciones : []
      if (typeof window !== "undefined") {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list))
      }
      return list
    }
  } catch (err) {
    console.warn("No se pudo cargar liquidaciones desde Firestore, intentando localStorage:", err)
  }

  // 2. Fallback a localStorage
  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (cached) {
        return JSON.parse(cached) as DriverSettlement[]
      }
    } catch (e) {
      console.error("Error al leer liquidaciones de localStorage:", e)
    }
  }

  return []
}

export async function saveDriverSettlement(settlement: DriverSettlement): Promise<boolean> {
  try {
    const existing = await getDriverSettlements()
    const updated = [settlement, ...existing.filter(s => s.id !== settlement.id)]

    // Guardar en localStorage inmediatamente
    if (typeof window !== "undefined") {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated))
    }

    // Guardar en Firestore
    const docRef = doc(db, SETTINGS_COLLECTION, SETTLEMENTS_DOC)
    await setDoc(docRef, {
      liquidaciones: updated,
      updatedAt: new Date().toISOString(),
    }, { merge: true })

    return true
  } catch (err) {
    console.error("Error al guardar liquidación en Firestore:", err)
    return false
  }
}

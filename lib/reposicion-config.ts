"use client"

import { doc, getDoc, setDoc } from "firebase/firestore"
import { db } from "./firebase"

const SETTINGS_COLLECTION = "settings"
const REPOSICION_CONFIG_DOC = "reposicion_config"

export async function getReposicionPhone(): Promise<string> {
  try {
    const ref = doc(db, SETTINGS_COLLECTION, REPOSICION_CONFIG_DOC)
    const snap = await getDoc(ref)
    if (snap.exists() && snap.data().phone) {
      return snap.data().phone
    }
    return ""
  } catch (error) {
    console.error("Error al obtener teléfono de reposición:", error)
    return ""
  }
}

export async function saveReposicionPhone(phone: string): Promise<void> {
  try {
    const ref = doc(db, SETTINGS_COLLECTION, REPOSICION_CONFIG_DOC)
    await setDoc(ref, { phone: phone.replace(/[^\d+]/g, ""), updatedAt: new Date().toISOString() }, { merge: true })
  } catch (error) {
    console.error("Error al guardar teléfono de reposición:", error)
    throw error
  }
}

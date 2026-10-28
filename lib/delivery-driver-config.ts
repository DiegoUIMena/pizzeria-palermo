"use client"

import { doc, getDoc, setDoc } from "firebase/firestore"
import { db } from "./firebase"

export interface DeliveryDriverContact {
  id: string
  nombre: string
  iniciales: string
  telefono: string
  activo: boolean
}

export interface DeliveryDriverConfig {
  contactos: DeliveryDriverContact[]
  updatedAt?: string
}

const SETTINGS_COLLECTION = "settings"
const DELIVERY_DRIVER_CONFIG_DOC = "delivery_driver_config"
const DEFAULT_DELIVERY_PHONE = "56956047580"

function cleanPhone(phone: string): string {
  return (phone || "").replace(/[^\d+]/g, "")
}

export function cleanInitials(initials: string, fallbackName = ""): string {
  const cleaned = (initials || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 4)

  if (cleaned) return cleaned

  if (fallbackName && fallbackName.trim()) {
    const words = fallbackName.trim().split(/\s+/)
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase().slice(0, 4)
    }
    return fallbackName.trim().slice(0, 2).toUpperCase()
  }

  return "REP"
}

function buildDefaultConfig(): DeliveryDriverConfig {
  return {
    contactos: [
      {
        id: "repartidor-principal",
        nombre: "Repartidor Principal",
        iniciales: "RP",
        telefono: DEFAULT_DELIVERY_PHONE,
        activo: true,
      },
    ],
  }
}

function normalizeContacts(contacts: DeliveryDriverContact[]): DeliveryDriverContact[] {
  const safe = Array.isArray(contacts) ? contacts : []

  const normalized = safe.map((contact, index) => {
    const nombre = (contact?.nombre || `Repartidor ${index + 1}`).trim()
    const iniciales = cleanInitials(contact?.iniciales, nombre)

    return {
      id: contact?.id || `repartidor-${index + 1}`,
      nombre,
      iniciales,
      telefono: cleanPhone(contact?.telefono || ""),
      activo: Boolean(contact?.activo),
    }
  })

  // Si hay contactos y ninguno está activo, marcar el primero como activo por defecto
  const activeContacts = normalized.filter((c) => c.activo)
  if (normalized.length > 0 && activeContacts.length === 0) {
    normalized[0].activo = true
  }

  // Ahora se permite más de 1 repartidor activo simultáneamente
  return normalized
}

export async function getDeliveryDriverConfig(): Promise<DeliveryDriverConfig> {
  const ref = doc(db, SETTINGS_COLLECTION, DELIVERY_DRIVER_CONFIG_DOC)
  const snap = await getDoc(ref)

  if (!snap.exists()) {
    return buildDefaultConfig()
  }

  const data = snap.data() as DeliveryDriverConfig
  const contactos = normalizeContacts(data.contactos || [])

  if (contactos.length === 0) {
    return buildDefaultConfig()
  }

  return {
    contactos,
    updatedAt: data.updatedAt,
  }
}

export async function saveDeliveryDriverConfig(config: DeliveryDriverConfig): Promise<void> {
  const contactos = normalizeContacts(config.contactos || []).filter(
    (contact) => contact.nombre && contact.telefono
  )

  const safeConfig: DeliveryDriverConfig = {
    contactos: contactos.length > 0 ? contactos : buildDefaultConfig().contactos,
    updatedAt: new Date().toISOString(),
  }

  const ref = doc(db, SETTINGS_COLLECTION, DELIVERY_DRIVER_CONFIG_DOC)
  await setDoc(ref, safeConfig, { merge: true })
}

export async function getActiveDeliveryDrivers(): Promise<DeliveryDriverContact[]> {
  try {
    const config = await getDeliveryDriverConfig()
    return config.contactos.filter((contact) => contact.activo)
  } catch (error) {
    console.error("Error al obtener repartidores activos:", error)
    return []
  }
}

export async function getActiveDeliveryPhone(): Promise<string> {
  try {
    const drivers = await getActiveDeliveryDrivers()
    if (drivers.length > 0 && drivers[0].telefono) {
      return cleanPhone(drivers[0].telefono)
    }

    return DEFAULT_DELIVERY_PHONE
  } catch (error) {
    console.error("Error al obtener teléfono activo de delivery:", error)
    return DEFAULT_DELIVERY_PHONE
  }
}

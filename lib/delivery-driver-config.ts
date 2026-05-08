"use client"

import { doc, getDoc, setDoc } from "firebase/firestore"
import { db } from "./firebase"

export interface DeliveryDriverContact {
  id: string
  nombre: string
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

function buildDefaultConfig(): DeliveryDriverConfig {
  return {
    contactos: [
      {
        id: "repartidor-principal",
        nombre: "Repartidor Principal",
        telefono: DEFAULT_DELIVERY_PHONE,
        activo: true,
      },
    ],
  }
}

function normalizeContacts(contacts: DeliveryDriverContact[]): DeliveryDriverContact[] {
  const safe = Array.isArray(contacts) ? contacts : []

  const normalized = safe.map((contact, index) => ({
    id: contact?.id || `repartidor-${index + 1}`,
    nombre: (contact?.nombre || `Repartidor ${index + 1}`).trim(),
    telefono: cleanPhone(contact?.telefono || ""),
    activo: Boolean(contact?.activo),
  }))

  const activeContacts = normalized.filter((c) => c.activo)

  if (normalized.length > 0 && activeContacts.length === 0) {
    normalized[0].activo = true
  }

  if (activeContacts.length > 1) {
    let activeAssigned = false
    for (const contact of normalized) {
      if (contact.activo && !activeAssigned) {
        activeAssigned = true
      } else {
        contact.activo = false
      }
    }
  }

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

export async function getActiveDeliveryPhone(): Promise<string> {
  try {
    const config = await getDeliveryDriverConfig()
    const active = config.contactos.find((contact) => contact.activo)

    if (active?.telefono) {
      return cleanPhone(active.telefono)
    }

    return DEFAULT_DELIVERY_PHONE
  } catch (error) {
    console.error("Error al obtener teléfono activo de delivery:", error)
    return DEFAULT_DELIVERY_PHONE
  }
}

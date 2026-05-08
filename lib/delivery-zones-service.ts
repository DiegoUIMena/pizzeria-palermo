"use client"

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore"
import { db } from "./firebase"
import type { DeliveryZone } from "./delivery-zones"

export const DELIVERY_ZONES_COLLECTION = "delivery-zones"

const DELIVERY_ZONES_CACHE_TTL_MS = 60 * 1000
const MAX_BATCH_OPERATIONS = 450

let zonesCache: DeliveryZone[] | null = null
let zonesCacheTimestamp = 0
let zonesFetchPromise: Promise<DeliveryZone[]> | null = null

let sharedZonesListenerUnsubscribe: Unsubscribe | null = null
const sharedZonesSubscribers = new Set<(zones: DeliveryZone[]) => void>()

function isFreshCache() {
  return zonesCache !== null && Date.now() - zonesCacheTimestamp < DELIVERY_ZONES_CACHE_TTL_MS
}

function mapPolygonFromFirestore(rawPolygon: any): Array<[number, number]> {
  if (!Array.isArray(rawPolygon)) return []
  return rawPolygon
    .map((point: any) => {
      if (Array.isArray(point) && point.length >= 2) {
        return [Number(point[0]), Number(point[1])] as [number, number]
      }
      if (point && typeof point === "object" && typeof point.lat === "number" && typeof point.lng === "number") {
        return [point.lat, point.lng] as [number, number]
      }
      return null
    })
    .filter((point): point is [number, number] => Array.isArray(point))
}

function mapZoneDoc(docSnap: any): DeliveryZone {
  const data = docSnap.data() as any
  return {
    id: docSnap.id,
    nombre: data.nombre,
    tarifa: data.tarifa,
    disponible: data.disponible,
    tiempoEstimado: data.tiempoEstimado,
    poligono: mapPolygonFromFirestore(data.poligono),
    color: data.color,
    descripcion: data.descripcion || "",
  }
}

function mapPolygonToFirestore(zone: DeliveryZone) {
  return (zone.poligono || []).map((point: any) => {
    if (Array.isArray(point) && point.length >= 2) {
      return { lat: Number(point[0]), lng: Number(point[1]) }
    }
    if (point && typeof point === "object" && typeof point.lat === "number" && typeof point.lng === "number") {
      return { lat: point.lat, lng: point.lng }
    }
    return null
  }).filter((point) => point !== null)
}

function setZonesCache(zones: DeliveryZone[]) {
  zonesCache = zones
  zonesCacheTimestamp = Date.now()
}

function invalidateZonesCache() {
  zonesCache = null
  zonesCacheTimestamp = 0
}

async function commitZonesBatch(
  operations: Array<{ type: "set"; ref: ReturnType<typeof doc>; data: any } | { type: "delete"; ref: ReturnType<typeof doc> }>
) {
  if (operations.length === 0) return

  for (let i = 0; i < operations.length; i += MAX_BATCH_OPERATIONS) {
    const chunk = operations.slice(i, i + MAX_BATCH_OPERATIONS)
    const batch = writeBatch(db)
    chunk.forEach((operation) => {
      if (operation.type === "set") {
        batch.set(operation.ref, operation.data)
      } else {
        batch.delete(operation.ref)
      }
    })
    await batch.commit()
  }
}

export async function getDeliveryZones(): Promise<DeliveryZone[]> {
  if (isFreshCache()) {
    return zonesCache as DeliveryZone[]
  }

  if (zonesFetchPromise) {
    return zonesFetchPromise
  }

  zonesFetchPromise = (async () => {
    try {
      const zonesRef = collection(db, DELIVERY_ZONES_COLLECTION)
      const snapshot = await getDocs(zonesRef)
      const zones = snapshot.docs.map((docSnap) => mapZoneDoc(docSnap))
      setZonesCache(zones)
      return zones
    } catch (error) {
      console.error("Error al obtener zonas de delivery:", error)
      throw new Error("No se pudieron cargar las zonas de delivery")
    } finally {
      zonesFetchPromise = null
    }
  })()

  return zonesFetchPromise
}

export async function saveDeliveryZone(zone: DeliveryZone): Promise<void> {
  try {
    const zoneRef = doc(db, DELIVERY_ZONES_COLLECTION, zone.id)
    await setDoc(zoneRef, {
      nombre: zone.nombre,
      tarifa: zone.tarifa,
      disponible: zone.disponible,
      tiempoEstimado: zone.tiempoEstimado,
      poligono: mapPolygonToFirestore(zone),
      color: zone.color,
      descripcion: zone.descripcion || "",
    })
    invalidateZonesCache()
  } catch (error) {
    console.error(`Error al guardar zona ${zone.id}:`, error)
    throw new Error(`No se pudo guardar la zona ${zone.nombre}`)
  }
}

export async function deleteDeliveryZone(zoneId: string): Promise<void> {
  try {
    const zoneRef = doc(db, DELIVERY_ZONES_COLLECTION, zoneId)
    await deleteDoc(zoneRef)
    invalidateZonesCache()
  } catch (error) {
    console.error(`Error al eliminar zona ${zoneId}:`, error)
    throw new Error(`No se pudo eliminar la zona ${zoneId}`)
  }
}

export async function saveDeliveryZones(zones: DeliveryZone[]): Promise<void> {
  try {
    if (!zones || zones.length === 0) {
      console.warn("No hay zonas para guardar. El array está vacío.")
      return
    }

    const zonesRef = collection(db, DELIVERY_ZONES_COLLECTION)
    const currentSnapshot = await getDocs(zonesRef)
    const newZoneIds = new Set(zones.map((zone) => zone.id))

    const operations: Array<
      { type: "set"; ref: ReturnType<typeof doc>; data: any } |
      { type: "delete"; ref: ReturnType<typeof doc> }
    > = []

    currentSnapshot.docs.forEach((docSnap) => {
      if (!newZoneIds.has(docSnap.id)) {
        operations.push({ type: "delete", ref: docSnap.ref })
      }
    })

    zones.forEach((zone) => {
      if (!zone.poligono || !Array.isArray(zone.poligono) || zone.poligono.length < 3) {
        console.error(`Zona ${zone.id} (${zone.nombre}) tiene un polígono inválido`)
        return
      }

      const pointsAreValid = zone.poligono.every((point) =>
        (Array.isArray(point) && point.length >= 2) ||
        (point && typeof point === "object" && typeof (point as any).lat === "number" && typeof (point as any).lng === "number")
      )

      if (!pointsAreValid) {
        console.error(`Zona ${zone.id} (${zone.nombre}) tiene puntos inválidos en el polígono`)
        return
      }

      const zoneRef = doc(db, DELIVERY_ZONES_COLLECTION, zone.id)
      operations.push({
        type: "set",
        ref: zoneRef,
        data: {
          nombre: zone.nombre,
          tarifa: zone.tarifa,
          disponible: zone.disponible,
          tiempoEstimado: zone.tiempoEstimado,
          poligono: mapPolygonToFirestore(zone),
          color: zone.color,
          descripcion: zone.descripcion || "",
        },
      })
    })

    await commitZonesBatch(operations)
    invalidateZonesCache()
  } catch (error) {
    console.error("Error al guardar zonas:", error)
    throw new Error("No se pudieron guardar las zonas de delivery")
  }
}

export function subscribeToDeliveryZones(
  onZonesChange: (zones: DeliveryZone[]) => void
): Unsubscribe {
  sharedZonesSubscribers.add(onZonesChange)

  if (zonesCache) {
    onZonesChange(zonesCache)
  }

  if (!sharedZonesListenerUnsubscribe) {
    const zonesRef = collection(db, DELIVERY_ZONES_COLLECTION)
    sharedZonesListenerUnsubscribe = onSnapshot(
      zonesRef,
      (snapshot) => {
        const zones = snapshot.docs.map((docSnap) => mapZoneDoc(docSnap))
        setZonesCache(zones)

        sharedZonesSubscribers.forEach((subscriber) => {
          try {
            subscriber(zones)
          } catch (error) {
            console.error("Error notificando suscriptor de zonas:", error)
          }
        })
      },
      (error) => {
        console.error("Error en la suscripción a zonas de delivery:", error)
      }
    )
  }

  return () => {
    sharedZonesSubscribers.delete(onZonesChange)
    if (sharedZonesSubscribers.size === 0 && sharedZonesListenerUnsubscribe) {
      sharedZonesListenerUnsubscribe()
      sharedZonesListenerUnsubscribe = null
    }
  }
}

export async function initializeDeliveryZones(defaultZones: DeliveryZone[]): Promise<void> {
  try {
    const zonesRef = collection(db, DELIVERY_ZONES_COLLECTION)
    const snapshot = await getDocs(zonesRef)

    if (snapshot.empty) {
      await saveDeliveryZones(defaultZones)
    }
  } catch (error) {
    console.error("Error al inicializar zonas de delivery:", error)
    throw new Error("No se pudieron inicializar las zonas de delivery")
  }
}

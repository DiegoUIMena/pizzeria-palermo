"use client"

import { doc, getDoc, onSnapshot, setDoc, Unsubscribe } from "firebase/firestore"
import { db } from "./firebase"

export interface SalsasDisponiblesConfig {
  ajo: boolean
  chimichurri: boolean
  bbq: boolean
  pesto: boolean
}

export interface BebidasDisponiblesConfig {
  liptonLata: boolean
  liptonBotella: boolean
  cocaLataTradicional: boolean
  cocaLataZero: boolean
  cocaBotellaTradicional: boolean
  cocaBotellaZero: boolean
}

export interface AgregadosConfig {
  rollitosPackStock: number
  gauchitosDisponible: boolean
  salsasDisponibles: SalsasDisponiblesConfig
  bebidasDisponibles: BebidasDisponiblesConfig
  updatedAt?: string
}

const SETTINGS_COLLECTION = "settings"
const AGREGADOS_CONFIG_DOC = "agregados_config"

const DEFAULT_CONFIG: AgregadosConfig = {
  rollitosPackStock: 99,
  gauchitosDisponible: true,
  salsasDisponibles: {
    ajo: true,
    chimichurri: true,
    bbq: true,
    pesto: true,
  },
  bebidasDisponibles: {
    liptonLata: true,
    liptonBotella: true,
    cocaLataTradicional: true,
    cocaLataZero: true,
    cocaBotellaTradicional: true,
    cocaBotellaZero: true,
  },
}

function normalizeConfig(data: Partial<AgregadosConfig> | undefined | null): AgregadosConfig {
  const rollitosRaw = Number(data?.rollitosPackStock)
  const rollitosPackStock = Number.isFinite(rollitosRaw) && rollitosRaw >= 0
    ? Math.floor(rollitosRaw)
    : DEFAULT_CONFIG.rollitosPackStock

  return {
    rollitosPackStock,
    gauchitosDisponible: data?.gauchitosDisponible ?? DEFAULT_CONFIG.gauchitosDisponible,
    salsasDisponibles: {
      ajo: data?.salsasDisponibles?.ajo ?? DEFAULT_CONFIG.salsasDisponibles.ajo,
      chimichurri: data?.salsasDisponibles?.chimichurri ?? DEFAULT_CONFIG.salsasDisponibles.chimichurri,
      bbq: data?.salsasDisponibles?.bbq ?? DEFAULT_CONFIG.salsasDisponibles.bbq,
      pesto: data?.salsasDisponibles?.pesto ?? DEFAULT_CONFIG.salsasDisponibles.pesto,
    },
    bebidasDisponibles: {
      liptonLata: data?.bebidasDisponibles?.liptonLata ?? DEFAULT_CONFIG.bebidasDisponibles.liptonLata,
      liptonBotella: data?.bebidasDisponibles?.liptonBotella ?? DEFAULT_CONFIG.bebidasDisponibles.liptonBotella,
      cocaLataTradicional: data?.bebidasDisponibles?.cocaLataTradicional ?? DEFAULT_CONFIG.bebidasDisponibles.cocaLataTradicional,
      cocaLataZero: data?.bebidasDisponibles?.cocaLataZero ?? DEFAULT_CONFIG.bebidasDisponibles.cocaLataZero,
      cocaBotellaTradicional: data?.bebidasDisponibles?.cocaBotellaTradicional ?? DEFAULT_CONFIG.bebidasDisponibles.cocaBotellaTradicional,
      cocaBotellaZero: data?.bebidasDisponibles?.cocaBotellaZero ?? DEFAULT_CONFIG.bebidasDisponibles.cocaBotellaZero,
    },
    updatedAt: data?.updatedAt,
  }
}

export async function getAgregadosConfig(): Promise<AgregadosConfig> {
  const ref = doc(db, SETTINGS_COLLECTION, AGREGADOS_CONFIG_DOC)
  const snap = await getDoc(ref)

  if (!snap.exists()) {
    await setDoc(
      ref,
      {
        ...DEFAULT_CONFIG,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    )
    return DEFAULT_CONFIG
  }

  return normalizeConfig(snap.data() as Partial<AgregadosConfig>)
}

export async function saveAgregadosConfig(config: AgregadosConfig): Promise<void> {
  const ref = doc(db, SETTINGS_COLLECTION, AGREGADOS_CONFIG_DOC)
  const safeConfig = normalizeConfig(config)

  await setDoc(
    ref,
    {
      ...safeConfig,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  )
}

export function subscribeAgregadosConfig(
  onChange: (config: AgregadosConfig) => void
): Unsubscribe {
  const ref = doc(db, SETTINGS_COLLECTION, AGREGADOS_CONFIG_DOC)

  return onSnapshot(
    ref,
    (snapshot) => {
      if (!snapshot.exists()) {
        onChange(DEFAULT_CONFIG)
        return
      }

      const config = normalizeConfig(snapshot.data() as Partial<AgregadosConfig>)
      onChange(config)
    },
    (error) => {
      console.error("Error escuchando configuración de agregados:", error)
    }
  )
}

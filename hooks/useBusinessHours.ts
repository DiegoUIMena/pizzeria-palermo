import { useState, useEffect } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

interface BusinessHoursConfig {
  openingTime: string
  closingTime: string
  isOpen: boolean
  closedBannerImages: any[]
  activeBannerId: string | null
}

interface BusinessHoursSharedState {
  config: BusinessHoursConfig | null
  activeBannerUrl: string | null
}

const CACHE_KEY = 'business_hours_cache'
const CACHE_DURATION = 5 * 60 * 1000

const defaultConfig: BusinessHoursConfig = {
  openingTime: '18:00',
  closingTime: '23:30',
  isOpen: true,
  closedBannerImages: [],
  activeBannerId: null,
}

let sharedState: BusinessHoursSharedState = {
  config: null,
  activeBannerUrl: null,
}

let sharedFetchedAt = 0
let sharedFetchPromise: Promise<BusinessHoursSharedState> | null = null
let sharedRefreshInterval: ReturnType<typeof setInterval> | null = null
const sharedSubscribers = new Set<(state: BusinessHoursSharedState) => void>()

function notifySubscribers(state: BusinessHoursSharedState) {
  sharedSubscribers.forEach((subscriber) => {
    try {
      subscriber(state)
    } catch (error) {
      console.error('Error en suscriptor de business hours:', error)
    }
  })
}

function computeActiveBannerUrl(config: BusinessHoursConfig | null): string | null {
  if (!config) return null
  const activeBanner = config.closedBannerImages?.find((img: any) => img.id === config.activeBannerId)
  return activeBanner?.url || null
}

function readCacheFromLocalStorage() {
  if (typeof window === 'undefined') return null
  const cached = localStorage.getItem(CACHE_KEY)
  if (!cached) return null

  try {
    const parsed = JSON.parse(cached)
    const age = Date.now() - parsed.timestamp
    const forceReload = localStorage.getItem('force_reload_timestamp')
    const shouldForceReload = forceReload && parseInt(forceReload, 10) > parsed.timestamp

    if (age < CACHE_DURATION && !shouldForceReload) {
      return parsed.data as BusinessHoursConfig
    }
  } catch {
    return null
  }

  return null
}

function writeCacheToLocalStorage(config: BusinessHoursConfig) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      data: config,
      timestamp: Date.now(),
    }))
  } catch {
    // Ignorar errores de cache
  }
}

async function loadBusinessHoursConfig(force = false): Promise<BusinessHoursSharedState> {
  const now = Date.now()
  if (!force && sharedState.config && (now - sharedFetchedAt) < CACHE_DURATION) {
    return sharedState
  }

  if (sharedFetchPromise) {
    return sharedFetchPromise
  }

  sharedFetchPromise = (async () => {
    try {
      if (!force) {
        const cached = readCacheFromLocalStorage()
        if (cached) {
          sharedState = {
            config: cached,
            activeBannerUrl: computeActiveBannerUrl(cached),
          }
          sharedFetchedAt = Date.now()
          return sharedState
        }
      }

      if (!db) {
        sharedState = {
          config: defaultConfig,
          activeBannerUrl: null,
        }
        sharedFetchedAt = Date.now()
        return sharedState
      }

      const docRef = doc(db, 'settings', 'businessHours')
      const docSnap = await getDoc(docRef)

      const config = docSnap.exists() ? (docSnap.data() as BusinessHoursConfig) : defaultConfig
      writeCacheToLocalStorage(config)

      sharedState = {
        config,
        activeBannerUrl: computeActiveBannerUrl(config),
      }
      sharedFetchedAt = Date.now()
      return sharedState
    } catch (error) {
      console.error('Error cargando configuracion:', error)
      if (!sharedState.config) {
        sharedState = {
          config: defaultConfig,
          activeBannerUrl: null,
        }
      }
      return sharedState
    } finally {
      sharedFetchPromise = null
    }
  })()

  return sharedFetchPromise
}

function startSharedRefreshLoop() {
  if (sharedRefreshInterval) return
  sharedRefreshInterval = setInterval(async () => {
    const state = await loadBusinessHoursConfig(true)
    notifySubscribers(state)
  }, CACHE_DURATION)
}

function stopSharedRefreshLoop() {
  if (!sharedRefreshInterval) return
  clearInterval(sharedRefreshInterval)
  sharedRefreshInterval = null
}

function subscribeBusinessHours(
  callback: (state: BusinessHoursSharedState) => void
): () => void {
  sharedSubscribers.add(callback)

  if (sharedState.config) {
    callback(sharedState)
  } else {
    loadBusinessHoursConfig().then((state) => {
      if (sharedSubscribers.has(callback)) {
        callback(state)
      }
    })
  }

  startSharedRefreshLoop()

  return () => {
    sharedSubscribers.delete(callback)
    if (sharedSubscribers.size === 0) {
      stopSharedRefreshLoop()
    }
  }
}

export function useBusinessHours() {
  const [isOpen, setIsOpen] = useState(true)
  const [nextChange, setNextChange] = useState<Date | null>(null)
  const [config, setConfig] = useState<BusinessHoursConfig | null>(sharedState.config)
  const [activeBannerUrl, setActiveBannerUrl] = useState<string | null>(sharedState.activeBannerUrl)

  useEffect(() => {
    const unsubscribe = subscribeBusinessHours((state) => {
      setConfig(state.config)
      setActiveBannerUrl(state.activeBannerUrl)
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!config) return

    const checkBusinessHours = () => {
      if (config.isOpen === false) {
        setIsOpen(false)
        setNextChange(null)
        return
      }

      const now = new Date()
      const hours = now.getHours()
      const minutes = now.getMinutes()
      const currentTimeInMinutes = hours * 60 + minutes

      const [openHour, openMinute] = config.openingTime.split(':').map(Number)
      const [closeHour, closeMinute] = config.closingTime.split(':').map(Number)

      const openingTime = openHour * 60 + openMinute
      const closingTime = closeHour * 60 + closeMinute

      let open = false
      const next = new Date()

      if (closingTime > openingTime) {
        open = currentTimeInMinutes >= openingTime && currentTimeInMinutes < closingTime

        if (currentTimeInMinutes < openingTime) {
          next.setHours(openHour, openMinute, 0, 0)
        } else {
          next.setHours(closeHour, closeMinute, 0, 0)
        }
      } else {
        open = currentTimeInMinutes >= openingTime || currentTimeInMinutes < closingTime

        if (currentTimeInMinutes < closingTime) {
          next.setHours(closeHour, closeMinute, 0, 0)
        } else if (currentTimeInMinutes < openingTime) {
          next.setHours(openHour, openMinute, 0, 0)
        } else {
          next.setDate(next.getDate() + 1)
          next.setHours(closeHour, closeMinute, 0, 0)
        }
      }

      setIsOpen(open)
      setNextChange(next)
    }

    checkBusinessHours()
    const interval = setInterval(checkBusinessHours, 60000)
    return () => clearInterval(interval)
  }, [config])

  return {
    isOpen,
    nextChange,
    config,
    activeBannerUrl,
  }
}

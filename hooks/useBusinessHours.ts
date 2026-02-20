import { useState, useEffect } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

interface BusinessHoursConfig {
  openingTime: string
  closingTime: string
  closedBannerImages: any[]
  activeBannerId: string | null
}

const CACHE_KEY = 'business_hours_cache'
const CACHE_DURATION = 5 * 60 * 1000

export function useBusinessHours() {
  const [isOpen, setIsOpen] = useState(true)
  const [nextChange, setNextChange] = useState<Date | null>(null)
  const [config, setConfig] = useState<BusinessHoursConfig | null>(null)
  const [activeBannerUrl, setActiveBannerUrl] = useState<string | null>(null)

  useEffect(() => {
    const loadConfig = async () => {
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached) {
        try {
          const { data, timestamp } = JSON.parse(cached)
          const age = Date.now() - timestamp
          
          // Verificar si hay una solicitud de recarga forzada
          const forceReload = localStorage.getItem('force_reload_timestamp')
          const shouldForceReload = forceReload && parseInt(forceReload) > timestamp
          
          if (age < CACHE_DURATION && !shouldForceReload) {
            setConfig(data)
            const activeBanner = data.closedBannerImages?.find(
              (img: any) => img.id === data.activeBannerId
            )
            setActiveBannerUrl(activeBanner?.url || null)
            return
          }
        } catch (e) {
          // Cache corrupto
        }
      }

      if (!db) {
        const defaultConfig = {
          openingTime: '18:00',
          closingTime: '23:30',
          closedBannerImages: [],
          activeBannerId: null,
        }
        setConfig(defaultConfig)
        return
      }

      try {
        const docRef = doc(db, 'settings', 'businessHours')
        const docSnap = await getDoc(docRef)
        
        if (docSnap.exists()) {
          const data = docSnap.data() as BusinessHoursConfig
          setConfig(data)
          
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            data,
            timestamp: Date.now()
          }))
          
          const activeBanner = data.closedBannerImages?.find(
            (img) => img.id === data.activeBannerId
          )
          setActiveBannerUrl(activeBanner?.url || null)
        } else {
          const defaultConfig = {
            openingTime: '18:00',
            closingTime: '23:30',
            closedBannerImages: [],
            activeBannerId: null,
          }
          setConfig(defaultConfig)
        }
      } catch (error) {
        console.error('Error cargando configuracion:', error)
      }
    }

    loadConfig()
    
    const interval = setInterval(loadConfig, CACHE_DURATION)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!config) return

    const checkBusinessHours = () => {
      const now = new Date()
      const hours = now.getHours()
      const minutes = now.getMinutes()
      const currentTimeInMinutes = hours * 60 + minutes

      const [openHour, openMinute] = config.openingTime.split(':').map(Number)
      const [closeHour, closeMinute] = config.closingTime.split(':').map(Number)

      const openingTime = openHour * 60 + openMinute
      const closingTime = closeHour * 60 + closeMinute

      let open = false
      let next = new Date()

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
    activeBannerUrl
  }
}

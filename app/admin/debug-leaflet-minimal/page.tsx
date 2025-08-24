"use client"

import dynamic from 'next/dynamic'
import React from 'react'

// Cargar componentes de react-leaflet sólo en cliente
const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false })

export default function DebugLeafletMinimal() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Debug Leaflet Minimal</h1>
      <p className="text-sm text-gray-500">Página mínima para verificar que MapContainer renderiza correctamente sin diálogo ni lógica adicional.</p>
      <div className="h-[500px] border rounded overflow-hidden">
        <MapContainer center={[-32.8347,-70.5983]} zoom={15} style={{width:'100%',height:'100%'}}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
        </MapContainer>
      </div>
    </div>
  )
}
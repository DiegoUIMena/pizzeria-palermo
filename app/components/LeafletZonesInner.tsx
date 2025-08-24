"use client"

import React from 'react'
import { MapContainer, TileLayer, Polygon, Marker, Tooltip, useMapEvent } from 'react-leaflet'
import L, { LatLngExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { type DeliveryZone } from '../../lib/delivery-zones'

const MAP_CENTER: [number, number] = [-32.8347, -70.5983]
const MAP_ZOOM = 15

const vertexIcon = L.divIcon({
  className: 'vertex-marker',
  html: '<div style="width:14px;height:14px;border:3px solid #fff;border-radius:50%;background:#2563eb;box-shadow:0 0 0 2px #2563eb55"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7]
})

export interface LeafletZonesInnerProps {
  zones: DeliveryZone[]
  visibleZoneIds: string[]
  selectedZoneId: string | null
  normalizePolygon: (poly: DeliveryZone['poligono']) => [number, number][]
  isDrawing: boolean
  drawingPoints: [number, number][]
  onAddDrawingPoint: (p: [number, number]) => void
  onSelectZone: (id: string) => void
  isEditingVertices: boolean
  onVertexDrag: (index: number, point: [number, number]) => void
}

const LeafletZonesInner: React.FC<LeafletZonesInnerProps> = ({
  zones,
  visibleZoneIds,
  selectedZoneId,
  normalizePolygon,
  isDrawing,
  drawingPoints,
  onAddDrawingPoint,
  onSelectZone,
  isEditingVertices,
  onVertexDrag
}) => {
  // Componente interno para manejar clicks dentro del contexto del mapa
  const ClickHandler: React.FC = () => {
    useMapEvent('click', e => {
      if (isDrawing) {
        const { lat, lng } = e.latlng
        onAddDrawingPoint([lat, lng])
      }
    })
    return null
  }
  return (
    <MapContainer center={MAP_CENTER} zoom={MAP_ZOOM} style={{ width: '100%', height: '100%' }} className={isDrawing ? 'cursor-crosshair' : ''}>
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
      />
      <ClickHandler />
      {zones.filter(z => visibleZoneIds.includes(z.id) && z.poligono && z.poligono.length >= 3).map(z => {
        const positions = normalizePolygon(z.poligono) as LatLngExpression[]
        const selected = selectedZoneId === z.id
        return (
          <Polygon
            key={z.id}
            pathOptions={{ color: z.color || '#10B981', weight: selected ? 4 : 2, fillOpacity: selected ? 0.5 : 0.35 }}
            positions={positions}
            eventHandlers={{
              click: (e) => {
                e.originalEvent.stopPropagation()
                onSelectZone(z.id)
              }
            }}
          >
            <Tooltip sticky>{z.nombre}</Tooltip>
          </Polygon>
        )
      })}
      {isDrawing && drawingPoints.length > 1 && (
        <Polygon positions={drawingPoints as LatLngExpression[]} pathOptions={{ color: '#2563eb', dashArray: '6 4', weight: 2, fillOpacity: 0.2 }} />
      )}
      {isDrawing && drawingPoints.map((p, i) => (
        <Marker key={i} position={p as LatLngExpression} icon={vertexIcon} />
      ))}
      {selectedZoneId && isEditingVertices && (() => {
        const zone = zones.find(z => z.id === selectedZoneId)
        if (!zone) return null
        return normalizePolygon(zone.poligono).map((p, i) => (
          <Marker
            key={i}
            position={p as LatLngExpression}
            draggable
            icon={vertexIcon}
            eventHandlers={{
              dragend: (e) => {
                const ll = e.target.getLatLng();
                onVertexDrag(i, [ll.lat, ll.lng])
              }
            }}
          >
            <Tooltip>Vértice {i + 1}</Tooltip>
          </Marker>
        ))
      })()}
    </MapContainer>
  )
}

export default LeafletZonesInner

"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, Edit, Download, Upload } from "lucide-react"
import DeliveryZoneMap from "../../components/DeliveryZoneMap"
import { deliveryZones, type DeliveryZone } from "../../../lib/delivery-zones"

export default function ZonasDeliveryPage() {
  const [zones, setZones] = useState<DeliveryZone[]>([...deliveryZones])
  const [isMapOpen, setIsMapOpen] = useState(false)

  const handleSaveZones = (updatedZones: DeliveryZone[]) => {
    setZones(updatedZones)
    // Aquí se implementaría la lógica para guardar las zonas en la base de datos
    console.log("Zonas guardadas:", updatedZones)
  }

  const exportZones = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(zones, null, 2))
    const downloadAnchorNode = document.createElement("a")
    downloadAnchorNode.setAttribute("href", dataStr)
    downloadAnchorNode.setAttribute("download", "zonas-delivery.json")
    document.body.appendChild(downloadAnchorNode)
    downloadAnchorNode.click()
    downloadAnchorNode.remove()
  }

  const importZones = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const importedZones = JSON.parse(e.target?.result as string)
        if (Array.isArray(importedZones)) {
          setZones(importedZones)
        } else {
          alert("El archivo no contiene un formato válido de zonas")
        }
      } catch (error) {
        alert("Error al importar el archivo: " + error)
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Zonas de Delivery</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Administra las zonas de entrega y tarifas para Los Andes</p>
          </div>
          <div className="flex space-x-3">
            <Button onClick={() => setIsMapOpen(true)} className="bg-pink-600 hover:bg-pink-700 text-white">
              <Edit className="w-4 h-4 mr-2" />
              Editar Zonas en Mapa
            </Button>
            <div className="flex space-x-2">
              <Button variant="outline" onClick={exportZones}>
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
              <div className="relative">
                <Button variant="outline">
                  <Upload className="w-4 h-4 mr-2" />
                  Importar
                </Button>
                <input
                  type="file"
                  accept=".json"
                  onChange={importZones}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {zones.map((zone) => (
            <Card key={zone.id} className="overflow-hidden bg-white dark:bg-gray-800 border dark:border-gray-700">
              <div className="h-2" style={{ backgroundColor: zone.color }}></div>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-xl dark:text-white">{zone.nombre}</CardTitle>
                  <Badge variant={zone.disponible ? "default" : "destructive"}>
                    {zone.disponible ? "Disponible" : "No Disponible"}
                  </Badge>
                </div>
                <CardDescription className="dark:text-gray-400">{zone.descripcion || "Sin descripción"}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-500">Tarifa de Delivery:</span>
                    <span className="font-bold text-lg">${zone.tarifa.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-500">Tiempo Estimado:</span>
                    <span>{zone.tiempoEstimado}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-500">Puntos del Polígono:</span>
                    <span>{zone.poligono.length}</span>
                  </div>
                  <div className="pt-2">
                    <Button variant="outline" size="sm" className="w-full" onClick={() => setIsMapOpen(true)}>
                      <MapPin className="w-4 h-4 mr-2" />
                      Ver en Mapa
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <DeliveryZoneMap isOpen={isMapOpen} onClose={() => setIsMapOpen(false)} onSaveZones={handleSaveZones} />
      </main>
    </div>
  )
}

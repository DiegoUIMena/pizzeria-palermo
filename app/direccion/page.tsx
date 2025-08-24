"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { detectarZonaCliente, type DeliveryZone } from "../../lib/delivery-zones"
import { useDeliveryZones } from "../../hooks/useDeliveryZones"
import { toast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, MapPin } from "lucide-react"
import Header from "../components/Header"
import Footer from "../components/Footer"
import LocationPicker from "../components/LocationPicker"

export default function DireccionPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [mapKey, setMapKey] = useState<number>(Date.now()) // Estado para forzar re-renderizado del mapa

  // Formulario de dirección
  const [calle, setCalle] = useState("")
  const [numero, setNumero] = useState("")
  const [depto, setDepto] = useState("")
  const [comuna, setComuna] = useState("")
  const [referencia, setReferencia] = useState("")
  const [selectedLocation, setSelectedLocation] = useState<{lat:number; lng:number; address?:string}|null>(null)
  const [selectedZone, setSelectedZone] = useState<DeliveryZone|null>(null)
  const [zoneAvailable, setZoneAvailable] = useState(false)
  const { zones } = useDeliveryZones()

  // Forzar renderizado del mapa cuando se carga la página
  useEffect(() => {
    console.log("Página de dirección cargada - inicializando mapa");
    // Pequeño retraso para asegurar que el contenedor esté listo
    const timer = setTimeout(() => {
      setMapKey(Date.now()); // Esto forzará un re-renderizado del mapa
    }, 300);
    
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Validaciones de zona estrictas: debe existir zona definida y activa
    if (!selectedLocation) {
      toast({
        title: "Selecciona ubicación",
        description: "Debes elegir un punto dentro de una zona de delivery.",
        variant: "destructive"
      })
      return
    }
    if (!selectedZone) {
      toast({
        title: "Fuera de zonas",
        description: "La ubicación no pertenece a una zona de delivery configurada.",
        variant: "destructive"
      })
      return
    }
    if (!zoneAvailable) {
      toast({
        title: "Zona inactiva",
        description: `La zona "${selectedZone.nombre}" no está disponible actualmente.`,
        variant: "destructive"
      })
      return
    }
    setIsLoading(true)

    // Simulación de procesamiento
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500))
      router.push("/pago")
    } catch (error) {
      console.error("Error al procesar la dirección:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <Link href="/" className="flex items-center text-gray-600 mb-6 hover:text-pink-600 transition-colors">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al inicio
          </Link>

          <h1 className="text-3xl font-bold text-gray-800 mb-8">Dirección de Entrega</h1>

          {/* Mapa para selección de dirección */}
          <div className="mb-6 h-[300px] md:h-[400px] border border-gray-200 rounded-lg shadow-md overflow-hidden">
      <LocationPicker 
              key={`location-map-${mapKey}`} // Esto fuerza un re-renderizado cuando cambia mapKey
              onLocationSelect={(lat, lng, address) => {
                console.log("Dirección seleccionada:", lat, lng, address);
        setSelectedLocation({lat,lng,address})
                if (address) {
                  // Intentar extraer información de la dirección para auto-completar campos
                  const parts = address.split(", ");
                  if (parts.length > 0) {
                    // Intentar separar calle y número
                    const calleCompleta = parts[0];
                    const match = calleCompleta.match(/^(.*?)\s?(\d+)?$/);
                    if (match) {
                      setCalle(match[1] || "");
                      setNumero(match[2] || "");
                    } else {
                      setCalle(calleCompleta);
                    }
                    
                    // Si hay una segunda parte, podría ser la comuna
                    if (parts.length > 1) {
                      setComuna(parts[parts.length - 1]);
                    }
                  }
                }
              }} 
              onDeliveryInfoChange={(zone, tarifa, disponible) => {
                setSelectedZone(zone)
                setZoneAvailable(!!zone && disponible)
              }}
            />
          </div>

          <Card className="border-gray-200">
            <CardHeader className="bg-gray-50 border-b border-gray-200">
              <div className="flex items-center">
                <MapPin className="h-5 w-5 text-pink-600 mr-2" />
                <CardTitle className="text-xl text-gray-800">Ingresa tu dirección</CardTitle>
              </div>
              <CardDescription className="text-gray-600">
                Completa los datos para la entrega de tu pedido
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="calle">Calle</Label>
                    <Input
                      id="calle"
                      value={calle}
                      onChange={(e) => setCalle(e.target.value)}
                      placeholder="Av. Principal"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="numero">Número</Label>
                    <Input
                      id="numero"
                      value={numero}
                      onChange={(e) => setNumero(e.target.value)}
                      placeholder="123"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="depto">Departamento/Casa (Opcional)</Label>
                    <Input id="depto" value={depto} onChange={(e) => setDepto(e.target.value)} placeholder="Depto 42" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="comuna">Comuna</Label>
                    <Input
                      id="comuna"
                      value={comuna}
                      onChange={(e) => setComuna(e.target.value)}
                      placeholder="Santiago"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="referencia">Referencia (Opcional)</Label>
                  <Input
                    id="referencia"
                    value={referencia}
                    onChange={(e) => setReferencia(e.target.value)}
                    placeholder="Edificio azul, cerca del parque"
                  />
                </div>

                <div className="pt-4">
                  <p className="text-sm text-gray-500 mb-2">
                    * Recuerda que el tiempo de entrega puede variar según la distancia.
                  </p>
                </div>
              </form>
            </CardContent>
            <CardFooter className="flex justify-end border-t border-gray-200 pt-4 bg-gray-50">
              <Button
                onClick={handleSubmit}
                disabled={isLoading || !selectedZone || !zoneAvailable}
                className="bg-pink-600 text-white hover:bg-pink-700 font-bold py-3 px-8 rounded-lg shadow-md hover:shadow-lg transition-all"
              >
                {isLoading ? "Procesando..." : "Continuar al Pago"}
              </Button>
              {selectedLocation && !selectedZone && (
                <p className="text-xs text-red-600 mt-2">La ubicación está fuera de las zonas de delivery.</p>
              )}
              {selectedZone && !zoneAvailable && (
                <p className="text-xs text-red-600 mt-2">La zona seleccionada no está activa.</p>
              )}
            </CardFooter>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  )
}

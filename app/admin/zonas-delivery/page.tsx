"use client"

import type React from "react"

import { useState, useEffect, useRef, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { MapPin, Edit, Download, Upload, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import DeliveryZoneMapAbsolute from "../../components/DeliveryZoneMapAbsolute"
import { type DeliveryZone } from "../../../lib/delivery-zones"
import { useDeliveryZones } from "../../../hooks/useDeliveryZones"
import { toast } from "@/hooks/use-toast"
import {
  getDeliveryDriverConfig,
  saveDeliveryDriverConfig,
  cleanInitials,
  type DeliveryDriverContact,
} from "../../../lib/delivery-driver-config"

export default function ZonasDeliveryPage() {
  // Usar el hook personalizado para gestionar las zonas
  const { zones, loading, error, saveZones, deleteZone } = useDeliveryZones()
  const [localZones, setLocalZones] = useState<DeliveryZone[]>([])
  const [isMapOpen, setIsMapOpen] = useState(false)
  const [zonaAEliminar, setZonaAEliminar] = useState<DeliveryZone | null>(null)
  const [isDeletingZone, setIsDeletingZone] = useState(false)
  const [isSavingZones, setIsSavingZones] = useState(false)
  const [deliveryContacts, setDeliveryContacts] = useState<DeliveryDriverContact[]>([])
  const [loadingContacts, setLoadingContacts] = useState(true)
  const [savingContacts, setSavingContacts] = useState(false)
  const initialContactsSnapshotRef = useRef<string>("")

  // Detectar si hay cambios sin guardar en Contactos Repartidores
  const hasUnsavedContactsChanges = useMemo(() => {
    if (loadingContacts || !initialContactsSnapshotRef.current) return false
    return JSON.stringify(deliveryContacts) !== initialContactsSnapshotRef.current
  }, [deliveryContacts, loadingContacts])

  // Advertencia al recargar o cerrar la pestaña con cambios sin guardar
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedContactsChanges) {
        e.preventDefault()
        e.returnValue = "Deberás presionar 'Guardar' para conservar los cambios realizados en Contactos Repartidores."
        return e.returnValue
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [hasUnsavedContactsChanges])

  // Advertencia al intentar navegar a otra página dentro de la app con cambios sin guardar
  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      if (!hasUnsavedContactsChanges) return
      const target = (e.target as HTMLElement).closest("a")
      if (target && target.href && !target.href.startsWith("javascript:")) {
        const confirmLeave = window.confirm(
          "Tienes cambios sin guardar en Contactos Repartidores.\n\nDeberás presionar 'Guardar' para conservar los cambios realizados.\n\n¿Deseas salir de todas formas sin guardar?"
        )
        if (!confirmLeave) {
          e.preventDefault()
          e.stopPropagation()
        }
      }
    }
    document.addEventListener("click", handleAnchorClick, true)
    return () => document.removeEventListener("click", handleAnchorClick, true)
  }, [hasUnsavedContactsChanges])

  // Actualizar las zonas locales cuando se cargan desde Firestore
  useEffect(() => {
    console.log("Zonas recibidas del hook useDeliveryZones:", zones);
    
    if (Array.isArray(zones)) {
      if (zones.length > 0) {
        console.log("Actualizando zonas locales con las zonas de Firestore:", zones);
        setLocalZones([...zones]);
      } else {
        console.log("No hay zonas en Firestore. Estado local:", localZones);
        // Solo inicializar a array vacío si no hay zonas locales tampoco
        if (localZones.length === 0) {
          console.log("Inicializando estado local a array vacío");
          setLocalZones([]);
        }
      }
    } else {
      console.error("Error: zones no es un array", zones);
    }
  }, [zones]);

  useEffect(() => {
    let mounted = true

    const loadDeliveryContacts = async () => {
      try {
        setLoadingContacts(true)
        const config = await getDeliveryDriverConfig()

        if (!mounted) return

        setDeliveryContacts(config.contactos)
        initialContactsSnapshotRef.current = JSON.stringify(config.contactos)
      } catch (error) {
        console.error("Error cargando contactos de delivery:", error)
        toast({
          title: "Error",
          description: "No se pudieron cargar los teléfonos de delivery.",
          variant: "destructive",
        })
      } finally {
        if (mounted) {
          setLoadingContacts(false)
        }
      }
    }

    loadDeliveryContacts()

    return () => {
      mounted = false
    }
  }, [])

  const addDeliveryContact = () => {
    const newContact: DeliveryDriverContact = {
      id: `repartidor-${Date.now()}`,
      nombre: "",
      iniciales: "",
      telefono: "",
      activo: true,
    }

    setDeliveryContacts((prev) => [...prev, newContact])
  }

  const updateDeliveryContact = (
    id: string,
    field: "nombre" | "telefono" | "iniciales",
    value: string
  ) => {
    setDeliveryContacts((prev) =>
      prev.map((contact) =>
        contact.id === id
          ? {
              ...contact,
              [field]: field === "iniciales" 
                ? value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) 
                : value,
            }
          : contact
      )
    )
  }

  const toggleActiveDeliveryContact = (id: string) => {
    setDeliveryContacts((prev) =>
      prev.map((contact) =>
        contact.id === id
          ? { ...contact, activo: !contact.activo }
          : contact
      )
    )
  }

  const removeDeliveryContact = (id: string) => {
    setDeliveryContacts((prev) => prev.filter((contact) => contact.id !== id))
  }

  const saveDeliveryContacts = async () => {
    const cleaned = deliveryContacts
      .map((contact) => {
        const nombre = contact.nombre.trim()
        const iniciales = cleanInitials(contact.iniciales, nombre)
        const telefono = contact.telefono.trim()
        return {
          ...contact,
          nombre,
          iniciales,
          telefono,
        }
      })
      .filter((contact) => contact.nombre && contact.telefono)

    if (cleaned.length === 0) {
      toast({
        title: "Faltan datos",
        description: "Debes configurar al menos un repartidor con nombre y teléfono.",
        variant: "destructive",
      })
      return
    }

    // Verificar si hay iniciales duplicadas
    const initialsSet = new Set<string>()
    for (const c of cleaned) {
      if (initialsSet.has(c.iniciales)) {
        toast({
          title: "Iniciales duplicadas",
          description: `El código/iniciales "${c.iniciales}" ya está asignado a otro repartidor. Cada repartidor debe tener un código único.`,
          variant: "destructive",
        })
        return
      }
      initialsSet.add(c.iniciales)
    }

    setSavingContacts(true)

    try {
      await saveDeliveryDriverConfig({ contactos: cleaned })
      setDeliveryContacts(cleaned)
      initialContactsSnapshotRef.current = JSON.stringify(cleaned)

      toast({
        title: "Configuración guardada",
        description: "Los repartidores y sus iniciales se actualizaron correctamente.",
      })
    } catch (error) {
      console.error("Error guardando contactos de delivery:", error)
      toast({
        title: "Error",
        description: "No se pudo guardar la configuración de teléfonos de delivery.",
        variant: "destructive",
      })
    } finally {
      setSavingContacts(false)
    }
  }

  const handleConfirmDeleteZone = async () => {
    if (!zonaAEliminar) return
    setIsDeletingZone(true)
    try {
      const ok = await deleteZone(zonaAEliminar.id)
      if (ok) {
        setLocalZones((prev) => prev.filter((z) => z.id !== zonaAEliminar.id))
        toast({
          title: "Zona eliminada",
          description: `La zona "${zonaAEliminar.nombre}" se ha eliminado correctamente.`,
        })
      } else {
        toast({
          title: "Error",
          description: "No se pudo eliminar la zona de la base de datos.",
          variant: "destructive",
        })
      }
    } catch (err) {
      console.error("Error al eliminar zona:", err)
      toast({
        title: "Error inesperado",
        description: "Ocurrió un error al intentar eliminar la zona.",
        variant: "destructive",
      })
    } finally {
      setIsDeletingZone(false)
      setZonaAEliminar(null)
    }
  }

  const handleSaveZones = async (updatedZones: DeliveryZone[]) => {
    console.log("Zonas recibidas desde el editor de mapa:", updatedZones);
    
    // Si no hay zonas, mostrar un mensaje de advertencia
    if (!updatedZones || updatedZones.length === 0) {
      console.warn("¡Advertencia! Se recibió un array vacío de zonas desde el editor de mapa");
      toast({
        title: "Advertencia",
        description: "No se recibieron zonas desde el editor. No se han realizado cambios.",
        variant: "destructive",
      });
      return;
    }
    
    // Validar el formato de las zonas recibidas
    const zonasValidas = updatedZones.filter(zone => {
      // Verificar que la zona tenga los campos requeridos
      const tieneRequeridos = zone && zone.id && zone.nombre && 
                            zone.poligono && Array.isArray(zone.poligono) && 
                            zone.poligono.length >= 3;
      
      if (!tieneRequeridos) {
        console.error("Zona inválida encontrada:", zone);
        return false;
      }
      
      // Verificar el formato del polígono
      const formatoPoligonoValido = zone.poligono.every(punto => 
        Array.isArray(punto) && punto.length === 2 && 
        typeof punto[0] === 'number' && typeof punto[1] === 'number'
      );
      
      if (!formatoPoligonoValido) {
        console.error("Zona con formato de polígono inválido:", zone);
        return false;
      }
      
      return true;
    });
    
    if (zonasValidas.length < updatedZones.length) {
      console.warn(`Se filtró ${updatedZones.length - zonasValidas.length} zonas inválidas`);
      toast({
        title: "Advertencia",
        description: `Se encontraron ${updatedZones.length - zonasValidas.length} zonas con formato inválido que serán ignoradas.`,
        variant: "default",
      });
    }
    
    if (zonasValidas.length === 0) {
      toast({
        title: "Error",
        description: "No hay zonas válidas para guardar. Verifica el formato de las zonas dibujadas.",
        variant: "destructive",
      });
      return;
    }
    
    // Actualizar el estado local
    console.log("Actualizando estado local con zonas válidas:", zonasValidas);
    
    // Para evitar confusiones, guardamos inmediatamente en Firestore
    // Actualizamos el estado local y luego pasamos las zonas directamente
    // a la función saveChangesToFirestore para evitar problemas con el estado asíncrono
    setLocalZones(zonasValidas);
    
    // Mostrar mensaje al usuario
    toast({
      title: "Guardando zonas",
      description: `Guardando ${zonasValidas.length} zonas en la base de datos...`,
      variant: "default",
    });
    
    // Llamamos a la función pasando directamente las zonas validadas
    await saveChangesToFirestoreDirecto(zonasValidas);
  }
  
  // Función que recibe las zonas directamente como parámetro
  const saveChangesToFirestoreDirecto = async (zonas: DeliveryZone[]) => {
    try {
      console.log("Página Admin: Guardando zonas en Firestore directamente:", zonas);
      
      if (!zonas || zonas.length === 0) {
        console.warn("¡No hay zonas para guardar! El array de zonas está vacío.");
        toast({
          title: "Advertencia",
          description: "No hay zonas para guardar. Crea al menos una zona antes de guardar.",
          variant: "destructive",
        });
        return;
      }
      
      // Usar SOLO directamente la función de saveDeliveryZones para evitar conflictos
      const { saveDeliveryZones } = await import("../../../lib/delivery-zones-service");
      
      console.log(`Guardando ${zonas.length} zonas válidas directamente en Firestore...`);
      await saveDeliveryZones(zonas);
      console.log("Zonas guardadas exitosamente en Firestore mediante saveDeliveryZones");
      
      // Notificar al usuario
      toast({
        title: "Zonas guardadas",
        description: `${zonas.length} zonas de delivery se han guardado correctamente en la base de datos.`,
        variant: "default",
      });
      
      // Recargamos las zonas para asegurar la coherencia
      const { getDeliveryZones } = await import("../../../lib/delivery-zones-service");
      const refreshedZones = await getDeliveryZones();
      
      console.log("Zonas recargadas desde Firestore:", refreshedZones);
      setLocalZones(refreshedZones);
    } catch (error) {
      console.error("Error guardando zonas:", error);
      toast({
        title: "Error",
        description: "Ocurrió un error inesperado al guardar las zonas.",
        variant: "destructive",
      });
    }
  }

  const handleGuardarCambios = async () => {
    setIsSavingZones(true)
    try {
      await saveChangesToFirestoreDirecto(localZones)
    } finally {
      setIsSavingZones(false)
    }
  }

  const exportZones = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(localZones, null, 2))
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
        // Validar que el formato sea correcto
        if (Array.isArray(importedZones) && importedZones.every(zone => 
          typeof zone.id === 'string' && 
          typeof zone.nombre === 'string' && 
          typeof zone.tarifa === 'number' && 
          Array.isArray(zone.poligono)
        )) {
          setLocalZones(importedZones)
          toast({
            title: "Zonas importadas",
            description: `Se han importado ${importedZones.length} zonas. Haz clic en "Guardar cambios" para guardarlas en la base de datos.`,
            variant: "default",
          })
        } else {
          toast({
            title: "Formato incorrecto",
            description: "El archivo no tiene el formato esperado para zonas de delivery.",
            variant: "destructive",
          })
        }
      } catch (error) {
        toast({
          title: "Error al importar",
          description: "No se pudo procesar el archivo. Verifica que sea un JSON válido.",
          variant: "destructive",
        })
      }
    }
    reader.readAsText(file)
  }

  if (loading && localZones.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8 flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto mb-4"></div>
          <p>Cargando zonas de delivery...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Zonas de Delivery</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Administra las zonas de entrega y tarifas para Los Andes</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <Button
              onClick={handleGuardarCambios}
              disabled={isSavingZones || localZones.length === 0}
              className="flex-1 md:flex-initial bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
            >
              {isSavingZones ? "Guardando..." : "Guardar cambios"}
            </Button>
            <Button onClick={() => setIsMapOpen(true)} className="flex-1 md:flex-initial bg-pink-600 hover:bg-pink-700 text-white font-medium shadow-sm">
              <Edit className="w-4 h-4 mr-2" />
              Crear zona
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={exportZones}
              className="h-10 w-10 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 shrink-0"
              title="Exportar zonas de delivery (.json)"
              aria-label="Exportar zonas de delivery"
            >
              <Download className="w-4 h-4" />
            </Button>
            <div className="relative shrink-0">
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                title="Importar zonas de delivery (.json)"
                aria-label="Importar zonas de delivery"
              >
                <Upload className="w-4 h-4" />
              </Button>
              <input
                type="file"
                accept=".json"
                onChange={importZones}
                className="absolute inset-0 opacity-0 cursor-pointer"
                title="Importar zonas de delivery (.json)"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {localZones.length === 0 ? (
            <div className="col-span-3 flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-lg">
              <div className="text-center mb-6">
                <h3 className="text-xl font-medium mb-2">No hay zonas de delivery configuradas</h3>
                <p className="text-gray-500">
                  No se encontraron zonas de delivery en la base de datos. 
                  Haz clic en el botón "Editar Zonas en Mapa" para crear nuevas zonas personalizadas.
                </p>
              </div>
              <Button onClick={() => setIsMapOpen(true)} className="bg-pink-600 hover:bg-pink-700 text-white font-medium">
                <Edit className="w-4 h-4 mr-2" />
                Crear zona
              </Button>
            </div>
          ) : (
            localZones.map((zone) => (
              <Card key={zone.id} className="overflow-hidden bg-white dark:bg-gray-800 border dark:border-gray-700 shadow-sm hover:shadow transition-shadow">
                <div className="h-2" style={{ backgroundColor: zone.color }}></div>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-xl dark:text-white truncate">{zone.nombre}</CardTitle>
                      <CardDescription className="dark:text-gray-400 mt-0.5 line-clamp-2">{zone.descripcion || "Sin descripción"}</CardDescription>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant={zone.disponible ? "default" : "destructive"}>
                        {zone.disponible ? "Disponible" : "No Disponible"}
                      </Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setZonaAEliminar(zone)}
                        className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-full transition-colors cursor-pointer"
                        title={`Eliminar zona ${zone.nombre}`}
                        aria-label={`Eliminar zona ${zone.nombre}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
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
            ))
          )}
        </div>

        <Card className="mt-10 bg-white dark:bg-gray-800 border dark:border-gray-700 shadow-sm">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="dark:text-white flex items-center gap-2">
                  <span>Contactos Repartidores</span>
                  {hasUnsavedContactsChanges && (
                    <Badge variant="outline" className="text-amber-600 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-[11px] font-medium">
                      Cambios sin guardar
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="dark:text-gray-400 mt-1">
                  Configura los repartidores, sus iniciales identificatorias (código en mayúsculas) y teléfonos de WhatsApp. Puedes tener <strong>más de un repartidor activo simultáneamente</strong> para el turno.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingContacts ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Cargando configuración de repartidores...</p>
            ) : (
              <div className="space-y-4">
                {/* Encabezados de columnas visibles en desktop */}
                {deliveryContacts.length > 0 && (
                  <div className="hidden md:grid md:grid-cols-12 gap-3 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <div className="md:col-span-2 text-center">Iniciales / Cód.</div>
                    <div className="md:col-span-4">Nombre Completo</div>
                    <div className="md:col-span-3">WhatsApp (+56...)</div>
                    <div className="md:col-span-2 text-center">Estado Turno</div>
                    <div className="md:col-span-1 text-right">Acción</div>
                  </div>
                )}

                {deliveryContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center border rounded-lg p-3 bg-gray-50/60 dark:bg-gray-800/60 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="md:col-span-2">
                      <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1 md:hidden">
                        Iniciales / Código:
                      </label>
                      <Input
                        placeholder="Ej: DP"
                        maxLength={4}
                        className="font-bold text-center uppercase tracking-widest text-pink-600 dark:text-pink-400 bg-white dark:bg-gray-900"
                        value={contact.iniciales || ""}
                        onChange={(e) => updateDeliveryContact(contact.id, "iniciales", e.target.value)}
                      />
                    </div>
                    <div className="md:col-span-4">
                      <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1 md:hidden">
                        Nombre Repartidor:
                      </label>
                      <Input
                        placeholder="Nombre del repartidor"
                        className="bg-white dark:bg-gray-900"
                        value={contact.nombre}
                        onChange={(e) => updateDeliveryContact(contact.id, "nombre", e.target.value)}
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1 md:hidden">
                        WhatsApp:
                      </label>
                      <Input
                        placeholder="+56912345678"
                        className="bg-white dark:bg-gray-900"
                        value={contact.telefono}
                        onChange={(e) => updateDeliveryContact(contact.id, "telefono", e.target.value)}
                      />
                    </div>
                    <div className="md:col-span-2 flex items-center justify-center">
                      <Button
                        type="button"
                        variant={contact.activo ? "default" : "outline"}
                        className={
                          contact.activo
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white w-full font-semibold shadow-xs"
                            : "text-gray-500 dark:text-gray-400 hover:text-gray-700 w-full"
                        }
                        onClick={() => toggleActiveDeliveryContact(contact.id)}
                      >
                        {contact.activo ? "✓ Activo" : "Inactivo"}
                      </Button>
                    </div>
                    <div className="md:col-span-1 flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-full transition-colors cursor-pointer"
                        onClick={() => removeDeliveryContact(contact.id)}
                        title="Eliminar repartidor"
                        aria-label="Eliminar repartidor"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                <div className="flex flex-wrap gap-3 pt-3 border-t dark:border-gray-700">
                  <Button type="button" variant="outline" onClick={addDeliveryContact}>
                    Agregar
                  </Button>
                  <Button
                    type="button"
                    className="bg-pink-600 hover:bg-pink-700 text-white font-semibold shadow-sm"
                    onClick={saveDeliveryContacts}
                    disabled={savingContacts}
                  >
                    {savingContacts ? "Guardando..." : "Guardar"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <DeliveryZoneMapAbsolute 
          isOpen={isMapOpen} 
          onClose={() => setIsMapOpen(false)} 
          onSaveZones={handleSaveZones} 
          initialZones={localZones}
        />

        {/* Modal de Confirmación para Eliminar Zona */}
        <Dialog open={!!zonaAEliminar} onOpenChange={(open) => { if (!open) setZonaAEliminar(null) }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <Trash2 className="w-5 h-5 shrink-0" />
                <DialogTitle className="text-lg font-bold">¿Eliminar zona de delivery?</DialogTitle>
              </div>
              <DialogDescription className="sr-only">
                Confirmar eliminación de zona de delivery
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="gap-2 sm:gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setZonaAEliminar(null)}
                disabled={isDeletingZone}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleConfirmDeleteZone}
                disabled={isDeletingZone}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold"
              >
                {isDeletingZone ? "Eliminando..." : "Sí, eliminar zona"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}

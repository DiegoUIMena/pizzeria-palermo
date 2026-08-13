"use client"

import React, { useState, useEffect, useCallback } from "react"
import { httpsCallable } from "firebase/functions"
import { functions } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import {
  Mail,
  Search,
  Filter,
  Eye,
  Archive,
  Check,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  MessageSquare,
  Clock,
  User,
  AlertTriangle,
} from "lucide-react"
import { Contacto, RespuestaContacto, AuditoriaContacto } from "@/functions/src/types/contact"

const PAGE_SIZE = 20

// Funciones para obtener estilos visuales de badges
const getEstadoBadgeStyle = (estado: string) => {
  switch (estado) {
    case "Pendiente":
      return "text-red-700 bg-red-50 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900"
    case "En revisión":
      return "text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900"
    case "Respondido":
      return "text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900"
    case "Cerrado":
      return "text-gray-500 bg-gray-50 border-gray-200 dark:bg-gray-800/50 dark:text-gray-400 dark:border-gray-700"
    default:
      return "text-gray-500 bg-gray-50 border-gray-200"
  }
}

const getTipoBadgeStyle = (tipo: string) => {
  switch (tipo) {
    case "Consulta":
      return "text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900"
    case "Solicitud":
      return "text-sky-700 bg-sky-50 border-sky-200 dark:bg-sky-950/20 dark:text-sky-400 dark:border-sky-900"
    case "Reclamo":
      return "text-red-700 bg-red-50 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900"
    case "Sugerencia":
      return "text-purple-700 bg-purple-50 border-purple-200 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900"
    case "Felicitaciones":
      return "text-green-700 bg-green-50 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900"
    default:
      return "text-gray-500 bg-gray-50 border-gray-200 dark:bg-gray-800 dark:text-gray-400"
  }
}

export default function AdminContactoPage() {
  // Estado de lista y paginación
  const [contactos, setContactos] = useState<Contacto[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  
  // Historial de navegación (stack de IDs de inicio de página para botón anterior)
  const [pagesStack, setPagesStack] = useState<string[]>([])
  
  // Filtros
  const [filtroEstado, setFiltroEstado] = useState<string>("all")
  const [filtroTipo, setFiltroTipo] = useState<string>("all")
  const [filtroLeido, setFiltroLeido] = useState<string>("all")
  const [filtroArchivado, setFiltroArchivado] = useState<string>("all")
  
  // Búsqueda
  const [buscarNombre, setBuscarNombre] = useState("")
  const [buscarCorreo, setBuscarCorreo] = useState("")
  const [buscarAsunto, setBuscarAsunto] = useState("")

  // Estado de detalle
  const [selectedContacto, setSelectedContacto] = useState<Contacto | null>(null)
  const [respuestas, setRespuestas] = useState<RespuestaContacto[]>([])
  const [auditoria, setAuditoria] = useState<AuditoriaContacto[]>([])
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  // Editor de Respuesta
  const [respuestaMensaje, setRespuestaMensaje] = useState("")
  const [observacionesInternas, setObservacionesInternas] = useState("")
  const [isResponding, setIsResponding] = useState(false)

  // Carga de Contactos
  const loadContacts = useCallback(async (lastDocId: string | null = null, resetStack = false) => {
    setIsLoading(true)
    try {
      const obtenerContactosFn = httpsCallable(functions, "obtenerContactosPaginados")
      
      const filtros: any = {}
      if (filtroEstado !== "all") filtros.estado = filtroEstado
      if (filtroTipo !== "all") filtros.tipo = filtroTipo
      if (filtroLeido !== "all") filtros.leido = filtroLeido === "true"
      if (filtroArchivado !== "all") filtros.archivado = filtroArchivado === "true"
      else filtros.archivado = false // Por defecto no mostrar archivados a menos que se filtre
      
      if (buscarNombre.trim() !== "") filtros.nombre = buscarNombre
      if (buscarCorreo.trim() !== "") filtros.correo = buscarCorreo
      if (buscarAsunto.trim() !== "") filtros.asunto = buscarAsunto

      const res = await obtenerContactosFn({
        pageSize: PAGE_SIZE,
        lastDocId,
        filtros,
      })

      const data = res.data as { contactos: Contacto[]; hasMore: boolean }
      setContactos(data.contactos)
      setHasMore(data.hasMore)
      
      if (resetStack) {
        setPagesStack([])
      }
    } catch (error: any) {
      console.error("Error al cargar contactos:", error)
      toast({
        title: "Error al cargar datos",
        description: error.message || "No se pudo obtener el listado de solicitudes.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [filtroEstado, filtroTipo, filtroLeido, filtroArchivado, buscarNombre, buscarCorreo, buscarAsunto])

  // Cargar contactos iniciales y al cambiar filtros
  useEffect(() => {
    loadContacts(null, true)
  }, [filtroEstado, filtroTipo, filtroLeido, filtroArchivado, loadContacts])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    loadContacts(null, true)
  }

  const handleClearFilters = () => {
    setFiltroEstado("all")
    setFiltroTipo("all")
    setFiltroLeido("all")
    setFiltroArchivado("all")
    setBuscarNombre("")
    setBuscarCorreo("")
    setBuscarAsunto("")
    // El useEffect gatillará la carga inicial al cambiar filtros
  }

  // Navegación
  const handleNextPage = () => {
    if (contactos.length === 0) return
    const lastId = contactos[contactos.length - 1].id
    setPagesStack((prev) => [...prev, contactos[0].id]) // Guardar el primero de la pág actual para volver
    loadContacts(lastId)
  }

  const handlePrevPage = () => {
    if (pagesStack.length === 0) return
    const prevStack = [...pagesStack]
    const targetFirstId = prevStack.pop() // El primero de la página anterior
    setPagesStack(prevStack)
    
    // Al volver atrás, pasamos el token de la página anterior o simplemente cargamos usando un cursor anterior
    // En Firestore onCall es más fácil recargar buscando el documento anterior. Para mantenerlo simple
    // y robusto, si el stack queda vacío, cargamos desde el inicio (null). De lo contrario, cargamos 
    // a partir del ID rescatado pero en la lógica actual de startAfter, es más conveniente refrescar
    // cargando desde el inicio hasta esa página o reiniciando la vista.
    // Una alternativa robusta de Next/Prev con startAfter/endBefore es pasar la página exacta,
    // pero dado que es un panel administrativo rápido, recargar desde el inicio si es pág 1 es perfecto.
    if (prevStack.length === 0) {
      loadContacts(null, true)
    } else {
      // Usamos el id del último elemento actual en el nuevo stack como cursor
      const prevPageLastId = prevStack[prevStack.length - 1]
      loadContacts(prevPageLastId)
    }
  }

  // Abrir detalle
  const handleOpenDetail = async (contacto: Contacto) => {
    setSelectedContacto(contacto)
    setIsDetailLoading(true)
    setIsDetailOpen(true)
    setRespuestaMensaje("")
    setObservacionesInternas("")

    try {
      const obtenerDetalleFn = httpsCallable(functions, "obtenerDetalleContacto")
      const res = await obtenerDetalleFn({ contactoId: contacto.id })
      const data = res.data as {
        contacto: Contacto
        respuestas: RespuestaContacto[]
        auditoria: AuditoriaContacto[]
      }

      setRespuestas(data.respuestas)
      setAuditoria(data.auditoria)

      // Si no estaba leído, marcar como leído inmediatamente de fondo
      if (!contacto.leido) {
        const marcarLeidoFn = httpsCallable(functions, "marcarLeidoContacto")
        await marcarLeidoFn({ contactoId: contacto.id, leido: true })
        // Actualizar en la lista local para evitar lecturas extra
        setContactos((prev) =>
          prev.map((c) => (c.id === contacto.id ? { ...c, leido: true } : c))
        )
      }
    } catch (error: any) {
      console.error("Error al cargar detalle del contacto:", error)
      toast({
        title: "Error al cargar detalle",
        description: error.message || "No se pudo obtener el historial de respuestas.",
        variant: "destructive",
      })
    } finally {
      setIsDetailLoading(false)
    }
  }

  // Cambiar estado desde detalle
  const handleStatusChange = async (nuevoEstado: string) => {
    if (!selectedContacto) return

    try {
      const cambiarEstadoFn = httpsCallable(functions, "cambiarEstadoContacto")
      await cambiarEstadoFn({ contactoId: selectedContacto.id, nuevoEstado })
      
      // Actualizar estados locales
      setSelectedContacto((prev) => (prev ? { ...prev, estado: nuevoEstado as any } : null))
      setContactos((prev) =>
        prev.map((c) => (c.id === selectedContacto.id ? { ...c, estado: nuevoEstado as any } : c))
      )

      // Recargar logs de auditoría
      const obtenerDetalleFn = httpsCallable(functions, "obtenerDetalleContacto")
      const res = await obtenerDetalleFn({ contactoId: selectedContacto.id })
      setAuditoria((res.data as any).auditoria)

      toast({
        title: "Estado actualizado",
        description: `El contacto ahora está en estado: ${nuevoEstado}`,
      })
    } catch (error: any) {
      console.error("Error al cambiar estado:", error)
      toast({
        title: "Error al cambiar estado",
        description: error.message || "No se pudo actualizar el estado del contacto.",
        variant: "destructive",
      })
    }
  }

  // Archivar / Desarchivar desde detalle
  const handleArchivar = async (archivado: boolean) => {
    if (!selectedContacto) return

    try {
      const archivarFn = httpsCallable(functions, "archivarContacto")
      await archivarFn({ contactoId: selectedContacto.id, archivado })
      
      // Actualizar estados locales
      setSelectedContacto((prev) => (prev ? { ...prev, archivado } : null))
      setContactos((prev) =>
        prev.map((c) => (c.id === selectedContacto.id ? { ...c, archivado } : c))
      )

      // Recargar logs de auditoría
      const obtenerDetalleFn = httpsCallable(functions, "obtenerDetalleContacto")
      const res = await obtenerDetalleFn({ contactoId: selectedContacto.id })
      setAuditoria((res.data as any).auditoria)

      toast({
        title: archivado ? "Contacto archivado" : "Contacto desarchivado",
        description: archivado ? "El mensaje se movió al archivo." : "El mensaje se restauró del archivo.",
      })
    } catch (error: any) {
      console.error("Error al archivar contacto:", error)
      toast({
        title: "Error al archivar",
        description: error.message || "No se pudo realizar la acción.",
        variant: "destructive",
      })
    }
  }

  // Enviar respuesta
  const handleSendResponse = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedContacto || !respuestaMensaje.trim()) return

    setIsResponding(true)

    try {
      const responderContactoFn = httpsCallable(functions, "responderContacto")
      const res = await responderContactoFn({
        contactoId: selectedContacto.id,
        mensaje: respuestaMensaje.trim(),
        observacionesInternas: observacionesInternas.trim(),
      })

      const result = res.data as { success: boolean; emailEnviado: boolean; errorSMTP?: string }

      if (result.success) {
        if (result.emailEnviado) {
          toast({
            title: "Respuesta enviada",
            description: "La respuesta fue registrada y el correo electrónico se envió con éxito.",
          })
        } else {
          toast({
            title: "Respuesta registrada (Advertencia SMTP)",
            description: `La respuesta se guardó pero falló el envío de correo. Error: ${result.errorSMTP}`,
            variant: "destructive",
          })
        }

        // Limpiar campos de respuesta
        setRespuestaMensaje("")
        setObservacionesInternas("")

        // Recargar datos de detalle
        const obtenerDetalleFn = httpsCallable(functions, "obtenerDetalleContacto")
        const detailRes = await obtenerDetalleFn({ contactoId: selectedContacto.id })
        const data = detailRes.data as any
        setSelectedContacto(data.contacto)
        setRespuestas(data.respuestas)
        setAuditoria(data.auditoria)

        // Actualizar lista local
        setContactos((prev) =>
          prev.map((c) => (c.id === selectedContacto.id ? data.contacto : c))
        )
      }
    } catch (error: any) {
      console.error("Error al enviar respuesta:", error)
      toast({
        title: "Error al enviar respuesta",
        description: error.message || "No se pudo registrar la respuesta.",
        variant: "destructive",
      })
    } finally {
      setIsResponding(false)
    }
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto p-4 text-gray-800 dark:text-gray-250">
      
      {/* Encabezado del Módulo */}
      <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-800 pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <Mail className="h-8 w-8 text-pink-600" />
            Contacto y Solicitudes
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Gestión y seguimiento de consultas, solicitudes, sugerencias y reclamos de clientes.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => loadContacts(null, true)}
          disabled={isLoading}
          className="rounded-xl flex items-center gap-2 border-gray-300 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Refrescar
        </Button>
      </div>

      {/* Panel de Filtros y Búsqueda */}
      <Card className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-bold text-gray-850 dark:text-white flex items-center gap-2">
            <Filter className="h-5 w-5 text-gray-500" />
            Búsqueda y Filtros
          </CardTitle>
          <CardDescription>Busca o filtra las solicitudes de acuerdo a tus necesidades.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearchSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              
              {/* Filtro por Estado */}
              <div className="space-y-1.5">
                <Label htmlFor="filtro-estado" className="text-xs font-semibold">Estado</Label>
                <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                  <SelectTrigger id="filtro-estado" className="rounded-xl border-gray-300 dark:border-gray-700">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="Pendiente">Pendiente</SelectItem>
                    <SelectItem value="En revisión">En revisión</SelectItem>
                    <SelectItem value="Respondido">Respondido</SelectItem>
                    <SelectItem value="Cerrado">Cerrado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro por Tipo */}
              <div className="space-y-1.5">
                <Label htmlFor="filtro-tipo" className="text-xs font-semibold">Tipo</Label>
                <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                  <SelectTrigger id="filtro-tipo" className="rounded-xl border-gray-300 dark:border-gray-700">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="Consulta">Consulta</SelectItem>
                    <SelectItem value="Solicitud">Solicitud</SelectItem>
                    <SelectItem value="Reclamo">Reclamo</SelectItem>
                    <SelectItem value="Sugerencia">Sugerencia</SelectItem>
                    <SelectItem value="Felicitaciones">Felicitaciones</SelectItem>
                    <SelectItem value="Otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro Leído */}
              <div className="space-y-1.5">
                <Label htmlFor="filtro-leido" className="text-xs font-semibold">Leídos / No Leídos</Label>
                <Select value={filtroLeido} onValueChange={setFiltroLeido}>
                  <SelectTrigger id="filtro-leido" className="rounded-xl border-gray-300 dark:border-gray-700">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="true">Leídos</SelectItem>
                    <SelectItem value="false">No leídos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro Archivado */}
              <div className="space-y-1.5">
                <Label htmlFor="filtro-archivado" className="text-xs font-semibold">Ubicación</Label>
                <Select value={filtroArchivado} onValueChange={setFiltroArchivado}>
                  <SelectTrigger id="filtro-archivado" className="rounded-xl border-gray-300 dark:border-gray-700">
                    <SelectValue placeholder="Bandeja de entrada" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="false">Bandeja de entrada (Activos)</SelectItem>
                    <SelectItem value="true">Archivados</SelectItem>
                  </SelectContent>
                </Select>
              </div>

            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              {/* Búsqueda por Nombre */}
              <div className="space-y-1.5">
                <Label htmlFor="buscar-nombre" className="text-xs font-semibold">Nombre Cliente</Label>
                <Input
                  id="buscar-nombre"
                  value={buscarNombre}
                  onChange={(e) => setBuscarNombre(e.target.value)}
                  placeholder="Ej. Juan Pérez"
                  className="rounded-xl border-gray-300 dark:border-gray-700"
                />
              </div>

              {/* Búsqueda por Correo */}
              <div className="space-y-1.5">
                <Label htmlFor="buscar-correo" className="text-xs font-semibold">Correo Electrónico</Label>
                <Input
                  id="buscar-correo"
                  value={buscarCorreo}
                  onChange={(e) => setBuscarCorreo(e.target.value)}
                  placeholder="ejemplo@correo.com"
                  className="rounded-xl border-gray-300 dark:border-gray-700"
                />
              </div>

              {/* Búsqueda por Asunto */}
              <div className="space-y-1.5">
                <Label htmlFor="buscar-asunto" className="text-xs font-semibold">Asunto</Label>
                <Input
                  id="buscar-asunto"
                  value={buscarAsunto}
                  onChange={(e) => setBuscarAsunto(e.target.value)}
                  placeholder="Escribe palabras clave..."
                  className="rounded-xl border-gray-300 dark:border-gray-700"
                />
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClearFilters}
                className="rounded-xl border-gray-300 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                Limpiar Filtros
              </Button>
              <Button
                type="submit"
                className="bg-pink-600 hover:bg-pink-700 text-white rounded-xl flex items-center gap-2"
              >
                <Search className="h-4 w-4" />
                Buscar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Listado de Contactos (Tabla Paginada) */}
      <Card className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50 dark:bg-gray-800/40">
                <TableRow>
                  <TableHead className="w-[100px] text-center font-bold">Estado</TableHead>
                  <TableHead className="w-[110px] text-center font-bold">Tipo</TableHead>
                  <TableHead className="font-bold">Nombre</TableHead>
                  <TableHead className="font-bold">Correo</TableHead>
                  <TableHead className="w-[200px] font-bold">Fecha</TableHead>
                  <TableHead className="max-w-[250px] font-bold">Asunto</TableHead>
                  <TableHead className="w-[80px] text-center font-bold">Leído</TableHead>
                  <TableHead className="w-[180px] font-bold">Última Actividad</TableHead>
                  <TableHead className="w-[80px] text-center font-bold">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-10">
                      <div className="flex justify-center items-center space-x-2">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-pink-600 border-t-transparent"></div>
                        <span className="text-gray-500 font-medium">Cargando solicitudes...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : contactos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-10 text-gray-500 dark:text-gray-400">
                      No se encontraron mensajes de contacto que coincidan con los filtros aplicados.
                    </TableCell>
                  </TableRow>
                ) : (
                  contactos.map((contacto) => (
                    <TableRow
                      key={contacto.id}
                      className={`hover:bg-gray-50/50 dark:hover:bg-gray-800/20 cursor-pointer ${
                        !contacto.leido ? "font-semibold bg-pink-50/10 dark:bg-pink-900/5" : ""
                      }`}
                      onClick={() => handleOpenDetail(contacto)}
                    >
                      {/* Estado */}
                      <TableCell className="text-center">
                        <span
                          className={`inline-block px-2.5 py-1 text-xs font-bold rounded-full border ${getEstadoBadgeStyle(
                            contacto.estado
                          )}`}
                        >
                          {contacto.estado}
                        </span>
                      </TableCell>

                      {/* Tipo */}
                      <TableCell className="text-center">
                        <span
                          className={`inline-block px-2.5 py-1 text-xs font-bold rounded-full border ${getTipoBadgeStyle(
                            contacto.tipo
                          )}`}
                        >
                          {contacto.tipo}
                        </span>
                      </TableCell>

                      {/* Nombre */}
                      <TableCell className="max-w-[150px] truncate">{contacto.nombre}</TableCell>

                      {/* Correo */}
                      <TableCell className="max-w-[155px] truncate">{contacto.correo}</TableCell>

                      {/* Fecha */}
                      <TableCell className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(contacto.fechaCreacion).toLocaleString("es-CL", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </TableCell>

                      {/* Asunto */}
                      <TableCell className="max-w-[250px] truncate" title={contacto.asunto}>
                        {contacto.asunto}
                      </TableCell>

                      {/* Leído */}
                      <TableCell className="text-center">
                        <span
                          className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded ${
                            contacto.leido
                              ? "bg-green-100 text-green-800 dark:bg-green-950/20 dark:text-green-400"
                              : "bg-red-100 text-red-800 dark:bg-red-950/20 dark:text-red-400"
                          }`}
                        >
                          {contacto.leido ? "Sí" : "No"}
                        </span>
                      </TableCell>

                      {/* Última Actividad */}
                      <TableCell className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(contacto.ultimaActividad).toLocaleString("es-CL", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </TableCell>

                      {/* Botón Ver */}
                      <TableCell className="text-center">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenDetail(contacto)
                          }}
                          className="h-8 w-8 text-pink-650 hover:bg-pink-550/10 hover:text-pink-600 rounded-full"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Botones de Paginación */}
          <div className="flex justify-between items-center px-6 py-4 border-t border-gray-200 dark:border-gray-800">
            <span className="text-xs sm:text-sm text-gray-500">
              Página {pagesStack.length + 1}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevPage}
                disabled={pagesStack.length === 0 || isLoading}
                className="rounded-xl border-gray-300 dark:border-gray-700 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={!hasMore || isLoading}
                className="rounded-xl border-gray-300 dark:border-gray-700 disabled:opacity-50"
              >
                Siguiente
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal / Dialog de Detalle de Mensaje */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl">
          
          {selectedContacto && (
            <>
              <DialogHeader className="border-b border-gray-100 dark:border-gray-800 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-3 mr-6">
                  <div>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2 text-gray-950 dark:text-white">
                      <span
                        className={`inline-block px-2.5 py-0.5 text-xs font-bold rounded-full border ${getTipoBadgeStyle(
                          selectedContacto.tipo
                        )}`}
                      >
                        {selectedContacto.tipo}
                      </span>
                      <span>{selectedContacto.asunto}</span>
                    </DialogTitle>
                    <DialogDescription className="mt-1 text-xs text-gray-500">
                      ID del Mensaje: <span className="font-mono">{selectedContacto.id}</span>
                    </DialogDescription>
                  </div>

                  {/* Estado y Acciones de Archivo */}
                  <div className="flex items-center gap-2">
                    {/* Selector de Estado */}
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor="change-estado" className="text-xs font-semibold">Estado:</Label>
                      <Select
                        value={selectedContacto.estado}
                        onValueChange={handleStatusChange}
                      >
                        <SelectTrigger id="change-estado" className="h-8 w-[140px] rounded-lg text-xs font-bold border-gray-300">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Pendiente">Pendiente</SelectItem>
                          <SelectItem value="En revisión">En revisión</SelectItem>
                          <SelectItem value="Respondido">Respondido</SelectItem>
                          <SelectItem value="Cerrado">Cerrado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Botón de Archivar */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleArchivar(!selectedContacto.archivado)}
                      className="h-8 rounded-lg text-xs font-medium border-gray-300 dark:border-gray-700 flex items-center gap-1"
                    >
                      <Archive className="h-3.5 w-3.5" />
                      {selectedContacto.archivado ? "Desarchivar" : "Archivar"}
                    </Button>
                  </div>
                </div>
              </DialogHeader>

              {isDetailLoading ? (
                <div className="py-20 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-pink-600 border-t-transparent mx-auto mb-4"></div>
                  <p className="text-gray-500 font-medium">Cargando historial del contacto...</p>
                </div>
              ) : (
                <div className="space-y-6 py-4">
                  
                  {/* Fila de Datos del Cliente */}
                  <div className="bg-gray-50 dark:bg-gray-800/40 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 border border-gray-100 dark:border-gray-800">
                    <div className="space-y-1">
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Remitente</span>
                      <span className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1">
                        <User className="h-4 w-4 text-gray-500" />
                        {selectedContacto.nombre}
                      </span>
                      {selectedContacto.usuarioRegistrado ? (
                        <span className="text-[10px] bg-pink-100 text-pink-850 dark:bg-pink-950/20 dark:text-pink-400 font-bold px-1.5 py-0.5 rounded">
                          Cliente Registrado
                        </span>
                      ) : (
                        <span className="text-[10px] bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-400 font-bold px-1.5 py-0.5 rounded">
                          Invitado
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Contacto</span>
                      <span className="text-sm text-gray-900 dark:text-white block font-medium">
                        📧 {selectedContacto.correo}
                      </span>
                      {selectedContacto.telefono && (
                        <span className="text-sm text-gray-900 dark:text-white block font-medium">
                          📞 {selectedContacto.telefono}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Tiempos y Actividad</span>
                      <span className="text-xs text-gray-600 dark:text-gray-400 block">
                        <strong>Creado:</strong> {new Date(selectedContacto.fechaCreacion).toLocaleString("es-CL")}
                      </span>
                      <span className="text-xs text-gray-600 dark:text-gray-400 block">
                        <strong>Actividad:</strong> {new Date(selectedContacto.ultimaActividad).toLocaleString("es-CL")}
                      </span>
                      {selectedContacto.ultimaRespuestaPor && (
                        <span className="text-xs text-gray-600 dark:text-gray-400 block">
                          <strong>Última rpta por:</strong> {selectedContacto.ultimaRespuestaPor}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Mensaje Original */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                      Mensaje Original
                    </h3>
                    <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-sm whitespace-pre-line leading-relaxed shadow-inner">
                      {selectedContacto.mensajeOriginal}
                    </div>
                  </div>

                  {/* Historial Completo de Respuestas */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                      <MessageSquare className="h-4 w-4 text-pink-600" />
                      Historial de Respuestas ({respuestas.length})
                    </h3>
                    
                    {respuestas.length === 0 ? (
                      <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                        No se han enviado respuestas anteriores a este contacto.
                      </p>
                    ) : (
                      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                        {respuestas.map((r) => (
                          <div
                            key={r.id}
                            className="bg-pink-50/30 dark:bg-pink-950/10 border border-pink-100 dark:border-pink-900/40 rounded-xl p-4 space-y-2"
                          >
                            <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 border-b border-pink-100/50 dark:border-pink-900/20 pb-1.5">
                              <span>
                                <strong>De:</strong> {r.administradorNombre} ({r.administradorCorreo})
                              </span>
                              <span className="flex items-center gap-1 font-semibold text-gray-400">
                                <Clock className="h-3 w-3" />
                                {new Date(r.fecha).toLocaleString("es-CL")}
                              </span>
                            </div>
                            <div className="text-sm whitespace-pre-line text-gray-800 dark:text-gray-200 leading-relaxed">
                              {r.mensaje}
                            </div>
                            {r.observacionesInternas && (
                              <div className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded-lg text-gray-600 dark:text-gray-400 border border-gray-200/50">
                                <strong>Observaciones Internas:</strong> {r.observacionesInternas}
                              </div>
                            )}
                            <div className="flex items-center justify-between text-[11px] pt-1">
                              <span className="font-semibold">
                                Destino: {r.emailDestino}
                              </span>
                              {r.emailEnviado ? (
                                <span className="text-green-600 font-bold flex items-center gap-0.5">
                                  ✓ Correo enviado (SMTP)
                                </span>
                              ) : (
                                <span
                                  className="text-red-500 font-bold flex items-center gap-0.5"
                                  title={r.errorSMTP || "Error en el servidor SMTP"}
                                >
                                  ⚠ Falló envío de correo: {r.errorSMTP || "Error SMTP"}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Historial de Auditoría Interna */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                      Auditoría e Historial de Actividades
                    </h3>
                    <div className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-850 rounded-xl p-3 max-h-[140px] overflow-y-auto text-xs space-y-1.5">
                      {auditoria.map((a) => (
                        <div key={a.id} className="flex items-start justify-between gap-4 py-1 border-b border-gray-150/40 dark:border-gray-800 last:border-0">
                          <div>
                            <span className="font-bold text-gray-700 dark:text-gray-300">[{a.accion}]</span>{" "}
                            <span className="text-gray-600 dark:text-gray-400">{a.detalles}</span>
                          </div>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
                            {new Date(a.fecha).toLocaleString("es-CL", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })} - {a.usuarioNombre}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Panel Redactar Nueva Respuesta */}
                  <form onSubmit={handleSendResponse} className="border-t border-gray-200 dark:border-gray-800 pt-6 space-y-4">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1">
                      <Mail className="h-4 w-4 text-pink-600" />
                      Redactar Respuesta al Cliente
                    </h3>
                    
                    <div className="space-y-2">
                      <Label htmlFor="respuesta-mensaje" className="text-xs font-semibold text-gray-800">
                        Mensaje del Correo <span className="text-pink-600">*</span>
                      </Label>
                      <Textarea
                        id="respuesta-mensaje"
                        value={respuestaMensaje}
                        onChange={(e) => setRespuestaMensaje(e.target.value)}
                        placeholder="Escribe la respuesta formal que se enviará al cliente por correo electrónico..."
                        required
                        rows={5}
                        className="rounded-xl border-gray-300 dark:border-gray-700 focus-visible:ring-pink-500 text-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="observaciones-internas" className="text-xs font-semibold text-gray-850">
                        Observaciones Internas <span className="text-gray-400 text-[10px]">(Solo visible para administradores)</span>
                      </Label>
                      <Input
                        id="observaciones-internas"
                        value={observacionesInternas}
                        onChange={(e) => setObservacionesInternas(e.target.value)}
                        placeholder="Notas administrativas sobre esta resolución o el cliente..."
                        className="rounded-xl border-gray-300 dark:border-gray-700 focus-visible:ring-pink-500 text-xs"
                      />
                    </div>

                    <DialogFooter className="pt-2">
                      <Button
                        type="submit"
                        disabled={isResponding || !respuestaMensaje.trim()}
                        className="bg-pink-600 hover:bg-pink-700 text-white rounded-xl font-semibold px-6 flex items-center gap-2"
                      >
                        {isResponding ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                            <span>Enviando respuesta...</span>
                          </>
                        ) : (
                          <>
                            <Mail className="h-4 w-4" />
                            <span>Enviar respuesta por Correo</span>
                          </>
                        )}
                      </Button>
                    </DialogFooter>
                  </form>

                </div>
              )}
            </>
          )}

        </DialogContent>
      </Dialog>

    </div>
  )
}

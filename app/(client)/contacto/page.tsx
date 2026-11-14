"use client"

import React, { useState, useEffect, useRef } from "react"
import { useAuth } from "@/app/context/AuthContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { httpsCallable } from "firebase/functions"
import { functions } from "@/lib/firebase"
import Link from "next/link"
import { Mail, CheckCircle2, ChevronDown, Check } from "lucide-react"

const TIPOS_MENSAJE = [
  { value: "Consulta", label: "Consulta" },
  { value: "Solicitud", label: "Solicitud" },
  { value: "Reclamo", label: "Reclamo" },
  { value: "Sugerencia", label: "Sugerencia" },
  { value: "Felicitaciones", label: "Felicitaciones" },
  { value: "Otro", label: "Otro" },
]

export default function ContactPage() {
  const { user } = useAuth()
  
  // Estados de carga e interacción
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [cargadoEn, setCargadoEn] = useState<number>(0)

  // Estados del formulario
  const [nombre, setNombre] = useState("")
  const [correo, setCorreo] = useState("")
  const [telefono, setTelefono] = useState("")
  const [tipo, setTipo] = useState<string>("")
  const [openTipoMenu, setOpenTipoMenu] = useState<boolean>(false)
  const tipoDropdownRef = useRef<HTMLDivElement>(null)
  const [asunto, setAsunto] = useState("")
  const [mensaje, setMensaje] = useState("")
  const [aceptaPolitica, setAceptaPolitica] = useState(false)

  // Honeypot
  const [website, setWebsite] = useState("")

  // Capturar tiempo de carga en el cliente
  useEffect(() => {
    setCargadoEn(Date.now())
  }, [])

  // Cerrar desplegable al hacer clic fuera o presionar Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tipoDropdownRef.current && !tipoDropdownRef.current.contains(event.target as Node)) {
        setOpenTipoMenu(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenTipoMenu(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  // Autocompletar datos si el usuario está autenticado
  useEffect(() => {
    if (user) {
      if (user.name) setNombre(user.name)
      if (user.email) setCorreo(user.email)
      if (user.phone) setTelefono(user.phone)
    }
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 1. Validaciones básicas en frontend
    if (!nombre.trim() || !correo.trim() || !tipo || !asunto.trim() || !mensaje.trim()) {
      toast({
        title: "Campos incompletos",
        description: "Por favor, completa todos los campos requeridos (*).",
        variant: "destructive",
      })
      return
    }

    if (!aceptaPolitica) {
      toast({
        title: "Aceptación requerida",
        description: "Debes aceptar la Política de Privacidad para continuar.",
        variant: "destructive",
      })
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(correo.trim())) {
      toast({
        title: "Email inválido",
        description: "Por favor, ingresa una dirección de correo electrónico válida.",
        variant: "destructive",
      })
      return
    }

    if (mensaje.length < 20) {
      toast({
        title: "Mensaje muy corto",
        description: "El mensaje debe contener al menos 20 caracteres.",
        variant: "destructive",
      })
      return
    }

    if (mensaje.length > 3000) {
      toast({
        title: "Mensaje muy largo",
        description: "El mensaje no puede superar los 3000 caracteres.",
        variant: "destructive",
      })
      return
    }

    if (asunto.length > 120) {
      toast({
        title: "Asunto muy largo",
        description: "El asunto no puede superar los 120 caracteres.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      // 2. Invocación de la Cloud Function
      const crearContactoFn = httpsCallable(functions, "crearContacto")
      
      const payload = {
        nombre: nombre.trim(),
        correo: correo.trim(),
        telefono: telefono.trim(),
        tipo,
        asunto: asunto.trim(),
        mensaje: mensaje.trim(),
        cargadoEn,
        honeypot: website, // Campo honeypot invisible
      }

      await crearContactoFn(payload)

      setIsSuccess(true)
      toast({
        title: "¡Mensaje enviado!",
        description: "Hemos recibido tu mensaje correctamente.",
      })
    } catch (error: any) {
      console.error("Error al enviar contacto:", error)
      toast({
        title: "Error al enviar mensaje",
        description: error.message || "Ocurrió un error inesperado. Por favor, intenta de nuevo.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    setAsunto("")
    setMensaje("")
    setAceptaPolitica(false)
    setWebsite("")
    setTipo("")
    // Volver a configurar datos de usuario si existen
    if (user) {
      if (user.name) setNombre(user.name)
      if (user.email) setCorreo(user.email)
      if (user.phone) setTelefono(user.phone)
    } else {
      setNombre("")
      setCorreo("")
      setTelefono("")
    }
    setCargadoEn(Date.now())
    setIsSuccess(false)
  }

  return (
    <main className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-transparent antialiased text-gray-800 dark:text-gray-200">
      <div className="max-w-3xl mx-auto flex flex-col items-center">
        
        <Card className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm p-6 sm:p-10 md:p-12 text-gray-700 dark:text-gray-300">
          
          {/* Título Principal */}
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white uppercase mb-4 text-center">
            Contacto
          </h1>

          {/* Subtítulo / Banner de Introducción */}
          <p className="text-gray-500 dark:text-gray-400 text-center mx-auto max-w-2xl text-sm sm:text-base leading-relaxed mb-8 font-semibold">
            ¿Tienes alguna consulta, sugerencia, reclamo, felicitación o simplemente deseas comunicarte con nosotros? Completa el siguiente formulario y nuestro equipo revisará tu mensaje. Si corresponde, responderemos al correo electrónico indicado.
          </p>

          <div className="border-b border-gray-100 dark:border-gray-800 pb-4 mb-8 text-xs sm:text-sm text-gray-400 dark:text-gray-500 flex justify-between items-center">
            <span>Formulario Oficial de Contacto</span>
            <span>Pizzería Palermo</span>
          </div>

          {isSuccess ? (
            /* Pantalla de Éxito */
            <div className="text-center animate-fade-in">
              <div className="flex justify-center mb-6">
                <CheckCircle2 className="h-16 w-16 text-green-500 animate-bounce" />
              </div>
              <CardTitle className="text-2xl font-bold text-gray-950 dark:text-white mb-4">
                ¡Mensaje Recibido!
              </CardTitle>
              <CardDescription className="text-gray-650 dark:text-gray-300 text-base max-w-md mx-auto mb-8 leading-relaxed">
                Hemos recibido correctamente tu mensaje. Nuestro equipo lo revisará y, si corresponde, responderá al correo electrónico indicado.
              </CardDescription>
              <div className="flex justify-center gap-4">
                <Button
                  onClick={handleReset}
                  className="bg-pink-600 hover:bg-pink-700 text-white font-semibold px-6 py-2 rounded-xl transition-all"
                >
                  Enviar otro mensaje
                </Button>
                <Button
                  variant="outline"
                  asChild
                  className="border-gray-300 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800 rounded-xl"
                >
                  <Link href="/">Volver al Inicio</Link>
                </Button>
              </div>
            </div>
          ) : (
            /* Formulario de Contacto */
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Honeypot anti-spam (invisible para humanos) */}
              <div className="absolute opacity-0 -z-50 pointer-events-none w-0 h-0 overflow-hidden">
                <label htmlFor="website">Si eres humano deja este campo vacío:</label>
                <input
                  type="text"
                  id="website"
                  name="website"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              {/* Fila Nombre y Correo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="nombre" className="text-sm font-semibold text-gray-900 dark:text-white">
                    Nombre completo <span className="text-pink-600">*</span>
                  </Label>
                  <Input
                    id="nombre"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Tu nombre completo"
                    required
                    maxLength={100}
                    className="border-gray-300 dark:border-gray-700 rounded-xl focus-visible:ring-pink-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="correo" className="text-sm font-semibold text-gray-900 dark:text-white">
                    Correo electrónico <span className="text-pink-600">*</span>
                  </Label>
                  <Input
                    id="correo"
                    type="email"
                    value={correo}
                    onChange={(e) => setCorreo(e.target.value)}
                    placeholder="ejemplo@correo.com"
                    required
                    className="border-gray-300 dark:border-gray-700 rounded-xl focus-visible:ring-pink-500"
                  />
                </div>
              </div>

              {/* Fila Teléfono y Tipo de Solicitud */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="telefono" className="text-sm font-semibold text-gray-900 dark:text-white">
                    Teléfono <span className="text-gray-400 text-xs">(Opcional)</span>
                  </Label>
                  <Input
                    id="telefono"
                    type="tel"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="+56 9 1234 5678"
                    maxLength={30}
                    className="border-gray-300 dark:border-gray-700 rounded-xl focus-visible:ring-pink-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tipo" className="text-sm font-semibold text-gray-900 dark:text-white">
                    Tipo de mensaje <span className="text-pink-600">*</span>
                  </Label>

                  <style dangerouslySetInnerHTML={{ __html: `
                    @keyframes customSelectDropdownIn {
                      0% {
                        opacity: 0 !important;
                        transform: translateY(-8px) scale(0.97) !important;
                      }
                      100% {
                        opacity: 1 !important;
                        transform: translateY(0) scale(1) !important;
                      }
                    }
                    .contact-select-menu {
                      position: absolute !important;
                      top: calc(100% + 6px) !important;
                      left: 0 !important;
                      right: 0 !important;
                      z-index: 99999 !important;
                      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;
                      animation: customSelectDropdownIn 180ms cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
                      transform-origin: top center !important;
                    }
                  `}} />

                  <div ref={tipoDropdownRef} className="relative w-full">
                    <button
                      id="tipo"
                      type="button"
                      onClick={() => setOpenTipoMenu((prev) => !prev)}
                      aria-haspopup="listbox"
                      aria-expanded={openTipoMenu}
                      className={`w-full h-10 px-3 py-2 bg-white dark:bg-gray-900 border rounded-xl text-sm flex items-center justify-between transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-pink-500 ${
                        openTipoMenu
                          ? "border-pink-500 dark:border-pink-500 ring-2 ring-pink-500/20"
                          : "border-gray-300 dark:border-gray-700 hover:border-pink-500 dark:hover:border-pink-500"
                      }`}
                    >
                      <span
                        className={`truncate ${
                          tipo
                            ? "text-gray-900 dark:text-gray-100 font-medium"
                            : "text-gray-500 dark:text-gray-400"
                        }`}
                      >
                        {TIPOS_MENSAJE.find((t) => t.value === tipo)?.label || "Seleccione una opción"}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${
                          openTipoMenu ? "rotate-180 text-pink-600 dark:text-pink-400" : ""
                        }`}
                      />
                    </button>

                    {openTipoMenu && (
                      <div
                        role="listbox"
                        className="contact-select-menu bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl py-1.5 overflow-hidden"
                      >
                        {TIPOS_MENSAJE.map((opt) => {
                          const isSelected = tipo === opt.value
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              role="option"
                              aria-selected={isSelected}
                              onClick={() => {
                                setTipo(opt.value)
                                setOpenTipoMenu(false)
                              }}
                              className={`w-full text-left px-3.5 py-2.5 text-sm flex items-center justify-between transition-colors cursor-pointer ${
                                isSelected
                                  ? "bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 font-semibold"
                                  : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/60"
                              }`}
                            >
                              <span>{opt.label}</span>
                              {isSelected && (
                                <Check className="w-4 h-4 text-pink-600 dark:text-pink-400 shrink-0 ml-2" />
                              )}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Campo Asunto */}
              <div className="space-y-2">
                <Label htmlFor="asunto" className="text-sm font-semibold text-gray-900 dark:text-white">
                  Asunto <span className="text-pink-600">*</span>
                </Label>
                <Input
                  id="asunto"
                  value={asunto}
                  onChange={(e) => setAsunto(e.target.value)}
                  placeholder="Escribe el motivo del contacto"
                  required
                  maxLength={120}
                  className="border-gray-300 dark:border-gray-700 rounded-xl focus-visible:ring-pink-500"
                />
                <p className="text-right text-xs text-gray-400">
                  {asunto.length}/120 caracteres
                </p>
              </div>

              {/* Campo Mensaje */}
              <div className="space-y-2">
                <Label htmlFor="mensaje" className="text-sm font-semibold text-gray-900 dark:text-white">
                  Mensaje <span className="text-pink-600">*</span>
                </Label>
                <Textarea
                  id="mensaje"
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  placeholder="Detalla tu mensaje aquí... (Mínimo 20 caracteres)"
                  required
                  rows={6}
                  maxLength={3000}
                  className="border-gray-300 dark:border-gray-700 rounded-xl focus-visible:ring-pink-500 resize-y"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Mínimo 20 caracteres</span>
                  <span>{mensaje.length}/3000 caracteres</span>
                </div>
              </div>

              {/* Checkbox Aceptación Políticas */}
              <div className="flex items-start space-x-3 pt-2">
                <Checkbox
                  id="aceptaPolitica"
                  checked={aceptaPolitica}
                  onCheckedChange={(checked) => setAceptaPolitica(!!checked)}
                  required
                  className="mt-1 border-gray-300 dark:border-gray-700 text-pink-600 focus:ring-pink-500 rounded"
                />
                <div className="grid gap-1.5 leading-none">
                  <Label
                    htmlFor="aceptaPolitica"
                    className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium cursor-pointer select-none"
                  >
                    He leído y acepto la{" "}
                    <Link
                       href="/privacidad"
                       target="_blank"
                       className="text-pink-600 dark:text-pink-400 hover:underline font-bold"
                    >
                      Política de Privacidad
                    </Link>{" "}
                    respecto al tratamiento de mis datos para responder esta solicitud.
                  </Label>
                </div>
              </div>

              {/* Botón de Enviar */}
              <div className="pt-4 flex justify-end">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="bg-pink-600 hover:bg-pink-700 text-white font-semibold px-8 py-3 rounded-xl transition-all shadow-md transform active:scale-95 disabled:opacity-75 disabled:pointer-events-none w-full sm:w-auto"
                >
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      <span>Enviando...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <Mail className="h-4 w-4" />
                      <span>Enviar mensaje</span>
                    </div>
                  )}
                </Button>
              </div>

            </form>
          )}
        </Card>
      </div>
    </main>
  )
}

'use client'

import React, { useState, useEffect } from 'react'
import {
  ShieldCheck,
  UserPlus,
  Trash2,
  X,
  Mail,
  Lock,
  Eye,
  EyeOff,
  User as UserIcon,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Shield,
  Users,
} from 'lucide-react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '@/lib/firebase'
import { useAuth } from '@/app/context/AuthContext'

interface AdminUserItem {
  id: string
  email: string
  name?: string
  role?: string
  createdAt?: any
}

interface AdminUsersModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function AdminUsersModal({ isOpen, onClose }: AdminUsersModalProps) {
  const { user: currentUser } = useAuth()

  // Lista de administradores
  const [admins, setAdmins] = useState<AdminUserItem[]>([])
  const [loadingAdmins, setLoadingAdmins] = useState(true)

  // Formulario nuevo admin
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)

  // Confirmación de eliminación: guarda el ID del admin que se desea eliminar
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Cargar administradores en tiempo real desde Firestore
  useEffect(() => {
    if (!isOpen) return

    setLoadingAdmins(true)
    const q = query(collection(db, 'users'), where('role', '==', 'admin'))

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loaded: AdminUserItem[] = []
        snapshot.forEach((docSnap) => {
          const data = docSnap.data()
          loaded.push({
            id: docSnap.id,
            email: data.email || '',
            name: data.name || '',
            role: data.role || 'admin',
            createdAt: data.createdAt,
          })
        })
        setAdmins(loaded)
        setLoadingAdmins(false)
      },
      (error) => {
        console.error('Error al escuchar administradores:', error)
        setLoadingAdmins(false)
      }
    )

    return () => unsubscribe()
  }, [isOpen])

  // Limpiar estados al cerrar
  useEffect(() => {
    if (!isOpen) {
      setName('')
      setEmail('')
      setPassword('')
      setShowPassword(false)
      setFormError(null)
      setFormSuccess(null)
      setDeletingId(null)
      setDeleteError(null)
    }
  }, [isOpen])

  if (!isOpen) return null

  // Manejar creación de nuevo administrador
  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    setFormError(null)
    setFormSuccess(null)

    const cleanEmail = email.trim().toLowerCase()
    const cleanPassword = password.trim()
    const cleanName = name.trim() || 'Administrador'

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setFormError('Ingresa un correo electrónico válido.')
      return
    }
    if (!cleanPassword || cleanPassword.length < 6) {
      setFormError('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    setIsSubmitting(true)

    try {
      const crearFn = httpsCallable(functions, 'crearUsuarioAdmin')
      const fnRes = await crearFn({
        email: cleanEmail,
        password: cleanPassword,
        name: cleanName,
      })
      const fnData = fnRes.data as { success: boolean; isExisting?: boolean }
      const isExisting = !!fnData?.isExisting
      const success = !!fnData?.success

      if (isExisting) {
        setFormSuccess('¡Usuario existente actualizado con rol de Administrador!')
      } else {
        setFormSuccess('¡Nuevo administrador creado con éxito!')
      }

      setName('')
      setEmail('')
      setPassword('')
      setTimeout(() => setFormSuccess(null), 4000)
    } catch (err: any) {
      console.error('Error al crear administrador:', err)
      const msg =
        err?.message?.includes('already-exists') || err?.message?.includes('ya existe')
          ? 'Ya existe una cuenta con este correo electrónico.'
          : err?.message || 'Error al crear el administrador.'
      setFormError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Manejar eliminación de administrador
  const handleDeleteAdmin = async (targetId: string) => {
    if (isDeleting) return
    setDeleteError(null)
    setIsDeleting(true)

    try {
      const eliminarFn = httpsCallable(functions, 'eliminarUsuarioAdmin')
      await eliminarFn({ targetUid: targetId })

      setDeletingId(null)
    } catch (err: any) {
      console.error('Error al eliminar administrador:', err)
      setDeleteError(err?.message || 'Error al eliminar el administrador.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm select-none">
      {/* Estilos dedicados con !important */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes adminModalEntrance {
          0% {
            opacity: 0 !important;
            transform: scale(0.95) translateY(10px) !important;
          }
          100% {
            opacity: 1 !important;
            transform: scale(1) translateY(0) !important;
          }
        }
        .admin-users-modal-content {
          animation: adminModalEntrance 220ms cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
        }
      `}} />

      {/* Contenedor del Modal */}
      <div className="admin-users-modal-content relative w-full max-w-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Cabecera */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-pink-600/10 dark:bg-pink-500/15 text-pink-600 dark:text-pink-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-zinc-100">Gestión de Administradores</h2>
              <p className="text-[11px] text-gray-500 dark:text-zinc-400">Crear y administrar cuentas de acceso a /admin</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cuerpo del Modal con scroll */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1">
          {/* SECCIÓN 1: Formulario para Crear Administrador */}
          <div className="bg-gray-50 dark:bg-zinc-950/60 border border-gray-200 dark:border-zinc-800/80 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <UserPlus className="w-4 h-4 text-pink-600 dark:text-pink-500" />
              <h3 className="text-xs font-bold text-gray-800 dark:text-zinc-200 uppercase tracking-wider">
                Crear nuevo administrador
              </h3>
            </div>

            <form onSubmit={handleCreateAdmin} className="space-y-3">
              {/* Avisos de error o éxito */}
              {formError && (
                <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2 animate-in fade-in duration-200">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-medium text-[11px]">{formError}</span>
                </div>
              )}
              {formSuccess && (
                <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2 animate-in fade-in duration-200">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-medium text-[11px]">{formSuccess}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Nombre */}
                <div className="relative flex items-center group">
                  <div className="absolute left-2.5 text-gray-400 group-focus-within:text-pink-500 transition-colors pointer-events-none">
                    <UserIcon className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nombre (ej. Juan)"
                    disabled={isSubmitting}
                    className="w-full h-9 pl-8 pr-2.5 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 focus:border-pink-500 focus:ring-1 focus:ring-pink-500/30 rounded-lg text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 text-xs outline-none transition-all"
                  />
                </div>

                {/* Email */}
                <div className="relative flex items-center group">
                  <div className="absolute left-2.5 text-gray-400 group-focus-within:text-pink-500 transition-colors pointer-events-none">
                    <Mail className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@palermo.cl"
                    disabled={isSubmitting}
                    required
                    className="w-full h-9 pl-8 pr-2.5 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 focus:border-pink-500 focus:ring-1 focus:ring-pink-500/30 rounded-lg text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 text-xs outline-none transition-all"
                  />
                </div>

                {/* Contraseña */}
                <div className="relative flex items-center group">
                  <div className="absolute left-2.5 text-gray-400 group-focus-within:text-pink-500 transition-colors pointer-events-none">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Contraseña (mín. 6)"
                    disabled={isSubmitting}
                    required
                    minLength={6}
                    className="w-full h-9 pl-8 pr-8 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 focus:border-pink-500 focus:ring-1 focus:ring-pink-500/30 rounded-lg text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 text-xs outline-none transition-all"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-2 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 p-0.5 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-8 px-4 rounded-lg bg-pink-600 hover:bg-pink-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Creando...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Crear administrador</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* SECCIÓN 2: Lista de Administradores Existentes */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-500 dark:text-zinc-400" />
                <h3 className="text-xs font-bold text-gray-800 dark:text-zinc-200 uppercase tracking-wider">
                  Administradores registrados ({admins.length})
                </h3>
              </div>
            </div>

            {deleteError && (
              <div className="mb-3 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span className="font-medium text-[11px]">{deleteError}</span>
              </div>
            )}

            {loadingAdmins ? (
              <div className="p-8 text-center">
                <Loader2 className="w-5 h-5 animate-spin mx-auto text-pink-600 mb-2" />
                <p className="text-xs text-gray-400">Cargando administradores...</p>
              </div>
            ) : admins.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-gray-200 dark:border-zinc-800 rounded-xl">
                <p className="text-xs text-gray-400">No se encontraron administradores registrados.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {admins.map((adminItem) => {
                  const isCurrent =
                    currentUser?.email === adminItem.email || currentUser?.id === adminItem.id
                  const isBeingDeleted = deletingId === adminItem.id

                  return (
                    <div
                      key={adminItem.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800/80 hover:border-gray-300 dark:hover:border-zinc-700 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-3">
                        <div className="w-8 h-8 rounded-lg bg-pink-50 dark:bg-pink-950/40 border border-pink-200 dark:border-pink-900/40 text-pink-600 dark:text-pink-400 flex items-center justify-center shrink-0">
                          <Shield className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-semibold text-gray-900 dark:text-zinc-100 truncate">
                              {adminItem.name || 'Administrador'}
                            </p>
                            {isCurrent && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300 shrink-0">
                                Tú
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-500 dark:text-zinc-400 truncate font-mono">
                            {adminItem.email}
                          </p>
                        </div>
                      </div>

                      {/* Acciones de eliminación */}
                      <div className="shrink-0">
                        {isBeingDeleted ? (
                          <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                            <span className="text-[11px] text-rose-600 dark:text-rose-400 font-medium mr-1 hidden sm:inline">
                              ¿Eliminar?
                            </span>
                            <button
                              type="button"
                              onClick={() => setDeletingId(null)}
                              disabled={isDeleting}
                              className="px-2 py-1 text-[11px] font-medium text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded transition-colors"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAdmin(adminItem.id)}
                              disabled={isDeleting}
                              className="px-2.5 py-1 text-[11px] font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded transition-colors flex items-center gap-1 disabled:opacity-50"
                            >
                              {isDeleting ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <>
                                  <Trash2 className="w-3 h-3" />
                                  <span>Sí, eliminar</span>
                                </>
                              )}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeletingId(adminItem.id)}
                            disabled={isCurrent || admins.length <= 1}
                            title={
                              isCurrent
                                ? 'No puedes eliminar tu propia cuenta en uso'
                                : admins.length <= 1
                                ? 'Debe existir al menos un administrador'
                                : 'Eliminar administrador'
                            }
                            className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Pie del Modal */}
        <div className="px-5 py-3 border-t border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-950/30 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}


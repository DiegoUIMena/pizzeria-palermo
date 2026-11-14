"use client"

import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react"
import {
  type User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth"
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"
import { useFirebase } from "./FirebaseContext"

interface User {
  id: string
  name: string
  email: string
  phone?: string
  address?: string
  rut?: string
  role: "customer" | "admin" | "staff"
  addresses?: Address[]
  preferences?: {
    notifications: boolean
    newsletter: boolean
  }
}

interface Address {
  id: string
  street: string
  number: string
  apartment?: string
  commune: string
  reference?: string
  coordinates?: {
    lat: number
    lng: number
  }
  isDefault: boolean
}

interface AuthState {
  user: User | null
  firebaseUser: FirebaseUser | null
  isAuthenticated: boolean
  isLoading: boolean
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>
  loginAdmin: (email: string, password: string) => Promise<void>
  register: (userData: RegisterData) => Promise<{ uid: string; email: string; name: string; phone: string; password: string }>
  loginWithGoogle: () => Promise<void>
  logout: () => Promise<void>
  updateUser: (userData: Partial<User>) => Promise<void>
}

interface RegisterData {
  name: string
  email: string
  password: string
  phone: string
  address?: string
}

const AuthContext = createContext<AuthContextType | null>(null)

const ADMIN_TAB_SESSION_KEY = "palermo_admin_tab_session_active"
const ADMIN_TAB_LAST_UNLOAD_KEY = "palermo_admin_tab_last_unload"
const ADMIN_ACTIVE_TABS_KEY = "palermo_admin_active_tabs"
const ADMIN_PING_STORAGE_KEY = "palermo_admin_session_ping"
const ADMIN_PONG_STORAGE_KEY = "palermo_admin_session_pong"
const ADMIN_CHANNEL_NAME = "palermo_admin_session_channel"
const ADMIN_TAB_HEARTBEAT_MS = 3000
const ADMIN_TAB_FRESH_MS = 12000
const ADMIN_TAB_STALE_MS = 60000

const CURRENT_TAB_ID =
  typeof window !== "undefined"
    ? `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    : "server"

function getNavigationType(): string | null {
  if (typeof window === "undefined" || typeof performance === "undefined") return null
  const entries = performance.getEntriesByType?.("navigation") as PerformanceNavigationTiming[] | undefined
  return entries && entries.length > 0 ? entries[0].type : null
}

function readActiveAdminTabs(): Record<string, number> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(ADMIN_ACTIVE_TABS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function writeActiveAdminTabs(tabs: Record<string, number>): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(ADMIN_ACTIVE_TABS_KEY, JSON.stringify(tabs))
  } catch {
    // Ignorar errores de almacenamiento
  }
}

function registerCurrentAdminTabHeartbeat(): void {
  if (typeof window === "undefined") return
  try {
    const now = Date.now()
    const tabs = readActiveAdminTabs()
    const nextTabs: Record<string, number> = {}
    for (const [id, ts] of Object.entries(tabs)) {
      if (typeof ts === "number" && now - ts < ADMIN_TAB_STALE_MS) {
        nextTabs[id] = ts
      }
    }
    nextTabs[CURRENT_TAB_ID] = now
    writeActiveAdminTabs(nextTabs)
  } catch {
    // Ignorar errores de almacenamiento
  }
}

function unregisterCurrentAdminTab(): void {
  if (typeof window === "undefined") return
  try {
    const tabs = readActiveAdminTabs()
    if (CURRENT_TAB_ID in tabs) {
      delete tabs[CURRENT_TAB_ID]
      writeActiveAdminTabs(tabs)
    }
  } catch {
    // Ignorar errores de almacenamiento
  }
}

function markAdminTabSessionActive(): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(ADMIN_TAB_SESSION_KEY, "1")
    sessionStorage.removeItem(ADMIN_TAB_LAST_UNLOAD_KEY)
    registerCurrentAdminTabHeartbeat()
  } catch {
    // Ignorar errores de almacenamiento
  }
}

function clearAdminTabSession(clearAllTabs = false): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(ADMIN_TAB_SESSION_KEY)
    sessionStorage.removeItem(ADMIN_TAB_LAST_UNLOAD_KEY)
    if (clearAllTabs) {
      localStorage.removeItem(ADMIN_ACTIVE_TABS_KEY)
    } else {
      unregisterCurrentAdminTab()
    }
  } catch {
    // Ignorar errores de almacenamiento
  }
}

function hasValidCurrentTabSession(): boolean {
  if (typeof window === "undefined") return true
  try {
    const isActive = sessionStorage.getItem(ADMIN_TAB_SESSION_KEY) === "1"
    if (!isActive) return false

    const lastUnload = sessionStorage.getItem(ADMIN_TAB_LAST_UNLOAD_KEY)
    if (lastUnload) {
      const navType = getNavigationType()
      const elapsed = Date.now() - Number(lastUnload)
      if (navType !== "reload" && (!Number.isFinite(elapsed) || elapsed > 1500)) {
        // La pestaña fue cerrada y restaurada más tarde, no recargada con F5
        return false
      }
      sessionStorage.removeItem(ADMIN_TAB_LAST_UNLOAD_KEY)
    }

    return true
  } catch {
    return false
  }
}

function hasOtherActiveAdminTabInStorage(): boolean {
  if (typeof window === "undefined") return false
  try {
    const now = Date.now()
    const tabs = readActiveAdminTabs()
    return Object.entries(tabs).some(
      ([id, ts]) => id !== CURRENT_TAB_ID && typeof ts === "number" && now - ts < ADMIN_TAB_FRESH_MS
    )
  } catch {
    return false
  }
}

function pingOtherOpenAdminTabs(timeoutMs = 180): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false)

  return new Promise((resolve) => {
    let settled = false
    let channel: BroadcastChannel | null = null

    const finish = (result: boolean) => {
      if (settled) return
      settled = true
      window.removeEventListener("storage", onStorage)
      if (channel) {
        try {
          channel.close()
        } catch {
          // Ignorar
        }
      }
      resolve(result)
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === ADMIN_PONG_STORAGE_KEY && e.newValue) {
        try {
          const data = JSON.parse(e.newValue)
          if (data?.responderId && data.responderId !== CURRENT_TAB_ID) {
            finish(true)
          }
        } catch {
          // Ignorar
        }
      } else if (e.key === ADMIN_ACTIVE_TABS_KEY && hasOtherActiveAdminTabInStorage()) {
        finish(true)
      }
    }

    window.addEventListener("storage", onStorage)

    try {
      if (typeof BroadcastChannel !== "undefined") {
        channel = new BroadcastChannel(ADMIN_CHANNEL_NAME)
        channel.onmessage = (event) => {
          const data = event?.data
          if (data?.type === "ADMIN_SESSION_PONG" && data.responderId !== CURRENT_TAB_ID) {
            finish(true)
          }
        }
        channel.postMessage({ type: "ADMIN_SESSION_PING", senderId: CURRENT_TAB_ID })
      }
    } catch {
      // Ignorar si BroadcastChannel no está disponible
    }

    try {
      localStorage.setItem(
        ADMIN_PING_STORAGE_KEY,
        JSON.stringify({ senderId: CURRENT_TAB_ID, ts: Date.now() })
      )
    } catch {
      // Ignorar
    }

    setTimeout(() => {
      finish(hasOtherActiveAdminTabInStorage())
    }, timeoutMs)
  })
}

async function hasOrCanInheritAdminSession(): Promise<boolean> {
  if (typeof window === "undefined") return true

  // 1. Si esta misma pestaña ya tenía la sesión activa (ej. recarga F5 o navegación interna)
  if (hasValidCurrentTabSession()) {
    markAdminTabSessionActive()
    return true
  }

  // 2. Si existe otra pestaña activa registrada recientemente en el mismo navegador
  if (hasOtherActiveAdminTabInStorage()) {
    markAdminTabSessionActive()
    return true
  }

  // 3. Consultar en tiempo real a otras pestañas abiertas (incluso si estaban en segundo plano)
  const peerAlive = await pingOtherOpenAdminTabs()
  if (peerAlive) {
    markAdminTabSessionActive()
    return true
  }

  return false
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { initialized } = useFirebase();
  const interactiveLoginRef = useRef(false);
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    firebaseUser: null,
    isAuthenticated: false,
    isLoading: true,
  })

  // Mantener sincronización multi-pestaña y registrar cierre de pestaña para sesiones admin/staff
  useEffect(() => {
    const isAdminOrStaff =
      authState.isAuthenticated &&
      (authState.user?.role === "admin" || authState.user?.role === "staff");

    if (!isAdminOrStaff) return;

    markAdminTabSessionActive();

    const heartbeatInterval = setInterval(() => {
      registerCurrentAdminTabHeartbeat();
    }, ADMIN_TAB_HEARTBEAT_MS);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        registerCurrentAdminTabHeartbeat();
      }
    };

    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        channel = new BroadcastChannel(ADMIN_CHANNEL_NAME);
        channel.onmessage = (event) => {
          const data = event?.data;
          if (data?.type === "ADMIN_SESSION_PING" && data.senderId !== CURRENT_TAB_ID) {
            registerCurrentAdminTabHeartbeat();
            channel?.postMessage({
              type: "ADMIN_SESSION_PONG",
              responderId: CURRENT_TAB_ID,
              ts: Date.now(),
            });
          }
        };
      }
    } catch {
      // Ignorar si BroadcastChannel falla
    }

    const handleStoragePing = (e: StorageEvent) => {
      if (e.key === ADMIN_PING_STORAGE_KEY && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          if (data?.senderId && data.senderId !== CURRENT_TAB_ID) {
            registerCurrentAdminTabHeartbeat();
            localStorage.setItem(
              ADMIN_PONG_STORAGE_KEY,
              JSON.stringify({ responderId: CURRENT_TAB_ID, ts: Date.now() })
            );
          }
        } catch {
          // Ignorar
        }
      }
    };

    const handlePageUnload = () => {
      try {
        sessionStorage.setItem(ADMIN_TAB_LAST_UNLOAD_KEY, String(Date.now()));
        unregisterCurrentAdminTab();
      } catch {
        // Ignorar errores de almacenamiento al cerrar
      }
    };

    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("storage", handleStoragePing);
    window.addEventListener("pagehide", handlePageUnload);
    window.addEventListener("beforeunload", handlePageUnload);

    return () => {
      clearInterval(heartbeatInterval);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("storage", handleStoragePing);
      window.removeEventListener("pagehide", handlePageUnload);
      window.removeEventListener("beforeunload", handlePageUnload);
      if (channel) {
        try {
          channel.close();
        } catch {
          // Ignorar
        }
      }
    };
  }, [authState.isAuthenticated, authState.user?.role]);

  // Escuchar cambios en el estado de autenticación
  useEffect(() => {
    // Solo iniciar la escucha si Firebase está inicializado
    if (!initialized) {
      console.log("Firebase no está inicializado aún, esperando...");
      return;
    }

    console.log("Iniciando escucha de cambios de autenticación");
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // IMPORTANTE: Obtener el ID Token para leer los custom claims
          const tokenResult = await firebaseUser.getIdTokenResult();
          const roleFromClaim = tokenResult.claims.role as string || 'customer';
          
          console.log('[AuthContext] Custom claims:', tokenResult.claims);
          console.log('[AuthContext] Role from claim:', roleFromClaim);
          
          // Obtener datos adicionales del usuario desde Firestore
          const userRef = doc(db, "users", firebaseUser.uid);
          const userDoc = await getDoc(userRef);

          const existingData = userDoc.exists() ? (userDoc.data() as User) : null;
          const firestoreRole = (existingData?.role || "customer") as "customer" | "admin" | "staff";
          const effectiveRole =
            (roleFromClaim === "admin" || roleFromClaim === "staff")
              ? (roleFromClaim as "admin" | "staff")
              : firestoreRole;

          const isAdminOrStaff = effectiveRole === "admin" || effectiveRole === "staff";
          const isInteractive = interactiveLoginRef.current;
          interactiveLoginRef.current = false;

          // Si el usuario tiene rol admin/staff, verificar si la sesión sigue abierta en esta u otra pestaña.
          // Si todas las pestañas del sistema se cerraron sin cerrar sesión, cerrar sesión automáticamente.
          if (isAdminOrStaff) {
            if (isInteractive) {
              markAdminTabSessionActive();
            } else {
              const sessionAlive = await hasOrCanInheritAdminSession();
              if (!sessionAlive) {
                console.log("[AuthContext] Sesión de administrador expirada tras cerrar todas las pestañas; cerrando sesión automáticamente.");
                clearAdminTabSession(true);
                await signOut(auth);
                setAuthState({
                  user: null,
                  firebaseUser: null,
                  isAuthenticated: false,
                  isLoading: false,
                });
                return;
              }
            }
          } else {
            clearAdminTabSession(false);
          }

          if (existingData) {
            // Preferir claim cuando existe admin/staff; si no, usar Firestore como fallback.
            setAuthState({
              user: {
                ...existingData,
                id: firebaseUser.uid,
                role: effectiveRole,
              },
              firebaseUser,
              isAuthenticated: true,
              isLoading: false,
            });
            console.log("Usuario autenticado con rol:", effectiveRole);
          } else {
            // Si no existe el documento, crear uno básico
            const basicUserData: User = {
              id: firebaseUser.uid,
              name: firebaseUser.displayName || "",
              email: firebaseUser.email || "",
              role: roleFromClaim as "customer" | "admin" | "staff",
              addresses: [],
              preferences: {
                notifications: true,
                newsletter: false,
              },
            };

            try {
              // Intentar crear el documento del usuario
              await setDoc(userRef, {
                ...basicUserData,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });

              setAuthState({
                user: basicUserData,
                firebaseUser,
                isAuthenticated: true,
                isLoading: false,
              });
            } catch (docError) {
              console.error("Error al crear documento de usuario:", docError);
              // Si hay error al crear el documento, aún permitimos el inicio de sesión
              setAuthState({
                user: basicUserData,
                firebaseUser,
                isAuthenticated: true,
                isLoading: false,
              });
            }
          }
        } catch (error) {
          console.error("Error al obtener datos del usuario:", error);
          // A pesar del error, permitimos el inicio de sesión con datos básicos
          const basicUser: User = {
            id: firebaseUser.uid,
            name: firebaseUser.displayName || "",
            email: firebaseUser.email || "",
            role: "customer",
            addresses: [],
            preferences: {
              notifications: true,
              newsletter: false,
            },
          };
          
          setAuthState({
            user: basicUser,
            firebaseUser,
            isAuthenticated: true,
            isLoading: false,
          });
        }
      } else {
        clearAdminTabSession(false);
        setAuthState({
          user: null,
          firebaseUser: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    });

    return () => unsubscribe();
  }, [initialized]);

  const login = async (email: string, password: string) => {
    interactiveLoginRef.current = true
    markAdminTabSessionActive()
    try {
      await setPersistence(auth, browserLocalPersistence)
      await signInWithEmailAndPassword(auth, email, password)
      // El estado se actualizará automáticamente por onAuthStateChanged
    } catch (error: any) {
      interactiveLoginRef.current = false
      clearAdminTabSession()
      console.error("Error al iniciar sesión:", {
        code: error?.code,
        message: error?.message,
        projectId: auth.app.options.projectId,
      })
      throw new Error(getErrorMessage(error.code))
    }
  }

  const loginAdmin = async (email: string, password: string) => {
    interactiveLoginRef.current = true
    markAdminTabSessionActive()
    try {
      // Usar browserLocalPersistence para compartir la sesión entre pestañas abiertas del mismo navegador,
      // delegando el control de cierre total de pestañas al registro multi-pestaña de AuthContext.
      await setPersistence(auth, browserLocalPersistence)
      await signInWithEmailAndPassword(auth, email, password)
    } catch (error: any) {
      interactiveLoginRef.current = false
      clearAdminTabSession(false)
      console.error("Error al iniciar sesión de administrador:", {
        code: error?.code,
        message: error?.message,
        projectId: auth.app.options.projectId,
      })
      throw new Error(getErrorMessage(error.code))
    }
  }

  const loginWithGoogle = async () => {
    interactiveLoginRef.current = true
    markAdminTabSessionActive()
    try {
      await setPersistence(auth, browserLocalPersistence)
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: "select_account" })
      await signInWithPopup(auth, provider)
    } catch (error: any) {
      interactiveLoginRef.current = false
      clearAdminTabSession()
      console.error("Error al iniciar sesión con Google:", error)
      throw new Error(getErrorMessage(error.code))
    }
  }

  const register = async (userData: RegisterData) => {
    try {
      await setPersistence(auth, browserLocalPersistence)
      // Crear usuario en Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password)

      // Actualizar perfil con el nombre
      await updateProfile(userCredential.user, {
        displayName: userData.name,
      })

      // Crear documento en Firestore con TODOS los datos del registro
      const newUser: User = {
        id: userCredential.user.uid,
        name: userData.name,
        email: userData.email,
        phone: userData.phone || "",
        address: userData.address || "", // Guardar dirección como string para compatibilidad con perfil
        role: "customer",
        addresses: userData.address
          ? [
              {
                id: "default",
                street: userData.address,
                number: "",
                commune: "",
                isDefault: true,
              },
            ]
          : [],
        preferences: {
          notifications: true,
          newsletter: false,
        },
      }

      // IMPORTANTE: Esperar a que el documento se cree completamente
      await setDoc(doc(db, "users", userCredential.user.uid), {
        ...newUser,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      // Actualizar el estado local inmediatamente con los datos correctos
      setAuthState({
        user: newUser,
        firebaseUser: userCredential.user,
        isAuthenticated: true,
        isLoading: false,
      })

      // Retornar datos del usuario para usarlos en notificaciones
      return {
        uid: userCredential.user.uid,
        email: userData.email,
        name: userData.name,
        phone: userData.phone || "",
        password: userData.password // Solo para enviar en email de bienvenida
      }
    } catch (error: any) {
      console.error("Error al registrarse:", error)
      throw new Error(getErrorMessage(error.code))
    }
  }

  const logout = async () => {
    try {
      interactiveLoginRef.current = false
      clearAdminTabSession(true)
      await signOut(auth)
      // El estado se actualizará automáticamente por onAuthStateChanged
    } catch (error) {
      console.error("Error al cerrar sesión:", error)
      throw error
    }
  }

  const updateUser = async (userData: Partial<User>) => {
    if (!authState.user) return

    try {
      // Actualizar en Firestore
      await updateDoc(doc(db, "users", authState.user.id), {
        ...userData,
        updatedAt: serverTimestamp(),
      })

      // Actualizar estado local
      setAuthState((prev) => ({
        ...prev,
        user: prev.user ? { ...prev.user, ...userData } : null,
      }))
    } catch (error) {
      console.error("Error al actualizar usuario:", error)
      throw error
    }
  }

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        login,
        loginAdmin,
        register,
        loginWithGoogle,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

// Función auxiliar para manejar errores de Firebase
function getErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case "auth/user-not-found":
      return "No existe una cuenta con este correo electrónico"
    case "auth/wrong-password":
      return "Contraseña incorrecta"
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
      return "Correo o contraseña incorrectos para este proyecto Firebase"
    case "auth/email-already-in-use":
      return "Ya existe una cuenta con este correo electrónico"
    case "auth/weak-password":
      return "La contraseña debe tener al menos 6 caracteres"
    case "auth/invalid-email":
      return "Correo electrónico inválido"
    case "auth/operation-not-allowed":
      return "El inicio de sesión con Email/Contraseña no está habilitado en Firebase Auth"
    case "auth/too-many-requests":
      return "Demasiados intentos fallidos. Intenta más tarde"
    case "auth/network-request-failed":
      return "Error de red al conectar con Firebase. Revisa tu conexión"
    default:
      return `Ha ocurrido un error de autenticación (${errorCode || "desconocido"})`
  }
}

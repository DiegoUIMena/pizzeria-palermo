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
  browserSessionPersistence,
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

function getNavigationType(): string | null {
  if (typeof window === "undefined" || typeof performance === "undefined") return null
  const entries = performance.getEntriesByType?.("navigation") as PerformanceNavigationTiming[] | undefined
  return entries && entries.length > 0 ? entries[0].type : null
}

function markAdminTabSessionActive(): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(ADMIN_TAB_SESSION_KEY, "1")
    sessionStorage.removeItem(ADMIN_TAB_LAST_UNLOAD_KEY)
  } catch {
    // Ignorar errores de almacenamiento
  }
}

function clearAdminTabSession(): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(ADMIN_TAB_SESSION_KEY)
    sessionStorage.removeItem(ADMIN_TAB_LAST_UNLOAD_KEY)
  } catch {
    // Ignorar errores de almacenamiento
  }
}

function hasValidAdminTabSession(): boolean {
  if (typeof window === "undefined") return true
  try {
    const isActive = sessionStorage.getItem(ADMIN_TAB_SESSION_KEY) === "1"
    if (!isActive) return false

    const lastUnload = sessionStorage.getItem(ADMIN_TAB_LAST_UNLOAD_KEY)
    if (lastUnload) {
      const navType = getNavigationType()
      if (navType !== "reload") {
        // La pestaña fue cerrada/restaurada o navegada externamente, no recargada con F5
        return false
      }
      sessionStorage.removeItem(ADMIN_TAB_LAST_UNLOAD_KEY)
    }

    return true
  } catch {
    return false
  }
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

  // Registrar descarga/cierre de pestaña mientras haya una sesión de administrador/staff activa
  useEffect(() => {
    const isAdminOrStaff =
      authState.isAuthenticated &&
      (authState.user?.role === "admin" || authState.user?.role === "staff");

    if (!isAdminOrStaff) return;

    const handlePageUnload = () => {
      try {
        sessionStorage.setItem(ADMIN_TAB_LAST_UNLOAD_KEY, String(Date.now()));
      } catch {
        // Ignorar errores de almacenamiento al cerrar
      }
    };

    window.addEventListener("pagehide", handlePageUnload);
    window.addEventListener("beforeunload", handlePageUnload);
    return () => {
      window.removeEventListener("pagehide", handlePageUnload);
      window.removeEventListener("beforeunload", handlePageUnload);
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

          // Si el usuario tiene rol admin/staff pero cerró la pestaña/sistema sin cerrar sesión,
          // cerrar sesión automáticamente y exigir credenciales al volver a ingresar.
          if (isAdminOrStaff && !isInteractive && !hasValidAdminTabSession()) {
            console.log("[AuthContext] Sesión de administrador expirada tras cerrar el sistema; cerrando sesión automáticamente.");
            clearAdminTabSession();
            await signOut(auth);
            setAuthState({
              user: null,
              firebaseUser: null,
              isAuthenticated: false,
              isLoading: false,
            });
            return;
          }

          if (!isAdminOrStaff) {
            clearAdminTabSession();
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
      // Usar persistencia de sesión (sessionStorage) para que al cerrar pestaña/navegador
      // la sesión de administrador se cierre automáticamente sin quedar guardada en IndexedDB.
      await setPersistence(auth, browserSessionPersistence)
      await signInWithEmailAndPassword(auth, email, password)
    } catch (error: any) {
      interactiveLoginRef.current = false
      clearAdminTabSession()
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
      clearAdminTabSession()
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

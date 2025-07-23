"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import {
  type User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
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
  register: (userData: RegisterData) => Promise<void>
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const { initialized } = useFirebase();
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    firebaseUser: null,
    isAuthenticated: false,
    isLoading: true,
  })

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
          // Obtener datos adicionales del usuario desde Firestore
          const userRef = doc(db, "users", firebaseUser.uid);
          const userDoc = await getDoc(userRef);

          if (userDoc.exists()) {
            const userData = userDoc.data() as User;
            setAuthState({
              user: {
                ...userData,
                id: firebaseUser.uid // Asegurarse de que el id esté correcto
              },
              firebaseUser,
              isAuthenticated: true,
              isLoading: false,
            });
            console.log("Usuario autenticado con datos de Firestore");
          } else {
            // Si no existe el documento, crear uno básico
            const basicUserData: User = {
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
    try {
      await signInWithEmailAndPassword(auth, email, password)
      // El estado se actualizará automáticamente por onAuthStateChanged
    } catch (error: any) {
      console.error("Error al iniciar sesión:", error)
      throw new Error(getErrorMessage(error.code))
    }
  }

  const register = async (userData: RegisterData) => {
    try {
      // Crear usuario en Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password)

      // Actualizar perfil con el nombre
      await updateProfile(userCredential.user, {
        displayName: userData.name,
      })

      // Crear documento en Firestore
      const newUser: User = {
        id: userCredential.user.uid,
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
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

      await setDoc(doc(db, "users", userCredential.user.uid), {
        ...newUser,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    } catch (error: any) {
      console.error("Error al registrarse:", error)
      throw new Error(getErrorMessage(error.code))
    }
  }

  const logout = async () => {
    try {
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
        register,
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
    case "auth/email-already-in-use":
      return "Ya existe una cuenta con este correo electrónico"
    case "auth/weak-password":
      return "La contraseña debe tener al menos 6 caracteres"
    case "auth/invalid-email":
      return "Correo electrónico inválido"
    case "auth/too-many-requests":
      return "Demasiados intentos fallidos. Intenta más tarde"
    default:
      return "Ha ocurrido un error. Intenta nuevamente"
  }
}

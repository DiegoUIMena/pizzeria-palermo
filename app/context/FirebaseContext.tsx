"use client";

import { ReactNode, createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";

// Crear un contexto más completo para Firebase
interface FirebaseContextType {
  initialized: boolean;
  error: Error | null;
}

const FirebaseContext = createContext<FirebaseContextType>({
  initialized: false,
  error: null
});

export function FirebaseProvider({ children }: { children: ReactNode }) {
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    try {
      // Verificar que Firebase se haya inicializado correctamente
      if (auth && db) {
        setInitialized(true);
        console.log("Firebase inicializado correctamente");
      } else {
        setError(new Error("Firebase no se ha inicializado correctamente"));
        console.error("Firebase no se ha inicializado correctamente");
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Error desconocido al inicializar Firebase"));
      console.error("Error al inicializar Firebase:", err);
    }
  }, []);

  return (
    <FirebaseContext.Provider value={{ initialized, error }}>
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebase() {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error("useFirebase debe ser usado dentro de un FirebaseProvider");
  }
  return context;
}

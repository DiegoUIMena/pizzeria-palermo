import { initializeApp, getApps } from "firebase/app"
import { getAuth, connectAuthEmulator } from "firebase/auth"
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore"
import { getStorage, connectStorageEmulator } from "firebase/storage"
import { getAnalytics, isSupported } from "firebase/analytics";

// REEMPLAZA ESTA CONFIGURACIÓN CON LA TUYA
const firebaseConfig = {
  apiKey: "AIzaSyCVKPmInym85FO89UhVQNsGzBeeqZ0wmFM",
  authDomain: "pizzeria-palermo-17f6d.firebaseapp.com",
  projectId: "pizzeria-palermo-17f6d",
  storageBucket: "pizzeria-palermo-17f6d.appspot.com", 
  messagingSenderId: "648738451663",
  appId: "1:648738451663:web:4069b7fa6cd5d1a1a487ba",
  measurementId: "G-N89WX0NQJG"
};

// Inicializar Firebase solo si no hay aplicaciones inicializadas
let app;
try {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
  console.log("Firebase inicializado correctamente");
} catch (error) {
  console.error("Error al inicializar Firebase:", error);
  throw new Error("No se pudo inicializar Firebase. Verifica tu conexión a internet.");
}

// Inicializar analytics solo en el cliente
let analytics: ReturnType<typeof getAnalytics> | undefined = undefined;

if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}


// Inicializar servicios
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Para desarrollo - conectar a emuladores locales si están disponibles o usar reglas menos restrictivas
if (typeof window !== "undefined" && window.location.hostname === "localhost") {
  // Si quieres usar emuladores, descomenta estas líneas:
  // connectAuthEmulator(auth, 'http://localhost:9099');
  // connectFirestoreEmulator(db, 'localhost', 8080);
  // connectStorageEmulator(storage, 'localhost', 9199);
  
  console.log("Ejecutando en modo desarrollo - reglas de seguridad menos restrictivas");
}

export default app

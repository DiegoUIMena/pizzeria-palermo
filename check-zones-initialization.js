// Script para verificar la inicializaciÃ³n de zonas
// Este script ayuda a depurar problemas con la persistencia de zonas

// Importar la librerÃ­a de Firebase
const { initializeApp } = require('firebase/app');
const { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  setDoc,
  deleteDoc
} = require('firebase/firestore');

// ConfiguraciÃ³n de Firebase
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Constante para la colecciÃ³n
const DELIVERY_ZONES_COLLECTION = "delivery-zones";

// FunciÃ³n para eliminar todas las zonas
async function deleteAllZones() {
  try {
    console.log("Eliminando todas las zonas...");
    
    // Obtener todas las zonas
    const zonesRef = collection(db, DELIVERY_ZONES_COLLECTION);
    const snapshot = await getDocs(zonesRef);
    
    if (snapshot.empty) {
      console.log("No hay zonas para eliminar");
      return 0;
    }
    
    // Eliminar cada zona
    const deletePromises = snapshot.docs.map(doc => {
      console.log(`Eliminando zona ${doc.id}`);
      return deleteDoc(doc.ref);
    });
    
    await Promise.all(deletePromises);
    console.log(`Se eliminaron ${snapshot.docs.length} zonas correctamente`);
    return snapshot.docs.length;
  } catch (error) {
    console.error("Error al eliminar zonas:", error);
    throw error;
  }
}

// FunciÃ³n para verificar zonas
async function checkZones() {
  try {
    console.log("Verificando zonas en Firestore...");
    
    // Obtener todas las zonas
    const zonesRef = collection(db, DELIVERY_ZONES_COLLECTION);
    const snapshot = await getDocs(zonesRef);
    
    if (snapshot.empty) {
      console.log("âœ… No hay zonas en Firestore - esto es correcto si acabas de eliminarlas todas");
      return [];
    } else {
      console.log(`âš ï¸ Se encontraron ${snapshot.docs.length} zonas en Firestore:`);
      
      const zones = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          nombre: data.nombre,
          tarifa: data.tarifa,
          disponible: data.disponible
        };
      });
      
      zones.forEach((zone, index) => {
        console.log(`  ${index + 1}. ${zone.nombre} (${zone.id}) - Tarifa: $${zone.tarifa} - ${zone.disponible ? 'Disponible' : 'No disponible'}`);
      });
      
      return zones;
    }
  } catch (error) {
    console.error("Error al verificar zonas:", error);
    throw error;
  }
}

// FunciÃ³n para verificar si las zonas se reinicializan automÃ¡ticamente
async function checkAutoInitialization() {
  try {
    console.log("\n=== VERIFICANDO INICIALIZACIÃ“N AUTOMÃTICA ===");
    
    // Eliminar todas las zonas
    await deleteAllZones();
    
    // Esperar un momento para permitir cualquier proceso automÃ¡tico
    console.log("Esperando 3 segundos para verificar si las zonas reaparecen automÃ¡ticamente...");
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Verificar si hay zonas nuevamente
    const zonesRef = collection(db, DELIVERY_ZONES_COLLECTION);
    const snapshot = await getDocs(zonesRef);
    
    if (snapshot.empty) {
      console.log("âœ… No se encontraron zonas despuÃ©s de eliminarlas - el comportamiento es correcto");
      console.log("   Ya no se inicializan automÃ¡ticamente las zonas predeterminadas");
      return true;
    } else {
      console.log(`âš ï¸ Â¡ALERTA! Se encontraron ${snapshot.docs.length} zonas que reaparecieron automÃ¡ticamente:`);
      
      snapshot.docs.forEach((doc, index) => {
        const data = doc.data();
        console.log(`  ${index + 1}. ${data.nombre} (${doc.id})`);
      });
      
      console.log("âŒ Alguna parte del cÃ³digo estÃ¡ inicializando automÃ¡ticamente las zonas predeterminadas.");
      console.log("   Revisa los siguientes archivos:");
      console.log("   - app/components/DeliveryZonesInitializer.tsx");
      console.log("   - hooks/useDeliveryZones.ts");
      console.log("   - lib/delivery-zones-service.ts");
      return false;
    }
  } catch (error) {
    console.error("Error al verificar inicializaciÃ³n automÃ¡tica:", error);
    throw error;
  }
}

// FunciÃ³n principal
async function main() {
  try {
    console.log("=== VERIFICADOR DE ZONAS DE DELIVERY ===\n");
    
    // Verificar zonas actuales
    console.log("\n=== VERIFICANDO ZONAS ACTUALES ===");
    await checkZones();
    
    // Verificar inicializaciÃ³n automÃ¡tica
    const autoInitResult = await checkAutoInitialization();
    
    // Mostrar resumen
    console.log("\n=== RESUMEN ===");
    if (autoInitResult) {
      console.log("âœ… Todo funciona correctamente. Ya puedes crear tus propias zonas sin que se reinicialicen automÃ¡ticamente.");
    } else {
      console.log("âŒ TodavÃ­a hay problemas con la inicializaciÃ³n automÃ¡tica de zonas.");
      console.log("   Revisa el cÃ³digo o ejecuta este script nuevamente despuÃ©s de reiniciar el servidor.");
    }
    
  } catch (error) {
    console.error("Error general:", error);
  } finally {
    // Salir del proceso
    process.exit(0);
  }
}

// Ejecutar script
main();

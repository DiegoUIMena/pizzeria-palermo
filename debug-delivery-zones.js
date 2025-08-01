// debug-delivery-zones.js
// Script para verificar y depurar las zonas de delivery en Firestore

// Importar dependencias de Firebase
const { initializeApp } = require('firebase/app');
const { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc 
} = require('firebase/firestore');

// Configuración de Firebase
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

// Constante para la colección
const DELIVERY_ZONES_COLLECTION = "delivery-zones";

/**
 * Obtiene todas las zonas de delivery desde Firestore
 */
async function getDeliveryZones() {
  try {
    console.log("Obteniendo zonas de delivery desde Firestore...");
    
    const zonesRef = collection(db, DELIVERY_ZONES_COLLECTION);
    const snapshot = await getDocs(zonesRef);
    
    if (snapshot.empty) {
      console.log("No hay zonas de delivery en la base de datos");
      return [];
    }
    
    // Obtener los datos de cada documento
    const zones = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        raw: JSON.stringify(data, null, 2) // Guardar los datos raw para depuración
      };
    });
    
    console.log(`Se encontraron ${zones.length} zonas de delivery`);
    return zones;
  } catch (error) {
    console.error("Error al obtener zonas de delivery:", error);
    throw error;
  }
}

/**
 * Arregla las zonas que tienen polígonos en formato incorrecto
 */
async function fixDeliveryZones(zones) {
  try {
    console.log("Verificando y arreglando zonas con formato incorrecto...");
    
    let fixedCount = 0;
    
    for (const zone of zones) {
      console.log(`\nZona: ${zone.id} (${zone.nombre})`);
      
      // Verificar si el polígono tiene el formato correcto
      let needsFix = false;
      let poligonoCompatible = [];
      
      if (!zone.poligono) {
        console.log("  ❌ La zona no tiene polígono definido");
        needsFix = true;
        poligonoCompatible = [];
      } else if (!Array.isArray(zone.poligono)) {
        console.log("  ❌ El polígono no es un array");
        needsFix = true;
        poligonoCompatible = [];
      } else {
        console.log(`  Polígono tiene ${zone.poligono.length} puntos`);
        
        // Verificar estructura de cada punto
        const muestraPunto = zone.poligono.length > 0 ? JSON.stringify(zone.poligono[0]) : "ningún punto";
        console.log(`  Ejemplo de punto: ${muestraPunto}`);
        
        // Determinar el formato actual y convertir si es necesario
        if (zone.poligono.length > 0) {
          const primerPunto = zone.poligono[0];
          
          if (Array.isArray(primerPunto)) {
            // Formato [lat, lng] - necesita conversión
            console.log("  ⚠️ Formato de polígono como arrays anidados [lat, lng], necesita conversión");
            poligonoCompatible = zone.poligono.map(punto => ({
              lat: punto[0],
              lng: punto[1]
            }));
            needsFix = true;
          } else if (primerPunto && typeof primerPunto === 'object' && 'lat' in primerPunto && 'lng' in primerPunto) {
            // Ya está en formato correcto {lat, lng}
            console.log("  ✅ Formato de polígono correcto con objetos {lat, lng}");
            poligonoCompatible = [...zone.poligono];
          } else {
            // Formato desconocido
            console.log("  ❌ Formato de polígono desconocido o inválido");
            console.log("  Primer punto:", primerPunto);
            needsFix = true;
            poligonoCompatible = [];
          }
        }
      }
      
      // Arreglar zona si es necesario
      if (needsFix) {
        console.log("  🔧 Arreglando formato del polígono...");
        
        try {
          const zoneRef = doc(db, DELIVERY_ZONES_COLLECTION, zone.id);
          
          await setDoc(zoneRef, {
            nombre: zone.nombre || "Zona sin nombre",
            tarifa: typeof zone.tarifa === 'number' ? zone.tarifa : 0,
            disponible: Boolean(zone.disponible),
            tiempoEstimado: zone.tiempoEstimado || "30-40 min",
            poligono: poligonoCompatible,
            color: zone.color || "#3B82F6",
            descripcion: zone.descripcion || ""
          });
          
          console.log("  ✅ Zona arreglada correctamente");
          fixedCount++;
        } catch (fixError) {
          console.error(`  ❌ Error al arreglar zona ${zone.id}:`, fixError);
        }
      }
    }
    
    console.log(`\nResultado: Se arreglaron ${fixedCount} zonas de ${zones.length} total`);
  } catch (error) {
    console.error("Error al arreglar zonas:", error);
    throw error;
  }
}

/**
 * Función principal
 */
async function main() {
  try {
    console.log("=== DEPURADOR DE ZONAS DE DELIVERY ===\n");
    
    // Obtener todas las zonas
    const zones = await getDeliveryZones();
    
    // Mostrar detalles de las zonas
    console.log("\n=== DETALLES DE ZONAS ===");
    zones.forEach((zone, index) => {
      console.log(`\n[${index + 1}] ${zone.id} (${zone.nombre})`);
      console.log(`  - Tarifa: $${zone.tarifa}`);
      console.log(`  - Disponible: ${zone.disponible ? 'Sí' : 'No'}`);
      console.log(`  - Puntos del polígono: ${zone.poligono ? zone.poligono.length : 'N/A'}`);
      console.log(`  - Estructura polígono: ${zone.poligono && zone.poligono.length > 0 ? typeof zone.poligono[0] : 'N/A'}`);
    });
    
    // Arreglar zonas con formato incorrecto
    console.log("\n=== ARREGLANDO ZONAS ===");
    await fixDeliveryZones(zones);
    
    console.log("\n✅ Proceso completado con éxito");
  } catch (error) {
    console.error("\n❌ Error en el proceso:", error);
  } finally {
    // Cerrar la aplicación
    process.exit(0);
  }
}

// Ejecutar script
main();

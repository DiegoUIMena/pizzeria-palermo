"use strict";

// Script para probar la creación de una zona de delivery

// Importamos las librerías necesarias de Firebase
const { initializeApp } = require('firebase/app');
const { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  setDoc
} = require('firebase/firestore');

// Configuración de Firebase - obtenemos desde variables de entorno
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Inicializamos Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Constante para la colección
const DELIVERY_ZONES_COLLECTION = "delivery-zones";

// Crear una zona de prueba
async function createTestZone() {
  try {
    console.log("Creando zona de prueba...");
    
    // Creamos el objeto zona con la estructura necesaria
    const testZone = {
      id: `test-zone-${Date.now()}`,
      nombre: "Zona de Prueba",
      tarifa: 2000,
      disponible: true,
      tiempoEstimado: "20-30 min",
      color: "#10B981", // Verde
      descripcion: "Zona de prueba creada mediante script",
      // Este es el formato correcto para los polígonos: array de [lat, lng]
      poligono: [
        [-32.83, -70.605], // Norte
        [-32.84, -70.605], // Sur
        [-32.84, -70.59],  // Sureste
        [-32.83, -70.59]   // Noreste
      ]
    };
    
    console.log("Estructura de la zona de prueba:", JSON.stringify(testZone, null, 2));
    
    // Transformamos el polígono al formato compatible con Firestore
    // Convertimos cada par [lat, lng] a un objeto {lat, lng}
    const poligonoCompatible = testZone.poligono.map(punto => ({
      lat: punto[0],
      lng: punto[1]
    }));
    
    console.log("Polígono transformado para Firestore:", JSON.stringify(poligonoCompatible, null, 2));
    
    // Referencia al documento en Firestore
    const zoneRef = doc(db, DELIVERY_ZONES_COLLECTION, testZone.id);
    
    // Guardamos la zona en Firestore con el formato correcto
    await setDoc(zoneRef, {
      nombre: testZone.nombre,
      tarifa: testZone.tarifa,
      disponible: testZone.disponible,
      tiempoEstimado: testZone.tiempoEstimado,
      poligono: poligonoCompatible, // Usamos la versión compatible con Firestore
      color: testZone.color,
      descripcion: testZone.descripcion
    });
    
    console.log(`Zona ${testZone.id} guardada correctamente`);
  } catch (error) {
    console.error("Error al crear zona de prueba:", error);
  }
}

// Verificar las zonas existentes
async function checkExistingZones() {
  try {
    console.log("\nVerificando zonas existentes...");
    
    const zonesRef = collection(db, DELIVERY_ZONES_COLLECTION);
    const snapshot = await getDocs(zonesRef);
    
    if (snapshot.empty) {
      console.log("No hay zonas de delivery en la base de datos.");
      return;
    }
    
    console.log(`Se encontraron ${snapshot.docs.length} zonas de delivery:`);
    
    snapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`${index + 1}. ${data.nombre} (${doc.id}):`);
      console.log(`   Tarifa: $${data.tarifa}`);
      console.log(`   Disponible: ${data.disponible ? "Sí" : "No"}`);
      
      // Verificar estructura del polígono
      if (data.poligono) {
        console.log(`   Polígono: ${data.poligono.length} puntos`);
        console.log(`   Primer punto: ${JSON.stringify(data.poligono[0])}`);
      } else {
        console.log("   ¡ALERTA! No tiene polígono definido");
      }
      
      console.log(""); // Línea en blanco para separar
    });
  } catch (error) {
    console.error("Error al verificar zonas:", error);
  }
}

// Ejecutar ambas funciones
async function main() {
  // Primero verificamos las zonas existentes
  await checkExistingZones();
  
  // Luego creamos una zona de prueba
  await createTestZone();
  
  // Finalmente, verificamos de nuevo para confirmar que se creó correctamente
  await checkExistingZones();
  
  console.log("\n¡Proceso completado!");
}

// Ejecutar el script
main();

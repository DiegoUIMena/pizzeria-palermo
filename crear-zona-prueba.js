const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
}

const db = admin.firestore();

async function crearZonaPrueba() {
  try {
    console.log('🎯 Creando zona de prueba con coordenadas diferentes...');
    
    // Crear una zona con coordenadas realmente diferentes alrededor de Los Andes
    const zonaPrueba = {
      id: `zona-prueba-${Date.now()}`,
      nombre: "ZONA PRUEBA",
      tarifa: 2000,
      disponible: true,
      tiempoEstimado: "20-30 min",
      color: "#FF5722", // Naranja para distinguirla
      descripcion: "Zona de prueba con coordenadas diferentes",
      // Polígono cuadrado alrededor del centro de Los Andes (formato objeto para Firestore)
      poligono: [
        {lat: -32.830, lng: -70.605}, // Noroeste
        {lat: -32.830, lng: -70.590}, // Noreste  
        {lat: -32.840, lng: -70.590}, // Sureste
        {lat: -32.840, lng: -70.605}, // Suroeste
      ]
    };
    
    console.log('📍 Coordenadas de la zona de prueba:');
    zonaPrueba.poligono.forEach((punto, index) => {
      console.log(`  Punto ${index + 1}: {lat: ${punto.lat}, lng: ${punto.lng}}`);
    });
    
    const docRef = db.collection('delivery-zones').doc(zonaPrueba.id);
    await docRef.set(zonaPrueba);
    
    console.log('✅ Zona de prueba creada correctamente:', zonaPrueba.id);
    console.log('🔄 Recarga la página del administrador para ver la zona');
    
  } catch (error) {
    console.error('❌ Error al crear zona de prueba:', error);
  } finally {
    process.exit(0);
  }
}

crearZonaPrueba();

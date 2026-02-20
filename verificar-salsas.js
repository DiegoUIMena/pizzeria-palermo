const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Inicializar Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function verificarSalsas() {
  try {
    console.log('🔍 Verificando salsas en Firestore...\n');

    // Buscar todos los items que contengan "Salsa" en el nombre
    const itemsSnapshot = await db.collection('items_menu').get();
    
    const salsas = [];
    itemsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.nombre && data.nombre.toLowerCase().includes('salsa')) {
        salsas.push({
          id: doc.id,
          nombre: data.nombre,
          categoria: data.categoria,
          imagen: data.imagen,
          precio: data.precio
        });
      }
    });

    if (salsas.length === 0) {
      console.log('⚠️  No se encontraron salsas');
    } else {
      console.log(`📋 Salsas encontradas (${salsas.length}):\n`);
      salsas.forEach(salsa => {
        console.log(`ID: ${salsa.id}`);
        console.log(`Nombre: ${salsa.nombre}`);
        console.log(`Categoría: ${salsa.categoria}`);
        console.log(`Imagen: ${salsa.imagen}`);
        console.log(`Precio: $${salsa.precio}`);
        console.log('---');
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

verificarSalsas();

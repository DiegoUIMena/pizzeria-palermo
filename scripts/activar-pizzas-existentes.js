/**
 * Script para agregar el campo 'activo: true' a todas las pizzas existentes
 * que no tengan este campo configurado.
 * 
 * Ejecutar con: node scripts/activar-pizzas-existentes.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

// Inicializar Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function activarPizzasExistentes() {
  try {
    console.log('🔍 Buscando pizzas sin el campo "activo"...\n');

    const itemsMenuSnapshot = await db.collection('items_menu').get();
    let contador = 0;
    let yaActivos = 0;

    const batch = db.batch();

    itemsMenuSnapshot.forEach((doc) => {
      const data = doc.data();
      
      // Si el campo 'activo' no existe o es undefined, establecerlo en true
      if (data.activo === undefined) {
        console.log(`✅ Activando: ${data.nombre || doc.id}`);
        batch.update(doc.ref, { activo: true });
        contador++;
      } else {
        console.log(`ℹ️  Ya configurado: ${data.nombre || doc.id} (activo: ${data.activo})`);
        yaActivos++;
      }
    });

    if (contador > 0) {
      await batch.commit();
      console.log(`\n✨ ¡Actualización completada!`);
      console.log(`📊 Pizzas activadas: ${contador}`);
      console.log(`📊 Pizzas ya configuradas: ${yaActivos}`);
      console.log(`📊 Total procesadas: ${itemsMenuSnapshot.size}`);
    } else {
      console.log('\n✅ Todas las pizzas ya tienen el campo "activo" configurado.');
      console.log(`📊 Total pizzas: ${itemsMenuSnapshot.size}`);
    }

  } catch (error) {
    console.error('❌ Error al actualizar pizzas:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Ejecutar el script
activarPizzasExistentes();

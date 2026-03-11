const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Inicializar Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function actualizarImagenesAcompanamientos() {
  console.log('🚀 Iniciando actualización de imágenes...\n');
  
  try {
    // Obtener todos los items del menú
    const itemsSnapshot = await db.collection('items_menu').get();
    
    let updated = 0;
    let errors = 0;
    
    for (const doc of itemsSnapshot.docs) {
      const data = doc.data();
      const nombre = data.nombre || '';
      
      // Actualizar solo Gauchitos y Rollitos de Canela
      if (nombre === 'Gauchitos') {
        try {
          await db.collection('items_menu').doc(doc.id).update({
            imagen: '/pizzas/gauchitos.jpg'
          });
          console.log(`✅ Actualizado: Gauchitos (ID: ${doc.id})`);
          console.log(`   Ruta: /pizzas/gauchitos.jpg\n`);
          updated++;
        } catch (error) {
          console.error(`❌ Error actualizando Gauchitos:`, error.message);
          errors++;
        }
      } else if (nombre === 'Rollitos de Canela') {
        try {
          await db.collection('items_menu').doc(doc.id).update({
            imagen: '/pizzas/canela.jpg'
          });
          console.log(`✅ Actualizado: Rollitos de Canela (ID: ${doc.id})`);
          console.log(`   Ruta: /pizzas/canela.jpg\n`);
          updated++;
        } catch (error) {
          console.error(`❌ Error actualizando Rollitos de Canela:`, error.message);
          errors++;
        }
      }
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 RESUMEN:');
    console.log(`   ✅ Productos actualizados: ${updated}`);
    console.log(`   ❌ Errores: ${errors}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    if (updated === 2 && errors === 0) {
      console.log('🎉 ¡Actualización completada con éxito!');
      console.log('Las imágenes de Gauchitos y Rollitos de Canela han sido actualizadas en Firebase.\n');
    } else if (errors > 0) {
      console.log('⚠️  Actualización completada con algunos errores. Revisa los logs arriba.');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error general:', error);
    process.exit(1);
  }
}

// Ejecutar
actualizarImagenesAcompanamientos();

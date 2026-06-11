const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Inicializar Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function inicializarCajas() {
  console.log('🚀 Moviendo configuración de cajas a su propio espacio (separado de ingredientes)...\n');

  try {
    // 1. Borrar de ingredientes para que no estorben
    const viejasCajas = ['caja_familiar', 'caja_mediana', 'caja_individual'];
    for (const id of viejasCajas) {
      await db.collection('ingredientes').doc(id).delete();
      console.log(`🧹 Eliminado "${id}" de los ingredientes.`);
    }

    // 2. Crear configuración limpia en settings
    await db.collection('settings').doc('cajas_config').set({
      stockFamiliar: 100,
      stockMediana: 100,
      stockIndividual: 100,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    console.log(`\n✅ Cajas inicializadas correctamente en "settings/cajas_config".`);
    console.log('🎉 ¡Todo listo! Ya no aparecerán mezcladas con los ingredientes de las pizzas.');
  } catch (error) {
    console.error('❌ Error al inicializar cajas:', error);
  }
  process.exit(0);
}

inicializarCajas();
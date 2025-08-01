const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
}

const db = admin.firestore();

async function limpiarZonas() {
  try {
    console.log('🗑️ Limpiando todas las zonas de delivery...');
    
    const zonesRef = db.collection('delivery-zones');
    const snapshot = await zonesRef.get();
    
    if (snapshot.empty) {
      console.log('✅ No hay zonas para eliminar');
      return;
    }
    
    console.log(`📊 Encontradas ${snapshot.size} zonas para eliminar`);
    
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      console.log(`🗑️ Eliminando zona: ${doc.id} - ${doc.data().nombre}`);
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log('✅ Todas las zonas han sido eliminadas correctamente');
    
  } catch (error) {
    console.error('❌ Error al limpiar zonas:', error);
  } finally {
    process.exit(0);
  }
}

limpiarZonas();

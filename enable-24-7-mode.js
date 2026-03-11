const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function enableTestMode() {
  try {
    console.log('🔧 Activando modo 24/7 para pruebas...');
    
    const businessHoursRef = db.collection('settings').doc('businessHours');
    
    await businessHoursRef.set({
      openingTime: '00:00',
      closingTime: '23:59',
      isOpen: true,
      testMode: true,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Modo 24/7 activado (SOLO PARA PRUEBAS):');
    console.log('   Apertura: 00:00');
    console.log('   Cierre: 23:59');
    console.log('   Estado: Abierto siempre');
    console.log('\n⚠️  RECUERDA: Restaurar horario normal antes de producción');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

enableTestMode();

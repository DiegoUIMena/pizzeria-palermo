const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixBusinessHours() {
  try {
    console.log('🔧 Corrigiendo horario comercial...');
    
    const businessHoursRef = db.collection('settings').doc('businessHours');
    
    await businessHoursRef.set({
      openingTime: '18:00',
      closingTime: '23:30',
      isOpen: true,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Horario comercial actualizado exitosamente:');
    console.log('   Apertura: 18:00');
    console.log('   Cierre: 23:30');
    console.log('   Estado: Abierto');
    
    const doc = await businessHoursRef.get();
    console.log('\n📋 Configuración actual:', doc.data());
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixBusinessHours();

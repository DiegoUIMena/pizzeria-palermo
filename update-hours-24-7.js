const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'pizzeria-palermo-17f6d'
});

const db = admin.firestore();

(async () => {
  try {
    console.log('Configurando horarios a 24/7...');
    
    await db.collection('settings').doc('businessHours').set({
      isOpen: true,
      openingTime: '00:00',
      closingTime: '23:59',
      updatedAt: new Date().toISOString(),
      mode: 'development-24-7'
    });
    
    console.log('✅ Horarios configurados a 24/7 (00:00 - 23:59)');
    console.log('Ahora puedes hacer pedidos en cualquier momento');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();

#!/usr/bin/env node

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'pizzeria-palermo-17f6d'
});

const db = admin.firestore();

async function enable24_7() {
  try {
    console.log('Habilitando pedidos 24/7...');
    
    await db.collection('settings').doc('businessHours').set({
      isOpen: true,
      openingTime: '00:00',
      closingTime: '23:59',
      updatedAt: new Date().toISOString(),
      mode: 'development'
    }, { merge: true });
    
    console.log('✅ Horario configurado a 24/7');
    console.log('Ahora puedes hacer pedidos en cualquier momento');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

enable24_7();

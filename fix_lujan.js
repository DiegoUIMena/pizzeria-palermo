const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function fixLujan() {
  const snapshot = await db.collection('items_menu').where('nombre', '==', 'Luján').get();
  if (snapshot.empty) {
    const snapshot2 = await db.collection('items_menu').where('nombre', '==', 'Lujan').get();
    if (snapshot2.empty) {
      console.log('No Lujan pizza found');
      return;
    }
    updateDocs(snapshot2);
  } else {
    updateDocs(snapshot);
  }
}

async function updateDocs(snapshot) {
  for (const doc of snapshot.docs) {
    console.log('Found:', doc.data());
    await doc.ref.update({
      clasificacion: 'tradicional',
      categoria: 'Pizzas Tradicionales'
    });
    console.log('Updated Lujan to Pizzas Tradicionales');
  }
}

fixLujan().catch(console.error);

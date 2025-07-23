const fs = require('fs');
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function exportCollection(collectionName) {
  const snapshot = await db.collection(collectionName).get();
  const data = [];
  snapshot.forEach(doc => {
    data.push({ id: doc.id, ...doc.data() });
  });
  return data;
}

async function exportAll() {
  const collections = await db.listCollections();
  const exportData = {};
  for (const col of collections) {
    exportData[col.id] = await exportCollection(col.id);
  }
  fs.writeFileSync('firestore-export.json', JSON.stringify(exportData, null, 2));
  console.log('Export completo: firestore-export.json');
}

exportAll();
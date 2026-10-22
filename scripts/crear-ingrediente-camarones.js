const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '../serviceAccountKey.json'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function main() {
  console.log("🍤 Inicializando ingrediente Camarones...");

  const snap = await db.collection('ingredientes').where('nombre', '==', 'Camarones').get();
  
  const data = {
    nombre: 'Camarones',
    categoria: 'Carnes',
    tipo: 'premium',
    clase: 'premium',
    unidad: 'Uds.',
    stockActual: 160,
    stockMinimo: 16,
    stockMaximo: 500,
    precioUnitario: 350,
    proveedor: 'Mariscos del Sur',
    cantidadPorPizzaFamiliar: 16,
    cantidadPorPizzaMediana: 16,
    esPrecioEspecial: true,
    precioPorcionFamiliar: 6000,
    precioPorcionMediana: 6000,
    estado: 'Disponible',
    updatedAt: new Date().toISOString()
  };

  if (!snap.empty) {
    const docId = snap.docs[0].id;
    await db.collection('ingredientes').doc(docId).update(data);
    console.log(`✅ Ingrediente Camarones actualizado exitosamente con ID: ${docId}`);
  } else {
    data.createdAt = new Date().toISOString();
    const docRef = await db.collection('ingredientes').add(data);
    console.log(`✅ Ingrediente Camarones creado exitosamente con ID: ${docRef.id}`);
  }
}

main().then(() => {
  console.log("🎉 Listo!");
  process.exit(0);
}).catch(err => {
  console.error("❌ Error creando ingrediente Camarones:", err);
  process.exit(1);
});

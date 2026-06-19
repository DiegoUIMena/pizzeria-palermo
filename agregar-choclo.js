const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function agregarChoclo() {
  try {
    console.log('🚀 Buscando si el ingrediente Choclo ya existe...');
    const snapshot = await db.collection('ingredientes')
      .where('nombre', '==', 'Choclo')
      .get();

    if (!snapshot.empty) {
      console.log('⚠️ El ingrediente Choclo ya existe en la base de datos.');
      process.exit(0);
    }

    const choclo = {
      nombre: "Choclo",
      clase: "simple",
      categoria: "Vegetales",
      tipo: "ingrediente",
      unidad: "gr",
      precioUnitario: 500,
      proveedor: "La Vega",
      estado: "Disponible",
      fechaVencimiento: "",
      stockMinimo: 500,
      stockMaximo: 2000,
      stockActual: 1000,
      cantidadPorPizzaMediana: 40,
      cantidadPorPizzaFamiliar: 60,
      updatedAt: new Date().toISOString()
    };

    console.log('📦 Agregando Choclo a la colección "ingredientes"...');
    const docRef = await db.collection('ingredientes').add(choclo);
    console.log('✅ Choclo agregado exitosamente con ID:', docRef.id);

  } catch (error) {
    console.error('❌ Error al agregar Choclo:', error);
  } finally {
    process.exit(0);
  }
}

agregarChoclo();

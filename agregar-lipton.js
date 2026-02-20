const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Inicializar Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function agregarProductosLipton() {
  try {
    console.log('🚀 Iniciando agregado de productos Lipton...');

    // Producto 1: Lipton Botella
    const liptonBotella = {
      categoria: "Bebidas",
      descripcion: "Ice Tea Lipton limón té negro 1.5 L",
      estado: "Disponible",
      fechaVencimiento: "2025-12-31",
      imagen: "/placeholder.svg?height=200&width=200",
      nombre: "Lipton Botella",
      orden: 2,
      precio: 2900,
      precioMediana: 2900,
      precioUnitario: 2900,
      proveedor: "Distribuidora Coca Cola",
      stockActual: 30,
      stockMaximo: 100,
      stockMinimo: 5,
      unidad: "botella",
      variants: ["Tradicional", "Zero"]
    };

    // Producto 2: Lipton Lata (corregido)
    const liptonLata = {
      categoria: "Bebidas",
      descripcion: "Ice Tea Lipton limón té negro lata 310 ml",
      estado: "Disponible",
      fechaVencimiento: "2025-12-31",
      imagen: "/placeholder.svg?height=200&width=200",
      nombre: "Lipton Lata", // ✅ CORREGIDO
      orden: 3,
      precio: 1500, // ✅ Precio ajustado para lata
      precioMediana: 1500,
      precioUnitario: 1500,
      proveedor: "Distribuidora Coca Cola",
      stockActual: 50, // Más stock inicial para latas
      stockMaximo: 150,
      stockMinimo: 10,
      unidad: "lata", // ✅ CORREGIDO
      variants: ["Tradicional", "Zero"]
    };

    // Agregar Lipton Botella
    console.log('📦 Agregando Lipton Botella...');
    const botellaRef = await db.collection('items_menu').add(liptonBotella);
    console.log('✅ Lipton Botella agregado con ID:', botellaRef.id);

    // Agregar Lipton Lata
    console.log('📦 Agregando Lipton Lata...');
    const lataRef = await db.collection('items_menu').add(liptonLata);
    console.log('✅ Lipton Lata agregado con ID:', lataRef.id);

    console.log('\n🎉 ¡Productos Lipton agregados exitosamente!');
    console.log('\nResumen:');
    console.log('- Lipton Botella 1.5L: $2.900');
    console.log('- Lipton Lata 310ml: $1.500');
    console.log('\nAmbos con variants: Tradicional, Zero');

  } catch (error) {
    console.error('❌ Error al agregar productos:', error);
  } finally {
    process.exit(0);
  }
}

agregarProductosLipton();

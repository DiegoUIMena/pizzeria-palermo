const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Inicializar Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Mapeo de nombres de productos a nombres de archivos de imagen
const imageMapping = {
  // Bebidas - Coca Cola
  'Coca Cola Botella': '/pizzas/coca cola 1.5 litro.jpg',
  'Coca Cola 1.5 Litro': '/pizzas/coca cola 1.5 litro.jpg',
  'Coca Cola Lata': '/pizzas/coca cola lata.jpg',
  'Coca Cola Lata 350cc': '/pizzas/coca cola lata.jpg',
  
  // Bebidas - Lipton
  'Lipton Botella': '/pizzas/lipton botella.jpg',
  'Lipton Lata': '/pizzas/lipton lata.jpg',
  
  // Salsas
  'Salsa BBQ': '/pizzas/salsa bbq.jpg',
  'Salsa Chimichurri': '/pizzas/salsa chimichurri.jpg',
  'Salsa de Ajo': '/pizzas/salsa de ajo.jpg',
  'Salsa Pesto': '/pizzas/salsa pesto.jpg',
};

async function actualizarImagenes() {
  try {
    console.log('🚀 Iniciando actualización de imágenes...\n');

    // Obtener todos los items del menú
    const itemsSnapshot = await db.collection('items_menu').get();
    
    let actualizados = 0;
    let noEncontrados = [];

    for (const doc of itemsSnapshot.docs) {
      const data = doc.data();
      const nombre = data.nombre;
      
      if (imageMapping[nombre]) {
        const nuevaImagen = imageMapping[nombre];
        
        // Actualizar el documento
        await doc.ref.update({
          imagen: nuevaImagen
        });
        
        console.log(`✅ ${nombre}: ${nuevaImagen}`);
        actualizados++;
      } else if (data.categoria === 'Bebidas' || data.categoria === 'Salsas') {
        noEncontrados.push(nombre);
      }
    }

    console.log(`\n📊 Resumen:`);
    console.log(`- ${actualizados} imágenes actualizadas`);
    
    if (noEncontrados.length > 0) {
      console.log(`\n⚠️  Productos sin mapeo de imagen:`);
      noEncontrados.forEach(nombre => console.log(`   - ${nombre}`));
    }

    console.log('\n🎉 ¡Actualización completada!');

  } catch (error) {
    console.error('❌ Error al actualizar imágenes:', error);
  } finally {
    process.exit(0);
  }
}

actualizarImagenes();

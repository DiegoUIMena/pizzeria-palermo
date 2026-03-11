const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Inicializar Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'pizzeria-palermo-e4f61.appspot.com'
  });
}

const db = admin.firestore();

async function checkPizzaImages() {
  try {
    console.log('🔍 Verificando imágenes de pizzas en Firestore...\n');
    
    const snapshot = await db.collection('items_menu').get();
    
    if (snapshot.empty) {
      console.log('❌ No se encontraron pizzas en la colección items_menu');
      return;
    }
    
    console.log(`📊 Total de items en menú: ${snapshot.size}\n`);
    console.log('=' .repeat(80));
    
    let conImagen = 0;
    let sinImagen = 0;
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const imagen = data.imagen || data.image;
      
      if (imagen) {
        conImagen++;
        console.log(`✅ ${data.nombre}`);
        console.log(`   ID: ${doc.id}`);
        console.log(`   Imagen: ${imagen.substring(0, 80)}...`);
        console.log(`   Categoría: ${data.categoria || 'N/A'}`);
        console.log(`   Activo: ${data.activo !== false ? 'Sí' : 'No'}`);
      } else {
        sinImagen++;
        console.log(`❌ ${data.nombre}`);
        console.log(`   ID: ${doc.id}`);
        console.log(`   ⚠️  SIN IMAGEN`);
        console.log(`   Categoría: ${data.categoria || 'N/A'}`);
        console.log(`   Activo: ${data.activo !== false ? 'Sí' : 'No'}`);
      }
      console.log('-'.repeat(80));
    });
    
    console.log('\n' + '='.repeat(80));
    console.log(`📈 RESUMEN:`);
    console.log(`   ✅ Con imagen: ${conImagen}`);
    console.log(`   ❌ Sin imagen: ${sinImagen}`);
    console.log(`   📊 Total: ${snapshot.size}`);
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkPizzaImages();

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function verificarImagenesPizzas() {
  console.log('🔍 Verificando imágenes de pizzas en Firestore...\n');
  
  const snapshot = await db.collection('items_menu').get();
  
  console.log(`Total de items en menú: ${snapshot.size}\n`);
  
  const pizzas = [];
  
  snapshot.forEach(doc => {
    const data = doc.data();
    const nombre = data.nombre || data.name || 'Sin nombre';
    const imagen = data.imagen || data.image || 'Sin imagen';
    const categoria = data.categoria || data.category || 'Sin categoría';
    
    // Solo pizzas
    if (categoria.toLowerCase().includes('pizza') || 
        data.clasificacion === 'vegetariana' || 
        data.clasificacion === 'carnica' || 
        data.clasificacion === 'marina') {
      pizzas.push({
        id: doc.id,
        nombre,
        imagen,
        categoria,
        clasificacion: data.clasificacion
      });
    }
  });
  
  console.log(`Pizzas encontradas: ${pizzas.length}\n`);
  console.log('═'.repeat(80));
  
  let conPlaceholder = 0;
  let conImagenReal = 0;
  
  pizzas.forEach((pizza, idx) => {
    const esPlaceholder = pizza.imagen.includes('placeholder');
    if (esPlaceholder) {
      conPlaceholder++;
    } else {
      conImagenReal++;
    }
    
    const status = esPlaceholder ? '❌ PLACEHOLDER' : '✅ IMAGEN';
    console.log(`${idx + 1}. ${status} | ${pizza.nombre}`);
    console.log(`   Path: ${pizza.imagen}`);
    console.log(`   Categoría: ${pizza.categoria} (${pizza.clasificacion || 'N/A'})`);
    console.log('─'.repeat(80));
  });
  
  console.log('\n📊 RESUMEN:');
  console.log(`✅ Pizzas con imagen real: ${conImagenReal}`);
  console.log(`❌ Pizzas con placeholder: ${conPlaceholder}`);
  console.log(`📈 Total: ${pizzas.length}`);
  
  if (conPlaceholder > 0) {
    console.log('\n⚠️  PROBLEMA: Hay pizzas con placeholder que necesitan imágenes reales.');
    console.log('💡 SOLUCIÓN: La función getImagePath debe buscar la imagen correcta en /pizzas/ cuando detecte un placeholder.');
  }
}

verificarImagenesPizzas()
  .then(() => {
    console.log('\n✅ Verificación completada');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

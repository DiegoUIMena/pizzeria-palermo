const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Inicializar Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function debugSalsas() {
  try {
    console.log('🔍 Debug de salsas en itemsMenu...\n');

    const itemsSnapshot = await db.collection('items_menu').get();
    
    console.log(`Total items en items_menu: ${itemsSnapshot.size}\n`);
    
    // Filtrar Acompañamientos
    const acompanamientos = [];
    itemsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.categoria === "Acompañamientos") {
        acompanamientos.push({
          nombre: data.nombre,
          incluyeSalsa: data.nombre.toLowerCase().includes("salsa"),
          nombreLowerCase: data.nombre.toLowerCase()
        });
      }
    });
    
    console.log(`📋 Acompañamientos encontrados (${acompanamientos.length}):`);
    acompanamientos.forEach(item => {
      console.log(`  - "${item.nombre}"`);
      console.log(`    Lower: "${item.nombreLowerCase}"`);
      console.log(`    Incluye "salsa": ${item.incluyeSalsa}`);
      console.log('');
    });

    // Simular el filtro del código
    const salsasFiltradas = acompanamientos.filter(i => i.nombreLowerCase.includes("salsa"));
    console.log(`\n🎯 Salsas que pasarían el filtro (${salsasFiltradas.length}):`);
    salsasFiltradas.forEach(s => console.log(`  - ${s.nombre}`));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

debugSalsas();

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

const correctMapping = {
  // Bebidas
  'Coca Cola 1.5 Litro': '/bebidas/coca_cola_1.5_litro.jpg',
  'Coca Cola 1.5 Litro Zero': '/bebidas/coca_cola_1.5_litro_zero.jpg',
  'Coca Cola Lata': '/bebidas/coca_cola_lata.jpg',
  'Coca Cola Lata Zero': '/bebidas/coca_cola_lata_zero.jpg',
  'Lipton Botella': '/bebidas/lipton_botella.jpg',
  'Lipton Lata': '/bebidas/lipton_lata.jpg',
  
  // Salsas
  'Salsa BBQ': '/acompañamientos/salsa_bbq.jpg',
  'Salsa Chimichurri': '/acompañamientos/salsa_chimichurri.jpg',
  'Salsa de Ajo': '/acompañamientos/salsa_de_ajo.jpg',
  'Salsa Pesto': '/acompañamientos/salsa_pesto.jpg',
  
  // Otros Acompañamientos
  'Gauchitos': '/acompañamientos/gauchitos.jpg',
  'Rollitos de Canela': '/acompañamientos/canela.jpg'
};

async function fixImages() {
  const snapshot = await db.collection('items_menu').get();
  let updated = 0;
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    let updatedPath = false;

    if (correctMapping[data.nombre]) {
      await doc.ref.update({ imagen: correctMapping[data.nombre] });
      console.log('Fixed:', data.nombre, '->', correctMapping[data.nombre]);
      updated++;
      updatedPath = true;
    }
    
    // Also check variants if they exist
    if (data.variantes && typeof data.variantes === 'object') {
      let variantsUpdated = false;
      const nuevasVariantes = { ...data.variantes };
      for (const [key, variant] of Object.entries(nuevasVariantes)) {
        if (correctMapping[variant.nombre]) {
           variant.imagen = correctMapping[variant.nombre];
           variantsUpdated = true;
        } else if (data.nombre === 'Coca Cola 1.5 Litro' && variant.nombre.includes('Zero')) {
           variant.imagen = '/bebidas/coca_cola_1.5_litro_zero.jpg';
           variantsUpdated = true;
        } else if (data.nombre === 'Coca Cola 1.5 Litro' && variant.nombre.includes('Tradicional')) {
           variant.imagen = '/bebidas/coca_cola_1.5_litro.jpg';
           variantsUpdated = true;
        } else if (data.nombre === 'Coca Cola Lata' && variant.nombre.includes('Zero')) {
           variant.imagen = '/bebidas/coca_cola_lata_zero.jpg';
           variantsUpdated = true;
        } else if (data.nombre === 'Coca Cola Lata' && variant.nombre.includes('Tradicional')) {
           variant.imagen = '/bebidas/coca_cola_lata.jpg';
           variantsUpdated = true;
        }
      }
      if (variantsUpdated) {
         await doc.ref.update({ variantes: nuevasVariantes });
         console.log('Fixed variants for:', data.nombre);
         if (!updatedPath) updated++;
      }
    }
  }
  console.log('Total fixed:', updated);
  process.exit(0);
}

fixImages().catch(console.error);

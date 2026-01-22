// Script para actualizar URLs de imágenes en Firestore
// Asume que las imágenes en public/pizzas/ tienen nombres similares al nombre de la pizza

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Inicializar Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Configuración
const IMAGES_FOLDER = './public/pizzas'; // Carpeta donde están tus imágenes

// Función para normalizar nombres (quitar acentos, espacios, etc.)
function normalizeString(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
    .replace(/[^a-z0-9]/g, '-') // Reemplazar caracteres especiales con guión
    .replace(/-+/g, '-') // Reemplazar múltiples guiones con uno solo
    .replace(/^-|-$/g, ''); // Eliminar guiones al inicio y final
}

async function updateImageUrls() {
  console.log('🍕 Iniciando actualización de URLs de imágenes...\n');

  // Verificar que existe la carpeta de imágenes
  if (!fs.existsSync(IMAGES_FOLDER)) {
    console.error(`❌ La carpeta ${IMAGES_FOLDER} no existe.`);
    console.log('Por favor, crea la carpeta y coloca las imágenes ahí.');
    process.exit(1);
  }

  // Listar imágenes disponibles
  const availableImages = fs.readdirSync(IMAGES_FOLDER)
    .filter(file => /\.(jpg|jpeg|png|webp)$/i.test(file));
  
  console.log(`📁 Imágenes encontradas en ${IMAGES_FOLDER}:`);
  availableImages.forEach(img => console.log(`  - ${img}`));
  console.log('');

  // Obtener todos los items del menú
  const itemsSnapshot = await db.collection('items_menu').get();
  
  if (itemsSnapshot.empty) {
    console.log('❌ No hay items en la colección items_menu');
    process.exit(1);
  }

  console.log(`📋 Encontrados ${itemsSnapshot.size} items en el menú\n`);

  let successCount = 0;
  let skipCount = 0;

  for (const doc of itemsSnapshot.docs) {
    const itemData = doc.data();
    const itemId = doc.id;
    const itemName = itemData.nombre || 'Sin nombre';

    console.log(`\n🍕 Procesando: ${itemName} (ID: ${itemId})`);

    // Buscar la imagen correspondiente
    // Intentar varios formatos de nombre
    const searchNames = [
      normalizeString(itemName), // Nombre normalizado
      itemName.toLowerCase().replace(/\s+/g, '-'),
      itemName.toLowerCase().replace(/\s+/g, '_'),
      itemName.toLowerCase().replace(/\s+/g, ''),
      itemId,
    ];

    let imageFile = null;
    
    for (const searchName of searchNames) {
      const found = availableImages.find(img => {
        const imgName = img.replace(/\.(jpg|jpeg|png|webp)$/i, '');
        return normalizeString(imgName) === searchName.toLowerCase() ||
               imgName.toLowerCase().includes(searchName.toLowerCase()) ||
               searchName.toLowerCase().includes(imgName.toLowerCase());
      });
      if (found) {
        imageFile = found;
        break;
      }
    }

    if (!imageFile) {
      console.log(`⚠️  No se encontró imagen para "${itemName}"`);
      console.log(`   Buscó: ${searchNames.join(', ')}`);
      console.log(`   💡 Tip: Nombra el archivo como: ${normalizeString(itemName)}.jpg`);
      skipCount++;
      continue;
    }

    try {
      // La ruta pública empieza desde /pizzas/ (sin public/)
      const imageUrl = `/pizzas/${imageFile}`;
      
      await db.collection('items_menu').doc(itemId).update({
        imagen: imageUrl
      });
      
      console.log(`✅ Actualizado con imagen: ${imageUrl}`);
      successCount++;
    } catch (error) {
      console.error(`❌ Error actualizando ${itemName}:`, error.message);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN:');
  console.log('='.repeat(60));
  console.log(`✅ Actualizadas: ${successCount}`);
  console.log(`⚠️  Sin imagen: ${skipCount}`);
  console.log('='.repeat(60));
  
  if (skipCount > 0) {
    console.log('\n💡 CONSEJOS PARA LAS IMÁGENES FALTANTES:');
    console.log('1. Revisa los nombres sugeridos arriba');
    console.log('2. Copia exactamente el nombre sugerido para tu archivo');
    console.log('3. Vuelve a ejecutar este script: node update-image-urls.js');
  }
}

// Ejecutar
updateImageUrls()
  .then(() => {
    console.log('\n✅ Proceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error en el proceso:', error);
    process.exit(1);
  });

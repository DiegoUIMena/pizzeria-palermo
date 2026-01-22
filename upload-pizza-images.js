// Script para subir imágenes de pizzas a Firebase Storage
// y actualizar las URLs en Firestore

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Inicializar Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'pizzeria-palermo-17f6d.appspot.com'
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

// Configuración
const IMAGES_FOLDER = './public/pizzas'; // Carpeta donde están tus imágenes locales
const STORAGE_PATH = 'pizzas'; // Carpeta en Firebase Storage

async function uploadImageToStorage(localPath, storagePath) {
  try {
    const destination = `${STORAGE_PATH}/${storagePath}`;
    
    console.log(`📤 Subiendo ${localPath} a ${destination}...`);
    
    await bucket.upload(localPath, {
      destination: destination,
      metadata: {
        contentType: 'image/jpeg', // Ajusta según tus imágenes (jpeg, png, webp)
        cacheControl: 'public, max-age=31536000', // Cache por 1 año
      },
    });

    // Hacer la imagen pública
    const file = bucket.file(destination);
    await file.makePublic();

    // Obtener la URL pública
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${destination}`;
    
    console.log(`✅ Imagen subida: ${publicUrl}`);
    
    return publicUrl;
  } catch (error) {
    console.error(`❌ Error subiendo ${localPath}:`, error);
    throw error;
  }
}

async function updateFirestoreWithImageUrl(itemId, imageUrl) {
  try {
    await db.collection('items_menu').doc(itemId).update({
      imagen: imageUrl
    });
    console.log(`✅ Firestore actualizado para ${itemId}`);
  } catch (error) {
    console.error(`❌ Error actualizando Firestore para ${itemId}:`, error);
    throw error;
  }
}

async function uploadPizzaImages() {
  console.log('🍕 Iniciando subida de imágenes de pizzas...\n');

  // Verificar que existe la carpeta de imágenes
  if (!fs.existsSync(IMAGES_FOLDER)) {
    console.error(`❌ La carpeta ${IMAGES_FOLDER} no existe.`);
    console.log('Por favor, crea la carpeta y coloca las imágenes ahí.');
    process.exit(1);
  }

  // Obtener todos los items del menú
  const itemsSnapshot = await db.collection('items_menu').get();
  
  if (itemsSnapshot.empty) {
    console.log('❌ No hay items en la colección items_menu');
    process.exit(1);
  }

  console.log(`📋 Encontrados ${itemsSnapshot.size} items en el menú\n`);

  // Listar imágenes disponibles
  const availableImages = fs.readdirSync(IMAGES_FOLDER)
    .filter(file => /\.(jpg|jpeg|png|webp)$/i.test(file));
  
  console.log(`📁 Imágenes disponibles en ${IMAGES_FOLDER}:`);
  availableImages.forEach(img => console.log(`  - ${img}`));
  console.log('');

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const doc of itemsSnapshot.docs) {
    const itemData = doc.data();
    const itemId = doc.id;
    const itemName = itemData.nombre || 'Sin nombre';

    console.log(`\n🍕 Procesando: ${itemName} (ID: ${itemId})`);

    // Buscar la imagen correspondiente
    // Intentar varios formatos: nombre-pizza.jpg, nombre_pizza.jpg, etc.
    const searchNames = [
      itemName.toLowerCase().replace(/\s+/g, '-'),
      itemName.toLowerCase().replace(/\s+/g, '_'),
      itemName.toLowerCase().replace(/\s+/g, ''),
      itemId,
    ];

    let imageFile = null;
    
    for (const searchName of searchNames) {
      const found = availableImages.find(img => 
        img.toLowerCase().startsWith(searchName.toLowerCase())
      );
      if (found) {
        imageFile = found;
        break;
      }
    }

    if (!imageFile) {
      console.log(`⚠️  No se encontró imagen para "${itemName}". Buscó: ${searchNames.join(', ')}`);
      skipCount++;
      continue;
    }

    try {
      const localPath = path.join(IMAGES_FOLDER, imageFile);
      const imageUrl = await uploadImageToStorage(localPath, imageFile);
      await updateFirestoreWithImageUrl(itemId, imageUrl);
      successCount++;
    } catch (error) {
      console.error(`❌ Error procesando ${itemName}:`, error.message);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 RESUMEN DE LA SUBIDA:');
  console.log('='.repeat(50));
  console.log(`✅ Exitosas: ${successCount}`);
  console.log(`⚠️  Omitidas: ${skipCount}`);
  console.log(`❌ Errores: ${errorCount}`);
  console.log('='.repeat(50));
}

// Ejecutar
uploadPizzaImages()
  .then(() => {
    console.log('\n✅ Proceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error en el proceso:', error);
    process.exit(1);
  });

/**
 * Script de Backup Local - SIN COSTO
 * Exporta Firestore a archivos JSON en tu computadora
 * 
 * Uso:
 * node scripts/backup-local.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Inicializar Firebase Admin
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Colecciones a respaldar
const COLLECTIONS = [
  'orders',
  'users',
  'items_menu',
  'ingredientes',
  'delivery-zones',
  'settings',
  'pizza_config',
  'categorias_menu'
];

async function backupCollection(collectionName) {
  console.log(`📦 Respaldando ${collectionName}...`);
  
  const snapshot = await db.collection(collectionName).get();
  const data = [];
  
  snapshot.forEach(doc => {
    data.push({
      id: doc.id,
      ...doc.data()
    });
  });
  
  console.log(`   ✅ ${data.length} documentos encontrados`);
  return data;
}

async function createBackup() {
  const timestamp = new Date().toISOString().split('T')[0];
  const backupDir = path.join(__dirname, '..', 'backups', timestamp);
  
  // Crear carpeta de backups
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  console.log(`\n🗄️  Iniciando backup local...`);
  console.log(`📁 Guardando en: ${backupDir}\n`);
  
  const backup = {
    timestamp: new Date().toISOString(),
    version: '1.0',
    collections: {}
  };
  
  // Respaldar cada colección
  for (const collectionName of COLLECTIONS) {
    try {
      const data = await backupCollection(collectionName);
      backup.collections[collectionName] = data;
      
      // Guardar archivo individual por colección
      fs.writeFileSync(
        path.join(backupDir, `${collectionName}.json`),
        JSON.stringify(data, null, 2)
      );
    } catch (error) {
      console.error(`   ❌ Error respaldando ${collectionName}:`, error.message);
    }
  }
  
  // Guardar backup completo
  fs.writeFileSync(
    path.join(backupDir, 'backup-completo.json'),
    JSON.stringify(backup, null, 2)
  );
  
  // Calcular tamaño
  const stats = fs.statSync(path.join(backupDir, 'backup-completo.json'));
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  
  console.log(`\n✨ ¡Backup completado exitosamente!`);
  console.log(`📊 Tamaño total: ${sizeMB} MB`);
  console.log(`📁 Ubicación: ${backupDir}\n`);
  
  // Limpiar backups antiguos (mantener últimos 7)
  cleanOldBackups();
}

function cleanOldBackups() {
  const backupsDir = path.join(__dirname, '..', 'backups');
  
  if (!fs.existsSync(backupsDir)) return;
  
  const backups = fs.readdirSync(backupsDir)
    .filter(name => /^\d{4}-\d{2}-\d{2}$/.test(name))
    .sort()
    .reverse();
  
  // Mantener solo los últimos 7 backups
  if (backups.length > 7) {
    const toDelete = backups.slice(7);
    
    console.log(`🧹 Limpiando backups antiguos (manteniendo últimos 7)...`);
    
    toDelete.forEach(backup => {
      const backupPath = path.join(backupsDir, backup);
      fs.rmSync(backupPath, { recursive: true, force: true });
      console.log(`   🗑️  Eliminado: ${backup}`);
    });
  }
}

// Ejecutar backup
createBackup()
  .then(() => {
    console.log('🎉 Proceso completado');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });

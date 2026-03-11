/**
 * Script de Restauración desde Backup Local
 * Restaura datos de Firestore desde archivos JSON
 * 
 * Uso:
 * node scripts/restore-local.js [fecha]
 * 
 * Ejemplo:
 * node scripts/restore-local.js 2026-02-22
 * node scripts/restore-local.js  (usa el backup más reciente)
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

async function restoreCollection(collectionName, data) {
  console.log(`📥 Restaurando ${collectionName}...`);
  
  const batch = db.batch();
  let count = 0;
  
  for (const doc of data) {
    const { id, ...docData } = doc;
    const docRef = db.collection(collectionName).doc(id);
    batch.set(docRef, docData);
    count++;
    
    // Firestore batch limit is 500
    if (count % 500 === 0) {
      await batch.commit();
      console.log(`   ⚡ ${count} documentos restaurados...`);
    }
  }
  
  // Commit remaining
  if (count % 500 !== 0) {
    await batch.commit();
  }
  
  console.log(`   ✅ ${count} documentos restaurados en ${collectionName}`);
}

async function restoreBackup(backupDate) {
  const backupsDir = path.join(__dirname, '..', 'backups');
  
  // Si no se especifica fecha, usar el más reciente
  if (!backupDate) {
    const backups = fs.readdirSync(backupsDir)
      .filter(name => /^\d{4}-\d{2}-\d{2}$/.test(name))
      .sort()
      .reverse();
    
    if (backups.length === 0) {
      console.error('❌ No hay backups disponibles');
      process.exit(1);
    }
    
    backupDate = backups[0];
    console.log(`📅 Usando backup más reciente: ${backupDate}`);
  }
  
  const backupDir = path.join(backupsDir, backupDate);
  
  if (!fs.existsSync(backupDir)) {
    console.error(`❌ Backup no encontrado: ${backupDate}`);
    console.log('\n📋 Backups disponibles:');
    
    const available = fs.readdirSync(backupsDir)
      .filter(name => /^\d{4}-\d{2}-\d{2}$/.test(name))
      .sort()
      .reverse();
    
    available.forEach(backup => {
      const stats = fs.statSync(path.join(backupsDir, backup, 'backup-completo.json'));
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`   📁 ${backup} (${sizeMB} MB)`);
    });
    
    process.exit(1);
  }
  
  console.log(`\n🔄 Iniciando restauración desde: ${backupDir}\n`);
  
  // ⚠️ ADVERTENCIA
  console.log('⚠️  ADVERTENCIA: Esto sobrescribirá los datos actuales');
  console.log('⚠️  Presiona Ctrl+C en los próximos 5 segundos para cancelar\n');
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Leer backup completo
  const backupPath = path.join(backupDir, 'backup-completo.json');
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  
  console.log(`📦 Backup generado: ${backup.timestamp}`);
  console.log(`📊 Versión: ${backup.version}\n`);
  
  // Restaurar cada colección
  for (const [collectionName, data] of Object.entries(backup.collections)) {
    try {
      await restoreCollection(collectionName, data);
    } catch (error) {
      console.error(`   ❌ Error restaurando ${collectionName}:`, error.message);
    }
  }
  
  console.log(`\n✨ ¡Restauración completada!\n`);
}

// Obtener fecha del argumento
const backupDate = process.argv[2];

// Ejecutar restauración
restoreBackup(backupDate)
  .then(() => {
    console.log('🎉 Proceso completado');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkBusinessStatus() {
  try {
    console.log('🔍 Verificando estado del local...\n');
    
    const businessHoursRef = db.collection('settings').doc('businessHours');
    const doc = await businessHoursRef.get();
    
    if (!doc.exists) {
      console.log('❌ No se encontró configuración de horarios');
      process.exit(1);
    }
    
    const data = doc.data();
    
    console.log('📋 CONFIGURACIÓN ACTUAL:');
    console.log('========================');
    console.log('Estado (isOpen):', data.isOpen);
    console.log('Apertura:', data.openingTime);
    console.log('Cierre:', data.closingTime);
    console.log('\n📸 BANNERS:');
    console.log('========================');
    console.log('Total de banners:', data.closedBannerImages?.length || 0);
    console.log('Banner activo ID:', data.activeBannerId || 'Ninguno');
    
    if (data.closedBannerImages && data.closedBannerImages.length > 0) {
      console.log('\nLista de banners:');
      data.closedBannerImages.forEach((banner, index) => {
        const isActive = banner.id === data.activeBannerId;
        console.log(`  ${index + 1}. ${banner.name} ${isActive ? '✅ ACTIVO' : ''}`);
        console.log(`     ID: ${banner.id}`);
        console.log(`     URL: ${banner.url.substring(0, 60)}...`);
      });
    } else {
      console.log('⚠️  NO HAY BANNERS CONFIGURADOS');
      console.log('   Para que aparezca el banner cuando está cerrado, necesitas:');
      console.log('   1. Ir a Dashboard Admin → Gestión de Horarios');
      console.log('   2. Subir una imagen en "Banners de Cierre"');
      console.log('   3. Hacer click en "Marcar como activo"');
    }
    
    console.log('\n🎯 DIAGNÓSTICO:');
    console.log('========================');
    if (!data.isOpen) {
      console.log('✅ El local está CERRADO');
      if (data.activeBannerId) {
        console.log('✅ Hay un banner activo configurado');
        console.log('✅ El banner DEBERÍA mostrarse');
      } else {
        console.log('❌ NO hay banner activo configurado');
        console.log('⚠️  EL BANNER NO SE MOSTRARÁ hasta que configures uno');
      }
    } else {
      console.log('ℹ️  El local está ABIERTO');
      console.log('ℹ️  El banner solo se muestra cuando está cerrado');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkBusinessStatus();

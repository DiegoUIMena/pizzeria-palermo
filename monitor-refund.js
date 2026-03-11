const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Obtener el ID del pedido desde argumentos
const orderId = process.argv[2];

if (!orderId) {
  console.log('❌ Debes proporcionar un ID de pedido');
  console.log('   Uso: node monitor-refund.js <orderId>');
  console.log('\n📋 IDs disponibles:');
  console.log('   - 0y2VxXSdCsyWJWD2Zhhm');
  console.log('   - AutZq8E0xCPG2328UHqX');
  console.log('   - OPI9J2pRwhTsXNdjTSN6');
  console.log('   - ZkMKC2C8EfbMfN2As2DL');
  console.log('   - dMNZoIy3aGH7SEZAc6x5');
  process.exit(1);
}

console.log(`🔍 Monitoreando pedido: ${orderId}\n`);
console.log('⏳ Esperando cambios... (Presiona Ctrl+C para salir)\n');

// Listener en tiempo real
const unsubscribe = db.collection('orders').doc(orderId)
  .onSnapshot((doc) => {
    if (!doc.exists) {
      console.log('❌ El pedido no existe');
      process.exit(1);
    }
    
    const data = doc.data();
    const timestamp = new Date().toLocaleTimeString();
    
    console.log(`[${timestamp}] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📦 Pedido: ${doc.id}`);
    console.log(`   💰 Total: $${data.total}`);
    console.log(`   📊 Estado: ${data.status || 'N/A'}`);
    console.log(`   💳 Payment Status: ${data.paymentStatus}`);
    
    if (data.webpay) {
      console.log(`\n   🏦 Webpay:`);
      console.log(`      Token: ${data.webpay.token?.substring(0, 20)}...`);
      console.log(`      Status: ${data.webpay.status}`);
      console.log(`      Auth Code: ${data.webpay.authorizationCode || 'N/A'}`);
      
      if (data.webpay.refund) {
        console.log(`\n   ✅ REEMBOLSO REALIZADO:`);
        console.log(`      💵 Monto: $${data.webpay.refund.amount}`);
        console.log(`      📅 Fecha: ${data.webpay.refund.refundedAt}`);
        console.log(`      🆔 Refund Type: ${data.webpay.refund.nullifyType || 'N/A'}`);
        console.log(`      📝 Response Code: ${data.webpay.refund.responseCode || 'N/A'}`);
      } else {
        console.log(`\n   ⏳ Pendiente de reembolso`);
      }
    }
    
    // Verificar restauración de inventario
    if (data.inventoryRestored) {
      console.log(`\n   📦 INVENTARIO RESTAURADO:`);
      console.log(`      Fecha: ${data.inventoryRestoredAt || 'N/A'}`);
    }
    
    console.log('');
  }, (error) => {
    console.error('❌ Error en listener:', error);
    process.exit(1);
  });

// Mantener el proceso vivo
process.on('SIGINT', () => {
  console.log('\n\n👋 Deteniendo monitor...');
  unsubscribe();
  process.exit(0);
});

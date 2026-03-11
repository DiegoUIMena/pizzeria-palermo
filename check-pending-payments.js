const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkPendingPayments() {
  console.log('🔍 Verificando pedidos con pago pendiente...\n');
  
  try {
    const ordersSnapshot = await db.collection('orders')
      .where('paymentStatus', '==', 'pending')
      .limit(10)
      .get();
    
    if (ordersSnapshot.empty) {
      console.log('✅ No hay pedidos con pago pendiente');
      return;
    }
    
    console.log(`⚠️  Encontrados ${ordersSnapshot.size} pedido(s) con pago pendiente:\n`);
    
    ordersSnapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📦 ID: ${doc.id}`);
      console.log(`   Total: $${data.total}`);
      console.log(`   Payment Status: ${data.paymentStatus}`);
      console.log(`   Estado: ${data.estado || 'undefined'}`);
      
      if (data.webpay) {
        console.log(`\n   💳 Webpay Info:`);
        console.log(`      Token: ${data.webpay.token || 'N/A'}`);
        console.log(`      Status: ${data.webpay.status || 'N/A'}`);
        console.log(`      Response Code: ${data.webpay.responseCode || 'N/A'}`);
        console.log(`      Confirmed At: ${data.webpay.confirmedAt || 'NO CONFIRMADO'}`);
        console.log(`      Auth Code: ${data.webpay.authorizationCode || 'N/A'}`);
        
        if (data.webpay.status === 'approved' && !data.webpay.confirmedAt) {
          console.log(`\n   ⚠️  ¡PROBLEMA! El pago está approved pero NO hay confirmedAt`);
          console.log(`      Esto significa que confirmWebpayTransaction NO se ejecutó`);
        } else if (data.webpay.confirmedAt && data.paymentStatus === 'pending') {
          console.log(`\n   ⚠️  ¡PROBLEMA! Hay confirmedAt pero paymentStatus sigue pending`);
          console.log(`      Esto significa que confirmWebpayTransaction falló al actualizar`);
        } else if (!data.webpay.confirmedAt) {
          console.log(`\n   ℹ️  El usuario nunca completó el flujo de pago (no volvió de Webpay)`);
        }
      } else {
        console.log(`\n   ❌ No hay información de Webpay`);
      }
      
      console.log('');
    });
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkPendingPayments();

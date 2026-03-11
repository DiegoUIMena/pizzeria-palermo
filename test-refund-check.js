const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkPaidOrders() {
  console.log('🔍 Buscando pedidos pagados...\n');
  
  try {
    const ordersSnapshot = await db.collection('orders')
      .where('paymentStatus', '==', 'paid')
      .limit(5)
      .get();
    
    if (ordersSnapshot.empty) {
      console.log('❌ No hay pedidos con paymentStatus = "paid"');
      console.log('\n💡 Necesitas un pedido pagado para probar el reembolso.');
      console.log('   Puedes:');
      console.log('   1. Crear un pedido de prueba en la app');
      console.log('   2. Cambiar manualmente un pedido a paymentStatus: "paid" en Firestore');
      return;
    }
    
    console.log(`✅ Encontrados ${ordersSnapshot.size} pedido(s) pagado(s):\n`);
    
    ordersSnapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📦 ID: ${doc.id}`);
      console.log(`   Estado: ${data.status}`);
      console.log(`   Total: $${data.total}`);
      console.log(`   Payment Status: ${data.paymentStatus}`);
      console.log(`   Cliente: ${data.customerName || 'N/A'}`);
      console.log(`   Fecha: ${data.createdAt?.toDate?.() || 'N/A'}`);
      
      if (data.webpay) {
        console.log(`   💳 Webpay Token: ${data.webpay.token || 'N/A'}`);
        console.log(`   💳 Webpay Status: ${data.webpay.status || 'N/A'}`);
        console.log(`   💳 Auth Code: ${data.webpay.authorizationCode || 'N/A'}`);
      }
      
      // Verificar si ya fue reembolsado
      if (data.webpay?.refund) {
        console.log(`   ⚠️  YA REEMBOLSADO:`);
        console.log(`       - Monto: $${data.webpay.refund.amount}`);
        console.log(`       - Fecha: ${data.webpay.refund.refundedAt}`);
      } else {
        console.log(`   ✅ DISPONIBLE PARA REEMBOLSO`);
      }
      
      console.log('');
    });
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📝 Pasos para probar el reembolso:');
    console.log('   1. Ve a http://localhost:3000/admin/pedidos');
    console.log('   2. Busca uno de los pedidos listados arriba');
    console.log('   3. Verifica que aparezca el botón "💳 Reembolsar"');
    console.log('   4. Haz clic en el botón');
    console.log('   5. Verifica que aparezca un toast de confirmación');
    console.log('   6. El paymentStatus debe cambiar a "refunded"\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkPaidOrders();

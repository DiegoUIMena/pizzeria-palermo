const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkLastRefund() {
  console.log('\n🔍 Verificando últimos pedidos...\n');
  
  try {
    // Buscar últimos pedidos (sin orderBy para evitar problema de índices)
    const snapshot = await db.collection('orders')
      .limit(50)
      .get();
    
    if (snapshot.empty) {
      console.log('❌ No se encontraron pedidos');
      return;
    }
    
    console.log(`📋 Total pedidos encontrados: ${snapshot.size}\n`);
    
    let foundCancelled = false;
    const orders = [];
    
    snapshot.forEach((doc) => {
      const order = doc.data();
      orders.push({
        id: doc.id,
        ...order,
        createdAtDate: order.createdAt ? new Date(order.createdAt) : null
      });
    });
    
    // Ordenar por fecha manualmente
    orders.sort((a, b) => {
      if (!a.createdAtDate) return 1;
      if (!b.createdAtDate) return -1;
      return b.createdAtDate - a.createdAtDate;
    });
    
    // Mostrar TODOS los pedidos cancelados con reembolso primero
    const refundedOrders = orders.filter(o => o.estado === 'Cancelado' && o.paymentStatus === 'refunded');
    
    if (refundedOrders.length > 0) {
      console.log(`\n🎯 PEDIDOS REEMBOLSADOS (${refundedOrders.length}):\n`);
      
      refundedOrders.forEach((order) => {
        foundCancelled = true;
        
        console.log('─'.repeat(70));
        console.log(`📦 Pedido ID: ${order.id}`);
        console.log(`📞 Número: #${order.orderNumber}`);
        console.log(`📅 Creado: ${order.createdAt || 'N/A'}`);
        console.log(`📌 Estado: ${order.estado || 'N/A'}`);
        console.log(`💳 Payment Status: ${order.paymentStatus || 'N/A'}`);
        console.log(`💰 Total: $${order.total || 0}`);
        console.log('');
        
        // DATOS DEL CLIENTE
        console.log('👤 DATOS DEL CLIENTE:');
        console.log(`   - userName: ${order.userName || '❌ FALTA'}`);
        console.log(`   - userEmail: ${order.userEmail || '❌ FALTA'}`);
        console.log(`   - telefono: ${order.telefono || '❌ FALTA'}`);
        console.log('');
        
        // DATOS DE WEBPAY
        console.log('💳 DATOS WEBPAY:');
        if (order.webpay) {
          console.log(`   - token: ${order.webpay.token ? 'SÍ ✅' : '❌ NO'}`);
          console.log(`   - amount: ${order.webpay.amount || 'N/A'}`);
          
          if (order.webpay.refund) {
            console.log('');
            console.log('🔄 REEMBOLSO PROCESADO:');
            console.log(`   - refundType: ${order.webpay.refund.refundType}`);
            console.log(`   - refundedAt: ${order.webpay.refund.refundedAt}`);
            console.log(`   - refundedBy: ${order.webpay.refund.refundedBy}`);
          } else {
            console.log('');
            console.log('⚠️  NO HAY DATOS DE REEMBOLSO EN webpay.refund');
          }
        } else {
          console.log('   ❌ NO HAY DATOS DE WEBPAY');
        }
        console.log('');
      });
    }
    
    // Mostrar los últimos 5 pedidos en general
    console.log('\n📋 ÚLTIMOS 5 PEDIDOS (TODOS):\n');
    orders.slice(0, 5).forEach((order) => {
      console.log('─'.repeat(70));
      console.log(`📦 Pedido ID: ${order.id}`);
      console.log(`📞 Número: #${order.orderNumber}`);
      console.log(`📅 Creado: ${order.createdAt || 'N/A'}`);
      console.log(`📌 Estado: ${order.estado || 'N/A'}`);
      console.log(`💳 Payment Status: ${order.paymentStatus || 'N/A'}`);
      console.log(`💰 Total: $${order.total || 0}`);
      console.log('');
    });
    
    if (!foundCancelled) {
      console.log('\n⚠️  No se encontraron pedidos cancelados con reembolso en los últimos 5\n');
    }
    
    console.log('─'.repeat(70));
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkLastRefund();

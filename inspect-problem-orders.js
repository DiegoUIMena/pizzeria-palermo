const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function inspectRecentOrders() {
  console.log('\n🔍 Inspeccionando pedidos recientes...\n');
  
  try {
    const ordersSnapshot = await db.collection('orders')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();
    
    if (ordersSnapshot.empty) {
      console.log('❌ No se encontraron pedidos');
      return;
    }
    
    console.log(`📋 Total de pedidos recientes: ${ordersSnapshot.size}\n`);
    
    ordersSnapshot.forEach((doc) => {
      const order = doc.data();
      console.log('─'.repeat(60));
      console.log(`📦 Pedido ID: ${doc.id}`);
      console.log(`📞 Número: #${order.orderNumber}`);
      console.log(`📅 Creado: ${order.createdAt}`);
      console.log(`📌 Estado: ${order.estado || 'SIN ESTADO'}`);
      console.log(`💳 Payment Status: ${order.paymentStatus || 'N/A'}`);
      console.log(`📦 Inventory Processed: ${order.inventoryProcessed || false}`);
      console.log(`📦 Inventory Status: ${order.inventoryStatus || 'N/A'}`);
      console.log(`💰 Total: $${order.total}`);
      console.log(`🔑 Webpay Token: ${order.webpay?.token ? 'SÍ' : 'NO'}`);
      console.log(`👤 User ID: ${order.userId || 'N/A'}`);
      
      // Mostrar estructura completa de campos problemáticos
      console.log('\n📊 Estructura del objeto:');
      console.log('  - items:', Array.isArray(order.items) ? `Array[${order.items.length}]` : typeof order.items);
      console.log('  - webpay:', typeof order.webpay);
      console.log('  - timestamps:', typeof order.timestamps);
      
      if (order.webpay) {
        console.log('    - webpay.token:', order.webpay.token ? 'EXISTS' : 'MISSING');
        console.log('    - webpay.amount:', order.webpay.amount || 'MISSING');
      }
      
      if (!order.estado) {
        console.log('\n⚠️  ADVERTENCIA: Pedido sin campo "estado"');
      }
      
      console.log('');
    });
    
    console.log('─'.repeat(60));
    
  } catch (error) {
    console.error('❌ Error al inspeccionar pedidos:', error);
  } finally {
    process.exit(0);
  }
}

inspectRecentOrders();

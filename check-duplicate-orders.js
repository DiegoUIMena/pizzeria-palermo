const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkDuplicateOrders() {
  console.log('🔍 Verificando pedidos duplicados o con problemas...\n');
  
  try {
    // Buscar pedidos por número de orden
    const orderNumbers = [7100, 49172];
    
    for (const orderNum of orderNumbers) {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📦 Buscando orden #${orderNum}...\n`);
      
      const snapshot = await db.collection('orders')
        .where('orderNumber', '==', orderNum)
        .get();
      
      if (snapshot.empty) {
        console.log(`   ❌ No se encontró ningún pedido con número ${orderNum}`);
        continue;
      }
      
      console.log(`   ✅ Encontrados ${snapshot.size} pedido(s) con número ${orderNum}\n`);
      
      snapshot.forEach((doc, index) => {
        const data = doc.data();
        console.log(`   Pedido #${index + 1}:`);
        console.log(`      ID Firestore: ${doc.id}`);
        console.log(`      Estado: ${data.estado || 'undefined'}`);
        console.log(`      Payment Status: ${data.paymentStatus || 'undefined'}`);
        console.log(`      Created: ${data.timestamps?.created || 'N/A'}`);
        console.log(`      Total: $${data.total?.toLocaleString()}`);
        console.log(`      Tipo Entrega: ${data.tipoEntrega || 'N/A'}`);
        
        if (data.estado === 'Cancelado') {
          console.log(`      ⚠️  Este pedido está CANCELADO`);
        }
        
        if (data.paymentStatus === 'refunded') {
          console.log(`      💸 Este pedido fue REEMBOLSADO`);
        }
        
        console.log('');
      });
      
      if (snapshot.size > 1) {
        console.log(`   ⚠️  ¡ADVERTENCIA! Hay ${snapshot.size} pedidos con el mismo número de orden ${orderNum}`);
        console.log(`      Esto podría causar confusión en el panel de admin.\n`);
      }
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📊 Resumen de pedidos activos:\n');
    
    // Verificar pedidos en estado "Pendiente"
    const pendingOrders = await db.collection('orders')
      .where('estado', '==', 'Pendiente')
      .get();
    
    console.log(`   Pedidos Pendientes: ${pendingOrders.size}`);
    
    pendingOrders.forEach(doc => {
      const data = doc.data();
      console.log(`      - Orden #${data.orderNumber} (ID: ${doc.id.substring(0, 8)}...)`);
    });
    
    console.log('');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkDuplicateOrders();

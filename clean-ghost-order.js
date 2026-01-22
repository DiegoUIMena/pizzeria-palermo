// Script para eliminar pedidos con timestamps incorrectos (pedidos fantasma)
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function cleanGhostOrders() {
  try {
    console.log('🔍 Buscando pedidos con timestamps incorrectos...\n');
    
    const ordersRef = db.collection('orders');
    const snapshot = await ordersRef.get();
    
    let ghostOrders = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      
      // Verificar si timestamps.created es un Timestamp en lugar de string
      if (data.timestamps && data.timestamps.created) {
        const createdValue = data.timestamps.created;
        
        // Si es un Timestamp de Firestore (tiene _seconds) o no es un string
        if (typeof createdValue !== 'string') {
          ghostOrders.push({
            id: doc.id,
            orderNumber: data.orderNumber,
            estado: data.estado,
            fechaCreacion: data.fechaCreacion,
            timestampType: typeof createdValue
          });
        }
      }
    });
    
    if (ghostOrders.length === 0) {
      console.log('✅ No se encontraron pedidos fantasma.');
      return;
    }
    
    console.log(`⚠️  Encontrados ${ghostOrders.length} pedido(s) fantasma:\n`);
    
    ghostOrders.forEach((order, index) => {
      console.log(`${index + 1}. Pedido #${order.orderNumber || 'N/A'}`);
      console.log(`   ID: ${order.id}`);
      console.log(`   Estado: ${order.estado}`);
      console.log(`   Fecha: ${order.fechaCreacion}`);
      console.log(`   Tipo timestamp: ${order.timestampType}\n`);
    });
    
    console.log('🗑️  Eliminando pedidos fantasma...\n');
    
    for (const order of ghostOrders) {
      await db.collection('orders').doc(order.id).delete();
      console.log(`✅ Eliminado: Pedido #${order.orderNumber || order.id}`);
    }
    
    console.log(`\n✨ Se eliminaron ${ghostOrders.length} pedido(s) fantasma correctamente.`);
    console.log('🔕 Las alarmas para estos pedidos ya no sonarán.\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

cleanGhostOrders();

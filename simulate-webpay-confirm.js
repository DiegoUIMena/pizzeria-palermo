const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Si ya está inicializado, no inicializar de nuevo
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Obtener el ID del pedido desde argumentos
const orderId = process.argv[2];

if (!orderId) {
  console.log('❌ Debes proporcionar un ID de pedido');
  console.log('   Uso: node simulate-webpay-confirm.js <orderId>');
  console.log('\n📋 IDs disponibles de pedidos pending:');
  console.log('   - 1qqGqEQqDRQcPZmkiD5G');
  console.log('   - 2djXNwBymBtaWSZ1MEiq');
  console.log('   - 2ozJL5tle0V9v2hCcr9Y');
  console.log('   - A5XBQfsshEPTRc94S31L');
  process.exit(1);
}

async function simulateWebpayConfirm() {
  console.log(`🔧 Simulando confirmación de Webpay para pedido: ${orderId}\n`);
  
  try {
    const orderRef = db.collection('orders').doc(orderId);
    const orderDoc = await orderRef.get();
    
    if (!orderDoc.exists) {
      console.log('❌ El pedido no existe');
      process.exit(1);
    }
    
    const orderData = orderDoc.data();
    
    console.log('📦 Estado actual del pedido:');
    console.log(`   Total: $${orderData.total}`);
    console.log(`   Payment Status: ${orderData.paymentStatus}`);
    console.log(`   Estado: ${orderData.estado || 'undefined'}`);
    console.log(`   Webpay Token: ${orderData.webpay?.token}`);
    console.log(`   Webpay Status: ${orderData.webpay?.status}`);
    console.log('');
    
    if (orderData.paymentStatus === 'paid') {
      console.log('✅ Este pedido ya está confirmado como pagado');
      console.log('   No es necesario simularlo. Puedes probar el reembolso directamente.');
      process.exit(0);
    }
    
    console.log('⚠️  NOTA: En producción, esto se haría a través de confirmWebpayTransaction');
    console.log('          que verifica el pago real con Transbank.\n');
    console.log('          Esta es una simulación SOLO para pruebas de desarrollo.\n');
    
    // Simular datos de confirmación exitosa
    const now = new Date();
    const simulatedAuthCode = Math.floor(1000 + Math.random() * 9000); // Código aleatorio 1000-9999
    
    const updateData = {
      paymentStatus: 'paid',
      'timestamps.paid': now.toISOString(),
      estado: 'Pendiente',
      inventoryProcessed: true,
      inventoryStatus: 'processed',
      'webpay.confirmedAt': now.toISOString(),
      'webpay.status': 'approved',
      'webpay.responseCode': 0, // 0 = transacción aprobada
      'webpay.authorizationCode': simulatedAuthCode.toString(),
      'webpay.amount': orderData.total,
      'webpay.transactionDate': now.toISOString(),
    };
    
    console.log('💾 Actualizando pedido con datos simulados de confirmación...\n');
    
    await orderRef.update(updateData);
    
    console.log('✅ PEDIDO ACTUALIZADO A PAGADO\n');
    console.log('📊 Nuevos valores:');
    console.log(`   Payment Status: paid`);
    console.log(`   Estado: Pendiente`);
    console.log(`   Authorization Code: ${simulatedAuthCode}`);
    console.log(`   Confirmed At: ${now.toISOString()}`);
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🎯 AHORA PUEDES PROBAR EL REEMBOLSO:');
    console.log(`   1. Ve a http://localhost:3000/admin/pedidos`);
    console.log(`   2. Selecciona filtro "Todos"`);
    console.log(`   3. Busca el pedido ID: ${orderId.substring(0, 8)}...`);
    console.log(`   4. Verifica que aparezca el botón "💳 Reembolsar"`);
    console.log(`   5. Haz clic en el botón para probar el reembolso\n`);
    
    console.log('⚠️  IMPORTANTE: El inventario NO se consumió automáticamente');
    console.log('   porque esto es una simulación. En producción, confirmWebpayTransaction');
    console.log('   consume el inventario automáticamente al confirmar el pago.\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

simulateWebpayConfirm();

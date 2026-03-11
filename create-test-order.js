const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Si ya está inicializado, no inicializar de nuevo
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function createFreshTestOrder() {
  console.log('🔧 Creando pedido de prueba NUEVO (con fecha actual)...\n');
  
  try {
    const now = new Date();
    
    // Generar número de orden único
    const orderNumber = Math.floor(1000 + Math.random() * 9000);
    
    // Crear pedido simulado
    const newOrder = {
      orderNumber: orderNumber,
      total: 15900,
      paymentMethod: 'webpay',
      paymentStatus: 'paid', // Simulado como pagado
      estado: 'Pendiente',
      tipoEntrega: 'Retiro en local',
      timestamps: {
        created: now.toISOString(),
        paid: now.toISOString(),
      },
      inventoryProcessed: true,
      inventoryStatus: 'processed',
      webpay: {
        token: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        status: 'approved',
        responseCode: 0,
        authorizationCode: Math.floor(1000 + Math.random() * 9000).toString(),
        amount: 15900,
        confirmedAt: now.toISOString(),
        transactionDate: now.toISOString(),
        cardDetail: {
          card_number: '6623'
        }
      },
      items: [
        {
          id: 'pizza-margherita-familiar',
          nombre: 'Pizza Margherita',
          size: 'Familiar',
          precio: 15900,
          quantity: 1,
          tipo: 'pizza',
          recipe: {
            masa: 1,
            salsa_tomate: 1,
            queso_mozzarella: 1,
            albahaca: 1
          }
        }
      ],
      cliente: {
        nombre: 'Usuario de Prueba Reembolso',
        telefono: '+56912345678',
        email: 'test@reembolso.com'
      }
    };
    
    // Crear el pedido en Firestore
    const orderRef = await db.collection('orders').add(newOrder);
    const orderId = orderRef.id;
    
    console.log('✅ PEDIDO DE PRUEBA CREADO EXITOSAMENTE\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📦 ID del Pedido: ${orderId}`);
    console.log(`🔢 Número de Orden: ${orderNumber}`);
    console.log(`💰 Total: $${newOrder.total.toLocaleString()}`);
    console.log(`💳 Payment Status: ${newOrder.paymentStatus}`);
    console.log(`📊 Estado: ${newOrder.estado}`);
    console.log(`🔑 Auth Code: ${newOrder.webpay.authorizationCode}`);
    console.log(`📅 Fecha: ${now.toISOString()}`);
    console.log(`🎫 Token: ${newOrder.webpay.token}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('⚠️  IMPORTANTE:');
    console.log('   Este es un pedido SIMULADO con fecha actual.');
    console.log('   El token NO es real de Transbank, por lo que el reembolso');
    console.log('   FALLARÁ con el mismo error de validación.\n');
    
    console.log('💡 SOLUCIONES:');
    console.log('   1. Para probar reembolsos REALES:');
    console.log('      - Haz un pago completo en modo desarrollo de Transbank');
    console.log('      - Completa el flujo hasta /pago/webpay-return');
    console.log('      - Eso generará un token real que SÍ se puede reembolsar\n');
    
    console.log('   2. Para probar la LÓGICA de reembolso (sin Transbank):');
    console.log('      - Modifica refundWebpayTransaction para modo desarrollo');
    console.log('      - Simula respuestas exitosas sin llamar a Transbank real\n');
    
    console.log('   3. Para ver el botón de reembolso:');
    console.log(`      - Ve a http://localhost:3000/admin/pedidos`);
    console.log(`      - Selecciona filtro "Todos"`);
    console.log(`      - Busca el pedido ${orderId.substring(0, 8)}...`);
    console.log(`      - El botón "💳 Reembolsar" debería aparecer\n`);
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🔧 RECOMENDACIÓN PARA DESARROLLO:');
    console.log('   Agregar un modo "SKIP_TRANSBANK_VALIDATION" que:');
    console.log('   - Detecte tokens de prueba (prefijo "test_")');
    console.log('   - Simule respuestas exitosas de reembolso');
    console.log('   - Permita probar la lógica sin llamar a Transbank\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

createFreshTestOrder();

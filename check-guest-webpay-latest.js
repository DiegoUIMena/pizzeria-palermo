const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkGuestWebpayLatest() {
  console.log('🔎 Revisando ultimos pedidos guest con Webpay...\n');

  try {
    const snapshot = await db.collection('orders')
      .where('customerType', '==', 'guest')
      .limit(50)
      .get();

    if (snapshot.empty) {
      console.log('ℹ️ No se encontraron pedidos guest con Webpay.');
      return;
    }

    const rows = [];
    snapshot.forEach((doc) => {
      const data = doc.data() || {};
      if (data.metodoPago !== 'Webpay Plus') return;
      rows.push({ id: doc.id, data });
    });

    rows.sort((a, b) => {
      const aTs = new Date(a.data.timestamps?.created || 0).getTime();
      const bTs = new Date(b.data.timestamps?.created || 0).getTime();
      return bTs - aTs;
    });

    if (rows.length === 0) {
      console.log('ℹ️ No se encontraron pedidos guest con Webpay.');
      return;
    }

    rows.slice(0, 5).forEach((row) => {
      const data = row.data;
      const created = data.timestamps?.created || 'N/A';
      const paid = data.timestamps?.paid || 'N/A';
      const confirmedAt = data.webpay?.confirmedAt || 'NO';

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📦 Order ID: ${row.id}`);
      console.log(`🔢 Order Number: ${data.orderNumber || 'N/A'}`);
      console.log(`📅 Created: ${created}`);
      console.log(`💳 Metodo: ${data.metodoPago || 'N/A'}`);
      console.log(`👤 CustomerType: ${data.customerType || 'N/A'}`);
      console.log(`💰 Total: $${(data.total || 0).toLocaleString('es-CL')}`);
      console.log(`📊 Estado: ${data.estado || 'N/A'}`);
      console.log(`💵 Payment Status: ${data.paymentStatus || 'N/A'}`);
      console.log(`✅ Webpay Confirmed At: ${confirmedAt}`);
      console.log(`🕒 Paid Timestamp: ${paid}`);
      console.log(`🔐 Guest Token Expira: ${data.guestCheckout?.webpayTokenExpiresAt || 'N/A'}`);
      console.log(`🧪 Guest Init Attempts: ${data.guestCheckout?.webpayInitAttempts ?? 'N/A'}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    });
  } catch (error) {
    console.error('❌ Error revisando pedidos guest webpay:', error.message);
  } finally {
    process.exit(0);
  }
}

checkGuestWebpayLatest();

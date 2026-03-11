const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function checkLastCanceled() {
  try {
    console.log("🔍 Buscando últimos pedidos cancelados...\n");

    const snapshot = await db
      .collection("orders")
      .limit(50)
      .get();

    if (snapshot.empty) {
      console.log("❌ No se encontraron pedidos");
      return;
    }

    const orders = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      orders.push({
        id: doc.id,
        orderNumber: data.orderNumber,
        estado: data.estado,
        createdAt: data.createdAt,
        createdAtDate: data.createdAt?.toDate ? data.createdAt.toDate() : null,
        cliente: data.cliente,
        webpay: data.webpay,
      });
    });

    // Ordenar por fecha (más reciente primero)
    orders.sort((a, b) => {
      if (!a.createdAtDate || !b.createdAtDate) return 0;
      return b.createdAtDate - a.createdAtDate;
    });

    // Filtrar cancelados
    const cancelados = orders.filter(
      (o) => o.estado === "Cancelado" && o.webpay?.refund
    );

    console.log(`📦 Total pedidos: ${orders.length}`);
    console.log(`❌ Pedidos cancelados con reembolso: ${cancelados.length}\n`);

    if (cancelados.length > 0) {
      console.log("=".repeat(80));
      console.log("ÚLTIMO PEDIDO CANCELADO CON REEMBOLSO:");
      console.log("=".repeat(80));

      const ultimo = cancelados[0];

      console.log(`\n📋 ID: ${ultimo.id}`);
      console.log(`📦 Pedido #${ultimo.orderNumber}`);
      console.log(`📅 Fecha: ${ultimo.createdAtDate?.toISOString()}`);
      console.log(`🔄 Estado: ${ultimo.estado}`);

      console.log("\n👤 DATOS DEL CLIENTE:");
      console.log(`   Nombre: ${ultimo.cliente?.nombre || "❌ FALTA"}`);
      console.log(`   Email: ${ultimo.cliente?.email || "❌ FALTA"}`);
      console.log(`   Teléfono: ${ultimo.cliente?.telefono || "❌ FALTA"}`);

      if (ultimo.cliente?.telefono) {
        const telefono = ultimo.cliente.telefono;
        console.log("\n📱 ANÁLISIS DEL TELÉFONO:");
        console.log(`   Valor original: "${telefono}"`);
        console.log(`   Longitud: ${telefono.length}`);
        console.log(`   Empieza con +: ${telefono.startsWith("+")}`);
        console.log(`   Solo dígitos: ${/^\d+$/.test(telefono)}`);
        console.log(`   Con formato +56: ${telefono.startsWith("+56")}`);

        // Simular cleanPhoneNumber
        let cleaned = telefono.replace(/[^\d+]/g, "");
        if (cleaned.startsWith("56") && !cleaned.startsWith("+")) {
          cleaned = "+" + cleaned;
        }
        if (cleaned.startsWith("9") && cleaned.length === 9) {
          cleaned = "+56" + cleaned;
        }

        console.log(`\n   📞 Después de cleanPhoneNumber: "${cleaned}"`);
        console.log(`   Longitud final: ${cleaned.length}`);
        console.log(
          `   Válido para WhatsApp: ${
            cleaned.startsWith("+") && cleaned.length >= 11 && cleaned.length <= 15
              ? "✅ SÍ"
              : "❌ NO"
          }`
        );
      }

      console.log("\n💳 DATOS DEL REEMBOLSO:");
      console.log(`   Fecha: ${ultimo.webpay.refund?.refundedAt}`);
      console.log(`   Tipo: ${ultimo.webpay.refund?.refundType}`);
      console.log(`   Monto: $${ultimo.webpay.refund?.amount?.toLocaleString("es-CL") || "N/A"}`);

      console.log("\n" + "=".repeat(80));
    } else {
      console.log("ℹ️  No hay pedidos cancelados con reembolso recientes");
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

checkLastCanceled();

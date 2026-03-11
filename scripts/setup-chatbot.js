/**
 * Script para inicializar el chatbot con intents por defecto
 * Ejecutar: node scripts/setup-chatbot.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

// Inicializar Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const TENANT_ID = 'pizzeria-palermo-17f6d'; // Cambiar por tu tenant ID real

const defaultIntents = [
  {
    intent: 'saludo',
    priority: 1,
    keywords: ['hola', 'buenos dias', 'buenas tardes', 'buenas noches', 'saludos', 'hey', 'ola'],
    responses: [
      '¡Hola! 👋 Bienvenido a Pizzería Palermo. ¿En qué puedo ayudarte?',
      '¡Hola! 🍕 ¿Qué se te antoja hoy?',
      '¡Bienvenido! ¿Quieres ver nuestro menú o tienes alguna pregunta?'
    ]
  },
  {
    intent: 'horario',
    priority: 2,
    keywords: ['horario', 'hora', 'cuando', 'abren', 'cierran', 'abierto', 'horarios'],
    responses: [
      'Estamos abiertos de **Lunes a Domingo de 12:00 a 23:00**. ¡Te esperamos! 🕐',
      'Nuestro horario es de **12:00 a 23:00 todos los días**. ¿Quieres hacer un pedido?'
    ],
    followUpKeywords: ['hoy', 'domingo', 'festivo', 'feriado'],
    followUpResponses: [
      'Sí, estamos abiertos hoy de 12:00 a 23:00. ¡Ven a visitarnos!'
    ]
  },
  {
    intent: 'delivery',
    priority: 3,
    keywords: ['delivery', 'envio', 'reparto', 'domicilio', 'entregan', 'envian'],
    responses: [
      'Sí, hacemos delivery 🚚. El costo del envío es de **$2.000** dentro del radio de cobertura.',
      '¡Claro! Entregamos a domicilio por **$2,000**. ¿Quieres ver las zonas de cobertura?'
    ],
    followUpKeywords: ['cuanto', 'precio', 'costo', 'valor', 'gratis', 'zonas', 'donde'],
    followUpResponses: [
      'El delivery cuesta **$2,000** dentro de nuestro radio de cobertura. Puedes verificar tu zona en el mapa de nuestro sitio.'
    ]
  },
  {
    intent: 'metodos_pago',
    priority: 4,
    keywords: ['pago', 'pagar', 'metodo', 'forma', 'efectivo', 'tarjeta', 'transferencia', 'webpay'],
    responses: [
      'Aceptamos **Webpay (débito y crédito)** y **efectivo** 💳💵',
      'Puedes pagar con tarjeta (Webpay) o en efectivo cuando llegue tu pedido.'
    ],
    followUpKeywords: ['online', 'linea', 'web', 'internet'],
    followUpResponses: [
      'Sí, puedes pagar online con Webpay al hacer tu pedido en nuestro sitio web. ¡Es 100% seguro! 🔒'
    ]
  },
  {
    intent: 'menu',
    priority: 5,
    keywords: ['menu', 'carta', 'pizzas', 'productos', 'sabores', 'tipos', 'variedad'],
    responses: [
      'Tenemos una gran variedad de pizzas 🍕: clásicas, gourmet, vegetarianas y más. Puedes ver todo nuestro menú en la página principal.',
      '¡Nuestro menú tiene muchas opciones deliciosas! Visita la sección "Menú" para ver todas nuestras pizzas y promociones.'
    ],
    followUpKeywords: ['precio', 'cuanto', 'cuesta', 'valor', 'precios'],
    followUpResponses: [
      'Los precios varían según el tamaño y los ingredientes. Puedes ver todos los detalles en nuestro menú online. ¿Te ayudo con algo más?'
    ]
  },
  {
    intent: 'tamanos',
    priority: 6,
    keywords: ['tamano', 'tamaño', 'grande', 'mediana', 'personal', 'familiar', 'tamanos'],
    responses: [
      'Tenemos tres tamaños: **Personal** (25cm), **Mediana** (30cm) y **Familiar** (35cm) 📏🍕'
    ],
    followUpKeywords: ['personas', 'cuantas', 'alcanza', 'porciones'],
    followUpResponses: [
      'La **Personal** es para 1-2 personas, la **Mediana** para 2-3 personas, y la **Familiar** para 3-4 personas.'
    ]
  },
  {
    intent: 'promociones',
    priority: 7,
    keywords: ['promocion', 'oferta', 'descuento', 'promo', 'deal', 'especial', 'ofertas'],
    responses: [
      '¡Tenemos promociones especiales! Revisa la sección de promociones en nuestro menú para ver las ofertas vigentes 🎉',
      'Visita nuestro menú para ver todas las promociones del día. ¡Siempre tenemos algo especial para ti!'
    ]
  },
  {
    intent: 'ubicacion',
    priority: 8,
    keywords: ['ubicacion', 'direccion', 'donde', 'quedan', 'encuentran', 'local', 'ubicados'],
    responses: [
      'Estamos ubicados en Los Andes, Chile. Puedes ver nuestra dirección exacta y mapa en la sección "Contacto" 📍'
    ]
  },
  {
    intent: 'pedido',
    priority: 9,
    keywords: ['pedir', 'orden', 'ordenar', 'comprar', 'quiero', 'pedido'],
    responses: [
      '¡Perfecto! Para hacer tu pedido, ve a la sección "Menú", selecciona tus pizzas favoritas y sigue el proceso de compra. ¿Necesitas ayuda con algo específico?',
      'Puedes hacer tu pedido directamente en nuestro sitio web. Es fácil y rápido: Menú → Elegir pizzas → Pagar. ¿Te ayudo en algo más?'
    ]
  },
  {
    intent: 'despedida',
    priority: 10,
    keywords: ['gracias', 'chao', 'adios', 'bye', 'hasta luego', 'nos vemos'],
    responses: [
      '¡Gracias por contactarnos! Que disfrutes tu pizza 🍕😊',
      '¡Hasta pronto! Esperamos verte de nuevo. ¡Buen provecho! 👋',
      '¡Gracias por escribir! Si necesitas algo más, no dudes en preguntar. ¡Que tengas un excelente día!'
    ]
  }
];

async function setupChatbot() {
  console.log('🤖 Inicializando chatbot para tenant:', TENANT_ID);
  console.log('');

  try {
    // 1. Verificar/crear documento del tenant
    const tenantRef = db.collection('tenants').doc(TENANT_ID);
    const tenantDoc = await tenantRef.get();

    if (!tenantDoc.exists) {
      console.log('⚠️  Tenant no existe, creándolo...');
      await tenantRef.set({
        name: 'Pizzería Palermo',
        chatbotEnabled: true,
        chatbotConfig: {
          fallbackMessage: 'Lo siento, no entendí tu pregunta. ¿Podrías reformularla o preguntar algo sobre nuestro horario, delivery, menú o métodos de pago?',
          maxSessionIdleMinutes: 5
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('✅ Tenant creado');
    } else {
      console.log('✅ Tenant existe, actualizando configuración del chatbot...');
      await tenantRef.update({
        chatbotEnabled: true,
        'chatbotConfig.fallbackMessage': 'Lo siento, no entendí tu pregunta. ¿Podrías reformularla o preguntar algo sobre nuestro horario, delivery, menú o métodos de pago?',
        'chatbotConfig.maxSessionIdleMinutes': 5
      });
    }

    console.log('');

    // 2. Crear intents
    console.log('📝 Creando intents por defecto...');
    const intentsRef = tenantRef.collection('chatbot_intents');

    for (const intent of defaultIntents) {
      // Verificar si ya existe
      const existingIntents = await intentsRef
        .where('intent', '==', intent.intent)
        .get();

      if (!existingIntents.empty) {
        console.log(`   ↪ "${intent.intent}" ya existe, saltando...`);
        continue;
      }

      // Crear nuevo intent
      await intentsRef.add({
        ...intent,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`   ✅ "${intent.intent}" creado`);
    }

    console.log('');

    // 3. Inicializar métricas
    console.log('📊 Inicializando métricas...');
    const metricsRef = tenantRef.collection('chatbot_metrics').doc('general');
    const metricsDoc = await metricsRef.get();

    if (!metricsDoc.exists) {
      await metricsRef.set({
        totalMessages: 0,
        totalSessions: 0,
        intentCounters: {},
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('✅ Métricas inicializadas');
    } else {
      console.log('↪ Métricas ya existen');
    }

    console.log('');
    console.log('🎉 ¡Chatbot configurado exitosamente!');
    console.log('');
    console.log('Próximos pasos:');
    console.log('1. Despliega las Cloud Functions: firebase deploy --only functions');
    console.log('2. Actualiza las reglas de Firestore para permitir acceso al chatbot');
    console.log('3. Accede al panel admin en /admin/chatbot para gestionar intents');
    console.log('4. Prueba el chatbot en tu sitio web');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

setupChatbot();

/**
 * Script para poblar la configuración de precios en Firebase
 * Los precios se almacenan como fuente única de verdad
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function poblarPreciosConfiguracion() {
  try {
    console.log('🚀 Iniciando población de precios en Firebase...\n');

    // Configuración de precios actualizada (valores correctos del frontend)
    const preciosConfiguracion = {
      pizzaSizes: {
        mediana: {
          id: 'mediana',
          name: 'Mediana',
          simpleBasePrice: 8000,
          premiumBasePrice: 8000,
          simpleExtraPrice: 700,      // ✅ Valor correcto
          premiumExtraPrice: 2500,    // ✅ Valor correcto
          description: 'Perfecta para 1-2 personas'
        },
        familiar: {
          id: 'familiar',
          name: 'Familiar',
          simpleBasePrice: 10000,
          premiumBasePrice: 10000,
          simpleExtraPrice: 1000,     // ✅ Valor correcto
          premiumExtraPrice: 3500,    // ✅ Valor correcto
          description: 'Ideal para 3-4 personas'
        }
      },
      extras: {
        ajo: 700,
        chimichurri: 700,
        pesto: 1000,
        'coca cola lata': 1500,
        'coca cola 1.5l': 2900,
        'rollitos de canela': 4900,
        gauchitos: 4000
      },
      lastUpdated: new Date().toISOString(),
      version: '1.0.0'
    };

    // Guardar en Firestore
    await db.collection('settings').doc('precios_configuracion').set(preciosConfiguracion);

    console.log('✅ Configuración de precios guardada exitosamente en Firebase\n');
    console.log('📊 Detalles de los precios configurados:');
    console.log('');
    console.log('🍕 TAMAÑO MEDIANA:');
    console.log(`   - Base Simple: $${preciosConfiguracion.pizzaSizes.mediana.simpleBasePrice.toLocaleString()}`);
    console.log(`   - Base Premium: $${preciosConfiguracion.pizzaSizes.mediana.premiumBasePrice.toLocaleString()}`);
    console.log(`   - Extra Simple: $${preciosConfiguracion.pizzaSizes.mediana.simpleExtraPrice.toLocaleString()}`);
    console.log(`   - Extra Premium: $${preciosConfiguracion.pizzaSizes.mediana.premiumExtraPrice.toLocaleString()}`);
    console.log('');
    console.log('🍕 TAMAÑO FAMILIAR:');
    console.log(`   - Base Simple: $${preciosConfiguracion.pizzaSizes.familiar.simpleBasePrice.toLocaleString()}`);
    console.log(`   - Base Premium: $${preciosConfiguracion.pizzaSizes.familiar.premiumBasePrice.toLocaleString()}`);
    console.log(`   - Extra Simple: $${preciosConfiguracion.pizzaSizes.familiar.simpleExtraPrice.toLocaleString()}`);
    console.log(`   - Extra Premium: $${preciosConfiguracion.pizzaSizes.familiar.premiumExtraPrice.toLocaleString()}`);
    console.log('');
    console.log('✨ Los precios están ahora disponibles en Firestore en:');
    console.log('   settings/precios_configuracion\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error al poblar precios:', error);
    process.exit(1);
  }
}

poblarPreciosConfiguracion();

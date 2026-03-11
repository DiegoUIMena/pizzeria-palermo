const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Inicializar Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkMissingRecipes() {
  try {
    console.log('🔍 Verificando recetas de pizzas...\n');
    
    const snapshot = await db.collection('items_menu').get();
    
    if (snapshot.empty) {
      console.log('❌ No se encontraron pizzas en la colección items_menu');
      return;
    }
    
    console.log(`📊 Total de items en menú: ${snapshot.size}\n`);
    console.log('=' .repeat(100));
    
    // Categorías que necesitan recetas (pizzas)
    const categoriasConReceta = [
      'Pizzas Palermo',
      'Pizzas Tradicionales', 
      'Pizzas Vegetarianas',
      'Pizzas con Carne',
      'Pizzas del Mar'
    ];
    
    // Pizzas especiales que solo tienen tamaño familiar
    const soloFamiliar = ['4 Estaciones', 'Sevillana', 'Entre Ríos'];
    
    let totalPizzas = 0;
    let pizzasConRecetaCompleta = 0;
    let pizzasSoloFamiliar = 0;
    let pizzasSinReceta = 0;
    let pizzasSinRecetaMediana = 0;
    
    const pizzasSinRecetaList = [];
    const pizzasSinRecetaMedianaList = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const categoria = data.categoria || '';
      
      // Solo verificar pizzas
      if (!categoriasConReceta.includes(categoria)) {
        return;
      }
      
      totalPizzas++;
      const nombre = data.nombre || 'Sin nombre';
      const esSoloFamiliar = soloFamiliar.includes(nombre);
      
      const tieneRecetaFamiliar = data.receta && Array.isArray(data.receta) && data.receta.length > 0;
      const tieneRecetaMediana = data.recetaMediana && Array.isArray(data.recetaMediana) && data.recetaMediana.length > 0;
      
      console.log(`\n📋 ${nombre}`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   Categoría: ${categoria}`);
      
      if (esSoloFamiliar) {
        pizzasSoloFamiliar++;
        if (tieneRecetaFamiliar) {
          console.log(`   ✅ Receta Familiar: ${data.receta.length} ingredientes`);
          console.log(`   ℹ️  Solo tamaño Familiar (no requiere receta mediana)`);
          pizzasConRecetaCompleta++;
        } else {
          console.log(`   ❌ SIN RECETA FAMILIAR`);
          console.log(`   ⚠️  PIZZA NO VENDIBLE - Agregar receta en panel de Inventario`);
          pizzasSinReceta++;
          pizzasSinRecetaList.push(nombre);
        }
      } else {
        // Pizzas normales (familiar y mediana)
        if (tieneRecetaFamiliar && tieneRecetaMediana) {
          console.log(`   ✅ Receta Familiar: ${data.receta.length} ingredientes`);
          console.log(`   ✅ Receta Mediana: ${data.recetaMediana.length} ingredientes`);
          pizzasConRecetaCompleta++;
        } else if (tieneRecetaFamiliar && !tieneRecetaMediana) {
          console.log(`   ✅ Receta Familiar: ${data.receta.length} ingredientes`);
          console.log(`   ❌ SIN RECETA MEDIANA`);
          console.log(`   ⚠️  Tamaño MEDIANA no vendible - Agregar receta en panel de Inventario`);
          pizzasSinRecetaMediana++;
          pizzasSinRecetaMedianaList.push(nombre);
        } else if (!tieneRecetaFamiliar && tieneRecetaMediana) {
          console.log(`   ❌ SIN RECETA FAMILIAR`);
          console.log(`   ✅ Receta Mediana: ${data.recetaMediana.length} ingredientes`);
          console.log(`   ⚠️  Tamaño FAMILIAR no vendible - Agregar receta en panel de Inventario`);
          pizzasSinReceta++;
          pizzasSinRecetaList.push(nombre);
        } else {
          console.log(`   ❌ SIN RECETA FAMILIAR`);
          console.log(`   ❌ SIN RECETA MEDIANA`);
          console.log(`   ⚠️  PIZZA NO VENDIBLE - Agregar recetas en panel de Inventario`);
          pizzasSinReceta++;
          pizzasSinRecetaList.push(nombre);
        }
      }
      
      console.log('-'.repeat(100));
    });
    
    console.log('\n' + '='.repeat(100));
    console.log('📈 RESUMEN:');
    console.log('='.repeat(100));
    console.log(`\n🍕 TOTAL DE PIZZAS: ${totalPizzas}`);
    console.log(`   ├─ Pizzas solo familiar: ${pizzasSoloFamiliar}`);
    console.log(`   └─ Pizzas familiares + medianas: ${totalPizzas - pizzasSoloFamiliar}`);
    
    console.log(`\n✅ PIZZAS CON RECETAS COMPLETAS: ${pizzasConRecetaCompleta}`);
    console.log(`❌ PIZZAS SIN RECETA (NO VENDIBLES): ${pizzasSinReceta}`);
    console.log(`⚠️  PIZZAS SIN RECETA MEDIANA (solo familiar vendible): ${pizzasSinRecetaMediana}`);
    
    if (pizzasSinReceta > 0) {
      console.log('\n' + '⚠️'.repeat(50));
      console.log('❌ PIZZAS QUE NECESITAN RECETAS (NO VENDIBLES):');
      console.log('⚠️'.repeat(50));
      pizzasSinRecetaList.forEach((nombre, i) => {
        console.log(`   ${i + 1}. ${nombre}`);
      });
      console.log('\n📝 ACCIÓN REQUERIDA: Editar recetas en Panel Admin → Inventario → Recetas de Pizzas');
    }
    
    if (pizzasSinRecetaMediana > 0) {
      console.log('\n' + '⚠️'.repeat(50));
      console.log('⚠️  PIZZAS QUE NECESITAN RECETA MEDIANA:');
      console.log('⚠️'.repeat(50));
      pizzasSinRecetaMedianaList.forEach((nombre, i) => {
        console.log(`   ${i + 1}. ${nombre} (tamaño mediana no vendible)`);
      });
      console.log('\n📝 ACCIÓN REQUERIDA: Editar recetas en Panel Admin → Inventario → Recetas de Pizzas');
    }
    
    if (pizzasSinReceta === 0 && pizzasSinRecetaMediana === 0) {
      console.log('\n' + '✅'.repeat(50));
      console.log('✅ TODAS LAS PIZZAS TIENEN RECETAS COMPLETAS');
      console.log('✅'.repeat(50));
    }
    
    console.log('\n' + '='.repeat(100));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkMissingRecipes();

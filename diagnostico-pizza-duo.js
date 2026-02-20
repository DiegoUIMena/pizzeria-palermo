/**
 * Script de Diagnóstico para Pizza Dúo
 * 
 * Este script prueba el descuento de stock para una Pizza Dúo
 * y verifica que se descuente correctamente el 50% de cada variedad.
 * 
 * Uso: node diagnostico-pizza-duo.js
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc, runTransaction, Timestamp } = require('firebase/firestore');

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyD1EJn1LCbQKJuZHpGxPGl7m1ZWJ5xE8aE",
  authDomain: "pizzeria-palermo-41e19.firebaseapp.com",
  projectId: "pizzeria-palermo-41e19",
  storageBucket: "pizzeria-palermo-41e19.firebasestorage.app",
  messagingSenderId: "764026276488",
  appId: "1:764026276488:web:f4cba50f0e62fb0e6b0b33"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log('🔍 DIAGNÓSTICO DE PIZZA DÚO\n');
console.log('=' .repeat(80));

// Función para obtener stock actual de un ingrediente
async function getIngredientStock(ingredientId) {
  const docRef = doc(db, 'ingredientes', ingredientId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    return {
      id: ingredientId,
      nombre: data.nombre,
      stockActual: data.stockActual,
      unidad: data.unidad
    };
  }
  return null;
}

// Función para obtener receta de una pizza
async function getPizzaRecipe(pizzaName, size = 'familiar') {
  const itemsMenuSnap = await getDocs(collection(db, 'items_menu'));
  let pizzaDoc = null;
  
  itemsMenuSnap.forEach(doc => {
    const data = doc.data();
    const nombre = (data.nombre || data.name || '').toLowerCase().trim();
    if (nombre.includes(pizzaName.toLowerCase())) {
      pizzaDoc = { id: doc.id, ...data };
    }
  });
  
  if (!pizzaDoc) {
    return null;
  }
  
  const receta = size === 'mediana' && pizzaDoc.recetaMediana 
    ? pizzaDoc.recetaMediana 
    : pizzaDoc.receta;
  
  return {
    nombre: pizzaDoc.nombre || pizzaDoc.name,
    receta: receta || []
  };
}

// Función para obtener stocks de una receta completa
async function getRecipeStocks(recipe) {
  const stocks = [];
  for (const line of recipe) {
    const stock = await getIngredientStock(line.ingredienteId);
    if (stock) {
      stocks.push({
        ...stock,
        cantidadReceta: line.cantidad,
        unidadReceta: line.unidad
      });
    }
  }
  return stocks;
}

// Función principal de diagnóstico
async function diagnosticoPizzaDuo(pizza1Name, pizza2Name, size = 'familiar') {
  console.log(`\n📋 CONFIGURACIÓN DE PRUEBA:`);
  console.log(`   Pizza 1: ${pizza1Name}`);
  console.log(`   Pizza 2: ${pizza2Name}`);
  console.log(`   Tamaño: ${size}`);
  console.log('\n' + '-'.repeat(80));
  
  // 1. Obtener recetas
  console.log('\n🔎 PASO 1: Obteniendo recetas de ambas pizzas...\n');
  
  const receta1 = await getPizzaRecipe(pizza1Name, size);
  const receta2 = await getPizzaRecipe(pizza2Name, size);
  
  if (!receta1) {
    console.error(`❌ ERROR: No se encontró la pizza "${pizza1Name}"`);
    return;
  }
  if (!receta2) {
    console.error(`❌ ERROR: No se encontró la pizza "${pizza2Name}"`);
    return;
  }
  
  console.log(`✅ Pizza 1 encontrada: "${receta1.nombre}"`);
  console.log(`   - Ingredientes en receta: ${receta1.receta.length}`);
  console.log(`✅ Pizza 2 encontrada: "${receta2.nombre}"`);
  console.log(`   - Ingredientes en receta: ${receta2.receta.length}`);
  
  // 2. Obtener stock ANTES
  console.log('\n📊 PASO 2: Capturando stock ANTES del pedido...\n');
  
  const stocksAntes1 = await getRecipeStocks(receta1.receta);
  const stocksAntes2 = await getRecipeStocks(receta2.receta);
  
  // Crear mapa de ingredientes únicos
  const ingredientesUnicos = new Map();
  
  stocksAntes1.forEach(ing => {
    ingredientesUnicos.set(ing.id, {
      nombre: ing.nombre,
      stockAntes: ing.stockActual,
      unidad: ing.unidad,
      cantidadPizza1: ing.cantidadReceta,
      cantidadPizza2: 0,
      enAmbas: false
    });
  });
  
  stocksAntes2.forEach(ing => {
    if (ingredientesUnicos.has(ing.id)) {
      // Ingrediente común a ambas pizzas
      const existing = ingredientesUnicos.get(ing.id);
      existing.cantidadPizza2 = ing.cantidadReceta;
      existing.enAmbas = true;
    } else {
      // Ingrediente solo en pizza 2
      ingredientesUnicos.set(ing.id, {
        nombre: ing.nombre,
        stockAntes: ing.stockActual,
        unidad: ing.unidad,
        cantidadPizza1: 0,
        cantidadPizza2: ing.cantidadReceta,
        enAmbas: false
      });
    }
  });
  
  console.log(`Total de ingredientes únicos: ${ingredientesUnicos.size}`);
  console.log(`   - Solo en Pizza 1: ${Array.from(ingredientesUnicos.values()).filter(i => i.cantidadPizza1 > 0 && i.cantidadPizza2 === 0).length}`);
  console.log(`   - Solo en Pizza 2: ${Array.from(ingredientesUnicos.values()).filter(i => i.cantidadPizza1 === 0 && i.cantidadPizza2 > 0).length}`);
  console.log(`   - Comunes a ambas: ${Array.from(ingredientesUnicos.values()).filter(i => i.enAmbas).length}`);
  
  // 3. Crear pedido de prueba
  console.log('\n🛒 PASO 3: Creando pedido de prueba (Pizza Dúo)...\n');
  
  const orderItems = [{
    nombre: `Pizza Dúo (${pizza1Name} / ${pizza2Name})`,
    cantidad: 1,
    precio: 15000,
    size: size,
    pizzaType: 'duo',
    pizza1: pizza1Name,
    pizza2: pizza2Name
  }];
  
  console.log('📦 Estructura del pedido:');
  console.log(JSON.stringify(orderItems[0], null, 2));
  
  console.log('\n⚙️ PASO 4: Procesando descuento de inventario (simulación)...\n');
  
  // Nota: Como no podemos importar el módulo TypeScript directamente,
  // este script solo muestra el análisis ANTES del pedido.
  // Para ver el descuento real, debes hacer un pedido desde la aplicación web.
  
  console.log('⚠️ IMPORTANTE: Este script muestra el análisis previo.');
  console.log('   Para probar el descuento real, realiza un pedido desde la app web.');
  console.log('   Luego ejecuta este script nuevamente para ver los stocks después.');
  
  console.log('\n' + '='.repeat(80));
  console.log('\n🎯 ANÁLISIS DE CONSUMO ESPERADO:\n');
  
  let totalIngredientes = 0;
  let ingredientesComunes = 0;
  let soloEnPizza1 = 0;
  let soloEnPizza2 = 0;
  
  for (const [id, ing] of ingredientesUnicos) {
    totalIngredientes++;
    
    // Calcular consumo esperado
    let consumoEsperado;
    let tipo;
    
    if (ing.enAmbas) {
      // Ingrediente común: 50% de cada pizza (suma)
      consumoEsperado = (ing.cantidadPizza1 / 2) + (ing.cantidadPizza2 / 2);
      tipo = 'COMÚN';
      ingredientesComunes++;
    } else if (ing.cantidadPizza1 > 0) {
      // Solo en pizza 1: 50%
      consumoEsperado = ing.cantidadPizza1 / 2;
      tipo = 'SOLO PIZZA 1';
      soloEnPizza1++;
    } else {
      // Solo en pizza 2: 50%
      consumoEsperado = ing.cantidadPizza2 / 2;
      tipo = 'SOLO PIZZA 2';
      soloEnPizza2++;
    }
    
    // Redondear a 2 decimales
    consumoEsperado = Math.round(consumoEsperado * 100) / 100;
    
    console.log(`\n📌 ${ing.nombre} [${tipo}]`);
    console.log(`   Stock actual:        ${ing.stockAntes} ${ing.unidad}`);
    console.log(`   Consumo esperado:    ${consumoEsperado} ${ing.unidad}`);
    console.log(`   Stock después:       ${(ing.stockAntes - consumoEsperado).toFixed(2)} ${ing.unidad}`);
    
    if (ing.enAmbas) {
      console.log(`   Cálculo: (${ing.cantidadPizza1}/2) + (${ing.cantidadPizza2}/2) = ${consumoEsperado}`);
    } else if (ing.cantidadPizza1 > 0) {
      console.log(`   Cálculo: ${ing.cantidadPizza1}/2 = ${consumoEsperado}`);
    } else {
      console.log(`   Cálculo: ${ing.cantidadPizza2}/2 = ${consumoEsperado}`);
    }
  }
  
  // Resumen final
  console.log('\n' + '='.repeat(80));
  console.log('\n🎯 RESUMEN DE ANÁLISIS:\n');
  
  console.log(`📊 Estadísticas:`);
  console.log(`   - Total ingredientes únicos: ${totalIngredientes}`);
  console.log(`   - Ingredientes comunes (ambas pizzas): ${ingredientesComunes}`);
  console.log(`   - Solo en ${pizza1Name}: ${soloEnPizza1}`);
  console.log(`   - Solo en ${pizza2Name}: ${soloEnPizza2}`);
  
  console.log(`\n✅ COMPORTAMIENTO ESPERADO:`);
  console.log(`   - Ingredientes comunes: Se descuenta 50% de cada pizza (suman cantidades)`);
  console.log(`   - Ingredientes únicos: Se descuenta solo el 50% de esa pizza`);
  console.log(`   - NO se descuenta el 100% de ninguna pizza completa`);
  
  console.log('\n' + '='.repeat(80));
  console.log('\n💡 RECOMENDACIÓN:');
  console.log('   1. Anota los valores de "Stock actual" mostrados arriba');
  console.log('   2. Realiza un pedido de Pizza Dúo desde la aplicación web');
  console.log('   3. Ejecuta este script nuevamente para comparar');
  console.log('   4. Verifica que los stocks disminuyeron en las cantidades esperadas');
  console.log('\n' + '='.repeat(80));
}

// Ejecutar diagnóstico
(async () => {
  try {
    // Ejemplo específico: Pizza Dúo Familiar - Bariloche / Napolitana
    await diagnosticoPizzaDuo('Bariloche', 'Napolitana', 'familiar');
  } catch (error) {
    console.error('\n❌ ERROR FATAL:', error);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
})();

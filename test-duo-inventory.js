// Script para probar la actualización de inventario con Pizzas Duo
import { db } from './lib/firebase.js';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { consumeRecipeForOrder } from './lib/recipes.js';

// Simular una orden con una pizza Duo
const simulateOrder = async () => {
  try {
    console.log('🔍 Iniciando prueba de actualización de inventario para Pizza Duo');
    
    // Obtener datos iniciales de ingredientes para mostrar antes y después
    const ingredientesSnap = await getDocs(collection(db, 'ingredientes'));
    const ingredientes = {};
    ingredientesSnap.forEach(d => {
      const data = d.data();
      ingredientes[d.id] = {
        id: d.id,
        nombre: data.nombre,
        cantidad: data.cantidad,
        unidad: data.unidad || 'u'
      };
    });
    
    // Obtener menú para buscar pizzas
    const itemsMenuSnap = await getDocs(collection(db, 'items_menu'));
    const itemsMenu = [];
    itemsMenuSnap.forEach(d => itemsMenu.push({ id: d.id, ...(d.data() || {}) }));
    
    // Pizzas para la prueba - ajusta estos nombres según las pizzas en tu menú
    const pizza1Name = 'Napolitana';
    const pizza2Name = 'Del Pibe';
    
    console.log(`🍕 Probando con Pizza Duo: ${pizza1Name} / ${pizza2Name}`);
    
    // Crear objeto de orden simulada
    const orderItem = {
      nombre: `Pizza Duo (${pizza1Name} / ${pizza2Name})`,
      cantidad: 1,
      pizzaType: 'duo',
      pizza1: pizza1Name,
      pizza2: pizza2Name,
      size: 'familiar'
    };
    
    // Mostrar algunos ingredientes clave antes de la actualización
    console.log('\n📊 Estado INICIAL de algunos ingredientes:');
    
    // Ingredientes comunes (probablemente presentes en ambas pizzas)
    const keyIngredients = ['Queso Mozzarella', 'Masa', 'Salsa de Tomate'];
    
    // Ingredientes específicos de cada pizza
    const pizza1Ingredients = ['Tomate', 'Ajo', 'Aceitunas']; // Ingredientes típicos de Napolitana
    const pizza2Ingredients = ['Jamón', 'Huevo', 'Choclo']; // Ingredientes típicos de Del Pibe
    
    const allIngredientsToCheck = [...keyIngredients, ...pizza1Ingredients, ...pizza2Ingredients];
    
    // Buscar y mostrar estos ingredientes
    for (const ingredientName of allIngredientsToCheck) {
      const ingredient = Object.values(ingredientes).find(i => 
        i.nombre && i.nombre.toLowerCase().includes(ingredientName.toLowerCase())
      );
      
      if (ingredient) {
        console.log(`${ingredient.nombre}: ${ingredient.cantidad} ${ingredient.unidad}`);
      }
    }
    
    // Ejecutar la función de consumo del inventario
    console.log('\n🔄 Ejecutando consumeRecipeForOrder...');
    const result = await consumeRecipeForOrder([orderItem], true); // El true es para modo simulación
    
    console.log(`✅ Resultado: ${result.success ? 'ÉXITO' : 'ERROR'}`);
    
    // Si hay un resultado detallado de ingredientes consumidos, mostrarlo
    if (result.consumedItems && result.consumedItems.length > 0) {
      console.log('\n📝 Detalle de ingredientes que se consumirían:');
      result.consumedItems.forEach(item => {
        console.log(`- ${item.nombre}: ${item.cantidadConsumida} ${item.unidad} (Quedará: ${item.cantidadNueva} ${item.unidad})`);
      });
    }
    
    // Mensaje de conclusión
    if (result.success) {
      console.log('\n✅ PRUEBA EXITOSA: La actualización de inventario para Pizza Duo funciona correctamente');
    } else {
      console.log('\n❌ PRUEBA FALLIDA: ', result.error || 'Error desconocido');
      
      if (result.insufficientItems) {
        console.log('\nIngredientes insuficientes:');
        result.insufficientItems.forEach(item => {
          console.log(`- ${item.item}:`);
          item.missing.forEach(m => {
            console.log(`  * ${m.ingrediente}: Necesita ${m.needed}, Disponible ${m.available} ${m.unidad}`);
          });
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error al ejecutar la prueba:', error);
  }
};

// Ejecutar la prueba
simulateOrder();
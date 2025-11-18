// Script para verificar la consistencia entre las implementaciones de combineRecipes
const { combineRecipes: combineRecipesFromRecipes } = require('./lib/recipes');
const { combineRecipes: combineRecipesFromInventory } = require('./lib/inventory-service');

function verifyConsistency() {
  // Crear datos de prueba
  const recipe1 = [
    { ingredienteId: 'jamon', cantidad: 100, unidad: 'g' },   // ya dividido a la mitad
    { ingredienteId: 'aceituna', cantidad: 75, unidad: 'g' }, // ya dividido a la mitad
    { ingredienteId: 'tomate', cantidad: 150, unidad: 'g' }   // ya dividido a la mitad
  ];
  
  const recipe2 = [
    { ingredienteId: 'jamon', cantidad: 200, unidad: 'g' },       // ya dividido a la mitad
    { ingredienteId: 'queso', cantidad: 50, unidad: 'g' },        // ya dividido a la mitad
    { ingredienteId: 'salsaTomate', cantidad: 0.1, unidad: 'l' }  // ya dividido a la mitad
  ];
  
  console.log('Datos de prueba:');
  console.log('Recipe 1 (ya dividida a la mitad):');
  recipe1.forEach(ing => console.log(`  - ${ing.ingredienteId}: ${ing.cantidad} ${ing.unidad}`));
  
  console.log('\nRecipe 2 (ya dividida a la mitad):');
  recipe2.forEach(ing => console.log(`  - ${ing.ingredienteId}: ${ing.cantidad} ${ing.unidad}`));
  
  console.log('\nResultado esperado:');
  console.log('  - jamon: 300 g (suma de ambos, ya que es común)');
  console.log('  - aceituna: 75 g (único de recipe1)');
  console.log('  - tomate: 150 g (único de recipe1)');
  console.log('  - queso: 50 g (único de recipe2)');
  console.log('  - salsaTomate: 0.1 l (único de recipe2)');
  
  try {
    // Ejecutar combineRecipes de recipes.ts
    console.log('\n--- Resultado de recipes.ts:combineRecipes ---');
    const result1 = combineRecipesFromRecipes(recipe1, recipe2);
    console.log('Ingredientes combinados:');
    result1.forEach(ing => console.log(`  - ${ing.ingredienteId}: ${ing.cantidad} ${ing.unidad || 'u'}`));
    
    // Ejecutar combineRecipes de inventory-service.ts
    console.log('\n--- Resultado de inventory-service.ts:combineRecipes ---');
    const result2 = combineRecipesFromInventory(recipe1, recipe2);
    console.log('Ingredientes combinados:');
    result2.forEach(ing => console.log(`  - ${ing.ingredienteId}: ${ing.cantidad} ${ing.unidad || 'u'}`));
    
    // Verificar si las implementaciones son consistentes
    const areConsistent = JSON.stringify(result1) === JSON.stringify(result2);
    console.log(`\nImplementaciones consistentes: ${areConsistent ? 'SÍ' : 'NO'}`);
    
    // VERIFICAR EL RESULTADO DEL JAMÓN (ingrediente común)
    const jamon1 = result1.find(ing => ing.ingredienteId === 'jamon');
    const jamon2 = result2.find(ing => ing.ingredienteId === 'jamon');
    
    console.log('\nAnálisis del ingrediente común (jamón):');
    console.log(`  - Entrada recipe1: 100g`);
    console.log(`  - Entrada recipe2: 200g`);
    console.log(`  - Salida recipes.ts: ${jamon1 ? jamon1.cantidad : 'no encontrado'} ${jamon1 ? jamon1.unidad : ''}`);
    console.log(`  - Salida inventory-service.ts: ${jamon2 ? jamon2.cantidad : 'no encontrado'} ${jamon2 ? jamon2.unidad : ''}`);
    console.log(`  - ¿Es correcto?: ${jamon1 && jamon1.cantidad === 300 ? 'SÍ' : 'NO'}`);
    
  } catch (error) {
    console.error('Error al verificar consistencia:', error);
  }
}

verifyConsistency();
// Script para probar manualmente la combinación de recetas

// Función para combinar recetas exactamente como en recipes.ts e inventory-service.ts
function combineRecipes(recipe1, recipe2) {
  // Inicializar estructuras para rastrear ingredientes
  const result = [];
  const ingredientMap = {};
  
  // Contadores para debugging
  let uniqueIngredients1 = 0;
  let uniqueIngredients2 = 0;
  let commonIngredients = 0;
  let incompatibleUnits = 0;
  
  // Verificar que las recetas no sean nulas
  if (!recipe1) recipe1 = [];
  if (!recipe2) recipe2 = [];
  
  // Paso 1: Registrar todos los ingredientes de la primera receta
  recipe1.forEach(line => {
    if (!line || !line.ingredienteId) return; // Saltamos ingredientes inválidos
    
    ingredientMap[line.ingredienteId] = {
      ingredienteId: line.ingredienteId,
      cantidad1: line.cantidad || 0,
      unidad: line.unidad || 'u',
      isCommon: false // Inicialmente asumimos que no es común
    };
  });
  
  // Paso 2: Procesar segunda receta y marcar ingredientes comunes
  recipe2.forEach(line => {
    if (!line || !line.ingredienteId) return; // Saltamos ingredientes inválidos
    
    if (ingredientMap[line.ingredienteId]) {
      // Es un ingrediente común
      const existingIngredient = ingredientMap[line.ingredienteId];
      
      // Verificar compatibilidad de unidades
      if (existingIngredient.unidad === (line.unidad || 'u')) {
        existingIngredient.cantidad2 = line.cantidad || 0;
        existingIngredient.isCommon = true;
        commonIngredients++;
      } else {
        // Unidades incompatibles - crear entrada separada con sufijo único
        const uniqueSuffix = `_${Date.now()}_${Math.floor(Math.random()*1000)}`;
        ingredientMap[line.ingredienteId + uniqueSuffix] = {
          ingredienteId: line.ingredienteId,
          cantidad2: line.cantidad || 0,
          unidad: line.unidad || 'u',
          isCommon: false
        };
        incompatibleUnits++;
      }
    } else {
      // Es un ingrediente único de la segunda receta
      ingredientMap[line.ingredienteId] = {
        ingredienteId: line.ingredienteId,
        cantidad2: line.cantidad || 0,
        unidad: line.unidad || 'u',
        isCommon: false
      };
    }
  });
  
  // Paso 3: Procesar cada ingrediente según la lógica requerida
  Object.values(ingredientMap).forEach(item => {
    let finalAmount = 0;
    
    if (item.isCommon) {
      // Para ingredientes comunes: sumar cantidades directamente
      // No dividimos entre 2 porque las recetas ya vienen con las cantidades divididas
      const total = (item.cantidad1 || 0) + (item.cantidad2 || 0);
      finalAmount = total;
      console.log(`Ingrediente común: ${item.ingredienteId} - Cant1: ${item.cantidad1}, Cant2: ${item.cantidad2}, Total: ${finalAmount}`);
    } else if (item.cantidad1 !== undefined) {
      // Ingrediente único de la receta 1: mantener el valor (ya viene dividido)
      finalAmount = item.cantidad1;
      uniqueIngredients1++;
      console.log(`Ingrediente único (receta1): ${item.ingredienteId} - Cantidad: ${finalAmount}`);
    } else if (item.cantidad2 !== undefined) {
      // Ingrediente único de la receta 2: mantener el valor (ya viene dividido)
      finalAmount = item.cantidad2;
      uniqueIngredients2++;
      console.log(`Ingrediente único (receta2): ${item.ingredienteId} - Cantidad: ${finalAmount}`);
    }
    
    // Redondear a 2 decimales para evitar errores de punto flotante
    finalAmount = Math.round(finalAmount * 100) / 100;
    
    if (finalAmount > 0) {
      result.push({
        ingredienteId: item.ingredienteId,
        cantidad: finalAmount,
        unidad: item.unidad
      });
    }
  });
  
  // Log detallado para debugging
  console.log(`Combinación de recetas DUO (nueva lógica):
    - Ingredientes únicos de receta 1: ${uniqueIngredients1}
    - Ingredientes únicos de receta 2: ${uniqueIngredients2}
    - Ingredientes comunes (en ambas recetas): ${commonIngredients}
    - Ingredientes con unidades incompatibles: ${incompatibleUnits}
    - Total de ingredientes combinados: ${result.length}
  `);
  
  return result;
}

// Función principal para probar la combinación de recetas
function testCombineRecipes() {
  console.log("=== TEST DE COMBINACIÓN DE RECETAS ===");

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
  
  console.log('\nDatos de prueba:');
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
  
  // Ejecutar la combinación
  console.log('\n=== EJECUTANDO COMBINACIÓN ===');
  const result = combineRecipes(recipe1, recipe2);
  
  // Mostrar el resultado
  console.log('\nResultado final:');
  result.forEach(ing => console.log(`  - ${ing.ingredienteId}: ${ing.cantidad} ${ing.unidad}`));
  
  // Verificar específicamente el jamón
  const jamon = result.find(ing => ing.ingredienteId === 'jamon');
  if (jamon) {
    console.log(`\nVerificación del jamón: ${jamon.cantidad} ${jamon.unidad}`);
    console.log(`¿Es correcto? ${jamon.cantidad === 300 ? 'SÍ' : 'NO'}`);
  }
}

// Ejecutar el test
testCombineRecipes();
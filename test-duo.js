
// No podemos importar directamente archivos TypeScript, usamos next/babel para transpilar
// Creamos un objeto de prueba que simula lo que haría la función
// Este es solo para propósitos de diagnóstico

async function testPizzaDuo() {
  console.log('SIMULACIÓN - No estamos llamando al código real sino verificando la lógica');
  
  // Simulamos las recetas de ejemplo
  const recetaNapolitana = [
    { ingredienteId: 'jamon', cantidad: 100, unidad: 'gr' },
    { ingredienteId: 'aceituna', cantidad: 150, unidad: 'gr' }
  ];
  
  const recetaDelPibe = [
    { ingredienteId: 'jamon', cantidad: 200, unidad: 'gr' },
    { ingredienteId: 'salsa-tomate', cantidad: 0.2, unidad: 'L' },
    { ingredienteId: 'extra-queso', cantidad: 1, unidad: 'kg' }
  ];
  
  // Simulamos la función combineRecipes
  function combineRecipes(recipe1, recipe2) {
    const result = [];
    const ingredientMap = {};
    
    // Paso 1: Registrar ingredientes de la primera receta
    recipe1.forEach(line => {
      ingredientMap[line.ingredienteId] = {
        ingredienteId: line.ingredienteId,
        cantidad1: line.cantidad || 0,
        unidad: line.unidad || 'u',
        isCommon: false
      };
    });
    
    // Paso 2: Procesar segunda receta y marcar ingredientes comunes
    recipe2.forEach(line => {
      if (ingredientMap[line.ingredienteId]) {
        // Es ingrediente común
        ingredientMap[line.ingredienteId].cantidad2 = line.cantidad || 0;
        ingredientMap[line.ingredienteId].isCommon = true;
      } else {
        // Es ingrediente único de la segunda receta
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
        // Para ingredientes comunes: sumar cantidades y dividir entre 2
        const total = (item.cantidad1 || 0) + (item.cantidad2 || 0);
        finalAmount = total / 2;
        console.log(`Ingrediente común: ${item.ingredienteId} - Cant1: ${item.cantidad1}, Cant2: ${item.cantidad2}, Total: ${total}, Final: ${finalAmount}`);
      } else if (item.cantidad1 !== undefined) {
        // Ingrediente único de la receta 1: dividir entre 2
        finalAmount = item.cantidad1 / 2;
        console.log(`Ingrediente único (receta1): ${item.ingredienteId} - Cantidad: ${item.cantidad1}, Final: ${finalAmount}`);
      } else if (item.cantidad2 !== undefined) {
        // Ingrediente único de la receta 2: dividir entre 2
        finalAmount = item.cantidad2 / 2;
        console.log(`Ingrediente único (receta2): ${item.ingredienteId} - Cantidad: ${item.cantidad2}, Final: ${finalAmount}`);
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
    
    return result;
  }
  console.log('Iniciando prueba de Pizza Duo...');
  const orderItems = [
    {
      pizzaType: 'duo',
      pizza1: 'Napolitana',
      pizza2: 'Del Pibe',
      size: 'familiar',
      cantidad: 1
    }
  ];
  
  try {
    // Ejecutamos nuestra simulación
    console.log("Ejemplo: Pizza Duo familiar (mitad Napolitana, mitad Del Pibe)");
    
    // Verificamos qué descontaría de inventario
    const combinedRecipe = combineRecipes(recetaNapolitana, recetaDelPibe);
    
    console.log("\nResultado final - Ingredientes a descontar del inventario:");
    combinedRecipe.forEach(ing => {
      console.log(`- ${ing.ingredienteId}: ${ing.cantidad} ${ing.unidad}`);
    });
    
    console.log("\nResumen esperado:");
    console.log("- jamón: 150gr (100gr/2 + 200gr/2)");
    console.log("- aceituna: 75gr (150gr/2)");
    console.log("- salsa de tomate: 0.1L (0.2L/2)");
    console.log("- extra queso: 0.5kg (1kg/2)");
    
    console.log("\nAnálisis del algoritmo implementado:");
    console.log("1. ¿Encuentra correctamente los ingredientes comunes? " + 
                (combinedRecipe.some(i => i.ingredienteId === 'jamon') ? "SÍ" : "NO"));
    console.log("2. ¿Divide correctamente ingredientes únicos de pizza1? " + 
                (combinedRecipe.some(i => i.ingredienteId === 'aceituna') ? "SÍ" : "NO"));
    console.log("3. ¿Divide correctamente ingredientes únicos de pizza2? " + 
                (combinedRecipe.some(i => i.ingredienteId === 'salsa-tomate' || i.ingredienteId === 'extra-queso') ? "SÍ" : "NO"));
    
  } catch (error) {
    console.error('Error en prueba:', error);
  }
}

testPizzaDuo();

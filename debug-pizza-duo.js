// Script para depurar el comportamiento de pizzas Duo
const { db } = require('./lib/firebase');
const { collection, getDocs, doc, getDoc } = require('firebase/firestore');

// Función para normalizar textos para búsqueda
const norm = (s) => s ? s.toLowerCase().replace(/[^a-z0-9ñáéíóúü ]+/gi, '').trim() : '';

// Función que simula la lógica de combinar recetas
function combineRecipes(recipe1, recipe2) {
  // Inicializar estructuras para rastrear ingredientes
  const result = [];
  const ingredientMap = {};
  
  console.log("--- Receta 1 ---");
  console.log(JSON.stringify(recipe1, null, 2));
  console.log("--- Receta 2 ---");
  console.log(JSON.stringify(recipe2, null, 2));
  
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
      } else {
        // Unidades incompatibles - crear entrada separada con sufijo único
        const uniqueSuffix = `_${Date.now()}_${Math.floor(Math.random()*1000)}`;
        ingredientMap[line.ingredienteId + uniqueSuffix] = {
          ingredienteId: line.ingredienteId,
          cantidad2: line.cantidad || 0,
          unidad: line.unidad || 'u',
          isCommon: false
        };
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

// Función principal para pruebas
async function debugPizzaDuo() {
  try {
    console.log("Iniciando depuración de Pizza Duo...");
    
    // Cargamos los datos necesarios de Firestore
    console.log("Cargando datos de Firestore...");
    const itemsMenuSnap = await getDocs(collection(db, 'items_menu'));
    const itemsMenuDocs = [];
    itemsMenuSnap.forEach(d => itemsMenuDocs.push({ id: d.id, ...(d.data() || {}) }));
    
    console.log(`Se encontraron ${itemsMenuDocs.length} items en el menú`);
    
    // Buscamos las pizzas Napolitana y Del Pibe
    const pizza1Name = "Napolitana";
    const pizza2Name = "Del Pibe";
    
    // Función mejorada para buscar pizzas en el menú
    const findPizzaInMenu = (pizzaName) => {
      // 0. Limpieza adicional para palabras clave específicas
      const cleanName = pizzaName
        .replace(/\s+pizza\s+/gi, ' ')  // Eliminar "pizza" como palabra separada
        .replace(/\b(mediana|familiar)\b/gi, '') // Eliminar tamaños de la búsqueda
        .trim();
      
      console.log(`Búsqueda de pizza: "${pizzaName}" (limpiado: "${cleanName}")`);
      
      // 1. Búsqueda exacta
      let match = itemsMenuDocs.find(i => norm(i.nombre || i.name || '') === norm(cleanName));
      if (match) console.log(`Encontrada por coincidencia exacta: ${match.nombre || match.name}`);
      
      // 2. Búsqueda por palabras clave significativas
      if (!match) {
        // Extraer palabras clave significativas (ignorar artículos, etc.)
        const keywords = cleanName.split(' ').filter(word => 
          word.length > 2 && !['con', 'los', 'las', 'del', 'de', 'la', 'el', 'y'].includes(word)
        );
        
        if (keywords.length > 0) {
          console.log(`Buscando por palabras clave: ${keywords.join(', ')}`);
          match = itemsMenuDocs.find(i => {
            const menuItemName = norm(i.nombre || i.name || '');
            // Una pizza coincide si todas sus palabras clave están en el nombre del menú
            return keywords.every(word => menuItemName.includes(word));
          });
          if (match) console.log(`Encontrada por palabras clave: ${match.nombre || match.name}`);
        }
      }
      
      // 3. Búsqueda por coincidencia parcial de nombres
      if (!match) {
        match = itemsMenuDocs.find(i => {
          const menuItemName = norm(i.nombre || i.name || '');
          return menuItemName.includes(norm(cleanName)) || norm(cleanName).includes(menuItemName);
        });
        if (match) console.log(`Encontrada por coincidencia parcial: ${match.nombre || match.name}`);
      }
      
      // 4. Búsqueda por primeras palabras
      if (!match) {
        const firstTwoWords = cleanName.split(' ').slice(0,2).join(' ');
        if (firstTwoWords.length > 3) { // Solo si son palabras significativas
          match = itemsMenuDocs.find(i => norm(i.nombre || i.name || '').includes(firstTwoWords));
          if (match) console.log(`Encontrada por primeras palabras: ${match.nombre || match.name}`);
        }
      }
      
      // 5. Búsqueda en todo el menú si todo lo anterior falló
      if (!match) {
        console.log("No se encontró la pizza. Mostrando nombres disponibles en el menú:");
        itemsMenuDocs.forEach((item, idx) => {
          if (idx < 15) { // Mostrar solo primeros 15 para no saturar
            console.log(`- ${item.nombre || item.name || "Sin nombre"}`);
          }
        });
      }
      
      return match;
    };
    
    // Buscar las pizzas
    const matchedPizza1 = findPizzaInMenu(pizza1Name);
    const matchedPizza2 = findPizzaInMenu(pizza2Name);
    
    // Preparar para recolectar recetas
    let recipe1 = [];
    let recipe2 = [];
    
    // Procesar pizza1 si se encontró
    if (matchedPizza1) {
      // Determinar qué receta usar según el tamaño
      const size = 'familiar';
      let recetaBase = null;
      
      // Seleccionar la receta adecuada según el tamaño
      if (matchedPizza1.receta && Array.isArray(matchedPizza1.receta) && matchedPizza1.receta.length > 0) {
        recetaBase = matchedPizza1.receta;
        console.log(`Pizza 1 (${pizza1Name}): Usando receta FAMILIAR con ${recetaBase.length} ingredientes`);
      } else if (matchedPizza1.recetaMediana && Array.isArray(matchedPizza1.recetaMediana) && matchedPizza1.recetaMediana.length > 0) {
        recetaBase = matchedPizza1.recetaMediana;
        console.log(`Pizza 1 (${pizza1Name}): Usando receta MEDIANA con ${recetaBase.length} ingredientes`);
      }
      
      if (recetaBase && recetaBase.length > 0) {
        recipe1 = recetaBase.map((r) => {
          if (!r.ingredienteId) {
            console.error(`Pizza 1: Ingrediente sin ID en receta de ${pizza1Name}`);
            return null;
          }
          
          const originalCantidad = Number(r.cantidad) || 0;
          const halfCantidad = Math.round((originalCantidad / 2) * 100) / 100;
          
          return { 
            ingredienteId: r.ingredienteId, 
            cantidad: halfCantidad,
            unidad: r.unidad 
          };
        }).filter(Boolean);
        
        console.log(`Pizza 1 (${pizza1Name}): Preparada mitad de receta con ${recipe1.length} ingredientes`);
      } else {
        console.log(`No se encontró receta válida para la pizza 1: ${pizza1Name}`);
      }
    } else {
      console.log(`No se encontró la pizza 1 en el menú: ${pizza1Name}`);
    }
    
    // Procesar pizza2 si se encontró
    if (matchedPizza2) {
      // Determinar qué receta usar según el tamaño
      const size = 'familiar';
      let recetaBase = null;
      
      // Seleccionar la receta adecuada según el tamaño
      if (matchedPizza2.receta && Array.isArray(matchedPizza2.receta) && matchedPizza2.receta.length > 0) {
        recetaBase = matchedPizza2.receta;
        console.log(`Pizza 2 (${pizza2Name}): Usando receta FAMILIAR con ${recetaBase.length} ingredientes`);
      } else if (matchedPizza2.recetaMediana && Array.isArray(matchedPizza2.recetaMediana) && matchedPizza2.recetaMediana.length > 0) {
        recetaBase = matchedPizza2.recetaMediana;
        console.log(`Pizza 2 (${pizza2Name}): Usando receta MEDIANA con ${recetaBase.length} ingredientes`);
      }
      
      if (recetaBase && recetaBase.length > 0) {
        recipe2 = recetaBase.map((r) => {
          if (!r.ingredienteId) {
            console.error(`Pizza 2: Ingrediente sin ID en receta de ${pizza2Name}`);
            return null;
          }
          
          const originalCantidad = Number(r.cantidad) || 0;
          const halfCantidad = Math.round((originalCantidad / 2) * 100) / 100;
          
          return { 
            ingredienteId: r.ingredienteId, 
            cantidad: halfCantidad,
            unidad: r.unidad 
          };
        }).filter(Boolean);
        
        console.log(`Pizza 2 (${pizza2Name}): Preparada mitad de receta con ${recipe2.length} ingredientes`);
      } else {
        console.log(`No se encontró receta válida para la pizza 2: ${pizza2Name}`);
      }
    } else {
      console.log(`No se encontró la pizza 2 en el menú: ${pizza2Name}`);
    }
    
    // Combinar las recetas de ambas mitades y procesar
    if (recipe1.length > 0 || recipe2.length > 0) {
      // Combinar ambas recetas, sumando cantidades para ingredientes comunes
      const combinedRecipe = combineRecipes(recipe1, recipe2);
      console.log(`Pizza Duo: Combinando recetas de ambas mitades - Total ${combinedRecipe.length} ingredientes`);
      
      // Mostrar resultados finales
      console.log("\n--- RESULTADO FINAL: INGREDIENTES A DESCONTAR ---");
      combinedRecipe.forEach(ing => {
        console.log(`- ${ing.ingredienteId}: ${ing.cantidad} ${ing.unidad || 'u'}`);
      });
    } else {
      console.log(`No se encontraron recetas para ninguna de las mitades de la pizza Duo`);
    }

  } catch (error) {
    console.error("Error en la depuración:", error);
  }
}

// Ejecutar la función principal
debugPizzaDuo().catch(console.error).finally(() => {
  console.log("Script de depuración finalizado.");
});
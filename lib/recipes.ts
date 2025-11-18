import { db } from './firebase'
import { toGrams, normalizeUnit } from './units'
import { doc, runTransaction, getDoc } from 'firebase/firestore'
import { collection, getDocs } from 'firebase/firestore'

// A recipe line is { ingredienteId, cantidad, unidad }
export interface RecipeLine { ingredienteId: string; cantidad: number; unidad?: string }

// Check if an item (pizza) is available given the current ingredients snapshot.
// ingredientsById: Record<id, { stockActual: number; unidad?: string }>
export const isItemAvailable = (recipe: RecipeLine[] | undefined, ingredientsById: Record<string, any>, qty = 1) => {
  if (!recipe || recipe.length === 0) return { available: true, missing: [] }
  const missing: Array<{ ingredienteId: string; needed: number; available: number; unidad?: string }> = []

  for (const line of recipe) {
    const ing = ingredientsById[line.ingredienteId]
    const neededRaw = (Number(line.cantidad) || 0) * qty
    if (!ing) {
      missing.push({ ingredienteId: line.ingredienteId, needed: neededRaw, available: 0, unidad: line.unidad })
      continue
    }

    // Convert both needed and stock to grams if unit is weight-based
    const neededConv = toGrams(neededRaw, line.unidad)
    const stockConv = toGrams(Number(ing.stockActual || 0), ing.unidad)

    if (neededConv.unit === 'g' && stockConv.unit === 'g') {
      if (stockConv.value < neededConv.value) {
        missing.push({ ingredienteId: line.ingredienteId, needed: neededConv.value, available: stockConv.value, unidad: 'g' })
      }
    } else if (neededConv.unit === 'u' && stockConv.unit === 'u') {
      if (stockConv.value < neededConv.value) {
        missing.push({ ingredienteId: line.ingredienteId, needed: neededConv.value, available: stockConv.value, unidad: 'u' })
      }
    } else {
      // Units mismatch (e.g., recipe in g but stock in unidades) -> treat as missing
      // Try converting if possible
      const tryConv = (() => {
        const c = toGrams(stockConv.value, stockConv.unit)
        if (c.unit === neededConv.unit && c.value >= neededConv.value) return true
        return false
      })()
      if (!tryConv) missing.push({ ingredienteId: line.ingredienteId, needed: neededConv.value, available: stockConv.value, unidad: neededConv.unit })
    }
  }

  return { available: missing.length === 0, missing }
}

// Consume recipe for an order using a Firestore transaction. This will decrement stockActual fields.
// Note: caller must ensure order idempotency (don't call twice for same order).
export const consumeRecipeForOrder = async (recipe: RecipeLine[], qty = 1) => {
  if (!recipe || recipe.length === 0) return { success: true }

  // Validar receta antes de procesar
  const validRecipe = recipe.filter(line => 
    line && line.ingredienteId && !isNaN(Number(line.cantidad)) && Number(line.cantidad) > 0
  );
  
  if (validRecipe.length === 0) {
    console.warn("Advertencia: Receta vacía o inválida después de filtrar ingredientes");
    return { success: true };
  }
  
  console.log(`Iniciando consumo de receta con ${validRecipe.length} ingredientes (cantidad: ${qty})`);
  
  try {
    await runTransaction(db, async (tx) => {
      for (const line of validRecipe) {
        if (!line.ingredienteId) {
          console.warn("Advertencia: Ingrediente sin ID en receta");
          continue;
        }
        
        const ingRef = doc(db, 'ingredientes', line.ingredienteId);
        const snap = await tx.get ? await tx.get(ingRef) : await getDoc(ingRef);
        
        if (!snap.exists()) {
          console.warn(`Advertencia: Ingrediente ${line.ingredienteId} no existe en Firestore`);
          continue;
        }
        
        const data: any = snap.data();
        const stockActual = Number(data?.stockActual || 0);
        const nombreIng = data?.nombre || line.ingredienteId;
        
        // Normalize units to grams when possible
        const neededRaw = (Number(line.cantidad) || 0) * qty;
        const neededConv = toGrams(neededRaw, line.unidad);
        const stockConv = toGrams(stockActual, data?.unidad);
        
        console.log(`Procesando ${nombreIng}: Stock actual ${stockActual} ${data?.unidad || 'u'}, Necesario ${neededRaw} ${line.unidad || 'u'}`);

        let newStockRaw: number | null = null;
        if (neededConv.unit === 'g' && stockConv.unit === 'g') {
          const remaining = stockConv.value - neededConv.value;
          newStockRaw = remaining;
          console.log(`Conversión a gramos: ${stockConv.value}g - ${neededConv.value}g = ${remaining}g`);
        } else if (neededConv.unit === 'u' && stockConv.unit === 'u') {
          const remaining = stockConv.value - neededConv.value;
          newStockRaw = remaining;
          console.log(`Unidades: ${stockConv.value}u - ${neededConv.value}u = ${remaining}u`);
        } else {
          // Intento de convertir unidades
          console.error(`Unidad incompatible para ingrediente ${nombreIng}: ${neededConv.unit} vs ${stockConv.unit}`);
          throw new Error(`Unidad incompatible para ingrediente ${nombreIng}: ${neededConv.unit} vs ${stockConv.unit}`);
        }

        if (newStockRaw === null) {
          throw new Error(`No se pudo calcular nuevo stock para ${nombreIng}`);
        }
        
        if (newStockRaw < 0) {
          throw new Error(`Stock insuficiente para ${nombreIng}: se requieren ${neededRaw} ${line.unidad || 'u'} pero hay ${stockActual} ${data?.unidad || 'u'}`);
        }

        // Write back in the original unit of the stock (if stock was in kg we convert back)
        const stockUnit = normalizeUnit(data?.unidad);
        let writeValue: number = newStockRaw;
        if (stockUnit === 'kg') {
          writeValue = newStockRaw / 1000;
          console.log(`Conversión a kg: ${newStockRaw}g = ${writeValue}kg`);
        }

        console.log(`Actualizando stock de ${nombreIng}: ${stockActual} -> ${writeValue} ${data?.unidad || 'u'}`);
        tx.update(ingRef, { 
          stockActual: writeValue, 
          updatedAt: new Date().toISOString() 
        });
      }
    })

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) }
  }
}

// Helper to parse strings like 'Jamón (2)' or 'Jamón' -> { name, quantity }
const parseItemString = (itemString: string): { name: string; quantity: number } => {
  const match = itemString.match(/^(.+?)\s*\((\d+)\)$/)
  if (match && match[1] && match[2]) {
    return { name: match[1].trim(), quantity: Number.parseInt(match[2]) }
  }
  return { name: itemString.trim(), quantity: 1 }
}

// Helper para procesar recetas de pizzas Duo según la lógica especificada:
// IMPORTANTE: Las recetas ya vienen con cantidades divididas por 2 (mitades)
// 1. Para ingredientes comunes: sumar cantidades (ya divididas previamente)
// 2. Para ingredientes únicos: mantener el valor (ya están divididos previamente)
const combineRecipes = (recipe1: RecipeLine[], recipe2: RecipeLine[]): RecipeLine[] => {
  // Inicializar estructuras para rastrear ingredientes
  const result: RecipeLine[] = [];
  const ingredientMap: Record<string, { 
    ingredienteId: string,
    cantidad1?: number,  // Cantidad en receta 1
    cantidad2?: number,  // Cantidad en receta 2
    unidad?: string,
    isCommon: boolean    // Indica si está en ambas recetas
  }> = {};
  
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
};

// Consume ingredients for a whole order (array of order items). Tries to use items_menu.receta when available,
// otherwise maps ingredient names to ingrediente docs and consumes accordingly.
export const consumeOrderItems = async (orderItems: any[]) => {
  try {
    // Load items_menu and ingredientes once
    const itemsMenuSnap = await getDocs(collection(db, 'items_menu'))
    const itemsMenuDocs: any[] = []
    itemsMenuSnap.forEach(d => itemsMenuDocs.push({ id: d.id, ...(d.data() || {}) }))

    const ingredientesSnap = await getDocs(collection(db, 'ingredientes'))
    const ingredientes: any[] = []
    const ingredientesByName: Record<string, any> = {}
    ingredientesSnap.forEach(d => {
      const data: any = d.data()
      ingredientes.push({ id: d.id, ...data })
      if (data?.nombre) ingredientesByName[String(data.nombre).toLowerCase()] = { id: d.id, ...data }
    })

    const results: any[] = []

    for (const item of orderItems) {
      const qty = item.cantidad || item.quantity || 1

      // Normalize names for matching
      const norm = (s: string) => s ? s.toLowerCase().replace(/[^a-z0-9ñáéíóúü ]+/gi, '').trim() : ''
      const itemName = norm(item.nombre || item.name || '')
      
      // 1. Identificar si es una pizza Duo
      const isDuoPizza = item.pizzaType === 'duo' && item.pizza1 && item.pizza2;
      
      if (isDuoPizza) {
        console.log(`Procesando Pizza Duo: ${itemName} (${item.pizza1} / ${item.pizza2})`);
        
        // 2. Buscar las recetas de pizza1 y pizza2 en la base de datos
        const pizza1Name = norm(item.pizza1);
        const pizza2Name = norm(item.pizza2);
        
        // Encontrar las pizzas individuales en el menú - búsqueda mejorada y robusta
        const findPizzaInMenu = (pizzaName: string) => {
          // 0. Limpieza adicional para palabras clave específicas
          const cleanName = pizzaName
            .replace(/\s+pizza\s+/gi, ' ')  // Eliminar "pizza" como palabra separada
            .replace(/\b(mediana|familiar)\b/gi, '') // Eliminar tamaños de la búsqueda
            .trim();
          
          console.log(`Búsqueda de pizza: "${pizzaName}" (limpiado: "${cleanName}")`);
          
          // 1. Búsqueda exacta (considerando tanto nombre como name)
          let match = itemsMenuDocs.find(i => 
            norm(i.nombre || '') === norm(cleanName) || 
            norm(i.name || '') === norm(cleanName)
          );
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
          
          // Si no encontramos nada, veamos qué pizzas están disponibles (para diagnóstico)
          if (!match && pizzaName.length > 3) {
            console.log(`⚠️ No se pudo encontrar la pizza "${pizzaName}". Mostrando algunas opciones disponibles:`);
            const availablePizzas = itemsMenuDocs
              .filter(i => i.nombre || i.name)
              .map(i => i.nombre || i.name)
              .slice(0, 10);
            console.log(availablePizzas.join(", "));
          }
          
          // 4. Búsqueda por primeras palabras
          if (!match) {
            const firstTwoWords = cleanName.split(' ').slice(0,2).join(' ');
            if (firstTwoWords.length > 3) { // Solo si son palabras significativas
              match = itemsMenuDocs.find(i => norm(i.nombre || i.name || '').includes(norm(firstTwoWords)));
              if (match) console.log(`Encontrada por primeras palabras: ${match.nombre || match.name}`);
            }
          }
          
          // 5. Búsqueda más flexible si aún no se encuentra
          if (!match && cleanName.length >= 4) {
            console.log(`Intento final de búsqueda con coincidencia parcial más flexible`);
            
            // Buscar por la primera parte del nombre (primeros 4 caracteres)
            const firstChars = norm(cleanName).substring(0, 4);
            match = itemsMenuDocs.find(i => norm(i.nombre || i.name || '').includes(firstChars));
            
            if (match) console.log(`Encontrada por coincidencia flexible: ${match.nombre || match.name}`);
          }
          
          return match;
        };
        
        const matchedPizza1 = findPizzaInMenu(pizza1Name);
        const matchedPizza2 = findPizzaInMenu(pizza2Name);
        
        // Log detallado para diagnóstico
        console.log(`Búsqueda de Pizza 1 "${pizza1Name}": ${matchedPizza1 ? 'ENCONTRADA - ' + matchedPizza1.nombre : 'NO ENCONTRADA'}`);
        console.log(`Búsqueda de Pizza 2 "${pizza2Name}": ${matchedPizza2 ? 'ENCONTRADA - ' + matchedPizza2.nombre : 'NO ENCONTRADA'}`);
        
        // Preparar para recolectar resultados de ambas mitades
        const duoResults = [];
        
        // Preparar recetas para ambas mitades
        let recipe1: RecipeLine[] = [];
        let recipe2: RecipeLine[] = [];
        
        // 3. Procesar mitad de pizza1
        if (matchedPizza1) {
          // Determinar qué receta usar según el tamaño
          const size = item.size?.toLowerCase() || 'familiar';
          let recetaBase = null;
          
          // Seleccionar la receta adecuada según el tamaño
          if (size === 'mediana' && matchedPizza1.recetaMediana && Array.isArray(matchedPizza1.recetaMediana) && matchedPizza1.recetaMediana.length > 0) {
            recetaBase = matchedPizza1.recetaMediana;
            console.log(`Pizza 1 (${item.pizza1}): Usando receta MEDIANA con ${recetaBase.length} ingredientes`);
          } else if (matchedPizza1.receta && Array.isArray(matchedPizza1.receta) && matchedPizza1.receta.length > 0) {
            recetaBase = matchedPizza1.receta;
            console.log(`Pizza 1 (${item.pizza1}): Usando receta FAMILIAR con ${recetaBase.length} ingredientes`);
          }
          
          if (recetaBase && recetaBase.length > 0) {
            // 3a. Preparar la MITAD de la receta (ya que cada pizza ocupa solo la mitad)
            recipe1 = recetaBase.map((r: any) => {
              // Verificar que el ingrediente tenga los datos necesarios
              if (!r.ingredienteId) {
                console.error(`Pizza 1: Ingrediente sin ID en receta de ${item.pizza1}`);
                return null;
              }
              
              // Aseguramos que el cálculo de la mitad sea preciso
              const originalCantidad = Number(r.cantidad) || 0;
              // Dividimos por 2 y redondeamos a 2 decimales para evitar imprecisiones
              const halfCantidad = Math.round((originalCantidad / 2) * 100) / 100;
              
              return { 
                ingredienteId: r.ingredienteId, 
                cantidad: halfCantidad, // MITAD de los ingredientes con precisión
                unidad: r.unidad 
              };
            }).filter(Boolean); // Eliminamos valores nulos
            
            console.log(`Pizza 1 (${item.pizza1}): Preparada mitad de receta con ${recipe1.length} ingredientes`);
            console.log(`Detalles receta pizza 1: ${JSON.stringify(recipe1.slice(0, 3))}...`); // Mostrar primeros 3 para debug
          } else {
            console.log(`No se encontró receta válida para la pizza 1: ${item.pizza1}`);
          }
        } else {
          console.log(`No se encontró la pizza 1 en el menú: ${item.pizza1}`);
        }
        
        // 3b. Procesar mitad de pizza2
        if (matchedPizza2) {
          // Determinar qué receta usar según el tamaño
          const size = item.size?.toLowerCase() || 'familiar';
          let recetaBase = null;
          
          // Seleccionar la receta adecuada según el tamaño
          if (size === 'mediana' && matchedPizza2.recetaMediana && Array.isArray(matchedPizza2.recetaMediana) && matchedPizza2.recetaMediana.length > 0) {
            recetaBase = matchedPizza2.recetaMediana;
            console.log(`Pizza 2 (${item.pizza2}): Usando receta MEDIANA con ${recetaBase.length} ingredientes`);
          } else if (matchedPizza2.receta && Array.isArray(matchedPizza2.receta) && matchedPizza2.receta.length > 0) {
            recetaBase = matchedPizza2.receta;
            console.log(`Pizza 2 (${item.pizza2}): Usando receta FAMILIAR con ${recetaBase.length} ingredientes`);
          }
          
          if (recetaBase && recetaBase.length > 0) {
            // Preparar la MITAD de la receta
            recipe2 = recetaBase.map((r: any) => {
              // Verificar que el ingrediente tenga los datos necesarios
              if (!r.ingredienteId) {
                console.error(`Pizza 2: Ingrediente sin ID en receta de ${item.pizza2}`);
                return null;
              }
              
              // Aseguramos que el cálculo de la mitad sea preciso
              const originalCantidad = Number(r.cantidad) || 0;
              // Dividimos por 2 y redondeamos a 2 decimales para evitar imprecisiones
              const halfCantidad = Math.round((originalCantidad / 2) * 100) / 100;
              
              return { 
                ingredienteId: r.ingredienteId, 
                cantidad: halfCantidad, // MITAD de los ingredientes con precisión
                unidad: r.unidad 
              };
            }).filter(Boolean); // Eliminamos valores nulos
            
            console.log(`Pizza 2 (${item.pizza2}): Preparada mitad de receta con ${recipe2.length} ingredientes`);
            console.log(`Detalles receta pizza 2: ${JSON.stringify(recipe2.slice(0, 3))}...`); // Mostrar primeros 3 para debug
          } else {
            console.log(`No se encontró receta válida para la pizza 2: ${item.pizza2}`);
          }
        } else {
          console.log(`No se encontró la pizza 2 en el menú: ${item.pizza2}`);
        }
        
        // 3c. Combinar las recetas de ambas mitades y procesar como una sola
        if (recipe1.length > 0 || recipe2.length > 0) {
          // Verificar si encontramos ambas recetas
          if (recipe1.length === 0) {
            console.error(`⚠️ ERROR: No se encontró la receta para pizza1: "${item.pizza1}"`);
            console.log(`Intentando usar solo la receta de la pizza2...`);
          } else if (recipe2.length === 0) {
            console.error(`⚠️ ERROR: No se encontró la receta para pizza2: "${item.pizza2}"`);
            console.log(`Intentando usar solo la receta de la pizza1...`);
          }
          
          // Combinar ambas recetas, sumando cantidades para ingredientes comunes
          const combinedRecipe = combineRecipes(recipe1, recipe2);
          console.log(`Pizza Duo: Combinando recetas de ambas mitades - Total ${combinedRecipe.length} ingredientes`);
          
          // Verificar que la receta combinada tenga todos los ingredientes necesarios
          if (combinedRecipe.length > 0) {
            // Log detallado para cada ingrediente
            console.log(`Ingredientes en receta combinada:`);
            combinedRecipe.forEach((ing, idx) => {
              if (idx < 10 || idx === combinedRecipe.length - 1) { // Mostrar solo 10 primeros + último para no saturar logs
                console.log(`  ${idx+1}/${combinedRecipe.length}: ${ing.ingredienteId} - ${ing.cantidad} ${ing.unidad || 'u'}`);
              } else if (idx === 10) {
                console.log(`  ... (omitiendo ${combinedRecipe.length - 11} ingredientes) ...`);
              }
            });
            
            // Consumir la receta combinada
            const resCombined = await consumeRecipeForOrder(combinedRecipe, qty);
            duoResults.push({ 
              item: `${itemName} - Receta combinada (${item.pizza1} / ${item.pizza2})`, 
              method: 'receta-duo-combinada', 
              success: resCombined.success, 
              error: resCombined.error 
            });
            
            if (!resCombined.success) {
              console.error(`Error al procesar receta combinada: ${resCombined.error}`);
            } else {
              console.log(`Receta combinada procesada correctamente`);
            }
          } else {
            console.error(`¡ATENCIÓN! Receta combinada está vacía a pesar de tener ingredientes individuales`);
          }
        } else {
          console.log(`No se encontraron recetas para ninguna de las mitades de la pizza Duo`);
        }
        
        // 4. Procesar los extras seleccionados para la pizza Duo
        const lines: RecipeLine[] = [];
        const extrasProcessed: string[] = [];
        
        const collectFromArray = (arr?: string[], source: string = "sin especificar") => {
          if (!arr || !Array.isArray(arr)) {
            console.log(`No hay ${source} para procesar en pizza Duo`);
            return;
          }
          
          console.log(`Procesando ${arr.length} ${source} en pizza Duo`);
          
          arr.forEach(s => {
            if (!s) return;
            
            const parsed = parseItemString(s);
            if (!parsed.name) {
              console.log(`Extra sin nombre: ${s}`);
              return;
            }
            
            const ingDoc = ingredientesByName[parsed.name.toLowerCase()];
            if (ingDoc) {
              lines.push({ 
                ingredienteId: ingDoc.id, 
                cantidad: parsed.quantity || 1, 
                unidad: ingDoc.unidad || 'u' 
              });
              extrasProcessed.push(`${parsed.name} (${parsed.quantity || 1} ${ingDoc.unidad || 'u'})`);
            } else {
              console.log(`No se encontró ingrediente para extra: ${parsed.name}`);
            }
          });
        };
        
        // Recolectar extras de diferentes categorías
        collectFromArray(item.ingredients, "ingredientes");
        collectFromArray(item.premiumIngredients, "ingredientes premium");
        collectFromArray(item.sauces, "salsas");
        collectFromArray(item.drinks, "bebidas");
        collectFromArray(item.extras, "extras");
        
        if (lines.length > 0) {
            console.log(`Pizza Duo: Procesando ${lines.length} extras: ${extrasProcessed.join(", ")}`);
            const resExtras = await consumeRecipeForOrder(lines, qty);
            duoResults.push({ 
                item: `${itemName} - Extras`, 
                method: 'duo-extras', 
                success: resExtras.success, 
                error: resExtras.error 
            });
            
            if (!resExtras.success) {
                console.error(`Error al procesar extras: ${resExtras.error}`);
            }
        } else {
            console.log(`Pizza Duo: No se encontraron extras para procesar`);
        }
        
        // Agregar todos los resultados de la pizza Duo
        results.push(...duoResults);
        
        // Log final de procesamiento
        console.log(`Finalizado procesamiento de pizza Duo (${item.pizza1} / ${item.pizza2}) - ${duoResults.length} operaciones realizadas`);
        continue;
      }
      
      // Código existente para pizzas normales (no Duo)
      // Try to find matching items_menu doc
      let matchedItem = itemsMenuDocs.find(i => norm(i.nombre || i.name || '') === itemName)
      if (!matchedItem) {
        // fallback: try startsWith
        matchedItem = itemsMenuDocs.find(i => (norm(i.nombre || '') || '').startsWith(itemName.split(' ').slice(0,3).join(' ')))
      }

      if (matchedItem && matchedItem.receta && Array.isArray(matchedItem.receta) && matchedItem.receta.length > 0) {
        // consume recipe from items_menu
        const recipe: RecipeLine[] = matchedItem.receta.map((r: any) => ({ ingredienteId: r.ingredienteId, cantidad: Number(r.cantidad) || 0, unidad: r.unidad }))
        const res = await consumeRecipeForOrder(recipe, qty)
        results.push({ item: itemName, method: 'receta', success: res.success, error: res.error })
        continue
      }

      // Otherwise, build recipe lines from item.ingredients / premiumIngredients / sauces / drinks / extras
      const lines: RecipeLine[] = []
      const collectFromArray = (arr?: string[]) => {
        if (!arr) return
        arr.forEach(s => {
          const parsed = parseItemString(s)
          const ingDoc = ingredientesByName[parsed.name.toLowerCase()]
          if (ingDoc) {
            lines.push({ ingredienteId: ingDoc.id, cantidad: parsed.quantity, unidad: ingDoc.unidad || 'u' })
          }
        })
      }

      collectFromArray(item.ingredients)
      collectFromArray(item.premiumIngredients)
      collectFromArray(item.sauces)
      collectFromArray(item.drinks)
      collectFromArray(item.extras)

      if (lines.length > 0) {
        const res = await consumeRecipeForOrder(lines, qty)
        results.push({ item: itemName, method: 'derived', success: res.success, error: res.error })
      } else {
        results.push({ item: itemName, method: 'none', success: true, note: 'no matching recipe or ingredients found' })
      }
    }

    return { success: true, details: results }
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) }
  }
}

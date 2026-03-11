import { db } from './firebase'
import { collection, getDocs, doc, runTransaction, Timestamp, addDoc, getDoc, updateDoc } from 'firebase/firestore'
import { consumeRecipeForOrder, isItemAvailable, RecipeLine } from './recipes'
import { computeEstado } from './inventory'
import { toGrams } from './units'

// Interfaz para los resultados de validación
interface ValidationResult {
  success: boolean
  insufficientItems?: Array<{
    item: string
    missing: Array<{
      ingrediente: string
      ingredienteId: string
      needed: number
      available: number
      unidad: string
    }>
  }>
  error?: string
}

// Interfaz para registrar transacciones de inventario
interface InventoryTransaction {
  orderId: string
  orderNumber: number
  timestamp: string
  items: Array<{
    ingredienteId: string
    nombre: string
    cantidadAnterior: number
    cantidadConsumida: number
    cantidadNueva: number
    unidad: string
  }>
  status: 'success' | 'failed' | 'retry' | 'manual' | 'processing'
  retryCount?: number
  error?: string
}

// Cache para reducir consultas a Firestore
const cache = {
  itemsMenu: null as any[] | null,
  ingredientes: null as any[] | null,
  ingredientesByName: null as Record<string, any> | null,
  ingredientsById: null as Record<string, any> | null,
  lastFetch: 0,
  ttl: 60000 // 60 segundos
}

// Función para obtener datos con caché
async function getCachedData() {
  const now = Date.now()
  if (cache.itemsMenu && cache.ingredientes && cache.ingredientesByName && cache.ingredientsById && (now - cache.lastFetch) < cache.ttl) {
    return {
      itemsMenu: cache.itemsMenu,
      ingredientes: cache.ingredientes,
      ingredientesByName: cache.ingredientesByName,
      ingredientsById: cache.ingredientsById
    }
  }

  // Helper para normalizar texto para comparaciones insensibles a mayúsculas y acentos
  const normalizeText = (text: string): string => {
    return text.toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "") // Eliminar acentos
              .trim();
  };

  // Si no hay caché o expiró, cargar datos
  const [itemsMenuSnap, ingredientesSnap] = await Promise.all([
    getDocs(collection(db, 'items_menu')),
    getDocs(collection(db, 'ingredientes'))
  ])

  const itemsMenu: any[] = []
  itemsMenuSnap.forEach(d => itemsMenu.push({ id: d.id, ...(d.data() || {}) }))

  const ingredientes: any[] = []
  const ingredientesByName: Record<string, any> = {}
  const ingredientsById: Record<string, any> = {}
  
  ingredientesSnap.forEach(d => {
    const data: any = d.data()
    const item = { id: d.id, ...data }
    ingredientes.push(item)
    if (data?.nombre) {
      // Guardar con nombre normalizado para búsquedas más efectivas
      ingredientesByName[normalizeText(data.nombre)] = item
    }
    ingredientsById[d.id] = item
  })

  // Actualizar caché
  cache.itemsMenu = itemsMenu
  cache.ingredientes = ingredientes
  cache.ingredientesByName = ingredientesByName
  cache.ingredientsById = ingredientsById
  cache.lastFetch = now

  return { itemsMenu, ingredientes, ingredientesByName, ingredientsById }
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

// Helper para parsear strings como 'Jamón (2)' o 'Jamón' -> { name, quantity }
const parseItemString = (itemString: string): { name: string; quantity: number } => {
  if (!itemString) {
    return { name: "", quantity: 0 };
  }
  
  // Regex mejorada para manejar formatos como "Jamón 100g" o "Aceitunas 150 gr" además de "Jamón (2)"
  const weightMatch = itemString.match(/^(.+?)\s+(\d+)\s*(g|gr|gramos|kg|kilos|kilogramos)$/i);
  if (weightMatch && weightMatch[1] && weightMatch[2]) {
    const cantidad = Number.parseInt(weightMatch[2]);
    // Si tiene unidad de peso, la consideramos como la cantidad
    return { 
      name: weightMatch[1].trim(), 
      quantity: cantidad 
    };
  }
  
  // Formato tradicional "Ingrediente (cantidad)"
  const match = itemString.match(/^(.+?)\s*\((\d+)\)$/);
  if (match && match[1] && match[2]) {
    return { 
      name: match[1].trim(), 
      quantity: Number.parseInt(match[2]) 
    };
  }
  
  // Si no tiene formato especial, asumir cantidad 1
  return { name: itemString.trim(), quantity: 1 };
}

// Construye líneas de receta a partir de ingredientes seleccionados
const buildRecipeLinesFromIngredients = (
  item: any,
  ingredientesByName: Record<string, any>
): RecipeLine[] => {
  const lines: RecipeLine[] = []
  
  // Detectar tamaño de la pizza para usar cantidades estándar
  const pizzaSize = item.size?.toLowerCase() || 'familiar';
  const isMediana = pizzaSize === 'mediana';
  
  console.log(`🍕 Procesando ingredientes para pizza ${pizzaSize}`);
  
  // Función para normalizar texto (igual que en getCachedData)
  const normalizeText = (text: string): string => {
    return text.toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "") // Eliminar acentos
              .trim();
  };
  
  const collectFromArray = (arr?: string[]) => {
    if (!arr) return
    arr.forEach(s => {
      const parsed = parseItemString(s)
      // Usar texto normalizado para búsqueda más efectiva
      const normalizedName = normalizeText(parsed.name);
      const ingDoc = ingredientesByName[normalizedName]
      
      if (ingDoc) {
        // Determinar la cantidad a usar basándose en el tamaño de la pizza
        let cantidadPorIngrediente: number;
        
        if (isMediana && ingDoc.cantidadPorPizzaMediana) {
          // Usar cantidad estándar para pizza mediana
          cantidadPorIngrediente = ingDoc.cantidadPorPizzaMediana * parsed.quantity;
          console.log(`✅ Ingrediente "${parsed.name}": ${cantidadPorIngrediente}${ingDoc.unidad || 'g'} (${ingDoc.cantidadPorPizzaMediana}${ingDoc.unidad || 'g'} × ${parsed.quantity} veces) - MEDIANA`);
        } else if (!isMediana && ingDoc.cantidadPorPizzaFamiliar) {
          // Usar cantidad estándar para pizza familiar
          cantidadPorIngrediente = ingDoc.cantidadPorPizzaFamiliar * parsed.quantity;
          console.log(`✅ Ingrediente "${parsed.name}": ${cantidadPorIngrediente}${ingDoc.unidad || 'g'} (${ingDoc.cantidadPorPizzaFamiliar}${ingDoc.unidad || 'g'} × ${parsed.quantity} veces) - FAMILIAR`);
        } else {
          // Fallback: usar la cantidad parseada si no hay estándar definido
          cantidadPorIngrediente = parsed.quantity;
          console.log(`⚠️ Ingrediente "${parsed.name}": ${cantidadPorIngrediente}${ingDoc.unidad || 'u'} (sin cantidad estándar definida, usando fallback)`);
        }
        
        lines.push({ 
          ingredienteId: ingDoc.id, 
          cantidad: cantidadPorIngrediente, 
          unidad: ingDoc.unidad || 'u' 
        })
      } else {
        // Intento de búsqueda alternativa por nombre parcial
        console.log(`No se encontró ingrediente exacto "${parsed.name}", buscando alternativas...`)
        const matchingIngredient = Object.entries(ingredientesByName).find(([key, _]) => 
          normalizeText(parsed.name).includes(key) || key.includes(normalizeText(parsed.name))
        );
        
        if (matchingIngredient) {
          const [_, ingData] = matchingIngredient;
          
          // Determinar la cantidad a usar basándose en el tamaño de la pizza
          let cantidadPorIngrediente: number;
          
          if (isMediana && ingData.cantidadPorPizzaMediana) {
            cantidadPorIngrediente = ingData.cantidadPorPizzaMediana * parsed.quantity;
            console.log(`✅ Ingrediente similar "${ingData.nombre}": ${cantidadPorIngrediente}${ingData.unidad || 'g'} - MEDIANA`);
          } else if (!isMediana && ingData.cantidadPorPizzaFamiliar) {
            cantidadPorIngrediente = ingData.cantidadPorPizzaFamiliar * parsed.quantity;
            console.log(`✅ Ingrediente similar "${ingData.nombre}": ${cantidadPorIngrediente}${ingData.unidad || 'g'} - FAMILIAR`);
          } else {
            cantidadPorIngrediente = parsed.quantity;
            console.log(`⚠️ Ingrediente similar "${ingData.nombre}": ${cantidadPorIngrediente}${ingData.unidad || 'u'} (sin cantidad estándar)`);
          }
          
          lines.push({
            ingredienteId: ingData.id,
            cantidad: cantidadPorIngrediente,
            unidad: ingData.unidad || 'u'
          });
        } else {
          console.log(`❌ No se encontró ingrediente para "${parsed.name}"`)
        }
      }
    })
  }

  collectFromArray(item.ingredients)
  collectFromArray(item.premiumIngredients)
  collectFromArray(item.sauces)
  collectFromArray(item.drinks)
  collectFromArray(item.extras)

  return lines
}

// Validar si hay suficiente stock para un pedido
export async function validateInventoryForOrder(orderItems: any[]): Promise<ValidationResult> {
  try {
    const { itemsMenu, ingredientsById, ingredientesByName } = await getCachedData()
    const insufficientItems: any[] = []

    for (const item of orderItems) {
      const qty = item.cantidad || item.quantity || 1
      const itemName = (item.nombre || item.name || '').toLowerCase().trim()

      // Función auxiliar para normalizar texto
      const normalizeText = (text: string): string => {
        return (text || '').toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .trim();
      };

      // 1. Verificar si es una pizza Duo
      const isDuoPizza = item.pizzaType === 'duo' && item.pizza1 && item.pizza2;
      
      if (isDuoPizza) {
        console.log(`Validando Pizza Duo: ${itemName} (${item.pizza1} / ${item.pizza2})`);
        
        const pizza1Name = normalizeText(item.pizza1);
        const pizza2Name = normalizeText(item.pizza2);
        const size = item.size?.toLowerCase() || 'familiar';
        
        // Encontrar las pizzas individuales en el menú
        const matchedPizza1 = itemsMenu.find(i => {
          const normalizedMenuItemName = normalizeText(i.nombre || i.name || '');
          return normalizedMenuItemName === pizza1Name ||
                 normalizedMenuItemName.includes(pizza1Name) ||
                 pizza1Name.includes(normalizedMenuItemName);
        });
        
        const matchedPizza2 = itemsMenu.find(i => {
          const normalizedMenuItemName = normalizeText(i.nombre || i.name || '');
          return normalizedMenuItemName === pizza2Name ||
                 normalizedMenuItemName.includes(pizza2Name) ||
                 pizza2Name.includes(normalizedMenuItemName);
        });
        
        // Función para encontrar pizzas en el menú (validación)
        const findPizzaInMenuValidation = (pizzaName: string) => {
          // 0. Limpieza adicional para palabras clave específicas
          const cleanName = pizzaName
            .replace(/\s+pizza\s+/gi, ' ')  // Eliminar "pizza" como palabra separada
            .replace(/\b(mediana|familiar)\b/gi, '') // Eliminar tamaños de la búsqueda
            .trim();
          
          // Caso especial para "Del Pibe" y otras pizzas problemáticas
          if (cleanName.toLowerCase().includes("del pibe") || cleanName.toLowerCase().includes("pibe")) {
            const specialMatch = itemsMenu.find(i => {
              const menuItemName = normalizeText(i.nombre || i.name || '');
              return menuItemName.includes("pibe") || menuItemName.includes("del pibe");
            });
            if (specialMatch) return specialMatch;
          }
          
          // Caso especial para "Napolitana"
          if (cleanName.toLowerCase().includes("napolitana")) {
            const specialMatch = itemsMenu.find(i => {
              const menuItemName = normalizeText(i.nombre || i.name || '');
              return menuItemName.includes("napolitana");
            });
            if (specialMatch) return specialMatch;
          }
          
          // 1. Búsqueda exacta (considerando tanto nombre como name)
          let match = itemsMenu.find(i => 
            normalizeText(i.nombre || '') === normalizeText(cleanName) || 
            normalizeText(i.name || '') === normalizeText(cleanName)
          );
          
          // 2. Búsqueda por palabras clave significativas
          if (!match) {
            // Extraer palabras clave significativas (ignorar artículos, etc.)
            const keywords = cleanName.split(' ').filter(word => 
              word.length > 2 && !['con', 'los', 'las', 'del', 'de', 'la', 'el', 'y'].includes(word.toLowerCase())
            );
            
            if (keywords.length > 0) {
              match = itemsMenu.find(i => {
                const menuItemName = normalizeText(i.nombre || i.name || '');
                // Una pizza coincide si todas sus palabras clave están en el nombre del menú
                return keywords.every(word => menuItemName.includes(normalizeText(word)));
              });
            }
          }
          
          // 3. Búsqueda por inicio de palabras
          if (!match) {
            match = itemsMenu.find(i => {
              const menuItemName = normalizeText(i.nombre || i.name || '');
              const normalizedPizzaName = normalizeText(cleanName);
              return menuItemName.startsWith(normalizedPizzaName) || normalizedPizzaName.startsWith(menuItemName);
            });
          }
          
          // 4. Búsqueda por coincidencia parcial
          if (!match) {
            match = itemsMenu.find(i => {
              const menuItemName = normalizeText(i.nombre || i.name || '');
              const normalizedPizzaName = normalizeText(cleanName);
              return menuItemName.includes(normalizedPizzaName) || normalizedPizzaName.includes(menuItemName);
            });
          }
          
          // 5. Búsqueda por primeras palabras
          if (!match) {
            const firstTwoWords = normalizeText(cleanName).split(' ').slice(0,2).join(' ');
            if (firstTwoWords.length > 3) { // Solo si son palabras significativas
              match = itemsMenu.find(i => normalizeText(i.nombre || i.name || '').includes(firstTwoWords));
            }
          }
          
          // 6. Búsqueda más flexible si aún no se encuentra
          if (!match && cleanName.length >= 4) {
            // Buscar por la primera parte del nombre (primeros 4 caracteres)
            const firstChars = normalizeText(cleanName).substring(0, 4);
            match = itemsMenu.find(i => normalizeText(i.nombre || i.name || '').includes(firstChars));
          }
          
          return match;
        };
        
        const validationPizza1 = findPizzaInMenuValidation(pizza1Name);
        const validationPizza2 = findPizzaInMenuValidation(pizza2Name);
        
        // Log detallado para diagnóstico
        console.log(`Validación - Búsqueda de Pizza 1 "${pizza1Name}": ${validationPizza1 ? 'ENCONTRADA - ' + validationPizza1.nombre : 'NO ENCONTRADA'}`);
        console.log(`Validación - Búsqueda de Pizza 2 "${pizza2Name}": ${validationPizza2 ? 'ENCONTRADA - ' + validationPizza2.nombre : 'NO ENCONTRADA'}`);
        
        // Preparar recetas para ambas mitades
        let recipe1: RecipeLine[] = [];
        let recipe2: RecipeLine[] = [];
        
        // Validar pizza1
        if (validationPizza1) {
          let receta1 = null;
          
          // Seleccionar la receta adecuada según el tamaño
          if (size === 'mediana' && validationPizza1.recetaMediana && Array.isArray(validationPizza1.recetaMediana) && validationPizza1.recetaMediana.length > 0) {
            receta1 = validationPizza1.recetaMediana;
            console.log(`Validación - Pizza 1 (${item.pizza1}): Usando receta MEDIANA con ${receta1.length} ingredientes`);
          } else if (validationPizza1.receta && Array.isArray(validationPizza1.receta) && validationPizza1.receta.length > 0) {
            receta1 = validationPizza1.receta;
            console.log(`Validación - Pizza 1 (${item.pizza1}): Usando receta FAMILIAR con ${receta1.length} ingredientes`);
          }
          
          if (receta1 && receta1.length > 0) {
            // Preparar la MITAD de la receta
            recipe1 = receta1.map((r: any) => {
              // Verificar que el ingrediente tenga los datos necesarios
              if (!r.ingredienteId) {
                console.error(`Validación - Pizza 1: Ingrediente sin ID en receta de ${item.pizza1}`);
                return null;
              }
              
              // Aseguramos que el cálculo de la mitad sea preciso
              const originalCantidad = Number(r.cantidad) || 0;
              // Dividimos por 2 y redondeamos a 2 decimales para evitar imprecisiones
              const halfCantidad = Math.round((originalCantidad / 2) * 100) / 100;
              
              return {
                ingredienteId: r.ingredienteId,
                cantidad: halfCantidad, // MITAD de ingredientes con precisión
                unidad: r.unidad
              };
            }).filter(Boolean); // Eliminamos valores nulos
            
            console.log(`Validación - Preparada mitad de receta para ${item.pizza1} con ${recipe1.length} ingredientes`);
          } else {
            console.log(`Validación - No se encontró receta válida para la pizza 1: ${item.pizza1}`);
          }
        } else {
          console.log(`Validación - No se encontró la pizza 1 en el menú: ${item.pizza1}`);
        }
        
        // Validar pizza2
        if (validationPizza2) {
          let receta2 = null;
          
          // Seleccionar la receta adecuada según el tamaño
          if (size === 'mediana' && validationPizza2.recetaMediana && Array.isArray(validationPizza2.recetaMediana) && validationPizza2.recetaMediana.length > 0) {
            receta2 = validationPizza2.recetaMediana;
            console.log(`Validación - Pizza 2 (${item.pizza2}): Usando receta MEDIANA con ${receta2.length} ingredientes`);
          } else if (validationPizza2.receta && Array.isArray(validationPizza2.receta) && validationPizza2.receta.length > 0) {
            receta2 = validationPizza2.receta;
            console.log(`Validación - Pizza 2 (${item.pizza2}): Usando receta FAMILIAR con ${receta2.length} ingredientes`);
          }
          
          if (receta2 && receta2.length > 0) {
            // Preparar la MITAD de la receta
            recipe2 = receta2.map((r: any) => {
              // Verificar que el ingrediente tenga los datos necesarios
              if (!r.ingredienteId) {
                console.error(`Validación - Pizza 2: Ingrediente sin ID en receta de ${item.pizza2}`);
                return null;
              }
              
              // Aseguramos que el cálculo de la mitad sea preciso
              const originalCantidad = Number(r.cantidad) || 0;
              // Dividimos por 2 y redondeamos a 2 decimales para evitar imprecisiones
              const halfCantidad = Math.round((originalCantidad / 2) * 100) / 100;
              
              return {
                ingredienteId: r.ingredienteId,
                cantidad: halfCantidad, // MITAD de ingredientes con precisión
                unidad: r.unidad
              };
            }).filter(Boolean); // Eliminamos valores nulos
            
            console.log(`Validación - Preparada mitad de receta para ${item.pizza2} con ${recipe2.length} ingredientes`);
          } else {
            console.log(`Validación - No se encontró receta válida para la pizza 2: ${item.pizza2}`);
          }
        } else {
          console.log(`Validación - No se encontró la pizza 2 en el menú: ${item.pizza2}`);
        }
        
        // Combinar y validar las recetas de ambas mitades
        if (recipe1.length > 0 || recipe2.length > 0) {
          // Combinar ambas recetas, sumando cantidades para ingredientes comunes
          const combinedRecipe = combineRecipes(recipe1, recipe2);
          console.log(`Validación - Pizza Duo: Validando receta combinada con ${combinedRecipe.length} ingredientes únicos`);
          
          // Mostrar detalles para debugging
          if (combinedRecipe.length > 0) {
            console.log(`Validación - Muestra de ingredientes combinados: ${JSON.stringify(combinedRecipe.slice(0, 3))}`);
            
            // Log adicional para verificar si ambas recetas se encontraron
            console.log(`DIAGNÓSTICO PIZZA DUO - Receta1: ${recipe1.length} ingredientes, Receta2: ${recipe2.length} ingredientes`);
            if (recipe1.length === 0) {
              console.warn(`⚠️ ADVERTENCIA: No se encontró la receta para pizza1: "${item.pizza1}"`);
            }
            if (recipe2.length === 0) {
              console.warn(`⚠️ ADVERTENCIA: No se encontró la receta para pizza2: "${item.pizza2}"`);
            }
          }
          
          // Validar la receta combinada
          const availabilityCombined = isItemAvailable(combinedRecipe, ingredientsById, qty);
          if (!availabilityCombined.available) {
            console.log(`Validación - Ingredientes insuficientes para pizza Duo: ${availabilityCombined.missing.length} ingredientes faltantes`);
            
            insufficientItems.push({
              item: `${item.nombre} - Receta combinada (${item.pizza1} / ${item.pizza2})`,
              missing: availabilityCombined.missing.map(m => ({
                ingrediente: ingredientsById[m.ingredienteId]?.nombre || m.ingredienteId,
                ingredienteId: m.ingredienteId,
                needed: m.needed,
                available: m.available,
                unidad: m.unidad
              }))
            });
          } else {
            console.log(`Validación - Inventario suficiente para pizza Duo`);
          }
        } else {
          console.log(`Validación - No se encontraron recetas para validar la pizza Duo`);
        }
        
        // Validar extras de la pizza Duo
        const extraLines = buildRecipeLinesFromIngredients(item, ingredientesByName);
        if (extraLines.length > 0) {
          const availabilityExtras = isItemAvailable(extraLines, ingredientsById, qty);
          if (!availabilityExtras.available) {
            insufficientItems.push({
              item: `${item.nombre} - Extras`,
              missing: availabilityExtras.missing.map(m => ({
                ingrediente: ingredientsById[m.ingredienteId]?.nombre || m.ingredienteId,
                ingredienteId: m.ingredienteId,
                needed: m.needed,
                available: m.available,
                unidad: m.unidad
              }))
            });
          }
        }
        
        // Continuar con el siguiente ítem después de validar la pizza Duo
        continue;
      }

      // Código existente para pizzas normales (no Duo)
      // Buscar receta en items_menu
      const matchedItem = itemsMenu.find(i => {
        const normalizedItemName = normalizeText(itemName);
        const normalizedMenuItemName = normalizeText(i.nombre || i.name || '');
        
        // Comparar nombres normalizados
        return normalizedMenuItemName === normalizedItemName ||
               normalizedMenuItemName.includes(normalizedItemName) ||
               normalizedItemName.includes(normalizedMenuItemName);
      })
      
      // Usar la receta correcta según el tamaño de pizza
      if (matchedItem) {
        // Determinar qué receta usar según el tamaño
        const size = item.size?.toLowerCase() || '';
        let receta = null;
        
        if (size === 'mediana' && matchedItem.recetaMediana && Array.isArray(matchedItem.recetaMediana)) {
          // Si es mediana y tiene receta específica, usar recetaMediana
          receta = matchedItem.recetaMediana;
          console.log(`Encontrada receta MEDIANA para "${itemName}" con ${receta.length} ingredientes`);
        } else if (matchedItem.receta && Array.isArray(matchedItem.receta)) {
          // Por defecto usar la receta familiar
          receta = matchedItem.receta;
          console.log(`Encontrada receta FAMILIAR para "${itemName}" con ${receta.length} ingredientes`);
        }
        
        if (receta) {
          // Construir receta base
          let recipe: RecipeLine[] = receta.map((r: any) => ({ 
            ingredienteId: r.ingredienteId, 
            cantidad: Number(r.cantidad) || 0, 
            unidad: r.unidad 
          }))
          
          // SIEMPRE procesar extras adicionales si existen
          const extraLines = buildRecipeLinesFromIngredients(item, ingredientesByName);
          if (extraLines.length > 0) {
            recipe = [...recipe, ...extraLines];
            console.log(`Validación - Añadiendo ${extraLines.length} extras a la receta base de "${itemName}"`);
          }
          
          // Verificar disponibilidad de receta completa (base + extras)
          const availability = isItemAvailable(recipe, ingredientsById, qty)
          if (!availability.available) {
            insufficientItems.push({
              item: item.nombre || item.name,
              missing: availability.missing.map(m => ({
                ingrediente: ingredientsById[m.ingredienteId]?.nombre || m.ingredienteId,
                ingredienteId: m.ingredienteId,
                needed: m.needed,
                available: m.available,
                unidad: m.unidad
              }))
            })
          }
          continue
        }
      }

      // Si no hay receta, intentar construir desde ingredientes seleccionados
      const lines = buildRecipeLinesFromIngredients(item, ingredientesByName)
      
      if (lines.length > 0) {
        const availability = isItemAvailable(lines, ingredientsById, qty)
        if (!availability.available) {
          insufficientItems.push({
            item: item.nombre || item.name,
            missing: availability.missing.map(m => ({
              ingrediente: ingredientsById[m.ingredienteId]?.nombre || m.ingredienteId,
              ingredienteId: m.ingredienteId,
              needed: m.needed,
              available: m.available,
              unidad: m.unidad
            }))
          })
        }
      } else {
        // Si no hay receta definida ni ingredientes seleccionados, añadir como error
        insufficientItems.push({
          item: item.nombre || item.name,
          noRecipe: true,
          missing: [{
            ingrediente: "Receta no definida",
            needed: 0,
            available: 0,
            unidad: ""
          }]
        })
      }
    }

    return {
      success: insufficientItems.length === 0,
      insufficientItems: insufficientItems.length > 0 ? insufficientItems : undefined
    }
  } catch (err: any) {
    console.error('Error validando inventario:', err)
    return { 
      success: false, 
      error: err?.message || String(err)
    }
  }
}

// Consumir inventario para un pedido con transacción
export async function consumeInventoryForOrder(orderItems: any[], orderId: string, orderNumber: number, simulationMode = false): Promise<{
  success: boolean
  transactionId?: string
  error?: string
  simulatedItems?: any[]
}> {
  try {
    // 1. Validar primero que hay stock suficiente
    const validation = await validateInventoryForOrder(orderItems)
    if (!validation.success) {
      // Registrar la transacción fallida para referencia
      const transactionDocData: any = {
        orderId,
        orderNumber,
        timestamp: Timestamp.now().toDate().toISOString(),
        items: [],
        status: 'failed'
      };
      
      // Solo agregar validationDetails si existen
      if (validation.insufficientItems && validation.insufficientItems.length > 0) {
        transactionDocData.validationDetails = validation.insufficientItems;
        transactionDocData.error = 'Inventario insuficiente';
      }
      
      const transactionDoc = await addDoc(collection(db, 'inventory_transactions'), transactionDocData)
      
      return {
        success: false,
        transactionId: transactionDoc.id,
        error: 'Inventario insuficiente para completar el pedido'
      }
    }

    // 2. Obtener datos de ingredientes y recetas
    const { itemsMenu, ingredientsById, ingredientesByName } = await getCachedData()
    
    // 3. Registrar la transacción para auditoría (como "en proceso")
    const transactionDoc = await addDoc(collection(db, 'inventory_transactions'), {
      orderId,
      orderNumber,
      timestamp: Timestamp.now().toDate().toISOString(),
      items: [], // Se actualizará después con los detalles
      status: 'processing'
      // No incluir el campo error si es undefined
    })
    
    // 4. Procesar cada item del pedido
    const transactionItems: any[] = []
    let success = true
    let errorMessage = '';
    
    try {
      // Estructura para almacenar todos los datos necesarios
      const updateOperations: Array<{
        ref: any;
        data: any;
        ingredientInfo: {
          ingredienteId: string;
          nombre: string;
          cantidadAnterior: number;
          cantidadConsumida: number;
          cantidadNueva: number;
          unidad: string;
        };
      }> = [];

      if (!simulationMode) {
        // Ejecutar en una transacción de Firestore para garantizar atomicidad (solo en modo real)
        await runTransaction(db, async (transaction) => {
        
        // PRIMERA FASE: Realizar todas las lecturas
        for (const item of orderItems) {
          const qty = item.cantidad || item.quantity || 1
          const itemName = (item.nombre || item.name || '').toLowerCase().trim()
          
          // Buscar receta en items_menu
          const normalizeText = (text: string): string => {
            return (text || '').toLowerCase()
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .trim();
          };
          
          const normalizedItemName = normalizeText(itemName);
          
          // LOG RAW ITEM DATA
          console.log('🔴 RAW ITEM DATA:', JSON.stringify({
            nombre: item.nombre,
            pizzaType: item.pizzaType,
            pizza1: item.pizza1,
            pizza2: item.pizza2,
            typeofPizzaType: typeof item.pizzaType,
            typeofPizza1: typeof item.pizza1,
            typeofPizza2: typeof item.pizza2
          }, null, 2));
          
          // 1. Verificar si es una pizza Duo
          const isDuoPizza = item.pizzaType === 'duo' && item.pizza1 && item.pizza2;
          console.log('🔴 isDuoPizza CHECK:', {
            pizzaType: item.pizzaType,
            pizza1: item.pizza1,
            pizza2: item.pizza2,
            result: isDuoPizza
          });
          
          let recipe: RecipeLine[] = []
          
          if (isDuoPizza) {
            console.log(`Procesando Pizza Duo: ${itemName} (${item.pizza1} / ${item.pizza2})`);
            
            const pizza1Name = normalizeText(item.pizza1);
            const pizza2Name = normalizeText(item.pizza2);
            const size = item.size?.toLowerCase() || 'familiar';
            
            // Función mejorada para encontrar las pizzas individuales en el menú
            const findPizzaInMenu = (pizzaName: string) => {
              // 0. Limpieza adicional para palabras clave específicas
              const cleanName = pizzaName
                .replace(/\s+pizza\s+/gi, ' ')  // Eliminar "pizza" como palabra separada
                .replace(/\b(mediana|familiar)\b/gi, '') // Eliminar tamaños de la búsqueda
                .trim();
              
              console.log(`Búsqueda de pizza: "${pizzaName}" (limpiado: "${cleanName}")`);
              
              // CASOS ESPECIALES - Buscar por nombre específico para pizzas problemáticas
              // CASO ESPECIAL: "Del Pibe"
              if (cleanName.toLowerCase().includes("pibe") || cleanName.toLowerCase().includes("del pibe")) {
                console.log(`Detectada búsqueda especial: "Del Pibe"`);
                const specialMatch = itemsMenu.find(i => {
                  const menuItemName = normalizeText(i.nombre || i.name || '');
                  return menuItemName.includes("pibe") || menuItemName.includes("del pibe");
                });
                if (specialMatch) {
                  console.log(`✅ Encontrada pizza Del Pibe por búsqueda especial: ${specialMatch.nombre || specialMatch.name}`);
                  return specialMatch;
                }
              }
              
              // CASO ESPECIAL: "Napolitana"
              if (cleanName.toLowerCase().includes("napolitana") || cleanName.toLowerCase().includes("napo")) {
                console.log(`Detectada búsqueda especial: "Napolitana"`);
                const specialMatch = itemsMenu.find(i => {
                  const menuItemName = normalizeText(i.nombre || i.name || '');
                  return menuItemName.includes("napolitana");
                });
                if (specialMatch) {
                  console.log(`✅ Encontrada pizza Napolitana por búsqueda especial: ${specialMatch.nombre || specialMatch.name}`);
                  return specialMatch;
                }
              }
              
              // 1. Búsqueda exacta (considerando tanto nombre como name)
              let match = itemsMenu.find(i => 
                normalizeText(i.nombre || '') === normalizeText(cleanName) || 
                normalizeText(i.name || '') === normalizeText(cleanName)
              );
              if (match) console.log(`Encontrada por coincidencia exacta: ${match.nombre || match.name}`);
              
              // 2. Búsqueda por palabras clave significativas
              if (!match) {
                // Búsqueda por palabras clave
                const keywords = cleanName.split(' ').filter(word => 
                  word.length > 2 && !['con', 'los', 'las', 'del', 'de', 'la', 'el', 'y'].includes(word.toLowerCase())
                );
                
                if (keywords.length > 0) {
                  console.log(`Buscando por palabras clave: ${keywords.join(', ')}`);
                  match = itemsMenu.find(i => {
                    const menuItemName = normalizeText(i.nombre || i.name || '');
                    // Una pizza coincide si todas sus palabras clave están en el nombre del menú
                    return keywords.every(word => menuItemName.includes(normalizeText(word)));
                  });
                  if (match) console.log(`Encontrada por palabras clave: ${match.nombre || match.name}`);
                }
              }
              
              // 3. Búsqueda por coincidencia parcial
              if (!match) {
                match = itemsMenu.find(i => {
                  const menuItemName = normalizeText(i.nombre || i.name || '');
                  const normalizedPizzaName = normalizeText(cleanName);
                  return menuItemName.includes(normalizedPizzaName) || normalizedPizzaName.includes(menuItemName);
                });
                if (match) console.log(`Encontrada por coincidencia parcial: ${match.nombre || match.name}`);
              }
              
              // 4. Búsqueda por primeras palabras
              if (!match) {
                const firstTwoWords = normalizeText(cleanName).split(' ').slice(0,2).join(' ');
                if (firstTwoWords.length > 3) { // Solo si son palabras significativas
                  match = itemsMenu.find(i => normalizeText(i.nombre || i.name || '').includes(firstTwoWords));
                  if (match) console.log(`Encontrada por primeras palabras: ${match.nombre || match.name}`);
                }
              }
              
              // 5. Búsqueda más flexible si aún no se encuentra
              if (!match && cleanName.length >= 4) {
                console.log(`Intento final de búsqueda con coincidencia parcial más flexible`);
                
                // Buscar por la primera parte del nombre (primeros 4 caracteres)
                const firstChars = normalizeText(cleanName).substring(0, 4);
                match = itemsMenu.find(i => normalizeText(i.nombre || i.name || '').includes(firstChars));
                
                if (match) console.log(`Encontrada por coincidencia flexible: ${match.nombre || match.name}`);
              }
              
              // Si no encontramos nada, mostrar qué pizzas están disponibles (para diagnóstico)
              if (!match && cleanName.length > 3) {
                console.log(`⚠️ No se pudo encontrar la pizza "${cleanName}". Mostrando algunas opciones disponibles:`);
                const availablePizzas = itemsMenu
                  .filter(i => i.nombre || i.name)
                  .map(i => i.nombre || i.name)
                  .slice(0, 10);
                console.log(availablePizzas.join(", "));
              }
              
              return match;
            };
            
            const matchedPizza1 = findPizzaInMenu(pizza1Name);
            const matchedPizza2 = findPizzaInMenu(pizza2Name);
            
            // Log detallado para diagnóstico
            console.log(`Búsqueda de Pizza 1 "${pizza1Name}": ${matchedPizza1 ? 'ENCONTRADA - ' + matchedPizza1.nombre : 'NO ENCONTRADA'}`);
            console.log(`Búsqueda de Pizza 2 "${pizza2Name}": ${matchedPizza2 ? 'ENCONTRADA - ' + matchedPizza2.nombre : 'NO ENCONTRADA'}`);
            
            // Preparar recetas para ambas mitades
            let recipe1: RecipeLine[] = [];
            let recipe2: RecipeLine[] = [];
            
            // Procesar pizza1
            if (matchedPizza1) {
              let receta1 = null;
              
              // Seleccionar la receta adecuada según el tamaño
              if (size === 'mediana' && matchedPizza1.recetaMediana && Array.isArray(matchedPizza1.recetaMediana) && matchedPizza1.recetaMediana.length > 0) {
                receta1 = matchedPizza1.recetaMediana;
                console.log(`Pizza 1 (${item.pizza1}): Usando receta MEDIANA con ${receta1.length} ingredientes`);
              } else if (matchedPizza1.receta && Array.isArray(matchedPizza1.receta) && matchedPizza1.receta.length > 0) {
                receta1 = matchedPizza1.receta;
                console.log(`Pizza 1 (${item.pizza1}): Usando receta FAMILIAR con ${receta1.length} ingredientes`);
              }
              
              if (receta1 && receta1.length > 0) {
                // Preparar MITAD de la receta para la primera pizza
                recipe1 = receta1.map((r: any) => {
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
                    cantidad: halfCantidad, // MITAD de ingredientes con precisión
                    unidad: r.unidad
                  };
                }).filter(Boolean); // Eliminamos valores nulos
                
                console.log(`Preparada mitad de receta para ${item.pizza1} con ${recipe1.length} ingredientes`);
                // Mostrar detalles de algunos ingredientes para debugging
                if (recipe1.length > 0) {
                  console.log(`Muestra de ingredientes pizza 1: ${JSON.stringify(recipe1.slice(0, 2))}`);
                }
              } else {
                console.log(`No se encontró receta válida para la pizza 1: ${item.pizza1}`);
              }
            } else {
              console.log(`No se encontró la pizza 1 en el menú: ${item.pizza1}`);
            }
            
            // Procesar pizza2
            if (matchedPizza2) {
              let receta2 = null;
              
              // Seleccionar la receta adecuada según el tamaño
              if (size === 'mediana' && matchedPizza2.recetaMediana && Array.isArray(matchedPizza2.recetaMediana) && matchedPizza2.recetaMediana.length > 0) {
                receta2 = matchedPizza2.recetaMediana;
                console.log(`Pizza 2 (${item.pizza2}): Usando receta MEDIANA con ${receta2.length} ingredientes`);
              } else if (matchedPizza2.receta && Array.isArray(matchedPizza2.receta) && matchedPizza2.receta.length > 0) {
                receta2 = matchedPizza2.receta;
                console.log(`Pizza 2 (${item.pizza2}): Usando receta FAMILIAR con ${receta2.length} ingredientes`);
              }
              
              if (receta2 && receta2.length > 0) {
                // Preparar MITAD de la receta para la segunda pizza
                recipe2 = receta2.map((r: any) => {
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
                    cantidad: halfCantidad, // MITAD de ingredientes con precisión
                    unidad: r.unidad
                  };
                }).filter(Boolean); // Eliminamos valores nulos
                
                console.log(`Preparada mitad de receta para ${item.pizza2} con ${recipe2.length} ingredientes`);
                // Mostrar detalles de algunos ingredientes para debugging
                if (recipe2.length > 0) {
                  console.log(`Muestra de ingredientes pizza 2: ${JSON.stringify(recipe2.slice(0, 2))}`);
                }
              } else {
                console.log(`No se encontró receta válida para la pizza 2: ${item.pizza2}`);
              }
            } else {
              console.log(`No se encontró la pizza 2 en el menú: ${item.pizza2}`);
            }
            
            // Combinar las recetas de ambas mitades
            if (recipe1.length > 0 || recipe2.length > 0) {
              // 🔍 DEBUG: Mostrar recetas ANTES de combinar
              console.log('\n🔍 ========== DEBUG PIZZA DÚO - DETALLE COMPLETO ==========');
              console.log(`\n📋 PIZZA 1 (${item.pizza1}) - ${recipe1.length} ingredientes:`);
              recipe1.forEach((ing, idx) => {
                console.log(`   ${idx + 1}. ID: ${ing.ingredienteId}, Cantidad: ${ing.cantidad} ${ing.unidad || 'u'}`);
              });
              
              console.log(`\n📋 PIZZA 2 (${item.pizza2}) - ${recipe2.length} ingredientes:`);
              recipe2.forEach((ing, idx) => {
                console.log(`   ${idx + 1}. ID: ${ing.ingredienteId}, Cantidad: ${ing.cantidad} ${ing.unidad || 'u'}`);
              });
              
              // Combinar ambas recetas, sumando cantidades para ingredientes comunes
              recipe = combineRecipes(recipe1, recipe2);
              
              console.log(`\n📋 RECETA COMBINADA - ${recipe.length} ingredientes únicos:`);
              recipe.forEach((ing, idx) => {
                console.log(`   ${idx + 1}. ID: ${ing.ingredienteId}, Cantidad: ${ing.cantidad} ${ing.unidad || 'u'}`);
              });
              console.log('🔍 ========================================================\n');
              
              // Verificación adicional para asegurar que todos los ingredientes estén incluidos
              if (recipe.length === 0) {
                console.error(`¡ATENCIÓN! Receta combinada está vacía a pesar de tener ingredientes individuales`);
              } else if (recipe.length < (recipe1.length + recipe2.length - 5)) {
                // Si hay muchos ingredientes menos de los esperados (permitiendo algunos comunes), mostrar advertencia
                console.warn(`¡Advertencia! Posible pérdida de ingredientes en la combinación: 
                    Recipe1: ${recipe1.length} + Recipe2: ${recipe2.length} -> Combinada: ${recipe.length}`);
              }
            } else {
              console.log(`No se encontraron ingredientes para ninguna de las mitades de la pizza Duo`);
            }
            
            // Añadir extras de la pizza Duo si los hay
            const extraLines = buildRecipeLinesFromIngredients(item, ingredientesByName);
            if (extraLines.length > 0) {
              recipe = [...recipe, ...extraLines];
              console.log(`Añadiendo ${extraLines.length} extras para la pizza Duo`);
            }
          } else {
            // Caso de pizza normal (no Duo) - código existente
            const matchedItem = itemsMenu.find(i => {
              const normalizedMenuItemName = normalizeText(i.nombre || i.name || '');
              
              // Comparar nombres normalizados
              return normalizedMenuItemName === normalizedItemName ||
                    normalizedMenuItemName.includes(normalizedItemName) ||
                    normalizedItemName.includes(normalizedMenuItemName);
            })
            
            if (matchedItem) {
              // Determinar qué receta usar según el tamaño
              const size = item.size?.toLowerCase() || '';
              let receta = null;
              
              if (size === 'mediana' && matchedItem.recetaMediana && Array.isArray(matchedItem.recetaMediana)) {
                // Si es mediana y tiene receta específica, usar recetaMediana
                receta = matchedItem.recetaMediana;
                console.log(`Consumiendo receta MEDIANA para "${itemName}" con ${receta.length} ingredientes`);
              } else if (matchedItem.receta && Array.isArray(matchedItem.receta)) {
                // Por defecto usar la receta familiar
                receta = matchedItem.receta;
                console.log(`Consumiendo receta FAMILIAR para "${itemName}" con ${receta.length} ingredientes`);
              }
              
              if (receta) {
                recipe = receta.map((r: any) => ({ 
                  ingredienteId: r.ingredienteId, 
                  cantidad: Number(r.cantidad) || 0, 
                  unidad: r.unidad 
                }))
              }
            }
            
            // SIEMPRE procesar extras, independiente de si hay receta base o no
            const extraLines = buildRecipeLinesFromIngredients(item, ingredientesByName);
            if (extraLines.length > 0) {
              if (recipe.length > 0) {
                // Si hay receta base, combinar con extras
                recipe = [...recipe, ...extraLines];
                console.log(`✅ Añadiendo ${extraLines.length} ingredientes extras a la receta base de "${itemName}"`);
              } else {
                // Si no hay receta base, usar solo los extras (pizza armada desde cero)
                recipe = extraLines;
                console.log(`✅ Usando ${extraLines.length} ingredientes personalizados para "${itemName}" (pizza armada desde cero)`);
              }
            }
          }
          
          if (recipe.length === 0) {
            console.error(`No se encontró receta para "${itemName}" y no tiene ingredientes seleccionados.`);
            // No se puede procesar el pedido si un producto no tiene receta
            throw new Error(`No se puede procesar el producto "${itemName}" porque no tiene receta definida.`);
          }
          
          // Procesar cada línea de la receta - SOLO LECTURAS
          for (const line of recipe) {
            const ingRef = doc(db, 'ingredientes', line.ingredienteId)
            const snap = await transaction.get(ingRef)
            
            if (!snap.exists()) {
              continue; // Saltar si el ingrediente no existe
            }
            
            const data = snap.data();
            const stockActual = Number(data?.stockActual || 0)
            const ingredientName = data?.nombre || 'Ingrediente';
            
            // Normalizar unidades a gramos cuando sea posible
            const neededConv = toGrams((Number(line.cantidad) || 0) * qty, line.unidad)
            const stockConv = toGrams(stockActual, data?.unidad)
            
            // Verificar compatibilidad de unidades
            if (neededConv.unit !== stockConv.unit) {
              throw new Error(`Unidad incompatible para ingrediente ${ingredientName}`);
            }
            
            // Calcular nuevo stock
            const remaining = stockConv.value - neededConv.value;
            if (remaining < 0) {
              throw new Error(`Stock insuficiente para ${ingredientName}`);
            }
            
            // Calcular nuevo valor de stock en la unidad original
            let newStockValue = remaining;
            if (data?.unidad === 'kg' && neededConv.unit === 'g') {
              newStockValue = remaining / 1000;
            }
            
            console.log(`Actualizando inventario: ${ingredientName} - Stock actual: ${stockActual} ${data?.unidad || 'u'} - Consumido: ${(Number(line.cantidad) || 0) * qty} ${line.unidad || 'u'} - Nuevo stock: ${newStockValue} ${data?.unidad || 'u'}`);
            
            // Actualizar estado según el stock resultante
            const stockMinimo = Number(data?.stockMinimo || 0)
            const fechaVencimiento = data?.fechaVencimiento
            const nuevoEstado = computeEstado({ 
              stockActual: newStockValue, 
              stockMinimo, 
              fechaVencimiento 
            });
            
            // Almacenar la información para actualizar después
            updateOperations.push({
              ref: ingRef,
              data: {
                stockActual: newStockValue,
                estado: nuevoEstado,
                updatedAt: Timestamp.now().toDate().toISOString()
              },
              ingredientInfo: {
                ingredienteId: line.ingredienteId,
                nombre: ingredientName,
                cantidadAnterior: stockActual,
                cantidadConsumida: (Number(line.cantidad) || 0) * qty,
                cantidadNueva: newStockValue,
                unidad: data?.unidad || line.unidad
              }
            });
          }
        }
        
        // SEGUNDA FASE: Realizar todas las escrituras después de completar todas las lecturas
        for (const operation of updateOperations) {
          // Actualizar en Firestore
          transaction.update(operation.ref, operation.data);
          
          // Registrar para la transacción
          transactionItems.push(operation.ingredientInfo);
        }
      });
      } else {
        // Modo simulación - recopilar los mismos datos pero sin hacer cambios en Firestore
        console.log("Ejecutando en modo de simulación - no se modificará el inventario");
        
        // Recopilar los mismos datos que en modo normal pero sin modificar la BD
        for (const item of orderItems) {
          const qty = item.cantidad || item.quantity || 1;
          const itemName = (item.nombre || item.name || '').toLowerCase().trim();
          
          // 1. Verificar si es una pizza Duo
          const isDuoPizza = item.pizzaType === 'duo' && item.pizza1 && item.pizza2;
          
          // Código específico para pizzas Duo en modo simulación
          if (isDuoPizza) {
            console.log(`[SIMULACIÓN] Procesando Pizza Duo: ${itemName} (${item.pizza1} / ${item.pizza2})`);
          }
          
          // Aquí no realizamos acciones reales sobre el inventario
        }
      }
    } catch (error: any) {
      success = false;
      errorMessage = error?.message || 'Error al procesar inventario';
      console.error('Error en transacción de inventario:', error);
    }
    
    // 5. Actualizar la transacción con el resultado final
    const updateData: any = {
      items: transactionItems,
      status: success ? 'success' : 'failed'
    };
    
    // Solo agregar el campo error si hay un error
    if (!success && errorMessage) {
      updateData.error = errorMessage;
    }
    
    await updateDoc(doc(db, 'inventory_transactions', transactionDoc.id), updateData);
    
    return {
      success,
      transactionId: transactionDoc.id,
      error: success ? undefined : errorMessage,
      simulatedItems: simulationMode ? transactionItems : undefined
    };
  } catch (err: any) {
    console.error('Error consumiendo inventario:', err)
    
    // Registrar el error para resolución manual
    try {
      const transactionDocData: any = {
        orderId,
        orderNumber,
        timestamp: Timestamp.now().toDate().toISOString(),
        items: [],
        status: 'manual'
      };
      
      // Solo agregar el error si existe y no es undefined
      if (err?.message) {
        transactionDocData.error = err.message;
      } else if (typeof err === 'string') {
        transactionDocData.error = err;
      }
      
      const transactionDoc = await addDoc(collection(db, 'inventory_transactions'), transactionDocData)
      
      return {
        success: false,
        transactionId: transactionDoc.id,
        error: err?.message || String(err)
      }
    } catch (logErr) {
      console.error('Error registrando transacción fallida:', logErr)
      return {
        success: false,
        error: err?.message || String(err)
      }
    }
  }
}

// Reintentar una transacción fallida
export async function retryInventoryTransaction(transactionId: string): Promise<{
  success: boolean,
  data?: InventoryTransaction,
  error?: string
}> {
  try {
    const transactionRef = doc(db, 'inventory_transactions', transactionId)
    const transactionDoc = await getDoc(transactionRef)
    
    if (!transactionDoc.exists()) {
      return { success: false, error: 'Transacción no encontrada' }
    }
    
    const transaction = transactionDoc.data() as InventoryTransaction
    
    // Solo reintentar si está en estado failed y no ha excedido el máximo de reintentos
    if (transaction.status !== 'failed' || (transaction.retryCount || 0) >= 3) {
      return { 
        success: false, 
        error: 'Transacción no es elegible para reintento',
        data: transaction 
      }
    }
    
    // Marcar como en proceso de reintento
    await updateDoc(transactionRef, {
      status: 'retry',
      retryCount: (transaction.retryCount || 0) + 1
    })
    
    // Recuperar la orden
    const orderId = transaction.orderId
    const orderRef = doc(db, 'orders', orderId)
    const orderDoc = await getDoc(orderRef)
    
    if (!orderDoc.exists()) {
      await updateDoc(transactionRef, {
        status: 'failed',
        error: 'Orden no encontrada'
      })
      return { success: false, error: 'Orden no encontrada' }
    }
    
    const orderData = orderDoc.data()
    
    // Reintentar el consumo de inventario
    const result = await consumeInventoryForOrder(
      orderData.items || [],
      orderId,
      transaction.orderNumber
    )
    
    if (result.success) {
      // Si el reintento tuvo éxito, actualizar el estado de la transacción original
      const updateData: any = {
        status: 'success'
      };
      
      // Eliminar el campo error si existe
      await updateDoc(transactionRef, updateData);
      
      // También actualizar la orden para quitar la marca de problema de inventario
      const orderUpdateData: any = {
        inventoryIssue: false
      };
      
      await updateDoc(orderRef, orderUpdateData);
      
      const updatedTransaction: InventoryTransaction = {
        ...transaction,
        status: 'success' as const
        // Eliminar el campo error
      }
      
      return { success: true, data: updatedTransaction }
    } else {
      // Si falló nuevamente, actualizar con el nuevo error
      await updateDoc(transactionRef, {
        status: 'failed',
        error: result.error
      })
      
      const updatedTransaction: InventoryTransaction = {
        ...transaction,
        status: 'failed' as const,
        error: result.error
      }
      
      return { success: false, error: result.error, data: updatedTransaction }
    }
  } catch (err: any) {
    console.error('Error reintentando transacción:', err)
    return { success: false, error: err?.message || String(err) }
  }
}

// Función para invalidar el caché forzosamente
export function invalidateCache() {
  cache.itemsMenu = null
  cache.ingredientes = null
  cache.ingredientesByName = null
  cache.ingredientsById = null
  cache.lastFetch = 0
}
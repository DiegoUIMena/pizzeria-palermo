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
        console.log(`Encontrado ingrediente "${parsed.name}" (${parsed.quantity} ${ingDoc.unidad || 'u'})`)
        lines.push({ 
          ingredienteId: ingDoc.id, 
          cantidad: parsed.quantity, 
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
          console.log(`Encontrado ingrediente similar: "${ingData.nombre}" para "${parsed.name}"`)
          lines.push({
            ingredienteId: ingData.id,
            cantidad: parsed.quantity,
            unidad: ingData.unidad || 'u'
          });
        } else {
          console.log(`No se encontró ingrediente para "${parsed.name}"`)
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

      // Buscar receta en items_menu
      const matchedItem = itemsMenu.find(i => {
        // Normalizar nombres para comparación
        const normalizeText = (text: string): string => {
          return (text || '').toLowerCase()
                  .normalize("NFD")
                  .replace(/[\u0300-\u036f]/g, "")
                  .trim();
        };
        
        const normalizedItemName = normalizeText(itemName);
        const normalizedMenuItemName = normalizeText(i.nombre || i.name || '');
        
        // Comparar nombres normalizados
        return normalizedMenuItemName === normalizedItemName ||
               normalizedMenuItemName.includes(normalizedItemName) ||
               normalizedItemName.includes(normalizedMenuItemName);
      })
      
      if (matchedItem && matchedItem.receta && Array.isArray(matchedItem.receta)) {
        console.log(`Encontrada receta para "${itemName}" con ${matchedItem.receta.length} ingredientes`);
        // Verificar disponibilidad de la receta
        const recipe: RecipeLine[] = matchedItem.receta.map((r: any) => ({ 
          ingredienteId: r.ingredienteId, 
          cantidad: Number(r.cantidad) || 0, 
          unidad: r.unidad 
        }))
        
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
export async function consumeInventoryForOrder(orderItems: any[], orderId: string, orderNumber: number): Promise<{
  success: boolean
  transactionId?: string
  error?: string
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
      // Ejecutar en una transacción de Firestore para garantizar atomicidad
      await runTransaction(db, async (transaction) => {
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
          
          const matchedItem = itemsMenu.find(i => {
            const normalizedMenuItemName = normalizeText(i.nombre || i.name || '');
            
            // Comparar nombres normalizados
            return normalizedMenuItemName === normalizedItemName ||
                  normalizedMenuItemName.includes(normalizedItemName) ||
                  normalizedItemName.includes(normalizedMenuItemName);
          })
          
          let recipe: RecipeLine[] = []
          
          if (matchedItem && matchedItem.receta && Array.isArray(matchedItem.receta)) {
            console.log(`Consumiendo receta para "${itemName}" con ${matchedItem.receta.length} ingredientes`);
            // Usar receta definida
            recipe = matchedItem.receta.map((r: any) => ({ 
              ingredienteId: r.ingredienteId, 
              cantidad: Number(r.cantidad) || 0, 
              unidad: r.unidad 
            }))
          } else {
            // Construir receta a partir de ingredientes seleccionados
            recipe = buildRecipeLinesFromIngredients(item, ingredientesByName)
          }
          
          if (recipe.length === 0) continue;
          
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
      error: success ? undefined : errorMessage
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
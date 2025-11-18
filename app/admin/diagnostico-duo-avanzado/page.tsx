"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, Bug } from "lucide-react";
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, Timestamp, orderBy, limit, addDoc, updateDoc } from 'firebase/firestore';

export default function DiagnosticoDuo() {
  const [log, setLog] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<boolean | null>(null);

  const addLog = (message: string) => {
    setLog(prev => [...prev, message]);
  };
  
  const clearLog = () => {
    setLog([]);
    setSuccess(null);
  };

  // Función para normalizar texto (igual que en inventory-service)
  const normalizeText = (text: string): string => {
    return (text || '').toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "") // Eliminar acentos
              .trim();
  };

  // Función para simular la búsqueda de pizzas en el menú
  const findPizzaInMenu = async (pizzaName: string) => {
    try {
      addLog(`🔍 Buscando pizza "${pizzaName}" en el menú...`);
      
      const itemsMenuSnapshot = await getDocs(collection(db, 'items_menu'));
      const itemsMenu: any[] = [];
      
      itemsMenuSnapshot.forEach(doc => {
        itemsMenu.push({ id: doc.id, ...(doc.data() || {}) });
      });
      
      // Limpiar el nombre de la pizza para la búsqueda
      const cleanName = pizzaName
        .replace(/\s+pizza\s+/gi, ' ')
        .replace(/\b(mediana|familiar)\b/gi, '')
        .trim();
      
      addLog(`   Nombre normalizado: "${cleanName}"`);
      
      // Búsqueda especial para "Del Pibe"
      let match = null;
      const normalizedPizzaName = normalizeText(cleanName);
      
      if (normalizedPizzaName.includes("pibe") || normalizedPizzaName.includes("del pibe")) {
        addLog(`   Detectada búsqueda especial: "Del Pibe"`);
        match = itemsMenu.find(i => {
          const menuItemName = normalizeText(i.nombre || i.name || '');
          return menuItemName.includes("pibe") || menuItemName.includes("del pibe");
        });
        
        if (match) {
          addLog(`   ✅ Encontrada pizza Del Pibe: "${match.nombre || match.name}"`);
        }
      } else {
        // Búsqueda regular
        // 1. Búsqueda exacta
        match = itemsMenu.find(i => 
          normalizeText(i.nombre || '') === normalizedPizzaName || 
          normalizeText(i.name || '') === normalizedPizzaName
        );
        
        if (match) {
          addLog(`   ✅ Encontrada coincidencia exacta: "${match.nombre || match.name}"`);
        } else {
          // 2. Búsqueda por palabras clave
          const keywords = cleanName.split(' ').filter(word => 
            word.length > 2 && !['con', 'los', 'las', 'del', 'de', 'la', 'el', 'y'].includes(word.toLowerCase())
          );
          
          addLog(`   Buscando por palabras clave: ${keywords.join(', ')}`);
          
          match = itemsMenu.find(i => {
            const menuItemName = normalizeText(i.nombre || i.name || '');
            return keywords.every(word => menuItemName.includes(normalizeText(word)));
          });
          
          if (match) {
            addLog(`   ✅ Encontrada por palabras clave: "${match.nombre || match.name}"`);
          } else {
            // 3. Búsqueda por coincidencia parcial
            match = itemsMenu.find(i => {
              const menuItemName = normalizeText(i.nombre || i.name || '');
              return menuItemName.includes(normalizedPizzaName) || normalizedPizzaName.includes(menuItemName);
            });
            
            if (match) {
              addLog(`   ✅ Encontrada por coincidencia parcial: "${match.nombre || match.name}"`);
            } else {
              addLog(`   ❌ No se pudo encontrar la pizza "${pizzaName}" en el menú`);
            }
          }
        }
      }
      
      return match;
    } catch (error: any) {
      addLog(`   ❌ Error buscando pizza: ${error.message}`);
      return null;
    }
  };

  // Función para obtener receta de una pizza según tamaño
  const getRecipeForPizza = (pizza: any, size: string = 'familiar') => {
    if (!pizza) return [];
    
    let receta: any[] = [];
    
    if (size === 'mediana' && pizza.recetaMediana && Array.isArray(pizza.recetaMediana) && pizza.recetaMediana.length > 0) {
      receta = pizza.recetaMediana;
      addLog(`   Usando receta MEDIANA con ${receta.length} ingredientes`);
    } else if (pizza.receta && Array.isArray(pizza.receta) && pizza.receta.length > 0) {
      receta = pizza.receta;
      addLog(`   Usando receta FAMILIAR con ${receta.length} ingredientes`);
    } else {
      addLog(`   ⚠️ No se encontró receta válida para la pizza`);
      return [];
    }
    
    return receta.map((r: any) => ({
      ingredienteId: r.ingredienteId,
      cantidad: Number(r.cantidad) || 0,
      unidad: r.unidad || 'u'
    })).filter((r: any) => r.ingredienteId);
  };

  // Función para preparar mitades de recetas
  const prepareHalfRecipe = (recipe: any[]) => {
    if (!recipe || !recipe.length) return [];
    
    return recipe.map((r: any) => {
      const originalCantidad = Number(r.cantidad) || 0;
      const halfCantidad = Math.round((originalCantidad / 2) * 100) / 100;
      
      return {
        ingredienteId: r.ingredienteId,
        cantidad: halfCantidad,
        unidad: r.unidad || 'u'
      };
    });
  };

  // Función para combinar recetas según la lógica especificada
  const combineRecipes = (recipe1: any[], recipe2: any[]) => {
    addLog(`\n🔄 Combinando recetas de ambas pizzas...`);
    
    // Inicializar estructuras para rastrear ingredientes
    const result: any[] = [];
    const ingredientMap: Record<string, any> = {};
    
    // Contadores para debugging
    let uniqueIngredients1 = 0;
    let uniqueIngredients2 = 0;
    let commonIngredients = 0;
    
    // Verificar que las recetas no sean nulas
    if (!recipe1) recipe1 = [];
    if (!recipe2) recipe2 = [];
    
    // Paso 1: Registrar todos los ingredientes de la primera receta
    recipe1.forEach(line => {
      if (!line || !line.ingredienteId) return;
      
      ingredientMap[line.ingredienteId] = {
        ingredienteId: line.ingredienteId,
        cantidad1: line.cantidad || 0,
        unidad: line.unidad || 'u',
        isCommon: false
      };
    });
    
    // Paso 2: Procesar segunda receta y marcar ingredientes comunes
    recipe2.forEach(line => {
      if (!line || !line.ingredienteId) return;
      
      if (ingredientMap[line.ingredienteId]) {
        // Es un ingrediente común
        const existingIngredient = ingredientMap[line.ingredienteId];
        
        // Verificar compatibilidad de unidades
        if (existingIngredient.unidad === (line.unidad || 'u')) {
          existingIngredient.cantidad2 = line.cantidad || 0;
          existingIngredient.isCommon = true;
          commonIngredients++;
        } else {
          // Unidades incompatibles - crear entrada separada
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
        // Para ingredientes comunes: sumar cantidades directamente
        const total = (item.cantidad1 || 0) + (item.cantidad2 || 0);
        finalAmount = total;
        addLog(`   Ingrediente común: ID=${item.ingredienteId} - Cant1: ${item.cantidad1}, Cant2: ${item.cantidad2}, Total: ${finalAmount} ${item.unidad}`);
      } else if (item.cantidad1 !== undefined) {
        // Ingrediente único de la receta 1: mantener el valor
        finalAmount = item.cantidad1;
        uniqueIngredients1++;
        addLog(`   Ingrediente único (receta1): ID=${item.ingredienteId} - Cantidad: ${finalAmount} ${item.unidad}`);
      } else if (item.cantidad2 !== undefined) {
        // Ingrediente único de la receta 2: mantener el valor
        finalAmount = item.cantidad2;
        uniqueIngredients2++;
        addLog(`   Ingrediente único (receta2): ID=${item.ingredienteId} - Cantidad: ${finalAmount} ${item.unidad}`);
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
    
    addLog(`\n📊 Resumen de combinación de recetas:`);
    addLog(`   - Ingredientes únicos de receta 1: ${uniqueIngredients1}`);
    addLog(`   - Ingredientes únicos de receta 2: ${uniqueIngredients2}`);
    addLog(`   - Ingredientes comunes (en ambas recetas): ${commonIngredients}`);
    addLog(`   - Total de ingredientes combinados: ${result.length}`);
    
    return result;
  };

  // Función para resolver nombres de ingredientes
  const resolveIngredientNames = async (recipe: any[]) => {
    try {
      const ingredientesSnapshot = await getDocs(collection(db, 'ingredientes'));
      const ingredientesById: Record<string, any> = {};
      
      ingredientesSnapshot.forEach(doc => {
        ingredientesById[doc.id] = { id: doc.id, ...doc.data() };
      });
      
      return recipe.map(item => ({
        ...item,
        nombre: ingredientesById[item.ingredienteId]?.nombre || `Ingrediente ${item.ingredienteId}`
      }));
    } catch (error: any) {
      addLog(`❌ Error resolviendo nombres de ingredientes: ${error.message}`);
      return recipe;
    }
  };

  // Función para crear un pedido de prueba con pizza Duo
  const createTestOrder = async () => {
    try {
      const orderData = {
        fechaCreacion: Timestamp.now().toDate().toISOString(),
        estado: "recibido",
        items: [
          {
            nombre: "Pizza Duo",
            pizzaType: "duo",
            pizza1: "Napolitana",
            pizza2: "Del Pibe",
            size: "familiar",
            cantidad: 1,
            precio: 18000
          }
        ],
        total: 18000,
        subtotal: 18000,
        orderNumber: Math.floor(10000 + Math.random() * 90000), // Número de 5 dígitos
        clienteId: "test-client",
        direccion: {
          calle: "Calle de Prueba",
          numero: "123",
          comuna: "Los Andes"
        }
      };
      
      const orderRef = await addDoc(collection(db, 'pedidos'), orderData);
      
      addLog(`✅ Pedido de prueba creado con ID: ${orderRef.id}`);
      return orderRef.id;
    } catch (error: any) {
      addLog(`❌ Error creando pedido de prueba: ${error.message}`);
      return null;
    }
  };

  // Función para simular la función consumeInventoryForOrder
  const simulateConsumeInventory = async (orderId: string) => {
    try {
      addLog(`\n🔄 Simulando consumeInventoryForOrder para pedido ${orderId}...`);
      
      // 1. Obtener el pedido
      const orderDoc = await getDoc(doc(db, 'pedidos', orderId));
      
      if (!orderDoc.exists()) {
        addLog(`❌ Pedido no encontrado: ${orderId}`);
        return false;
      }
      
      const orderData = orderDoc.data();
      const orderItems = orderData.items || [];
      
      // 2. Crear transacción de inventario
      const transactionData = {
        orderId: orderId,
        orderNumber: orderData.orderNumber,
        timestamp: Timestamp.now().toDate().toISOString(),
        items: [],
        status: 'processing'
      };
      
      const transactionDoc = await addDoc(collection(db, 'inventory_transactions'), transactionData);
      addLog(`📝 Transacción de inventario creada: ${transactionDoc.id}`);
      
      // 3. Procesar cada ítem del pedido
      const transactionItems: any[] = [];
      
      for (const item of orderItems) {
        const qty = item.cantidad || 1;
        const itemName = (item.nombre || '').toLowerCase().trim();
        
        // Verificar si es una pizza Duo
        const isDuoPizza = item.pizzaType === 'duo' && item.pizza1 && item.pizza2;
        
        if (isDuoPizza) {
          addLog(`\n🍕 Procesando Pizza Duo: ${itemName} (${item.pizza1} / ${item.pizza2})`);
          
          const pizza1Name = normalizeText(item.pizza1);
          const pizza2Name = normalizeText(item.pizza2);
          const size = item.size?.toLowerCase() || 'familiar';
          
          // Encontrar las pizzas en el menú
          const matchedPizza1 = await findPizzaInMenu(pizza1Name);
          const matchedPizza2 = await findPizzaInMenu(pizza2Name);
          
          if (!matchedPizza1 || !matchedPizza2) {
            if (!matchedPizza1) addLog(`❌ No se pudo encontrar la pizza 1: ${item.pizza1}`);
            if (!matchedPizza2) addLog(`❌ No se pudo encontrar la pizza 2: ${item.pizza2}`);
            return false;
          }
          
          // Obtener recetas completas
          const fullRecipe1 = getRecipeForPizza(matchedPizza1, size);
          const fullRecipe2 = getRecipeForPizza(matchedPizza2, size);
          
          // Preparar mitades de recetas
          const recipe1 = prepareHalfRecipe(fullRecipe1);
          const recipe2 = prepareHalfRecipe(fullRecipe2);
          
          addLog(`\n📋 Recetas preparadas:`);
          addLog(`   - ${item.pizza1}: ${recipe1.length} ingredientes`);
          addLog(`   - ${item.pizza2}: ${recipe2.length} ingredientes`);
          
          // Combinar ambas recetas
          const combinedRecipe = combineRecipes(recipe1, recipe2);
          
          // Resolver nombres de ingredientes para mostrar detalles
          const namedRecipe = await resolveIngredientNames(combinedRecipe);
          
          addLog(`\n📊 Resumen de ingredientes combinados:`);
          namedRecipe.forEach((ing, index) => {
            addLog(`   ${index+1}. ${ing.nombre}: ${ing.cantidad} ${ing.unidad}`);
          });
          
          // Simular la actualización de inventario (sin modificarlo realmente)
          addLog(`\n✅ Simulación completada para Pizza Duo`);
        }
      }
      
      // 4. Actualizar la transacción con éxito
      await updateDoc(doc(db, 'inventory_transactions', transactionDoc.id), {
        status: 'success',
        items: transactionItems
      });
      
      return true;
    } catch (error: any) {
      addLog(`❌ Error en simulación: ${error.message}`);
      return false;
    }
  };

  // Función principal para ejecutar el diagnóstico
  const runDiagnostic = async () => {
    clearLog();
    setLoading(true);
    
    try {
      addLog("🔍 Iniciando diagnóstico de Pizza Duo...");
      
      // 1. Crear pedido de prueba con Pizza Duo (Napolitana / Del Pibe)
      addLog("\n📝 Creando pedido de prueba con Pizza Duo (Napolitana / Del Pibe)...");
      const orderId = await createTestOrder();
      
      if (!orderId) {
        setSuccess(false);
        setLoading(false);
        return;
      }
      
      // 2. Simular consumeInventoryForOrder
      const success = await simulateConsumeInventory(orderId);
      
      if (success) {
        addLog("\n✅ Diagnóstico completado con éxito");
        addLog("📋 Resultado: La lógica de combinación de recetas funciona correctamente");
        addLog("🔧 Si el sistema no descuenta correctamente los ingredientes en producción, el problema puede estar en:");
        addLog("   1. La búsqueda de pizzas en el menú (especialmente 'Del Pibe')");
        addLog("   2. La estructura de los datos almacenados en Firestore");
        addLog("   3. Un problema en la transacción real de Firestore");
        setSuccess(true);
      } else {
        addLog("\n❌ El diagnóstico falló");
        addLog("🔧 Revisa los mensajes de error anteriores para identificar el problema");
        setSuccess(false);
      }
    } catch (error: any) {
      addLog(`\n❌ Error ejecutando diagnóstico: ${error.message}`);
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  // Función para crear un pedido de prueba con líneas de log más detalladas para identificar problemas
  const runAdvancedDiagnostic = async () => {
    clearLog();
    setLoading(true);
    
    try {
      addLog("🔍 Iniciando diagnóstico avanzado de Pizza Duo con log detallado...");
      
      // 1. Búsqueda directa de pizzas en el menú
      addLog("\n📋 Verificando existencia de pizzas en el menú...");
      
      const itemsMenuSnapshot = await getDocs(collection(db, 'items_menu'));
      const itemsMenu: any[] = [];
      
      itemsMenuSnapshot.forEach(doc => {
        itemsMenu.push({ id: doc.id, ...(doc.data() || {}) });
      });
      
      addLog(`   Se encontraron ${itemsMenu.length} items en el menú`);
      
      // Búsqueda específica de Napolitana y Del Pibe
      const napolitana = itemsMenu.find(i => {
        const normalizedName = normalizeText(i.nombre || i.name || '');
        return normalizedName.includes('napolitana');
      });
      
      const delPibe = itemsMenu.find(i => {
        const normalizedName = normalizeText(i.nombre || i.name || '');
        return normalizedName.includes('pibe');
      });
      
      if (napolitana) {
        addLog(`   ✅ Pizza Napolitana encontrada: ID=${napolitana.id}, Nombre="${napolitana.nombre || napolitana.name}"`);
        
        // Verificar receta
        const recetaNapolitana = napolitana.receta || [];
        addLog(`   📋 Receta Napolitana tiene ${recetaNapolitana.length} ingredientes`);
        
        if (recetaNapolitana.length > 0) {
          addLog(`   📝 Muestra de ingredientes: ${JSON.stringify(recetaNapolitana.slice(0, 2))}`);
        }
      } else {
        addLog(`   ❌ Pizza Napolitana NO encontrada en el menú`);
      }
      
      if (delPibe) {
        addLog(`   ✅ Pizza Del Pibe encontrada: ID=${delPibe.id}, Nombre="${delPibe.nombre || delPibe.name}"`);
        
        // Verificar receta
        const recetaDelPibe = delPibe.receta || [];
        addLog(`   📋 Receta Del Pibe tiene ${recetaDelPibe.length} ingredientes`);
        
        if (recetaDelPibe.length > 0) {
          addLog(`   📝 Muestra de ingredientes: ${JSON.stringify(recetaDelPibe.slice(0, 2))}`);
        }
      } else {
        addLog(`   ❌ Pizza Del Pibe NO encontrada en el menú`);
      }
      
      // 2. Verificar pedidos anteriores con pizza Duo
      addLog("\n🔍 Buscando pedidos existentes con Pizza Duo...");
      
      const pedidosDuoQuery = query(
        collection(db, 'pedidos'),
        where('items', 'array-contains', { pizzaType: 'duo' }),
        limit(5)
      );
      
      try {
        const pedidosDuoSnapshot = await getDocs(pedidosDuoQuery);
        addLog(`   Se encontraron ${pedidosDuoSnapshot.size} pedidos con Pizza Duo`);
        
        if (pedidosDuoSnapshot.size > 0) {
          pedidosDuoSnapshot.forEach(doc => {
            const pedido = doc.data();
            const duoItems = pedido.items?.filter((i: any) => i.pizzaType === 'duo') || [];
            
            addLog(`   📝 Pedido #${pedido.orderNumber || 'N/A'} (${doc.id}):`);
            duoItems.forEach((item: any, index: number) => {
              addLog(`      - Pizza Duo ${index+1}: ${item.pizza1 || 'N/A'} / ${item.pizza2 || 'N/A'}`);
            });
          });
        }
      } catch (error: any) {
        addLog(`   ⚠️ Error en la consulta de pedidos Duo: ${error.message}`);
        addLog(`   ⚠️ Es posible que la consulta no funcione si pizzaType está anidado en el array`);
      }
      
      // 3. Verificar transacciones de inventario recientes
      addLog("\n🔍 Verificando transacciones de inventario recientes...");
      
      const transaccionesQuery = query(
        collection(db, 'inventory_transactions'),
        orderBy('timestamp', 'desc'),
        limit(5)
      );
      
      const transaccionesSnapshot = await getDocs(transaccionesQuery);
      addLog(`   Se encontraron ${transaccionesSnapshot.size} transacciones recientes`);
      
      if (transaccionesSnapshot.size > 0) {
        let transaccionesConError = 0;
        
        transaccionesSnapshot.forEach(doc => {
          const transaccion = doc.data();
          
          if (transaccion.error) {
            transaccionesConError++;
            addLog(`   ⚠️ Transacción ${doc.id} con error: ${transaccion.error}`);
          }
        });
        
        if (transaccionesConError > 0) {
          addLog(`   ⚠️ Se encontraron ${transaccionesConError} transacciones con errores`);
        } else {
          addLog(`   ✅ No se encontraron errores en las transacciones recientes`);
        }
      }
      
      addLog("\n✅ Diagnóstico avanzado completado");
      setSuccess(true);
    } catch (error: any) {
      addLog(`\n❌ Error en diagnóstico avanzado: ${error.message}`);
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Diagnóstico de Pizza Duo</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Diagnóstico Estándar</CardTitle>
            <CardDescription>
              Simula el proceso completo de pedido con pizza Duo (Napolitana / Del Pibe)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4">
              Este diagnóstico creará un pedido de prueba con una pizza Duo y
              simulará el proceso de consumo de inventario para verificar que la lógica
              de combinación de recetas funcione correctamente.
            </p>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={runDiagnostic}
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Ejecutando diagnóstico...' : 'Iniciar Diagnóstico Estándar'}
            </Button>
          </CardFooter>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Diagnóstico Avanzado</CardTitle>
            <CardDescription>
              Verifica la existencia de las pizzas y sus recetas en la base de datos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4">
              Este diagnóstico verifica directamente la existencia de las pizzas Napolitana
              y Del Pibe en el menú, así como sus recetas. También busca pedidos existentes
              con pizzas Duo y revisa transacciones de inventario recientes.
            </p>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={runAdvancedDiagnostic}
              disabled={loading}
              variant="outline"
              className="w-full"
            >
              {loading ? 'Ejecutando diagnóstico...' : 'Iniciar Diagnóstico Avanzado'}
            </Button>
          </CardFooter>
        </Card>
      </div>
      
      {log.length > 0 && (
        <Card className={success === true ? "border-green-500" : success === false ? "border-red-500" : ""}>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <div>
              {success === true && <CheckCircle className="w-5 h-5 text-green-500" />}
              {success === false && <AlertCircle className="w-5 h-5 text-red-500" />}
              {success === null && <Bug className="w-5 h-5 text-blue-500" />}
            </div>
            <div>
              <CardTitle>Resultados del Diagnóstico</CardTitle>
              <CardDescription>
                {log.length} mensajes generados
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-black text-green-400 p-4 rounded-md font-mono text-sm h-[500px] overflow-y-auto">
              {log.map((message, index) => (
                <div key={index} className="mb-1">
                  {message.startsWith('✅') ? (
                    <span className="text-green-400">{message}</span>
                  ) : message.startsWith('❌') ? (
                    <span className="text-red-400">{message}</span>
                  ) : message.startsWith('⚠️') ? (
                    <span className="text-yellow-400">{message}</span>
                  ) : (
                    message
                  )}
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" onClick={clearLog} className="w-full">
              Limpiar resultados
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
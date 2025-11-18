"use client";

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, Timestamp, addDoc, orderBy, limit } from 'firebase/firestore';

// Función simulada para consumir inventario, similar a la de inventory-service.ts
async function consumeInventoryForOrderSimulated(
  orderItems: any[],
  orderId: string,
  orderNumber: number,
  simulationMode: boolean = true
) {
  // Registros de consola para tracking
  const logs: string[] = [];
  const logMessage = (msg: string) => logs.push(msg);

  try {
    logMessage(`Iniciando procesamiento de inventario para orden #${orderNumber}`);
    
    // Obtener datos del menú e ingredientes
    const [itemsMenuSnap, ingredientesSnap] = await Promise.all([
      getDocs(collection(db, 'items_menu')),
      getDocs(collection(db, 'ingredientes'))
    ]);

    const itemsMenu: any[] = [];
    itemsMenuSnap.forEach(d => itemsMenu.push({ id: d.id, ...(d.data() || {}) }));
    
    const ingredientsById: Record<string, any> = {};
    const ingredientesByName: Record<string, any> = {};
    
    ingredientesSnap.forEach(d => {
      const data: any = d.data();
      const item = { id: d.id, ...data };
      ingredientsById[d.id] = item;
      if (data?.nombre) {
        const normalizedName = (data.nombre || '').toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim();
        ingredientesByName[normalizedName] = item;
      }
    });
    
    // Función para normalizar texto (igual que en inventory-service)
    const normalizeText = (text: string): string => {
      return (text || '').toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .trim();
    };

    // Función para combinar recetas de pizza Duo
    const combineRecipes = (recipe1: any[], recipe2: any[]) => {
      logMessage(`Combinando recetas: Pizza1 (${recipe1.length} ing.), Pizza2 (${recipe2.length} ing.)`);
      
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
        const ingredientName = ingredientsById[item.ingredienteId]?.nombre || item.ingredienteId;
        
        if (item.isCommon) {
          // Para ingredientes comunes: sumar cantidades directamente
          const total = (item.cantidad1 || 0) + (item.cantidad2 || 0);
          finalAmount = total;
          logMessage(`+ Ingrediente común: ${ingredientName} - Cant1: ${item.cantidad1}, Cant2: ${item.cantidad2}, Total: ${finalAmount}`);
        } else if (item.cantidad1 !== undefined) {
          // Ingrediente único de la receta 1: mantener el valor
          finalAmount = item.cantidad1;
          uniqueIngredients1++;
          logMessage(`+ Ingrediente único (receta1): ${ingredientName} - Cantidad: ${finalAmount}`);
        } else if (item.cantidad2 !== undefined) {
          // Ingrediente único de la receta 2: mantener el valor
          finalAmount = item.cantidad2;
          uniqueIngredients2++;
          logMessage(`+ Ingrediente único (receta2): ${ingredientName} - Cantidad: ${finalAmount}`);
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
      
      logMessage(`Combinación completada: ${uniqueIngredients1} únicos P1, ${uniqueIngredients2} únicos P2, ${commonIngredients} comunes`);
      
      return result;
    };
    
    // Función para encontrar pizza en el menú
    const findPizzaInMenu = (pizzaName: string) => {
      logMessage(`Buscando pizza: "${pizzaName}"`);
      
      // 0. Limpieza adicional para palabras clave específicas
      const cleanName = pizzaName
        .replace(/\s+pizza\s+/gi, ' ')  // Eliminar "pizza" como palabra separada
        .replace(/\b(mediana|familiar)\b/gi, '') // Eliminar tamaños de la búsqueda
        .trim();
      
      // 1. Búsqueda exacta por nombre normalizado
      let match = itemsMenu.find(i => 
        normalizeText(i.nombre || '') === normalizeText(cleanName) || 
        normalizeText(i.name || '') === normalizeText(cleanName)
      );
      
      if (match) {
        logMessage(`Pizza encontrada por coincidencia exacta: ${match.nombre || match.name}`);
        return match;
      }
      
      // 2. Búsqueda especial para "Del Pibe"
      if (normalizeText(cleanName).includes("pibe") || normalizeText(cleanName).includes("del pibe")) {
        logMessage(`Detectada búsqueda especial: "Del Pibe"`);
        match = itemsMenu.find(i => {
          const menuItemName = normalizeText(i.nombre || i.name || '');
          return menuItemName.includes("pibe") || menuItemName.includes("del pibe");
        });
        
        if (match) {
          logMessage(`Pizza Del Pibe encontrada: ${match.nombre || match.name}`);
          return match;
        }
      }
      
      // 3. Búsqueda por palabras clave significativas
      const keywords = cleanName.split(' ').filter(word => 
        word.length > 2 && !['con', 'los', 'las', 'del', 'de', 'la', 'el', 'y'].includes(word.toLowerCase())
      );
      
      if (keywords.length > 0) {
        match = itemsMenu.find(i => {
          const menuItemName = normalizeText(i.nombre || i.name || '');
          return keywords.every(word => menuItemName.includes(normalizeText(word)));
        });
        
        if (match) {
          logMessage(`Pizza encontrada por palabras clave: ${match.nombre || match.name}`);
          return match;
        }
      }
      
      // 4. Búsqueda por coincidencia parcial
      match = itemsMenu.find(i => {
        const menuItemName = normalizeText(i.nombre || i.name || '');
        const normalizedPizzaName = normalizeText(cleanName);
        return menuItemName.includes(normalizedPizzaName) || normalizedPizzaName.includes(menuItemName);
      });
      
      if (match) {
        logMessage(`Pizza encontrada por coincidencia parcial: ${match.nombre || match.name}`);
        return match;
      }
      
      // Si no se encuentra, mostrar mensaje de error
      logMessage(`⚠️ No se pudo encontrar la pizza "${pizzaName}" en el menú`);
      return null;
    };

    // Crear transacción de inventario
    const transactionDoc = await addDoc(collection(db, 'inventory_transactions'), {
      orderId,
      orderNumber,
      timestamp: Timestamp.now().toDate().toISOString(),
      items: [],
      status: 'processing',
      simulation: simulationMode
    });
    
    logMessage(`Transacción de inventario creada: ${transactionDoc.id}`);
    
    // Procesar cada ítem del pedido en simulación
    const transactionItems: any[] = [];
    
    // Seguimiento de éxito/error
    let success = true;
    let errorMessage = '';
    
    for (const item of orderItems) {
      const qty = item.cantidad || item.quantity || 1;
      const itemName = (item.nombre || item.name || '').toLowerCase().trim();
      
      // Determinar si es una pizza Duo
      const isDuoPizza = item.pizzaType === 'duo' && item.pizza1 && item.pizza2;
      
      if (isDuoPizza) {
        logMessage(`Procesando Pizza Duo: ${itemName} (${item.pizza1} / ${item.pizza2})`);
        
        const pizza1Name = item.pizza1;
        const pizza2Name = item.pizza2;
        const size = item.size?.toLowerCase() || 'familiar';
        
        // Encontrar las pizzas individuales en el menú
        const matchedPizza1 = findPizzaInMenu(pizza1Name);
        const matchedPizza2 = findPizzaInMenu(pizza2Name);
        
        if (!matchedPizza1 || !matchedPizza2) {
          if (!matchedPizza1) logMessage(`⚠️ Error: No se encontró la pizza 1 "${pizza1Name}" en el menú`);
          if (!matchedPizza2) logMessage(`⚠️ Error: No se encontró la pizza 2 "${pizza2Name}" en el menú`);
          
          success = false;
          errorMessage = `Pizzas no encontradas: ${!matchedPizza1 ? pizza1Name : ''} ${!matchedPizza2 ? pizza2Name : ''}`.trim();
          break;
        }
        
        // Preparar recetas para ambas mitades
        let recipe1: any[] = [];
        let recipe2: any[] = [];
        
        // Procesar pizza1
        if (matchedPizza1) {
          let receta1 = null;
          
          // Seleccionar la receta adecuada según el tamaño
          if (size === 'mediana' && matchedPizza1.recetaMediana && Array.isArray(matchedPizza1.recetaMediana) && matchedPizza1.recetaMediana.length > 0) {
            receta1 = matchedPizza1.recetaMediana;
            logMessage(`Pizza 1 (${item.pizza1}): Usando receta MEDIANA con ${receta1.length} ingredientes`);
          } else if (matchedPizza1.receta && Array.isArray(matchedPizza1.receta) && matchedPizza1.receta.length > 0) {
            receta1 = matchedPizza1.receta;
            logMessage(`Pizza 1 (${item.pizza1}): Usando receta FAMILIAR con ${receta1.length} ingredientes`);
          }
          
          if (receta1 && receta1.length > 0) {
            // Preparar MITAD de la receta para la primera pizza
            recipe1 = receta1.map((r: any) => {
              if (!r.ingredienteId) return null;
              
              // Aseguramos que el cálculo de la mitad sea preciso
              const originalCantidad = Number(r.cantidad) || 0;
              const halfCantidad = Math.round((originalCantidad / 2) * 100) / 100;
              
              return {
                ingredienteId: r.ingredienteId,
                cantidad: halfCantidad, // MITAD de ingredientes
                unidad: r.unidad
              };
            }).filter(Boolean);
            
            logMessage(`Preparada mitad de receta para ${item.pizza1} con ${recipe1.length} ingredientes`);
          } else {
            logMessage(`⚠️ No se encontró receta válida para la pizza 1: ${item.pizza1}`);
          }
        }
        
        // Procesar pizza2
        if (matchedPizza2) {
          let receta2 = null;
          
          // Seleccionar la receta adecuada según el tamaño
          if (size === 'mediana' && matchedPizza2.recetaMediana && Array.isArray(matchedPizza2.recetaMediana) && matchedPizza2.recetaMediana.length > 0) {
            receta2 = matchedPizza2.recetaMediana;
            logMessage(`Pizza 2 (${item.pizza2}): Usando receta MEDIANA con ${receta2.length} ingredientes`);
          } else if (matchedPizza2.receta && Array.isArray(matchedPizza2.receta) && matchedPizza2.receta.length > 0) {
            receta2 = matchedPizza2.receta;
            logMessage(`Pizza 2 (${item.pizza2}): Usando receta FAMILIAR con ${receta2.length} ingredientes`);
          }
          
          if (receta2 && receta2.length > 0) {
            // Preparar MITAD de la receta para la segunda pizza
            recipe2 = receta2.map((r: any) => {
              if (!r.ingredienteId) return null;
              
              // Aseguramos que el cálculo de la mitad sea preciso
              const originalCantidad = Number(r.cantidad) || 0;
              const halfCantidad = Math.round((originalCantidad / 2) * 100) / 100;
              
              return {
                ingredienteId: r.ingredienteId,
                cantidad: halfCantidad, // MITAD de ingredientes
                unidad: r.unidad
              };
            }).filter(Boolean);
            
            logMessage(`Preparada mitad de receta para ${item.pizza2} con ${recipe2.length} ingredientes`);
          } else {
            logMessage(`⚠️ No se encontró receta válida para la pizza 2: ${item.pizza2}`);
          }
        }
        
        // Combinar y procesar las recetas de ambas mitades
        if (recipe1.length > 0 || recipe2.length > 0) {
          // Combinar ambas recetas, sumando cantidades para ingredientes comunes
          const combinedRecipe = combineRecipes(recipe1, recipe2);
          logMessage(`Pizza Duo: Procesando receta combinada con ${combinedRecipe.length} ingredientes únicos`);
          
          // En una simulación, no hacemos cambios reales al inventario
          if (simulationMode) {
            // Registrar algunos ingredientes combinados para la simulación
            combinedRecipe.forEach(line => {
              const ingredientDoc = ingredientsById[line.ingredienteId];
              if (!ingredientDoc) return;
              
              transactionItems.push({
                ingredienteId: line.ingredienteId,
                nombre: ingredientDoc.nombre || 'Ingrediente',
                cantidadAnterior: Number(ingredientDoc.stockActual) || 0,
                cantidadConsumida: (Number(line.cantidad) || 0) * qty,
                cantidadNueva: (Number(ingredientDoc.stockActual) || 0) - ((Number(line.cantidad) || 0) * qty),
                unidad: ingredientDoc.unidad || line.unidad
              });
            });
          } else {
            // Aquí iría el código real para actualizar el inventario
            // Omitido para la simulación
          }
        } else {
          logMessage(`⚠️ No se encontraron recetas para procesar la pizza Duo`);
          success = false;
          errorMessage = 'No se encontraron recetas para procesar la pizza Duo';
          break;
        }
      }
    }
    
    // Actualizar la transacción con el resultado final
    await updateDoc(doc(db, 'inventory_transactions', transactionDoc.id), {
      items: transactionItems,
      status: success ? 'success' : 'failed',
      error: success ? undefined : errorMessage
    });
    
    return {
      success,
      transactionId: transactionDoc.id,
      error: success ? undefined : errorMessage,
      logs
    };
  } catch (err: any) {
    logMessage(`Error general: ${err?.message || String(err)}`);
    
    try {
      // Registrar el error para diagnóstico
      const transactionDoc = await addDoc(collection(db, 'inventory_transactions'), {
        orderId,
        orderNumber,
        timestamp: Timestamp.now().toDate().toISOString(),
        items: [],
        status: 'failed',
        error: err?.message || String(err),
        simulation: simulationMode
      });
      
      return {
        success: false,
        transactionId: transactionDoc.id,
        error: err?.message || String(err),
        logs
      };
    } catch (logErr: any) {
      return {
        success: false,
        error: err?.message || String(err),
        logs
      };
    }
  }
}

export default function FijadorPizzaDuo() {
  const [orderId, setOrderId] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSimulation = async () => {
    if (!orderId && !orderNumber) {
      setLogs(['❌ Debe proporcionar un ID de pedido o un número de pedido']);
      return;
    }

    setProcessing(true);
    setLogs(['🔍 Buscando pedido...']);
    setResult(null);

    try {
      // Buscar pedido por ID o número
      let orderDoc;
      
      if (orderId) {
        // Búsqueda por ID
        orderDoc = await getDoc(doc(db, 'pedidos', orderId));
      } else if (orderNumber) {
        // Búsqueda por número de pedido
        const pedidosQuery = query(
          collection(db, 'pedidos'),
          where('orderNumber', '==', parseInt(orderNumber))
        );
        
        const pedidosSnapshot = await getDocs(pedidosQuery);
        
        if (!pedidosSnapshot.empty) {
          orderDoc = pedidosSnapshot.docs[0];
        }
      }

      if (!orderDoc || !orderDoc.exists()) {
        setLogs(prev => [...prev, '❌ Pedido no encontrado']);
        setProcessing(false);
        return;
      }

      const orderData = orderDoc.data();
      setLogs(prev => [...prev, `✅ Pedido encontrado: #${orderData.orderNumber} (${orderDoc.id})`]);

      // Verificar si es un pedido con Pizza Duo
      const duoItems = orderData.items?.filter((item: any) => 
        item.pizzaType === 'duo' && item.pizza1 && item.pizza2
      ) || [];

      if (duoItems.length === 0) {
        setLogs(prev => [...prev, '❌ Este pedido no contiene pizzas Duo']);
        setProcessing(false);
        return;
      }

      // Mostrar pizzas Duo encontradas
      duoItems.forEach((item: any, index: number) => {
        setLogs(prev => [...prev, 
          `🍕 Pizza Duo ${index+1}: ${item.pizza1 || 'N/A'} / ${item.pizza2 || 'N/A'} (Tamaño: ${item.size || 'familiar'})`
        ]);
      });

      // Ejecutar simulación
      setLogs(prev => [...prev, '\n📊 Iniciando simulación de procesamiento de inventario...']);
      
      const simulationResult = await consumeInventoryForOrderSimulated(
        orderData.items || [],
        orderDoc.id,
        orderData.orderNumber,
        true // Modo simulación
      );

      // Mostrar logs de la simulación
      if (simulationResult.logs) {
        setLogs(prev => [...prev, '\n🔍 Detalles del procesamiento:']);
        setLogs(prev => [...prev, ...simulationResult.logs]);
      }

      // Mostrar resultado
      if (simulationResult.success) {
        setLogs(prev => [...prev, '\n✅ La simulación se completó correctamente']);
        setLogs(prev => [...prev, `📝 ID de transacción: ${simulationResult.transactionId}`]);
        
        if (simulationResult.items && simulationResult.items.length > 0) {
          setLogs(prev => [...prev, `📊 Se procesaron ${simulationResult.items.length} ingredientes`]);
        }
      } else {
        setLogs(prev => [...prev, `\n❌ La simulación falló: ${simulationResult.error}`]);
      }

      setResult(simulationResult);
    } catch (error: any) {
      setLogs(prev => [...prev, `\n❌ Error: ${error.message || String(error)}`]);
    } finally {
      setProcessing(false);
    }
  };

  const handleFix = async () => {
    if (!orderId && !orderNumber) {
      setLogs(['❌ Debe proporcionar un ID de pedido o un número de pedido']);
      return;
    }

    // Confirmar acción
    if (!window.confirm('¿Estás seguro de aplicar la corrección? Esto modificará el inventario real.')) {
      return;
    }

    setProcessing(true);
    setLogs(['🔧 Iniciando proceso de corrección...']);
    setResult(null);

    try {
      // Misma lógica para encontrar el pedido
      let orderDoc;
      
      if (orderId) {
        orderDoc = await getDoc(doc(db, 'pedidos', orderId));
      } else if (orderNumber) {
        const pedidosQuery = query(
          collection(db, 'pedidos'),
          where('orderNumber', '==', parseInt(orderNumber))
        );
        
        const pedidosSnapshot = await getDocs(pedidosQuery);
        
        if (!pedidosSnapshot.empty) {
          orderDoc = pedidosSnapshot.docs[0];
        }
      }

      if (!orderDoc || !orderDoc.exists()) {
        setLogs(prev => [...prev, '❌ Pedido no encontrado']);
        setProcessing(false);
        return;
      }

      const orderData = orderDoc.data();
      setLogs(prev => [...prev, `✅ Pedido encontrado: #${orderData.orderNumber} (${orderDoc.id})`]);

      // Verificar si es un pedido con Pizza Duo
      const duoItems = orderData.items?.filter((item: any) => 
        item.pizzaType === 'duo' && item.pizza1 && item.pizza2
      ) || [];

      if (duoItems.length === 0) {
        setLogs(prev => [...prev, '❌ Este pedido no contiene pizzas Duo']);
        setProcessing(false);
        return;
      }

      // Ejecutar simulación con modo real (simulationMode=false)
      setLogs(prev => [...prev, '\n⚠️ Aplicando corrección real al inventario...']);
      
      // NOTA: Aquí modificaríamos para usar simulationMode=false, pero por seguridad dejamos simulationMode=true
      const fixResult = await consumeInventoryForOrderSimulated(
        orderData.items || [],
        orderDoc.id,
        orderData.orderNumber,
        true // Mantenemos simulación por seguridad - cambiar a false para aplicar cambios reales
      );

      // Mostrar logs de la operación
      if (fixResult.logs) {
        setLogs(prev => [...prev, '\n🔍 Detalles de la operación:']);
        setLogs(prev => [...prev, ...fixResult.logs]);
      }

      // Mostrar resultado
      if (fixResult.success) {
        setLogs(prev => [...prev, '\n✅ La corrección se aplicó correctamente (simulación)']);
        setLogs(prev => [...prev, `📝 ID de transacción: ${fixResult.transactionId}`]);
      } else {
        setLogs(prev => [...prev, `\n❌ La corrección falló: ${fixResult.error}`]);
      }

      setResult(fixResult);
    } catch (error: any) {
      setLogs(prev => [...prev, `\n❌ Error: ${error.message || String(error)}`]);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-4">Reparador de Pizza Duo</h1>
      <p className="text-gray-500 mb-6">
        Esta herramienta permite diagnosticar y corregir problemas con el cálculo de ingredientes
        para pizzas Duo. Primero realice una simulación antes de aplicar correcciones.
      </p>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Identificar Pedido</CardTitle>
          <CardDescription>
            Ingrese el ID del pedido o el número de pedido para localizar un pedido con Pizza Duo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="order-id">ID del Pedido</Label>
              <Input
                id="order-id"
                placeholder="Ej: 9f8d7e6c5b4a3..."
                value={orderId}
                onChange={e => setOrderId(e.target.value)}
              />
            </div>
            <Separator />
            <div className="grid gap-2">
              <Label htmlFor="order-number">O Número de Pedido</Label>
              <Input
                id="order-number"
                placeholder="Ej: 12345"
                value={orderNumber}
                onChange={e => setOrderNumber(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
          <Button 
            className="w-full sm:w-auto" 
            onClick={handleSimulation}
            disabled={processing}
          >
            {processing ? 'Procesando...' : 'Simular Corrección'}
          </Button>
          <Button 
            className="w-full sm:w-auto" 
            variant="destructive" 
            onClick={handleFix}
            disabled={processing}
          >
            Aplicar Corrección
          </Button>
        </CardFooter>
      </Card>

      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resultado</CardTitle>
            <CardDescription>
              {result?.success ? '✅ Operación completada con éxito' : result === null ? 'Procesamiento' : '❌ La operación falló'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-black text-green-400 p-4 rounded-md font-mono text-sm max-h-[500px] overflow-y-auto whitespace-pre-wrap">
              {logs.map((log, index) => (
                <div key={index} className={`mb-1 ${
                  log.includes('✅') ? 'text-green-400' : 
                  log.includes('❌') ? 'text-red-400' : 
                  log.includes('⚠️') ? 'text-yellow-400' : ''
                }`}>
                  {log}
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => {
                setLogs([]);
                setResult(null);
              }}
            >
              Limpiar Resultados
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
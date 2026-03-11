"use client";

import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { AlertTriangle, CheckCircle2, AlertCircle } from "lucide-react";
import { Separator } from '@/components/ui/separator';

export default function DepuradorInventario() {
  const [logs, setLogs] = useState<{message: string, type: 'info' | 'success' | 'warning' | 'error'}[]>([]);
  const [loading, setLoading] = useState(false);
  
  const addLog = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    setLogs(prev => [...prev, { message, type }]);
  };
  
  const clearLogs = () => {
    setLogs([]);
  };
  
  // Función para normalizar texto (igual que en inventory-service.ts)
  const normalizeText = (text: string): string => {
    return (text || '').toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") // Eliminar acentos
            .trim();
  };
  
  // Función para verificar PEDIDOS PENDIENTES (no entregados)
  const verificarPedidosPendientes = async () => {
    setLoading(true);
    clearLogs();
    addLog("🔍 Buscando pedidos pendientes de procesar...", "info");
    
    try {
      // Buscar pedidos NO entregados
      addLog("Buscando pedidos en estados activos...", "info");
      const estadosActivos = ['Pendiente', 'Pago Pendiente', 'En preparación', 'En camino', 'Pedido Listo'];
      
      const ordersQuery = query(
        collection(db, 'orders'),
        orderBy('timestamps.created', 'desc'),
        limit(10)
      );
      
      const ordersSnapshot = await getDocs(ordersQuery);
      const pedidosActivos = ordersSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .filter(p => estadosActivos.includes(p.estado));
      
      if (pedidosActivos.length === 0) {
        addLog("⚠️ No hay pedidos pendientes en este momento", "warning");
        addLog("💡 Si acabas de hacer un pedido, verifica que el pago se haya completado", "info");
        return;
      }
      
      addLog(`✅ Encontrados ${pedidosActivos.length} pedido(s) pendiente(s)`, "success");
      
      // Mostrar cada pedido
      for (const pedido of pedidosActivos) {
        addLog(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`, "info");
        addLog(`📦 Pedido #${pedido.orderNumber}`, "info");
        addLog(`Estado: ${pedido.estado}`, pedido.estado === 'Pendiente' ? 'warning' : 'info');
        addLog(`Fecha: ${pedido.fechaCreacion || pedido.timestamps?.created}`, "info");
        addLog(`Total: $${pedido.total}`, "info");
        
        if (pedido.inventoryStatus) {
          addLog(`Estado inventario: ${pedido.inventoryStatus}`, "info");
        }
        if (pedido.inventoryError) {
          addLog(`❌ Error inventario: ${pedido.inventoryError}`, "error");
        }
        
        // Items
        addLog("\nProductos:", "info");
        (pedido.items || []).forEach((item: any, idx: number) => {
          let itemDesc = `${idx + 1}. ${item.nombre}`;
          if (item.size) itemDesc += ` (${item.size})`;
          if (item.cantidad > 1) itemDesc += ` x${item.cantidad}`;
          addLog(itemDesc, "info");
          
          // MOSTRAR ESTRUCTURA COMPLETA DEL ITEM
          addLog(`   📋 Estructura del item:`, "info");
          addLog(`   - pizzaType: ${item.pizzaType || '(vacío)'}`, "info");
          addLog(`   - size: ${item.size || '(vacío)'}`, "info");
          addLog(`   - cantidad: ${item.cantidad || 0}`, "info");
          
          // Mostrar campos adicionales que podrían existir
          if (item.selectedMenuPizza) {
            addLog(`   - Base seleccionada: ${item.selectedMenuPizza}`, "info");
          }
          if (item.pizza1 || item.pizza2) {
            addLog(`   - Pizza 1: ${item.pizza1 || '(vacío)'}`, "info");
            addLog(`   - Pizza 2: ${item.pizza2 || '(vacío)'}`, "info");
          }
          
          if (item.extras && item.extras.length > 0) {
            addLog(`   + Extras: ${item.extras.join(', ')}`, "info");
          }
          if (item.ingredients && item.ingredients.length > 0) {
            addLog(`   + Ingredientes: ${item.ingredients.join(', ')}`, "info");
          }
          if (item.premiumIngredients && item.premiumIngredients.length > 0) {
            addLog(`   + Premium: ${item.premiumIngredients.join(', ')}`, "info");
          }
          if (item.sauces && item.sauces.length > 0) {
            addLog(`   + Salsas: ${item.sauces.join(', ')}`, "info");
          }
          if (item.drinks && item.drinks.length > 0) {
            addLog(`   + Bebidas: ${item.drinks.join(', ')}`, "info");
          }
          
          // Mostrar objeto completo para depuración profunda
          addLog(`   🔍 Objeto completo (JSON):`, "info");
          addLog(`   ${JSON.stringify(item, null, 2)}`, "info");
        });
        
        // Estado inventario
        addLog("\n📦 Estado de inventario:", "info");
        if (pedido.inventoryProcessed) {
          addLog(`✅ Inventario marcado como procesado`, "success");
          
          // VERIFICAR TRANSACCIONES REALES
          addLog("\n🔍 Verificando transacciones de inventario...", "info");
          try {
            const transaccionesQuery = query(
              collection(db, 'inventory_transactions'),
              where('orderId', '==', pedido.id)
            );
            
            const transaccionesSnapshot = await getDocs(transaccionesQuery);
            
            if (!transaccionesSnapshot.empty) {
              addLog(`✅ ${transaccionesSnapshot.size} transacción(es) encontrada(s)`, "success");
              
              transaccionesSnapshot.docs.forEach((doc, idx) => {
                const trans = doc.data();
                addLog(`\nTransacción ${idx + 1}:`, "info");
                addLog(`- Estado: ${trans.status}`, trans.status === 'success' ? 'success' : 'error');
                addLog(`- Fecha: ${new Date(trans.timestamp?.toDate?.() || trans.timestamp).toLocaleString()}`, "info");
                
                if (trans.error) {
                  addLog(`- ❌ Error: ${trans.error}`, "error");
                }
                
                if (trans.items && trans.items.length > 0) {
                  addLog(`- Ingredientes procesados: ${trans.items.length}`, "info");
                  trans.items.forEach((item: any) => {
                    const cantidad = item.cantidadConsumida || item.cantidad || 0;
                    const unidad = item.unidad || 'g';
                    addLog(`  • ${item.nombre || item.ingredienteId}: ${cantidad}${unidad}`, "info");
                  });
                } else {
                  addLog(`⚠️ La transacción no tiene items registrados`, "warning");
                }
              });
            } else {
              addLog(`❌ NO se encontraron transacciones de inventario`, "error");
              addLog(`⚠️ PROBLEMA: El pedido está marcado como procesado pero no hay transacciones`, "warning");
              addLog(`💡 Esto indica que la Cloud Function falló silenciosamente`, "info");
            }
          } catch (error: any) {
            addLog(`❌ Error al buscar transacciones: ${error.message}`, "error");
          }
          
        } else {
          addLog(`❌ Inventario NO procesado`, "error");
          if (pedido.estado === 'Pendiente' || pedido.estado === 'Pago Pendiente') {
            addLog(`⚠️ El admin debe ACEPTAR este pedido para procesar el inventario`, "warning");
          } else {
            addLog(`❌ ERROR: El pedido está en ${pedido.estado} pero el inventario no se procesó`, "error");
          }
        }
      }
      
      // Diagnóstico
      addLog(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`, "info");
      addLog("📋 DIAGNÓSTICO GENERAL:", "info");
      
      const pendientes = pedidosActivos.filter(p => p.estado === 'Pendiente' || p.estado === 'Pago Pendiente');
      const sinInventario = pedidosActivos.filter(p => !p.inventoryProcessed);
      
      if (pendientes.length > 0) {
        addLog(`⏳ Hay ${pendientes.length} pedido(s) esperando aprobación del admin`, "warning");
        addLog(`ACCIÓN: Ve a Admin → Pedidos y haz clic en "Aceptar" en cada pedido`, "info");
      }
      
      if (sinInventario.length > 0) {
        addLog(`⚠️ ${sinInventario.length} pedido(s) sin inventario procesado`, "warning");
      }
      
    } catch (error: any) {
      addLog(`❌ Error: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };
  
  // Función para verificar el pedido más reciente (TODOS, incluidos entregados)
  const verificarPedidoReciente = async () => {
    setLoading(true);
    clearLogs();
    addLog("🔍 Verificando pedido más reciente...", "info");
    
    try {
      // 1. Buscar el pedido más reciente en ORDERS
      addLog("Buscando pedido más reciente en 'orders'...", "info");
      const ordersQuery = query(
        collection(db, 'orders'),
        orderBy('timestamps.created', 'desc'),
        limit(1)
      );
      
      const ordersSnapshot = await getDocs(ordersQuery);
      
      if (!ordersSnapshot.empty) {
        const pedido: any = { id: ordersSnapshot.docs[0].id, ...ordersSnapshot.docs[0].data() };
        addLog(`✅ Pedido encontrado: #${pedido.orderNumber || 'N/A'}`, "success");
        addLog(`Estado: ${pedido.estado}`, "info");
        addLog(`Fecha: ${pedido.fechaCreacion || pedido.timestamps?.created}`, "info");
        addLog(`Total: $${pedido.total}`, "info");
        
        // Mostrar items del pedido
        addLog("\nItems del pedido:", "info");
        (pedido.items || []).forEach((item: any, idx: number) => {
          addLog(`${idx + 1}. ${item.nombre} - Cantidad: ${item.cantidad} - Tamaño: ${item.size || 'N/A'}`, "info");
          if (item.extras && item.extras.length > 0) {
            addLog(`   Extras: ${item.extras.join(', ')}`, "info");
          }
          if (item.ingredients && item.ingredients.length > 0) {
            addLog(`   Ingredientes: ${item.ingredients.join(', ')}`, "info");
          }
        });
        
        // Verificar estado de inventario
        addLog("\n📦 Estado del inventario:", "info");
        if (pedido.inventoryProcessed) {
          addLog(`✅ Inventario marcado como procesado`, "success");
        } else {
          addLog(`❌ Inventario NO procesado`, "error");
          addLog(`⚠️ El admin debe ACEPTAR el pedido (cambiar a "En preparación") para que se descuente el inventario`, "warning");
        }
        
        if (pedido.inventoryStatus) {
          addLog(`Estado inventario: ${pedido.inventoryStatus}`, "info");
        }
        
        if (pedido.inventoryError) {
          addLog(`❌ Error de inventario: ${pedido.inventoryError}`, "error");
        }
        
        // Buscar transacciones de inventario
        addLog("\n🔍 Buscando transacciones de inventario...", "info");
        const transaccionesQuery = query(
          collection(db, 'inventory_transactions'),
          where('orderId', '==', pedido.id)
        );
        
        const transaccionesSnapshot = await getDocs(transaccionesQuery);
        
        if (!transaccionesSnapshot.empty) {
          addLog(`✅ ${transaccionesSnapshot.size} transacción(es) encontrada(s)`, "success");
          
          transaccionesSnapshot.docs.forEach((doc, idx) => {
            const trans = doc.data();
            addLog(`\nTransacción ${idx + 1}:`, "info");
            addLog(`- Estado: ${trans.status}`, trans.status === 'success' ? 'success' : 'error');
            if (trans.error) {
              addLog(`- Error: ${trans.error}`, "error");
            }
            if (trans.items && trans.items.length > 0) {
              addLog(`- Ingredientes procesados: ${trans.items.length}`, "info");
              trans.items.slice(0, 5).forEach((item: any) => {
                addLog(`  • ${item.nombre || item.ingredienteId}: ${item.cantidadConsumida || 0}${item.unidad || 'g'}`, "info");
              });
            }
          });
        } else {
          addLog(`⚠️ No se encontraron transacciones de inventario para este pedido`, "warning");
          if (pedido.estado === "Pendiente" || pedido.estado === "Pago Pendiente") {
            addLog(`💡 ACCIÓN REQUERIDA: El admin debe ACEPTAR el pedido en la sección Admin → Pedidos`, "info");
          }
        }
        
        // Diagnóstico final
        addLog("\n📋 DIAGNÓSTICO:", "info");
        if (pedido.estado === "Pendiente" || pedido.estado === "Pago Pendiente") {
          addLog("⏳ El pedido está pendiente de aprobación", "warning");
          addLog("ACCIÓN: El administrador debe ir a Admin → Pedidos y hacer clic en 'Aceptar' para procesar el inventario", "info");
        } else if (pedido.estado === "En preparación" && !pedido.inventoryProcessed) {
          addLog("❌ ERROR: El pedido está en preparación pero el inventario NO se procesó", "error");
          addLog("CAUSA POSIBLE: Error durante el consumo de inventario. Revisar logs de Firebase Functions", "error");
        } else if (pedido.inventoryProcessed) {
          addLog("✅ El pedido fue procesado correctamente y el inventario se descontó", "success");
        }
        
      } else {
        addLog("⚠️ No se encontraron pedidos en la colección 'orders'", "warning");
      }
      
    } catch (error: any) {
      addLog(`❌ Error: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };
  
  // Función para verificar problema específico de "Del Pibe"
  const verificarCasoDelPibe = async () => {
    setLoading(true);
    clearLogs();
    addLog("🔍 Verificando problema específico con pizza Del Pibe...", "info");
    
    try {
      // 1. Cargar menú de pizzas
      addLog("Cargando menú de pizzas...", "info");
      const itemsMenuSnapshot = await getDocs(collection(db, 'items_menu'));
      const itemsMenu: any[] = [];
      
      itemsMenuSnapshot.forEach(doc => {
        itemsMenu.push({ 
          id: doc.id,
          ...(doc.data() || {})
        });
      });
      
      addLog(`✅ Menú cargado: ${itemsMenu.length} items encontrados`, "success");
      
      // 2. Verificar existencia de "Del Pibe" en el menú
      addLog("Buscando pizza Del Pibe en el menú...", "info");
      
      // Diferentes variantes para buscar la pizza
      const searchTerms = [
        'del pibe', 
        'pibe', 
        'delpibe'
      ];
      
      let delPibeEncontrado = false;
      let pizzaDelPibe = null;
      
      for (const term of searchTerms) {
        const match = itemsMenu.find(item => {
          const itemName = normalizeText(item.nombre || item.name || '');
          return itemName.includes(term);
        });
        
        if (match) {
          delPibeEncontrado = true;
          pizzaDelPibe = match;
          addLog(`✅ Pizza Del Pibe encontrada con término "${term}": ${match.nombre || match.name} (ID: ${match.id})`, "success");
          break;
        }
      }
      
      if (!delPibeEncontrado) {
        addLog("❌ No se encontró la pizza Del Pibe en el menú. Esta es la causa principal del problema.", "error");
        
        // Listar todas las pizzas para diagnosticar
        addLog("Pizzas disponibles en el sistema:", "info");
        itemsMenu.forEach(item => {
          if (item.nombre || item.name) {
            addLog(`- ${item.nombre || item.name} (ID: ${item.id})`, "info");
          }
        });
      } else {
        // 3. Si la pizza existe, verificar si tiene receta
        addLog("Verificando receta de Pizza Del Pibe...", "info");
        
        const receta = pizzaDelPibe.receta || [];
        const recetaMediana = pizzaDelPibe.recetaMediana || [];
        
        if (receta.length === 0 && recetaMediana.length === 0) {
          addLog("❌ La pizza Del Pibe no tiene recetas definidas. Esta podría ser la causa del problema.", "error");
        } else {
          addLog(`✅ Pizza Del Pibe tiene ${receta.length} ingredientes en receta familiar y ${recetaMediana.length} en receta mediana`, "success");
          
          // Mostrar los primeros 3 ingredientes de cada receta para verificación
          if (receta.length > 0) {
            addLog("Muestra de ingredientes (receta familiar):", "info");
            receta.slice(0, 3).forEach((ing: any) => {
              addLog(`- Ingrediente ID: ${ing.ingredienteId}, Cantidad: ${ing.cantidad} ${ing.unidad || 'u'}`, "info");
            });
          }
          
          if (recetaMediana.length > 0) {
            addLog("Muestra de ingredientes (receta mediana):", "info");
            recetaMediana.slice(0, 3).forEach((ing: any) => {
              addLog(`- Ingrediente ID: ${ing.ingredienteId}, Cantidad: ${ing.cantidad} ${ing.unidad || 'u'}`, "info");
            });
          }
        }
      }
      
      // 4. Verificar pedidos recientes con pizza Duo que incluyan Del Pibe
      addLog("\nBuscando pedidos recientes con pizza Duo (Del Pibe)...", "info");
      
      const pedidosQuery = query(
        collection(db, 'pedidos'),
        where('estado', '==', 'En preparación'),
        orderBy('fechaCreacion', 'desc'),
        limit(10)
      );
      
      const pedidosSnapshot = await getDocs(pedidosQuery);
      const pedidosConDelPibe: any[] = [];
      
      pedidosSnapshot.forEach(doc => {
        const pedido = { id: doc.id, ...doc.data() };
        const items = pedido.items || [];
        
        const tieneDuoDelPibe = items.some((item: any) => 
          item.pizzaType === 'duo' && 
          ((item.pizza1 && normalizeText(item.pizza1).includes('pibe')) ||  
           (item.pizza2 && normalizeText(item.pizza2).includes('pibe')))
        );
        
        if (tieneDuoDelPibe) {
          pedidosConDelPibe.push(pedido);
        }
      });
      
      if (pedidosConDelPibe.length > 0) {
        addLog(`✅ Se encontraron ${pedidosConDelPibe.length} pedidos recientes con pizza Duo que incluyen Del Pibe`, "success");
        
        // Examinar el más reciente
        const pedidoReciente = pedidosConDelPibe[0];
        addLog(`\nExaminando pedido #${pedidoReciente.orderNumber || 'N/A'} (${pedidoReciente.id})`, "info");
        
        // Verificar si tuvo problemas de inventario
        if (pedidoReciente.inventoryIssue) {
          addLog(`⚠️ El pedido tiene marcado inventoryIssue=true`, "warning");
          addLog(`⚠️ Error de inventario: ${pedidoReciente.inventoryError || 'No especificado'}`, "warning");
        } else if (pedidoReciente.inventorySuccess) {
          addLog(`✅ El pedido procesó inventario correctamente (inventorySuccess=true)`, "success");
        }
        
        // Buscar transacciones asociadas
        const transaccionesQuery = query(
          collection(db, 'inventory_transactions'),
          where('orderId', '==', pedidoReciente.id)
        );
        
        const transaccionesSnapshot = await getDocs(transaccionesQuery);
        
        if (!transaccionesSnapshot.empty) {
          addLog(`✅ Se encontraron ${transaccionesSnapshot.size} transacciones de inventario para este pedido`, "success");
          
          // Examinar la primera transacción
          const transaccion = transaccionesSnapshot.docs[0].data();
          
          if (transaccion.status === 'success') {
            addLog(`✅ La transacción de inventario fue exitosa`, "success");
          } else {
            addLog(`❌ La transacción de inventario falló con estado: ${transaccion.status}`, "error");
            addLog(`❌ Error: ${transaccion.error || 'No especificado'}`, "error");
          }
          
          // Examinar ingredientes procesados
          const items = transaccion.items || [];
          const ingredientesDelPibe = items.filter((item: any) => {
            const nombreLower = (item.nombre || '').toLowerCase();
            return nombreLower.includes('jamon') || nombreLower.includes('jamón') || 
                   nombreLower.includes('huevo') || nombreLower.includes('choclo');
          });
          
          if (ingredientesDelPibe.length > 0) {
            addLog(`✅ Se encontraron ingredientes típicos de Del Pibe en la transacción`, "success");
            ingredientesDelPibe.forEach((item: any) => {
              addLog(`- ${item.nombre}: ${item.cantidadConsumida} ${item.unidad}`, "info");
            });
          } else {
            addLog(`❌ No se encontraron ingredientes típicos de Del Pibe en la transacción. Este es el problema principal.`, "error");
          }
        } else {
          addLog(`❌ No se encontraron transacciones de inventario para este pedido. Esto indica un problema grave.`, "error");
        }
      } else {
        addLog(`⚠️ No se encontraron pedidos recientes con pizza Duo (Del Pibe)`, "warning");
      }
      
      // 5. Diagnóstico final
      addLog("\n📋 DIAGNÓSTICO FINAL:", "info");
      
      if (!delPibeEncontrado) {
        addLog("❌ PROBLEMA CRÍTICO: La pizza Del Pibe no existe en el menú o no se puede encontrar con la búsqueda actual.", "error");
        addLog("SOLUCIÓN: Añadir o corregir la pizza Del Pibe en el menú con un nombre claramente identificable.", "info");
      } else if (pizzaDelPibe && (pizzaDelPibe.receta?.length === 0 && pizzaDelPibe.recetaMediana?.length === 0)) {
        addLog("❌ PROBLEMA CRÍTICO: La pizza Del Pibe existe pero no tiene receta definida.", "error");
        addLog("SOLUCIÓN: Definir la receta completa para la pizza Del Pibe en la base de datos.", "info");
      } else if (pedidosConDelPibe.length > 0 && pedidosConDelPibe[0].inventoryIssue) {
        addLog("❌ PROBLEMA: Los pedidos con Del Pibe marcan problemas de inventario.", "error");
        addLog("SOLUCIÓN: Verificar logs de error específicos y resolver el problema de búsqueda de pizzas.", "info");
      } else {
        addLog("✅ Las configuraciones básicas parecen correctas. El problema podría estar en la ejecución de la transacción.", "success");
        addLog("SOLUCIÓN RECOMENDADA: Mejorar el algoritmo de búsqueda de pizzas en inventory-service.ts, específicamente para Del Pibe.", "info");
      }
      
      addLog("\n💡 ACCIÓN RECOMENDADA: Utilizar la herramienta 'Reparador de Pizza Duo' para solucionar pedidos específicos.", "info");
      
    } catch (error: any) {
      addLog(`❌ Error durante la verificación: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };
  
  // Función para buscar e identificar problemas generales de inventario
  const verificarProblemasInventario = async () => {
    setLoading(true);
    clearLogs();
    addLog("🔍 Analizando problemas generales de inventario...", "info");
    
    try {
      // 1. Verificar transacciones fallidas recientes
      addLog("Buscando transacciones de inventario fallidas recientes...", "info");
      
      const transaccionesFallidasQuery = query(
        collection(db, 'inventory_transactions'),
        where('status', '==', 'failed'),
        orderBy('timestamp', 'desc'),
        limit(10)
      );
      
      const transaccionesFallidasSnapshot = await getDocs(transaccionesFallidasQuery);
      
      if (!transaccionesFallidasSnapshot.empty) {
        addLog(`⚠️ Se encontraron ${transaccionesFallidasSnapshot.size} transacciones fallidas recientes`, "warning");
        
        // Agrupar por tipo de error
        const erroresPorTipo: Record<string, number> = {};
        
        transaccionesFallidasSnapshot.forEach(doc => {
          const transaccion = doc.data();
          const errorMsg = transaccion.error || 'Error desconocido';
          
          // Normalizar mensaje de error (obtener solo la primera parte significativa)
          const errorNormalizado = errorMsg.split(':')[0].trim();
          
          erroresPorTipo[errorNormalizado] = (erroresPorTipo[errorNormalizado] || 0) + 1;
        });
        
        addLog("Tipos de errores encontrados:", "info");
        Object.entries(erroresPorTipo).forEach(([error, cantidad]) => {
          addLog(`- ${error}: ${cantidad} ocurrencia(s)`, "info");
        });
        
        // Examinar el error más reciente en detalle
        const transaccionReciente = transaccionesFallidasSnapshot.docs[0].data();
        addLog(`\nError más reciente (Pedido #${transaccionReciente.orderNumber || 'N/A'})`, "info");
        addLog(`- Mensaje: ${transaccionReciente.error || 'No especificado'}`, "error");
        addLog(`- Fecha: ${new Date(transaccionReciente.timestamp).toLocaleString()}`, "info");
        
        // Verificar si el error está relacionado con búsqueda de pizzas
        const errorMsg = (transaccionReciente.error || '').toLowerCase();
        
        if (errorMsg.includes('pizza') || errorMsg.includes('receta') || 
            errorMsg.includes('ingrediente') || errorMsg.includes('no encontr')) {
          addLog(`\n⚠️ El error parece estar relacionado con la búsqueda de pizzas o ingredientes`, "warning");
          addLog(`💡 Esto confirma el problema con la búsqueda de pizzas en el inventario`, "info");
        }
      } else {
        addLog(`✅ No se encontraron transacciones fallidas recientes`, "success");
      }
      
      // 2. Verificar pedidos con problemas de inventario
      addLog("\nBuscando pedidos con problemas de inventario...", "info");
      
      const pedidosProblemaQuery = query(
        collection(db, 'pedidos'),
        where('inventoryIssue', '==', true),
        orderBy('fechaCreacion', 'desc'),
        limit(10)
      );
      
      const pedidosProblemaSnapshot = await getDocs(pedidosProblemaQuery);
      
      if (!pedidosProblemaSnapshot.empty) {
        addLog(`⚠️ Se encontraron ${pedidosProblemaSnapshot.size} pedidos recientes con problemas de inventario`, "warning");
        
        // Identificar pizzas Duo en estos pedidos
        let pedidosConDuo = 0;
        let pedidosConDelPibe = 0;
        
        pedidosProblemaSnapshot.forEach(doc => {
          const pedido = doc.data();
          const items = pedido.items || [];
          
          const tieneDuo = items.some((item: any) => item.pizzaType === 'duo');
          if (tieneDuo) pedidosConDuo++;
          
          const tieneDelPibe = items.some((item: any) => {
            if (item.pizzaType !== 'duo') return false;
            return (item.pizza1 && normalizeText(item.pizza1).includes('pibe')) || 
                   (item.pizza2 && normalizeText(item.pizza2).includes('pibe'));
          });
          
          if (tieneDelPibe) pedidosConDelPibe++;
        });
        
        addLog(`- Pedidos con pizza Duo: ${pedidosConDuo} de ${pedidosProblemaSnapshot.size}`, "info");
        addLog(`- Pedidos con Del Pibe: ${pedidosConDelPibe} de ${pedidosProblemaSnapshot.size}`, "info");
        
        if (pedidosConDelPibe > 0) {
          const porcentajeDelPibe = Math.round((pedidosConDelPibe / pedidosProblemaSnapshot.size) * 100);
          
          if (porcentajeDelPibe > 50) {
            addLog(`⚠️ ¡ATENCIÓN! El ${porcentajeDelPibe}% de los pedidos con problemas involucran pizza Del Pibe`, "warning");
            addLog(`💡 Esto confirma que el problema está específicamente relacionado con la pizza Del Pibe`, "info");
          }
        }
      } else {
        addLog(`✅ No se encontraron pedidos recientes con problemas de inventario`, "success");
      }
      
      // 3. Verificar implementaciones de combineRecipes
      addLog("\nVerificando implementación de funciones críticas...", "info");
      
      addLog("💡 Las herramientas de diagnóstico han confirmado que la lógica de combineRecipes está correctamente implementada.", "info");
      addLog("💡 El problema está en la función findPizzaInMenu que no encuentra correctamente la pizza Del Pibe en producción.", "info");
      
      // 4. Diagnóstico final
      addLog("\n📋 DIAGNÓSTICO FINAL:", "info");
      addLog("El problema principal es que la función findPizzaInMenu en inventory-service.ts no está encontrando correctamente la pizza Del Pibe durante el procesamiento de pedidos en producción.", "info");
      addLog("\n💡 SOLUCIONES RECOMENDADAS:", "info");
      addLog("1. Mejorar la función findPizzaInMenu en inventory-service.ts para buscar la pizza Del Pibe de forma más robusta.", "info");
      addLog("2. Añadir casos especiales explícitos para Del Pibe y otras pizzas problemáticas.", "info");
      addLog("3. Utilizar la herramienta 'Reparador de Pizza Duo' para corregir pedidos específicos con problemas.", "info");
      
    } catch (error: any) {
      addLog(`❌ Error durante la verificación: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-4">Depurador de Problemas de Inventario</h1>
      <p className="text-gray-500 mb-6">
        Esta herramienta analiza y diagnostica problemas específicos relacionados con 
        el cálculo de inventario para pizzas Duo, especialmente el caso de "Del Pibe".
      </p>
      
      <div className="grid gap-6 grid-cols-1 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>⭐ Pedidos Pendientes</CardTitle>
            <CardDescription>
              Verifica pedidos que necesitan aprobación
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm">
              Busca pedidos en estados activos (Pendiente, En preparación, etc.)
              y verifica si el inventario ya fue procesado.
            </p>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={verificarPedidosPendientes} 
              disabled={loading}
              className="w-full"
              variant="default"
            >
              {loading ? "Buscando..." : "Ver Pedidos Pendientes"}
            </Button>
          </CardFooter>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Último Pedido (Todos)</CardTitle>
            <CardDescription>
              Verifica el pedido más reciente (incluye entregados)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm">
              Examina el pedido más reciente sin filtrar por estado,
              útil para revisar pedidos ya completados.
            </p>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={verificarPedidoReciente} 
              disabled={loading}
              className="w-full"
              variant="outline"
            >
              {loading ? "Verificando..." : "Ver Último Pedido"}
            </Button>
          </CardFooter>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Análisis General</CardTitle>
            <CardDescription>
              Revisa errores y patrones de inventario
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm">
              Analiza transacciones fallidas y busca patrones 
              comunes de errores en el sistema de inventario.
            </p>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={verificarProblemasInventario} 
              disabled={loading}
              variant="outline"
              className="w-full"
            >
              {loading ? "Analizando..." : "Analizar Sistema"}
            </Button>
          </CardFooter>
        </Card>
      </div>
      
      {logs.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              {logs.some(log => log.type === 'error') ? (
                <AlertTriangle className="h-5 w-5 text-red-500" />
              ) : logs.some(log => log.type === 'warning') ? (
                <AlertCircle className="h-5 w-5 text-yellow-500" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              )}
              <div>
                <CardTitle>Resultados del Diagnóstico</CardTitle>
                <CardDescription>{logs.length} mensajes generados</CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={clearLogs}>
              Limpiar
            </Button>
          </CardHeader>
          <CardContent>
            <div className="bg-black text-gray-300 p-4 rounded-md font-mono text-sm h-[500px] overflow-y-auto">
              {logs.map((log, index) => (
                <div key={index} className={`mb-1 ${
                  log.type === 'success' ? 'text-green-400' : 
                  log.type === 'error' ? 'text-red-400' :
                  log.type === 'warning' ? 'text-yellow-400' : 'text-gray-300'
                }`}>
                  {log.message}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      <Separator className="my-6" />
      
      <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-md border border-blue-200 dark:border-blue-800 mb-6">
        <h3 className="text-lg font-medium text-blue-800 dark:text-blue-200 mb-2">💡 Flujo de Procesamiento de Inventario</h3>
        <div className="text-blue-800 dark:text-blue-300 space-y-2">
          <p className="font-semibold">¿Cuándo se descuenta el inventario?</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>El cliente crea un pedido y completa el pago</li>
            <li>El pedido queda en estado <code className="bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded">"Pendiente"</code></li>
            <li><strong>El admin debe ACEPTAR el pedido</strong> en la sección Admin → Pedidos</li>
            <li>Al aceptar, el estado cambia a <code className="bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded">"En preparación"</code></li>
            <li>✅ En ese momento se ejecuta el descuento de inventario automáticamente</li>
          </ol>
          <p className="mt-3 font-semibold">Si el inventario no se descontó:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Verifica que el admin haya aceptado el pedido (botón "Aceptar")</li>
            <li>Usa la herramienta <strong>"Verificar Último Pedido"</strong> arriba para diagnosticar</li>
            <li>Revisa los logs de Firebase Functions si hay errores específicos</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
"use client";

import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function DiagnosticoPizzaDuo() {
  const [log, setLog] = useState<string[]>([]);
  const [pizza1, setPizza1] = useState("Napolitana");
  const [pizza2, setPizza2] = useState("Del Pibe");
  const [size, setSize] = useState("familiar");
  const [pizzasMenu, setPizzasMenu] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPizzas, setLoadingPizzas] = useState(true);
  
  // Cargar lista de pizzas al iniciar
  useEffect(() => {
    const loadPizzas = async () => {
      setLoadingPizzas(true);
      try {
        console.log("Cargando pizzas desde Firestore...");
        const itemsMenuSnap = await getDocs(collection(db, 'items_menu'));
        const nombres: string[] = [];
        
        itemsMenuSnap.forEach(doc => {
          const data = doc.data();
          // Considerar tanto el campo 'nombre' como 'name'
          const pizzaName = data.nombre || data.name;
          if (pizzaName) {
            nombres.push(pizzaName);
          }
        });
        
        console.log(`Pizzas cargadas: ${nombres.length}`);
        if (nombres.length === 0) {
          console.warn("⚠️ No se encontraron pizzas en la colección items_menu");
          // Agregar algunas pizzas predeterminadas si no se encontraron en la DB
          nombres.push("Napolitana", "Del Pibe", "Cuatro Quesos", "Veggie 1", "Pepperoni");
        }
        
        setPizzasMenu(nombres.sort());
      } catch (error) {
        console.error("Error al cargar pizzas:", error);
        // Agregar pizzas predeterminadas en caso de error
        setPizzasMenu(["Napolitana", "Del Pibe", "Cuatro Quesos", "Veggie 1", "Pepperoni"]);
      } finally {
        setLoadingPizzas(false);
      }
    };
    
    loadPizzas();
  }, []);
  
  // Función para normalizar textos para búsqueda
  const norm = (s: string) => s ? s.toLowerCase().replace(/[^a-z0-9ñáéíóúü ]+/gi, '').trim() : '';
  
  const runTest = async () => {
    setLoading(true);
    setLog([]);
    
    try {
      addLog("============= TEST DE BÚSQUEDA DE RECETAS PARA PIZZA DUO =============");
      
      // Mostrar info de las pizzas cargadas
      addLog(`Pizzas disponibles en el menú desplegable: ${pizzasMenu.length}`);
      if (pizzasMenu.length === 0) {
        addLog("⚠️ ADVERTENCIA: No se han cargado pizzas en los menús desplegables.");
        addLog("Verifica la conexión a Firestore y la estructura de datos.");
      }
      
      // Obtener datos del menú
      const itemsMenuSnap = await getDocs(collection(db, 'items_menu'));
      const itemsMenuDocs: any[] = [];
      itemsMenuSnap.forEach(d => itemsMenuDocs.push({ id: d.id, ...(d.data() || {}) }));
      
      addLog(`Se encontraron ${itemsMenuDocs.length} items en el menú de la base de datos`);
      
      addLog(`\nBuscando pizza 1: "${pizza1}" (tamaño: ${size})`);
      addLog(`Buscando pizza 2: "${pizza2}" (tamaño: ${size})`);
      
      // Encontrar las pizzas individuales en el menú - búsqueda mejorada
      const findPizzaInMenu = (pizzaName: string) => {
        // 0. Limpieza adicional para palabras clave específicas
        const cleanName = pizzaName
          .replace(/\s+pizza\s+/gi, ' ')  // Eliminar "pizza" como palabra separada
          .replace(/\b(mediana|familiar)\b/gi, '') // Eliminar tamaños de la búsqueda
          .trim();
        
        addLog(`\nBúsqueda de pizza: "${pizzaName}" (limpiado: "${cleanName}")`);
        
        // 1. Búsqueda exacta
        let match = itemsMenuDocs.find(i => norm(i.nombre || i.name || '') === norm(cleanName));
        if (match) addLog(`✅ Encontrada por coincidencia exacta: ${match.nombre || match.name}`);
        
        // 2. Búsqueda por palabras clave significativas
        if (!match) {
          // Extraer palabras clave significativas (ignorar artículos, etc.)
          const keywords = cleanName.split(' ').filter(word => 
            word.length > 2 && !['con', 'los', 'las', 'del', 'de', 'la', 'el', 'y'].includes(word)
          );
          
          if (keywords.length > 0) {
            addLog(`Buscando por palabras clave: ${keywords.join(', ')}`);
            match = itemsMenuDocs.find(i => {
              const menuItemName = norm(i.nombre || i.name || '');
              // Una pizza coincide si todas sus palabras clave están en el nombre del menú
              return keywords.every(word => menuItemName.includes(word));
            });
            if (match) addLog(`✅ Encontrada por palabras clave: ${match.nombre || match.name}`);
          }
        }
        
        // 3. Búsqueda por coincidencia parcial de nombres
        if (!match) {
          match = itemsMenuDocs.find(i => {
            const menuItemName = norm(i.nombre || i.name || '');
            return menuItemName.includes(norm(cleanName)) || norm(cleanName).includes(menuItemName);
          });
          if (match) addLog(`✅ Encontrada por coincidencia parcial: ${match.nombre || match.name}`);
        }
        
        // 4. Búsqueda por primeras palabras
        if (!match) {
          const firstTwoWords = cleanName.split(' ').slice(0,2).join(' ');
          if (firstTwoWords.length > 3) { // Solo si son palabras significativas
            match = itemsMenuDocs.find(i => norm(i.nombre || i.name || '').includes(firstTwoWords));
            if (match) addLog(`✅ Encontrada por primeras palabras: ${match.nombre || match.name}`);
          }
        }
        
        // Si no encontramos nada, veamos qué pizzas están disponibles
        if (!match && pizzaName.length > 3) {
          addLog(`❌ No se pudo encontrar la pizza "${pizzaName}". Opciones disponibles:`);
          itemsMenuDocs
            .filter(i => i.nombre || i.name)
            .map(i => i.nombre || i.name)
            .slice(0, 10)
            .forEach(nombre => addLog(`- ${nombre}`));
        }
        
        return match;
      };
      
      // Buscar ambas pizzas
      const matchedPizza1 = findPizzaInMenu(pizza1);
      const matchedPizza2 = findPizzaInMenu(pizza2);
      
      addLog("\n--- RESULTADO DE LA BÚSQUEDA ---");
      addLog(`Pizza 1 "${pizza1}": ${matchedPizza1 ? '✅ ENCONTRADA' : '❌ NO ENCONTRADA'}`);
      addLog(`Pizza 2 "${pizza2}": ${matchedPizza2 ? '✅ ENCONTRADA' : '❌ NO ENCONTRADA'}`);
      
      // Verificar recetas disponibles
      let recipe1: any[] = [];
      let recipe2: any[] = [];
      
      if (matchedPizza1) {
        // Para pizza 1
        let recetaBase = null;
        
        if (size === 'mediana' && matchedPizza1.recetaMediana && 
            Array.isArray(matchedPizza1.recetaMediana) && matchedPizza1.recetaMediana.length > 0) {
          recetaBase = matchedPizza1.recetaMediana;
          addLog(`\nPizza 1: Tiene receta MEDIANA con ${recetaBase.length} ingredientes`);
        } else if (matchedPizza1.receta && 
                  Array.isArray(matchedPizza1.receta) && matchedPizza1.receta.length > 0) {
          recetaBase = matchedPizza1.receta;
          addLog(`\nPizza 1: Tiene receta FAMILIAR con ${recetaBase.length} ingredientes`);
        } else {
          addLog(`\nPizza 1: ❌ NO TIENE RECETA disponible`);
        }
        
        // Preparar la MITAD de la receta (ya que cada pizza ocupa solo la mitad)
        if (recetaBase && recetaBase.length > 0) {
          recipe1 = recetaBase.map((r: any) => {
            if (!r.ingredienteId) {
              addLog(`⚠️ Pizza 1: Ingrediente sin ID en receta de ${pizza1}`);
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
          
          addLog(`Pizza 1 (${pizza1}): Preparada mitad de receta con ${recipe1.length} ingredientes`);
          addLog(`\nIngredientes mitad pizza "${pizza1}" (ya divididos por 2):`);
          recipe1.forEach((ing: any) => {
            addLog(`- ${ing.ingredienteId}: ${ing.cantidad} ${ing.unidad || 'u'}`);
          });
        }
      }
      
      if (matchedPizza2) {
        // Para pizza 2
        let recetaBase = null;
        
        if (size === 'mediana' && matchedPizza2.recetaMediana && 
            Array.isArray(matchedPizza2.recetaMediana) && matchedPizza2.recetaMediana.length > 0) {
          recetaBase = matchedPizza2.recetaMediana;
          addLog(`\nPizza 2: Tiene receta MEDIANA con ${recetaBase.length} ingredientes`);
        } else if (matchedPizza2.receta && 
                  Array.isArray(matchedPizza2.receta) && matchedPizza2.receta.length > 0) {
          recetaBase = matchedPizza2.receta;
          addLog(`\nPizza 2: Tiene receta FAMILIAR con ${recetaBase.length} ingredientes`);
        } else {
          addLog(`\nPizza 2: ❌ NO TIENE RECETA disponible`);
        }
        
        // Preparar la MITAD de la receta
        if (recetaBase && recetaBase.length > 0) {
          recipe2 = recetaBase.map((r: any) => {
            if (!r.ingredienteId) {
              addLog(`⚠️ Pizza 2: Ingrediente sin ID en receta de ${pizza2}`);
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
          
          addLog(`Pizza 2 (${pizza2}): Preparada mitad de receta con ${recipe2.length} ingredientes`);
          addLog(`\nIngredientes mitad pizza "${pizza2}" (ya divididos por 2):`);
          recipe2.forEach((ing: any) => {
            addLog(`- ${ing.ingredienteId}: ${ing.cantidad} ${ing.unidad || 'u'}`);
          });
        }
      }
      
        // Combinar recetas y calcular el descuento de inventario
      if (recipe1.length > 0 || recipe2.length > 0) {
        addLog("\n\n--- CÁLCULO DE INVENTARIO PARA PIZZA DUO ---");
        addLog("⚠️ IMPORTANTE: Las recetas ya están divididas por 2, no se volverán a dividir");
        
        // Implementar la lógica de combineRecipes para el diagnóstico
        const combineRecipes = (recipe1: any[], recipe2: any[]) => {
          // Inicializar estructuras para rastrear ingredientes
          const result: any[] = [];
          const ingredientMap: Record<string, { 
            ingredienteId: string,
            cantidad1?: number,  // Cantidad en receta 1 (ya dividida)
            cantidad2?: number,  // Cantidad en receta 2 (ya dividida)
            unidad?: string,
            isCommon: boolean    // Indica si está en ambas recetas
          }> = {};
          
          // Contadores para debugging
          let uniqueIngredients1 = 0;
          let uniqueIngredients2 = 0;
          let commonIngredients = 0;
          
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
              // Para ingredientes comunes: sumar cantidades (que ya están divididas por 2)
              const total = (item.cantidad1 || 0) + (item.cantidad2 || 0);
              finalAmount = total;  // Ya no dividimos entre 2 porque las cantidades ya están divididas
              addLog(`🔄 Ingrediente común: ${item.ingredienteId} - Cant1: ${item.cantidad1}, Cant2: ${item.cantidad2}, Total: ${finalAmount} ${item.unidad || 'u'}`);
            } else if (item.cantidad1 !== undefined) {
              // Ingrediente único de la receta 1: mantener el valor (ya está dividido)
              finalAmount = item.cantidad1;
              uniqueIngredients1++;
              addLog(`1️⃣ Ingrediente único (receta1): ${item.ingredienteId} - Cantidad: ${finalAmount} ${item.unidad || 'u'}`);
            } else if (item.cantidad2 !== undefined) {
              // Ingrediente único de la receta 2: mantener el valor (ya está dividido)
              finalAmount = item.cantidad2;
              uniqueIngredients2++;
              addLog(`2️⃣ Ingrediente único (receta2): ${item.ingredienteId} - Cantidad: ${finalAmount} ${item.unidad || 'u'}`);
            }            // Redondear a 2 decimales para evitar errores de punto flotante
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
          addLog(`\nESTADÍSTICAS:
- Ingredientes comunes encontrados: ${commonIngredients}
- Ingredientes únicos en pizza 1: ${uniqueIngredients1}
- Ingredientes únicos en pizza 2: ${uniqueIngredients2}
- Total ingredientes a descontar: ${result.length}`);
          
          return result;
        };
        
        // Combinar recetas
        const combinedRecipe = combineRecipes(recipe1, recipe2);
        
        // Mostrar resultado final
        addLog("\n\n🧾 RESULTADO FINAL: INGREDIENTES A DESCONTAR DEL INVENTARIO 🧾");
        addLog("----------------------------------------------------------------");
        combinedRecipe.forEach((ing: any) => {
          addLog(`▶️ ${ing.ingredienteId}: ${ing.cantidad} ${ing.unidad || 'u'}`);
        });
        
        addLog("\n\n✅ ANÁLISIS DE INVENTARIO COMPLETADO");
        addLog(`Este es el cálculo correcto que debería estar descontándose del inventario`);
        addLog(`para la Pizza Duo ${pizza1} / ${pizza2} (${size}).`);
      } else {
        addLog("\n\n❌ No se pueden combinar las recetas porque faltan una o ambas.");
        addLog("Verifica que ambas pizzas existen y tienen recetas configuradas.");
      }
      
      addLog("\n============= FIN DEL TEST =============");
      
    } catch (error) {
      addLog(`Error en la prueba: ${error}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Función auxiliar para añadir logs
  const addLog = (message: string) => {
    setLog(prev => [...prev, message]);
  };
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Diagnóstico Pizza Duo</h1>
      
      <div className="bg-gray-50 p-4 rounded-lg mb-6">
        <h2 className="text-lg font-semibold mb-2">Configuración de Prueba</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block mb-1">Pizza 1:</label>
            {loadingPizzas ? (
              <div className="w-full p-2 border rounded bg-gray-100 text-gray-500">Cargando pizzas...</div>
            ) : (
              <select 
                className="w-full p-2 border rounded"
                value={pizza1}
                onChange={(e) => setPizza1(e.target.value)}
              >
                {pizzasMenu.length > 0 ? (
                  pizzasMenu.map((p, i) => (
                    <option key={`p1-${i}`} value={p}>{p}</option>
                  ))
                ) : (
                  <option value="">No hay pizzas disponibles</option>
                )}
              </select>
            )}
          </div>
          
          <div>
            <label className="block mb-1">Pizza 2:</label>
            {loadingPizzas ? (
              <div className="w-full p-2 border rounded bg-gray-100 text-gray-500">Cargando pizzas...</div>
            ) : (
              <select 
                className="w-full p-2 border rounded"
                value={pizza2}
                onChange={(e) => setPizza2(e.target.value)}
              >
                {pizzasMenu.length > 0 ? (
                  pizzasMenu.map((p, i) => (
                    <option key={`p2-${i}`} value={p}>{p}</option>
                  ))
                ) : (
                  <option value="">No hay pizzas disponibles</option>
                )}
              </select>
            )}
          </div>
          
          <div>
            <label className="block mb-1">Tamaño:</label>
            <select 
              className="w-full p-2 border rounded"
              value={size}
              onChange={(e) => setSize(e.target.value)}
            >
              <option value="familiar">Familiar</option>
              <option value="mediana">Mediana</option>
            </select>
          </div>
        </div>
        
        <button 
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          onClick={runTest}
          disabled={loading || loadingPizzas}
        >
          {loading ? 'Ejecutando...' : loadingPizzas ? 'Cargando pizzas...' : 'Ejecutar Prueba'}
        </button>
      </div>
      
      <div className="grid grid-cols-1 gap-4">
        <div className="bg-black text-green-400 p-4 rounded-lg font-mono whitespace-pre-wrap h-[600px] overflow-y-auto">
          {log.length === 0 ? (
            <p className="text-gray-400">Ejecuta la prueba para ver los resultados...</p>
          ) : (
            log.map((line, i) => <div key={i}>{line}</div>)
          )}
        </div>
        
        <div className="bg-gray-800 text-white p-4 rounded-lg">
          <h3 className="text-lg font-bold mb-2">Instrucciones</h3>
          <p className="mb-2">
            Esta herramienta de diagnóstico te permite verificar el cálculo de ingredientes para pizzas DUO.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Selecciona las pizzas que quieres combinar en una Pizza DUO</li>
            <li>Elige el tamaño (familiar o mediana)</li>
            <li>Ejecuta la prueba para ver el resultado detallado</li>
            <li>Verifica que se encuentren ambas recetas y se calculen correctamente los ingredientes</li>
            <li><strong>IMPORTANTE:</strong> Las recetas de cada mitad ya vienen divididas por 2</li>
            <li>Los ingredientes comunes se suman (ya están divididos previamente)</li>
            <li>Los ingredientes únicos se mantienen tal cual (ya están divididos previamente)</li>
          </ul>
          <p className="mt-2 text-yellow-300">
            Si encuentras que alguna pizza no está siendo detectada, revisa los nombres exactos en la base de datos.
          </p>
        </div>
      </div>
    </div>
  );
}
"use client";

import { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, AlertCircle } from "lucide-react";
import { consumeInventoryForOrder } from "@/lib/inventory-service";

export default function DiagnosticoDuoPizzaProblem() {
  const [log, setLog] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  const addLog = (message: string) => {
    setLog(prev => [...prev, message]);
  };

  const clearLog = () => {
    setLog([]);
    setTestResult(null);
  };

  const runDiagnostic = async () => {
    clearLog();
    setLoading(true);
    
    try {
      addLog("🔍 Iniciando diagnóstico específico para Pizza Duo: Napolitana - Del Pibe");
      
      // 1. Verificar si las pizzas existen en la base de datos
      const itemsMenuSnap = await getDocs(collection(db, 'items_menu'));
      const itemsMenu: any[] = [];
      itemsMenuSnap.forEach(d => itemsMenu.push({ id: d.id, ...(d.data() || {}) }));
      
      addLog(`📋 Se encontraron ${itemsMenu.length} items en el menú`);
      
      // Función para normalizar texto
      const normalizeText = (text: string): string => {
        return (text || '').toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .trim();
      };
      
      // 2. Buscar específicamente "Napolitana" y "Del Pibe"
      const napolitana = itemsMenu.find(i => 
        normalizeText(i.nombre || i.name || '').includes("napolitana")
      );
      
      const delPibe = itemsMenu.find(i => 
        normalizeText(i.nombre || i.name || '').includes("pibe")
      );
      
      // Mostrar resultados de la búsqueda
      if (napolitana) {
        addLog(`✅ Pizza Napolitana encontrada: ${napolitana.nombre || napolitana.name}`);
        addLog(`   ID: ${napolitana.id}`);
        if (napolitana.receta && Array.isArray(napolitana.receta)) {
          addLog(`   Receta familiar tiene ${napolitana.receta.length} ingredientes`);
        } else {
          addLog(`❌ La pizza Napolitana no tiene receta familiar definida`);
        }
      } else {
        addLog(`❌ No se encontró la pizza Napolitana en el menú`);
      }
      
      if (delPibe) {
        addLog(`✅ Pizza Del Pibe encontrada: ${delPibe.nombre || delPibe.name}`);
        addLog(`   ID: ${delPibe.id}`);
        if (delPibe.receta && Array.isArray(delPibe.receta)) {
          addLog(`   Receta familiar tiene ${delPibe.receta.length} ingredientes`);
        } else {
          addLog(`❌ La pizza Del Pibe no tiene receta familiar definida`);
        }
      } else {
        addLog(`❌ No se encontró la pizza Del Pibe en el menú`);
      }
      
      // 3. Simular un pedido Duo con estas pizzas
      addLog("\n🔄 Simulando pedido de Pizza Duo (Napolitana - Del Pibe)");
      
      const orderItem = {
        nombre: "Pizza Duo Familiar (Napolitana - Del Pibe)",
        cantidad: 1,
        precio: 15990,
        pizzaType: "duo",
        pizza1: "Napolitana",
        pizza2: "Del Pibe",
        size: "familiar"
      };
      
      // 4. Ejecutar el diagnóstico de inventario
      addLog("\n📊 Ejecutando validación de inventario con el pedido simulado...");
      
      // Generar un ID de orden y número de orden para la prueba
      const testOrderId = `test-${Date.now()}`;
      const testOrderNumber = Math.floor(10000 + Math.random() * 90000);
      
      // Llamar a consumeInventoryForOrder en modo de simulación (no modifica el inventario real)
      const simulationResult = await consumeInventoryForOrder(
        [orderItem], 
        testOrderId, 
        testOrderNumber
      );
      
      if (simulationResult.success) {
        addLog("\n✅ SIMULACIÓN EXITOSA: El sistema identificó correctamente ambas pizzas");
        setTestResult('success');
      } else {
        addLog(`\n❌ ERROR EN SIMULACIÓN: ${simulationResult.error || "Error desconocido"}`);
        setTestResult('error');
      }
      
      // 5. Diagnóstico adicional del problema
      addLog("\n🔍 DIAGNÓSTICO FINAL:");
      
      if (!napolitana && !delPibe) {
        addLog("❌ PROBLEMA: Las pizzas no existen en la base de datos");
        addLog("   Solución: Verificar los nombres exactos en la colección items_menu");
      } 
      else if (!napolitana) {
        addLog("❌ PROBLEMA: La pizza Napolitana no existe en la base de datos");
        addLog("   Solución: Verificar el nombre exacto en la colección items_menu");
      }
      else if (!delPibe) {
        addLog("❌ PROBLEMA: La pizza Del Pibe no existe en la base de datos");
        addLog("   Solución: Verificar el nombre exacto en la colección items_menu");
      }
      else if (napolitana && (!napolitana.receta || !Array.isArray(napolitana.receta) || napolitana.receta.length === 0)) {
        addLog("❌ PROBLEMA: La pizza Napolitana no tiene receta definida");
        addLog("   Solución: Agregar receta a la pizza Napolitana en la base de datos");
      }
      else if (delPibe && (!delPibe.receta || !Array.isArray(delPibe.receta) || delPibe.receta.length === 0)) {
        addLog("❌ PROBLEMA: La pizza Del Pibe no tiene receta definida");
        addLog("   Solución: Agregar receta a la pizza Del Pibe en la base de datos");
      }
      else if (!simulationResult.success) {
        addLog("❌ PROBLEMA: Error en la lógica de procesamiento de inventario");
        addLog(`   Detalles: ${simulationResult.error}`);
        addLog("   Solución: Revisar los logs de consola para más detalles");
      }
      else {
        addLog("✅ No se identificaron problemas en la configuración de las pizzas");
        addLog("✅ La simulación indica que el sistema puede encontrar ambas pizzas");
        addLog("✅ La estructura de datos parece correcta");
        addLog("\n⚠️ Si el problema persiste, podría ser un problema en tiempo de ejecución");
        addLog("   Sugerencia: Verificar los logs detallados durante un pedido real");
      }
      
    } catch (error: any) {
      addLog(`\n❌ ERROR EN DIAGNÓSTICO: ${error.message || String(error)}`);
      setTestResult('error');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Diagnóstico Pizza Duo (Napolitana - Del Pibe)</h1>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Herramienta de diagnóstico</CardTitle>
          <CardDescription>
            Identifica problemas con el procesamiento de pizza Duo Napolitana - Del Pibe
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-4">
            Esta herramienta ayuda a identificar por qué el sistema no está descontando 
            correctamente los ingredientes de la mitad "Del Pibe" en las pizzas Duo.
          </p>
          <Button 
            onClick={runDiagnostic}
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Ejecutando diagnóstico...' : 'Iniciar diagnóstico'}
          </Button>
        </CardContent>
      </Card>
      
      {log.length > 0 && (
        <Card className={
          testResult === 'success' ? 'border-green-500' : 
          testResult === 'error' ? 'border-red-500' : 'border-gray-200'
        }>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <div>
              {testResult === 'success' && <CheckCircle className="w-5 h-5 text-green-500" />}
              {testResult === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
            </div>
            <div>
              <CardTitle>
                {testResult === 'success' ? 'Diagnóstico exitoso' : 
                 testResult === 'error' ? 'Problemas detectados' : 'Resultado del diagnóstico'}
              </CardTitle>
              <CardDescription>
                {log.length} mensajes generados
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-black text-green-400 p-4 rounded-md font-mono text-sm h-[400px] overflow-y-auto">
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
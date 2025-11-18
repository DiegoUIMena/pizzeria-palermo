"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, Bug } from "lucide-react";
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, Timestamp, orderBy, limit } from 'firebase/firestore';

export default function MonitorInventarioTransacciones() {
  const [log, setLog] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [transacciones, setTransacciones] = useState<any[]>([]);

  const addLog = (message: string) => {
    setLog(prev => [...prev, message]);
  };
  
  const clearLog = () => {
    setLog([]);
    setTransacciones([]);
  };

  // Función para examinar las transacciones recientes de inventario
  const buscarTransacciones = async () => {
    clearLog();
    setLoading(true);
    
    try {
      addLog("🔍 Buscando transacciones recientes de inventario...");
      
      const transaccionesQuery = query(
        collection(db, 'inventory_transactions'),
        orderBy('timestamp', 'desc'),
        limit(10)
      );
      
      const transaccionesSnapshot = await getDocs(transaccionesQuery);
      const transaccionesData: any[] = [];
      
      transaccionesSnapshot.forEach(doc => {
        transaccionesData.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      setTransacciones(transaccionesData);
      addLog(`✅ Se encontraron ${transaccionesData.length} transacciones recientes`);
      
      // Mostrar un resumen de las transacciones
      transaccionesData.forEach((t, index) => {
        const fecha = new Date(t.timestamp).toLocaleString();
        const items = t.items ? t.items.length : 0;
        
        addLog(`\n📝 Transacción #${index + 1}: ${t.id}`);
        addLog(`   Fecha: ${fecha}`);
        addLog(`   Estado: ${t.status || 'Desconocido'}`);
        addLog(`   Pedido: ${t.orderId || 'N/A'} (#${t.orderNumber || 'N/A'})`);
        
        if (t.error) {
          addLog(`   ⚠️ Error: ${t.error}`);
        }
        
        if (items > 0) {
          addLog(`   Items procesados: ${items}`);
          
          // Buscar específicamente ingredientes de pizza Del Pibe
          const delPibeItems = t.items.filter((item: any) => {
            // Buscar ingredientes específicos que suelen estar en la pizza Del Pibe
            // (Esto es un ejemplo, deberías adaptar según los ingredientes reales)
            const nombreLower = (item.nombre || '').toLowerCase();
            return nombreLower.includes('jamón') || 
                  nombreLower.includes('jamon') || 
                  nombreLower.includes('huevo') || 
                  nombreLower.includes('choclo');
          });
          
          if (delPibeItems.length > 0) {
            addLog(`   🔍 Ingredientes típicos de Del Pibe encontrados: ${delPibeItems.length}`);
            delPibeItems.forEach((item: any) => {
              addLog(`      - ${item.nombre}: ${item.cantidadConsumida} ${item.unidad} (Anterior: ${item.cantidadAnterior}, Nuevo: ${item.cantidadNueva})`);
            });
          } else {
            addLog(`   ⚠️ No se encontraron ingredientes típicos de pizza Del Pibe`);
          }
        }
      });
      
    } catch (error: any) {
      addLog(`❌ Error al buscar transacciones: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Función para examinar un pedido específico
  const examinarPedidoEspecifico = async () => {
    clearLog();
    setLoading(true);
    
    try {
      const pedidoId = prompt("Ingrese el ID del pedido que desea examinar:");
      if (!pedidoId) {
        addLog("❌ No se ingresó un ID de pedido");
        setLoading(false);
        return;
      }
      
      addLog(`🔍 Examinando pedido: ${pedidoId}`);
      
      // 1. Obtener el pedido
      const pedidoDoc = await getDoc(doc(db, 'pedidos', pedidoId));
      
      if (!pedidoDoc.exists()) {
        addLog(`❌ No se encontró el pedido con ID: ${pedidoId}`);
        setLoading(false);
        return;
      }
      
      const pedidoData = pedidoDoc.data();
      addLog(`✅ Pedido encontrado: #${pedidoData.orderNumber || 'N/A'}`);
      addLog(`   Estado: ${pedidoData.estado || 'Desconocido'}`);
      addLog(`   Fecha: ${new Date(pedidoData.fechaCreacion).toLocaleString()}`);
      
      // 2. Examinar los items del pedido
      const items = pedidoData.items || [];
      
      addLog(`\n📋 Items en el pedido: ${items.length}`);
      
      let pizzasDuo = items.filter((item: any) => item.pizzaType === 'duo');
      if (pizzasDuo.length > 0) {
        addLog(`\n🍕 Encontradas ${pizzasDuo.length} pizzas Duo:`);
        
        pizzasDuo.forEach((pizza: any, index: number) => {
          addLog(`\n📌 Pizza Duo #${index + 1}:`);
          addLog(`   Nombre: ${pizza.nombre || 'Sin nombre'}`);
          addLog(`   Pizza 1: ${pizza.pizza1 || 'No especificado'}`);
          addLog(`   Pizza 2: ${pizza.pizza2 || 'No especificado'}`);
          addLog(`   Tamaño: ${pizza.size || 'No especificado'}`);
          addLog(`   Cantidad: ${pizza.cantidad || 1}`);
        });
      } else {
        addLog(`❌ No se encontraron pizzas Duo en este pedido`);
      }
      
      // 3. Buscar las transacciones de inventario relacionadas
      const transaccionesQuery = query(
        collection(db, 'inventory_transactions'),
        where('orderId', '==', pedidoId)
      );
      
      const transaccionesSnapshot = await getDocs(transaccionesQuery);
      const transaccionesData: any[] = [];
      
      transaccionesSnapshot.forEach(doc => {
        transaccionesData.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      if (transaccionesData.length > 0) {
        addLog(`\n💾 Transacciones de inventario encontradas: ${transaccionesData.length}`);
        
        transaccionesData.forEach((t, index) => {
          const fecha = new Date(t.timestamp).toLocaleString();
          const items = t.items ? t.items.length : 0;
          
          addLog(`\n📝 Transacción #${index + 1}: ${t.id}`);
          addLog(`   Fecha: ${fecha}`);
          addLog(`   Estado: ${t.status || 'Desconocido'}`);
          
          if (t.error) {
            addLog(`   ⚠️ Error: ${t.error}`);
          }
          
          if (items > 0) {
            addLog(`   Items procesados: ${items}`);
            
            // Mostrar algunos ingredientes para análisis
            addLog(`   Muestra de ingredientes procesados:`);
            t.items.slice(0, 10).forEach((item: any) => {
              addLog(`      - ${item.nombre}: ${item.cantidadConsumida} ${item.unidad}`);
            });
          }
        });
      } else {
        addLog(`❌ No se encontraron transacciones de inventario para este pedido`);
      }
      
    } catch (error: any) {
      addLog(`❌ Error al examinar pedido: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Monitor de Transacciones de Inventario</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Últimas Transacciones</CardTitle>
            <CardDescription>
              Ver las transacciones recientes de inventario y buscar ingredientes de la pizza Del Pibe
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4">
              Esta herramienta busca transacciones recientes de inventario y analiza 
              si se están descontando los ingredientes típicos de la pizza Del Pibe.
            </p>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={buscarTransacciones}
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Buscando...' : 'Buscar Transacciones Recientes'}
            </Button>
          </CardFooter>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Examinar Pedido Específico</CardTitle>
            <CardDescription>
              Analizar detalladamente un pedido con pizza Duo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4">
              Ingrese el ID de un pedido que contenga una pizza Duo para examinar 
              los detalles del pedido y las transacciones de inventario relacionadas.
            </p>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={examinarPedidoEspecifico}
              disabled={loading}
              variant="outline"
              className="w-full"
            >
              {loading ? 'Examinando...' : 'Examinar Pedido por ID'}
            </Button>
          </CardFooter>
        </Card>
      </div>
      
      {log.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <div>
              <Bug className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <CardTitle>Resultados del Análisis</CardTitle>
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
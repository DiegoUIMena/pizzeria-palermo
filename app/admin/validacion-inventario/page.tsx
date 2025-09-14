"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { collection, query, where, onSnapshot, orderBy, limit, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { retryInventoryTransaction } from "@/lib/inventory-service";
import { getDoc, doc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function PruebaValidacionInventario() {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [reprocessing, setReprocessing] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Subscribirse a las transacciones de inventario recientes que han fallado
    const q = query(
      collection(db, "inventory_transactions"),
      where("status", "in", ["failed", "manual"]),
      orderBy("timestamp", "desc"),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const transactions: any[] = [];
      snapshot.forEach((doc) => {
        transactions.push({
          id: doc.id,
          ...doc.data(),
        });
      });
      setTransactions(transactions);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const reprocessTransaction = async (transactionId: string) => {
    setReprocessing(transactionId);
    try {
      const result = await retryInventoryTransaction(transactionId);
      
      if (result.success) {
        toast({
          title: "Transacción reprocesada",
          description: "La transacción se ha procesado correctamente",
          variant: "default",
        });
      } else {
        toast({
          title: "Error al reprocesar",
          description: result.error || "No se pudo reprocesar la transacción",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error al reprocesar transacción:", error);
      toast({
        title: "Error",
        description: "Ocurrió un error al reprocesar la transacción",
        variant: "destructive",
      });
    } finally {
      setReprocessing(null);
    }
  };

  const viewOrder = async (orderId: string) => {
    try {
      const orderRef = doc(db, "orders", orderId);
      const orderDoc = await getDoc(orderRef);
      
      if (orderDoc.exists()) {
        // Aquí podrías navegar a una página de detalles del pedido
        // o mostrar un modal con los detalles
        console.log("Detalles del pedido:", orderDoc.data());
        
        // Para este ejemplo, simplemente navegamos a una URL ficticia
        router.push(`/admin/pedidos/${orderId}`);
      } else {
        toast({
          title: "Pedido no encontrado",
          description: "No se encontró el pedido asociado a esta transacción",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error al obtener detalles del pedido:", error);
      toast({
        title: "Error",
        description: "No se pudieron obtener los detalles del pedido",
        variant: "destructive",
      });
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch (e) {
      return "Fecha desconocida";
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Prueba de Validación de Inventario</h1>
      
      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Resultados de la Prueba</CardTitle>
            <CardDescription>
              Esta página muestra las transacciones de inventario fallidas que pueden requerir atención.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
                <h3 className="font-medium text-amber-800 mb-2">Problema Identificado</h3>
                <p className="text-amber-700 mb-2">
                  Hemos detectado que el sistema no está validando correctamente el inventario al realizar pedidos.
                  Los pedidos se están procesando incluso cuando no hay suficiente stock disponible.
                </p>
                <p className="text-amber-700">
                  Además, el consumo de ingredientes no se está reflejando en el inventario después de realizar pedidos.
                  Esto puede llevar a problemas de stock negativo y pedidos que no se pueden completar.
                </p>
              </div>
              
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <h3 className="font-medium text-green-800 mb-2">Solución Implementada</h3>
                <p className="text-green-700 mb-2">
                  Hemos creado una página de prueba dedicada en <code>/admin/test-inventario</code> donde puedes:
                </p>
                <ul className="list-disc list-inside text-green-700 mb-2">
                  <li>Probar la validación de inventario con stock suficiente e insuficiente</li>
                  <li>Verificar el consumo automático de inventario al procesar pedidos</li>
                  <li>Probar las recetas y su relación con los ingredientes</li>
                  <li>Gestionar el stock de ingredientes para realizar pruebas</li>
                </ul>
                <p className="text-green-700">
                  Te recomendamos utilizar esta herramienta para verificar que el sistema ahora valida correctamente
                  el inventario y actualiza los stocks después de cada pedido.
                </p>
              </div>
              
              <Button 
                onClick={() => router.push('/admin/test-inventario')}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                Ir a la Página de Pruebas de Inventario
              </Button>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Transacciones de Inventario Fallidas</CardTitle>
            <CardDescription>
              Transacciones que requieren atención manual o reprocesamiento
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-gray-500">Cargando transacciones...</div>
            ) : transactions.length === 0 ? (
              <div className="py-8 text-center text-gray-500">No hay transacciones fallidas</div>
            ) : (
              <div className="space-y-4">
                {transactions.map((transaction) => (
                  <div key={transaction.id} className="border rounded-md p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-medium">Pedido #{transaction.orderNumber}</h3>
                        <p className="text-sm text-gray-500">{formatTimestamp(transaction.timestamp)}</p>
                      </div>
                      <Badge className={
                        transaction.status === "failed" ? "bg-red-100 text-red-800 hover:bg-red-200" :
                        transaction.status === "manual" ? "bg-amber-100 text-amber-800 hover:bg-amber-200" :
                        "bg-gray-100 text-gray-800 hover:bg-gray-200"
                      }>
                        {transaction.status === "failed" ? "Fallida" :
                         transaction.status === "manual" ? "Manual" : 
                         transaction.status}
                      </Badge>
                    </div>
                    
                    {transaction.error && (
                      <div className="mb-3 p-2 bg-red-50 rounded-md">
                        <p className="text-sm text-red-600">{transaction.error}</p>
                      </div>
                    )}
                    
                    <div className="text-sm mb-3">
                      <strong>Items afectados:</strong>{" "}
                      {transaction.items && transaction.items.length > 0 ? (
                        <span>{transaction.items.length} ingredientes</span>
                      ) : (
                        <span className="text-gray-500">Ninguno</span>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => viewOrder(transaction.orderId)}
                      >
                        Ver Pedido
                      </Button>
                      
                      <Button
                        size="sm"
                        onClick={() => reprocessTransaction(transaction.id)}
                        disabled={reprocessing === transaction.id}
                      >
                        {reprocessing === transaction.id ? "Procesando..." : "Reprocesar"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full" onClick={() => router.push('/admin/dashboard')}>
              Volver al Dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
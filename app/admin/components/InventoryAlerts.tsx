"use client"

import { useEffect, useState } from "react"
import { collection, query, where, orderBy, limit, onSnapshot, doc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, RefreshCw, CheckCircle2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { retryInventoryTransaction } from "@/lib/inventory-service"
import { toast } from "@/hooks/use-toast"

interface InventoryTransaction {
  id: string
  orderId: string
  orderNumber: number
  timestamp: string
  status: 'success' | 'failed' | 'retry' | 'manual' | 'processing'
  error?: string
  items: Array<{
    ingredienteId: string
    nombre: string
    cantidadAnterior: number
    cantidadConsumida: number
    cantidadNueva: number
    unidad: string
  }>
  validationDetails?: Array<{
    item: string
    missing: Array<{
      ingrediente: string
      ingredienteId: string
      needed: number
      available: number
      unidad: string
    }>
  }>
  retryCount?: number
}

function InventoryAlerts() {
  const [pendingTransactions, setPendingTransactions] = useState<InventoryTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<Record<string, boolean>>({})

  useEffect(() => {
    // Suscribirse a transacciones pendientes de resolución manual
    const q = query(
      collection(db, "inventory_transactions"),
      where("status", "in", ["failed", "manual", "retry"]),
      orderBy("timestamp", "desc"),
      limit(10)
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const transactions: InventoryTransaction[] = []
      snapshot.forEach((doc) => {
        transactions.push({
          id: doc.id,
          ...doc.data()
        } as InventoryTransaction)
      })
      setPendingTransactions(transactions)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const handleRetry = async (transactionId: string) => {
    setProcessing(prev => ({ ...prev, [transactionId]: true }))
    
    try {
      const success = await retryInventoryTransaction(transactionId)
      
      if (success) {
        toast({
          title: "Transacción reintentada",
          description: "La operación de inventario se completó exitosamente.",
          variant: "default",
        })
      } else {
        toast({
          title: "Error al reintentar",
          description: "No se pudo completar la operación. Revisa los detalles.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error al reintentar transacción:', error)
      toast({
        title: "Error",
        description: "Ocurrió un error al procesar la solicitud.",
        variant: "destructive",
      })
    } finally {
      setProcessing(prev => ({ ...prev, [transactionId]: false }))
    }
  }

  const handleManualResolution = async (transactionId: string) => {
    setProcessing(prev => ({ ...prev, [transactionId]: true }))
    
    try {
      // Marcar como resuelto manualmente
      const transactionRef = doc(db, "inventory_transactions", transactionId)
      await updateDoc(transactionRef, {
        status: "success",
        manuallyResolved: true,
        manualResolvedAt: new Date().toISOString(),
      })
      
      toast({
        title: "Resuelto manualmente",
        description: "La transacción ha sido marcada como resuelta manualmente.",
        variant: "default",
      })
    } catch (error) {
      console.error('Error al resolver manualmente:', error)
      toast({
        title: "Error",
        description: "No se pudo marcar como resuelto.",
        variant: "destructive",
      })
    } finally {
      setProcessing(prev => ({ ...prev, [transactionId]: false }))
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />
            Alertas de Inventario
          </CardTitle>
          <CardDescription>Cargando alertas...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (pendingTransactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <CheckCircle2 className="h-5 w-5 text-green-500 mr-2" />
            Alertas de Inventario
          </CardTitle>
          <CardDescription>No hay problemas de inventario pendientes</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
          Alertas de Inventario
        </CardTitle>
        <CardDescription>
          Hay {pendingTransactions.length} transacciones de inventario pendientes de resolución
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {pendingTransactions.map((transaction) => (
            <div key={transaction.id} className={`border rounded-md p-4 ${
              transaction.status === 'failed' ? 'bg-red-50' : 
              transaction.status === 'retry' ? 'bg-yellow-50' : 
              'bg-orange-50'
            }`}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">Pedido #{transaction.orderNumber}</h4>
                    <Badge variant={
                      transaction.status === 'failed' ? 'destructive' : 
                      transaction.status === 'retry' ? 'secondary' : 
                      'outline'
                    }>
                      {transaction.status === 'failed' ? 'Fallido' : 
                       transaction.status === 'retry' ? 'Reintentando' : 
                       'Manual'}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-500">
                    {new Date(transaction.timestamp).toLocaleString()}
                  </p>
                  <p className="text-sm mt-2 text-red-600 font-medium">
                    {transaction.error || "Error procesando inventario"}
                  </p>
                  
                  {transaction.validationDetails && transaction.validationDetails.length > 0 && (
                    <div className="mt-2 text-sm">
                      <p className="font-medium">Ingredientes faltantes:</p>
                      <ul className="list-disc pl-5 mt-1 space-y-1">
                        {transaction.validationDetails.map((item, idx) => (
                          <li key={idx}>
                            <span className="font-medium">{item.item}</span>
                            <ul className="list-['→'] pl-4 mt-1">
                              {item.missing.map((ing, idx2) => (
                                <li key={idx2} className="text-xs">
                                  {ing.ingrediente}: necesario {ing.needed} {ing.unidad}, 
                                  disponible {ing.available} {ing.unidad}
                                </li>
                              ))}
                            </ul>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Button 
                    size="sm" 
                    onClick={() => handleRetry(transaction.id)}
                    disabled={!!processing[transaction.id] || (transaction.retryCount ? transaction.retryCount >= 3 : false)}
                    className="flex items-center w-full"
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    {processing[transaction.id] ? 'Procesando...' : 'Reintentar'}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleManualResolution(transaction.id)}
                    disabled={processing[transaction.id]}
                    className="flex items-center w-full"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Resolver Manual
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="outline" className="w-full">
          Ver Todas las Alertas
        </Button>
      </CardFooter>
    </Card>
  )
}

export default InventoryAlerts
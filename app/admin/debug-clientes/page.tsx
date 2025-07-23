"use client"

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { getAllOrders } from '@/lib/orders'

export default function DebugClientes() {
  const [clientes, setClientes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadOrders() {
      try {
        setLoading(true)
        const orders = await getAllOrders()
        
        // Extraer y formatear los datos de clientes de cada pedido
        const clientesData = orders.map(order => ({
          orderNumber: order.orderNumber,
          orderDate: order.fechaCreacion,
          userId: order.userId,
          // Datos de cliente - como están en el pedido
          cliente: order.cliente,
          // Datos desglosados para análisis
          clienteRaw: JSON.stringify(order.cliente),
          clienteTipo: typeof order.cliente,
          tieneNombre: order.cliente ? 
            (typeof order.cliente === 'object' ? 
              ((order.cliente as any).nombre || (order.cliente as any).name) ? 'Sí' : 'No' 
              : 'No') 
            : 'No',
          tieneTelefono: order.cliente ? 
            (typeof order.cliente === 'object' ? 
              ((order.cliente as any).telefono || (order.cliente as any).phone) ? 'Sí' : 'No' 
              : 'No') 
            : 'No',
          tieneEmail: order.cliente ? 
            (typeof order.cliente === 'object' ? 
              (order.cliente as any).email ? 'Sí' : 'No' 
              : 'No') 
            : 'No',
        }))
        
        setClientes(clientesData)
      } catch (err) {
        setError('Error al cargar datos')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    
    loadOrders()
  }, [])

  if (loading) return <div className="p-8">Cargando datos de clientes...</div>
  if (error) return <div className="p-8 text-red-500">Error: {error}</div>

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Depuración de Datos de Clientes</h1>
      
      <div className="mb-4">
        <p>Total de pedidos analizados: {clientes.length}</p>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 border">Pedido #</th>
              <th className="p-2 border">Fecha</th>
              <th className="p-2 border">ID Usuario</th>
              <th className="p-2 border">Datos Cliente (raw)</th>
              <th className="p-2 border">Tipo</th>
              <th className="p-2 border">Nombre</th>
              <th className="p-2 border">Teléfono</th>
              <th className="p-2 border">Email</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((cliente, index) => (
              <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                <td className="p-2 border">{cliente.orderNumber}</td>
                <td className="p-2 border">{cliente.orderDate}</td>
                <td className="p-2 border">{cliente.userId}</td>
                <td className="p-2 border font-mono text-xs">{cliente.clienteRaw}</td>
                <td className="p-2 border">{cliente.clienteTipo}</td>
                <td className="p-2 border">{cliente.tieneNombre}</td>
                <td className="p-2 border">{cliente.tieneTelefono}</td>
                <td className="p-2 border">{cliente.tieneEmail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

"use client"

import React, { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { X, AlertCircle } from "lucide-react"

interface InventoryErrorModalProps {
  isOpen: boolean
  onClose: () => void
  validationDetails: any[] | undefined
  onModifyCart: () => void
}

export default function InventoryErrorModal({
  isOpen,
  onClose,
  validationDetails,
  onModifyCart
}: InventoryErrorModalProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    console.log("InventoryErrorModal: montado con isOpen =", isOpen)
  }, [])

  useEffect(() => {
    console.log("InventoryErrorModal: valor de isOpen cambió a =", isOpen)
  }, [isOpen])

  if (!mounted) {
    return null
  }

  return (
    <>
      {console.log("InventoryErrorModal: Renderizando con isOpen =", isOpen)}
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-6 w-6" />
            <DialogTitle className="text-xl font-bold">¡Atención! Inventario insuficiente</DialogTitle>
          </div>
          <DialogDescription className="text-base mt-2 font-semibold">
            No podemos procesar tu pedido porque no hay suficiente stock de algunos ingredientes.
          </DialogDescription>
        </DialogHeader>

        {validationDetails && validationDetails.length > 0 ? (
          <div className="space-y-4 my-4">
            {validationDetails.map((item, index) => (
              <div key={index} className="p-4 bg-red-50 border-2 border-red-300 rounded-md shadow-sm">
                <h3 className="font-bold text-red-800 mb-3 text-lg flex items-center">
                  <span className="bg-red-100 text-red-800 p-1 rounded-full mr-2 w-6 h-6 flex items-center justify-center text-sm">
                    {index + 1}
                  </span>
                  {item.item}
                </h3>
                
                {item.missing && item.missing.length > 0 && (
                  <div className="space-y-3 ml-3 bg-white p-3 rounded-md">
                    {item.missing.map((ing: any, idx: number) => (
                      <div key={idx} className="flex flex-col md:flex-row md:justify-between text-sm border-b border-gray-100 pb-2">
                        <span className="font-medium text-gray-800 mb-1 md:mb-0">
                          {ing.ingrediente}:
                        </span>
                        <div className="flex flex-col md:items-end">
                          <span className="text-red-600">
                            Necesario: <strong>{ing.needed} {ing.unidad}</strong>
                          </span>
                          <span className="text-gray-600">
                            Disponible: {ing.available} {ing.unidad}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="my-4 p-4 bg-red-50 border border-red-200 rounded-md text-center">
            <p className="text-red-700 font-medium">
              No hay suficiente stock para procesar tu pedido. Por favor, modifica tu selección.
            </p>
          </div>
        )}
        
        <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200 mb-4">
          <p className="text-sm text-gray-800 font-medium">
            Por favor, modifica tu pedido eliminando o cambiando los productos que contienen estos ingredientes.
          </p>
        </div>

        <DialogFooter className="gap-3 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Cerrar
          </Button>
          <Button onClick={onModifyCart} className="bg-pink-600 hover:bg-pink-700">
            Modificar pedido
          </Button>
        </DialogFooter>
      </DialogContent>
      </Dialog>
    </>
  )
}
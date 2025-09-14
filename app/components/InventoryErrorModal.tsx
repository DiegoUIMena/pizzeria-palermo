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
  }, [])

  if (!mounted) {
    return null
  }

  // Si no hay detalles de validación, no mostrar el modal
  if (!validationDetails || validationDetails.length === 0) {
    return null
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-6 w-6" />
            <DialogTitle>No hay suficiente stock</DialogTitle>
          </div>
          <DialogDescription>
            No podemos procesar tu pedido porque faltan los siguientes ingredientes:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-2">
          {validationDetails.map((item, index) => (
            <div key={index} className="p-3 bg-red-50 border border-red-200 rounded-md">
              <h3 className="font-medium text-red-800 mb-2">{item.item}</h3>
              
              {item.missing && item.missing.length > 0 && (
                <div className="space-y-2 ml-2">
                  {item.missing.map((ing: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-gray-700">
                        {ing.ingrediente}:
                      </span>
                      <span className="font-semibold text-red-600">
                        Necesario: {ing.needed} {ing.unidad}, Disponible: {ing.available} {ing.unidad}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        
        <p className="text-sm text-gray-600 mt-2 mb-4">
          Por favor, modifica tu pedido eliminando o cambiando los productos que contienen estos ingredientes.
        </p>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Cerrar
          </Button>
          <Button onClick={onModifyCart}>
            Modificar pedido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
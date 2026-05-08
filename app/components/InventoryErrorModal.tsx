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

  // Extraer nombres únicos de productos con falta de stock
  const productosConFalta = validationDetails && validationDetails.length > 0
    ? [...new Set(validationDetails.map((item: any) => item.item || item.nombre))]
    : []

  const productosTexto = productosConFalta.join(", ")

  return (
    <>
      {console.log("InventoryErrorModal: Renderizando con isOpen =", isOpen)}
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-6 w-6" />
            <DialogTitle className="text-xl font-bold">¡Atención!</DialogTitle>
          </div>
        </DialogHeader>

        <div className="my-4 p-4 bg-red-50 border border-red-200 rounded-md text-center space-y-3">
          <p className="text-red-800 font-semibold text-base">
            No podemos procesar tu pedido.
          </p>
          <p className="text-red-700 font-bold text-lg">
            STOCK INSUFICIENTE de {productosTexto}
          </p>
          <p className="text-gray-700 text-sm">
            Daremos aviso a Palermo para solucionarlo a la brevedad.
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
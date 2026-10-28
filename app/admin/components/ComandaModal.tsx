"use client"

import React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Printer, CheckCircle2 } from "lucide-react"

export function getSpecialOrderNote(notas?: string): string {
  if (!notas || typeof notas !== 'string') return ''

  let cleaned = notas
    .replace(/\[POS\s*-\s*Venta\s+Presencial\]/gi, '')
    .replace(/POS\s*-\s*Venta\s+Presencial/gi, '')
    .replace(/\|?\s*\[CÓDIGO USADO:[^\]]+\]/g, '')
    .replace(/\|?\s*\[VOUCHER USADO:[^\]]+\]/g, '')
    .trim()

  cleaned = cleaned
    .replace(/^\|\s*/, '')
    .replace(/\s*\|$/, '')
    .replace(/\s*\|\s*\|+/g, ' | ')
    .trim()

  return cleaned
}

const formatCurrency = (value: number) => `$${Math.round(value).toLocaleString('es-CL')}`

function getPedidoMontos(pedido: any) {
  const totalGuardado = Number(pedido?.total || 0)
  const valorDelivery = Math.max(0, Number(pedido?.valorDelivery ?? pedido?.delivery ?? 0))
  let discountAmount = Number(pedido?.discountAmount || 0)
  const voucherDiscount = Number(pedido?.voucherDiscount || 0)
  const subtotalGuardado = Number(pedido?.subtotal || 0)

  if (discountAmount === 0 && voucherDiscount === 0 && subtotalGuardado > 0) {
    const implicitDiscount = subtotalGuardado + valorDelivery - totalGuardado
    if (implicitDiscount > 0) {
      discountAmount = implicitDiscount
    }
  }

  const totalDescuentos = discountAmount + voucherDiscount
  const subtotal = subtotalGuardado > 0
    ? subtotalGuardado
    : Math.max(0, totalGuardado - valorDelivery + totalDescuentos)

  return {
    subtotal,
    valorDelivery,
    descuentos: totalDescuentos,
    discountCode: pedido?.discountCode,
    voucherCode: pedido?.voucherCode,
    totalConDelivery: totalGuardado
  }
}

interface ComandaModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pedido: any | null
}

export default function ComandaModal({ open, onOpenChange, pedido }: ComandaModalProps) {
  if (!pedido) return null

  const orderNum = String(pedido.orderNumber || pedido.id || '').replace('#', '').trim()
  const nombreCliente = (
    pedido.cliente?.nombre &&
    pedido.cliente.nombre !== 'Usuario anónimo' &&
    pedido.cliente.nombre !== 'No especificado' &&
    pedido.cliente.nombre !== 'No informado'
  )
    ? String(pedido.cliente.nombre).toUpperCase().trim()
    : 'CLIENTE'

  const fechaTexto = pedido.fechaCreacion || (pedido.fecha ? String(pedido.fecha) : new Date().toLocaleDateString('es-CL'))
  const esDelivery = pedido.tipoEntrega === 'Delivery' || Number(pedido.valorDelivery || pedido.delivery || 0) > 0

  const confirmarImpresion = () => {
    const printContent = document.getElementById('comanda-reporte-imprimir')
    if (!printContent) return

    const iframe = document.createElement('iframe')
    iframe.style.position = 'absolute'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)

    iframe.onload = () => {
      const printStyles = `
        <style>
          @media print {
            @page { size: 58mm auto; margin: 0; }
            body { margin: 0; padding: 4mm 3mm; font-size: 12pt; }
            .comanda-container { width: 58mm; max-width: 58mm; margin: 0 auto; }
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          body { font-family: Arial, sans-serif; color: #000; }
          .comanda-container { font-size: 12px; line-height: 1.2; }
          .comanda-header { text-align: center; }
          .comanda-logo { width: 32mm; height: auto; margin: 4px auto 3px; display: block; }
          .comanda-order-number { 
            font-family: 'Arial Narrow', 'Roboto Condensed', 'Archivo Narrow', sans-serif-condensed, sans-serif;
            font-stretch: condensed;
            font-size: 18px; 
            font-weight: 700; 
            letter-spacing: -0.2px; 
            text-decoration: underline; 
            margin: 2px 0 4px; 
          }
          .comanda-pill {
            display: inline-block; background: #fff; color: #000; 
            border: 1.5px solid #000;
            border-radius: 999px; padding: 4px 12px; font-weight: 700; 
            font-size: 12px; letter-spacing: 0.7px; margin: 4px 0 4px;
          }
          .comanda-meta { font-size: 9px; margin: 3px 0; }
          .comanda-payment { font-size: 9px; margin-top: 3px; }
          .comanda-divider { border-top: 1px solid #999; margin: 7px 0; }
          .comanda-items { margin-top: 6px; text-align: center; }
          .comanda-item { margin-bottom: 6px; }
          .comanda-item-name { font-size: 13px; font-weight: 700; text-align: center; }
          .comanda-item-detail { font-size: 12px; text-align: center; }
          .comanda-totals { text-align: center; margin-top: 6px; }
          .comanda-total-row { font-size: 12px; margin: 2px 0; }
          .comanda-total-strong { font-size: 14px; font-weight: 700; }
        </style>
      `

      const content = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Comanda #${orderNum}</title>
            ${printStyles}
          </head>
          <body>
            ${printContent.innerHTML}
          </body>
        </html>
      `

      iframe.contentWindow?.document.open()
      iframe.contentWindow?.document.write(content)
      iframe.contentWindow?.document.close()

      setTimeout(() => {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()

        setTimeout(() => {
          document.body.removeChild(iframe)
          onOpenChange(false)
        }, 100)
      }, 200)
    }

    iframe.src = 'about:blank'
  }

  const { subtotal, valorDelivery, descuentos, discountCode, voucherCode, totalConDelivery } = getPedidoMontos(pedido)
  const notaEspecial = getSpecialOrderNote(pedido.notas)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            Comanda de Pedido #{orderNum}
          </DialogTitle>
        </DialogHeader>

        <div id="comanda-reporte-imprimir" className="mt-4 p-4 bg-white text-black rounded border mx-auto">
          <style jsx global>{`
            .comanda-container {
              font-family: Arial, sans-serif;
              font-size: 12px;
              line-height: 1.2;
              width: 58mm;
              max-width: 58mm;
              margin: 0 auto;
              color: #000;
            }
            .comanda-header { text-align: center; }
            .comanda-logo { width: 32mm; height: auto; margin: 4px auto 3px; display: block; }
            .comanda-order-number { 
              font-family: 'Arial Narrow', 'Roboto Condensed', 'Archivo Narrow', sans-serif-condensed, sans-serif;
              font-stretch: condensed;
              font-size: 18px; 
              font-weight: 700; 
              letter-spacing: -0.2px; 
              text-decoration: underline; 
              margin: 2px 0 4px; 
            }
            .comanda-pill {
              display: inline-block; background: #fff; color: #000; 
              border: 1.5px solid #000;
              border-radius: 999px; padding: 4px 12px; font-weight: 700; 
              font-size: 12px; letter-spacing: 0.7px; margin: 4px 0 4px;
            }
            .comanda-meta { font-size: 9px; margin: 3px 0; }
            .comanda-payment { font-size: 9px; margin-top: 3px; }
            .comanda-divider { border-top: 1px solid #999; margin: 7px 0; }
            .comanda-items { margin-top: 6px; text-align: center; }
            .comanda-item { margin-bottom: 6px; }
            .comanda-item-name { font-size: 13px; font-weight: 700; text-align: center; }
            .comanda-item-detail { font-size: 12px; text-align: center; }
            .comanda-totals { text-align: center; margin-top: 6px; }
            .comanda-total-row { font-size: 12px; margin: 2px 0; }
            .comanda-total-strong { font-size: 14px; font-weight: 700; }
          `}</style>

          <div className="comanda-container">
            <div className="comanda-header">
              <img src="/iconos/logo_negro.png" alt="Palermo Pizzas" className="comanda-logo" />
              <br />
              <div className="comanda-order-number">
                {orderNum} - {nombreCliente}
              </div>

              <div className="comanda-pill">
                {esDelivery ? 'DELIVERY' : 'RETIRO'}
              </div>

              <div className="comanda-meta">
                {fechaTexto}
              </div>

              <div className="comanda-payment">
                Medio de pago: {String(pedido.metodoPago || '').toUpperCase()}
              </div>
            </div>

            <div className="comanda-divider"></div>

            <div className="comanda-items">
              {Array.isArray(pedido.items) && pedido.items.map((item: any, idx: number) => {
                const detalles: React.ReactNode[] = []
                let sizeLetter = item.size ? String(item.size).trim().charAt(0).toUpperCase() : ''
                if (!sizeLetter) {
                  const match = item.nombre ? item.nombre.match(/\((familiar|mediana|personal|grande|f|m|p|g)\)/i) : null
                  if (match) {
                    sizeLetter = match[1].charAt(0).toUpperCase()
                  }
                }
                const nombreSinTamano = (item.nombre || '')
                  .replace(/^\s*pizza\s+personalizada\s*$/i, 'Personalizada')
                  .replace(/\s*\((?:familiar|mediana|personal|grande|f|m|p|g)\)\s*$/i, '')
                  .trim()
                const isDuo = item.pizzaType === 'duo' || Boolean(item.half1 || item.half2)
                const half1Variety = item.half1?.variety || item.pizza1 || 'Personalizada'
                const half2Variety = item.half2?.variety || item.pizza2 || 'Personalizada'
                const half1Extras = [
                  ...(item.half1?.simpleIngredients || []),
                  ...(item.half1?.premiumIngredients || []),
                ]
                const half2Extras = [
                  ...(item.half2?.simpleIngredients || []),
                  ...(item.half2?.premiumIngredients || []),
                ]
                const displayName = isDuo ? 'Pizza DUO' : nombreSinTamano

                if (isDuo) {
                  detalles.push(`Mitad 1: ${half1Variety}`)
                  if (half1Extras.length) {
                    half1Extras.forEach((ex: string) => detalles.push(`+ ${ex}`))
                  }

                  detalles.push('\u00A0')
                  detalles.push(`Mitad 2: ${half2Variety}`)
                  if (half2Extras.length) {
                    half2Extras.forEach((ex: string) => detalles.push(`+ ${ex}`))
                  }

                  const h1Raw = [...(item.half1?.simpleIngredients || []), ...(item.half1?.premiumIngredients || [])]
                  const h2Raw = [...(item.half2?.simpleIngredients || []), ...(item.half2?.premiumIngredients || [])]

                  const rawExtraSimple = (Array.isArray(item.extraSimple) && item.extraSimple.length > 0)
                    ? item.extraSimple
                    : (Array.isArray(item.ingredients) ? item.ingredients.filter((ex: string) => !h1Raw.includes(ex) && !h2Raw.includes(ex)) : [])

                  const rawExtraPremium = (Array.isArray(item.extraPremium) && item.extraPremium.length > 0)
                    ? item.extraPremium
                    : (Array.isArray(item.premiumIngredients) ? item.premiumIngredients.filter((ex: string) => !h1Raw.includes(ex) && !h2Raw.includes(ex)) : [])

                  const todaLaPizzaExtras = [
                    ...rawExtraSimple.map((ex: string) => `+ ${ex}`),
                    ...rawExtraPremium.map((ex: string) => `+ ${ex} (P)`),
                  ]
                  if (todaLaPizzaExtras.length) {
                    detalles.push('\u00A0')
                    detalles.push(`Toda la pizza:`)
                    todaLaPizzaExtras.forEach((ex: string) => detalles.push(ex))
                  }
                } else {
                  if (item.ingredients && item.ingredients.length) {
                    detalles.push(...item.ingredients.map((i: string) => `+ ${i}`))
                  }
                  if (item.premiumIngredients && item.premiumIngredients.length) {
                    detalles.push(...item.premiumIngredients.map((i: string) => `+ ${i} (P)`))
                  }
                }

                if (item.sauces && item.sauces.length) {
                  detalles.push(...item.sauces)
                }
                if (item.drinks && item.drinks.length) {
                  detalles.push(...item.drinks)
                }
                if (item.extras && item.extras.length) {
                  detalles.push(...item.extras)
                }
                if (item.sinOregano) detalles.push('(sin oregano)')
                if (item.sinQueso) detalles.push('(sin queso)')
                if (item.sinSalsaTomate) detalles.push('(sin salsa tomate)')
                
                if (item.comments) {
                  detalles.push(<br key="br1" />)
                  detalles.push(<strong key="note">Nota: {item.comments}</strong>)
                }

                return (
                  <div key={idx} className="comanda-item">
                    <div className="comanda-item-name">
                      {sizeLetter ? `${sizeLetter}: ` : ''}{item.cantidad || 1}x {displayName}
                    </div>
                    {detalles.map((detalle, detailIdx) => (
                      <div key={detailIdx} className="comanda-item-detail">
                        {detalle}
                      </div>
                    ))}
                  </div>
                )
              })}

              {notaEspecial && (
                <div className="comanda-item" style={{ marginTop: '6px' }}>
                  <div className="comanda-item-detail">
                    <strong>Nota: {notaEspecial}</strong>
                  </div>
                </div>
              )}
            </div>

            <div className="comanda-divider"></div>

            <div className="comanda-totals">
              <div className="comanda-total-row">
                SUBTOTAL: {formatCurrency(subtotal)}
              </div>
              {valorDelivery > 0 && (
                <div className="comanda-total-row">
                  DELIVERY: {formatCurrency(valorDelivery)}
                </div>
              )}
              {descuentos > 0 && (
                <div className="comanda-total-row">
                  DESCUENTO {discountCode ? `(${discountCode})` : voucherCode ? `(${voucherCode})` : '(PROMO)'}: -{formatCurrency(descuentos)}
                </div>
              )}
              <div className="comanda-total-row comanda-total-strong" style={{ marginTop: "4px" }}>
                TOTAL: {formatCurrency(totalConDelivery)}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-center mt-4">
          <Button 
            onClick={confirmarImpresion}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold"
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Imprimir Comanda
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

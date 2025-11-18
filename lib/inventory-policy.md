// NOTA IMPORTANTE SOBRE EL CONSUMO DE INVENTARIO EN PEDIDOS
//
// El flujo de trabajo del inventario es el siguiente:
//
// 1. Cuando un cliente crea un pedido, el pedido se crea con estado "Pendiente" y NO consume inventario.
//    El pedido se marca con inventoryProcessed = false e inventoryStatus = 'pending'.
//
// 2. Cuando un administrador confirma el pedido cambiando su estado a "En preparación":
//    - El sistema consume automáticamente el inventario basado en los items del pedido.
//    - El pedido se marca con inventoryProcessed = true e inventoryStatus = 'processed'.
//
// 3. Si un administrador cancela un pedido ANTES de confirmarlo (estado "Pendiente"):
//    - No hay consumo de inventario que revertir, ya que nunca se procesó.
//    - El pedido se marca con inventoryStatus = 'cancelled_before_processing'.
//
// 4. Si un administrador cancela un pedido DESPUÉS de confirmarlo:
//    - NO se revierte el consumo de inventario porque los insumos ya se utilizaron para preparar la comida.
//    - El pedido mantiene inventoryProcessed = true y se agrega una nota explicativa.
//
// Este comportamiento garantiza que:
// - Solo se consuma inventario cuando realmente se está preparando el pedido.
// - No se "recuperen" insumos que ya fueron utilizados en la preparación si se cancela posteriormente.
//
// Cualquier modificación a este flujo debe considerar cuidadosamente los impactos en la gestión de inventario.
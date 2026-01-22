# 🧪 PLAN DE TESTING - OPTIMIZACIONES P0 Y P1
**Fecha:** 21 de Enero de 2026  
**Objetivo:** Validar todas las mejoras implementadas sin romper funcionalidades existentes

---

## 📋 RESUMEN DE CAMBIOS A TESTEAR

### P0 - Cambios Críticos
- ✅ Credenciales movidas a variables de entorno
- ✅ Transacciones atómicas en creación de pedidos
- ✅ Transacciones atómicas en confirmación de pagos
- ✅ Limpieza automática de pedidos huérfanos (cada 10 minutos)

### P1 - Optimizaciones de Performance
- ✅ Batch reads optimizados (ya existente)
- ✅ Paginación en panel admin (100 pedidos límite)
- ✅ React Query para caching (5 minutos)
- ✅ Retry logic en pagos (3 intentos con backoff)

---

## 🧪 TEST SUITE

### TEST 1: Variables de Entorno (P0.1-P0.3)
**Objetivo:** Verificar que la app funciona con credenciales desde .env.local

**Pasos:**
1. Abrir la aplicación en el navegador
2. Verificar que carga correctamente (no errores de Firebase)
3. Intentar iniciar sesión con usuario existente
4. Verificar que autenticación funciona

**Resultado Esperado:**
- ✅ App carga sin errores
- ✅ Firebase se conecta correctamente
- ✅ Login funciona normalmente

**Estado:** ⏳ PENDIENTE

---

### TEST 2: Transacciones Atómicas - Creación de Pedido (P0.4)
**Objetivo:** Verificar que pedido + consumo de inventario es atómico

**Pasos:**
1. Verificar stock actual de algún ingrediente en Firestore (ej: "Mozzarella" = 50 unidades)
2. Crear un pedido que consuma ese ingrediente (ej: Pizza Margherita)
3. Verificar en Firestore que:
   - ✅ Pedido se creó en colección `pedidos`
   - ✅ Stock de "Mozzarella" se redujo (ej: ahora 49 unidades)
   - ✅ Todo ocurrió en la misma timestamp (atómico)

**Caso de error (para validar rollback):**
1. Modificar temporalmente el stock de un ingrediente a 0
2. Intentar crear pedido que lo requiera
3. Verificar que:
   - ❌ Pedido NO se creó
   - ✅ Stock permanece en 0 (no hubo cambios)
   - ✅ Error devuelto al usuario

**Resultado Esperado:**
- ✅ Pedido exitoso → Stock consumido
- ✅ Pedido fallido → Stock intacto (rollback automático)
- ✅ No hay estados inconsistentes

**Estado:** ⏳ PENDIENTE

---

### TEST 3: Transacciones Atómicas - Confirmación de Pago (P0.4)
**Objetivo:** Verificar que pago + consumo de inventario es atómico

**Pasos:**
1. Crear pedido con Webpay (queda en "Pago Pendiente")
2. Verificar stock NO se ha consumido todavía
3. Completar flujo de Webpay en sandbox
4. En el callback, verificar:
   - ✅ Pedido pasa a "Pendiente"
   - ✅ Stock se consumió atómicamente
   - ✅ Campo `paymentStatus` actualizado

**Resultado Esperado:**
- ✅ Stock se consume SOLO después de pago confirmado
- ✅ Si falla el pago, stock NO se consume
- ✅ Transacción es atómica

**Estado:** ⏳ PENDIENTE

---

### TEST 4: Limpieza Automática de Pedidos (P0.5)
**Objetivo:** Verificar que pedidos huérfanos se cancelan automáticamente

**Setup:**
1. Crear un pedido de prueba con Webpay pero NO completar el pago
2. El pedido queda en "Pago Pendiente"
3. Esperar 30 minutos

**Verificación (después de 30-40 minutos):**
1. Ir a Firebase Console → Cloud Scheduler
2. Verificar que `cleanupAbandonedOrders` se ejecutó
3. Ver logs en Cloud Functions:
   ```
   Functions > cleanupAbandonedOrders > Logs
   ```
4. Buscar el pedido de prueba en Firestore
5. Verificar que:
   - ✅ Estado cambió a "Cancelado"
   - ✅ Campo `cancelReason` = "Pago no completado en 30 minutos"

**Resultado Esperado:**
- ✅ Función se ejecuta cada 10 minutos
- ✅ Pedidos > 30 minutos en "Pago Pendiente" se cancelan
- ✅ Logs muestran pedidos procesados

**Estado:** ⏳ PENDIENTE (requiere esperar 30 minutos)

---

### TEST 5: Paginación en Panel Admin (P1.2)
**Objetivo:** Verificar que solo se cargan 100 pedidos en vez de todos

**Setup previo:**
- Tener al menos 100+ pedidos en la base de datos
- Si no tienes suficientes, crear algunos de prueba

**Pasos:**
1. Abrir Firebase Console → Firestore → Usage
2. Anotar contador de lecturas actual
3. Iniciar sesión como admin en la app
4. Ir al panel de pedidos (`/admin/pedidos`)
5. Verificar que la página carga
6. Volver a Firebase Console → Usage
7. Calcular cuántas lecturas se hicieron

**Cálculo esperado:**
```
ANTES: 1000 pedidos → 1000 lecturas
DESPUÉS: 1000 pedidos → 100 lecturas (límite)
```

**Resultado Esperado:**
- ✅ Solo ~100 lecturas en Firestore (no todas)
- ✅ Panel carga en < 2 segundos
- ✅ Pedidos visibles son los más recientes

**Estado:** ⏳ PENDIENTE

---

### TEST 6: React Query Caching (P1.3)
**Objetivo:** Verificar que menú se cachea y no hace re-fetch innecesario

**Pasos:**
1. Abrir la app en el navegador
2. Abrir DevTools → Network → Filtrar "firestore"
3. Ir a la página del menú (`/menu`)
4. Observar llamadas a Firestore (debería haber varias)
5. Navegar a otra página (ej: `/perfil`)
6. Volver a `/menu`
7. Observar DevTools:
   - ✅ NO debería haber nuevas llamadas a Firestore
   - ✅ Datos se cargan desde cache (instantáneo)

**Verificación adicional:**
1. Esperar 5 minutos (staleTime)
2. Recargar la página `/menu`
3. Ahora SÍ debería hacer una nueva llamada a Firestore (cache expiró)

**Resultado Esperado:**
- ✅ Primera carga: Llama a Firestore
- ✅ Cargas subsecuentes (< 5 min): Desde cache
- ✅ Después de 5 min: Re-fetch automático

**Estado:** ⏳ PENDIENTE (requiere integrar hooks en componentes primero)

---

### TEST 7: Retry Logic en Pagos (P1.4)
**Objetivo:** Verificar que pagos se reintentan automáticamente ante fallos

**Setup (simulación de fallo):**
Este test es más difícil sin herramientas, pero podemos verificar el código:

**Pasos de verificación en logs:**
1. Crear un pedido con Webpay
2. Completar el pago en sandbox
3. Ir a Cloud Functions logs:
   ```
   Functions > confirmWebpayTransaction > Logs
   ```
4. Verificar que NO hay reintentos (porque el pago fue exitoso)

**Verificación en código:**
- ✅ Función `retryWithBackoff` implementada
- ✅ `confirmWebpayTransaction` usa retry con 3 intentos
- ✅ Exponential backoff: 1s → 2s → 4s
- ✅ Logs detallados de cada reintento

**Simulación manual (opcional):**
1. Desconectar internet temporalmente
2. Intentar completar pago
3. Reconectar después de 2 segundos
4. Verificar que el segundo intento fue exitoso

**Resultado Esperado:**
- ✅ Pagos exitosos no necesitan retry (1 intento)
- ✅ Pagos con fallo transitorio se reintentan automáticamente
- ✅ Logs muestran cada reintento

**Estado:** ⏳ PENDIENTE

---

### TEST 8: Integración Completa (E2E)
**Objetivo:** Verificar flujo completo de usuario

**Flujo:**
1. Usuario visita la app
2. Navega por el menú (cache activo)
3. Agrega pizzas al carrito
4. Procede al checkout
5. Selecciona método de pago Webpay
6. Completa el pago en sandbox
7. Vuelve a la app
8. Verifica confirmación de pedido

**Verificaciones en cada paso:**
- ✅ Menú carga desde cache (no loading)
- ✅ Carrito funciona normalmente
- ✅ Pedido se crea en "Pago Pendiente"
- ✅ Redirección a Webpay funciona
- ✅ Confirmación de pago es atómica
- ✅ Pedido pasa a "Pendiente"
- ✅ Stock se consume correctamente
- ✅ Email de confirmación (si está configurado)

**Resultado Esperado:**
- ✅ Flujo completo funciona sin errores
- ✅ Performance mejorada (cargas más rápidas)
- ✅ Todas las optimizaciones activas

**Estado:** ⏳ PENDIENTE

---

## 📊 CHECKLIST DE TESTING

### P0 - Crítico
- [ ] TEST 1: Variables de entorno funcionando
- [ ] TEST 2: Transacciones atómicas en creación de pedido
- [ ] TEST 3: Transacciones atómicas en pago
- [ ] TEST 4: Limpieza automática (esperar 30 min)

### P1 - Optimizaciones
- [ ] TEST 5: Paginación reduciendo lecturas
- [ ] TEST 6: Cache de React Query activo
- [ ] TEST 7: Retry logic (verificar logs)
- [ ] TEST 8: Flujo E2E completo

---

## 🐛 REGISTRO DE BUGS ENCONTRADOS

### Bug #1
**Descripción:**  
**Severidad:**  
**Pasos para reproducir:**  
**Solución:**  

---

## 📈 MÉTRICAS POST-TESTING

### Lecturas de Firestore (antes vs después)
- **Carga de menú:**
  - Antes: _____ lecturas
  - Después: _____ lecturas
  - Reducción: _____%

- **Panel admin:**
  - Antes: _____ lecturas
  - Después: _____ lecturas
  - Reducción: _____%

### Performance
- **Tiempo de carga inicial:**
  - Antes: _____ ms
  - Después: _____ ms
  - Mejora: _____%

- **Tiempo de navegación entre páginas:**
  - Antes: _____ ms
  - Después: _____ ms (cache)
  - Mejora: _____%

---

## ✅ APROBACIÓN FINAL

- [ ] Todos los tests P0 pasaron
- [ ] Todos los tests P1 pasaron
- [ ] No hay bugs críticos
- [ ] Performance mejoró según esperado
- [ ] Costos de Firestore reducidos

**Testeado por:** _______________  
**Fecha:** _______________  
**Aprobado:** SÍ / NO  

---

**Próximo paso:** Si todos los tests pasan, proceder con P2 (optimizaciones de menor prioridad) o monitorear en producción por 1 semana.

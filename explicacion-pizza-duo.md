# 📊 Explicación del Sistema de Pizza Dúo

## 🎯 Comportamiento Esperado

### Concepto
Una **Pizza Dúo** permite elegir dos variedades distintas para una sola pizza:
- **50%** de los ingredientes de la Variedad A
- **50%** de los ingredientes de la Variedad B

---

## ✅ Lógica Implementada (CORRECTA)

### Archivo: `lib/inventory-service.ts`

#### 1. Detección de Pizza Dúo (línea 786)
```typescript
const isDuoPizza = item.pizzaType === 'duo' && item.pizza1 && item.pizza2;
```

#### 2. División de Recetas al 50% (líneas 932-952 y 977-997)

**Para Pizza 1:**
```typescript
recipe1 = receta1.map((r: any) => {
  const originalCantidad = Number(r.cantidad) || 0;
  const halfCantidad = Math.round((originalCantidad / 2) * 100) / 100;
  
  return {
    ingredienteId: r.ingredienteId,
    cantidad: halfCantidad, // MITAD de ingredientes
    unidad: r.unidad
  };
});
```

**Para Pizza 2:**
```typescript
recipe2 = receta2.map((r: any) => {
  const originalCantidad = Number(r.cantidad) || 0;
  const halfCantidad = Math.round((originalCantidad / 2) * 100) / 100;
  
  return {
    ingredienteId: r.ingredienteId,
    cantidad: halfCantidad, // MITAD de ingredientes
    unidad: r.unidad
  };
});
```

#### 3. Combinación de Recetas (línea 1009)

```typescript
recipe = combineRecipes(recipe1, recipe2);
```

La función `combineRecipes` (líneas 103-227):

**Para ingredientes COMUNES (en ambas pizzas):**
```typescript
if (item.isCommon) {
  // Sumar cantidades (ambas ya están divididas por 2)
  const total = (item.cantidad1 || 0) + (item.cantidad2 || 0);
  finalAmount = total;
}
```

**Para ingredientes ÚNICOS (solo en una pizza):**
```typescript
else if (item.cantidad1 !== undefined) {
  // Solo en pizza 1: mantener el 50%
  finalAmount = item.cantidad1;
} else if (item.cantidad2 !== undefined) {
  // Solo en pizza 2: mantener el 50%
  finalAmount = item.cantidad2;
}
```

#### 4. Consumo Atómico
Todo ocurre dentro de `runTransaction` de Firestore (línea 774):
```typescript
await runTransaction(db, async (transaction) => {
  // Todas las lecturas y escrituras aquí
  // Si falla cualquier parte, se revierte TODO
});
```

---

## 📖 Ejemplo: Pizza Dúo Bariloche / Napolitana (Familiar)

### Ingredientes de Ejemplo

#### Pizza Bariloche (receta completa)
- Masa: 400g
- Salsa: 150g
- Queso: 300g
- Jamón: 200g
- Champiñones: 150g

#### Pizza Napolitana (receta completa)
- Masa: 400g
- Salsa: 150g
- Queso: 300g
- Tomate: 200g
- Albahaca: 50g

### Ingredientes Comunes
- **Masa**: En ambas pizzas
- **Salsa**: En ambas pizzas
- **Queso**: En ambas pizzas

### Ingredientes Únicos
- **Jamón**: Solo en Bariloche
- **Champiñones**: Solo en Bariloche
- **Tomate**: Solo en Napolitana
- **Albahaca**: Solo en Napolitana

---

## 🧮 Cálculo del Descuento

### Para Ingredientes COMUNES:

**Masa:**
- Bariloche completa: 400g → Mitad: **200g**
- Napolitana completa: 400g → Mitad: **200g**
- **Total a descontar: 200g + 200g = 400g** ✅

**Salsa:**
- Bariloche completa: 150g → Mitad: **75g**
- Napolitana completa: 150g → Mitad: **75g**
- **Total a descontar: 75g + 75g = 150g** ✅

**Queso:**
- Bariloche completa: 300g → Mitad: **150g**
- Napolitana completa: 300g → Mitad: **150g**
- **Total a descontar: 150g + 150g = 300g** ✅

### Para Ingredientes ÚNICOS:

**Jamón (solo en Bariloche):**
- Bariloche completa: 200g → Mitad: **100g**
- **Total a descontar: 100g** ✅

**Champiñones (solo en Bariloche):**
- Bariloche completa: 150g → Mitad: **75g**
- **Total a descontar: 75g** ✅

**Tomate (solo en Napolitana):**
- Napolitana completa: 200g → Mitad: **100g**
- **Total a descontar: 100g** ✅

**Albahaca (solo en Napolitana):**
- Napolitana completa: 50g → Mitad: **25g**
- **Total a descontar: 25g** ✅

---

## ✅ Resumen de Descuento Total

| Ingrediente | Tipo | Cantidad a Descontar | Lógica |
|------------|------|---------------------|---------|
| Masa | Común | 400g | 200g (Bariloche) + 200g (Napolitana) |
| Salsa | Común | 150g | 75g + 75g |
| Queso | Común | 300g | 150g + 150g |
| Jamón | Único | 100g | 50% de Bariloche |
| Champiñones | Único | 75g | 50% de Bariloche |
| Tomate | Único | 100g | 50% de Napolitana |
| Albahaca | Único | 25g | 50% de Napolitana |

---

## 🔍 Verificación del Sistema

### El sistema está CORRECTO si:

✅ **Ingredientes comunes**: Se descuenta la suma de las mitades (100% en total si ambas pizzas usan la misma cantidad)

✅ **Ingredientes únicos**: Se descuenta SOLO el 50% de la pizza que lo contiene

❌ **ERROR si**: 
- Se descuenta el 100% solo de una pizza
- Se descuenta el 100% de ambas pizzas (200%)
- No se descuenta la segunda variedad

---

## 🧪 Cómo Probar

### Método 1: Revisar Logs de Consola
Cuando proceses un pedido Pizza Dúo, busca en los logs:

```
Procesando Pizza Duo: ... (Bariloche / Napolitana)
Pizza 1 (Bariloche): Usando receta FAMILIAR con X ingredientes
Preparada mitad de receta para Bariloche con X ingredientes
Pizza 2 (Napolitana): Usando receta FAMILIAR con X ingredientes
Preparada mitad de receta para Napolitana con X ingredientes
Pizza Duo: Combinando recetas de ambas mitades - Total X ingredientes únicos
```

### Método 2: Verificar Stock en Firebase
1. Anota el stock ANTES del pedido
2. Realiza un pedido Pizza Dúo
3. Verifica el stock DESPUÉS
4. Calcula la diferencia manualmente

### Método 3: Revisar Transacción en `inventory_transactions`
Cada pedido crea un documento en `inventory_transactions` con detalles de qué se consumió.

---

## 🚨 Posibles Causas de Error (si ocurre)

1. **Nombres de pizzas incorrectos**: El frontend envía nombres que no coinciden con la BD
2. **Recetas no encontradas**: Alguna pizza no tiene receta definida
3. **Código antiguo en caché**: El navegador está usando código viejo
4. **Pedidos antiguos**: Creados antes de implementar esta lógica

---

## 💡 Conclusión

**El código actual YA IMPLEMENTA correctamente la lógica de Pizza Dúo:**
- ✅ Detecta pizzas dúo
- ✅ Divide ambas recetas al 50%
- ✅ Combina correctamente (suma comunes, mantiene únicos)
- ✅ Descuenta en transacción atómica

Si experimentas problemas, probablemente sean por:
- Datos de pedidos antiguos
- Nombres de pizzas que no coinciden
- Caché del navegador

**Solución recomendada:**
1. Limpiar caché del navegador
2. Verificar nombres exactos de pizzas en Firestore
3. Probar con un pedido nuevo
4. Revisar logs de consola durante el procesamiento

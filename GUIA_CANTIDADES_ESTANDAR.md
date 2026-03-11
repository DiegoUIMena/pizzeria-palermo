# Guía: Cantidades Estándar para Pizzas Armadas Manualmente

## 📋 Problema Resuelto

Cuando los clientes arman sus propias pizzas, el sistema ahora puede calcular correctamente cuánto inventario consumir de cada ingrediente.

## 🎯 Solución Implementada

### 1. **Nuevos Campos en la Base de Datos**

Cada ingrediente ahora puede tener:
- `cantidadPorPizzaMediana`: Cantidad (en gramos u otra unidad) que se consume por pizza mediana
- `cantidadPorPizzaFamiliar`: Cantidad (en gramos u otra unidad) que se consume por pizza familiar

### 2. **Lógica Inteligente de Consumo**

El sistema maneja automáticamente **tres casos diferentes**:

#### A) **Pizza Armada desde Cero** (sin receta base)
- Cliente selecciona ingredientes uno por uno
- Sistema detecta tamaño de pizza y usa cantidades estándar configuradas
- Multiplica por el número de veces que el cliente agregó cada ingrediente

#### B) **Pizza del Menú con Receta** (sin extras)
- Cliente elige una pizza predefinida (ej: Napolitana)
- Sistema usa la receta completa de esa pizza
- Descuenta exactamente lo que indica la receta

#### C) **Pizza del Menú CON Extras** (receta + ingredientes adicionales) ⭐ NUEVO
- Cliente elige pizza predefinida Y agrega ingredientes extra
- Sistema descuenta AMBOS:
  1. La receta base completa de la pizza
  2. Los ingredientes extras usando cantidades estándar
- **Ejemplo**: Napolitana mediana + Extra Queso (2):
  - Descuenta receta completa de Napolitana mediana
  - ADEMÁS descuenta: 150g × 2 = 300g de queso extra

**Ejemplo completo del Caso C:**
```
Cliente: Napolitana Familiar + Extra Queso (2) + Champiñones (1)
Sistema descuenta:
  ✓ Receta Napolitana familiar completa (mozzarella, tomate, albahaca, etc.)
  ✓ + 250g × 2 = 500g de queso extra
  ✓ + 80g × 1 = 80g de champiñones extra
```

### 3. **Interfaz Administrativa**

Nueva página en Admin: **"Config. Cantidades"**
- Muestra todos los ingredientes en una tabla
- Permite configurar cantidades para pizza mediana y familiar
- Botón "Auto" que sugiere cantidades basadas en la categoría del ingrediente
- Indicador visual de ingredientes configurados vs pendientes

## 🚀 Cómo Usar

### Paso 1: Configurar Cantidades Estándar

1. Ir a **Admin** → **Config. Cantidades**
2. Para cada ingrediente importante:
   - Escribir la cantidad para pizza mediana (ej: 150 para queso)
   - Escribir la cantidad para pizza familiar (ej: 250 para queso)
   - O usar el botón **"Auto"** para aplicar cantidades sugeridas
3. Hacer clic en **"Guardar Cambios"**

### Paso 2: Cantidades Sugeridas por Categoría

Si usas el botón "Auto", el sistema sugiere automáticamente:

| Categoría | Pizza Mediana | Pizza Familiar |
|-----------|---------------|----------------|
| **Quesos** | 150g | 250g |
| **Carnes** (jamón, pepperoni) | 80g | 120g |
| **Vegetales** | 40g | 60g |
| **Salsas** | 100g | 150g |
| **Especias** | 5-10g | 10-15g |

### Paso 3: Verificar Funcionamiento

1. Cliente hace un pedido de "Armar Pizza"
2. Selecciona tamaño (mediana o familiar)
3. Agrega ingredientes (ej: Extra Queso, Jamón, etc.)
4. Al confirmar el pedido, el sistema:
   - ✅ Calcula automáticamente las cantidades exactas
   - ✅ Descuenta del inventario correctamente
   - ✅ Registra la transacción

## 📊 Cantidades Recomendadas

### Ingredientes Comunes

```
Mozzarella / Queso
├── Mediana: 150g
└── Familiar: 250g

Salsa de Tomate
├── Mediana: 100g
└── Familiar: 150g

Jamón
├── Mediana: 80g
└── Familiar: 120g

Pepperoni
├── Mediana: 60g
└── Familiar: 100g

Champiñones
├── Mediana: 50g
└── Familiar: 80g

Aceitunas
├── Mediana: 30g
└── Familiar: 50g

Pimiento / Cebolla
├── Mediana: 40g
└── Familiar: 60g

Orégano
├── Mediana: 5g
└── Familiar: 10g
```

## 🔧 Cambios Técnicos Realizados

### 1. Actualización de `lib/inventory.ts`
- ✅ Agregados campos `cantidadPorPizzaMediana` y `cantidadPorPizzaFamiliar` a la interfaz `Ingrediente`
- ✅ Actualizada función `listenIngredientes` para cargar estos campos

### 2. Actualización de `lib/inventory-service.ts`
- ✅ Modificada función `buildRecipeLinesFromIngredients`:
  - Detecta tamaño de pizza (`item.size`)
  - Usa cantidades estándar cuando están disponibles
  - Multiplica por la cantidad seleccionada por el cliente
  - Fallback a cantidad 1 si no hay estándar configurado

### 3. Nueva Página `app/admin/configurar-cantidades/page.tsx`
- ✅ Interfaz para configurar cantidades
- ✅ Tabla con todos los ingredientes
- ✅ Botón "Auto" para sugerencias inteligentes
- ✅ Indicadores de estado (configurado/pendiente)
- ✅ Guardado por lote de múltiples cambios

### 4. Actualización de `app/admin/components/AdminHeader.tsx`
- ✅ Agregado enlace "Config. Cantidades" al menú de navegación

## ⚠️ Importante

### Ingredientes sin Configurar
Si un ingrediente **NO** tiene cantidades estándar configuradas:
- El sistema usará la cantidad `1` como fallback
- Se mostrará advertencia en los logs: `⚠️ sin cantidad estándar definida`
- **Recomendación**: Configurar todos los ingredientes usados en pizzas armadas

### Retrocompatibilidad
- ✅ Pizzas con recetas predefinidas (menú normal) funcionan igual que antes
- ✅ Solo afecta a pizzas armadas manualmente por el cliente
- ✅ Pedidos existentes no se ven afectados

## 🎓 Ejemplos de Uso

### Ejemplo 1: Pizza Familiar Armada desde Cero con 1 Extra Queso
```
Cliente selecciona:
- Tamaño: Familiar
- Modo: Armar desde cero
- Ingredientes: Extra Queso (1)

Sistema calcula:
- Queso configurado: 250g por pizza familiar
- Total: 250g × 1 = 250g
✅ Se descuentan 250g de queso del inventario
```

### Ejemplo 2: Pizza Mediana Armada con Doble Queso y Jamón
```
Cliente selecciona:
- Tamaño: Mediana
- Modo: Armar desde cero
- Ingredientes: Extra Queso (2), Jamón (1)

Sistema calcula:
- Queso: 150g × 2 = 300g
- Jamón: 80g × 1 = 80g
✅ Se descuentan 300g de queso y 80g de jamón
```

### Ejemplo 3: Pizza del Menú SIN Extras
```
Cliente selecciona:
- Pizza: Napolitana Mediana
- Extras: Ninguno

Sistema descuenta:
✅ Receta completa de Napolitana mediana (según recetaMediana definida)
```

### Ejemplo 4: Pizza del Menú CON Extras ⭐ IMPORTANTE
```
Cliente selecciona:
- Pizza: Napolitana Familiar
- Extras: Extra Queso (2), Champiñones (1)

Sistema descuenta:
✅ Receta completa de Napolitana familiar (mozzarella base, tomate, albahaca, etc.)
✅ + 250g × 2 = 500g de queso ADICIONAL
✅ + 80g × 1 = 80g de champiñones ADICIONALES

💡 Los extras se SUMAN a la receta base, no la reemplazan
```

### Ejemplo 5: Ingrediente Sin Configurar
```
Cliente selecciona:
- Tamaño: Familiar
- Ingrediente Nuevo (1) ← Sin cantidadPorPizzaFamiliar

Sistema usa fallback:
- Cantidad: 1 (sin unidad específica)
⚠️ Advertencia en logs
💡 Solución: Configurar en Admin → Config. Cantidades
```

## 📝 Pasos Siguientes

1. ✅ **Configurar todos los ingredientes**
   - Ir a Admin → Config. Cantidades
   - Revisar lista completa de ingredientes
   - Configurar cantidades o usar "Auto"

2. ✅ **Probar con pedido real**
   - Hacer pedido de "Armar Pizza"
   - Verificar descuento correcto en inventario
   - Revisar logs en consola del navegador

3. ✅ **Ajustar según necesidad**
   - Monitorear consumo real vs estimado
   - Ajustar cantidades si es necesario
   - Guardar cambios

## 🆘 Solución de Problemas

**Problema**: No se descuenta inventario en pizza armada
- ✅ Verificar que el ingrediente tenga configuradas las cantidades
- ✅ Ver Admin → Config. Cantidades
- ✅ Estado debe ser "✓ OK", no "Pendiente"

**Problema**: Se descuenta muy poco o demasiado
- ✅ Ajustar las cantidades en Config. Cantidades
- ✅ Basarse en el consumo real de la cocina
- ✅ Guardar cambios

**Problema**: Logs muestran "sin cantidad estándar"
- ✅ Normal para ingredientes nuevos
- ✅ Configurar en Admin → Config. Cantidades
- ✅ Sistema usará fallback hasta configurar

---

**Desarrollado para**: Pizzería Palermo  
**Fecha**: Marzo 2026  
**Versión**: 1.0

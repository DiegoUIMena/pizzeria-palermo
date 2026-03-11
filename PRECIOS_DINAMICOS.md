# Sistema de Precios Dinámicos desde Firebase

## ✅ Implementación Completada

Se ha migrado el sistema de precios de ingredientes desde constantes hardcoded en el frontend a una fuente única de verdad en Firebase.

## 🔄 Cambios Realizados

### 1. **Firebase - Configuración de Precios**
- **Colección**: `settings/precios_configuracion`
- **Estructura**:
```javascript
{
  pizzaSizes: {
    mediana: {
      id: "mediana",
      name: "Mediana",
      simpleBasePrice: 8000,
      premiumBasePrice: 8000,
      simpleExtraPrice: 700,      // ✅ Actualizado
      premiumExtraPrice: 2500,    // ✅ Actualizado
    },
    familiar: {
      id: "familiar",
      name: "Familiar",
      simpleBasePrice: 10000,
      premiumBasePrice: 10000,
      simpleExtraPrice: 1000,     // ✅ Actualizado
      premiumExtraPrice: 3500,    // ✅ Actualizado
    }
  },
  extras: { ... },
  lastUpdated: "2026-02-25T...",
  version: "1.0.0"
}
```

### 2. **Frontend - Hook useFirestorePizzaConfig**
- **Archivo**: `hooks/useFirestorePizzaConfig.ts`
- **Cambios**:
  - Agregado query para cargar `precios_configuracion`
  - Cache de 15 minutos con React Query
  - Fallback a valores por defecto si falla la carga
  - Export de interfaces `PizzaSizeConfig` y `PreciosConfiguracion`

### 3. **Frontend - PizzaConfigModal**
- **Archivo**: `app/components/PizzaConfigModal.tsx`
- **Cambios**:
  - Eliminada constante `pizzaSizes` hardcoded
  - Uso de `preciosConfig` desde hook
  - Conversión dinámica de objeto a array con `useMemo`

### 4. **Frontend - Cart**
- **Archivo**: `app/components/Cart.tsx`
- **Cambios**:
  - Agregado hook `useFirestorePizzaConfig`
  - Actualizada función `getIngredientPrices()` para usar precios dinámicos
  - Fallback a valores por defecto mientras se cargan precios

### 5. **Backend - Pricing Service**
- **Archivo**: `functions/src/services/pricing.service.ts`
- **Cambios**:
  - Nueva función `getPriceConfig()` con cache de 15 minutos
  - Cache en memoria para reducir lecturas de Firestore
  - Función `calculateItemPrice()` ahora es `async`
  - Fallback a valores por defecto si falla la carga

## 🔒 Seguridad Mejorada

### Antes ❌
```typescript
// Frontend (manipulable)
const pizzaSizes = [
  { simpleExtraPrice: 700 }  // Usuario puede cambiar esto en DevTools
]
```

### Ahora ✅
```typescript
// Frontend: Carga desde Firebase (solo para mostrar precios)
const { preciosConfig } = useFirestorePizzaConfig()

// Backend: Recalcula SIEMPRE desde Firebase (fuente de verdad)
const priceConfig = await getPriceConfig()  // Ignora precio del cliente
const total = priceConfig.total  // ✅ Sobrescribe con precio real
```

**Resultado**: Imposible manipular precios desde el navegador porque el backend siempre recalcula el total desde Firebase.

## 📊 Valores Actualizados

| Tamaño   | Extra Simple | Extra Premium |
|----------|--------------|---------------|
| Mediana  | $700         | $2,500        |
| Familiar | $1,000       | $3,500        |

**Precios base**:
- Simple Mediana: $8,000
- Simple Familiar: $10,000
- Premium Mediana: $8,000  
- Premium Familiar: $10,000

## 🛠️ Cómo Actualizar Precios

1. **Opción 1 - Firebase Console**:
   - Ir a Firebase Console → Firestore
   - Colección: `settings`
   - Documento: `precios_configuracion`
   - Editar valores directamente

2. **Opción 2 - Script** (volver a ejecutar):
   ```bash
   node poblar-precios-firebase.js
   ```

3. **Cache**: Los precios se actualizarán automáticamente:
   - Frontend: 15 minutos (React Query)
   - Backend: 15 minutos (en memoria)

## ✨ Beneficios

1. ✅ **Una sola fuente de verdad**: Precios centralizados en Firebase
2. ✅ **Seguridad**: Backend valida precios - imposible manipular
3. ✅ **Performance**: Cache de 15 minutos reduce lecturas de Firestore
4. ✅ **Mantenibilidad**: Un solo lugar para actualizar precios
5. ✅ **Sincronización**: Frontend y backend siempre usan mismos valores
6. ✅ **Fallback**: Sistema sigue funcionando si Firebase falla

## 📝 Notas Técnicas

- **Cache TTL**: 15 minutos (configurable)
- **Lecturas Firestore**: ~96 lecturas/día (vs ~2,880 sin cache)
- **Compatibilidad**: 100% backward compatible
- **TypeScript**: Totalmente tipado

---

**Fecha de implementación**: 25 de Febrero, 2026  
**Estado**: ✅ Activo en producción

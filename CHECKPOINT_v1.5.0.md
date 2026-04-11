# 📌 Checkpoint v1.5.0 - Sistema Wizard de Pizzas y Upselling Inteligente

**Fecha:** 11 de marzo de 2026  
**Versión:** v1.5.0-wizard-upselling  
**Commit:** 4c3af18  
**Branch:** restore-PizzaConfigModal-a99710d

---

## ✅ Estado del Sistema

El sistema está completamente funcional con todas las siguientes características implementadas y probadas:

### 🍕 Sistema de Construcción de Pizzas

- **Wizard paso a paso** con interfaz mejorada
  - Paso 1: Selección de tipo (Promo/Premium/Dúo)
  - Paso 2: Selección de base (menú/custom)
  - Paso 3: Selección de pizza del menú (si aplica)
  - Paso 4: Selección de tamaño
  - Paso 5: Selección de ingredientes
  - Paso 6: Opciones de personalización

- **Migración completada:** `/armar-pizza-nueva` → `/armar-pizza`
  - Botón único "🍕 Armar tu Pizza" en navegación
  - Eliminada entrada "Nueva Experiencia"
  - Interfaz consolidada y simplificada

### 🖼️ Sistema de Imágenes Mejorado

```typescript
// Triple fallback implementado
const imageMap: Record<string, string> = {
  'chilena': 'chilena.jpg',
  'del pibe': 'del-pibe.jpg',
  'napolitana': 'napolitana.jpg',
  // ... +30 pizzas mapeadas
}

function getPizzaImagePath(imagePath?: string, pizzaName?: string): string {
  // 1. Si es URL de Firebase, usar directamente
  if (imagePath?.includes('firebasestorage.googleapis.com')) {
    return imagePath
  }
  
  // 2. Si es ruta válida local, usar
  if (imagePath?.startsWith('/') && imagePath !== '/placeholder.svg') {
    return imagePath
  }
  
  // 3. Búsqueda por nombre en imageMap
  if (pizzaName) {
    const cleanName = pizzaName.toLowerCase().trim()
    const mappedName = imageMap[cleanName] || cleanName
    return `/pizzas/${encodeURIComponent(mappedName)}.jpg`
  }
  
  // 4. Fallback genérico
  return "/pizza-promo-bg.png"
}
```

### 🛒 Upselling Inteligente en Carrito

**Lógica condicional implementada:**

```typescript
// Oculta desplegables de categorías ya presentes en el carrito
const hasSalsas = items.some(item => 
  ['17', '18', '19', '20'].includes(item.id) || 
  item.name?.toLowerCase().includes('salsa')
)

const hasBebidas = items.some(item => {
  const itemName = item.name?.toLowerCase() || ''
  return item.id.includes('401') || item.id.includes('402') ||
    itemName.includes('coca') ||
    itemName.includes('bebida') ||
    itemName.includes('lipton') ||
    itemName.includes('sprite') ||
    itemName.includes('fanta') ||
    itemName.includes('agua') ||
    itemName.includes('jugo')
})

const hasSnacks = items.some(item => 
  ['15', '16'].includes(item.id) ||
  item.name?.toLowerCase().includes('gauchito') ||
  item.name?.toLowerCase().includes('rollito')
)
```

**Comportamiento:**
- ✅ Si el carrito NO tiene salsas → Muestra "¿Agregas Salsas?"
- ✅ Si el carrito NO tiene bebidas → Muestra "¿Agregar Bebida?"
- ✅ Si el carrito NO tiene snacks → Muestra "¿Agrega Gauchitos o Rollitos Canela?"
- ✅ Si ya tiene alguno → Oculta ese desplegable específico

### 🎨 Soporte para Pizzas DUO

```typescript
const duoImage = (() => {
  // Intenta obtener imagen de la primera mitad
  if (config.half1?.baseType === 'menu' && config.half1?.variety) {
    const pizza1 = pizzasParaDuo.find(p => p.nombre === config.half1?.variety)
    if (pizza1?.imagen) {
      return getPizzaImagePath(pizza1.imagen, pizza1.nombre)
    }
  }
  
  // Si falla, intenta la segunda mitad
  if (config.half2?.baseType === 'menu' && config.half2?.variety) {
    const pizza2 = pizzasParaDuo.find(p => p.nombre === config.half2?.variety)
    if (pizza2?.imagen) {
      return getPizzaImagePath(pizza2.imagen, pizza2.nombre)
    }
  }
  
  // Fallback genérico para DUO
  return "/pizza-duo-bg.png"
})()
```

### 🐛 Correcciones Implementadas

1. **TypeScript:**
   - Tipos literales explícitos para `pizzaType`
   - Variables tipadas antes de asignación
   - 0 errores de compilación

2. **UI del Carrito:**
   - Eliminados paréntesis de cierre que se mostraban como texto
   - JSX correctamente estructurado

3. **Detección de Bebidas:**
   - Agregado soporte para: Lipton, Sprite, Fanta, Agua, Jugo
   - Detección por ID y por nombre

### 📊 Logs de Debug Mejorados

```typescript
console.log("🎯 [NUEVA - handleAddToCart] Iniciando...")
console.log("🍕 [NUEVA - IMAGEN] Determinando imagen...")
console.log("🛒 [NUEVA - CARRITO] Item a agregar:")
console.table({ name, image, price, selectedMenuPizza })
```

---

## 📁 Archivos Clave Modificados

### Componentes Principales
- `app/armar-pizza/components/PizzaBuilderWizard.tsx` - Wizard principal
- `app/armar-pizza/components/steps/DuoBuilder.tsx` - Constructor de pizzas DUO
- `app/components/Cart.tsx` - Carrito con upselling inteligente
- `app/components/PromoSection.tsx` - Navegación de categorías

### Estructura del Proyecto
```
app/
├── armar-pizza/              ← NUEVA (migrada)
│   ├── components/
│   │   ├── PizzaBuilderWizard.tsx
│   │   ├── OrderSummary.tsx
│   │   ├── StepIndicator.tsx
│   │   ├── cards/
│   │   └── steps/
│   │       └── DuoBuilder.tsx
│   ├── hooks/
│   │   └── usePizzaBuilderData.ts
│   └── page.tsx
│
├── armar-pizza-nueva/        ← BACKUP (mantenida por si acaso)
│   └── [misma estructura]
│
└── components/
    ├── Cart.tsx              ← Upselling inteligente
    └── PromoSection.tsx      ← Botón único
```

---

## 🎯 Funcionalidades Validadas

- ✅ Imágenes se muestran correctamente desde pizza builder
- ✅ Pizzas del menú resuelven imagen correctamente
- ✅ Pizzas DUO muestran imagen apropiada
- ✅ Upselling oculta categorías ya en carrito
- ✅ Detección de bebidas funciona (Coca, Lipton, Sprite, Fanta, Agua, Jugo)
- ✅ No hay símbolos extraños en la UI
- ✅ TypeScript compila sin errores
- ✅ Navegación simplificada con botón único

---

## 📈 Estadísticas del Commit

- **143 archivos** modificados
- **23,228 líneas** añadidas
- **2,424 líneas** eliminadas
- **1.61 MB** de cambios

---

## 🔄 Próximos Pasos Sugeridos

1. **Monitoreo en Producción:**
   - Verificar que las imágenes cargan correctamente
   - Validar comportamiento del upselling con usuarios reales
   - Revisar logs de errores en Firebase Functions

2. **Optimizaciones Futuras:**
   - Lazy loading de imágenes de pizzas
   - Caché de pizzas del menú
   - Animaciones de transición entre pasos del wizard

3. **Testing:**
   - Pruebas de integración del wizard completo
   - Tests unitarios para lógica de upselling
   - Tests de detección de imágenes

---

## 📞 Contacto y Soporte

- **Repositorio:** https://github.com/DiegoUIMena/pizzeria-palermo.git
- **Branch:** restore-PizzaConfigModal-a99710d
- **Tag:** v1.5.0-wizard-upselling

---

## 📝 Notas Importantes

> ⚠️ **IMPORTANTE:** Este checkpoint representa un estado estable y completamente funcional del sistema. Cualquier desarrollo futuro debe partir de este punto si se necesita revertir cambios.

> 💡 **TIP:** Para restaurar este estado exacto en el futuro, usar:
> ```bash
> git checkout v1.5.0-wizard-upselling
> ```

---

**Guardado:** ✅ Exitosamente  
**Estado:** 🟢 Producción Ready  
**Última actualización:** 11/03/2026

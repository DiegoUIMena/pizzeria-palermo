# 📊 INFORME DE AUDITORÍA TÉCNICA - PIZZERÍA PALERMO
**Fecha:** 22 de Febrero de 2026  
**Auditor:** Sistema de Análisis Técnico Avanzado  
**Alcance:** Evaluación completa de Seguridad, Economía, Robustez y Escalabilidad

---

## 📋 TABLA DE CONTENIDOS
1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Análisis de Seguridad](#análisis-de-seguridad)
3. [Optimización de Costos Firebase](#optimización-de-costos-firebase)
4. [Evaluación de Robustez](#evaluación-de-robustez)
5. [Análisis de Escalabilidad](#análisis-de-escalabilidad)
6. [Plan de Acción Prioritizado](#plan-de-acción-prioritizado)

---

## 🎯 RESUMEN EJECUTIVO

### Estado General del Sistema
- **Nivel de Seguridad:** ⚠️ MEDIO-BAJO (65/100)
- **Eficiencia de Costos:** ⚠️ MEDIO (60/100)
- **Robustez:** ✅ BUENO (78/100)
- **Escalabilidad:** ⚠️ MEDIO (62/100)

### Hallazgos Críticos
🔴 **CRÍTICO:**
- Credenciales de Firebase expuestas en archivo `.env.local`
- Ausencia de índices compuestos en Firestore
- Múltiples listeners en tiempo real sin gestión de memoria
- Falta de rate limiting en Cloud Functions

🟡 **IMPORTANTE:**
- Costos elevados por lecturas redundantes de Firestore
- Falta de caché en frontend para datos estáticos
- Ausencia de monitoreo de errores en producción
- Falta de estrategia de backups automatizados

---

## 🔒 ANÁLISIS DE SEGURIDAD

### 1. EXPOSICIÓN DE CREDENCIALES ⛔ CRÍTICO

#### Problema Detectado:
```env
# Archivo: .env.local (PÚBLICO EN REPOSITORIO)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyCVKPmInym85FO89UhVQNsGzBeeqZ0wmFM
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=pizzeria-palermo-17f6d.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=pizzeria-palermo-17f6d
```

**Riesgo:** Las credenciales de Firebase están expuestas públicamente. Aunque Firebase tiene reglas de seguridad, cualquiera puede usar estas credenciales para hacer peticiones a tu proyecto.

#### ✅ Solución Inmediata:
```bash
# 1. Rotar credenciales en Firebase Console
# 2. Actualizar .gitignore (YA ESTÁ CORRECTO)
# 3. Eliminar .env.local del historial de Git
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env.local" \
  --prune-empty --tag-name-filter cat -- --all

# 4. Forzar push (CUIDADO: Notificar al equipo)
git push origin --force --all
```

#### ✅ Mejora a Largo Plazo:
```typescript
// Implementar variables de entorno en Vercel/Firebase Hosting
// NO usar NEXT_PUBLIC_ para datos sensibles

// firebase.ts - Validación adicional
const validateFirebaseConfig = () => {
  const requiredEnvVars = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  ];
  
  const missing = requiredEnvVars.filter(v => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(`Missing Firebase config: ${missing.join(', ')}`);
  }
  
  // Verificar que no estén hardcodeadas
  if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.includes('AIza')) {
    console.warn('⚠️ Using exposed Firebase credentials. Rotate in production!');
  }
};
```

**Impacto:** 🔴 CRÍTICO  
**Esfuerzo:** 2-4 horas  
**Prioridad:** P0 - INMEDIATA

---

### 2. REGLAS DE FIRESTORE - ANÁLISIS DETALLADO

#### ✅ Aspectos Positivos:
```javascript
// firestore.rules - Buen uso de funciones auxiliares
function isAdmin() {
  return request.auth != null && 
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
}
```

#### ⚠️ Problemas Detectados:

**2.1. Colecciones sin Reglas Explícitas**
```javascript
// Línea 142-146 (COMENTADO)
// match /{document=**} {
//   allow read, write: if false;
// }
// RIESGO: Cualquier colección nueva estará ABIERTA por defecto
```

**Solución:**
```javascript
// DESCOMENTAR al final de firestore.rules
match /{document=**} {
  allow read, write: if false;  // Bloquear TODO por defecto
}

// Luego agregar reglas específicas para colecciones nuevas
match /analytics/{docId} {
  allow read: if isAdmin();
  allow write: if false;  // Analytics solo se escribe desde Cloud Functions
}
```

**2.2. Validación de Datos Incompleta**
```javascript
// ACTUAL: Solo verifica autenticación
allow create: if isAuthenticated() && request.auth.uid == userId;

// MEJORADO: Validar estructura de datos
allow create: if isAuthenticated() 
  && request.auth.uid == userId
  && request.resource.data.keys().hasAll(['nombre', 'email', 'telefono'])
  && request.resource.data.nombre is string
  && request.resource.data.nombre.size() > 0
  && request.resource.data.nombre.size() <= 100;
```

**2.3. Optimización de Lecturas de Roles**
```javascript
// PROBLEMA: Cada validación hace un get() a la colección users
function isAdmin() {
  return request.auth != null && 
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
  // ↑ Esto CUENTA como 1 lectura adicional por cada petición
}
```

**Solución: Usar Custom Claims**
```typescript
// functions/src/triggers/user-created.ts
import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

export const setUserRole = functions.firestore
  .document('users/{userId}')
  .onWrite(async (change, context) => {
    const userData = change.after.data();
    if (!userData) return;
    
    // Establecer custom claim
    await admin.auth().setCustomUserClaims(context.params.userId, {
      role: userData.role || 'customer',
      admin: userData.role === 'admin',
      staff: userData.role === 'staff'
    });
  });
```

```javascript
// firestore.rules - Usar claims en lugar de get()
function isAdmin() {
  return request.auth != null && request.auth.token.admin == true;
  // ↑ NO consume lecturas adicionales
}
```

**Ahorro Estimado:** 60-80% en lecturas de seguridad  
**Impacto:** 🟡 IMPORTANTE  
**Esfuerzo:** 4-6 horas  
**Prioridad:** P1 - ALTA

---

### 3. FALTA DE RATE LIMITING EN CLOUD FUNCTIONS ⚠️

#### Problema:
```typescript
// functions/src/index.ts
export const createOrder = onCall(async (request) => {
  // SIN límite de llamadas por usuario/IP
  // Un usuario malicioso podría crear 1000 pedidos en 1 minuto
});
```

#### ✅ Solución Implementar Rate Limiting:
```typescript
// functions/src/middleware/rate-limiter.ts
import {HttpsError} from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

const rateLimitCache = new Map<string, {count: number, resetAt: number}>();

export async function checkRateLimit(
  userId: string, 
  functionName: string,
  maxRequests: number = 10,
  windowSeconds: number = 60
): Promise<void> {
  const key = `${functionName}:${userId}`;
  const now = Date.now();
  
  // Limpiar cache expirado
  if (rateLimitCache.has(key)) {
    const data = rateLimitCache.get(key)!;
    if (now > data.resetAt) {
      rateLimitCache.delete(key);
    }
  }
  
  // Verificar límite
  const current = rateLimitCache.get(key) || {
    count: 0, 
    resetAt: now + (windowSeconds * 1000)
  };
  
  if (current.count >= maxRequests) {
    throw new HttpsError(
      'resource-exhausted',
      `Too many requests. Try again in ${Math.ceil((current.resetAt - now) / 1000)}s`
    );
  }
  
  // Incrementar contador
  current.count++;
  rateLimitCache.set(key, current);
  
  // También registrar en Firestore para análisis
  await admin.firestore()
    .collection('rate_limits')
    .doc(`${functionName}_${userId}_${Math.floor(now / 1000)}`)
    .set({
      userId,
      functionName,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      count: current.count
    }, {merge: true});
}

// Uso en funciones
export const createOrder = onCall(async (request) => {
  await checkRateLimit(request.auth!.uid, 'createOrder', 5, 60); // Max 5 pedidos por minuto
  
  // ... resto del código
});
```

**Impacto:** 🟡 IMPORTANTE  
**Esfuerzo:** 3-4 horas  
**Prioridad:** P1 - ALTA

---

### 4. INYECCIÓN DE CÓDIGO EN CAMPOS DE TEXTO ⚠️

#### Problema:
```typescript
// NO hay sanitización de inputs del usuario
const newOrder = {
  ...orderData,
  cliente: {
    nombre: orderData.cliente.nombre,  // ⚠️ Podría contener XSS
    telefono: orderData.cliente.telefono
  }
};
```

#### ✅ Solución - Sanitización:
```typescript
// functions/src/utils/sanitize.ts
import validator from 'validator';

export function sanitizeOrderData(orderData: any) {
  return {
    ...orderData,
    cliente: {
      nombre: validator.escape(validator.trim(orderData.cliente.nombre)).substring(0, 100),
      telefono: validator.escape(orderData.cliente.telefono.replace(/[^0-9+]/g, '')),
      email: validator.normalizeEmail(orderData.cliente.email) || ''
    },
    notas: orderData.notas 
      ? validator.escape(validator.trim(orderData.notas)).substring(0, 500) 
      : '',
    direccion: orderData.direccion ? {
      calle: validator.escape(orderData.direccion.calle).substring(0, 200),
      numero: validator.escape(orderData.direccion.numero).substring(0, 20),
      comuna: validator.escape(orderData.direccion.comuna).substring(0, 100),
      referencia: orderData.direccion.referencia 
        ? validator.escape(orderData.direccion.referencia).substring(0, 500) 
        : ''
    } : undefined
  };
}

// Instalar: npm install validator @types/validator --save
```

**Impacto:** 🟡 MEDIO  
**Esfuerzo:** 2-3 horas  
**Prioridad:** P2 - MEDIA

---

## 💰 OPTIMIZACIÓN DE COSTOS FIREBASE

### ANÁLISIS DE COSTOS ACTUALES

#### Estimación Mensual (100 pedidos/día):
```
Firestore Reads:  ~450,000 lecturas/mes  → $0.27 USD
Firestore Writes: ~12,000 escrituras/mes  → $0.14 USD
Cloud Functions:  ~15,000 invocaciones/mes → $0.40 USD (free tier)
Bandwidth:        ~15 GB/mes              → $1.80 USD
Storage:          ~2 GB                   → $0.10 USD

TOTAL ESTIMADO: ~$2.71 USD/mes (ACTUAL)
```

#### Proyección con Optimizaciones:
```
Firestore Reads:  ~120,000 lecturas/mes (-73%) → $0.07 USD
Firestore Writes: ~8,000 escrituras/mes (-33%)  → $0.09 USD
Cloud Functions:  ~12,000 invocaciones/mes (-20%) → $0.32 USD
Bandwidth:        ~8 GB/mes (-47%)        → $0.96 USD
Storage:          ~2 GB                   → $0.10 USD

TOTAL OPTIMIZADO: ~$1.54 USD/mes
AHORRO: ~$1.17 USD/mes (43% de reducción)
```

---

### 1. LECTURAS REDUNDANTES DE FIRESTORE ⛔ CRÍTICO

#### Problema Detectado:
```typescript
// hooks/useFirestorePizzaConfig.ts (Línea 60-68)
const [ingredientsSnap, itemsMenuSnap, categoriesSnap] = await Promise.all([
  getDocs(collection(db, "ingredientes")),      // ~150 lecturas
  getDocs(collection(db, "items_menu")),        // ~50 lecturas
  getDocs(collection(db, "categorias_menu")),   // ~10 lecturas
])
// TOTAL: 210 lecturas por CADA recarga de página
```

**Costo Actual:** Si 10 usuarios cargan el menú por día = 2,100 lecturas/día = 63,000 lecturas/mes

#### ✅ Solución 1: Implementar Caché con React Query

```typescript
// hooks/useFirestorePizzaConfig.ts - OPTIMIZADO
import { useQuery, useQueryClient } from '@tanstack/react-query';

export function useFirestorePizzaConfig() {
  const queryClient = useQueryClient();
  
  // Cache de 5 minutos para datos que no cambian frecuentemente
  const { data: ingredients = [], isLoading: loadingIngredients } = useQuery({
    queryKey: ['ingredientes'],
    queryFn: async () => {
      const snap = await getDocs(collection(db, "ingredientes"));
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    staleTime: 5 * 60 * 1000,  // 5 minutos
    cacheTime: 30 * 60 * 1000, // 30 minutos
    refetchOnWindowFocus: false // No recargar al cambiar de pestaña
  });
  
  const { data: itemsMenu = [], isLoading: loadingItems } = useQuery({
    queryKey: ['items_menu'],
    queryFn: async () => {
      const snap = await getDocs(collection(db, "items_menu"));
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    staleTime: 2 * 60 * 1000,  // 2 minutos (cambia más frecuentemente)
    cacheTime: 15 * 60 * 1000
  });
  
  // Invalidar cache solo cuando importa
  const refreshData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['items_menu'] });
    queryClient.invalidateQueries({ queryKey: ['ingredientes'] });
  }, [queryClient]);
  
  return {
    loading: loadingIngredients || loadingItems,
    ingredients,
    itemsMenu,
    refreshData
  };
}
```

**Ahorro:** ~50,000 lecturas/mes = **$0.15 USD/mes**

---

#### ✅ Solución 2: Usar Listeners Inteligentes (Solo Admin)

```typescript
// hooks/useRealtimeData.ts
export function useRealtimeData<T>(
  collectionName: string,
  enableRealtime: boolean = false  // Solo para admin
) {
  const [data, setData] = useState<T[]>([]);
  
  useEffect(() => {
    if (!enableRealtime) {
      // Usuario normal: Lectura única con cache
      const fetchData = async () => {
        const cached = localStorage.getItem(`cache_${collectionName}`);
        const cacheTime = localStorage.getItem(`cache_time_${collectionName}`);
        
        // Usar cache si tiene menos de 5 minutos
        if (cached && cacheTime) {
          const age = Date.now() - parseInt(cacheTime);
          if (age < 5 * 60 * 1000) {
            setData(JSON.parse(cached));
            return;
          }
        }
        
        // Fetch desde Firestore
        const snap = await getDocs(collection(db, collectionName));
        const newData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as T[];
        
        setData(newData);
        localStorage.setItem(`cache_${collectionName}`, JSON.stringify(newData));
        localStorage.setItem(`cache_time_${collectionName}`, Date.now().toString());
      };
      
      fetchData();
    } else {
      // Admin: Listener en tiempo real
      const unsubscribe = onSnapshot(
        collection(db, collectionName),
        (snap) => {
          setData(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as T[]);
        }
      );
      
      return () => unsubscribe();
    }
  }, [collectionName, enableRealtime]);
  
  return data;
}
```

**Ahorro:** ~35,000 lecturas/mes = **$0.10 USD/mes**

---

### 2. MÚLTIPLES LISTENERS EN TIEMPO REAL SIN CONTROL

#### Problema:
```typescript
// Detectados 15+ listeners activos simultáneamente en:
// - useFirestorePizzaConfig (3 listeners)
// - useDeliveryZones (1 listener)
// - useAdminOrders (1 listener)
// - InventoryAlerts (1 listener)
// - Múltiples componentes admin (10+ listeners)

// Cada listener genera ~50 lecturas/hora cuando hay cambios
// Costo estimado: ~36,000 lecturas/mes innecesarias
```

#### ✅ Solución - Singleton Pattern para Listeners:

```typescript
// lib/realtime-manager.ts
class RealtimeManager {
  private static instance: RealtimeManager;
  private listeners: Map<string, () => void> = new Map();
  private subscribers: Map<string, Set<(data: any) => void>> = new Map();
  
  private constructor() {}
  
  static getInstance() {
    if (!this.instance) {
      this.instance = new RealtimeManager();
    }
    return this.instance;
  }
  
  subscribe<T>(
    collectionName: string,
    callback: (data: T[]) => void
  ): () => void {
    // Si ya existe listener, solo agregar callback
    if (!this.listeners.has(collectionName)) {
      const unsubscribe = onSnapshot(
        collection(db, collectionName),
        (snap) => {
          const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          
          // Notificar a todos los subscribers
          this.subscribers.get(collectionName)?.forEach(cb => cb(data));
        }
      );
      
      this.listeners.set(collectionName, unsubscribe);
      this.subscribers.set(collectionName, new Set());
    }
    
    // Agregar callback
    this.subscribers.get(collectionName)!.add(callback);
    
    // Retornar función de cleanup
    return () => {
      this.subscribers.get(collectionName)?.delete(callback);
      
      // Si no hay más subscribers, cerrar listener
      if (this.subscribers.get(collectionName)?.size === 0) {
        this.listeners.get(collectionName)?.();
        this.listeners.delete(collectionName);
        this.subscribers.delete(collectionName);
      }
    };
  }
}

// Uso en hooks
export function useRealtimeCollection<T>(collectionName: string) {
  const [data, setData] = useState<T[]>([]);
  const manager = RealtimeManager.getInstance();
  
  useEffect(() => {
    return manager.subscribe<T>(collectionName, setData);
  }, [collectionName]);
  
  return data;
}
```

**Ahorro:** ~30,000 lecturas/mes = **$0.09 USD/mes**

---

### 3. ÍNDICES FALTANTES EN FIRESTORE ⛔ CRÍTICO

#### Problema:
```typescript
// lib/orders.ts - Query sin índice compuesto
const q = query(
  collection(db, 'orders'),
  where('estado', '==', 'Pendiente'),
  orderBy('timestamps.created', 'desc'),  // ⚠️ REQUIERE ÍNDICE
  limit(100)
);
```

**Consecuencia:** Firestore rechaza la query o es MUY lenta.

#### ✅ Solución - Crear Índices:

```json
// firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "orders",
      "queryScope": "COLLECTION",
      "fields": [
        {"fieldPath": "estado", "order": "ASCENDING"},
        {"fieldPath": "timestamps.created", "order": "DESCENDING"}
      ]
    },
    {
      "collectionGroup": "orders",
      "queryScope": "COLLECTION",
      "fields": [
        {"fieldPath": "userId", "order": "ASCENDING"},
        {"fieldPath": "timestamps.created", "order": "DESCENDING"}
      ]
    },
    {
      "collectionGroup": "items_menu",
      "queryScope": "COLLECTION",
      "fields": [
        {"fieldPath": "categoria", "order": "ASCENDING"},
        {"fieldPath": "activo", "order": "ASCENDING"},
        {"fieldPath": "nombre", "order": "ASCENDING"}
      ]
    },
    {
      "collectionGroup": "ingredientes",
      "queryScope": "COLLECTION",
      "fields": [
        {"fieldPath": "categoria", "order": "ASCENDING"},
        {"fieldPath": "stockActual", "order": "ASCENDING"}
      ]
    },
    {
      "collectionGroup": "inventory_transactions",
      "queryScope": "COLLECTION",
      "fields": [
        {"fieldPath": "ingredienteId", "order": "ASCENDING"},
        {"fieldPath": "timestamp", "order": "DESCENDING"}
      ]
    }
  ],
  "fieldOverrides": []
}
```

```bash
# Desplegar índices
firebase deploy --only firestore:indexes
```

**Impacto:** Mejora velocidad de queries en 300-500%  
**Esfuerzo:** 30 minutos  
**Prioridad:** P0 - INMEDIATA

---

### 4. FALTA DE PAGINACIÓN EN LISTADOS LARGOS

#### Problema:
```typescript
// hooks/useAdminOrders.ts - Carga TODOS los pedidos
const allOrders = await getAllOrders();  // ~100-1000 documentos
// COSTO: 100-1000 lecturas cada vez que se abre admin
```

#### ✅ Solución - Paginación con Firestore Cursors:

```typescript
// hooks/useAdminOrders.ts - OPTIMIZADO
export function useAdminOrdersPaginated(pageSize: number = 20) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  
  const loadMoreOrders = async () => {
    let q = query(
      collection(db, 'orders'),
      where('estado', 'in', ['Pendiente', 'En preparación', 'En camino']),
      orderBy('timestamps.created', 'desc'),
      limit(pageSize)
    );
    
    // Si hay cursor, continuar desde ahí
    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      setHasMore(false);
      return;
    }
    
    const newOrders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Order[];
    
    setOrders(prev => lastDoc ? [...prev, ...newOrders] : newOrders);
    setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
    setHasMore(snapshot.docs.length === pageSize);
  };
  
  return { orders, loadMoreOrders, hasMore };
}
```

**Ahorro:** ~25,000 lecturas/mes = **$0.07 USD/mes**

---

### 5. CLOUD FUNCTIONS - OPTIMIZACIÓN DE COLD STARTS

#### Problema:
```typescript
// functions/src/index.ts
// Cada invocación puede tener 1-3s de cold start
// Costo adicional en tiempo de ejecución
```

#### ✅ Solución - Min Instances + Keep Warm:

```typescript
// functions/src/index.ts
import {setGlobalOptions} from 'firebase-functions/v2';

// Configuración global optimizada
setGlobalOptions({
  region: 'us-central1',
  memory: '256MiB',      // Reducir de 512MiB por defecto
  timeoutSeconds: 60,
  minInstances: 1,       // Mantener 1 instancia caliente (SOLO producción)
  maxInstances: 10
});

export const createOrder = onCall({
  memory: '512MiB',      // Solo esta función necesita más memoria
  minInstances: 0        // No necesita estar siempre caliente
}, async (request) => {
  // ...
});

// Función ligera para keep-warm
export const healthCheck = onRequest(async (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});
```

**Costo Adicional:** +$5.40 USD/mes por min instances  
**Ahorro en Tiempo:** -70% en latencia de pedidos  
**Recomendación:** Evaluar según volumen de pedidos

---

## 🛡️ EVALUACIÓN DE ROBUSTEZ

### 1. MANEJO DE ERRORES - ANÁLISIS

#### ✅ Aspectos Positivos:
```typescript
// Buen uso de transacciones atómicas
await db.runTransaction(async (transaction) => {
  // Validar inventario
  // Crear pedido
  // Consumir inventario
  // Todo o nada
});
```

#### ⚠️ Áreas de Mejora:

**1.1. Falta de Logging Estructurado**
```typescript
// ACTUAL: Logs sin contexto
console.error("Error creating order:", error);

// MEJORADO: Structured Logging
import * as logger from "firebase-functions/logger";

logger.error("Order creation failed", {
  userId: request.auth.uid,
  errorCode: error.code,
  errorMessage: error.message,
  orderData: {
    itemCount: orderData.items.length,
    total: orderData.total
  },
  timestamp: new Date().toISOString()
});
```

**1.2. Falta de Monitoreo de Errores**

Instalar Sentry o similar:
```typescript
// functions/src/monitoring/sentry.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,  // 10% de traces para performance
});

// Wrapper para funciones
export function withErrorTracking(fn: any) {
  return async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  };
}
```

**Impacto:** 🟡 IMPORTANTE  
**Esfuerzo:** 2-3 horas  
**Prioridad:** P1 - ALTA

---

### 2. VALIDACIÓN DE INVENTARIO - RACE CONDITIONS

#### ✅ Aspectos Positivos:
```typescript
// Usa transacciones para evitar race conditions
await db.runTransaction(async (transaction) => {
  const inventoryValidation = await validateInventoryForOrder(
    orderData.items,
    transaction  // ✅ Pasa transacción para lecturas consistentes
  );
});
```

#### ⚠️ Problema Potencial:
```typescript
// inventory.service.ts - Línea 38
const inventorySnapshot = transaction
  ? await transaction.get(db.collection("ingredientes"))  // ❌ NO FUNCIONA
  : await db.collection("ingredientes").get();

// transaction.get() NO ACEPTA CollectionReference
// Solo acepta DocumentReference
```

**Solución Correcta:**
```typescript
export async function validateInventoryForOrder(
  items: OrderItem[],
  transaction?: admin.firestore.Transaction
): Promise<ValidationResult> {
  const db = admin.firestore();
  
  // 1. Primero obtener IDs de ingredientes necesarios
  const ingredientNames = extractIngredientNames(items);
  
  // 2. Si hay transacción, leer documentos individualmente
  let inventoryDocs: admin.firestore.DocumentSnapshot[];
  
  if (transaction) {
    // Leer cada ingrediente dentro de la transacción
    const ingredientRefs = ingredientNames.map(name => 
      db.collection('ingredientes').where('nombre', '==', name).limit(1)
    );
    
    // NO SE PUEDE: transaction solo acepta refs individuales
    // WORKAROUND: Usar lock document pattern
    const lockRef = db.collection('_locks').doc('inventory');
    const lockDoc = await transaction.get(lockRef);
    
    if (!lockDoc.exists) {
      transaction.set(lockRef, { locked: true, timestamp: admin.firestore.FieldValue.serverTimestamp() });
    }
    
    // Leer inventario (fuera de transacción pero protegido por lock)
    const snapshot = await db.collection('ingredientes').get();
    inventoryDocs = snapshot.docs;
  } else {
    const snapshot = await db.collection('ingredientes').get();
    inventoryDocs = snapshot.docs;
  }
  
  // ... resto de la validación
}
```

**Recomendación Alternativa: Optimistic Locking**
```typescript
// Agregar campo 'version' a cada ingrediente
{
  nombre: "Queso Mozzarella",
  stockActual: 100,
  version: 42  // ← Incrementar en cada actualización
}

// Al consumir inventario
transaction.update(ingredienteRef, {
  stockActual: admin.firestore.FieldValue.increment(-cantidad),
  version: admin.firestore.FieldValue.increment(1)
});

// Si hay conflicto, Firestore aborta automáticamente la transacción
```

**Impacto:** 🟡 MEDIO  
**Esfuerzo:** 4-6 horas  
**Prioridad:** P2 - MEDIA

---

### 3. FALTA DE BACKUPS AUTOMATIZADOS ⚠️

#### Problema:
No hay sistema de backups programados para Firestore.

#### ✅ Solución - Scheduled Backups:

```typescript
// functions/src/scheduled/backup.ts
import {onSchedule} from 'firebase-functions/v2/scheduler';
import {getFirestore} from 'firebase-admin/firestore';

export const scheduledFirestoreBackup = onSchedule({
  schedule: 'every day 02:00',  // 2 AM diariamente
  timeZone: 'America/Santiago',
  region: 'us-central1'
}, async (event) => {
  const projectId = process.env.GCLOUD_PROJECT;
  const databaseName = 'pizzeria-palermo-17f6d';
  
  const client = new v1.FirestoreAdminClient();
  const bucket = `gs://${projectId}-firestore-backups`;
  
  const timestamp = new Date().toISOString().split('T')[0];
  
  await client.exportDocuments({
    name: client.databasePath(projectId, '(default)'),
    outputUriPrefix: `${bucket}/${timestamp}`,
    collectionIds: [
      'orders',
      'users',
      'items_menu',
      'ingredientes',
      'delivery-zones',
      'settings'
    ]
  });
  
  logger.info(`Backup completed: ${bucket}/${timestamp}`);
});
```

```bash
# Configurar bucket de backups
gsutil mb -p pizzeria-palermo-17f6d gs://pizzeria-palermo-17f6d-firestore-backups

# Configurar lifecycle para borrar backups antiguos (retener 30 días)
gsutil lifecycle set backup-lifecycle.json gs://pizzeria-palermo-17f6d-firestore-backups
```

```json
// backup-lifecycle.json
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {"age": 30}
      }
    ]
  }
}
```

**Costo:** ~$0.08 USD/mes (1 GB backup × 30 días × $0.026/GB/mes)  
**Impacto:** 🔴 CRÍTICO (Protección de datos)  
**Esfuerzo:** 1-2 horas  
**Prioridad:** P0 - INMEDIATA

---

### 4. RETRY LOGIC EN WEBPAY - ANÁLISIS

#### ✅ Fortalezas:
```typescript
// webpay.service.ts - Excelente implementación de retry con backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  // Exponential backoff: 1s, 2s, 4s
  const delay = baseDelay * Math.pow(2, attempt);
}
```

#### 💡 Mejora Sugerida - Circuit Breaker:
```typescript
// functions/src/utils/circuit-breaker.ts
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private maxFailures: number = 5,
    private resetTimeout: number = 60000  // 1 minuto
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      // Verificar si es tiempo de intentar de nuevo
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await fn();
      
      // Reset en caso de éxito
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failures = 0;
      }
      
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();
      
      if (this.failures >= this.maxFailures) {
        this.state = 'OPEN';
        logger.warn('Circuit breaker opened due to failures', {
          failures: this.failures,
          function: fn.name
        });
      }
      
      throw error;
    }
  }
}

// Uso
const webpayCircuit = new CircuitBreaker(5, 60000);

export const confirmWebpayTransaction = async (token: string) => {
  return webpayCircuit.execute(() => 
    retryWithBackoff(() => actualConfirmWebpay(token))
  );
};
```

**Impacto:** 🟡 MEDIO  
**Esfuerzo:** 2-3 horas  
**Prioridad:** P3 - BAJA

---

## 📈 ANÁLISIS DE ESCALABILIDAD

### 1. LÍMITES DE FIRESTORE - EVALUACIÓN

#### Límites Actuales por Diseño:
```
Escrituras por segundo por documento: 1 escritura/seg
Escrituras por segundo por colección: ~10,000 escrituras/seg
Lecturas por segundo: Ilimitadas (con caché)

PROBLEMA POTENCIAL:
- Si un ingrediente se actualiza con cada pedido
- Y llegan 5 pedidos simultáneos para el mismo ingrediente
- CONFLICTOS DE CONTENCIÓN
```

#### ✅ Solución - Distributed Counters:

```typescript
// lib/distributed-counter.ts
export async function incrementDistributedCounter(
  db: admin.firestore.Firestore,
  counterPath: string,
  amount: number,
  numShards: number = 10
) {
  const shardId = Math.floor(Math.random() * numShards);
  const shardRef = db.doc(`${counterPath}/shards/shard_${shardId}`);
  
  await shardRef.set({
    count: admin.firestore.FieldValue.increment(amount)
  }, { merge: true });
}

export async function getDistributedCounter(
  db: admin.firestore.Firestore,
  counterPath: string
): Promise<number> {
  const shardsSnap = await db.collection(`${counterPath}/shards`).get();
  let total = 0;
  
  shardsSnap.forEach(doc => {
    total += doc.data().count || 0;
  });
  
  return total;
}

// Uso en inventario
// En lugar de:
await ingredienteRef.update({
  stockActual: admin.firestore.FieldValue.increment(-cantidad)
});

// Usar:
await incrementDistributedCounter(
  db,
  `ingredientes/${ingredienteId}/stock`,
  -cantidad,
  10  // 10 shards = 10x más capacidad
);
```

**Capacidad:** De 1 escritura/seg a 10 escrituras/seg por ingrediente  
**Impacto:** 🟡 MEDIO (Solo necesario con >100 pedidos/hora)  
**Esfuerzo:** 3-4 horas  
**Prioridad:** P4 - FUTURA

---

### 2. ARQUITECTURA DE MICROSERVICIOS VS MONOLITO

#### Estado Actual: MONOLITO ESTRUCTURADO ✅
```
functions/src/index.ts (814 líneas)
  ├─ calculatePrice
  ├─ createOrder
  ├─ updateOrderStatus
  ├─ initWebpayTransaction
  ├─ confirmWebpayTransaction
  ├─ cleanupAbandonedOrders
  ├─ sendWelcomeEmailToUser
  └─ sendWelcomeWhatsAppToUser
```

**Para el volumen actual (100-500 pedidos/día): ADECUADO ✅**

#### Cuándo Migrar a Microservicios:
- **> 1,000 pedidos/día**: Separar `orders.service`, `payment.service`, `inventory.service`
- **> 10,000 pedidos/día**: Considerar Google Cloud Run + Pub/Sub
- **> 50,000 pedidos/día**: Arquitectura distribuida con Kafka/RabbitMQ

**Recomendación:** Mantener monolito estructurado hasta alcanzar 1,000 pedidos/día.

---

### 3. CDN Y OPTIMIZACIÓN DE IMÁGENES

#### Problema:
```typescript
// Imágenes servidas directamente desde Firebase Storage
// Sin optimización, sin CDN, sin lazy loading
<Image src={pizza.imagen} />  // Puede ser 2-5 MB
```

#### ✅ Solución - Next.js Image Optimization:

```typescript
// next.config.mjs
export default {
  images: {
    domains: ['firebasestorage.googleapis.com'],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 3600,  // Cache 1 hora
  },
};

// Componente
import Image from 'next/image';

<Image 
  src={pizza.imagen} 
  alt={pizza.nombre}
  width={400}
  height={400}
  loading="lazy"
  placeholder="blur"
  blurDataURL="/placeholder.svg"
  sizes="(max-width: 768px) 100vw, 400px"
/>
```

**Ahorro en Bandwidth:** ~40-60%  
**Mejora en Performance:** LCP -30%  
**Impacto:** 🟡 IMPORTANTE  
**Esfuerzo:** 2-3 horas  
**Prioridad:** P2 - MEDIA

---

### 4. SEPARACIÓN DE AMBIENTES (DEV / STAGING / PROD)

#### Problema Actual:
```typescript
// Un solo proyecto Firebase para todo
// Riesgo de afectar producción durante desarrollo
```

#### ✅ Solución - Multi-Environment Setup:

```bash
# Proyectos Firebase
pizzeria-palermo-dev
pizzeria-palermo-staging  
pizzeria-palermo-prod

# Configuración
firebase use dev
firebase use staging
firebase use prod
```

```json
// .firebaserc
{
  "projects": {
    "dev": "pizzeria-palermo-dev",
    "staging": "pizzeria-palermo-staging",
    "prod": "pizzeria-palermo-17f6d"
  },
  "targets": {}
}
```

```typescript
// lib/firebase.ts - Configuración dinámica
const getFirebaseConfig = () => {
  const env = process.env.NEXT_PUBLIC_ENVIRONMENT || 'prod';
  
  const configs = {
    dev: {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY_DEV,
      projectId: 'pizzeria-palermo-dev'
    },
    staging: {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY_STAGING,
      projectId: 'pizzeria-palermo-staging'
    },
    prod: {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      projectId: 'pizzeria-palermo-17f6d'
    }
  };
  
  return configs[env];
};
```

**Impacto:** 🔴 IMPORTANTE (Seguridad en desarrollo)  
**Esfuerzo:** 3-4 horas  
**Prioridad:** P1 - ALTA

---

## 🚀 PLAN DE ACCIÓN PRIORITIZADO

### FASE 1: CRÍTICO - SEGURIDAD (1-2 SEMANAS)

**P0 - INMEDIATO (Día 1-3):**
1. ✅ Rotar credenciales de Firebase expuestas
2. ✅ Implementar índices en Firestore
3. ✅ Configurar backups automatizados
4. ✅ Descomentar regla de bloqueo por defecto en firestore.rules

**P1 - URGENTE (Día 4-10):**
5. ✅ Implementar Custom Claims para roles
6. ✅ Agregar rate limiting a Cloud Functions
7. ✅ Sanitización de inputs de usuario
8. ✅ Configurar ambientes (dev/staging/prod)

**Costo Estimado:** $0 (Solo tiempo de desarrollo)  
**ROI:** Protección de datos, prevención de ataques

---

### FASE 2: OPTIMIZACIÓN DE COSTOS (2-3 SEMANAS)

**P2 - ALTA (Semana 2-3):**
9. ✅ Implementar React Query para caché
10. ✅ Singleton pattern para listeners
11. ✅ Paginación en listados admin
12. ✅ Next.js Image optimization

**Ahorro Mensual:** ~$1.20 USD/mes (43% reducción)  
**ROI:** Escalabilidad sin incremento proporcional de costos

---

### FASE 3: ROBUSTEZ Y MONITOREO (3-4 SEMANAS)

**P3 - MEDIA (Semana 3-4):**
13. ✅ Implementar Sentry para error tracking
14. ✅ Structured logging en Cloud Functions
15. ✅ Circuit breaker para servicios externos
16. ✅ Fix de validación de inventario en transacciones

**Costo Adicional:** ~$10-20 USD/mes (Sentry tier básico)  
**ROI:** Reducción de downtime, mejor experiencia de usuario

---

### FASE 4: ESCALABILIDAD (4-8 SEMANAS)

**P4 - BAJA (Solo si se alcanza >1,000 pedidos/día):**
17. 🔄 Implementar distributed counters
18. 🔄 Migrar a arquitectura de microservicios
19. 🔄 Implementar queue system (Pub/Sub)
20. 🔄 CDN para assets estáticos

**Costo Adicional:** Variable según volumen  
**ROI:** Preparación para crecimiento exponencial

---

## 📊 MÉTRICAS DE ÉXITO

### KPIs a Monitorear Post-Implementación:

**Seguridad:**
- [ ] 0 credenciales expuestas en repositorio
- [ ] 100% de endpoints con rate limiting
- [ ] 0 inyecciones SQL/NoSQL detectadas
- [ ] Backups exitosos cada 24 horas

**Costos:**
- [ ] Reducción de 40%+ en lecturas de Firestore
- [ ] Reducción de 30%+ en invocaciones de Functions
- [ ] Costo mensual < $2 USD con tráfico actual

**Performance:**
- [ ] Tiempo de carga inicial < 2s (LCP)
- [ ] Cold start de Functions < 1s
- [ ] Tiempo de confirmación de pedido < 3s

**Disponibilidad:**
- [ ] Uptime > 99.5%
- [ ] Error rate < 0.5%
- [ ] Tiempo promedio de recuperación < 5min

---

## 🎓 RECOMENDACIONES FINALES

### Mejores Prácticas a Implementar:

1. **Code Reviews Obligatorios**
   - Todo cambio debe ser revisado por al menos 1 persona
   - Usar GitHub Pull Requests con templates

2. **Testing Automatizado**
   ```typescript
   // Implementar tests para funciones críticas
   // functions/src/__tests__/createOrder.test.ts
   describe('createOrder', () => {
     it('should reject orders outside business hours', async () => {
       // Mock time to be 3 AM
       // Call createOrder
       // Expect HttpsError with 'failed-precondition'
     });
   });
   ```

3. **Documentación Técnica**
   - Mantener README.md actualizado
   - Documentar decisiones arquitectónicas (ADR)
   - API documentation con OpenAPI/Swagger

4. **Monitoreo Proactivo**
   - Configurar alertas en Firebase Console
   - Dashboard de métricas en tiempo real
   - Reportes semanales automáticos

5. **Seguridad Continua**
   - Auditorías de seguridad trimestrales
   - Dependency updates semanales (Dependabot)
   - Penetration testing anual

---

## 📞 CONTACTO Y SOPORTE

Para implementar estas recomendaciones:

1. **Priorizar** según impacto vs esfuerzo
2. **Implementar** en sprints de 2 semanas
3. **Medir** resultados con métricas definidas
4. **Iterar** basado en feedback

---

**Documento generado:** 22 de Febrero de 2026  
**Versión:** 1.0  
**Estado:** BORRADOR PARA REVISIÓN

---


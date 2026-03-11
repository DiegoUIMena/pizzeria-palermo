# 🔧 GUÍA DE IMPLEMENTACIÓN - SOLUCIONES PRIORITARIAS
**Pizzería Palermo - Plan de Acción Técnico**

---

## 🚨 ACCIONES INMEDIATAS (HACER HOY)

### 1. ROTAR CREDENCIALES DE FIREBASE ⛔

**Problema:** Credenciales expuestas en `.env.local`

**Pasos:**
```bash
# 1. Eliminar del historial de Git
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env.local" \
  --prune-empty --tag-name-filter cat -- --all

# 2. Forzar push (ADVERTIR AL EQUIPO PRIMERO)
git push origin --force --all

# 3. Crear .env.local.example (sin valores reales)
cp .env.local .env.local.example
# Editar y reemplazar valores con placeholders
```

```env
# .env.local.example
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

**Verificar:** `.gitignore` ya tiene `.env*` (✅ CORRECTO)

---

### 2. CREAR ÍNDICES DE FIRESTORE

**Archivo:** `firestore.indexes.json` (REEMPLAZAR COMPLETAMENTE)

```json
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
      "collectionGroup": "orders",
      "queryScope": "COLLECTION",
      "fields": [
        {"fieldPath": "paymentStatus", "order": "ASCENDING"},
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
      "collectionGroup": "items_menu",
      "queryScope": "COLLECTION",
      "fields": [
        {"fieldPath": "activo", "order": "ASCENDING"},
        {"fieldPath": "disponible", "order": "ASCENDING"},
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
    },
    {
      "collectionGroup": "inventory_transactions",
      "queryScope": "COLLECTION",
      "fields": [
        {"fieldPath": "pedidoId", "order": "ASCENDING"},
        {"fieldPath": "timestamp", "order": "DESCENDING"}
      ]
    }
  ],
  "fieldOverrides": []
}
```

**Desplegar:**
```bash
firebase deploy --only firestore:indexes
```

---

### 3. HABILITAR REGLA DE BLOQUEO POR DEFECTO

**Archivo:** `firestore.rules` (Línea 142-146)

**ANTES:**
```javascript
// match /{document=**} {
//   allow read, write: if false;
// }
// NOTA: Comentada por ahora
```

**DESPUÉS:**
```javascript
// BLOQUEAR TODO LO DEMÁS POR DEFECTO
match /{document=**} {
  allow read, write: if false;
}
```

**Desplegar:**
```bash
firebase deploy --only firestore:rules
```

⚠️ **ADVERTENCIA:** Antes de desplegar, verificar que todas las colecciones usadas tengan reglas explícitas. Revisar logs de Firebase Console después del deploy para detectar "permission-denied" errors.

---

### 4. CONFIGURAR BACKUPS AUTOMATIZADOS

**Paso 1: Crear bucket de backups**
```bash
# Autenticarse con gcloud
gcloud auth login

# Crear bucket
gsutil mb -p pizzeria-palermo-17f6d -c STANDARD -l us-central1 \
  gs://pizzeria-palermo-17f6d-firestore-backups

# Verificar
gsutil ls -p pizzeria-palermo-17f6d
```

**Paso 2: Configurar lifecycle policy**

Crear archivo `backup-lifecycle.json`:
```json
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

```bash
# Aplicar lifecycle
gsutil lifecycle set backup-lifecycle.json \
  gs://pizzeria-palermo-17f6d-firestore-backups
```

**Paso 3: Crear función de backup**

Instalar dependencias:
```bash
cd functions
npm install @google-cloud/firestore-admin --save
```

Crear archivo `functions/src/scheduled/backup.ts`:
```typescript
import {onSchedule} from 'firebase-functions/v2/scheduler';
import * as logger from 'firebase-functions/logger';
import {FirestoreAdminClient} from '@google-cloud/firestore-admin';

export const scheduledFirestoreBackup = onSchedule({
  schedule: 'every day 02:00',
  timeZone: 'America/Santiago',
  region: 'us-central1'
}, async (event) => {
  const projectId = process.env.GCLOUD_PROJECT || 'pizzeria-palermo-17f6d';
  const client = new FirestoreAdminClient();
  
  const bucket = `gs://${projectId}-firestore-backups`;
  const timestamp = new Date().toISOString().split('T')[0];
  
  try {
    const [operation] = await client.exportDocuments({
      name: client.databasePath(projectId, '(default)'),
      outputUriPrefix: `${bucket}/${timestamp}`,
      collectionIds: [
        'orders',
        'users',
        'items_menu',
        'ingredientes',
        'delivery-zones',
        'settings',
        'pizza_config',
        'categorias_menu'
      ]
    });
    
    logger.info('Firestore backup initiated', {
      bucket,
      timestamp,
      operationName: operation.name
    });
    
    return { success: true, timestamp };
  } catch (error) {
    logger.error('Backup failed', error);
    throw error;
  }
});
```

**Paso 4: Exportar en index.ts**

Agregar en `functions/src/index.ts`:
```typescript
// Al inicio del archivo
export * from './scheduled/backup';
```

**Paso 5: Otorgar permisos**
```bash
# Otorgar rol de administrador de Firestore a la cuenta de servicio
gcloud projects add-iam-policy-binding pizzeria-palermo-17f6d \
  --member="serviceAccount:pizzeria-palermo-17f6d@appspot.gserviceaccount.com" \
  --role="roles/datastore.importExportAdmin"

# Otorgar permisos de Storage
gcloud projects add-iam-policy-binding pizzeria-palermo-17f6d \
  --member="serviceAccount:pizzeria-palermo-17f6d@appspot.gserviceaccount.com" \
  --role="roles/storage.admin"
```

**Desplegar:**
```bash
cd functions
npm run build
firebase deploy --only functions:scheduledFirestoreBackup
```

**Verificar:**
- Ir a Firebase Console → Functions
- Buscar `scheduledFirestoreBackup`
- Ver próxima ejecución programada

---

## 🟡 ACCIONES ESTA SEMANA (DÍA 2-5)

### 5. IMPLEMENTAR CUSTOM CLAIMS PARA ROLES

**Problema:** Cada validación de admin hace una lectura extra a Firestore

**Crear archivo:** `functions/src/triggers/user-role.ts`

```typescript
import * as functions from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';

export const syncUserRoleClaims = functions.onDocumentWritten(
  'users/{userId}',
  async (event) => {
    const userId = event.params.userId;
    const afterData = event.data?.after?.data();
    
    if (!afterData) {
      // Usuario eliminado - no hacer nada
      return;
    }
    
    const role = afterData.role || 'customer';
    
    try {
      await admin.auth().setCustomUserClaims(userId, {
        role: role,
        admin: role === 'admin',
        staff: role === 'staff' || role === 'admin'
      });
      
      logger.info('Custom claims updated', { userId, role });
    } catch (error) {
      logger.error('Error setting custom claims', { userId, error });
    }
  }
);
```

**Exportar en index.ts:**
```typescript
export * from './triggers/user-role';
```

**Actualizar firestore.rules:**
```javascript
// ANTES
function isAdmin() {
  return request.auth != null && 
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
}

function isStaff() {
  return request.auth != null && 
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'staff';
}

// DESPUÉS
function isAdmin() {
  return request.auth != null && request.auth.token.admin == true;
}

function isStaff() {
  return request.auth != null && request.auth.token.staff == true;
}
```

**Desplegar:**
```bash
firebase deploy --only functions:syncUserRoleClaims,firestore:rules
```

**Script de migración para usuarios existentes:**

Crear `scripts/migrate-user-claims.js`:
```javascript
const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrateUserClaims() {
  const usersSnapshot = await db.collection('users').get();
  
  for (const doc of usersSnapshot.docs) {
    const userData = doc.data();
    const role = userData.role || 'customer';
    
    try {
      await admin.auth().setCustomUserClaims(doc.id, {
        role: role,
        admin: role === 'admin',
        staff: role === 'staff' || role === 'admin'
      });
      
      console.log(`✅ Claims set for ${userData.email}: ${role}`);
    } catch (error) {
      console.error(`❌ Error for ${doc.id}:`, error.message);
    }
  }
  
  console.log('Migration completed');
  process.exit(0);
}

migrateUserClaims();
```

```bash
node scripts/migrate-user-claims.js
```

---

### 6. IMPLEMENTAR RATE LIMITING

**Crear archivo:** `functions/src/middleware/rate-limiter.ts`

```typescript
import {HttpsError} from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';

// Cache en memoria (se resetea con cada cold start)
const rateLimitCache = new Map<string, {count: number, resetAt: number}>();

// Limpiar cache cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimitCache.entries()) {
    if (now > data.resetAt) {
      rateLimitCache.delete(key);
    }
  }
}, 5 * 60 * 1000);

interface RateLimitConfig {
  functionName: string;
  maxRequests: number;
  windowSeconds: number;
  persistToFirestore?: boolean;
}

export async function checkRateLimit(
  userId: string,
  config: RateLimitConfig
): Promise<void> {
  const key = `${config.functionName}:${userId}`;
  const now = Date.now();
  
  // Verificar cache en memoria
  const cached = rateLimitCache.get(key);
  
  if (cached) {
    if (now <= cached.resetAt) {
      if (cached.count >= config.maxRequests) {
        const remainingSeconds = Math.ceil((cached.resetAt - now) / 1000);
        
        logger.warn('Rate limit exceeded', {
          userId,
          functionName: config.functionName,
          count: cached.count,
          maxRequests: config.maxRequests
        });
        
        throw new HttpsError(
          'resource-exhausted',
          `Demasiadas solicitudes. Intenta nuevamente en ${remainingSeconds} segundos.`,
          {
            retryAfter: remainingSeconds,
            limit: config.maxRequests,
            window: config.windowSeconds
          }
        );
      }
      
      // Incrementar contador
      cached.count++;
      rateLimitCache.set(key, cached);
    } else {
      // Resetear ventana
      rateLimitCache.set(key, {
        count: 1,
        resetAt: now + (config.windowSeconds * 1000)
      });
    }
  } else {
    // Primera request en esta ventana
    rateLimitCache.set(key, {
      count: 1,
      resetAt: now + (config.windowSeconds * 1000)
    });
  }
  
  // Opcional: Persistir en Firestore para análisis
  if (config.persistToFirestore) {
    const db = admin.firestore();
    const current = rateLimitCache.get(key)!;
    
    await db
      .collection('_rate_limits')
      .doc(`${config.functionName}_${userId}_${Math.floor(now / 1000)}`)
      .set({
        userId,
        functionName: config.functionName,
        count: current.count,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
  }
}
```

**Aplicar a funciones críticas:**

Actualizar `functions/src/index.ts`:
```typescript
import {checkRateLimit} from './middleware/rate-limiter';

export const createOrder = onCall(async (request) => {
  // 1. Verificar autenticación
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuario no autenticado");
  }
  
  // 2. RATE LIMITING
  await checkRateLimit(request.auth.uid, {
    functionName: 'createOrder',
    maxRequests: 5,        // Máximo 5 pedidos
    windowSeconds: 60,     // Por minuto
    persistToFirestore: true
  });
  
  // ... resto del código
});

export const initWebpayTransaction = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuario no autenticado");
  }
  
  await checkRateLimit(request.auth.uid, {
    functionName: 'initWebpayTransaction',
    maxRequests: 3,
    windowSeconds: 60
  });
  
  // ... resto del código
});
```

**Desplegar:**
```bash
cd functions
npm run build
firebase deploy --only functions:createOrder,functions:initWebpayTransaction
```

---

### 7. SANITIZACIÓN DE INPUTS

**Instalar dependencias:**
```bash
cd functions
npm install validator @types/validator --save
```

**Crear archivo:** `functions/src/utils/sanitize.ts`

```typescript
import validator from 'validator';

export interface SanitizedOrderData {
  cliente: {
    nombre: string;
    telefono: string;
    email: string;
  };
  direccion?: {
    calle: string;
    numero: string;
    comuna: string;
    referencia?: string;
  };
  notas?: string;
  metodoPago: string;
  tipoEntrega: string;
}

export function sanitizeOrderData(orderData: any): SanitizedOrderData {
  // Validar y sanitizar cliente
  if (!orderData.cliente?.nombre || !orderData.cliente?.telefono) {
    throw new Error('Datos del cliente incompletos');
  }
  
  const nombre = validator.trim(orderData.cliente.nombre);
  if (!validator.isLength(nombre, { min: 2, max: 100 })) {
    throw new Error('Nombre inválido (2-100 caracteres)');
  }
  
  const telefono = orderData.cliente.telefono.replace(/[^0-9+]/g, '');
  if (!validator.isLength(telefono, { min: 9, max: 15 })) {
    throw new Error('Teléfono inválido');
  }
  
  let email = '';
  if (orderData.cliente.email) {
    email = validator.normalizeEmail(orderData.cliente.email) || '';
    if (email && !validator.isEmail(email)) {
      throw new Error('Email inválido');
    }
  }
  
  const sanitized: SanitizedOrderData = {
    cliente: {
      nombre: validator.escape(nombre),
      telefono: validator.escape(telefono),
      email: validator.escape(email)
    },
    metodoPago: orderData.metodoPago,
    tipoEntrega: orderData.tipoEntrega
  };
  
  // Sanitizar dirección si existe
  if (orderData.direccion) {
    const calle = validator.trim(orderData.direccion.calle || '');
    const numero = validator.trim(orderData.direccion.numero || '');
    const comuna = validator.trim(orderData.direccion.comuna || '');
    
    if (!calle || !numero || !comuna) {
      throw new Error('Dirección incompleta');
    }
    
    sanitized.direccion = {
      calle: validator.escape(calle).substring(0, 200),
      numero: validator.escape(numero).substring(0, 20),
      comuna: validator.escape(comuna).substring(0, 100),
      referencia: orderData.direccion.referencia 
        ? validator.escape(validator.trim(orderData.direccion.referencia)).substring(0, 500)
        : undefined
    };
  }
  
  // Sanitizar notas
  if (orderData.notas) {
    const notas = validator.trim(orderData.notas);
    sanitized.notas = validator.escape(notas).substring(0, 1000);
  }
  
  return sanitized;
}
```

**Usar en createOrder:**

```typescript
import {sanitizeOrderData} from './utils/sanitize';

export const createOrder = onCall(async (request) => {
  // ... autenticación y rate limiting
  
  // Sanitizar datos
  let sanitizedData;
  try {
    sanitizedData = sanitizeOrderData(request.data);
  } catch (error) {
    throw new HttpsError(
      'invalid-argument',
      error instanceof Error ? error.message : 'Datos inválidos'
    );
  }
  
  // Usar sanitizedData en lugar de request.data
  // ...
});
```

---

## 📅 ACCIONES SEMANA 2 (OPTIMIZACIÓN)

### 8. IMPLEMENTAR REACT QUERY PARA CACHÉ

**Instalar:**
```bash
npm install @tanstack/react-query --save
```

**Crear provider:** `app/providers/QueryProvider.tsx`

```typescript
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,      // 5 minutos
        cacheTime: 30 * 60 * 1000,     // 30 minutos
        refetchOnWindowFocus: false,
        retry: 1
      }
    }
  }));
  
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools />}
    </QueryClientProvider>
  );
}
```

**Actualizar layout:** `app/layout.tsx`

```typescript
import { QueryProvider } from './providers/QueryProvider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <QueryProvider>
          {/* Otros providers */}
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
```

**Migrar hook:** `hooks/useFirestorePizzaConfig.ts`

```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function useFirestorePizzaConfig() {
  const queryClient = useQueryClient();
  
  const { data: ingredients = [], isLoading: loadingIngredients } = useQuery({
    queryKey: ['ingredientes'],
    queryFn: async () => {
      const snap = await getDocs(collection(db, 'ingredientes'));
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    staleTime: 5 * 60 * 1000
  });
  
  const { data: itemsMenu = [], isLoading: loadingItems } = useQuery({
    queryKey: ['items_menu'],
    queryFn: async () => {
      const snap = await getDocs(collection(db, 'items_menu'));
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    staleTime: 2 * 60 * 1000
  });
  
  const { data: categories = [], isLoading: loadingCategories } = useQuery({
    queryKey: ['categorias_menu'],
    queryFn: async () => {
      const snap = await getDocs(collection(db, 'categorias_menu'));
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    staleTime: 10 * 60 * 1000  // Categorías cambian raramente
  });
  
  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: ['items_menu'] });
    queryClient.invalidateQueries({ queryKey: ['ingredientes'] });
    queryClient.invalidateQueries({ queryKey: ['categorias_menu'] });
  };
  
  return {
    loading: loadingIngredients || loadingItems || loadingCategories,
    ingredients,
    itemsMenu,
    categories,
    refreshData
  };
}
```

---

### 9. OPTIMIZAR IMÁGENES CON NEXT.JS

**Actualizar:** `next.config.mjs`

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'firebasestorage.googleapis.com',
      'storage.googleapis.com'
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 3600,  // 1 hora
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;"
  }
};

export default nextConfig;
```

**Reemplazar imágenes en componentes:**

ANTES:
```tsx
<img src={pizza.imagen} alt={pizza.nombre} />
```

DESPUÉS:
```tsx
import Image from 'next/image';

<Image 
  src={pizza.imagen} 
  alt={pizza.nombre}
  width={400}
  height={400}
  loading="lazy"
  placeholder="blur"
  blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iI2VlZSIvPjwvc3ZnPg=="
  sizes="(max-width: 768px) 100vw, 400px"
  className="object-cover rounded-lg"
/>
```

---

## 📊 CHECKLIST DE VERIFICACIÓN

### Seguridad
- [ ] `.env.local` eliminado del historial de Git
- [ ] `.gitignore` incluye `.env*`
- [ ] Índices de Firestore desplegados
- [ ] Regla de bloqueo por defecto activada
- [ ] Backups automatizados funcionando (verificar en 24h)
- [ ] Custom claims implementados
- [ ] Rate limiting activo en funciones críticas
- [ ] Sanitización de inputs implementada

### Costos
- [ ] React Query implementado
- [ ] Caché de localStorage en uso
- [ ] Next.js Image optimization activo
- [ ] Paginación en listados admin

### Monitoreo
- [ ] Firebase Console - Verificar métricas
- [ ] Cloud Functions logs - Sin errores
- [ ] Firestore usage - Comparar antes/después

---

## 🆘 TROUBLESHOOTING

### Si algo falla después del deploy:

**1. Rollback de Functions:**
```bash
# Ver versiones anteriores
firebase functions:log

# Rollback a versión anterior
firebase functions:config:get > functions/.runtimeconfig.json
# Restaurar código anterior desde Git
git checkout HEAD~1 functions/
firebase deploy --only functions
```

**2. Rollback de Firestore Rules:**
```bash
# Firebase Console → Firestore → Rules → Ver historial
# Seleccionar versión anterior → Publicar
```

**3. Verificar índices:**
```bash
firebase firestore:indexes
```

---

**Última actualización:** 22 de Febrero de 2026  
**Versión:** 1.0  

# ✅ CHECKLIST DE IMPLEMENTACIÓN
**Pizzería Palermo - Plan de Acción Diario**

---

## 🚨 DÍA 1: SEGURIDAD CRÍTICA

### Tarea 1.1: Rotar Credenciales Firebase (2 horas)
- [ ] Hacer backup del archivo `.env.local` actual
- [ ] Crear `.env.local.example` con placeholders
- [ ] Eliminar `.env.local` del historial de Git:
  ```bash
  git filter-branch --force --index-filter \
    "git rm --cached --ignore-unmatch .env.local" \
    --prune-empty --tag-name-filter cat -- --all
  ```
- [ ] Verificar que `.gitignore` incluye `.env*` (ya está ✅)
- [ ] Force push al repositorio (ADVERTIR AL EQUIPO)
  ```bash
  git push origin --force --all
  ```
- [ ] Generar nuevas credenciales en Firebase Console (si es necesario)
- [ ] Actualizar `.env.local` localmente con nuevas credenciales
- [ ] Verificar que la app funciona con nuevas credenciales

**Verificación:**
```bash
# No debe aparecer .env.local
git ls-files | grep .env
```

---

### Tarea 1.2: Crear Índices de Firestore (30 min)
- [ ] Abrir archivo `firestore.indexes.json`
- [ ] REEMPLAZAR contenido con índices del archivo `SOLUCIONES_IMPLEMENTACION.md`
- [ ] Desplegar índices:
  ```bash
  firebase deploy --only firestore:indexes
  ```
- [ ] Esperar 2-5 minutos a que se construyan
- [ ] Verificar en Firebase Console → Firestore → Índices
- [ ] Probar queries en la app (Admin → Pedidos)

**Verificación:**
- [ ] No hay errores "index required" en Firebase Console logs
- [ ] Listado de pedidos carga rápidamente (<1 segundo)

---

### Tarea 1.3: Habilitar Regla de Bloqueo (15 min)
- [ ] Abrir `firestore.rules`
- [ ] Ir a línea 142-146
- [ ] DESCOMENTAR bloque:
  ```javascript
  match /{document=**} {
    allow read, write: if false;
  }
  ```
- [ ] Desplegar reglas:
  ```bash
  firebase deploy --only firestore:rules
  ```
- [ ] Verificar en Firebase Console → Firestore → Rules

**Verificación:**
- [ ] Probar app como usuario
- [ ] Probar app como admin
- [ ] NO debe haber errores "permission-denied"

---

## 🚨 DÍA 2: BACKUPS AUTOMATIZADOS

### Tarea 2.1: Configurar Bucket de Backups (30 min)
- [ ] Autenticarse con gcloud:
  ```bash
  gcloud auth login
  ```
- [ ] Crear bucket:
  ```bash
  gsutil mb -p pizzeria-palermo-17f6d -c STANDARD -l us-central1 \
    gs://pizzeria-palermo-17f6d-firestore-backups
  ```
- [ ] Crear archivo `backup-lifecycle.json` (ver SOLUCIONES_IMPLEMENTACION.md)
- [ ] Aplicar lifecycle:
  ```bash
  gsutil lifecycle set backup-lifecycle.json \
    gs://pizzeria-palermo-17f6d-firestore-backups
  ```

**Verificación:**
```bash
gsutil ls -p pizzeria-palermo-17f6d
# Debe aparecer: gs://pizzeria-palermo-17f6d-firestore-backups/
```

---

### Tarea 2.2: Crear Función de Backup (1.5 horas)
- [ ] Instalar dependencias:
  ```bash
  cd functions
  npm install @google-cloud/firestore-admin --save
  ```
- [ ] Crear carpeta `functions/src/scheduled/`
- [ ] Crear archivo `backup.ts` (copiar de SOLUCIONES_IMPLEMENTACION.md)
- [ ] Actualizar `functions/src/index.ts`:
  ```typescript
  export * from './scheduled/backup';
  ```
- [ ] Compilar:
  ```bash
  npm run build
  ```
- [ ] Verificar que no hay errores de TypeScript

**Verificación:**
- [ ] No hay errores en `npm run build`
- [ ] Archivo compilado existe en `functions/lib/scheduled/backup.js`

---

### Tarea 2.3: Otorgar Permisos y Desplegar (30 min)
- [ ] Otorgar permisos de Firestore Admin:
  ```bash
  gcloud projects add-iam-policy-binding pizzeria-palermo-17f6d \
    --member="serviceAccount:pizzeria-palermo-17f6d@appspot.gserviceaccount.com" \
    --role="roles/datastore.importExportAdmin"
  ```
- [ ] Otorgar permisos de Storage:
  ```bash
  gcloud projects add-iam-policy-binding pizzeria-palermo-17f6d \
    --member="serviceAccount:pizzeria-palermo-17f6d@appspot.gserviceaccount.com" \
    --role="roles/storage.admin"
  ```
- [ ] Desplegar función:
  ```bash
  firebase deploy --only functions:scheduledFirestoreBackup
  ```

**Verificación:**
- [ ] Ir a Firebase Console → Functions
- [ ] Buscar `scheduledFirestoreBackup`
- [ ] Ver próxima ejecución (debe ser mañana a las 2 AM)
- [ ] (Opcional) Ejecutar manualmente para probar

---

## 🟡 DÍA 3: CUSTOM CLAIMS

### Tarea 3.1: Crear Trigger de Roles (1 hora)
- [ ] Crear archivo `functions/src/triggers/user-role.ts`
- [ ] Copiar código de SOLUCIONES_IMPLEMENTACION.md
- [ ] Actualizar `functions/src/index.ts`:
  ```typescript
  export * from './triggers/user-role';
  ```
- [ ] Compilar: `npm run build`

**Verificación:**
- [ ] No hay errores de compilación
- [ ] Archivo `functions/lib/triggers/user-role.js` existe

---

### Tarea 3.2: Actualizar Firestore Rules (30 min)
- [ ] Abrir `firestore.rules`
- [ ] Reemplazar funciones `isAdmin()` y `isStaff()` con versión de Custom Claims
- [ ] Desplegar:
  ```bash
  firebase deploy --only firestore:rules
  ```

**Verificación:**
- [ ] No hay errores en deploy
- [ ] App sigue funcionando normal

---

### Tarea 3.3: Migrar Usuarios Existentes (30 min)
- [ ] Crear archivo `scripts/migrate-user-claims.js`
- [ ] Copiar código de SOLUCIONES_IMPLEMENTACION.md
- [ ] Ejecutar:
  ```bash
  node scripts/migrate-user-claims.js
  ```
- [ ] Verificar output:
  ```
  ✅ Claims set for admin@example.com: admin
  ✅ Claims set for user@example.com: customer
  ```

**Verificación:**
- [ ] Todos los usuarios migrados sin errores
- [ ] Probar login como admin
- [ ] Probar login como usuario normal
- [ ] Panel admin sigue accesible

---

### Tarea 3.4: Desplegar Trigger (15 min)
- [ ] Desplegar función:
  ```bash
  firebase deploy --only functions:syncUserRoleClaims
  ```
- [ ] Verificar en Firebase Console → Functions

**Verificación:**
- [ ] Función desplegada sin errores
- [ ] Crear usuario de prueba
- [ ] Verificar que claims se setean automáticamente

---

## 🟡 DÍA 4: RATE LIMITING

### Tarea 4.1: Crear Middleware (1 hora)
- [ ] Crear archivo `functions/src/middleware/rate-limiter.ts`
- [ ] Copiar código completo de SOLUCIONES_IMPLEMENTACION.md
- [ ] Compilar: `npm run build`

**Verificación:**
- [ ] No hay errores de TypeScript
- [ ] Archivo compilado existe

---

### Tarea 4.2: Aplicar a Funciones (30 min)
- [ ] Actualizar `createOrder` en `functions/src/index.ts`
- [ ] Agregar rate limiting (5 pedidos/minuto)
- [ ] Actualizar `initWebpayTransaction`
- [ ] Agregar rate limiting (3 transacciones/minuto)
- [ ] Compilar: `npm run build`

**Verificación:**
- [ ] Código compila sin errores
- [ ] Lógica de rate limiting está antes del código principal

---

### Tarea 4.3: Desplegar y Probar (30 min)
- [ ] Desplegar:
  ```bash
  firebase deploy --only functions:createOrder,functions:initWebpayTransaction
  ```
- [ ] Probar crear 6 pedidos seguidos (el 6to debe fallar)
- [ ] Esperar 1 minuto
- [ ] Probar crear otro pedido (debe funcionar)

**Verificación:**
- [ ] Error después de 5 pedidos: `resource-exhausted`
- [ ] Mensaje: "Demasiadas solicitudes. Intenta nuevamente en X segundos"
- [ ] Funciona correctamente después de esperar

---

## 🟡 DÍA 5: SANITIZACIÓN DE INPUTS

### Tarea 5.1: Instalar Dependencias (5 min)
- [ ] Instalar validator:
  ```bash
  cd functions
  npm install validator @types/validator --save
  ```

---

### Tarea 5.2: Crear Utilidad de Sanitización (1 hora)
- [ ] Crear archivo `functions/src/utils/sanitize.ts`
- [ ] Copiar código de SOLUCIONES_IMPLEMENTACION.md
- [ ] Compilar: `npm run build`

**Verificación:**
- [ ] No hay errores de TypeScript
- [ ] Todas las interfaces están bien definidas

---

### Tarea 5.3: Integrar en createOrder (30 min)
- [ ] Importar `sanitizeOrderData` en `index.ts`
- [ ] Agregar bloque try/catch antes de validaciones
- [ ] Usar `sanitizedData` en lugar de `request.data`
- [ ] Compilar: `npm run build`

**Verificación:**
- [ ] Compilación exitosa
- [ ] Lógica de sanitización está antes de procesamiento

---

### Tarea 5.4: Probar Sanitización (30 min)
- [ ] Desplegar:
  ```bash
  firebase deploy --only functions:createOrder
  ```
- [ ] Probar con nombre que incluya `<script>alert('xss')</script>`
- [ ] Verificar en Firestore que se guardó escapado
- [ ] Probar con número de teléfono con caracteres especiales
- [ ] Verificar que solo se guardan números

**Verificación:**
- [ ] Tags HTML escapados correctamente
- [ ] Solo caracteres válidos en teléfono
- [ ] Email normalizado correctamente
- [ ] Límites de caracteres aplicados

---

## 💰 DÍA 6-7: OPTIMIZACIÓN CON REACT QUERY

### Tarea 6.1: Instalar React Query (10 min)
- [ ] Instalar:
  ```bash
  npm install @tanstack/react-query --save
  ```

---

### Tarea 6.2: Crear Provider (30 min)
- [ ] Crear carpeta `app/providers/`
- [ ] Crear archivo `QueryProvider.tsx`
- [ ] Copiar código de SOLUCIONES_IMPLEMENTACION.md
- [ ] Verificar sintaxis

---

### Tarea 6.3: Integrar en Layout (15 min)
- [ ] Abrir `app/layout.tsx`
- [ ] Importar `QueryProvider`
- [ ] Envolver `children` con provider
- [ ] Verificar que compila: `npm run dev`

**Verificación:**
- [ ] App inicia sin errores
- [ ] DevTools de React Query aparecen (en desarrollo)

---

### Tarea 6.4: Migrar Hook Principal (1.5 horas)
- [ ] Abrir `hooks/useFirestorePizzaConfig.ts`
- [ ] Reemplazar lógica actual con React Query
- [ ] Usar código de SOLUCIONES_IMPLEMENTACION.md
- [ ] Mantener firma del hook igual (no romper componentes)

**Verificación:**
- [ ] TypeScript compila sin errores
- [ ] Hook retorna mismos valores que antes
- [ ] `refreshData()` sigue funcionando

---

### Tarea 6.5: Probar Caché (30 min)
- [ ] Iniciar app: `npm run dev`
- [ ] Abrir DevTools de React Query
- [ ] Navegar a menú de pizzas
- [ ] Verificar que se hace 1 lectura a Firestore
- [ ] Navegar a otra página y volver
- [ ] Verificar que NO se hace otra lectura (usa caché)
- [ ] Esperar 2 minutos
- [ ] Verificar que se actualiza (staleTime)

**Verificación:**
- [ ] Primera carga: 3 queries a Firestore
- [ ] Segunda carga (dentro de 2 min): 0 queries
- [ ] Tercer carga (después de 2 min): 3 queries

---

## 🖼️ DÍA 8: OPTIMIZACIÓN DE IMÁGENES

### Tarea 8.1: Configurar Next.js (15 min)
- [ ] Abrir `next.config.mjs`
- [ ] Agregar configuración de imágenes
- [ ] Copiar de SOLUCIONES_IMPLEMENTACION.md
- [ ] Guardar archivo

---

### Tarea 8.2: Migrar Componentes (2 horas)
- [ ] Listar todos los archivos con `<img>`:
  ```bash
  grep -r "<img" app/
  ```
- [ ] Para cada archivo:
  - [ ] Importar `Image` de `next/image`
  - [ ] Reemplazar `<img>` con `<Image>`
  - [ ] Agregar props: `width`, `height`, `loading`, `sizes`
  - [ ] Probar que se ve bien

**Componentes a migrar:**
- [ ] `app/components/PromoSection.tsx`
- [ ] `app/components/PizzaConfigModal.tsx`
- [ ] `app/admin/inventario/page.tsx`
- [ ] (Otros componentes con imágenes)

**Verificación:**
- [ ] Imágenes se cargan correctamente
- [ ] Network tab muestra imágenes optimizadas (.webp)
- [ ] Lazy loading funciona (scroll down)

---

## 📊 DÍA 9-10: VERIFICACIÓN Y MÉTRICAS

### Tarea 9.1: Verificar Costos en Firebase (30 min)
- [ ] Ir a Firebase Console → Usage and billing
- [ ] Anotar datos de ANTES (últimos 7 días):
  ```
  Firestore Reads: _______
  Firestore Writes: _______
  Functions Invocations: _______
  ```
- [ ] Esperar 7 días con optimizaciones
- [ ] Anotar datos de DESPUÉS:
  ```
  Firestore Reads: _______ (-__%)
  Firestore Writes: _______ (-__%)
  Functions Invocations: _______ (-__%)
  ```

---

### Tarea 9.2: Verificar Seguridad (1 hora)
- [ ] Revisar Firebase Console → Firestore → Rules
- [ ] Verificar última versión publicada
- [ ] Revisar Cloud Functions logs
- [ ] Buscar errores de "permission-denied"
- [ ] Buscar errores de "resource-exhausted" (rate limit)

**Checklist:**
- [ ] Regla de bloqueo por defecto: ACTIVA
- [ ] Custom claims funcionando: SÍ
- [ ] Rate limiting activo: SÍ
- [ ] Sin errores críticos en logs: SÍ

---

### Tarea 9.3: Verificar Backups (30 min)
- [ ] Verificar que corrió backup nocturno:
  ```bash
  gsutil ls gs://pizzeria-palermo-17f6d-firestore-backups/
  ```
- [ ] Debe aparecer carpeta con fecha de hoy
- [ ] Verificar tamaño del backup (debe ser razonable)
- [ ] Revisar logs de función `scheduledFirestoreBackup`

**Verificación:**
- [ ] Backup existe en Storage
- [ ] Tamaño del backup: ~_____ MB
- [ ] Función se ejecutó sin errores
- [ ] Próxima ejecución programada: Mañana 2 AM

---

### Tarea 9.4: Probar Recuperación de Backup (1 hora)
- [ ] Crear proyecto de prueba:
  ```bash
  firebase use --add
  # Seleccionar proyecto de prueba
  ```
- [ ] Importar backup:
  ```bash
  gcloud firestore import gs://pizzeria-palermo-17f6d-firestore-backups/[FECHA] \
    --async \
    --project=pizzeria-palermo-test
  ```
- [ ] Verificar que datos se restauraron correctamente

**Verificación:**
- [ ] Colecciones restauradas correctamente
- [ ] Datos intactos
- [ ] Proceso de restauración documentado

---

## 🎓 DÍA 11+: MONITOREO Y ROBUSTEZ

### Tarea 11.1: Configurar Sentry (2 horas)
- [ ] Crear cuenta en sentry.io
- [ ] Crear proyecto "Pizzeria Palermo"
- [ ] Instalar SDK:
  ```bash
  npm install @sentry/nextjs --save
  ```
- [ ] Configurar según wizard de Sentry
- [ ] Desplegar cambios

**Verificación:**
- [ ] Sentry captura errores en frontend
- [ ] Sentry captura errores en backend
- [ ] Dashboard de Sentry muestra datos

---

### Tarea 11.2: Implementar Structured Logging (1 hora)
- [ ] Actualizar todas las funciones en `functions/src/`
- [ ] Reemplazar `console.log` con `logger.info`
- [ ] Reemplazar `console.error` con `logger.error`
- [ ] Agregar contexto a todos los logs
- [ ] Desplegar

**Verificación:**
- [ ] Logs estructurados en Cloud Functions
- [ ] Filtros funcionan correctamente en Console

---

## ✅ CHECKLIST FINAL

### Seguridad
- [ ] Credenciales rotadas y NO en Git
- [ ] Índices de Firestore creados
- [ ] Regla de bloqueo por defecto activa
- [ ] Backups diarios funcionando
- [ ] Custom claims implementados
- [ ] Rate limiting activo
- [ ] Inputs sanitizados

### Optimización
- [ ] React Query implementado
- [ ] Caché funcionando correctamente
- [ ] Next.js Image optimization activa
- [ ] Listeners optimizados
- [ ] Reducción de costos verificada

### Robustez
- [ ] Sentry configurado
- [ ] Structured logging implementado
- [ ] Backups probados
- [ ] Error handling robusto

### Documentación
- [ ] README.md actualizado
- [ ] Variables de entorno documentadas
- [ ] Proceso de backup documentado
- [ ] Runbook de recuperación creado

---

## 📈 MÉTRICAS POST-IMPLEMENTACIÓN

### Registrar Aquí los Resultados:

**Antes (Fecha: ______):**
```
Firestore Reads/mes:    _______
Firestore Writes/mes:   _______
Costo mensual:          $______
Tiempo de carga:        ______ seg
Error rate:             ______%
```

**Después (Fecha: ______):**
```
Firestore Reads/mes:    _______ (-___%)
Firestore Writes/mes:   _______ (-___%)
Costo mensual:          $______ (-___%)
Tiempo de carga:        ______ seg (-___%)
Error rate:             ______% (monitoreado)
```

---

**¡Éxito en la implementación! 🚀**

# 💾 Backups Locales - GRATIS para Desarrollo

## 📋 ¿Qué es esto?

Scripts para hacer backups de Firestore **en tu computadora** sin costo alguno.  
Ideal para la etapa de desarrollo.

---

## 🚀 Uso Rápido

### Crear Backup
```bash
node scripts/backup-local.js
```

**Resultado:**
- Crea carpeta `backups/2026-02-22/`
- Guarda todas las colecciones en JSON
- Mantiene los últimos 7 backups automáticamente

### Restaurar Backup
```bash
# Restaurar el más reciente
node scripts/restore-local.js

# Restaurar uno específico
node scripts/restore-local.js 2026-02-22
```

⚠️ **ADVERTENCIA:** Sobrescribe los datos actuales. Tienes 5 segundos para cancelar (Ctrl+C).

---

## 📁 Estructura de Backups

```
backups/
├── 2026-02-22/
│   ├── orders.json
│   ├── users.json
│   ├── items_menu.json
│   ├── ingredientes.json
│   ├── delivery-zones.json
│   ├── settings.json
│   ├── pizza_config.json
│   ├── categorias_menu.json
│   └── backup-completo.json  ← Todo en un archivo
├── 2026-02-21/
└── 2026-02-20/
```

---

## 🎯 Cuándo Hacer Backups

### ✅ HACER BACKUP:
- Antes de cambios importantes en la estructura de datos
- Antes de ejecutar scripts de migración
- Antes de actualizar Cloud Functions con lógica de inventario
- Al final de cada día de desarrollo importante
- Antes de Deploy a producción

### ❌ NO NECESITAS BACKUP:
- Cambios menores en UI
- Actualizaciones de estilos
- Cambios en componentes que no afectan datos

---

## 💰 Comparación de Costos

| Método | Costo | Pros | Contras |
|--------|-------|------|---------|
| **Backup Local** (estos scripts) | $0.00 | GRATIS, control total | Manual |
| **Backup Automático Cloud** | ~$0.60/mes | Automático, cloud | Costo mensual |
| **Backup Manual Firebase** | $0.20/backup | Cloud, puntual | Manual, requiere comandos |

---

## 🔄 Migrar a Backup Automático en Producción

Cuando subas a producción con clientes reales:

1. **Deshabilita backups locales** (solo usa para desarrollo)
2. **Implementa backup automático** siguiendo `SOLUCIONES_IMPLEMENTACION.md`
3. **Configura alertas** para notificaciones de backup

**Costo en producción:** ~$0.60/mes (vale la pena con datos reales)

---

## 🛟 Recuperación de Emergencia

### Escenario: Borraste datos por accidente

```bash
# 1. Ver backups disponibles
ls backups/

# 2. Restaurar el backup de ayer
node scripts/restore-local.js 2026-02-21

# 3. Verificar en Firebase Console que los datos están OK
```

---

## ⚙️ Configuración Avanzada

### Cambiar colecciones a respaldar

Edita `scripts/backup-local.js`:

```javascript
const COLLECTIONS = [
  'orders',
  'users',
  'items_menu',
  // Agrega más colecciones aquí
];
```

### Cambiar cantidad de backups a mantener

Por defecto mantiene 7. Para cambiar, edita en `backup-local.js`:

```javascript
// Línea ~100
if (backups.length > 7) {  // Cambia 7 por el número que quieras
```

---

## 📊 Ejemplo de Uso Real

```bash
# Lunes - Antes de agregar nueva funcionalidad
$ node scripts/backup-local.js
📦 Respaldando orders...
   ✅ 45 documentos encontrados
📦 Respaldando users...
   ✅ 12 documentos encontrados
...
✨ ¡Backup completado exitosamente!
📊 Tamaño total: 2.34 MB
📁 Ubicación: backups/2026-02-22

# ... trabajas todo el día ...

# Viernes - Algo salió mal, quiero volver al lunes
$ node scripts/restore-local.js 2026-02-22
📅 Usando backup: 2026-02-22
⚠️  ADVERTENCIA: Esto sobrescribirá los datos actuales
⚠️  Presiona Ctrl+C en los próximos 5 segundos para cancelar

🔄 Iniciando restauración...
📥 Restaurando orders...
   ✅ 45 documentos restaurados en orders
...
✨ ¡Restauración completada!
```

---

## 🎓 Mejores Prácticas

1. **Backup antes de Deploy**
   ```bash
   node scripts/backup-local.js
   firebase deploy
   ```

2. **Backup semanal mínimo**
   - Aunque esté en desarrollo, hace un backup cada viernes

3. **Verifica los backups**
   ```bash
   # Ver tamaño y fecha
   ls -lh backups/
   ```

4. **NO subas backups a Git**
   - Ya está en `.gitignore`, pero verifica

---

## ❓ Troubleshooting

### Error: "Cannot find module '../serviceAccountKey.json'"
```bash
# Verifica que existe el archivo
ls serviceAccountKey.json

# Si no existe, descárgalo de Firebase Console:
# Project Settings → Service Accounts → Generate New Private Key
```

### Backup muy lento
- Normal si tienes muchos datos
- Primera vez puede tomar 2-5 minutos
- Backups subsecuentes son más rápidos

### "Permission denied"
- Verifica que `serviceAccountKey.json` tenga permisos correctos
- Verifica que el service account tenga rol de administrador

---

## ✅ Checklist Pre-Producción

Antes de subir a producción real:

- [ ] Última backup local guardado en un lugar seguro
- [ ] Implementado backup automático en Cloud
- [ ] Probado proceso de restauración
- [ ] Documentado procedimiento de recuperación
- [ ] Alertas configuradas para fallos de backup

---

**¿Preguntas?** Consulta `INFORME_AUDITORIA_SISTEMA.md` sección de Backups.

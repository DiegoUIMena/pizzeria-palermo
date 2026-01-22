# 🔐 Gestión de Roles de Administrador - Pizzería Palermo

## 📋 Resumen

Este documento explica cómo asignar roles de administrador a usuarios en tu sistema de Pizzería Palermo usando Firebase Auth Custom Claims.

---

## 🎯 ¿Por qué Custom Claims?

Los **Custom Claims** de Firebase Auth son atributos personalizados que se agregan al token JWT del usuario. Son más seguros que solo usar Firestore porque:

- ✅ Se verifican en cada petición sin consultar la base de datos
- ✅ No pueden ser modificados por el cliente
- ✅ Son parte del token de autenticación (más rápido y seguro)
- ✅ Se usan en Firestore Rules para control de acceso

---

## 🚀 Uso del Script

### **1. Listar todos los usuarios**

Para ver qué usuarios existen y sus roles actuales:

```bash
node scripts/set-admin-role.js --list
```

**Salida esperada:**
```
📋 Listando todos los usuarios y sus roles:

- admin@pizzeriapalermo.cl
  Nombre: Administrador
  UID: abc123...
  Rol: admin
  Creado: 15/01/2026

- cliente@ejemplo.com
  Nombre: Juan Pérez
  UID: def456...
  Rol: customer
  Creado: 14/01/2026
```

---

### **2. Asignar rol de ADMIN**

Para dar permisos de administrador a un usuario:

```bash
node scripts/set-admin-role.js admin@pizzeriapalermo.cl
```

**Salida esperada:**
```
🔍 Buscando usuario con email: admin@pizzeriapalermo.cl...
✅ Usuario encontrado: Administrador (UID: abc123...)
✅ Custom claim asignado: role="admin"
✅ Documento de Firestore actualizado

📋 Custom Claims actuales:
{
  "role": "admin"
}

✅ COMPLETADO: El usuario ahora es ADMIN

⚠️  IMPORTANTE: El usuario debe cerrar sesión y volver a iniciar sesión
   para que el nuevo rol tome efecto en el token JWT.
```

---

### **3. Asignar rol de STAFF**

Para dar permisos de staff (puede ver pedidos pero no modificar inventario):

```bash
node scripts/set-admin-role.js staff@pizzeriapalermo.cl staff
```

---

### **4. Cambiar un admin a customer**

Si necesitas remover permisos de admin:

```bash
node scripts/set-admin-role.js usuario@ejemplo.com customer
```

---

## 🔑 Roles Disponibles

| Rol | Permisos | Descripción |
|-----|----------|-------------|
| **admin** | Acceso completo | Puede gestionar pedidos, inventario, zonas, menú, reportes |
| **staff** | Operaciones básicas | Puede ver y actualizar pedidos, sin acceso a inventario ni configuración |
| **customer** | Usuario normal | Solo puede hacer pedidos y ver su historial |

---

## ⚙️ Configuración Inicial

### **Primer Administrador**

Cuando instales el sistema por primera vez, necesitas crear el primer administrador:

1. **Regístrate en la aplicación** con tu email (ej: `admin@pizzeriapalermo.cl`)
   - Ve a: http://localhost:3000/auth
   - Crea una cuenta normalmente

2. **Asigna rol de admin con el script:**
   ```bash
   node scripts/set-admin-role.js admin@pizzeriapalermo.cl
   ```

3. **Cierra sesión y vuelve a iniciar sesión** para que el rol tome efecto

4. **Verifica acceso admin:**
   - Ve a: http://localhost:3000/admin
   - Deberías poder acceder sin problemas

---

## 🛡️ Seguridad

### **¿Cómo se protege el acceso admin?**

1. **Firestore Rules:** Verifican el rol antes de permitir lectura/escritura
   ```
   allow read: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
   ```

2. **Layout de Admin (`app/admin/layout.tsx`):** Verifica el rol en el cliente antes de renderizar
   ```typescript
   if (user?.role !== 'admin') {
     router.push('/') // Redirige a inicio
   }
   ```

3. **Custom Claims:** El rol está en el token JWT, no puede ser falsificado

---

## 🔄 Flujo de Verificación

```
Usuario intenta acceder a /admin
         ↓
1. Middleware Next.js (middleware.ts)
   - Verifica autenticación básica
         ↓
2. Layout de Admin (app/admin/layout.tsx)
   - Lee custom claim del token
   - Verifica role === 'admin'
   - Si no es admin → Redirige a /
         ↓
3. Firestore Rules
   - Cada consulta verifica role en custom claims
   - Rechaza operaciones no autorizadas
         ↓
✅ Usuario admin accede al panel
```

---

## 🐛 Troubleshooting

### **"Usuario no es admin" después de asignar rol**

**Solución:** Debes **cerrar sesión y volver a iniciar sesión** para que el nuevo token con custom claims se genere.

```bash
# En la consola del navegador:
localStorage.clear()
sessionStorage.clear()
# Luego recargar la página e iniciar sesión de nuevo
```

---

### **"auth/user-not-found"**

**Causa:** El usuario no existe en Firebase Auth.

**Solución:** El usuario debe registrarse primero en la aplicación (http://localhost:3000/auth) antes de asignarle rol de admin.

---

### **"Error al obtener datos del usuario"**

**Causa:** El archivo `serviceAccountKey.json` no existe o tiene credenciales incorrectas.

**Solución:** 
1. Ve a: https://console.firebase.google.com/project/pizzeria-palermo-17f6d/settings/serviceaccounts/adminsdk
2. Genera nueva clave privada
3. Guárdala como `serviceAccountKey.json` en la raíz del proyecto

---

## 📚 Referencias

- [Firebase Auth Custom Claims](https://firebase.google.com/docs/auth/admin/custom-claims)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/rules-conditions)
- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)

---

## ✅ Checklist de Seguridad

Antes de ir a producción, verifica:

- [ ] Primer usuario admin creado y funcionando
- [ ] Firestore Rules desplegadas (`firebase deploy --only firestore:rules`)
- [ ] `serviceAccountKey.json` está en `.gitignore`
- [ ] Credenciales rotadas si el repo es público
- [ ] Middleware protegiendo rutas `/admin/*`
- [ ] Layout verificando rol antes de renderizar
- [ ] Custom claims configurados para todos los usuarios

---

**Última actualización:** Enero 2026 - Fase 1: Seguridad Inmediata

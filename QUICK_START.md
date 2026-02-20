# 🚀 Quick Start - Instalación y Deploy

## Comandos Rápidos

### 1. Instalar Dependencias de Functions

```powershell
# Ir a la carpeta functions
cd functions

# Instalar dependencias
npm install

# Volver a la raíz del proyecto
cd ..
```

### 2. Compilar Functions

```powershell
cd functions
npm run build
cd ..
```

### 3. Configurar Variables de Entorno

**Antes de desplegar, configura las variables de entorno en Firebase.**

Opción A - Firebase Console (Recomendado):
1. Ve a https://console.firebase.google.com/
2. Selecciona tu proyecto "pizzeria-palermo"
3. Menu: Functions > Variables de entorno
4. Agrega cada variable (ver `CONFIGURACION_NOTIFICACIONES.md` para valores)

Opción B - Firebase CLI:
```powershell
firebase functions:config:set gmail.user="tu-email@gmail.com"
firebase functions:config:set gmail.app_password="tu-password-app"
firebase functions:config:set twilio.account_sid="ACxxxxx"
firebase functions:config:set twilio.auth_token="xxxxxx"
firebase functions:config:set twilio.whatsapp_number="+14155238886"
firebase functions:config:set app.url="https://tu-sitio.com"
```

### 4. Desplegar Functions

```powershell
# Opción 1: Solo functions
cd functions
npm run deploy
cd ..

# Opción 2: Todo el proyecto Firebase
firebase deploy

# Opción 3: Solo las nuevas functions
firebase deploy --only functions:sendWelcomeEmailToUser,functions:sendWelcomeWhatsAppToUser
```

### 5. Ver Logs

```powershell
# Ver todos los logs
firebase functions:log

# Ver logs de email
firebase functions:log --only sendWelcomeEmailToUser

# Ver logs de WhatsApp
firebase functions:log --only sendWelcomeWhatsAppToUser

# Ver logs en tiempo real
firebase functions:log --follow
```

## ⚡ Script Todo-en-Uno

Si ya tienes las credenciales configuradas en Firebase:

```powershell
# Instalar, compilar y desplegar
cd functions; npm install; npm run build; npm run deploy; cd ..
```

## 🧪 Probar Registro

```powershell
# 1. Inicia el servidor de desarrollo (si no está corriendo)
npm run dev

# 2. Ve a http://localhost:3000/auth
# 3. Regístrate con tus datos reales (email y WhatsApp)
# 4. Verifica que lleguen las notificaciones
```

## 📊 Verificar Estado

```powershell
# Ver configuración actual de variables
firebase functions:config:get

# Ver lista de functions desplegadas
firebase functions:list

# Ver estado del proyecto
firebase projects:list
```

## 🐛 Si hay problemas

```powershell
# Ver logs de errores
firebase functions:log --only errors

# Eliminar configuración (si necesitas resetear)
firebase functions:config:unset gmail.user
# (repite para cada variable)

# Redesplegar
cd functions
npm run build
npm run deploy
cd ..
```

## ✅ Verificación Post-Deploy

Después de desplegar, verifica:

```powershell
# 1. Ver que las functions estén desplegadas
firebase functions:list
# Deberías ver: sendWelcomeEmailToUser y sendWelcomeWhatsAppToUser

# 2. Ver la configuración
firebase functions:config:get
# Deberías ver todas las variables configuradas

# 3. Probar registro en tu sitio
# Ir a: https://tu-sitio.com/auth o http://localhost:3000/auth
# Registrarse y verificar que lleguen las notificaciones
```

## 📞 Ayuda Rápida

**Error: "Cannot find module 'nodemailer'"**
- Solución: `cd functions && npm install`

**Error: "Credentials not configured"**
- Solución: Configura variables de entorno en Firebase (ver paso 3)

**Error: "Firebase CLI not found"**
- Solución: `npm install -g firebase-tools`

**Email no llega:**
1. Revisa spam/promociones
2. Verifica credenciales Gmail en Firebase
3. Revisa logs: `firebase functions:log --only sendWelcomeEmailToUser`

**WhatsApp no llega:**
1. ¿Conectaste tu número al sandbox? (envía "join [código]" al número de Twilio)
2. ¿El número tiene formato internacional?
3. Revisa logs: `firebase functions:log --only sendWelcomeWhatsAppToUser`

---

**Documentación completa:** `CONFIGURACION_NOTIFICACIONES.md`

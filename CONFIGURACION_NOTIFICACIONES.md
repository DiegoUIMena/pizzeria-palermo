# 📧 📱 Configuración de Notificaciones Automáticas

## Sistema de Email y WhatsApp para Nuevos Usuarios

Este documento explica cómo configurar las **credenciales** necesarias para que el sistema envíe automáticamente emails y mensajes de WhatsApp a los usuarios cuando se registran.

---

## 🎯 ¿Qué se ha implementado?

✅ **Cloud Functions** listas para enviar notificaciones
✅ **Servicio de Email** con Nodemailer + Gmail (GRATIS)
✅ **Servicio de WhatsApp** con Twilio (~$0.005 USD por mensaje)
✅ **Integración automática** al registrarse un usuario

---

## 📋 Credenciales Necesarias

Debes configurar las siguientes variables de entorno en Firebase:

### 1. **Email (Gmail)**
- `GMAIL_USER` - Tu correo de Gmail
- `GMAIL_APP_PASSWORD` - Contraseña de aplicación de Gmail

### 2. **WhatsApp (Twilio)**
- `TWILIO_ACCOUNT_SID` - Account SID de Twilio
- `TWILIO_AUTH_TOKEN` - Auth Token de Twilio
- `TWILIO_WHATSAPP_NUMBER` - Número de WhatsApp de Twilio (formato: +14155238886)

### 3. **Configuración General**
- `APP_URL` - URL de tu aplicación (ej: https://pizzeriapalermo.com)

---

## 🚀 PASO 1: Configurar Email con Gmail (5 minutos)

### A. Activar Verificación en 2 Pasos

1. Ve a tu cuenta de Google: https://myaccount.google.com/
2. En el menú izquierdo, selecciona **"Seguridad"**
3. Busca **"Verificación en 2 pasos"**
4. Haz clic en **"Comenzar"** y sigue los pasos
5. Configura tu método preferido (SMS, app Google Authenticator, etc.)

### B. Crear Contraseña de Aplicación

1. Una vez activada la verificación en 2 pasos, regresa a **"Seguridad"**
2. Busca **"Contraseñas de aplicaciones"**
   - Si no aparece, busca en Google: "google app passwords"
   - O ve directo a: https://myaccount.google.com/apppasswords
3. Haz clic en **"Contraseñas de aplicaciones"**
4. En "Seleccionar app", elige **"Correo"**
5. En "Seleccionar dispositivo", elige **"Otro (nombre personalizado)"**
6. Escribe: **"Pizzería Palermo Firebase"**
7. Haz clic en **"Generar"**
8. **COPIA LA CONTRASEÑA** (16 caracteres sin espacios)
   - Ejemplo: `abcd efgh ijkl mnop`
   - Guárdala: `abcdefghijklmnop` (sin espacios)

### C. Probar que funciona (opcional)

Puedes probar enviando un email de prueba con este comando:

```bash
node -e "const nodemailer = require('nodemailer'); const t = nodemailer.createTransport({service:'gmail',auth:{user:'TU_EMAIL@gmail.com',pass:'TU_APP_PASSWORD'}}); t.sendMail({from:'TU_EMAIL@gmail.com',to:'TU_EMAIL@gmail.com',subject:'Test',text:'Funciona!'}, (e,i)=>console.log(e||'✅ Email enviado'));"
```

---

## 📱 PASO 2: Configurar WhatsApp con Twilio (10 minutos)

### A. Crear Cuenta en Twilio

1. Ve a: https://www.twilio.com/try-twilio
2. Haz clic en **"Sign up"** (Registrarse)
3. Completa el formulario:
   - First Name (Nombre)
   - Last Name (Apellido)
   - Email
   - Password (mínimo 12 caracteres)
4. Verifica tu email
5. Verifica tu número de teléfono personal

### B. Configurar WhatsApp Sandbox (Para Pruebas)

**IMPORTANTE:** Para mensajes a clientes reales necesitas WhatsApp Business API (requiere aprobación)
Para pruebas, usa el **Sandbox de Twilio**:

1. En el dashboard de Twilio, busca **"Messaging"** > **"Try it out"** > **"Send a WhatsApp message"**
2. Verás un número de WhatsApp de prueba (ej: +1 415 523 8886)
3. Sigue las instrucciones para conectar tu WhatsApp personal al sandbox
4. Envía el mensaje "join [código]" al número de Twilio desde WhatsApp
5. **Copia el número** (formato: +14155238886)

### C. Obtener Credenciales de API

1. En el dashboard de Twilio, ve a **"Account"** > **"API Keys & Tokens"**
2. Encontrarás:
   - **Account SID**: `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - **Auth Token**: Haz clic en "Show" para verlo

### D. Crédito Inicial

Twilio te da **$15 USD de crédito gratis** al registrarte. Con esto puedes enviar ~3,000 mensajes de WhatsApp.

### E. Para Producción (Mensajes a Clientes Reales)

Para enviar mensajes a cualquier número de WhatsApp (no solo el sandbox):

1. En Twilio, solicita acceso a **WhatsApp Business API**
2. Requiere:
   - Verificación de negocio en Meta
   - Número de teléfono dedicado
   - Templates pre-aprobados por WhatsApp
3. Proceso toma 1-2 semanas
4. Costo: ~$0.005 USD por mensaje

---

## ⚙️ PASO 3: Configurar Variables de Entorno en Firebase

### Opción 1: Desde la Consola de Firebase (Recomendado)

1. Ve a: https://console.firebase.google.com/
2. Selecciona tu proyecto **"pizzeria-palermo"**
3. En el menú izquierdo, haz clic en **"Functions"**
4. Ve a la pestaña **"Variables de entorno"**
5. Haz clic en **"Agregar variable"** para cada una:

```
GMAIL_USER = tu-email@gmail.com
GMAIL_APP_PASSWORD = abcdefghijklmnop
TWILIO_ACCOUNT_SID = ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN = xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_NUMBER = +14155238886
APP_URL = https://tu-sitio.com
```

### Opción 2: Desde la Línea de Comandos

```powershell
# Navega a la carpeta del proyecto
cd C:\Users\Diego\Desktop\pizzeria-palermo

# Configura cada variable
firebase functions:config:set gmail.user="tu-email@gmail.com"
firebase functions:config:set gmail.app_password="abcdefghijklmnop"
firebase functions:config:set twilio.account_sid="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
firebase functions:config:set twilio.auth_token="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
firebase functions:config:set twilio.whatsapp_number="+14155238886"
firebase functions:config:set app.url="https://tu-sitio.com"
```

**NOTA:** Si usas la línea de comandos, debes actualizar las funciones para leer desde `functions.config()` en lugar de `process.env`.

---

## 🔧 PASO 4: Instalar Dependencias e Implementar

### A. Instalar Dependencias de Functions

```powershell
# Navega a la carpeta de functions
cd C:\Users\Diego\Desktop\pizzeria-palermo\functions

# Instala las nuevas dependencias
npm install nodemailer twilio
```

### B. Compilar y Desplegar Functions

```powershell
# Compila TypeScript
npm run build

# Despliega las funciones a Firebase
npm run deploy

# O despliega todo el proyecto Firebase
cd ..
firebase deploy
```

### C. Verificar Implementación

Después del deploy, verás en la consola:

```
✔  functions[sendWelcomeEmailToUser(us-central1)] Successful...
✔  functions[sendWelcomeWhatsAppToUser(us-central1)] Successful...
```

---

## 🧪 PASO 5: Probar el Sistema

### Prueba de Registro

1. Ve a tu sitio: `https://tu-sitio.com/auth`
2. Haz clic en la pestaña **"Registrarse"**
3. Completa el formulario:
   - Nombre: Tu Nombre
   - Email: tu-email@gmail.com
   - Contraseña: test123456
   - Teléfono: +56912345678 (tu número real)
   - Dirección: Calle 123
4. Haz clic en **"Registrarse"**

### ¿Qué debería pasar?

1. ✅ Toast de confirmación: "¡Registro exitoso!"
2. ✅ Email de bienvenida en tu bandeja de entrada (revisa spam si no llega)
3. ✅ Mensaje de WhatsApp en tu teléfono (si configuraste el sandbox correctamente)
4. ✅ Redirección a la página principal
5. ✅ Al ir a "Mi Perfil", tus datos ya están guardados

---

## 🐛 Solución de Problemas

### No llega el Email

1. **Verifica la contraseña de aplicación:**
   - Debe ser de 16 caracteres sin espacios
   - Generada desde Google App Passwords

2. **Revisa la carpeta de Spam/Promociones**

3. **Verifica las variables de entorno en Firebase:**
   ```powershell
   firebase functions:config:get
   ```

4. **Revisa los logs de Functions:**
   ```powershell
   firebase functions:log --only sendWelcomeEmailToUser
   ```

### No llega el WhatsApp

1. **¿Estás usando el Sandbox?**
   - El número del usuario debe estar conectado al sandbox
   - Envía "join [código]" desde WhatsApp al número de Twilio

2. **Formato del número:**
   - Debe incluir código de país: `+56912345678`
   - Sin espacios ni guiones

3. **Verifica credenciales de Twilio:**
   - Account SID debe empezar con "AC"
   - Auth Token debe tener 32 caracteres

4. **Revisa los logs:**
   ```powershell
   firebase functions:log --only sendWelcomeWhatsAppToUser
   ```

### Error: "Email/WhatsApp credentials not configured"

Significa que las variables de entorno no están configuradas en Firebase.

**Solución:**
```powershell
firebase functions:config:set gmail.user="tu-email@gmail.com"
firebase functions:config:set gmail.app_password="tu-contraseña-app"
# ... (configura todas las variables)

# Luego redespliega
firebase deploy --only functions
```

---

## 💰 Costos Estimados

### Email (Gmail)
- **GRATIS** hasta 500 emails/día
- Sin costo adicional

### WhatsApp (Twilio)
- **Sandbox (Pruebas):** GRATIS con crédito inicial de $15
- **Producción:**
  - ~$0.005 USD por mensaje a Chile
  - 100 registros/mes = $0.50 USD
  - 500 registros/mes = $2.50 USD
  - 1000 registros/mes = $5.00 USD

**Total mensual estimado:** $0 - $5 USD (dependiendo de registros)

---

## 📊 Monitoreo

### Ver Logs en Tiempo Real

```powershell
# Todos los logs de Functions
firebase functions:log

# Solo email
firebase functions:log --only sendWelcomeEmailToUser

# Solo WhatsApp
firebase functions:log --only sendWelcomeWhatsAppToUser
```

### Dashboard de Firebase

1. Ve a: https://console.firebase.google.com/
2. Selecciona tu proyecto
3. Menu: **Functions** > **Logs**
4. Puedes filtrar por función

### Dashboard de Twilio

1. Ve a: https://console.twilio.com/
2. Menu: **Monitor** > **Logs** > **Messaging**
3. Verás todos los mensajes enviados y su estado

---

## 🔒 Seguridad

### Buenas Prácticas

✅ **NUNCA** subas las credenciales a Git
✅ Usa variables de entorno en Firebase
✅ Cambia tu contraseña de aplicación de Gmail cada 6 meses
✅ Mantén secreto tu Auth Token de Twilio
✅ Usa reglas de Firestore para limitar el acceso

### Credenciales en Código

❌ **MAL:**
```typescript
const password = "abcdefghijklmnop"; // Nunca así
```

✅ **BIEN:**
```typescript
const password = process.env.GMAIL_APP_PASSWORD; // Desde variables de entorno
```

---

## 📚 Recursos Adicionales

### Documentación Oficial

- **Nodemailer:** https://nodemailer.com/
- **Twilio WhatsApp API:** https://www.twilio.com/docs/whatsapp
- **Firebase Functions:** https://firebase.google.com/docs/functions
- **Gmail App Passwords:** https://support.google.com/accounts/answer/185833

### Tutoriales

- **Gmail + Nodemailer:** https://www.youtube.com/results?search_query=nodemailer+gmail
- **Twilio WhatsApp:** https://www.youtube.com/results?search_query=twilio+whatsapp+api

---

## ✅ Checklist Final

Antes de dar por terminada la configuración, verifica:

- [ ] Verificación en 2 pasos activada en Gmail
- [ ] Contraseña de aplicación generada y guardada
- [ ] Cuenta de Twilio creada y verificada
- [ ] Número de WhatsApp sandbox conectado
- [ ] Credenciales de Twilio (Account SID y Auth Token) copiadas
- [ ] Variables de entorno configuradas en Firebase
- [ ] Dependencias instaladas (`npm install` en /functions)
- [ ] Functions compiladas (`npm run build` en /functions)
- [ ] Functions desplegadas (`firebase deploy --only functions`)
- [ ] Prueba de registro realizada exitosamente
- [ ] Email de bienvenida recibido
- [ ] WhatsApp de bienvenida recibido

---

## 🆘 Soporte

Si tienes problemas con la configuración:

1. **Revisa los logs de Firebase Functions** (instrucciones arriba)
2. **Verifica que todas las variables de entorno estén configuradas**
3. **Asegúrate de haber desplegado las functions después de configurar**
4. **Contacta al desarrollador con los logs de error**

---

**¡Felicidades! 🎉** Tu sistema de notificaciones automáticas está listo.

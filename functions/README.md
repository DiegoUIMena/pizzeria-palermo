# Firebase Cloud Functions - Pizzería Palermo

## 🚀 Funciones Implementadas

### 1. `calculatePrice` - Calcular precio de pedido
- Calcula el total de un pedido incluyendo delivery si aplica

### 2. `createOrder` - Crear pedido
- Crea un pedido con validación de inventario
- Transacción atómica

### 3. `updateOrderStatus` - Actualizar estado de pedido
- Solo para administradores

### 4. `initWebpayTransaction` - Iniciar pago Webpay
- Inicia transacción de pago con Webpay Plus (Transbank)

### 5. `confirmWebpayTransaction` - Confirmar pago Webpay
- Confirma el pago y actualiza el pedido
- Transacción atómica

### 6. `cleanupAbandonedOrders` - Limpiar pedidos huérfanos
- Scheduled function (corre automáticamente cada hora)

### 7. `sendWelcomeEmailToUser` - 📧 Enviar email de bienvenida (NUEVO)
- Envía email automático con credenciales al registrarse
- Usa Nodemailer + Gmail

### 8. `sendWelcomeWhatsAppToUser` - 📱 Enviar WhatsApp de bienvenida (NUEVO)
- Envía mensaje de WhatsApp automático al registrarse
- Usa Twilio WhatsApp API

---

## 📦 Instalación

```bash
cd functions
npm install
```

---

## 🔧 Configuración

### Variables de Entorno Requeridas

Para que las funciones de notificaciones funcionen, configura:

```bash
# Email
GMAIL_USER=tu-email@gmail.com
GMAIL_APP_PASSWORD=tu-password-app

# WhatsApp
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxx
TWILIO_WHATSAPP_NUMBER=+14155238886

# General
APP_URL=https://tu-sitio.com
```

### Configurar en Firebase:

**Opción 1: Firebase CLI**
```bash
firebase functions:config:set gmail.user="tu-email@gmail.com"
firebase functions:config:set gmail.app_password="tu-password"
firebase functions:config:set twilio.account_sid="ACxxxxx"
firebase functions:config:set twilio.auth_token="xxxxxx"
firebase functions:config:set twilio.whatsapp_number="+14155238886"
firebase functions:config:set app.url="https://tu-sitio.com"
```

**Opción 2: Consola de Firebase**
1. Ve a https://console.firebase.google.com/
2. Selecciona tu proyecto
3. Functions > Variables de entorno
4. Agrega cada variable

### Desarrollo Local con Emulador

Si quieres probar localmente, crea un archivo `.env` en `/functions`:

```bash
cp .env.example .env
# Edita .env con tus credenciales
```

**IMPORTANTE:** `.env` debe estar en `.gitignore` (ya está)

---

## 🏗️ Compilar

```bash
npm run build
```

---

## 🚀 Desplegar

### Desplegar solo functions:
```bash
npm run deploy
```

### Desplegar todo el proyecto Firebase:
```bash
cd ..
firebase deploy
```

### Desplegar una función específica:
```bash
firebase deploy --only functions:sendWelcomeEmailToUser
firebase deploy --only functions:sendWelcomeWhatsAppToUser
```

---

## 🧪 Probar en Local

```bash
npm run serve
```

Esto inicia los emuladores de Firebase. Puedes llamar a las funciones localmente.

---

## 📝 Ver Logs

### Todos los logs:
```bash
npm run logs
```

### Logs de una función específica:
```bash
firebase functions:log --only sendWelcomeEmailToUser
firebase functions:log --only sendWelcomeWhatsAppToUser
```

### Logs en tiempo real:
```bash
firebase functions:log --follow
```

---

## 🐛 Debugging

### Ver configuración actual:
```bash
firebase functions:config:get
```

### Eliminar una configuración:
```bash
firebase functions:config:unset gmail.user
```

### Ver estado de las functions desplegadas:
```bash
firebase functions:list
```

---

## 📚 Documentación Completa

Para instrucciones detalladas sobre cómo obtener las credenciales de Gmail y Twilio, consulta:

📄 **[CONFIGURACION_NOTIFICACIONES.md](../CONFIGURACION_NOTIFICACIONES.md)**

---

## 🔒 Seguridad

- ✅ Nunca subas `.env` a Git (ya está en `.gitignore`)
- ✅ Usa variables de entorno para credenciales sensibles
- ✅ Las contraseñas de aplicación de Gmail son más seguras que tu contraseña normal
- ✅ Rota tus credenciales de Twilio regularmente

---

## 💰 Costos

### Email (Gmail + Nodemailer)
- **GRATIS** hasta 500 emails/día

### WhatsApp (Twilio)
- Sandbox (pruebas): **GRATIS** con crédito inicial
- Producción: **~$0.005 USD** por mensaje

### Firebase Functions
- Plan Spark (gratis): 125,000 invocaciones/mes
- Plan Blaze: $0.40 por millón de invocaciones

**Total estimado:** $0 - $5 USD/mes (dependiendo de volumen)

---

## 📞 Soporte

Si tienes problemas:

1. **Revisa los logs:** `npm run logs`
2. **Verifica las variables de entorno:** `firebase functions:config:get`
3. **Consulta la documentación completa:** `CONFIGURACION_NOTIFICACIONES.md`
4. **Revisa el dashboard de Firebase:** https://console.firebase.google.com/
5. **Revisa el dashboard de Twilio:** https://console.twilio.com/

---

## 🔄 Actualizar Dependencias

```bash
npm update
```

O para actualizar a la última versión:

```bash
npm install nodemailer@latest twilio@latest
```

---

## ✅ Checklist Post-Deploy

Después de desplegar, verifica:

- [ ] Functions aparecen en la consola de Firebase
- [ ] Variables de entorno configuradas correctamente
- [ ] Prueba de registro envía email correctamente
- [ ] Prueba de registro envía WhatsApp correctamente
- [ ] Logs no muestran errores
- [ ] Credenciales de Gmail funcionan
- [ ] Credenciales de Twilio funcionan

---

**Última actualización:** Febrero 2026
**Versión:** 2.0.0

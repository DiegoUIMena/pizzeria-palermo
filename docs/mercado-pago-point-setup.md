# Configuración de Mercado Pago Point Smart 2

Este documento explica los pasos necesarios para habilitar la integración real del terminal de pago físico **Mercado Pago Point Smart 2** en la caja POS de Palermo Pizzas en Chile.

## Requisitos Previos

1. **Cuenta de Mercado Pago Chile**: Debes contar con una cuenta de vendedor activa en Mercado Pago Chile.
2. **Terminal Point Smart 2**: Debes poseer el dispositivo físico, tenerlo encendido, conectado a internet (WiFi o chip) y asociado a tu cuenta de Mercado Pago.
3. **Obtener Credenciales de Producción**:
   - Ingresa al [Panel de Desarrolladores de Mercado Pago](https://www.mercadopago.cl/developers/).
   - Crea una aplicación o selecciona la existente.
   - Ve a **Credenciales de producción** y copia tu **Access Token** (debe comenzar con `APP_USR-...`).

---

## Paso 1: Obtener el ID del Dispositivo (device_id)

El terminal Point Smart 2 se identifica mediante un `device_id` único dentro de tu cuenta de Mercado Pago. Para obtenerlo:

### Método A: A través de la API de Mercado Pago
Realiza una consulta HTTP GET utilizando tu Access Token:

```bash
curl -X GET \
  'https://api.mercadopago.com/point/integration-api/devices' \
  -H 'Authorization: Bearer TU_ACCESS_TOKEN'
```

La respuesta listará tus dispositivos registrados. Identifica el de la caja y copia su `"id"` (ej. `POINT_12345678`).

### Método B: En la configuración del Point Smart 2
En el menú de configuración o información del propio dispositivo Point físico, suele figurar el número de serie o ID de dispositivo asociado a la integración.

---

## Paso 2: Configuración de Variables de Entorno (.env.local)

Para habilitar la comunicación directa con la API oficial desde el POS en modo producción, agrega las siguientes variables de entorno en tus archivos de entorno (ej. `.env.local`, `.env.development`, `.env.production`):

```env
# Access Token de Mercado Pago (APP_USR-...)
NEXT_PUBLIC_MERCADO_PAGO_ACCESS_TOKEN=APP_USR-XXXX-XXXX-XXXX-XXXX

# ID del Dispositivo Point Smart 2 de tu caja
NEXT_PUBLIC_MERCADO_PAGO_DEVICE_ID=POINT_12345678
```

> [!NOTE]
> Si estas variables **no están presentes o están vacías**, el POS de Palermo operará automáticamente en **Modo Simulado/QA**, permitiendo al cajero testear todo el flujo de caja eligiendo manualmente el resultado del pago (Aprobado, Rechazado o Cancelado) en una ventana interactiva.

---

## Paso 3: Flujo Técnico de la Integración (Integration API)

Nuestra integración utiliza la API oficial de Point REST (dispositivos físicos) de Mercado Pago:

1. **Crear Intención de Pago (Payment Intent)**:
   Al presionar "Cobrar" en el POS con el método Tarjeta, el sistema realiza una llamada HTTP POST a:
   `POST https://api.mercadopago.com/point/integration-api/devices/{device_id}/payment-intents`
   
   La API envía la instrucción de cobro directamente a la pantalla del dispositivo físico con el monto indicado.

2. **Pollear Estado de la Intención**:
   El POS inicia un bucle de consulta (polling) cada 2 segundos a:
   `GET https://api.mercadopago.com/point/integration-api/payment-intents/{payment_intent_id}`
   
   - Si retorna `OPEN`: El cliente aún está aproximando o insertando su tarjeta.
   - Si retorna `FINISHED`: El cobro fue aprobado. El pedido pasa a cocinarse automáticamente.
   - Si retorna `ERROR` o `CANCELED`: El pago falló o fue cancelado.

3. **Cancelar Cobro Activo**:
   Si el cajero desea cambiar el método de pago o cancelar la venta mientras el dispositivo está esperando la tarjeta, se envía:
   `DELETE https://api.mercadopago.com/point/integration-api/devices/{device_id}/payment-intents/{payment_intent_id}`
   Esto libera la pantalla del dispositivo inmediatamente.

---

## Configuración de Webhooks / IPN (Opcional - Recomendado para Producción)

Para una mayor robustez frente a caídas de conexión o cierres accidentales de la pestaña del navegador, se recomienda configurar Webhooks en Mercado Pago:

1. Ingresa a la sección **Webhooks** de tu aplicación en el panel de Mercado Pago.
2. Agrega la URL de tu backend de Firebase Cloud Functions (ej. `https://us-central1-tu-proyecto.cloudfunctions.net/mercadopagoWebhook`).
3. Suscríbete al evento `point_integration_ipn`.
4. De esta forma, Mercado Pago notificará a tu servidor tan pronto el pago se complete, permitiendo procesar el pedido de manera asíncrona e independiente del frontend.

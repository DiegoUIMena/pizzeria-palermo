# 🤖 GUÍA: Cómo Gestionar Preguntas Sin Respuesta

## 📋 Flujo Completo del Sistema

### 1️⃣ **Usuario Hace una Pregunta que el Chatbot NO Puede Responder**

```
Usuario: "¿Tienen pizza sin gluten?"
         ↓
Chatbot: "Lo siento, no entendí tu mensaje. ¿Podrías reformularlo?"
         ↓
Sistema: ✅ Pregunta registrada automáticamente en Firestore
```

**Datos guardados:**
- Texto de la pregunta
- Keywords que se intentaron matchear
- Fecha y hora
- Si detectó que es una pregunta (?)
- Estado inicial: "Pendiente"

---

### 2️⃣ **Admin Ve la Pregunta en el Panel**

```
/admin/chatbot → Pestaña "Preguntas"
```

**Verás:**
```
┌─────────────────────────────────────────────────────┐
│ 📊 ESTADÍSTICAS                                     │
│ [12 Total] [5 Pendientes] [4 Revisadas] [3 Respondidas] │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ ¿Tienen pizza sin gluten?                           │
│ 📅 22/02/2026 19:58 ❓ Pregunta                     │
│ 🔑 gluten, pizza                                    │
│                                                     │
│ [➕ Crear Respuesta]  [⏰] [📝] [✅]  🏷️ Pendiente │
└─────────────────────────────────────────────────────┘
```

---

### 3️⃣ **Crear la Respuesta (AUTOMÁTICO)**

**🎯 Haz clic en el botón rosa "Crear Respuesta"**

El sistema hará **AUTOMÁTICAMENTE**:

1. ✅ Cambia a la pestaña "Intents"
2. ✅ Abre el formulario de crear intent
3. ✅ **Precarga datos sugeridos:**
   - Nombre del intent: `gluten_pizza` (palabras clave de la pregunta)
   - Keywords: `gluten, pizza` (extraídos automáticamente)
   - Prioridad: `5` (valor medio por defecto)

**Verás un banner azul:**
```
┌───────────────────────────────────────────────────┐
│ 💡 Creando respuesta para la pregunta:            │
│ "¿Tienen pizza sin gluten?"                       │
│                                                   │
│ 💡 Los keywords ya están sugeridos. Completa      │
│    las respuestas y ajusta según necesites.       │
└───────────────────────────────────────────────────┘
```

---

### 4️⃣ **Completa el Formulario**

**LO ÚNICO QUE DEBES HACER:**

1. **Revisar el nombre del intent** (opcional, ya está sugerido)
2. **Revisar los keywords** (opcional, ya están sugeridos)
3. **✍️ ESCRIBIR LAS RESPUESTAS** ← LO MÁS IMPORTANTE

**Ejemplo de respuestas (una por línea):**
```
Sí, tenemos opciones sin gluten 🌾
Nuestra masa sin gluten está disponible en todos los tamaños
¡Contáctanos para más información sobre nuestras pizzas sin gluten!
```

4. (Opcional) Agregar follow-up keywords y respuestas

**Formulario completo:**
```
┌─────────────────────────────────────────────┐
│ Crear Nuevo Intent                          │
├─────────────────────────────────────────────┤
│ Nombre: [gluten_pizza]                      │
│ Prioridad: [5]                              │
│ Keywords: [gluten, pizza, celiaco]          │
│ Respuestas:                                 │
│ [Sí, tenemos opciones sin gluten 🌾]       │
│ [Nuestra masa sin gluten está...]          │
│                                             │
│ Follow-up keywords: [precio, costo]         │
│ Follow-up responses: [El precio es...]      │
│                                             │
│ [Cancelar] [Guardar Intent]                 │
└─────────────────────────────────────────────┘
```

---

### 5️⃣ **Guarda el Intent**

Haz clic en **"Guardar Intent"**

**El sistema automáticamente:**

1. ✅ Crea el nuevo intent en Firestore
2. ✅ **Marca la pregunta original como "Respondida"**
3. ✅ Actualiza las estadísticas
4. ✅ Muestra mensaje: "Intent creado exitosamente y pregunta marcada como respondida"

---

### 6️⃣ **Siguiente Usuario - ¡Ya Funciona!**

```
Usuario: "¿Tienen pizza sin gluten?"
         ↓
Chatbot: "¡Sí, tenemos opciones sin gluten 🌾"
         ↓
Sistema: ✅ Intent detectado correctamente
         ✅ Usuario satisfecho
         ✅ NO se registra en preguntas sin respuesta
```

---

## 🎨 Estados de las Preguntas

### 🟡 Pendiente (yellow)
- Pregunta recién registrada
- Todavía no has revisado
- **Acción:** Crea la respuesta o márcala como revisada

### 🔵 Revisada (blue)
- Ya la viste pero aún no creaste respuesta
- Útil para marcar preguntas que necesitas investigar
- **Acción:** Cuando sepas la respuesta, crea el intent

### 🟢 Respondida (green)
- Ya creaste un intent para responder esta pregunta
- Automático cuando usas "Crear Respuesta"
- **Acción:** Ninguna, solo referencia

---

## 🔘 Botones Disponibles

### En cada pregunta:

| Botón | Función | Cuándo Usar |
|-------|---------|-------------|
| **➕ Crear Respuesta** | Abre formulario con datos precargados | Principal - para crear respuestas |
| **⏰ Pendiente** | Marca como pendiente | Si quieres volver a revisar |
| **📝 Revisada** | Marca como revisada | Cuando necesitas investigar antes |
| **✅ Respondida** | Marca como respondida | Manual (se hace automático al crear intent) |

---

## 💡 Tips y Mejores Prácticas

### ✅ RECOMENDADO:

1. **Revisa preguntas diariamente** - Mejora el chatbot constantemente
2. **Usa "Crear Respuesta"** - No pierdas tiempo copiando keywords
3. **Escribe múltiples respuestas** - El chatbot las alternará (más natural)
4. **Agrupa preguntas similares** - Antes de crear, revisa si ya existe un intent
5. **Usa los keywords sugeridos** - El sistema ya analizó la pregunta

### ❌ EVITAR:

1. No marcar como "respondida" sin crear el intent primero
2. No ignorar preguntas frecuentes (aparecerán seguido)
3. No crear intents demasiado específicos (mejor generalizar)
4. No olvidar probar el chatbot después de crear un intent

---

## 📊 Filtros Disponibles

En la pestaña "Preguntas" puedes filtrar por:

- **Todas** - Muestra todas las preguntas registradas
- **Pendientes** - Solo las que no has revisado (🟡)
- **Revisadas** - Las que marcaste para revisar después (🔵)
- **Respondidas** - Las que ya tienen intent creado (🟢)

---

## 🔄 Ciclo de Mejora Continua

```
┌─────────────────────────────────────────────┐
│  1. Usuario pregunta                         │
│          ↓                                   │
│  2. Chatbot no responde                      │
│          ↓                                   │
│  3. Se registra automáticamente              │
│          ↓                                   │
│  4. Admin ve en panel                        │
│          ↓                                   │
│  5. Admin crea respuesta (un clic)           │
│          ↓                                   │
│  6. Intent guardado + pregunta "respondida"  │
│          ↓                                   │
│  7. Siguiente usuario: ¡Ya funciona!         │
│          ↓                                   │
│  8. Chatbot más inteligente ✅              │
└─────────────────────────────────────────────┘
```

---

## 🚀 Ejemplo Completo Paso a Paso

### Escenario: Cliente pregunta por delivery

**Paso 1: Cliente pregunta**
```
Cliente: "¿Hacen envíos a domicilio a Rinconada?"
Chatbot: "Lo siento, no entendí tu mensaje..."
```

**Paso 2: Admin recibe notificación**
```
Badge en pestaña: Preguntas (1) ← Nuevo pendiente
```

**Paso 3: Admin abre panel**
```
/admin/chatbot → Preguntas → Ve:

┌─────────────────────────────────────────────┐
│ ¿Hacen envíos a domicilio a Rinconada?      │
│ 📅 Hoy 20:15 ❓ Pregunta                    │
│ 🔑 envios, domicilio, rinconada             │
│ [➕ Crear Respuesta]  🏷️ Pendiente         │
└─────────────────────────────────────────────┘
```

**Paso 4: Admin hace clic en "Crear Respuesta"**
```
→ Se abre formulario precargado:
  - Intent: envios_domicilio
  - Keywords: envios, domicilio, rinconada
  - Prioridad: 5
```

**Paso 5: Admin escribe respuestas**
```
Respuestas:
¡Sí, hacemos delivery a Rinconada! 🚚
El costo de envío es de $2.000
Tiempo de entrega: 30-45 minutos
```

**Paso 6: Admin guarda**
```
→ Intent creado ✅
→ Pregunta marcada como "Respondida" automáticamente ✅
→ Mensaje: "Intent creado exitosamente..."
```

**Paso 7: Siguiente cliente - ¡Ya funciona!**
```
Cliente: "¿Hacen envíos a domicilio?"
Chatbot: "¡Sí, hacemos delivery a Rinconada! 🚚"
```

---

## 🎯 Resumen Ultra-Rápido

1. **Ve a:** `/admin/chatbot` → Pestaña "Preguntas"
2. **Haz clic:** Botón rosa "Crear Respuesta"
3. **Escribe:** Las respuestas que el chatbot debe dar
4. **Guarda:** El sistema hace todo lo demás automáticamente
5. **Listo:** La pregunta ya tiene respuesta para futuros usuarios

---

## ⚡ Lo Más Importante

### El flujo es TAN SIMPLE como:

```
Ver pregunta → Clic "Crear Respuesta" → Escribir respuestas → Guardar
```

**Todo lo demás es AUTOMÁTICO** 🎉

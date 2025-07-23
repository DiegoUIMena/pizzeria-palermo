# Instalar dependencias necesarias
npm install -g firebase-tools

# Iniciar sesión en Firebase (si no has iniciado sesión)
firebase login

# Seleccionar el proyecto
firebase use pizzeria-palermo-17f6d

# Desplegar las reglas de Firestore
firebase deploy --only firestore:rules

# Mensaje de confirmación
Write-Host "Configuración de Firebase completada. Ahora reinicia tu aplicación Next.js."

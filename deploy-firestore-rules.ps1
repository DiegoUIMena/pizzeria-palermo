# Instalar Firebase CLI si no está instalado
if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
    Write-Host "Firebase CLI no está instalado. Instalando..."
    npm install -g firebase-tools
}

# Iniciar sesión en Firebase (si no has iniciado sesión)
Write-Host "Iniciando sesión en Firebase..."
firebase login

# Inicializar Firebase si es necesario (solo si no existe firebase.json)
if (-not (Test-Path -Path firebase.json)) {
    Write-Host "Inicializando Firebase..."
    firebase init firestore
}

# Desplegar las reglas de Firestore
Write-Host "Desplegando reglas de Firestore..."
firebase deploy --only firestore:rules

Write-Host "Las reglas se han desplegado correctamente."

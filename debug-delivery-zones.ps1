# Script para ejecutar el depurador de zonas de delivery
Write-Host "=== Ejecutando depurador de zonas de delivery ===" -ForegroundColor Cyan

# Cargar variables de entorno desde el archivo .env.local si existe
if (Test-Path -Path ".env.local") {
    $envContent = Get-Content .env.local
    foreach ($line in $envContent) {
        if ($line -match "^\s*([^#][^=]+)=(.*)$") {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
    Write-Host "Variables de entorno cargadas desde .env.local" -ForegroundColor Green
}
elseif (Test-Path -Path ".env") {
    $envContent = Get-Content .env
    foreach ($line in $envContent) {
        if ($line -match "^\s*([^#][^=]+)=(.*)$") {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
    Write-Host "Variables de entorno cargadas desde .env" -ForegroundColor Green
}
else {
    Write-Host "No se encontró archivo .env o .env.local, asegúrate de tener configuradas las variables de entorno" -ForegroundColor Yellow
}

# Ejecutar el script de depuración
Write-Host "Ejecutando script de depuración..." -ForegroundColor Cyan
node debug-delivery-zones.js

Write-Host "=== Fin del depurador ===" -ForegroundColor Cyan

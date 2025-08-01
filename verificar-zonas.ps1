# Script para verificar que las zonas de delivery se hayan borrado correctamente
# Este script ejecuta debug-delivery-zones.js para verificar que la inicialización automática esté deshabilitada

Write-Host "===== VERIFICADOR DE ZONAS DE DELIVERY =====" -ForegroundColor Cyan

# Cargar variables de entorno desde .env.local si existe
if (Test-Path -Path ".env.local") {
    Write-Host "Cargando variables de entorno desde .env.local..." -ForegroundColor Green
    $envContent = Get-Content .env.local
    foreach ($line in $envContent) {
        if ($line -match "^\s*([^#][^=]+)=(.*)$") {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            # Quitar comillas si existen
            if ($value -match '^"(.*)"$' -or $value -match "^'(.*)'$") {
                $value = $matches[1]
            }
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
            Write-Host "  $name = $value" -ForegroundColor DarkGray
        }
    }
    Write-Host "Variables de entorno cargadas correctamente." -ForegroundColor Green
}
elseif (Test-Path -Path ".env") {
    Write-Host "Cargando variables de entorno desde .env..." -ForegroundColor Green
    $envContent = Get-Content .env
    foreach ($line in $envContent) {
        if ($line -match "^\s*([^#][^=]+)=(.*)$") {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            # Quitar comillas si existen
            if ($value -match '^"(.*)"$' -or $value -match "^'(.*)'$") {
                $value = $matches[1]
            }
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
            Write-Host "  $name = $value" -ForegroundColor DarkGray
        }
    }
    Write-Host "Variables de entorno cargadas correctamente." -ForegroundColor Green
}
else {
    Write-Host "No se encontró archivo .env o .env.local" -ForegroundColor Yellow
    Write-Host "Asegúrate de tener configuradas las variables de entorno de Firebase" -ForegroundColor Yellow
    $continuar = Read-Host "¿Deseas continuar de todas formas? (s/n)"
    if ($continuar -ne "s" -and $continuar -ne "S") {
        Write-Host "Operación cancelada por el usuario." -ForegroundColor Red
        exit
    }
}

# Ejecutar el script de verificación
Write-Host "`nIniciando verificación de zonas de delivery..." -ForegroundColor Cyan

# Verificar cuál de los scripts de verificación existe
if (Test-Path -Path "debug-delivery-zones.js") {
    Write-Host "Ejecutando debug-delivery-zones.js..." -ForegroundColor Green
    node debug-delivery-zones.js
} 
elseif (Test-Path -Path "check-zones-initialization.js") {
    Write-Host "Ejecutando check-zones-initialization.js..." -ForegroundColor Green
    node check-zones-initialization.js
}
else {
    Write-Host "No se encontró ningún script de verificación de zonas." -ForegroundColor Red
    exit
}

Write-Host "`n===== VERIFICACIÓN COMPLETADA =====" -ForegroundColor Cyan
Write-Host "Si no viste errores, significa que las zonas se eliminaron correctamente y no se reinicializan automáticamente." -ForegroundColor Green
Write-Host "Puedes crear tus propias zonas de delivery desde la página de administración." -ForegroundColor Green

# Script para verificar zonas
Write-Host "=== VERIFICADOR DE ZONAS DE DELIVERY ===" -ForegroundColor Cyan

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

Write-Host "=== VERIFICACIÓN COMPLETADA ===" -ForegroundColor Cyan
Write-Host "Si no viste errores, significa que las zonas se eliminaron correctamente." -ForegroundColor Green

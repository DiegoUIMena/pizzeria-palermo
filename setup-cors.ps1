# Script para configurar CORS en Firebase Storage
# Este script requiere que tengas Google Cloud SDK instalado

Write-Host "=== Configuración de CORS para Firebase Storage ===" -ForegroundColor Cyan
Write-Host ""

$projectId = "pizzeria-palermo-17f6d"
$bucketName = "$projectId.appspot.com"

Write-Host "Proyecto: $projectId" -ForegroundColor Yellow
Write-Host "Bucket: $bucketName" -ForegroundColor Yellow
Write-Host ""

# Verificar si gsutil está instalado
$gsutilInstalled = Get-Command gsutil -ErrorAction SilentlyContinue

if (-not $gsutilInstalled) {
    Write-Host "❌ gsutil no está instalado." -ForegroundColor Red
    Write-Host ""
    Write-Host "SOLUCIÓN MANUAL:" -ForegroundColor Green
    Write-Host "1. Ve a: https://console.cloud.google.com/storage/browser/$bucketName" -ForegroundColor White
    Write-Host "2. Haz clic en los tres puntos (...) del bucket" -ForegroundColor White
    Write-Host "3. Selecciona 'Edit CORS configuration'" -ForegroundColor White
    Write-Host "4. Pega la siguiente configuración:" -ForegroundColor White
    Write-Host ""
    Write-Host "[" -ForegroundColor Cyan
    Write-Host "  {" -ForegroundColor Cyan
    Write-Host '    "origin": ["http://localhost:3000", "https://' + $projectId + '.web.app"],' -ForegroundColor Cyan
    Write-Host '    "method": ["GET", "POST", "PUT", "DELETE", "HEAD"],' -ForegroundColor Cyan
    Write-Host '    "maxAgeSeconds": 3600,' -ForegroundColor Cyan
    Write-Host '    "responseHeader": ["Content-Type"]' -ForegroundColor Cyan
    Write-Host "  }" -ForegroundColor Cyan
    Write-Host "]" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "5. Guarda los cambios" -ForegroundColor White
    Write-Host ""
    Write-Host "Presiona cualquier tecla para abrir la consola en tu navegador..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    Start-Process "https://console.cloud.google.com/storage/browser/$bucketName"
} else {
    Write-Host "✓ gsutil está instalado" -ForegroundColor Green
    Write-Host ""
    Write-Host "Aplicando configuración CORS..." -ForegroundColor Yellow
    
    gsutil cors set cors.json gs://$bucketName
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ CORS configurado exitosamente!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "❌ Error al configurar CORS" -ForegroundColor Red
        Write-Host "Intenta la solución manual descrita arriba" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Presiona cualquier tecla para salir..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

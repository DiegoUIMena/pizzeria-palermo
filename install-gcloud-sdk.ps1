# Script para instalar Google Cloud SDK en Windows
Write-Host "=== Instalador de Google Cloud SDK ===" -ForegroundColor Cyan
Write-Host ""

# URL del instalador
$installerUrl = "https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe"
$installerPath = "$env:TEMP\GoogleCloudSDKInstaller.exe"

Write-Host "Descargando Google Cloud SDK..." -ForegroundColor Yellow
try {
    Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath -UseBasicParsing
    Write-Host "✓ Descarga completada" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "Iniciando instalador..." -ForegroundColor Yellow
    Write-Host "IMPORTANTE: Durante la instalación:" -ForegroundColor Red
    Write-Host "  1. Marca la opción 'Install bundled Python'" -ForegroundColor White
    Write-Host "  2. Marca la opción 'Run gcloud init'" -ForegroundColor White
    Write-Host "  3. Cuando te pida autenticarte, usa la cuenta de Firebase de la pizzería" -ForegroundColor White
    Write-Host ""
    Write-Host "Presiona cualquier tecla para continuar..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    
    Start-Process -FilePath $installerPath -Wait
    
    Write-Host ""
    Write-Host "✅ Instalación completada" -ForegroundColor Green
    Write-Host ""
    Write-Host "REINICIA PowerShell para que gsutil esté disponible" -ForegroundColor Yellow
    Write-Host "Luego ejecuta: .\setup-cors.ps1" -ForegroundColor White
    
} catch {
    Write-Host "❌ Error al descargar: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Descárgalo manualmente desde:" -ForegroundColor Yellow
    Write-Host "https://cloud.google.com/sdk/docs/install" -ForegroundColor White
}

Write-Host ""
Write-Host "Presiona cualquier tecla para salir..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

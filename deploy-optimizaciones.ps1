#!/usr/bin/env pwsh
# Script para desplegar índices y reglas de Firestore
# Ejecutar: .\deploy-optimizaciones.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Desplegando Optimizaciones Firebase  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar que Firebase CLI está instalado
Write-Host "[1/3] Verificando Firebase CLI..." -ForegroundColor Yellow
$firebaseVersion = firebase --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Firebase CLI no está instalado" -ForegroundColor Red
    Write-Host "Instalar con: npm install -g firebase-tools" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ Firebase CLI instalado: $firebaseVersion" -ForegroundColor Green
Write-Host ""

# Desplegar índices de Firestore
Write-Host "[2/3] Desplegando índices de Firestore..." -ForegroundColor Yellow
Write-Host "Esto puede tomar 5-10 minutos mientras se construyen los índices" -ForegroundColor Gray
firebase deploy --only firestore:indexes

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error al desplegar índices" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Índices desplegados correctamente" -ForegroundColor Green
Write-Host ""

# Desplegar reglas de seguridad
Write-Host "[3/3] Desplegando reglas de seguridad..." -ForegroundColor Yellow
firebase deploy --only firestore:rules

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error al desplegar reglas" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Reglas desplegadas correctamente" -ForegroundColor Green
Write-Host ""

# Resumen
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ✅ Despliegue Completado              " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Verificación:" -ForegroundColor Yellow
Write-Host "1. Firebase Console → Firestore → Indexes" -ForegroundColor Gray
Write-Host "   Verifica que los 8 índices estén en 'Building' o 'Enabled'" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Firebase Console → Firestore → Rules" -ForegroundColor Gray
Write-Host "   Verifica que la regla por defecto esté activa" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Monitorear logs de la aplicación" -ForegroundColor Gray
Write-Host "   Verifica que no haya errores 'permission-denied'" -ForegroundColor Gray
Write-Host ""
Write-Host "Índices en construcción:" -ForegroundColor Yellow
Write-Host "Los índices pueden tardar 5-10 minutos en estar completamente activos." -ForegroundColor Gray
Write-Host "Durante este tiempo, algunas queries pueden ser más lentas." -ForegroundColor Gray
Write-Host ""

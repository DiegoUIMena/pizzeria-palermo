param(
  [string]$ProjectAlias = "test"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Push-Location $root

try {
  Write-Host "[CHECK] Proyecto activo de test..."
  firebase projects:list | Select-String "pizzeria-palermo-test-20260401" | Out-Host

  Write-Host "[CHECK] Build de functions..."
  Push-Location (Join-Path $root "functions")
  npm run build
  Pop-Location

  Write-Host "[CHECK] Endpoint Hosting esperado: https://pizzeria-palermo-test-20260401.web.app"
  Write-Host "[CHECK] Verificación básica completada."
}
finally {
  Pop-Location
}

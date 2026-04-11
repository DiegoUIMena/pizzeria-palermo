param(
  [string]$ProjectAlias = "test",
  [ValidateSet("all", "hosting", "functions", "rules")]
  [string]$Only = "all"
)

$ErrorActionPreference = "Stop"

function Invoke-Step {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Command
  )

  Invoke-Expression $Command
  if ($LASTEXITCODE -ne 0) {
    throw "Falló comando: $Command"
  }
}

$root = Split-Path -Parent $PSScriptRoot
$envTestPath = Join-Path $root ".env.test"
$envLocalPath = Join-Path $root ".env.local"
$envBackupPath = Join-Path $root ".env.local.backup.test"

if (-not (Test-Path $envTestPath)) {
  throw "No existe .env.test en la raíz del proyecto."
}

$hadEnvLocal = Test-Path $envLocalPath
if ($hadEnvLocal) {
  Copy-Item $envLocalPath $envBackupPath -Force
}

Copy-Item $envTestPath $envLocalPath -Force

try {
  Push-Location $root

  if ($Only -eq "all" -or $Only -eq "hosting") {
    Write-Host "[TEST] Build estático para Hosting..."
    $env:NEXT_EXPORT = "true"
    Invoke-Step "npm run build"
    Remove-Item Env:NEXT_EXPORT -ErrorAction SilentlyContinue
  }

  if ($Only -eq "all") {
    Write-Host "[TEST] Deploy completo (hosting, functions, firestore)..."
    Invoke-Step "firebase deploy --project $ProjectAlias --only 'hosting,functions'"
    Invoke-Step "firebase deploy --project $ProjectAlias --config firebase.test.json --only 'firestore:rules,firestore:indexes'"
  }
  elseif ($Only -eq "hosting") {
    Write-Host "[TEST] Deploy de Hosting..."
    Invoke-Step "firebase deploy --project $ProjectAlias --only 'hosting'"
  }
  elseif ($Only -eq "functions") {
    Write-Host "[TEST] Deploy de Functions..."
    Invoke-Step "firebase deploy --project $ProjectAlias --only 'functions'"
  }
  elseif ($Only -eq "rules") {
    Write-Host "[TEST] Deploy de reglas e índices..."
    Invoke-Step "firebase deploy --project $ProjectAlias --config firebase.test.json --only 'firestore:rules,firestore:indexes'"
  }

  Write-Host "[TEST] Deploy finalizado."
  Write-Host "[TEST] URL esperada de Hosting: https://pizzeria-palermo-test-20260401.web.app"
}
finally {
  if ($hadEnvLocal) {
    Move-Item -Force $envBackupPath $envLocalPath
  }
  else {
    if (Test-Path $envLocalPath) {
      Remove-Item $envLocalPath -Force
    }
    if (Test-Path $envBackupPath) {
      Remove-Item $envBackupPath -Force
    }
  }

  Pop-Location
}

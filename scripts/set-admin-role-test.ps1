param(
  [Parameter(Mandatory = $true)]
  [string]$Email,
  [ValidateSet("admin", "staff", "customer")]
  [string]$Role = "admin",
  [string]$ProjectId = "pizzeria-palermo-test-20260401",
  [string]$ApiKey = "AIzaSyDZaMqna4HH7Re2b6wgTbqV4jR1CCR9nj8",
  [string]$TempPassword = "PalermoTest#2026"
)

$ErrorActionPreference = "Stop"

function Get-AccessToken {
  $token = (gcloud auth print-access-token).Trim()
  if (-not $token) {
    throw "No se pudo obtener access token de gcloud. Ejecuta 'gcloud auth login' primero."
  }
  return $token
}

function Invoke-GoogleApi {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Method,
    [Parameter(Mandatory = $true)]
    [string]$Uri,
    [Parameter(Mandatory = $true)]
    [string]$Token,
    [object]$Body
  )

  $headers = @{ Authorization = "Bearer $Token" }
  if ($null -ne $Body) {
    $json = $Body | ConvertTo-Json -Depth 20
    return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $headers -ContentType "application/json" -Body $json
  }

  return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $headers
}

Write-Output "[TEST-ADMIN] Proyecto: $ProjectId"
Write-Output "[TEST-ADMIN] Buscando usuario: $Email"

$token = Get-AccessToken

$uid = $null

# 1) Buscar UID por email en Firebase Auth (proyecto TEST)
$lookupUri = "https://identitytoolkit.googleapis.com/v1/projects/$ProjectId/accounts:lookup"
$lookupBody = @{ email = @($Email) }
$lookupOk = $true
try {
  $lookupResp = Invoke-GoogleApi -Method "POST" -Uri $lookupUri -Token $token -Body $lookupBody
  if ($lookupResp.users -and $lookupResp.users.Count -gt 0) {
    $uid = $lookupResp.users[0].localId
    Write-Output "[TEST-ADMIN] UID encontrado en Auth: $uid"
  }
} catch {
  $lookupOk = $false
  Write-Output "[TEST-ADMIN] Aviso: no se pudo consultar Auth API (continuando con Firestore)."
}

# 2) Si no hay UID, buscar en Firestore users por email
if (-not $uid) {
  # Si no existe, crearlo en Auth con password temporal
  Write-Output "[TEST-ADMIN] Usuario no encontrado, creando usuario Auth en TEST..."
  $signUpUri = "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=$ApiKey"
  $signUpBody = @{
    email = $Email
    password = $TempPassword
    returnSecureToken = $false
  }

  try {
    $signUpResp = Invoke-RestMethod -Method "POST" -Uri $signUpUri -ContentType "application/json" -Body ($signUpBody | ConvertTo-Json -Depth 10)
    $uid = $signUpResp.localId
    Write-Output "[TEST-ADMIN] Usuario creado en Auth. UID: $uid"
    Write-Output "[TEST-ADMIN] Password temporal: $TempPassword"
  } catch {
    throw "No se pudo crear usuario en Auth TEST. Si ya existe, inicia sesión una vez en TEST y reintenta."
  }
}

# 3) Intentar asignar custom claim role en Auth (best effort)
if ($lookupOk) {
  try {
    $claimsJson = ('{"role":"{0}"}' -f $Role)
    $updateAuthUri = "https://identitytoolkit.googleapis.com/v1/projects/$ProjectId/accounts:update"
    $updateAuthBody = @{
      localId = $uid
      customAttributes = $claimsJson
    }
    Invoke-GoogleApi -Method "POST" -Uri $updateAuthUri -Token $token -Body $updateAuthBody | Out-Null
    Write-Output "[TEST-ADMIN] Custom claim asignado: role=$Role"
  } catch {
    Write-Output "[TEST-ADMIN] Aviso: no se pudo asignar custom claim (continuando)."
  }
}

# 4) Reflejar rol en Firestore users/{uid}
$firestoreUri = "https://firestore.googleapis.com/v1/projects/$ProjectId/databases/(default)/documents/users/$uid"
$firestoreBody = @{
  fields = @{
    role = @{ stringValue = $Role }
    email = @{ stringValue = $Email }
    updatedAt = @{ timestampValue = (Get-Date).ToUniversalTime().ToString("o") }
  }
}

Invoke-GoogleApi -Method "PATCH" -Uri $firestoreUri -Token $token -Body $firestoreBody | Out-Null
Write-Output "[TEST-ADMIN] Firestore actualizado: users/$uid"

Write-Output "[TEST-ADMIN] OK: rol '$Role' asignado a $Email en TEST."
Write-Output "[TEST-ADMIN] IMPORTANTE: cierra sesión y vuelve a entrar para refrescar el token."

$ErrorActionPreference='Stop'
$src='pizzeria-palermo-17f6d'
$dst='pizzeria-palermo-test-20260401'
$token = gcloud auth print-access-token
$headers=@{ Authorization = "Bearer $token" }

function Get-AllDocs {
  param([string]$project,[string]$collection,[hashtable]$headers)
  $all=@()
  $pageToken=$null
  do {
    $url="https://firestore.googleapis.com/v1/projects/$project/databases/(default)/documents/$collection?pageSize=200"
    if($pageToken){ $url += "&pageToken=$pageToken" }
    $resp=Invoke-RestMethod -Method Get -Uri $url -Headers $headers -TimeoutSec 120
    if($resp.documents){ $all += $resp.documents }
    $pageToken=$resp.nextPageToken
  } while ($pageToken)
  return $all
}

$docs = Get-AllDocs -project $src -collection 'items_menu' -headers $headers
Write-Output ("SOURCE_ITEMS=" + $docs.Count)
if($docs.Count -eq 0){ throw 'No se encontraron documentos en items_menu de origen.' }

$copied=0
foreach($d in $docs){
  $parts = $d.name -split '/documents/items_menu/'
  if($parts.Count -lt 2){ continue }
  $docId = $parts[1]
  $targetUrl = "https://firestore.googleapis.com/v1/projects/$dst/databases/(default)/documents/items_menu/$docId"
  $body = @{ fields = $d.fields } | ConvertTo-Json -Depth 100
  Invoke-RestMethod -Method Patch -Uri $targetUrl -Headers $headers -ContentType 'application/json' -Body $body -TimeoutSec 120 | Out-Null
  $copied++
}

try {
  $settingsUrl = "https://firestore.googleapis.com/v1/projects/$src/databases/(default)/documents/settings/precios_configuracion"
  $settings = Invoke-RestMethod -Method Get -Uri $settingsUrl -Headers $headers -TimeoutSec 120
  if($settings.fields){
    $settingsTarget = "https://firestore.googleapis.com/v1/projects/$dst/databases/(default)/documents/settings/precios_configuracion"
    $settingsBody = @{ fields = $settings.fields } | ConvertTo-Json -Depth 100
    Invoke-RestMethod -Method Patch -Uri $settingsTarget -Headers $headers -ContentType 'application/json' -Body $settingsBody -TimeoutSec 120 | Out-Null
    Write-Output 'COPIED_SETTINGS_PRECIOS_CONFIG=1'
  }
} catch {
  Write-Output 'COPIED_SETTINGS_PRECIOS_CONFIG=0'
}

Write-Output ("COPIED_ITEMS=" + $copied)

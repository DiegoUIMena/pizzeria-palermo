$ErrorActionPreference='Stop'
$source='pizzeria-palermo-17f6d'
$target='pizzeria-palermo-test-20260401'
$token=(gcloud auth print-access-token).Trim()
$headers=@{Authorization="Bearer $token"}

function QueryCollection([string]$project,[string]$collection){
  $uri="https://firestore.googleapis.com/v1/projects/$project/databases/(default)/documents:runQuery"
  $body=(@{structuredQuery=@{from=@(@{collectionId=$collection})}} | ConvertTo-Json -Depth 50)
  $resp=Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -ContentType 'application/json' -Body $body
  return @($resp | Where-Object { $_.document } | ForEach-Object { $_.document })
}

function UpsertDoc([string]$sourceProject,[string]$targetProject,[object]$doc){
  $prefix="projects/$sourceProject/databases/(default)/documents/"
  $rel=$doc.name.Substring($prefix.Length)
  $uri="https://firestore.googleapis.com/v1/projects/$targetProject/databases/(default)/documents/$rel"
  $body=(@{fields=$doc.fields} | ConvertTo-Json -Depth 100)
  Invoke-RestMethod -Method Patch -Uri $uri -Headers $headers -ContentType 'application/json' -Body $body | Out-Null
}

$collections=@('items_menu','ingredientes','categorias_menu','tenants','delivery-zones','settings')
foreach($c in $collections){
  Write-Output "[SYNC] Colección $c..."
  $docs=QueryCollection -project $source -collection $c
  Write-Output ("[SYNC]   origen: "+$docs.Count)
  foreach($d in $docs){ UpsertDoc -sourceProject $source -targetProject $target -doc $d }
  $check=QueryCollection -project $target -collection $c
  Write-Output ("[SYNC]   test: "+$check.Count)
}
Write-Output '[SYNC] DONE'

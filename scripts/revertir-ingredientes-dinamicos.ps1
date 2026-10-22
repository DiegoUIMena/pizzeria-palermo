# Script de Reverso Automático a la versión previa a Ingredientes Dinámicos
Write-Host "🔄 Iniciando reverso del sistema..." -ForegroundColor Cyan

# 1. Restaurar archivos desde la carpeta de backup
Copy-Item -Recurse -Force "backups\pre-ingredientes-dinamicos-backup\inventario" "app\admin\"
Copy-Item -Recurse -Force "backups\pre-ingredientes-dinamicos-backup\ventas-presencial" "app\admin\"
Copy-Item -Recurse -Force "backups\pre-ingredientes-dinamicos-backup\armar-pizza-nueva" "app\"
Copy-Item -Force "backups\pre-ingredientes-dinamicos-backup\inventory.ts" "lib\"
Copy-Item -Force "backups\pre-ingredientes-dinamicos-backup\inventory-service.ts" "lib\"
Copy-Item -Force "backups\pre-ingredientes-dinamicos-backup\pricing.service.ts" "functions\src\services\"
Copy-Item -Force "backups\pre-ingredientes-dinamicos-backup\inventory.service.ts" "functions\src\services\"
Copy-Item -Force "backups\pre-ingredientes-dinamicos-backup\orders.ts" "functions\src\types\"

Write-Host "✅ Archivos de código restaurados al estado anterior." -ForegroundColor Green

# 2. Compilar funciones
Write-Host "🔨 Recompilando Cloud Functions..." -ForegroundColor Yellow
Set-Location "functions"
npm run build
Set-Location ".."

# 3. Desplegar funciones
Write-Host "🚀 Desplegando createOrder a Firebase..." -ForegroundColor Yellow
npx firebase deploy --only functions:createOrder

Write-Host "🎉 ¡Reverso completado exitosamente!" -ForegroundColor Green

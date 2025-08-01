@echo off
echo === VERIFICADOR DE ZONAS DE DELIVERY ===
echo.

REM Cargar variables de entorno si es necesario
if exist .env.local (
    echo Cargando variables de entorno desde .env.local...
    for /f "tokens=*" %%a in (.env.local) do (
        set "%%a"
    )
    echo Variables cargadas correctamente.
)

if exist .env (
    echo Cargando variables de entorno desde .env...
    for /f "tokens=*" %%a in (.env) do (
        set "%%a"
    )
    echo Variables cargadas correctamente.
)

echo.
echo Ejecutando verificacion de zonas...
echo.

IF EXIST debug-delivery-zones.js (
    echo Ejecutando debug-delivery-zones.js...
    node debug-delivery-zones.js
) ELSE IF EXIST check-zones-initialization.js (
    echo Ejecutando check-zones-initialization.js...
    node check-zones-initialization.js
) ELSE (
    echo No se encontro ningun script de verificacion de zonas.
    exit /b 1
)

echo.
echo === VERIFICACION COMPLETADA ===
echo Si no viste errores, significa que las zonas se eliminaron correctamente.
echo Puedes crear tus propias zonas de delivery desde la pagina de administracion.
pause

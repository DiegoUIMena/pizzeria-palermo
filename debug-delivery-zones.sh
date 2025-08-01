#!/bin/bash

# Script para ejecutar el depurador de zonas de delivery
echo "=== Ejecutando depurador de zonas de delivery ==="

# Cargar variables de entorno desde el archivo .env
if [ -f .env ]; then
  export $(cat .env | xargs)
  echo "Variables de entorno cargadas desde .env"
else
  echo "No se encontró archivo .env, asegúrate de tener configuradas las variables de entorno"
fi

# Ejecutar el script de depuración
node debug-delivery-zones.js

echo "=== Fin del depurador ==="

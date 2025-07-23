#!/bin/bash

# Instalar Firebase CLI si no está instalado
if ! command -v firebase &> /dev/null; then
    echo "Firebase CLI no está instalado. Instalando..."
    npm install -g firebase-tools
fi

# Iniciar sesión en Firebase (si no has iniciado sesión)
echo "Iniciando sesión en Firebase..."
firebase login

# Inicializar Firebase si es necesario (solo si no existe firebase.json)
if [ ! -f firebase.json ]; then
    echo "Inicializando Firebase..."
    firebase init firestore
fi

# Desplegar las reglas de Firestore
echo "Desplegando reglas de Firestore..."
firebase deploy --only firestore:rules

echo "Las reglas se han desplegado correctamente."

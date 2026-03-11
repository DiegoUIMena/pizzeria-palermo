// Script para forzar recarga de configuración
// Ejecutar en la consola del navegador (F12 → Console)

console.log('🧹 Limpiando caché...');

// Limpiar caché de horarios
localStorage.removeItem('business_hours_cache');

// Forzar recarga de configuración
localStorage.setItem('force_reload_timestamp', Date.now().toString());

console.log('✅ Caché limpiado');
console.log('🔄 Recarga la página (F5 o Ctrl+R) para ver el banner');

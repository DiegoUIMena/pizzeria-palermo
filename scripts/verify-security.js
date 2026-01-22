/**
 * Script de Verificación de Seguridad
 * Pizzería Palermo - Fase 1
 * 
 * Este script verifica que todas las medidas de seguridad estén implementadas correctamente.
 */

const fs = require('fs');
const path = require('path');

console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║          🔐 Verificación de Seguridad - Fase 1 🔐             ║
║                    Pizzería Palermo                            ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
`);

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;
const warnings = [];

function checkPassed(message) {
  console.log(`✅ ${message}`);
  totalChecks++;
  passedChecks++;
}

function checkFailed(message, suggestion = '') {
  console.log(`❌ ${message}`);
  if (suggestion) {
    warnings.push({ message, suggestion });
  }
  totalChecks++;
  failedChecks++;
}

function checkWarning(message, suggestion = '') {
  console.log(`⚠️  ${message}`);
  if (suggestion) {
    warnings.push({ message, suggestion });
  }
}

console.log('\n📋 Verificando archivos de configuración...\n');

// 1. Verificar .gitignore
try {
  const gitignorePath = path.join(__dirname, '../.gitignore');
  const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
  
  if (gitignoreContent.includes('serviceAccountKey.json')) {
    checkPassed('.gitignore contiene serviceAccountKey.json');
  } else {
    checkFailed('.gitignore NO contiene serviceAccountKey.json', 
      'Agrega "serviceAccountKey.json" a tu .gitignore');
  }
} catch (error) {
  checkFailed('No se pudo leer .gitignore', 'Crea un archivo .gitignore en la raíz');
}

// 2. Verificar que serviceAccountKey.json existe
try {
  const keyPath = path.join(__dirname, '../serviceAccountKey.json');
  if (fs.existsSync(keyPath)) {
    checkPassed('serviceAccountKey.json existe');
    
    // Verificar que no es el ejemplo
    const keyContent = fs.readFileSync(keyPath, 'utf8');
    if (keyContent.includes('REEMPLAZAR')) {
      checkFailed('serviceAccountKey.json es el archivo de ejemplo',
        'Descarga las credenciales reales desde Firebase Console');
    } else {
      checkPassed('serviceAccountKey.json contiene credenciales reales');
    }
  } else {
    checkFailed('serviceAccountKey.json NO existe',
      'Descarga las credenciales desde Firebase Console');
  }
} catch (error) {
  checkFailed('Error al verificar serviceAccountKey.json');
}

// 3. Verificar Firestore Rules
console.log('\n📋 Verificando Firestore Rules...\n');
try {
  const rulesPath = path.join(__dirname, '../firestore.rules');
  const rulesContent = fs.readFileSync(rulesPath, 'utf8');
  
  if (rulesContent.includes('match /{document=**}') && 
      rulesContent.includes('allow read, write: if true') &&
      !rulesContent.includes('// match /{document=**}')) {
    checkFailed('Firestore Rules contienen regla abierta {document=**}',
      'Comenta o elimina la regla "match /{document=**} { allow read, write: if true }"');
  } else {
    checkPassed('No se encontró regla abierta {document=**}');
  }
  
  if (rulesContent.includes('function isAdmin()')) {
    checkPassed('Función isAdmin() definida');
  } else {
    checkWarning('No se encontró función isAdmin()',
      'Asegúrate de que las reglas tengan la función auxiliar isAdmin()');
  }
  
  if (rulesContent.includes('match /orders/')) {
    checkPassed('Reglas para orders definidas');
  } else {
    checkFailed('No se encontraron reglas para orders');
  }
  
  if (rulesContent.includes('match /users/')) {
    checkPassed('Reglas para users definidas');
  } else {
    checkFailed('No se encontraron reglas para users');
  }
  
} catch (error) {
  checkFailed('Error al verificar firestore.rules');
}

// 4. Verificar Middleware
console.log('\n📋 Verificando Middleware de protección...\n');
try {
  const middlewarePath = path.join(__dirname, '../middleware.ts');
  const middlewareContent = fs.readFileSync(middlewarePath, 'utf8');
  
  if (middlewareContent.includes('/admin')) {
    checkPassed('Middleware protege rutas /admin');
  } else {
    checkWarning('Middleware no parece proteger rutas /admin',
      'Verifica que el middleware intercepte peticiones a /admin/*');
  }
} catch (error) {
  checkWarning('No se pudo verificar middleware.ts', 
    'Asegúrate de que middleware.ts esté en la raíz del proyecto');
}

// 5. Verificar Admin Layout
console.log('\n📋 Verificando protección en Admin Layout...\n');
try {
  const layoutPath = path.join(__dirname, '../app/admin/layout.tsx');
  const layoutContent = fs.readFileSync(layoutPath, 'utf8');
  
  if (layoutContent.includes('useAuth')) {
    checkPassed('Admin Layout usa useAuth()');
  } else {
    checkFailed('Admin Layout NO usa useAuth()',
      'Importa y usa useAuth() para verificar roles');
  }
  
  if (layoutContent.includes('role') && layoutContent.includes('admin')) {
    checkPassed('Admin Layout verifica rol de admin');
  } else {
    checkFailed('Admin Layout NO verifica rol de admin',
      'Agrega verificación: if (user?.role !== "admin") { router.push("/") }');
  }
  
  if (layoutContent.includes('router.push')) {
    checkPassed('Admin Layout redirige usuarios no autorizados');
  } else {
    checkWarning('Admin Layout no parece redirigir usuarios no autorizados');
  }
} catch (error) {
  checkFailed('Error al verificar app/admin/layout.tsx');
}

// 6. Verificar AuthContext lee custom claims
console.log('\n📋 Verificando AuthContext...\n');
try {
  const authPath = path.join(__dirname, '../app/context/AuthContext.tsx');
  const authContent = fs.readFileSync(authPath, 'utf8');
  
  if (authContent.includes('getIdTokenResult')) {
    checkPassed('AuthContext lee custom claims del token');
  } else {
    checkWarning('AuthContext no parece leer custom claims',
      'Usa firebaseUser.getIdTokenResult() para obtener claims');
  }
  
  if (authContent.includes('tokenResult.claims.role')) {
    checkPassed('AuthContext extrae rol de custom claims');
  } else {
    checkWarning('AuthContext no extrae rol de custom claims');
  }
} catch (error) {
  checkFailed('Error al verificar AuthContext.tsx');
}

// 7. Verificar script de roles
console.log('\n📋 Verificando script de gestión de roles...\n');
try {
  const scriptPath = path.join(__dirname, 'set-admin-role.js');
  if (fs.existsSync(scriptPath)) {
    checkPassed('Script set-admin-role.js existe');
  } else {
    checkFailed('Script set-admin-role.js NO existe',
      'Crea el script para asignar roles de admin');
  }
} catch (error) {
  checkFailed('Error al verificar script de roles');
}

// Resumen
console.log('\n' + '='.repeat(70));
console.log(`\n📊 RESUMEN DE VERIFICACIÓN\n`);
console.log(`Total de verificaciones: ${totalChecks}`);
console.log(`✅ Pasadas: ${passedChecks}`);
console.log(`❌ Falladas: ${failedChecks}`);

if (passedChecks === totalChecks) {
  console.log(`\n🎉 ¡EXCELENTE! Todas las verificaciones pasaron.`);
  console.log(`\n✅ Tu aplicación tiene las medidas de seguridad básicas implementadas.`);
} else {
  const percentage = Math.round((passedChecks / totalChecks) * 100);
  console.log(`\n⚠️  Porcentaje de seguridad: ${percentage}%`);
  
  if (failedChecks > 0) {
    console.log(`\n❌ ${failedChecks} verificaciones fallaron. Revisa las sugerencias abajo.`);
  }
}

// Mostrar advertencias y sugerencias
if (warnings.length > 0) {
  console.log('\n' + '='.repeat(70));
  console.log(`\n💡 SUGERENCIAS DE MEJORA:\n`);
  warnings.forEach((warning, index) => {
    console.log(`${index + 1}. ${warning.message}`);
    console.log(`   → ${warning.suggestion}\n`);
  });
}

// Pasos siguientes
console.log('\n' + '='.repeat(70));
console.log(`\n🚀 PRÓXIMOS PASOS:\n`);
console.log(`1. Despliega las Firestore Rules:`);
console.log(`   firebase deploy --only firestore:rules\n`);
console.log(`2. Rota credenciales si el repo es público:`);
console.log(`   - Ve a Firebase Console > Service Accounts`);
console.log(`   - Genera nueva clave privada`);
console.log(`   - Elimina la clave antigua\n`);
console.log(`3. Crea tu primer usuario admin:`);
console.log(`   node scripts/set-admin-role.js tu@email.com\n`);
console.log(`4. Prueba accediendo a /admin sin ser admin (debe redirigir)\n`);
console.log(`5. Prueba accediendo a /admin siendo admin (debe permitir)\n`);

console.log('='.repeat(70) + '\n');

process.exit(failedChecks > 0 ? 1 : 0);

/**
 * Script para Asignar Rol de Administrador
 * 
 * Este script usa Firebase Admin SDK para asignar custom claims
 * a usuarios específicos, dándoles permisos de administrador.
 * 
 * USO:
 * 1. Asegúrate de tener serviceAccountKey.json actualizado
 * 2. Ejecuta: node scripts/set-admin-role.js <email-del-usuario>
 * 
 * Ejemplo:
 * node scripts/set-admin-role.js admin@pizzeriapalermo.cl
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

// Inicializar Firebase Admin si no está inicializado
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const auth = admin.auth();

/**
 * Asignar rol de administrador a un usuario
 * @param {string} email - Email del usuario
 * @param {string} role - Rol a asignar ('admin', 'staff', 'customer')
 */
async function setUserRole(email, role = 'admin') {
  try {
    console.log(`\n🔍 Buscando usuario con email: ${email}...`);
    
    // 1. Obtener el usuario por email
    const user = await auth.getUserByEmail(email);
    console.log(`✅ Usuario encontrado: ${user.displayName || 'Sin nombre'} (UID: ${user.uid})`);
    
    // 2. Asignar custom claim con el rol
    await auth.setCustomUserClaims(user.uid, { role });
    console.log(`✅ Custom claim asignado: role="${role}"`);
    
    // 3. Actualizar también en Firestore para consistencia
    await db.collection('users').doc(user.uid).set({
      role: role,
      email: email,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    console.log(`✅ Documento de Firestore actualizado`);
    
    // 4. Mostrar información del custom claim
    const updatedUser = await auth.getUser(user.uid);
    console.log('\n📋 Custom Claims actuales:');
    console.log(JSON.stringify(updatedUser.customClaims, null, 2));
    
    console.log('\n✅ COMPLETADO: El usuario ahora es ' + role.toUpperCase());
    console.log('\n⚠️  IMPORTANTE: El usuario debe cerrar sesión y volver a iniciar sesión');
    console.log('   para que el nuevo rol tome efecto en el token JWT.\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    
    if (error.code === 'auth/user-not-found') {
      console.log('\n💡 Sugerencia: Verifica que el email sea correcto y que el usuario');
      console.log('   se haya registrado en la aplicación.\n');
    }
    
    process.exit(1);
  }
}

/**
 * Listar todos los usuarios y sus roles
 */
async function listAllUsers() {
  try {
    console.log('\n📋 Listando todos los usuarios y sus roles:\n');
    
    const listUsersResult = await auth.listUsers();
    
    if (listUsersResult.users.length === 0) {
      console.log('No hay usuarios registrados.\n');
      process.exit(0);
    }
    
    for (const user of listUsersResult.users) {
      const role = user.customClaims?.role || 'customer';
      const name = user.displayName || 'Sin nombre';
      
      console.log(`- ${user.email}`);
      console.log(`  Nombre: ${name}`);
      console.log(`  UID: ${user.uid}`);
      console.log(`  Rol: ${role}`);
      console.log(`  Creado: ${new Date(user.metadata.creationTime).toLocaleDateString('es-CL')}`);
      console.log('');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// ============================================
// EJECUTAR SCRIPT
// ============================================
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║           🔐 Script de Gestión de Roles - Admin 🔐            ║
║                    Pizzería Palermo                            ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝

USO:

  1. Asignar rol de ADMIN a un usuario:
     node scripts/set-admin-role.js <email>
     
     Ejemplo:
     node scripts/set-admin-role.js admin@pizzeriapalermo.cl

  2. Asignar rol de STAFF:
     node scripts/set-admin-role.js <email> staff
     
  3. Listar todos los usuarios:
     node scripts/set-admin-role.js --list

ROLES DISPONIBLES:
  - admin:    Acceso completo al panel administrativo
  - staff:    Acceso a pedidos y operaciones básicas
  - customer: Usuario normal (por defecto)

`);
  process.exit(0);
}

if (args[0] === '--list') {
  listAllUsers();
} else {
  const email = args[0];
  const role = args[1] || 'admin';
  
  if (!['admin', 'staff', 'customer'].includes(role)) {
    console.error('\n❌ Error: Rol inválido. Debe ser "admin", "staff" o "customer"\n');
    process.exit(1);
  }
  
  setUserRole(email, role);
}

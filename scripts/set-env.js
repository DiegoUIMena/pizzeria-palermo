const fs = require('fs');
const path = require('path');

const env = process.argv[2];

if (!env || (env !== 'development' && env !== 'production')) {
  console.error('❌ Especifica el entorno: "development" o "production"');
  process.exit(1);
}

const rootDir = path.join(__dirname, '..');
const srcRootEnv = path.join(rootDir, `.env.${env}`);
const destRootEnv = path.join(rootDir, '.env.local');

const srcFuncEnv = path.join(rootDir, `functions/.env.${env}`);
const destFuncEnv = path.join(rootDir, 'functions/.env');

try {
  // 1. Copiar entorno Frontend
  if (!fs.existsSync(srcRootEnv)) {
    console.error(`❌ El archivo de origen para frontend ${srcRootEnv} no existe.`);
    process.exit(1);
  }
  fs.copyFileSync(srcRootEnv, destRootEnv);
  console.log(`✅ Frontend: Cambiado a [${env.toUpperCase()}] (copiado a .env.local)`);

  // 2. Copiar entorno Backend (Functions)
  if (!fs.existsSync(srcFuncEnv)) {
    console.error(`❌ El archivo de origen para backend ${srcFuncEnv} no existe.`);
    process.exit(1);
  }
  fs.copyFileSync(srcFuncEnv, destFuncEnv);
  console.log(`✅ Backend (Functions): Cambiado a [${env.toUpperCase()}] (copiado a functions/.env)`);
  
  console.log(`\n🎉 Entorno global cambiado exitosamente a: [${env.toUpperCase()}]\n`);
} catch (error) {
  console.error('❌ Error al alternar variables de entorno:', error);
  process.exit(1);
}

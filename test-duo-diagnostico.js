// Script de diagnóstico para la búsqueda de pizzas
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCVKPmInym85FO89UhVQNsGzBeeqZ0wmFM",
  authDomain: "pizzeria-palermo-17f6d.firebaseapp.com",
  projectId: "pizzeria-palermo-17f6d",
  storageBucket: "pizzeria-palermo-17f6d.appspot.com", 
  messagingSenderId: "648738451663",
  appId: "1:648738451663:web:4069b7fa6cd5d1a1a487ba",
  measurementId: "G-N89WX0NQJG"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function diagnoseSearch() {
  try {
    console.log('Iniciando diagnóstico de búsqueda de pizzas...');
    
    // Cargar datos del menú
    const itemsMenuSnap = await getDocs(collection(db, 'items_menu'));
    const itemsMenuDocs = [];
    itemsMenuSnap.forEach(d => itemsMenuDocs.push({ id: d.id, ...(d.data() || {}) }));
    
    console.log(`Se encontraron ${itemsMenuDocs.length} pizzas en el menú.`);
    
    // Mostrar las primeras 15 pizzas para verificar
    console.log('\nListado de pizzas disponibles en el menú:');
    itemsMenuDocs.slice(0, 15).forEach((pizza, idx) => {
      console.log(`${idx + 1}. ${pizza.nombre || pizza.name || 'Sin nombre'}`);
    });
    
    // Probar búsqueda específica
    const pizzasDePrueba = ['Napolitana', 'Del Pibe', 'Cuatro Quesos', 'Vegetariana'];
    
    for (const pizzaName of pizzasDePrueba) {
      console.log(`\n--- Buscando pizza: '${pizzaName}' ---`);
      
      // Función para normalizar texto
      const norm = (s) => s ? s.toLowerCase().replace(/[^a-z0-9ñáéíóúü ]+/gi, '').trim() : '';
      
      // 1. Búsqueda exacta
      let match = itemsMenuDocs.find(i => norm(i.nombre || i.name || '') === norm(pizzaName));
      if (match) console.log(`✓ Encontrada por coincidencia exacta: ${match.nombre || match.name}`);
      
      // 2. Búsqueda por palabras clave
      if (!match) {
        const keywords = pizzaName.split(' ').filter(word => 
          word.length > 2 && !['con', 'los', 'las', 'del', 'de', 'la', 'el', 'y'].includes(word.toLowerCase())
        );
        
        if (keywords.length > 0) {
          console.log(`Buscando por palabras clave: ${keywords.join(', ')}`);
          match = itemsMenuDocs.find(i => {
            const menuItemName = norm(i.nombre || i.name || '');
            return keywords.every(word => menuItemName.includes(norm(word)));
          });
          if (match) console.log(`✓ Encontrada por palabras clave: ${match.nombre || match.name}`);
        }
      }
      
      // 3. Búsqueda por coincidencia parcial
      if (!match) {
        match = itemsMenuDocs.find(i => {
          const menuItemName = norm(i.nombre || i.name || '');
          return menuItemName.includes(norm(pizzaName)) || norm(pizzaName).includes(menuItemName);
        });
        if (match) console.log(`✓ Encontrada por coincidencia parcial: ${match.nombre || match.name}`);
      }
      
      // Verificar receta
      if (match) {
        console.log(`Resultado final: Encontrada pizza '${pizzaName}' => ${match.nombre || match.name}`);
        
        // Verificar si tiene receta
        if (match.receta && Array.isArray(match.receta) && match.receta.length > 0) {
          console.log(`   Tiene receta FAMILIAR con ${match.receta.length} ingredientes`);
          // Mostrar primeros ingredientes
          match.receta.slice(0, 3).forEach(ing => {
            console.log(`    - ${ing.nombre || ing.name || 'sin nombre'}: ${ing.cantidad || 0}`);
          });
        } else {
          console.log(`   No tiene receta FAMILIAR`);
        }
        
        if (match.recetaMediana && Array.isArray(match.recetaMediana) && match.recetaMediana.length > 0) {
          console.log(`   Tiene receta MEDIANA con ${match.recetaMediana.length} ingredientes`);
        } else {
          console.log(`   No tiene receta MEDIANA`);
        }
        
      } else {
        console.log(`❌ No se pudo encontrar la pizza '${pizzaName}'`);
        
        // Mostrar pizzas con nombres similares para diagnóstico
        const similarPizzas = itemsMenuDocs
          .filter(i => {
            const name = norm(i.nombre || i.name || '');
            return name.includes(norm(pizzaName.substring(0, 3))) || 
                   pizzaName.split(' ').some(word => name.includes(norm(word)));
          })
          .map(i => i.nombre || i.name);
        
        if (similarPizzas.length > 0) {
          console.log(`   Pizzas con nombres similares: ${similarPizzas.slice(0, 5).join(', ')}`);
        }
      }
    }
    
    // Probar un caso específico de Pizza Duo
    console.log('\n\n======= DIAGNÓSTICO ESPECÍFICO PIZZA DUO =======');
    console.log('Buscando: "Duo: Napolitana / Del Pibe"');
    
    // Extraer los nombres de pizza del formato Duo
    const duoString = "Duo: Napolitana / Del Pibe";
    const duoPattern = /duo:?\s*([^/]+)\s*\/\s*([^/]+)/i;
    const duoMatch = duoString.match(duoPattern);
    
    if (duoMatch) {
      const pizza1Name = duoMatch[1].trim();
      const pizza2Name = duoMatch[2].trim();
      console.log(`Pizza 1: "${pizza1Name}"`);
      console.log(`Pizza 2: "${pizza2Name}"`);
      
      // Buscar ambas pizzas
      console.log('\nBuscando Pizza 1:');
      const pizza1 = findPizzaByName(itemsMenuDocs, pizza1Name);
      
      console.log('\nBuscando Pizza 2:');
      const pizza2 = findPizzaByName(itemsMenuDocs, pizza2Name);
      
      if (pizza1 && pizza2) {
        console.log('\n✓ Ambas pizzas encontradas!');
        console.log('\nAnalizando recetas de ambas pizzas (tamaño FAMILIAR):');
        
        if (pizza1.receta && pizza2.receta) {
          // Analizar ingredientes comunes
          const ingredients1 = new Map();
          const ingredients2 = new Map();
          
          // Recopilar ingredientes de la primera pizza
          pizza1.receta.forEach(ing => {
            const key = ing.nombre || ing.name;
            ingredients1.set(key, ing.cantidad || 0);
          });
          
          // Recopilar ingredientes de la segunda pizza
          pizza2.receta.forEach(ing => {
            const key = ing.nombre || ing.name;
            ingredients2.set(key, ing.cantidad || 0);
          });
          
          // Identificar ingredientes comunes
          const commonIngredients = [];
          const onlyPizza1 = [];
          const onlyPizza2 = [];
          
          // Procesar ingredientes de pizza1
          for (const [name, amount] of ingredients1.entries()) {
            if (ingredients2.has(name)) {
              commonIngredients.push({ name, amount1: amount, amount2: ingredients2.get(name) });
            } else {
              onlyPizza1.push({ name, amount });
            }
          }
          
          // Procesar ingredientes únicos de pizza2
          for (const [name, amount] of ingredients2.entries()) {
            if (!ingredients1.has(name)) {
              onlyPizza2.push({ name, amount });
            }
          }
          
          // Mostrar resultados
          console.log('\nIngredientes comunes:');
          commonIngredients.forEach(({ name, amount1, amount2 }) => {
            console.log(`  - ${name}: Pizza1=${amount1}, Pizza2=${amount2}, Promedio=${(amount1 + amount2) / 2}`);
          });
          
          console.log('\nIngredientes solo de Pizza1:');
          onlyPizza1.forEach(({ name, amount }) => {
            console.log(`  - ${name}: ${amount / 2} (mitad)`);
          });
          
          console.log('\nIngredientes solo de Pizza2:');
          onlyPizza2.forEach(({ name, amount }) => {
            console.log(`  - ${name}: ${amount / 2} (mitad)`);
          });
          
          console.log('\nReceta combinada:');
          // Suma ingredientes comunes (promediados) y no comunes (mitad)
          const combinedRecipe = [];
          
          // Agregar ingredientes comunes (promediados)
          commonIngredients.forEach(({ name, amount1, amount2 }) => {
            combinedRecipe.push({ 
              name, 
              original1: amount1,
              original2: amount2,
              cantidad: (amount1 + amount2) / 2,
              fuente: 'común'
            });
          });
          
          // Agregar ingredientes únicos de pizza1 (mitad)
          onlyPizza1.forEach(({ name, amount }) => {
            combinedRecipe.push({ 
              name, 
              original: amount,
              cantidad: amount / 2,
              fuente: 'pizza1'
            });
          });
          
          // Agregar ingredientes únicos de pizza2 (mitad)
          onlyPizza2.forEach(({ name, amount }) => {
            combinedRecipe.push({ 
              name, 
              original: amount,
              cantidad: amount / 2,
              fuente: 'pizza2'
            });
          });
          
          // Mostrar receta combinada
          combinedRecipe.forEach(ing => {
            let detalles = '';
            if (ing.fuente === 'común') {
              detalles = `(común: ${ing.original1}+${ing.original2} → promedio)`;
            } else {
              detalles = `(${ing.fuente}: ${ing.original} → mitad)`;
            }
            console.log(`  - ${ing.name}: ${ing.cantidad} ${detalles}`);
          });
        } else {
          console.log('❌ No se pudieron obtener recetas completas para ambas pizzas');
        }
      } else {
        console.log('\n❌ No se pudieron encontrar ambas pizzas');
      }
    } else {
      console.log('❌ No se pudo analizar el formato de Duo');
    }
    
  } catch (error) {
    console.error('Error en el diagnóstico:', error);
  }
}

// Función auxiliar para encontrar pizza por nombre
function findPizzaByName(menuItems, pizzaName) {
  // Función para normalizar texto
  const norm = (s) => s ? s.toLowerCase().replace(/[^a-z0-9ñáéíóúü ]+/gi, '').trim() : '';
  
  // 1. Búsqueda exacta
  let match = menuItems.find(i => norm(i.nombre || i.name || '') === norm(pizzaName));
  if (match) {
    console.log(`✓ Encontrada por coincidencia exacta: ${match.nombre || match.name}`);
    return match;
  }
  
  // 2. Búsqueda por palabras clave
  const keywords = pizzaName.split(' ').filter(word => 
    word.length > 2 && !['con', 'los', 'las', 'del', 'de', 'la', 'el', 'y'].includes(word.toLowerCase())
  );
  
  if (keywords.length > 0) {
    console.log(`Buscando por palabras clave: ${keywords.join(', ')}`);
    match = menuItems.find(i => {
      const menuItemName = norm(i.nombre || i.name || '');
      return keywords.every(word => menuItemName.includes(norm(word)));
    });
    if (match) {
      console.log(`✓ Encontrada por palabras clave: ${match.nombre || match.name}`);
      return match;
    }
  }
  
  // 3. Búsqueda por coincidencia parcial
  match = menuItems.find(i => {
    const menuItemName = norm(i.nombre || i.name || '');
    return menuItemName.includes(norm(pizzaName)) || norm(pizzaName).includes(menuItemName);
  });
  if (match) {
    console.log(`✓ Encontrada por coincidencia parcial: ${match.nombre || match.name}`);
    return match;
  }
  
  console.log(`❌ No se pudo encontrar la pizza '${pizzaName}'`);
  return null;
}

// Ejecutar el diagnóstico
diagnoseSearch()
  .then(() => console.log('\nDiagnóstico completado.'))
  .catch(error => console.error('Error general:', error));
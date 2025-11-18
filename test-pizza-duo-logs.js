// Script para probar la búsqueda de recetas para pizzas DUO
import { db } from './lib/firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { combineRecipes } from './lib/recipes';

// Función para normalizar textos para búsqueda
const norm = (s) => s ? s.toLowerCase().replace(/[^a-z0-9ñáéíóúü ]+/gi, '').trim() : '';

// Función para simular la búsqueda y combinación de recetas de pizza DUO
async function testPizzaDuoSearch() {
  try {
    console.log("============= TEST DE BÚSQUEDA DE RECETAS PARA PIZZA DUO =============");
    
    // Obtener datos del menú
    const itemsMenuSnap = await getDocs(collection(db, 'items_menu'));
    const itemsMenuDocs = [];
    itemsMenuSnap.forEach(d => itemsMenuDocs.push({ id: d.id, ...(d.data() || {}) }));
    
    console.log(`Se encontraron ${itemsMenuDocs.length} items en el menú`);
    
    // Definir pizzas a buscar (cambia estos nombres para probar diferentes combinaciones)
    const pizza1Name = "Napolitana";
    const pizza2Name = "Del Pibe";
    const size = "familiar";  // o "mediana"
    
    console.log(`\nBuscando pizza 1: "${pizza1Name}" (tamaño: ${size})`);
    console.log(`Buscando pizza 2: "${pizza2Name}" (tamaño: ${size})`);
    
    // Encontrar las pizzas individuales en el menú - búsqueda mejorada
    const findPizzaInMenu = (pizzaName) => {
      // 0. Limpieza adicional para palabras clave específicas
      const cleanName = pizzaName
        .replace(/\s+pizza\s+/gi, ' ')  // Eliminar "pizza" como palabra separada
        .replace(/\b(mediana|familiar)\b/gi, '') // Eliminar tamaños de la búsqueda
        .trim();
      
      console.log(`\nBúsqueda de pizza: "${pizzaName}" (limpiado: "${cleanName}")`);
      
      // 1. Búsqueda exacta
      let match = itemsMenuDocs.find(i => norm(i.nombre || i.name || '') === norm(cleanName));
      if (match) console.log(`✅ Encontrada por coincidencia exacta: ${match.nombre || match.name}`);
      
      // 2. Búsqueda por palabras clave significativas
      if (!match) {
        // Extraer palabras clave significativas (ignorar artículos, etc.)
        const keywords = cleanName.split(' ').filter(word => 
          word.length > 2 && !['con', 'los', 'las', 'del', 'de', 'la', 'el', 'y'].includes(word)
        );
        
        if (keywords.length > 0) {
          console.log(`Buscando por palabras clave: ${keywords.join(', ')}`);
          match = itemsMenuDocs.find(i => {
            const menuItemName = norm(i.nombre || i.name || '');
            // Una pizza coincide si todas sus palabras clave están en el nombre del menú
            return keywords.every(word => menuItemName.includes(word));
          });
          if (match) console.log(`✅ Encontrada por palabras clave: ${match.nombre || match.name}`);
        }
      }
      
      // 3. Búsqueda por coincidencia parcial de nombres
      if (!match) {
        match = itemsMenuDocs.find(i => {
          const menuItemName = norm(i.nombre || i.name || '');
          return menuItemName.includes(norm(cleanName)) || norm(cleanName).includes(menuItemName);
        });
        if (match) console.log(`✅ Encontrada por coincidencia parcial: ${match.nombre || match.name}`);
      }
      
      // 4. Búsqueda por primeras palabras
      if (!match) {
        const firstTwoWords = cleanName.split(' ').slice(0,2).join(' ');
        if (firstTwoWords.length > 3) { // Solo si son palabras significativas
          match = itemsMenuDocs.find(i => norm(i.nombre || i.name || '').includes(firstTwoWords));
          if (match) console.log(`✅ Encontrada por primeras palabras: ${match.nombre || match.name}`);
        }
      }
      
      // Si no encontramos nada, veamos qué pizzas están disponibles
      if (!match && pizzaName.length > 3) {
        console.log(`❌ No se pudo encontrar la pizza "${pizzaName}". Opciones disponibles:`);
        const availablePizzas = itemsMenuDocs
          .filter(i => i.nombre || i.name)
          .map(i => i.nombre || i.name)
          .slice(0, 15);
        console.log(availablePizzas.join("\n- "));
      }
      
      return match;
    };
    
    // Buscar ambas pizzas
    const matchedPizza1 = findPizzaInMenu(pizza1Name);
    const matchedPizza2 = findPizzaInMenu(pizza2Name);
    
    console.log("\n--- RESULTADO DE LA BÚSQUEDA ---");
    console.log(`Pizza 1 "${pizza1Name}": ${matchedPizza1 ? '✅ ENCONTRADA' : '❌ NO ENCONTRADA'}`);
    console.log(`Pizza 2 "${pizza2Name}": ${matchedPizza2 ? '✅ ENCONTRADA' : '❌ NO ENCONTRADA'}`);
    
    // Verificar recetas disponibles
    if (matchedPizza1) {
      // Para pizza 1
      let receta1 = null;
      
      if (size === 'mediana' && matchedPizza1.recetaMediana && 
          Array.isArray(matchedPizza1.recetaMediana) && matchedPizza1.recetaMediana.length > 0) {
        receta1 = matchedPizza1.recetaMediana;
        console.log(`\nPizza 1: Tiene receta MEDIANA con ${receta1.length} ingredientes`);
      } else if (matchedPizza1.receta && 
                 Array.isArray(matchedPizza1.receta) && matchedPizza1.receta.length > 0) {
        receta1 = matchedPizza1.receta;
        console.log(`\nPizza 1: Tiene receta FAMILIAR con ${receta1.length} ingredientes`);
      } else {
        console.log(`\nPizza 1: ❌ NO TIENE RECETA disponible`);
      }
      
      // Mostrar algunos ingredientes
      if (receta1 && receta1.length > 0) {
        console.log("Primeros ingredientes de la receta 1:");
        receta1.slice(0, 3).forEach(ing => {
          console.log(`- ${ing.ingredienteId}: ${ing.cantidad} ${ing.unidad || 'u'}`);
        });
      }
    }
    
    if (matchedPizza2) {
      // Para pizza 2
      let receta2 = null;
      
      if (size === 'mediana' && matchedPizza2.recetaMediana && 
          Array.isArray(matchedPizza2.recetaMediana) && matchedPizza2.recetaMediana.length > 0) {
        receta2 = matchedPizza2.recetaMediana;
        console.log(`\nPizza 2: Tiene receta MEDIANA con ${receta2.length} ingredientes`);
      } else if (matchedPizza2.receta && 
                 Array.isArray(matchedPizza2.receta) && matchedPizza2.receta.length > 0) {
        receta2 = matchedPizza2.receta;
        console.log(`\nPizza 2: Tiene receta FAMILIAR con ${receta2.length} ingredientes`);
      } else {
        console.log(`\nPizza 2: ❌ NO TIENE RECETA disponible`);
      }
      
      // Mostrar algunos ingredientes
      if (receta2 && receta2.length > 0) {
        console.log("Primeros ingredientes de la receta 2:");
        receta2.slice(0, 3).forEach(ing => {
          console.log(`- ${ing.ingredienteId}: ${ing.cantidad} ${ing.unidad || 'u'}`);
        });
      }
    }
    
    console.log("\n============= FIN DEL TEST =============");
    
  } catch (error) {
    console.error("Error en la prueba:", error);
  }
}

// Ejecutar la prueba
testPizzaDuoSearch().catch(console.error);
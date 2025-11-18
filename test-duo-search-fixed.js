// Script    const itemsMenuSnap = await getDocs(collection(db, 'items_menu'));
    const itemsMenuDocs = [];
    itemsMenuSnap.forEach(d => itemsMenuDocs.push({ id: d.id, ...(d.data() || {}) }));
    
    console.log("Se encontraron " + itemsMenuDocs.length + " pizzas en el menú.");
    
    // Mostrar las primeras 15 pizzas para verificar
    console.log("Listado de pizzas disponibles en el menú:");nóstico para la búsqueda de pizzas
const { db } = require('./lib/firebase');
const { collection, getDocs } = require('firebase/firestore');

async function diagnoseSearch() {
  try {
    console.log('Iniciando diagnóstico de búsqueda de pizzas...');
    
    // Cargar datos del menú
    const itemsMenuSnap = await getDocs(collection(db, 'items_menu'));
    const itemsMenuDocs = [];
    itemsMenuSnap.forEach(d => itemsMenuDocs.push({ id: d.id, ...(d.data() || {}) }));
    
    console.log(Se encontraron  pizzas en el menú.);
    
    // Mostrar las primeras 15 pizzas para verificar
    console.log('\nListado de pizzas disponibles en el menú:');
    itemsMenuDocs.slice(0, 15).forEach((pizza, idx) => {
      console.log(${idx + 1}. );
    });
    
    // Probar búsqueda específica
    const pizzasDePrueba = ['Napolitana', 'Del Pibe', 'Cuatro Quesos', 'Vegetariana'];
    
    for (const pizzaName of pizzasDePrueba) {
      console.log(\n--- Buscando pizza: '' ---);
      
      // Función para normalizar texto
      const norm = (s) => s ? s.toLowerCase().replace(/[^a-z0-9ñáéíóúü ]+/gi, '').trim() : '';
      
      // 1. Búsqueda exacta
      let match = itemsMenuDocs.find(i => norm(i.nombre || i.name || '') === norm(pizzaName));
      if (match) console.log( Encontrada por coincidencia exacta: );
      
      // 2. Búsqueda por palabras clave
      if (!match) {
        const keywords = pizzaName.split(' ').filter(word => 
          word.length > 2 && !['con', 'los', 'las', 'del', 'de', 'la', 'el', 'y'].includes(word.toLowerCase())
        );
        
        if (keywords.length > 0) {
          console.log(Buscando por palabras clave: );
          match = itemsMenuDocs.find(i => {
            const menuItemName = norm(i.nombre || i.name || '');
            return keywords.every(word => menuItemName.includes(norm(word)));
          });
          if (match) console.log( Encontrada por palabras clave: );
        }
      }
      
      // 3. Búsqueda por coincidencia parcial
      if (!match) {
        match = itemsMenuDocs.find(i => {
          const menuItemName = norm(i.nombre || i.name || '');
          return menuItemName.includes(norm(pizzaName)) || norm(pizzaName).includes(menuItemName);
        });
        if (match) console.log( Encontrada por coincidencia parcial: );
      }
      
      // Verificar receta
      if (match) {
        console.log(Resultado final: Encontrada pizza '');
        
        // Verificar si tiene receta
        if (match.receta && Array.isArray(match.receta) && match.receta.length > 0) {
          console.log(   Tiene receta FAMILIAR con  ingredientes);
          // Mostrar primeros ingredientes
          match.receta.slice(0, 3).forEach(ing => {
            console.log(    - :  );
          });
        } else {
          console.log(   No tiene receta FAMILIAR);
        }
        
        if (match.recetaMediana && Array.isArray(match.recetaMediana) && match.recetaMediana.length > 0) {
          console.log(   Tiene receta MEDIANA con  ingredientes);
        } else {
          console.log(   No tiene receta MEDIANA);
        }
        
      } else {
        console.log( No se pudo encontrar la pizza '');
        
        // Mostrar pizzas con nombres similares para diagnóstico
        const similarPizzas = itemsMenuDocs
          .filter(i => {
            const name = norm(i.nombre || i.name || '');
            return name.includes(norm(pizzaName.substring(0, 3))) || 
                   pizzaName.split(' ').some(word => name.includes(norm(word)));
          })
          .map(i => i.nombre || i.name);
        
        if (similarPizzas.length > 0) {
          console.log('Pizzas con nombres similares:');
          similarPizzas.slice(0, 5).forEach(name => console.log(  - ));
        }
      }
    }
    
  } catch (error) {
    console.error('Error en diagnóstico:', error);
  }
}

diagnoseSearch().catch(console.error);
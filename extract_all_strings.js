const fs = require('fs');

const html = fs.readFileSync('reviews_page.html', 'utf8');

// Google Maps serializa las opiniones en arrays dentro de window.APP_INITIALIZATION_STATE o etiquetas script.
// Busquemos patrones de cadenas JSON en el HTML que contengan comentarios.
// Las opiniones suelen ir acompañadas de la fecha relativa ("hace", "semanas", "meses", "años").
// Busquemos palabras clave comunes escapadas o no.
const keywords = ['pizza', 'masa', 'atención', 'sabor', 'excelente', 'rica', 'rico', 'local', 'Los Andes'];

console.log('Searching in reviews_page.html (size: ' + html.length + ')...');

// Vamos a buscar todas las cadenas largas en formato de array JSON o script
const regex = /"([^"\\]|\\.)*"/g;
let match;
const foundStrings = [];

while ((match = regex.exec(html)) !== null) {
  const str = match[0];
  if (str.length > 30 && str.length < 300) {
    // Si contiene alguna keyword de valoración, guardémosla
    const containsKeyword = keywords.some(k => str.toLowerCase().includes(k.toLowerCase()));
    if (containsKeyword) {
      foundStrings.push(str);
    }
  }
}

console.log(`Found ${foundStrings.length} matching strings. Printing top 50:`);
foundStrings.slice(0, 50).forEach((s, idx) => {
  console.log(`[${idx}] ${s}`);
});

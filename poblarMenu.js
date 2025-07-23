// poblarMenu.js
const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

// Inicializa Firebase Admin con tus credenciales (usa GOOGLE_APPLICATION_CREDENTIALS o descarga el service account)
initializeApp({ credential: applicationDefault() });
const db = getFirestore();

async function poblar() {
  // Categorías
  const categorias = [
    { id: "pizzas_palermo", nombre: "Pizzas Palermo", orden: 1 },
    { id: "pizzas_tradicionales", nombre: "Pizzas Tradicionales", orden: 2 },
    { id: "acompaniamientos", nombre: "Acompañamientos", orden: 3 },
    { id: "bebidas", nombre: "Bebidas", orden: 4 },
  ];
  for (const cat of categorias) {
    await db.collection("categorias_menu").doc(cat.id).set({ nombre: cat.nombre, orden: cat.orden });
  }

  // Ítems del menú (todos los de tu frontend)
  const items = [
    // Pizzas Palermo
    { nombre: "Chilena", descripcion: "Salsa, queso, carne de vacuno, tomate fresco, aceitunas, cebolla morada, orégano", precio: 17900, precioMediana: 13900, imagen: "/placeholder.svg?height=200&width=200", categoria: "Pizzas Palermo", orden: 1 },
    { nombre: "Bariloche", descripcion: "Salsa, queso, vacuno asado desmechado, tocino, choricillo, aceitunas, pimentón, orégano", precio: 17900, precioMediana: 13900, imagen: "/placeholder.svg?height=200&width=200", categoria: "Pizzas Palermo", orden: 2 },
    { nombre: "Buenos Aires", descripcion: "Salsa, queso, mechada de vacuno, champiñón, choricillo, aceitunas negras, orégano", precio: 16900, precioMediana: 13500, imagen: "/placeholder.svg?height=200&width=200", categoria: "Pizzas Palermo", orden: 3 },
    { nombre: "Cuyana", descripcion: "Salsa, queso, pechuga de pollo, choricillo, pimentón, tocino, orégano", precio: 15900, precioMediana: 13500, imagen: "/placeholder.svg?height=200&width=200", categoria: "Pizzas Palermo", orden: 4 },
    { nombre: "4 Estaciones", descripcion: "Mechada, pollo BBQ, Amalfitana, Hawaiana", precio: 15900, precioMediana: null, imagen: "/placeholder.svg?height=200&width=200", categoria: "Pizzas Palermo", orden: 5 },
    { nombre: "Sevillana", descripcion: "Salsa, queso, jamón serrano, aceituna sevillana, cebolla morada, choricillo, rúcula, orégano", precio: 16900, precioMediana: null, imagen: "/placeholder.svg?height=200&width=200", categoria: "Pizzas Palermo", orden: 6 },
    { nombre: "Amalfitana", descripcion: "Salsa, queso, jamón artesanal, aceitunas negras, pesto de albahaca, rúcula, orégano", precio: 15900, precioMediana: 13000, imagen: "/placeholder.svg?height=200&width=200", categoria: "Pizzas Palermo", orden: 7 },
    { nombre: "Calabresa", descripcion: "Salsa, queso, tomate fresco, chorizo calabresa, chorizo artesanal, aceitunas negras, orégano", precio: 16900, precioMediana: 13500, imagen: "/placeholder.svg?height=200&width=200", categoria: "Pizzas Palermo", orden: 8 },
    { nombre: "Entre Ríos", descripcion: "Salsa, queso, tomate fresco, camarón al ajillo, aceitunas verdes, toque de perejil, orégano", precio: 17900, precioMediana: null, imagen: "/placeholder.svg?height=200&width=200", categoria: "Pizzas Palermo", orden: 9 },
    { nombre: "Patagonia", descripcion: "Salsa, queso, tomate fresco, salmón ahumado, aceitunas verdes, rúcula, alcaparras, orégano", precio: 17900, precioMediana: 13900, imagen: "/placeholder.svg?height=200&width=200", categoria: "Pizzas Palermo", orden: 10 },
    { nombre: "Puerto Madryn", descripcion: "Salsa bechamel (blanca), queso, espinaca fresca, filete de atún a la mantequilla, champiñón, eneldo", precio: 17900, precioMediana: 13900, imagen: "/placeholder.svg?height=200&width=200", categoria: "Pizzas Palermo", orden: 11 },
    { nombre: "Recoleta", descripcion: "Salsa, queso gouda, queso azul, mermelada de cebolla", precio: 16900, precioMediana: 13500, imagen: "/placeholder.svg?height=200&width=200", categoria: "Pizzas Palermo", orden: 12 },
    { nombre: "4 Quesos", descripcion: "Salsa bechamel, queso gouda, queso azul, queso grana padano, queso de cabra", precio: 17900, precioMediana: 13900, imagen: "/placeholder.svg?height=200&width=200", categoria: "Pizzas Palermo", orden: 13 },
    { nombre: "Neuquén", descripcion: "Salsa, queso, queso de cabra, tomate fresco, pesto de albahaca, orégano (ajo opcional)", precio: 15900, precioMediana: 13000, imagen: "/placeholder.svg?height=200&width=200", categoria: "Pizzas Palermo", orden: 14 },
    { nombre: "La Rioja", descripcion: "Salsa, queso, nueces, queso azul, miel de abeja", precio: 17900, precioMediana: 13900, imagen: "/placeholder.svg?height=200&width=200", categoria: "Pizzas Palermo", orden: 15 },
    { nombre: "Cordobesa", descripcion: "Salsa, queso, láminas de zapallo italiano, arándanos frescos, queso azul", precio: 16900, precioMediana: 13500, imagen: "/placeholder.svg?height=200&width=200", categoria: "Pizzas Palermo", orden: 16 },
    { nombre: "Luján", descripcion: "Salsa, queso, jamón serrano, rúcula, tomate fresco, queso grana padano, orégano", precio: 17900, precioMediana: 13900, imagen: "/placeholder.svg?height=200&width=200", categoria: "Pizzas Palermo", orden: 17 },
    { nombre: "Hawaiana", descripcion: "Salsa, queso, jamón artesanal, piña caramelizada en panela, shot de caramelo", precio: 13900, precioMediana: 12000, imagen: "/placeholder.svg?height=200&width=200", categoria: "Pizzas Palermo", orden: 18 },
    { nombre: "Veggie 1", descripcion: "Salsa, queso, choclo, champiñón, espárragos, pesto de albahaca, rúcula, orégano", precio: 15900, precioMediana: 13000, imagen: "/placeholder.svg?height=200&width=200", categoria: "Pizzas Palermo", orden: 19 },
    { nombre: "Veggie 2", descripcion: "Salsa, queso, champiñón salteado al ajillo, aceitunas negras, cebolla morada, orégano", precio: 15900, precioMediana: 13000, imagen: "/placeholder.svg?height=200&width=200", categoria: "Pizzas Palermo", orden: 20 },
    { nombre: "Messi", descripcion: "Salsa, extra queso, tomate fresco, cebolla morada, aceitunas verdes, orégano", precio: 15900, precioMediana: 13000, imagen: "/placeholder.svg?height=200&width=200", categoria: "Pizzas Palermo", orden: 21 },

    // Pizzas Tradicionales
    { nombre: "Pepperoni Cheese", descripcion: "Salsa tomate, doble queso, doble pepperoni americano, orégano", precio: 14500, precioMediana: 12000, imagen: "/placeholder.svg?height=200&width=200", categoria: "Pizzas Tradicionales", orden: 1 },
    { nombre: "Centroamericana", descripcion: "Salsa tomate, doble queso, jamón, choclo, pimentón, tocino, orégano", precio: 15900, precioMediana: 13000, imagen: "/placeholder.svg?height=200&width=200", categoria: "Pizzas Tradicionales", orden: 2 },
    { nombre: "Napolitana", descripcion: "Salsa tomate, queso, jamón, aceituna negra, orégano", precio: 10000, precioMediana: 8500, imagen: "/placeholder.svg?height=200&width=200", categoria: "Pizzas Tradicionales", orden: 3 },
    { nombre: "Pesto Margarita", descripcion: "Salsa tomate, doble queso, tomate fresco, orégano, pesto de albahaca", precio: 14500, precioMediana: 12000, imagen: "/placeholder.svg?height=200&width=200", categoria: "Pizzas Tradicionales", orden: 4 },
    { nombre: "Chicken BBQ", descripcion: "Salsa tomate, queso, pechuga de pollo, salsa bbq, cebolla morada, tocino", precio: 15900, precioMediana: 13000, imagen: "/placeholder.svg?height=200&width=200", categoria: "Pizzas Tradicionales", orden: 5 },
    { nombre: "Doble Muzza", descripcion: "Salsa tomate, doble queso, aceituna verde, chimichurri, orégano", precio: 13000, precioMediana: 10000, imagen: "/placeholder.svg?height=200&width=200", categoria: "Pizzas Tradicionales", orden: 6 },
    { nombre: "De Charly", descripcion: "Salsa tomate, doble queso, salame, choclo, aceituna negra, orégano", precio: 15900, precioMediana: 13000, imagen: "/placeholder.svg?height=200&width=200", categoria: "Pizzas Tradicionales", orden: 7 },
    { nombre: "Del Pibe", descripcion: "Salsa tomate, doble queso, jamón artesanal, orégano", precio: 14500, precioMediana: 12000, imagen: "/placeholder.svg?height=200&width=200", categoria: "Pizzas Tradicionales", orden: 8 },

    // Acompañamientos
    { nombre: "Rollitos de Canela", descripcion: "Pack de 4 rollitos de canela, dos cobertura glasé canela y dos de chocolate", precio: 4900, imagen: "/placeholder.svg?height=200&width=200", categoria: "Acompañamientos", orden: 1 },
    { nombre: "Gauchitos", descripcion: "Nuestra versión de palitos de ajo al estilo Tortafrita Argentina", precio: 4000, imagen: "/placeholder.svg?height=200&width=200", categoria: "Acompañamientos", orden: 2 },
    { nombre: "Salsa de Ajo", descripcion: "Deliciosa salsa de ajo para acompañar tus pizzas", precio: 700, imagen: "/placeholder.svg?height=200&width=200", categoria: "Acompañamientos", orden: 3 },
    { nombre: "Salsa Chimichurri", descripcion: "Tradicional salsa chimichurri argentina", precio: 700, imagen: "/placeholder.svg?height=200&width=200", categoria: "Acompañamientos", orden: 4 },
    { nombre: "Salsa BBQ", descripcion: "Salsa barbacoa dulce y ahumada", precio: 700, imagen: "/placeholder.svg?height=200&width=200", categoria: "Acompañamientos", orden: 5 },
    { nombre: "Salsa Pesto", descripcion: "Salsa pesto de albahaca fresca", precio: 1000, imagen: "/placeholder.svg?height=200&width=200", categoria: "Acompañamientos", orden: 6 },

    // Bebidas
    { nombre: "Coca Cola Lata 350cc", descripcion: "Disfruta el sabor de tu bebida Coca Cola en lata de 350cc", precio: 1500, precioMediana: 1500, imagen: "/placeholder.svg?height=200&width=200", categoria: "Bebidas", variants: ["Tradicional", "Zero"], orden: 1 },
    { nombre: "Coca Cola 1.5 Litro", descripcion: "Disfruta el sabor de tu bebida Coca Cola en botella de 1.5 litros", precio: 2900, precioMediana: 2900, imagen: "/placeholder.svg?height=200&width=200", categoria: "Bebidas", variants: ["Tradicional", "Zero"], orden: 2 },
  ];

  for (const item of items) {
    await db.collection("items_menu").add(item);
  }
}

poblar().then(() => {
  console.log("¡Base de datos poblada!");
  process.exit();
});
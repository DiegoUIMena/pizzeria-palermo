const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, getDocs } = require('firebase/firestore');

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

async function testFirestore() {
  try {
    console.log('Intentando escribir en Firestore...');
    
    // Crear una colección de prueba
    const testCollection = collection(db, 'test-collection');
    
    // Añadir un documento de prueba
    const docRef = await addDoc(testCollection, {
      name: 'Test Document',
      timestamp: new Date().toISOString(),
      working: true
    });
    
    console.log('Documento creado con ID:', docRef.id);
    
    // Leer la colección
    const querySnapshot = await getDocs(testCollection);
    console.log('Documentos en la colección test-collection:');
    querySnapshot.forEach((doc) => {
      console.log(doc.id, ' => ', doc.data());
    });
    
    console.log('¡Prueba completada con éxito!');
  } catch (error) {
    console.error('Error durante la prueba:', error);
  }
}

// Ejecutar la prueba
testFirestore();

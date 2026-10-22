const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs } = require("firebase/firestore");

const firebaseConfig = {
  apiKey: "AIzaSyCVKPmInym85FO89UhVQNsGzBeeqZ0wmFM",
  authDomain: "pizzeria-palermo-17f6d.firebaseapp.com",
  projectId: "pizzeria-palermo-17f6d",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function main() {
  const snapshot = await getDocs(collection(db, "ingredientes"));
  const docs = snapshot.docs.map(doc => doc.data());
  docs.forEach(doc => {
    console.log(`Nombre: ${doc.nombre} | Clase: ${doc.clase} | Tipo: ${doc.tipo} | Categoria: ${doc.categoria}`);
  });
}

main().catch(console.error);

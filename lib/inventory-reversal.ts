import { 
  collection, 
  getDocs, 
  query, 
  where, 
  doc, 
  getDoc, 
  updateDoc, 
  addDoc,
  Timestamp,
  runTransaction
} from 'firebase/firestore'
import { db } from './firebase'
import { computeEstado } from './inventory'
import { toGrams } from './units'

// Función para revertir una transacción de consumo de inventario
export async function revertInventoryConsumption(orderId: string): Promise<{
  success: boolean,
  transactionId?: string,
  error?: string
}> {
  try {
    // 1. Buscar la transacción de inventario original para este pedido
    const transactionsQuery = query(
      collection(db, 'inventory_transactions'),
      where('orderId', '==', orderId),
      where('status', '==', 'success') // Solo revertir transacciones exitosas
    );
    
    const transactionsSnap = await getDocs(transactionsQuery);
    
    if (transactionsSnap.empty) {
      return {
        success: false,
        error: 'No se encontraron transacciones de inventario para este pedido'
      };
    }
    
    // Usar la transacción más reciente
    const transactionDoc = transactionsSnap.docs[0];
    const transactionData = transactionDoc.data();
    
    // 2. Crear una nueva transacción de reversión
    const reversalDoc = await addDoc(collection(db, 'inventory_transactions'), {
      orderId,
      orderNumber: transactionData.orderNumber,
      timestamp: Timestamp.now().toDate().toISOString(),
      items: [],
      status: 'processing',
      originalTransactionId: transactionDoc.id,
      type: 'reversal'
    });
    
    // 3. Procesar la reversión
    let success = true;
    let errorMessage = '';
    const reversalItems: any[] = [];
    
    try {
      // Ejecutar en una transacción para garantizar atomicidad
      await runTransaction(db, async (transaction) => {
        // Preparar las operaciones de actualización
        const updateOperations: Array<{
          ref: any;
          data: any;
          ingredientInfo: any;
        }> = [];
        
        // Para cada ítem consumido en la transacción original, devolver al inventario
        for (const item of transactionData.items) {
          const ingRef = doc(db, 'ingredientes', item.ingredienteId);
          const snap = await transaction.get(ingRef);
          
          if (!snap.exists()) {
            console.warn(`Ingrediente ${item.ingredienteId} no encontrado al revertir.`);
            continue;
          }
          
          const data = snap.data();
          const stockActual = Number(data?.stockActual || 0);
          
          // Sumar la cantidad que se había consumido
          const newStock = stockActual + item.cantidadConsumida;
          
          // Recalcular el estado del ingrediente
          const stockMinimo = Number(data?.stockMinimo || 0);
          const fechaVencimiento = data?.fechaVencimiento;
          const nuevoEstado = computeEstado({ 
            stockActual: newStock, 
            stockMinimo, 
            fechaVencimiento 
          });
          
          // Registrar para la transacción de reversión
          const reversalInfo = {
            ingredienteId: item.ingredienteId,
            nombre: item.nombre || data?.nombre || 'Ingrediente',
            cantidadAnterior: stockActual,
            cantidadRevertida: item.cantidadConsumida,
            cantidadNueva: newStock,
            unidad: data?.unidad || item.unidad
          };
          
          // Preparar la actualización
          updateOperations.push({
            ref: ingRef,
            data: {
              stockActual: newStock,
              estado: nuevoEstado,
              updatedAt: Timestamp.now().toDate().toISOString()
            },
            ingredientInfo: reversalInfo
          });
          
          console.log(`Revertiendo: ${reversalInfo.nombre} - Stock actual: ${stockActual} ${reversalInfo.unidad} + Revertido: ${reversalInfo.cantidadRevertida} ${reversalInfo.unidad} = Nuevo stock: ${newStock} ${reversalInfo.unidad}`);
        }
        
        // Realizar todas las actualizaciones en la transacción
        for (const operation of updateOperations) {
          transaction.update(operation.ref, operation.data);
          reversalItems.push(operation.ingredientInfo);
        }
      });
    } catch (error: any) {
      success = false;
      errorMessage = error?.message || 'Error al revertir consumo de inventario';
      console.error('Error en transacción de reversión de inventario:', error);
    }
    
    // 4. Actualizar la transacción de reversión con el resultado
    const updateData: any = {
      items: reversalItems,
      status: success ? 'success' : 'failed'
    };
    
    if (!success && errorMessage) {
      updateData.error = errorMessage;
    }
    
    await updateDoc(doc(db, 'inventory_transactions', reversalDoc.id), updateData);
    
    return {
      success,
      transactionId: reversalDoc.id,
      error: success ? undefined : errorMessage
    };
  } catch (err: any) {
    console.error('Error al revertir consumo de inventario:', err);
    return {
      success: false,
      error: err?.message || String(err)
    };
  }
}
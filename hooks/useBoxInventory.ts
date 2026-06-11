import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export function useBoxInventory() {
  const [stockFamiliar, setStockFamiliar] = useState<number>(0);
  const [stockMediana, setStockMediana] = useState<number>(0);
  const [stockIndividual, setStockIndividual] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    
    const unsub = onSnapshot(doc(db, 'settings', 'cajas_config'), (document) => {
      if (document.exists()) {
        const data = document.data();
        setStockFamiliar(data.stockFamiliar || 0);
        setStockMediana(data.stockMediana || 0);
        setStockIndividual(data.stockIndividual || 0);
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return { stockFamiliar, stockMediana, stockIndividual, loading };
}
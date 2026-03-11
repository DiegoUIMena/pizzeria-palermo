/**
 * Gestor de listeners de Firestore con patrón Singleton
 * Evita múltiples suscripciones a la misma colección
 * Ahorra ~30,000 lecturas/mes
 */

import { collection, query, onSnapshot, Query, Unsubscribe, QuerySnapshot } from 'firebase/firestore';
import { db } from './firebase';

type Listener<T> = (data: T[]) => void;

interface SubscriptionInfo<T> {
  unsubscribe: Unsubscribe;
  listeners: Set<Listener<T>>;
  lastSnapshot: QuerySnapshot | null;
}

class RealtimeManager {
  private subscriptions: Map<string, SubscriptionInfo<any>> = new Map();

  /**
   * Suscribe un listener a una colección
   * Si ya existe una suscripción a esa colección, reutiliza el listener
   */
  subscribe<T>(
    collectionName: string,
    listener: Listener<T>,
    queryConstraints?: any[]
  ): () => void {
    const key = this.getKey(collectionName, queryConstraints);

    if (!this.subscriptions.has(key)) {
      // Crear nueva suscripción
      this.createSubscription(key, collectionName, queryConstraints);
    }

    const subscription = this.subscriptions.get(key)!;
    subscription.listeners.add(listener);

    // Si ya tenemos datos, enviarlos inmediatamente
    if (subscription.lastSnapshot) {
      const data = this.parseSnapshot<T>(subscription.lastSnapshot);
      listener(data);
    }

    // Retornar función de desuscripción
    return () => {
      this.unsubscribe(key, listener);
    };
  }

  /**
   * Crea una nueva suscripción a Firestore
   */
  private createSubscription<T>(
    key: string,
    collectionName: string,
    queryConstraints?: any[]
  ): void {
    const listeners = new Set<Listener<T>>();

    const q = queryConstraints && queryConstraints.length > 0
      ? query(collection(db, collectionName), ...queryConstraints)
      : collection(db, collectionName);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = this.parseSnapshot<T>(snapshot);

        // Actualizar último snapshot
        const subscription = this.subscriptions.get(key);
        if (subscription) {
          subscription.lastSnapshot = snapshot;
        }

        // Notificar a todos los listeners
        listeners.forEach((listener) => {
          try {
            listener(data);
          } catch (error) {
            console.error('Error en listener:', error);
          }
        });
      },
      (error) => {
        console.error(`Error en suscripción ${key}:`, error);
      }
    );

    this.subscriptions.set(key, {
      unsubscribe,
      listeners,
      lastSnapshot: null,
    });
  }

  /**
   * Desuscribe un listener
   */
  private unsubscribe<T>(key: string, listener: Listener<T>): void {
    const subscription = this.subscriptions.get(key);

    if (!subscription) {
      return;
    }

    subscription.listeners.delete(listener);

    // Si no quedan listeners, cancelar la suscripción a Firestore
    if (subscription.listeners.size === 0) {
      subscription.unsubscribe();
      this.subscriptions.delete(key);
    }
  }

  /**
   * Parsea un snapshot de Firestore
   */
  private parseSnapshot<T>(snapshot: QuerySnapshot): T[] {
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as T[];
  }

  /**
   * Genera una key única para una colección + query
   */
  private getKey(collectionName: string, queryConstraints?: any[]): string {
    if (!queryConstraints || queryConstraints.length === 0) {
      return collectionName;
    }

    // Generar key basada en los constraints
    const constraintsKey = queryConstraints
      .map((c) => JSON.stringify(c))
      .join('__');

    return `${collectionName}__${constraintsKey}`;
  }

  /**
   * Cancela todas las suscripciones activas
   * Útil para limpieza en desarrollo
   */
  clearAll(): void {
    this.subscriptions.forEach((subscription) => {
      subscription.unsubscribe();
    });
    this.subscriptions.clear();
  }

  /**
   * Obtiene estadísticas de suscripciones activas
   */
  getStats() {
    const stats = {
      totalSubscriptions: this.subscriptions.size,
      subscriptions: [] as Array<{ key: string; listeners: number }>,
    };

    this.subscriptions.forEach((subscription, key) => {
      stats.subscriptions.push({
        key,
        listeners: subscription.listeners.size,
      });
    });

    return stats;
  }
}

// Exportar instancia singleton
export const realtimeManager = new RealtimeManager();

/**
 * Hook para usar el gestor de listeners
 * 
 * Ejemplo de uso:
 * 
 * const { data, loading, error } = useRealtimeCollection<Pizza>(
 *   'items_menu',
 *   [where('activo', '==', true)]
 * );
 */
import { useState, useEffect } from 'react';

export function useRealtimeCollection<T>(
  collectionName: string,
  queryConstraints?: any[]
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = realtimeManager.subscribe<T>(
      collectionName,
      (newData) => {
        setData(newData);
        setLoading(false);
      },
      queryConstraints
    );

    return () => {
      unsubscribe();
    };
  }, [collectionName, JSON.stringify(queryConstraints)]);

  return { data, loading, error };
}

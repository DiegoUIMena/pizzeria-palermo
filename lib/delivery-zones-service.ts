"use client"


import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc, 
  writeBatch,
  query,
  where,
  getDoc,
  updateDoc,
  onSnapshot,
  Unsubscribe
} from "firebase/firestore"
import { db } from "./firebase"
import type { DeliveryZone } from "./delivery-zones"

// Constantes para la colección
export const DELIVERY_ZONES_COLLECTION = "delivery-zones"

/**
 * Obtiene todas las zonas de delivery desde Firestore
 */
export async function getDeliveryZones(): Promise<DeliveryZone[]> {
  try {
    const zonesRef = collection(db, DELIVERY_ZONES_COLLECTION)
    const snapshot = await getDocs(zonesRef)
    
    if (snapshot.empty) {
      console.log("No hay zonas de delivery en la base de datos")
      return []
    }
    
    return snapshot.docs.map(doc => {
      const data = doc.data() as any;
      
      // Convertir el polígono de objetos {lat, lng} de vuelta a arrays [lat, lng]
      const poligono = data.poligono && Array.isArray(data.poligono) 
        ? data.poligono.map((p: any) => [p.lat, p.lng] as [number, number])
        : [];
      
      return {
        id: doc.id,
        nombre: data.nombre,
        tarifa: data.tarifa,
        disponible: data.disponible,
        tiempoEstimado: data.tiempoEstimado,
        poligono: poligono,
        color: data.color,
        descripcion: data.descripcion || ""
      } as DeliveryZone;
    });
  } catch (error) {
    console.error("Error al obtener zonas de delivery:", error)
    throw new Error("No se pudieron cargar las zonas de delivery")
  }
}

/**
 * Guarda una zona de delivery en Firestore
 */
export async function saveDeliveryZone(zone: DeliveryZone): Promise<void> {
  try {
    // Convertir el polígono a un formato compatible con Firestore
    // Firestore no admite arrays anidados, así que convertimos cada par [lat, lng] a un objeto {lat, lng}
    const poligonoCompatible = zone.poligono.map(punto => {
      if (Array.isArray(punto)) {
        return { lat: punto[0], lng: punto[1] };
      }
      return { lat: punto.lat, lng: punto.lng };
    });
    
    const zoneRef = doc(db, DELIVERY_ZONES_COLLECTION, zone.id)
    await setDoc(zoneRef, {
      nombre: zone.nombre,
      tarifa: zone.tarifa,
      disponible: zone.disponible,
      tiempoEstimado: zone.tiempoEstimado,
      poligono: poligonoCompatible, // Usamos la versión compatible con Firestore
      color: zone.color,
      descripcion: zone.descripcion || ""
    })
    console.log(`Zona ${zone.id} guardada correctamente`)
  } catch (error) {
    console.error(`Error al guardar zona ${zone.id}:`, error)
    throw new Error(`No se pudo guardar la zona ${zone.nombre}`)
  }
}

/**
 * Elimina una zona de delivery de Firestore
 */
export async function deleteDeliveryZone(zoneId: string): Promise<void> {
  try {
    const zoneRef = doc(db, DELIVERY_ZONES_COLLECTION, zoneId)
    await deleteDoc(zoneRef)
    console.log(`Zona ${zoneId} eliminada correctamente`)
  } catch (error) {
    console.error(`Error al eliminar zona ${zoneId}:`, error)
    throw new Error(`No se pudo eliminar la zona ${zoneId}`)
  }
}

/**
 * Guarda múltiples zonas de delivery directamente sin eliminar todas las zonas existentes
 */
export async function saveDeliveryZones(zones: DeliveryZone[]): Promise<void> {
  try {
    console.log("Servicio: Guardando zonas en Firestore:", zones);
    
    // Validar que tengamos zonas para guardar
    if (!zones || zones.length === 0) {
      console.warn("No hay zonas para guardar. El array está vacío.");
      return;
    }
    
    // Primero obtenemos las zonas existentes para determinar cuáles se deben eliminar
    const zonesRef = collection(db, DELIVERY_ZONES_COLLECTION);
    const snapshot = await getDocs(zonesRef);
    
    // Crear un set con los IDs de las zonas que se van a guardar
    const newZoneIds = new Set(zones.map(zone => zone.id));
    
    // Encontrar zonas que existen en Firestore pero no están en la lista de nuevas zonas
    const zonesToDelete = snapshot.docs.filter(doc => !newZoneIds.has(doc.id));
    
    if (zonesToDelete.length > 0) {
      console.log(`Eliminando ${zonesToDelete.length} zonas que ya no existen en la lista actualizada`);
      
      // Eliminar las zonas que ya no existen
      const deletePromises = zonesToDelete.map(doc => {
        console.log(`Eliminando zona ${doc.id} que ya no existe en la lista`);
        return deleteDoc(doc.ref);
      });
      
      await Promise.all(deletePromises);
    }
    
    // Guardar o actualizar cada zona en la lista
    if (zones.length === 0) {
      console.log("No hay zonas para guardar");
      return;
    }
    
    console.log(`Guardando ${zones.length} zonas`);
    
    // Guardar cada zona
    for (const zone of zones) {
      try {
        console.log(`Guardando zona ${zone.id} (${zone.nombre})`);
        
        // Verificar que la zona tenga un polígono válido
        if (!zone.poligono || !Array.isArray(zone.poligono) || zone.poligono.length < 3) {
          console.error(`Zona ${zone.id} (${zone.nombre}) tiene un polígono inválido:`, zone.poligono);
          console.error("Se requiere un array de al menos 3 puntos [lat, lng]");
          continue; // Saltar esta zona
        }
        
        // Verificar que cada punto del polígono sea un array [lat, lng]
        const todosPuntosValidos = zone.poligono.every(punto => 
          Array.isArray(punto) && punto.length === 2 && 
          typeof punto[0] === 'number' && typeof punto[1] === 'number'
        );
        
        if (!todosPuntosValidos) {
          console.error(`Zona ${zone.id} (${zone.nombre}) tiene puntos inválidos en el polígono.`);
          console.error("Cada punto debe ser un array [lat, lng] con valores numéricos.");
          continue; // Saltar esta zona
        }
        
        // Depurar la estructura del polígono
        console.log(`Estructura del polígono para ${zone.id}:`, JSON.stringify(zone.poligono));
        
        // Convertir el polígono a un formato compatible con Firestore
        // Firestore no admite arrays anidados, así que convertimos cada par [lat, lng] a un objeto {lat, lng}
        const poligonoCompatible = zone.poligono.map(punto => {
          console.log("Punto del polígono:", punto);
          if (Array.isArray(punto)) {
            return { lat: punto[0], lng: punto[1] };
          }
            return { lat: punto.lat, lng: punto.lng };
        });
        
        console.log("Polígono convertido:", poligonoCompatible);
        
        const zoneRef = doc(db, DELIVERY_ZONES_COLLECTION, zone.id);
        
        await setDoc(zoneRef, {
          nombre: zone.nombre,
          tarifa: zone.tarifa,
          disponible: zone.disponible,
          tiempoEstimado: zone.tiempoEstimado,
          poligono: poligonoCompatible, // Usamos la versión compatible con Firestore
          color: zone.color,
          descripcion: zone.descripcion || ""
        });
        
        console.log(`Zona ${zone.id} guardada correctamente`);
      } catch (zoneError) {
        console.error(`Error al guardar zona ${zone.id}:`, zoneError);
        // Continuamos con la siguiente zona
      }
    }
    
    console.log("Proceso de guardado de zonas completado con éxito");
  } catch (error) {
    console.error("Error al guardar zonas:", error);
    throw new Error("No se pudieron guardar las zonas de delivery");
  }
}

/**
 * Suscripción a cambios en las zonas de delivery
 * Retorna una función para cancelar la suscripción
 */
export function subscribeToDeliveryZones(
  onZonesChange: (zones: DeliveryZone[]) => void
): Unsubscribe {
  console.log("Iniciando suscripción a cambios en zonas de delivery");
  
  const zonesRef = collection(db, DELIVERY_ZONES_COLLECTION);
  
  return onSnapshot(
    zonesRef, 
    (snapshot) => {
      if (snapshot.empty) {
        console.log("Suscripción: No hay zonas en Firestore");
        onZonesChange([]);
        return;
      }
      
      const zones = snapshot.docs.map(doc => {
        const data = doc.data() as any;
        
        // Convertir el polígono de objetos {lat, lng} de vuelta a arrays [lat, lng]
        const poligono = data.poligono && Array.isArray(data.poligono) 
          ? data.poligono.map((p: any) => [p.lat, p.lng] as [number, number])
          : [];
        
        return {
          id: doc.id,
          nombre: data.nombre,
          tarifa: data.tarifa,
          disponible: data.disponible,
          tiempoEstimado: data.tiempoEstimado,
          poligono: poligono,
          color: data.color,
          descripcion: data.descripcion || ""
        } as DeliveryZone;
      });
      
      console.log(`Suscripción: Se detectaron cambios - ${zones.length} zonas recibidas:`, zones);
      onZonesChange(zones);
    }, 
    (error) => {
      console.error("Error en la suscripción a zonas de delivery:", error);
    }
  );
}

/**
 * Inicializa las zonas de delivery con datos predeterminados si no existen
 * Esta función ya no se usa automáticamente, solo se llama manualmente desde la página de reset-zonas
 */
export async function initializeDeliveryZones(defaultZones: DeliveryZone[]): Promise<void> {
  try {
    console.log("Inicializando zonas de delivery con datos proporcionados...");
    
    // Verificar si ya existen zonas
    const zonesRef = collection(db, DELIVERY_ZONES_COLLECTION);
    const snapshot = await getDocs(zonesRef);
    
    if (snapshot.empty) {
      console.log("No hay zonas en la base de datos. Inicializando con los datos proporcionados...");
      
      // Guardar cada zona predeterminada individualmente
      for (const zone of defaultZones) {
        try {
          const zoneRef = doc(db, DELIVERY_ZONES_COLLECTION, zone.id);
          
          // Convertir el polígono a un formato compatible con Firestore
          const poligonoCompatible = zone.poligono.map(punto => {
            if (Array.isArray(punto)) {
              return { lat: punto[0], lng: punto[1] };
            }
            return { lat: punto.lat, lng: punto.lng };
          });
          
          await setDoc(zoneRef, {
            nombre: zone.nombre,
            tarifa: zone.tarifa,
            disponible: zone.disponible,
            tiempoEstimado: zone.tiempoEstimado,
            poligono: poligonoCompatible, // Formato compatible
            color: zone.color,
            descripcion: zone.descripcion || ""
          });
          
          console.log(`Zona predeterminada ${zone.id} inicializada correctamente`);
        } catch (zoneError) {
          console.error(`Error al inicializar zona ${zone.id}:`, zoneError);
        }
      }
      
      console.log("Inicialización de zonas predeterminadas completada");
    } else {
      console.log(`Ya existen ${snapshot.docs.length} zonas en la base de datos. No es necesario inicializar.`);
    }
  } catch (error) {
    console.error("Error al inicializar zonas de delivery:", error);
    throw new Error("No se pudieron inicializar las zonas de delivery");
  }
}

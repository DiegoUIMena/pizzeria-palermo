'use client'

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

// Definir el tipo para el contexto
interface AlarmsContextType {
  reproducirAlarmaNuevoPedido: () => void;
  reproducirAlarmaTiempoAgotandose: () => void;
  iniciarAlarmaRepetitiva: () => void;
  detenerAlarmaRepetitiva: () => void;
  alarmaActiva: boolean;
}

// Crear el contexto
const AlarmsContext = createContext<AlarmsContextType | undefined>(undefined);

// Hook personalizado para usar el contexto
export const useAlarms = () => {
  const context = useContext(AlarmsContext);
  if (context === undefined) {
    throw new Error('useAlarms debe ser usado dentro de un AlarmsProvider');
  }
  return context;
};

// Proveedor del contexto
export const AlarmsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [alarmaActiva, setAlarmaActiva] = useState(false);
  const intervaloAlarmaRef = useRef<number | null>(null);

  // Alarma para nuevo pedido
  const reproducirAlarmaNuevoPedido = useCallback(() => {
    try {
      console.log("🔊 Reproduciendo alarma de nuevo pedido (global)...");
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(context.destination);
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.3, context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.3);
      oscillator.start(context.currentTime);
      oscillator.stop(context.currentTime + 0.3);
      console.log("🔊 Alarma de nuevo pedido reproducida correctamente (global)");
    } catch (error) {
      console.error("Error al reproducir alarma de nuevo pedido:", error);
    }
  }, []);

  // Alarma para tiempo agotándose
  const reproducirAlarmaTiempoAgotandose = useCallback(() => {
    try {
      console.log("🔊 Reproduciendo alarma de tiempo agotándose (global)...");
      const context = new AudioContext();
      
      // Crear sonido de alarma más notorio
      // Primer tono - más grave con volumen más alto
      const oscillator1 = context.createOscillator();
      const gainNode1 = context.createGain();
      oscillator1.connect(gainNode1);
      gainNode1.connect(context.destination);
      oscillator1.frequency.value = 500;
      oscillator1.type = 'square';
      gainNode1.gain.setValueAtTime(0.4, context.currentTime);
      oscillator1.start(context.currentTime);
      oscillator1.stop(context.currentTime + 0.5);
      
      // Segundo tono - más agudo, con pequeño retraso
      const oscillator2 = context.createOscillator();
      const gainNode2 = context.createGain();
      oscillator2.connect(gainNode2);
      gainNode2.connect(context.destination);
      oscillator2.frequency.value = 800;
      oscillator2.type = 'square';
      gainNode2.gain.setValueAtTime(0.3, context.currentTime + 0.6);
      gainNode2.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 1.1);
      oscillator2.start(context.currentTime + 0.6);
      oscillator2.stop(context.currentTime + 1.1);
      
      console.log("🔊 Alarma de tiempo agotándose reproducida correctamente (global)");
    } catch (error) {
      console.error("Error al reproducir alarma de tiempo agotándose:", error);
    }
  }, []);

  // Función para iniciar la alarma repetitiva
  const iniciarAlarmaRepetitiva = useCallback(() => {
    if (intervaloAlarmaRef.current !== null) {
      return; // La alarma ya está activa
    }
    
    setAlarmaActiva(true);
    
    // Ejecutar la alarma inmediatamente la primera vez
    reproducirAlarmaNuevoPedido();
    
    // Configurar intervalo para repetir la alarma cada 3 segundos
    intervaloAlarmaRef.current = window.setInterval(() => {
      reproducirAlarmaNuevoPedido();
    }, 3000);
  }, [reproducirAlarmaNuevoPedido]);

  // Función para detener la alarma repetitiva
  const detenerAlarmaRepetitiva = useCallback(() => {
    if (intervaloAlarmaRef.current !== null) {
      clearInterval(intervaloAlarmaRef.current);
      intervaloAlarmaRef.current = null;
      setAlarmaActiva(false);
    }
  }, []);

  // Limpiar el intervalo de alarma al desmontar el componente
  useEffect(() => {
    return () => {
      if (intervaloAlarmaRef.current !== null) {
        clearInterval(intervaloAlarmaRef.current);
      }
    };
  }, []);

  // Valor del contexto
  const value = {
    reproducirAlarmaNuevoPedido,
    reproducirAlarmaTiempoAgotandose,
    iniciarAlarmaRepetitiva,
    detenerAlarmaRepetitiva,
    alarmaActiva
  };

  return <AlarmsContext.Provider value={value}>{children}</AlarmsContext.Provider>;
};

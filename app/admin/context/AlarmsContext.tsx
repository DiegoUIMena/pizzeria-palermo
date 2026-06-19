'use client'

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

// Definir el tipo para el contexto
interface AlarmsContextType {
  reproducirAlarmaNuevoPedido: () => void;
  reproducirAlarmaTiempoAgotandose: (pedidoId?: string) => void;
  iniciarAlarmaRepetitiva: () => void;
  detenerAlarmaRepetitiva: () => void;
  detenerAudiosInmediatamente: () => void;
  alarmaActiva: boolean;
  resetearContadorTiempoCritico: (pedidoId: string) => void;
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
  
  // Referencias a los audios HTML5 pre-cargados
  const audioNuevoPedidoRef = useRef<HTMLAudioElement | null>(null);
  const audioTiempoCriticoRef = useRef<HTMLAudioElement | null>(null);
  
  const audioDesbloqueadoRef = useRef(false);
  const contadorTiempoCriticoRef = useRef<Map<string, number>>(new Map()); // Contador por pedido
  const ultimaReproduccionRef = useRef<Map<string, number>>(new Map()); // Timestamp de última reproducción por pedido
  const sourcesActivosRef = useRef<HTMLAudioElement[]>([]); // Referencias a audios activos
  const alarmaNuevoPedidoPendienteRef = useRef(false);
  const alarmasTiempoCriticoPendientesRef = useRef<Set<string>>(new Set());
  const avisoBloqueoMostradoRef = useRef(false);

  // Pre-cargar los audios usando elementos HTML5 estándar (altamente compatible con pestañas en segundo plano)
  useEffect(() => {
    if (typeof window !== "undefined") {
      audioNuevoPedidoRef.current = new Audio('/sounds/nuevo_pedido.mp3');
      audioNuevoPedidoRef.current.preload = 'auto';
      audioNuevoPedidoRef.current.load();

      audioTiempoCriticoRef.current = new Audio('/sounds/tiempo_limite.mp3');
      audioTiempoCriticoRef.current.preload = 'auto';
      audioTiempoCriticoRef.current.load();

      console.log("✅ Audios HTML5 pre-cargados en memoria");
    }

    const procesarAlarmasPendientes = () => {
      if (alarmaNuevoPedidoPendienteRef.current) {
        alarmaNuevoPedidoPendienteRef.current = false;
        reproducirAlarmaNuevoPedido();
      }

      if (alarmasTiempoCriticoPendientesRef.current.size > 0) {
        const pendientes = [...alarmasTiempoCriticoPendientesRef.current];
        alarmasTiempoCriticoPendientesRef.current.clear();
        pendientes.forEach(id => {
          reproducirAlarmaTiempoAgotandose(id);
        });
      }
    };

    // Desbloquear audio con cualquier interacción del usuario
    const desbloquearAudio = () => {
      audioDesbloqueadoRef.current = true;
      avisoBloqueoMostradoRef.current = false;
      console.log("🔓 Audio HTML5 desbloqueado por interacción del usuario");
      
      // Inicializar el canal de audio con una reproducción silenciosa
      if (audioNuevoPedidoRef.current) {
        const silentPlay = audioNuevoPedidoRef.current.cloneNode(true) as HTMLAudioElement;
        silentPlay.volume = 0;
        silentPlay.play().catch(() => {});
      }
      
      procesarAlarmasPendientes();
      
      // Remover listeners después de desbloquear
      document.removeEventListener('click', desbloquearAudio);
      document.removeEventListener('keydown', desbloquearAudio);
      document.removeEventListener('touchstart', desbloquearAudio);
    };
    
    // Agregar listeners para desbloquear.
    document.addEventListener('click', desbloquearAudio);
    document.addEventListener('keydown', desbloquearAudio);
    document.addEventListener('touchstart', desbloquearAudio);
    
    return () => {
      document.removeEventListener('click', desbloquearAudio);
      document.removeEventListener('keydown', desbloquearAudio);
      document.removeEventListener('touchstart', desbloquearAudio);
      
      // Detener cualquier audio activo al desmontar
      sourcesActivosRef.current.forEach(audio => {
        try {
          audio.pause();
        } catch {}
      });
    };
  }, []);

  // Alarma para nuevo pedido (reproducción instantánea compatible con segundo plano)
  const reproducirAlarmaNuevoPedido = useCallback(() => {
    try {
      if (!audioNuevoPedidoRef.current) {
        console.warn("Audio de nuevo pedido aún no cargado");
        return;
      }

      // Si el navegador bloquea la reproducción por falta de interacción
      if (!audioDesbloqueadoRef.current) {
        alarmaNuevoPedidoPendienteRef.current = true;
        if (!avisoBloqueoMostradoRef.current) {
          avisoBloqueoMostradoRef.current = true;
          console.warn("⚠️ Audio bloqueado por el navegador. Haz clic en la página de admin para activar las alarmas.");
        }
        return;
      }
      
      // Clonar el nodo de audio para permitir reproducciones simultáneas sin interrumpirse
      const clone = audioNuevoPedidoRef.current.cloneNode(true) as HTMLAudioElement;
      clone.volume = 0.7; // Volumen al 70%
      
      sourcesActivosRef.current.push(clone);
      clone.onended = () => {
        sourcesActivosRef.current = sourcesActivosRef.current.filter(s => s !== clone);
      };
      
      // El método .play() en HTML5 Audio es tolerado en pestañas inactivas si el dominio está desbloqueado
      clone.play().catch(error => {
        console.warn("🔊 Alarma de nuevo pedido bloqueada temporalmente en segundo plano:", error.message);
        alarmaNuevoPedidoPendienteRef.current = true;
      });
      
      console.log("🔊 Alarma de nuevo pedido reproducida");
    } catch (error) {
      console.error("Error al reproducir alarma de nuevo pedido:", error);
    }
  }, []);

  // Alarma para tiempo agotándose (reproducción instantánea) - Solo 2 veces por pedido
  const reproducirAlarmaTiempoAgotandose = useCallback((pedidoId?: string) => {
    try {
      const id = pedidoId || 'default';
      
      // Verificar si se reprodujo hace menos de 3 segundos (evitar duplicados)
      const ahora = Date.now();
      const ultimaReproduccion = ultimaReproduccionRef.current.get(id) || 0;
      const tiempoDesdeUltima = ahora - ultimaReproduccion;
      
      if (tiempoDesdeUltima < 3000) {
        return;
      }
      
      // Obtener contador actual para este pedido
      const contadorActual = contadorTiempoCriticoRef.current.get(id) || 0;
      
      // Solo reproducir si no ha sonado 2 veces aún
      if (contadorActual >= 2) {
        console.log(`🔇 Alarma de tiempo crítico ya sonó 2 veces para pedido ${id}, silenciando`);
        return;
      }
      
      if (!audioTiempoCriticoRef.current) {
        console.warn("Audio de tiempo crítico aún no cargado");
        return;
      }

      if (!audioDesbloqueadoRef.current) {
        alarmasTiempoCriticoPendientesRef.current.add(id);
        return;
      }
      
      const clone = audioTiempoCriticoRef.current.cloneNode(true) as HTMLAudioElement;
      clone.volume = 0.8; // Volumen al 80%
      
      sourcesActivosRef.current.push(clone);
      clone.onended = () => {
        sourcesActivosRef.current = sourcesActivosRef.current.filter(s => s !== clone);
      };
      
      clone.play().catch(error => {
        console.warn(`🔊 Alarma de tiempo crítico para ${id} bloqueada en segundo plano:`, error.message);
        alarmasTiempoCriticoPendientesRef.current.add(id);
      });
      
      // Incrementar contador y actualizar timestamp
      contadorTiempoCriticoRef.current.set(id, contadorActual + 1);
      ultimaReproduccionRef.current.set(id, ahora);
      
      console.log(`🔊 Alarma de tiempo crítico reproducida (${contadorActual + 1}/2) para pedido ${id}`);
    } catch (error) {
      console.error("Error al reproducir alarma de tiempo agotándose:", error);
    }
  }, []);

  // Función para resetear el contador cuando un pedido cambia de estado
  const resetearContadorTiempoCritico = useCallback((pedidoId: string) => {
    contadorTiempoCriticoRef.current.delete(pedidoId);
    console.log(`🔄 Contador de alarma reseteado para pedido ${pedidoId}`);
  }, []);

  // Función para iniciar la alarma repetitiva
  const iniciarAlarmaRepetitiva = useCallback(() => {
    if (intervaloAlarmaRef.current !== null) {
      return; // La alarma ya está activa
    }
    
    console.log("🔔 Iniciando alarma repetitiva");
    setAlarmaActiva(true);
    
    // Ejecutar la alarma inmediatamente la primera vez
    reproducirAlarmaNuevoPedido();
    
    // Configurar intervalo para repetir la alarma cada 5 segundos
    intervaloAlarmaRef.current = window.setInterval(() => {
      reproducirAlarmaNuevoPedido();
    }, 5000);
  }, [reproducirAlarmaNuevoPedido]);

  // Función para detener la alarma repetitiva
  const detenerAlarmaRepetitiva = useCallback(() => {
    if (intervaloAlarmaRef.current !== null) {
      clearInterval(intervaloAlarmaRef.current);
      intervaloAlarmaRef.current = null;
      setAlarmaActiva(false);
    }
  }, []);

  // Función para detener INMEDIATAMENTE todos los audios en reproducción
  const detenerAudiosInmediatamente = useCallback(() => {
    // Detener todos los audios activos
    sourcesActivosRef.current.forEach(audio => {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch (error) {
        // Ignorar
      }
    });
    
    // Limpiar el array
    sourcesActivosRef.current = [];
    
    // También detener la alarma repetitiva si está activa
    detenerAlarmaRepetitiva();
    
    console.log("🔇 Todos los audios detenidos inmediatamente");
  }, [detenerAlarmaRepetitiva]);

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
    detenerAudiosInmediatamente,
    alarmaActiva,
    resetearContadorTiempoCritico
  };

  return <AlarmsContext.Provider value={value}>{children}</AlarmsContext.Provider>;
};

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
  const audioContextRef = useRef<AudioContext | null>(null);
  const bufferNuevoPedidoRef = useRef<AudioBuffer | null>(null);
  const bufferTiempoCriticoRef = useRef<AudioBuffer | null>(null);
  const audioDesbloqueadoRef = useRef(false);
  const contadorTiempoCriticoRef = useRef<Map<string, number>>(new Map()); // Contador por pedido
  const ultimaReproduccionRef = useRef<Map<string, number>>(new Map()); // Timestamp de última reproducción por pedido
  const sourcesActivosRef = useRef<AudioBufferSourceNode[]>([]); // Referencias a sources de audio activos

  // Pre-cargar los audios en buffers (mucho más rápido)
  useEffect(() => {
    const initAudio = async () => {
      try {
        // Crear contexto de audio
        audioContextRef.current = new AudioContext();
        
        // Cargar y decodificar audio de nuevo pedido
        const responseNuevoPedido = await fetch('/sounds/nuevo_pedido.mp3');
        const arrayBufferNuevoPedido = await responseNuevoPedido.arrayBuffer();
        bufferNuevoPedidoRef.current = await audioContextRef.current.decodeAudioData(arrayBufferNuevoPedido);
        
        // Cargar y decodificar audio de tiempo crítico
        const responseTiempoCritico = await fetch('/sounds/tiempo_limite.mp3');
        const arrayBufferTiempoCritico = await responseTiempoCritico.arrayBuffer();
        bufferTiempoCriticoRef.current = await audioContextRef.current.decodeAudioData(arrayBufferTiempoCritico);
        
        console.log("✅ Audios pre-cargados en memoria");
      } catch (error) {
        console.error("Error al pre-cargar audios:", error);
      }
    };
    
    initAudio();
    
    // Desbloquear audio con cualquier interacción del usuario
    const desbloquearAudio = async () => {
      if (audioContextRef.current && !audioDesbloqueadoRef.current) {
        // Resumir el contexto si está suspendido
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }
        audioDesbloqueadoRef.current = true;
        console.log("🔓 Audio desbloqueado por interacción del usuario");
        
        // Remover listeners después de desbloquear
        document.removeEventListener('click', desbloquearAudio);
        document.removeEventListener('keydown', desbloquearAudio);
        document.removeEventListener('touchstart', desbloquearAudio);
      }
    };
    
    // Agregar listeners para desbloquear
    document.addEventListener('click', desbloquearAudio, { once: true });
    document.addEventListener('keydown', desbloquearAudio, { once: true });
    document.addEventListener('touchstart', desbloquearAudio, { once: true });
    
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      document.removeEventListener('click', desbloquearAudio);
      document.removeEventListener('keydown', desbloquearAudio);
      document.removeEventListener('touchstart', desbloquearAudio);
    };
  }, []);

  // Alarma para nuevo pedido (reproducción instantánea)
  const reproducirAlarmaNuevoPedido = useCallback(async () => {
    try {
      if (!audioContextRef.current || !bufferNuevoPedidoRef.current) {
        console.warn("Audio aún no cargado");
        return;
      }
      
      // Asegurar que el contexto esté activo
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      // Crear source desde el buffer (instantáneo)
      const source = audioContextRef.current.createBufferSource();
      source.buffer = bufferNuevoPedidoRef.current;
      
      // Crear gain node para controlar volumen
      const gainNode = audioContextRef.current.createGain();
      gainNode.gain.value = 0.7; // Volumen al 70% para evitar saturación
      
      source.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);
      source.start(0);
      
      // Guardar referencia del source activo
      sourcesActivosRef.current.push(source);
      
      // Remover de la lista cuando termine
      source.onended = () => {
        sourcesActivosRef.current = sourcesActivosRef.current.filter(s => s !== source);
      };
      
      console.log("🔊 Alarma de nuevo pedido reproducida");
    } catch (error) {
      console.error("Error al reproducir alarma de nuevo pedido:", error);
    }
  }, []);

  // Alarma para tiempo agotándose (reproducción instantánea) - Solo 2 veces por pedido
  const reproducirAlarmaTiempoAgotandose = useCallback(async (pedidoId?: string) => {
    try {
      // Si no se proporciona pedidoId, usar 'default' como fallback
      const id = pedidoId || 'default';
      
      // Verificar si se reprodujo hace menos de 3 segundos (evitar duplicados)
      const ahora = Date.now();
      const ultimaReproduccion = ultimaReproduccionRef.current.get(id) || 0;
      const tiempoDesdeUltima = ahora - ultimaReproduccion;
      
      if (tiempoDesdeUltima < 3000) { // 3 segundos de margen
        console.log(`⏸️ Ignorando alarma de tiempo crítico para pedido ${id} (última hace ${Math.floor(tiempoDesdeUltima / 1000)}s)`);
        return;
      }
      
      // Obtener contador actual para este pedido
      const contadorActual = contadorTiempoCriticoRef.current.get(id) || 0;
      
      // Solo reproducir si no ha sonado 2 veces aún
      if (contadorActual >= 2) {
        console.log(`🔇 Alarma de tiempo crítico ya sonó 2 veces para pedido ${id}, silenciando`);
        return;
      }
      
      if (!audioContextRef.current || !bufferTiempoCriticoRef.current) {
        console.warn("Audio aún no cargado");
        return;
      }
      
      // Asegurar que el contexto esté activo
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      // Crear source desde el buffer (instantáneo)
      const source = audioContextRef.current.createBufferSource();
      source.buffer = bufferTiempoCriticoRef.current;
      
      // Crear gain node para controlar volumen
      const gainNode = audioContextRef.current.createGain();
      gainNode.gain.value = 0.8; // Volumen al 80%
      
      source.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);
      source.start(0);
      
      // Guardar referencia del source activo
      sourcesActivosRef.current.push(source);
      
      // Remover de la lista cuando termine
      source.onended = () => {
        sourcesActivosRef.current = sourcesActivosRef.current.filter(s => s !== source);
      };
      
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
      console.log("⚠️ Alarma repetitiva ya está activa, ignorando duplicado");
      return; // La alarma ya está activa
    }
    
    console.log("🔔 Iniciando alarma repetitiva");
    setAlarmaActiva(true);
    
    // Ejecutar la alarma inmediatamente la primera vez
    reproducirAlarmaNuevoPedido();
    
    // Configurar intervalo para repetir la alarma cada 5 segundos (aumentado de 3s)
    intervaloAlarmaRef.current = window.setInterval(() => {
      reproducirAlarmaNuevoPedido();
    }, 5000); // Aumentado a 5 segundos para evitar saturación
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
    // Detener todos los sources activos
    sourcesActivosRef.current.forEach(source => {
      try {
        source.stop();
      } catch (error) {
        // Ignorar error si el source ya terminó
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

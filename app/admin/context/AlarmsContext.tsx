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

// Constantes para coordinación entre pestañas
const ALARMS_CHANNEL_NAME = 'palermo_admin_alarms_channel';
const ACTIVE_TAB_STORAGE_KEY = 'palermo_admin_active_tab';
const BACKGROUND_LEADER_STORAGE_KEY = 'palermo_admin_bg_leader';

interface ActiveTabPayload {
  tabId: string;
  timestamp: number;
  isVisible: boolean;
}

interface LeaderPayload {
  tabId: string;
  heartbeat: number;
}

// Helpers para localStorage
function getActiveTabInfo(): ActiveTabPayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setActiveTabInfo(info: ActiveTabPayload): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, JSON.stringify(info));
  } catch {}
}

function soyLiderEnSegundoPlano(tabId: string): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const ahora = Date.now();
    const raw = localStorage.getItem(BACKGROUND_LEADER_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(BACKGROUND_LEADER_STORAGE_KEY, JSON.stringify({ tabId, heartbeat: ahora }));
      return true;
    }
    const leader: LeaderPayload = JSON.parse(raw);
    if (leader.tabId === tabId) {
      localStorage.setItem(BACKGROUND_LEADER_STORAGE_KEY, JSON.stringify({ tabId, heartbeat: ahora }));
      return true;
    }
    // Si el líder no renueva heartbeat hace más de 4 segundos, asumimos el rol
    if (ahora - leader.heartbeat > 4000) {
      localStorage.setItem(BACKGROUND_LEADER_STORAGE_KEY, JSON.stringify({ tabId, heartbeat: ahora }));
      return true;
    }
    return false;
  } catch {
    return true;
  }
}

// Proveedor del contexto
export const AlarmsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [alarmaActiva, setAlarmaActiva] = useState(false);
  const intervaloAlarmaRef = useRef<number | null>(null);
  const workerRef = useRef<Worker | null>(null);
  
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

  // Identificador único de pestaña y canal de broadcast
  const tabIdRef = useRef<string>('');
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  if (typeof window !== 'undefined' && !tabIdRef.current) {
    tabIdRef.current = window.name && window.name.startsWith('palermo_tab_')
      ? window.name
      : (window.name = `palermo_tab_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`);
  }

  // Comprueba si esta pestaña específica es la autorizada para reproducir sonido
  const debeSonarEnEstaPestaña = useCallback((): boolean => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false;

    const tabId = tabIdRef.current;
    const esVisible = document.visibilityState === 'visible';

    // 1. Si esta pestaña está visible (en pantalla):
    if (esVisible) {
      setActiveTabInfo({ tabId, timestamp: Date.now(), isVisible: true });
      return true;
    }

    // 2. Si esta pestaña está en segundo plano (oculta o minimizada):
    const activeTab = getActiveTabInfo();
    const ahora = Date.now();
    // Si hay otra pestaña visible recientemente (< 4 segundos), ella reproducirá el sonido
    if (activeTab && activeTab.isVisible && (ahora - activeTab.timestamp < 4000) && activeTab.tabId !== tabId) {
      console.log(`🔇 [AlarmsContext] Alarma silenciada en pestaña en segundo plano (${tabId}) porque la pestaña ${activeTab.tabId} está activa y visible.`);
      return false;
    }

    // 3. Si NINGUNA pestaña está visible (navegador minimizado en Windows):
    // Una sola pestaña actúa como líder para que la alarma suene pero NUNCA se acople
    const soyLider = soyLiderEnSegundoPlano(tabId);
    if (!soyLider) {
      console.log(`🔇 [AlarmsContext] Alarma silenciada en pestaña (${tabId}) para delegar a la pestaña líder en segundo plano.`);
    }
    return soyLider;
  }, []);

  // Función interna para detener la alarma repetitiva local
  const detenerAlarmaRepetitivaLocal = useCallback(() => {
    if (workerRef.current !== null) {
      workerRef.current.postMessage('stop');
      workerRef.current.terminate();
      workerRef.current = null;
    }
    if (intervaloAlarmaRef.current !== null) {
      clearInterval(intervaloAlarmaRef.current);
      intervaloAlarmaRef.current = null;
    }
    setAlarmaActiva(false);
  }, []);

  // Función interna para detener audios locales
  const detenerAudiosLocales = useCallback(() => {
    sourcesActivosRef.current.forEach(audio => {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {}
    });
    sourcesActivosRef.current = [];
    detenerAlarmaRepetitivaLocal();
  }, [detenerAlarmaRepetitivaLocal]);

  // Función para detener la alarma repetitiva (con sincronización global a todas las pestañas)
  const detenerAlarmaRepetitiva = useCallback(() => {
    detenerAlarmaRepetitivaLocal();
    try {
      broadcastChannelRef.current?.postMessage({
        type: 'DETENER_AUDIOS_GLOBAL',
        fromTabId: tabIdRef.current
      });
    } catch {}
  }, [detenerAlarmaRepetitivaLocal]);

  // Función para detener INMEDIATAMENTE todos los audios en reproducción (con sincronización global)
  const detenerAudiosInmediatamente = useCallback(() => {
    detenerAudiosLocales();
    try {
      broadcastChannelRef.current?.postMessage({
        type: 'DETENER_AUDIOS_GLOBAL',
        fromTabId: tabIdRef.current
      });
    } catch {}
    console.log(`🔇 [AlarmsContext] Todos los audios detenidos y silenciados globalmente desde pestaña [${tabIdRef.current}]`);
  }, [detenerAudiosLocales]);

  // Pre-cargar los audios usando elementos HTML5 estándar
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

    // Inicializar BroadcastChannel para sincronización entre pestañas
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const channel = new BroadcastChannel(ALARMS_CHANNEL_NAME);
        broadcastChannelRef.current = channel;

        channel.onmessage = (event) => {
          const data = event.data;
          if (!data || typeof data !== 'object') return;

          // Si otra pestaña solicitó detener todos los audios inmediatamente
          if (data.type === 'DETENER_AUDIOS_GLOBAL' && data.fromTabId !== tabIdRef.current) {
            console.log(`🔇 [AlarmsContext] Detención de audios recibida desde pestaña ${data.fromTabId}`);
            detenerAudiosLocales();
          }

          // Si otra pestaña reclama visibilidad activa
          if (data.type === 'TAB_VISIBLE' && data.fromTabId !== tabIdRef.current) {
            // Si estábamos sonando en segundo plano, cedemos el paso de inmediato a la pestaña visible
            if (document.visibilityState !== 'visible') {
              console.log(`👀 [AlarmsContext] Otra pestaña (${data.fromTabId}) pasó a estar activa; transfiriendo sonido.`);
              detenerAudiosLocales();
            }
          }
        };
      }
    } catch (e) {
      console.warn("⚠️ BroadcastChannel no soportado, continuando con sincronización estándar:", e);
    }

    // Monitorear foco y visibilidad de la pestaña actual
    const actualizarVisibilidad = () => {
      const isVisible = document.visibilityState === 'visible';
      if (isVisible) {
        setActiveTabInfo({ tabId: tabIdRef.current, timestamp: Date.now(), isVisible: true });
        broadcastChannelRef.current?.postMessage({ type: 'TAB_VISIBLE', fromTabId: tabIdRef.current });
      }
    };

    actualizarVisibilidad();
    document.addEventListener('visibilitychange', actualizarVisibilidad);
    window.addEventListener('focus', actualizarVisibilidad);

    // Heartbeat periódico si la pestaña está activa
    const heartbeatTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        setActiveTabInfo({ tabId: tabIdRef.current, timestamp: Date.now(), isVisible: true });
      } else {
        // En segundo plano, renovar heartbeat solo si somos el líder
        const ahora = Date.now();
        const raw = localStorage.getItem(BACKGROUND_LEADER_STORAGE_KEY);
        if (raw) {
          try {
            const leader = JSON.parse(raw);
            if (leader.tabId === tabIdRef.current && (ahora - leader.heartbeat <= 4000)) {
              localStorage.setItem(BACKGROUND_LEADER_STORAGE_KEY, JSON.stringify({ tabId: tabIdRef.current, heartbeat: ahora }));
            }
          } catch {}
        }
      }
    }, 2000);

    const procesarAlarmasPendientes = () => {
      if (alarmaNuevoPedidoPendienteRef.current) {
        alarmaNuevoPedidoPendienteRef.current = false;
        reproducirAlarmaNuevoPedido();
      }

      if (alarmasTiempoCriticoPendientesRef.current.size > 0) {
        const pendientes = Array.from(alarmasTiempoCriticoPendientesRef.current);
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
    
    // Agregar listeners para desbloquear
    document.addEventListener('click', desbloquearAudio);
    document.addEventListener('keydown', desbloquearAudio);
    document.addEventListener('touchstart', desbloquearAudio);
    
    return () => {
      clearInterval(heartbeatTimer);
      document.removeEventListener('visibilitychange', actualizarVisibilidad);
      window.removeEventListener('focus', actualizarVisibilidad);
      document.removeEventListener('click', desbloquearAudio);
      document.removeEventListener('keydown', desbloquearAudio);
      document.removeEventListener('touchstart', desbloquearAudio);
      
      broadcastChannelRef.current?.close();

      // Detener cualquier audio activo al desmontar
      sourcesActivosRef.current.forEach(audio => {
        try {
          audio.pause();
        } catch {}
      });
    };
  }, [detenerAudiosLocales]);

  // Alarma para nuevo pedido (reproducción instantánea compatible con segundo plano)
  const reproducirAlarmaNuevoPedido = useCallback(() => {
    try {
      // 🛡️ REGLA MULTI-PESTAÑA: Verificar si esta pestaña debe sonar
      if (!debeSonarEnEstaPestaña()) {
        return;
      }

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
      
      clone.play().catch(error => {
        console.warn("🔊 Alarma de nuevo pedido bloqueada temporalmente en segundo plano:", error.message);
        alarmaNuevoPedidoPendienteRef.current = true;
      });
      
      console.log(`🔊 Alarma de nuevo pedido reproducida exclusivamente en pestaña [${tabIdRef.current}]`);
    } catch (error) {
      console.error("Error al reproducir alarma de nuevo pedido:", error);
    }
  }, [debeSonarEnEstaPestaña]);

  // Alarma para tiempo agotándose (reproducción instantánea) - Solo 2 veces por pedido
  const reproducirAlarmaTiempoAgotandose = useCallback((pedidoId?: string) => {
    try {
      // 🛡️ REGLA MULTI-PESTAÑA: Verificar si esta pestaña debe sonar
      if (!debeSonarEnEstaPestaña()) {
        return;
      }

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
      
      console.log(`🔊 Alarma de tiempo crítico reproducida (${contadorActual + 1}/2) en pestaña [${tabIdRef.current}] para pedido ${id}`);
    } catch (error) {
      console.error("Error al reproducir alarma de tiempo agotándose:", error);
    }
  }, [debeSonarEnEstaPestaña]);

  // Función para resetear el contador cuando un pedido cambia de estado
  const resetearContadorTiempoCritico = useCallback((pedidoId: string) => {
    contadorTiempoCriticoRef.current.delete(pedidoId);
    console.log(`🔄 Contador de alarma reseteado para pedido ${pedidoId}`);
  }, []);

  // Función para iniciar la alarma repetitiva
  const iniciarAlarmaRepetitiva = useCallback(() => {
    if (workerRef.current !== null || intervaloAlarmaRef.current !== null) {
      return; // La alarma ya está activa
    }
    
    // Si esta pestaña no es la autorizada para sonar, no iniciar reproducciones sonoras
    if (!debeSonarEnEstaPestaña()) {
      return;
    }

    console.log(`🔔 Iniciando alarma repetitiva en pestaña [${tabIdRef.current}] (Web Worker para segundo plano)`);
    setAlarmaActiva(true);
    
    // Ejecutar la alarma inmediatamente la primera vez
    reproducirAlarmaNuevoPedido();
    
    // Inicializar un Web Worker inline para el intervalo
    try {
      const code = `
        let timer = null;
        self.onmessage = function(e) {
          if (e.data === 'start') {
            if (timer) clearInterval(timer);
            timer = setInterval(() => {
              self.postMessage('tick');
            }, 5000);
          } else if (e.data === 'stop') {
            if (timer) clearInterval(timer);
          }
        }
      `;
      const blob = new Blob([code], { type: 'application/javascript' });
      workerRef.current = new Worker(URL.createObjectURL(blob));
      workerRef.current.onmessage = (e) => {
        if (e.data === 'tick') {
          reproducirAlarmaNuevoPedido();
        }
      };
      workerRef.current.postMessage('start');
    } catch (error) {
      console.warn("⚠️ No se pudo iniciar Web Worker para alarma, usando setInterval tradicional:", error);
      intervaloAlarmaRef.current = window.setInterval(() => {
        reproducirAlarmaNuevoPedido();
      }, 5000);
    }
  }, [debeSonarEnEstaPestaña, reproducirAlarmaNuevoPedido]);

  // Limpiar al desmontar el componente
  useEffect(() => {
    return () => {
      if (workerRef.current !== null) {
        workerRef.current.postMessage('stop');
        workerRef.current.terminate();
      }
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

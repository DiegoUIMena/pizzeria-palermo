export type TipoMensajeContacto =
  | "Consulta"
  | "Solicitud"
  | "Reclamo"
  | "Sugerencia"
  | "Felicitaciones"
  | "Otro";

export type EstadoContacto = "Pendiente" | "En revisión" | "Respondido" | "Cerrado";

export type PrioridadContacto = "Normal" | "Alta" | "Baja";

export interface Contacto {
  id: string;
  nombre: string;
  correo: string;
  telefono: string; // opcional
  tipo: TipoMensajeContacto;
  asunto: string;
  mensajeOriginal: string;
  estado: EstadoContacto;
  prioridad: PrioridadContacto;
  fechaCreacion: string; // ISO
  fechaActualizacion: string; // ISO
  usuarioId: string | null;
  usuarioRegistrado: boolean;
  direccionIPHash: string;
  userAgent: string;
  leido: boolean;
  archivado: boolean;
  ultimaRespuesta: string | null;
  cantidadRespuestas: number;
  ultimoCambioEstado: string | null;
  ultimaActividad: string; // ISO
  ultimaRespuestaPor: string | null;
  version: number;
}

export interface RespuestaContacto {
  id: string;
  mensaje: string;
  fecha: string; // ISO
  administradorId: string;
  administradorNombre: string;
  administradorCorreo: string;
  emailDestino: string;
  emailEnviado: boolean;
  messageIdSMTP: string | null;
  resultadoSMTP: string | null;
  errorSMTP: string | null;
  tipoRespuesta: "email";
  observacionesInternas: string;
}

export interface AuditoriaContacto {
  id: string;
  accion: string; // "Mensaje creado" | "Mensaje leído" | "Cambio de estado" | "Respuesta enviada" | "Respuesta fallida" | etc.
  fecha: string; // ISO
  usuarioId: string;
  usuarioNombre: string;
  detalles: string;
}

export interface CrearContactoPayload {
  nombre: string;
  correo: string;
  telefono?: string;
  tipo: TipoMensajeContacto;
  asunto: string;
  mensaje: string;
  cargadoEn: number; // para tiempo mínimo
  honeypot?: string; // campo honeypot
}

export interface ResponderContactoPayload {
  contactoId: string;
  mensaje: string;
  observacionesInternas?: string;
}

export interface CambiarEstadoPayload {
  contactoId: string;
  nuevoEstado: EstadoContacto;
}

export interface MarcarLeidoPayload {
  contactoId: string;
  leido: boolean;
}

export interface ArchivarPayload {
  contactoId: string;
  archivado: boolean;
}

export interface ObtenerContactosPaginadosPayload {
  pageSize: number;
  lastDocId?: string | null;
  filtros?: {
    estado?: EstadoContacto;
    tipo?: TipoMensajeContacto;
    leido?: boolean;
    archivado?: boolean;
    correo?: string;
    nombre?: string;
    asunto?: string;
    usuarioId?: string;
  };
}

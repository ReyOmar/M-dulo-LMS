/**
 * Shared TypeScript interfaces for the LMS frontend.
 * These mirror the Prisma models for type-safe state management
 * and replace all `any` usage across components.
 */

// ── Enums ──

export type RolUsuario = 'ADMINISTRADOR' | 'PROFESOR' | 'ESTUDIANTE';
export type EstadoCurso = 'BORRADOR' | 'PUBLICADO' | 'ARCHIVADO';
export type NivelDificultad = 'PRINCIPIANTE' | 'INTERMEDIO' | 'AVANZADO' | 'EXPERTO';
export type TipoRecurso = 'TEXTO' | 'VIDEO' | 'PDF' | 'ENLACE' | 'TAREA';
export type EstadoEntrega = 'BORRADOR' | 'ENTREGADA' | 'ENTREGADA_TARDE' | 'CALIFICADA' | 'EN_REVISION';
export type EstadoSolicitud = 'PENDIENTE' | 'ACEPTADA' | 'RECHAZADA';

// ── Core Models ──

export interface Usuario {
  guid: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: RolUsuario;
  role?: string; // Alias used by some API responses
  activo: boolean;
  created_at: string;
  updated_at?: string;
  ultimo_acceso?: string;
  firma_url?: string;
  firma_nombre?: string;
  firma_cargo?: string;
}

export interface Curso {
  guid: string;
  titulo: string;
  descripcion?: string;
  descripcion_corta?: string;
  imagen_portada?: string;
  nivel: NivelDificultad;
  estado: EstadoCurso;
  duracion_horas?: number;
  fecha_inicio?: string;
  fecha_fin?: string;
  codigo_acceso?: string;
  max_estudiantes?: number;
  escala: string;
  nota_aprobacion: number;
  orden_estricto: boolean;
  emite_certificado: boolean;
  profesor_guid: string;
  profesor?: Usuario;
  modulos?: Modulo[];
  created_at: string;
  updated_at?: string;
}

export interface Modulo {
  guid: string;
  curso_guid: string;
  titulo: string;
  descripcion?: string;
  orden: number;
  requiere_anterior: boolean;
  lecciones?: Leccion[];
  created_at: string;
  updated_at?: string;
}

export interface Leccion {
  guid: string;
  modulo_guid: string;
  titulo: string;
  descripcion?: string;
  orden: number;
  recursos?: Recurso[];
  created_at: string;
  updated_at?: string;
}

export interface Recurso {
  guid: string;
  leccion_guid: string;
  titulo: string;
  tipo: TipoRecurso;
  contenido_html?: string;
  url_archivo?: string;
  url_referencia?: string;
  archivo_adjunto?: string;
  archivo_adjunto_nombre?: string;
  archivo_max_size_mb?: number;
  quiz_config?: string;
  orden: number;
  obligatorio: boolean;
  tiempo_lectura?: number;
  created_at: string;
  updated_at?: string;
}

export interface Entrega {
  guid: string;
  usuario_guid: string;
  tarea_guid?: string;
  url_archivo_adjunto?: string;
  respuesta_texto?: string;
  estado: EstadoEntrega;
  intento_numero: number;
  fecha_inicio?: string;
  fecha_entrega?: string;
  contenido_texto?: string;
  calificacion?: number;
  comentario_calificacion?: string;
  ip_address?: string;
  created_at: string;
  updated_at?: string;

  // Denormalized fields from JOIN queries (examiner endpoints)
  curso_guid?: string;
  curso_titulo?: string;
  tarea_titulo?: string;
  modulo_titulo?: string;
  estudiante?: {
    guid: string;
    nombre: string;
    apellido: string;
    email: string;
  };
}

export interface SolicitudAcceso {
  id: number;
  email: string;
  nombre: string;
  apellido: string;
  rol_pedido: RolUsuario;
  estado: EstadoSolicitud;
  created_at: string;
}

export interface Notificacion {
  id: number;
  usuario_guid: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  url_accion?: string;
  ref_tipo?: string;
  ref_guid?: string;
  created_at: string;
}

export interface Certificado {
  guid: string;
  usuario_guid: string;
  curso_guid: string;
  fecha_emision: string;
  codigo_verificacion: string;
  titulo_curso: string;
  nombre_estudiante: string;
}

// ── Dashboard Stats ──

export interface AdminDashboardStats {
  usuarios: {
    total: number;
    estudiantes: number;
    profesores: number;
    administradores: number;
  };
  cursos: {
    publicados: number;
    borrador: number;
  };
  promedioGlobal: number;
  totalMatriculas: number;
  weeklyActivity: { day: string; sesiones: number; entregas: number }[];
  courseDistribution: { name: string; value: number; color: string }[];
}

export interface StudentMetricas {
  total_horas_invertidas: number;
  cursos_completados: number;
  total_cursos: number;
}

export interface ProgresoResponse {
  completados: string[];
  desbloqueados_por_tiempo?: string[];
  total_recursos: number;
  tareas_pendientes_calificacion?: {
    recurso_guid: string;
    tarea_titulo: string;
    fecha_entrega: string;
  }[];
}

// ── Chat / Messages ──

export interface ChatContacto {
  guid: string;
  nombre: string;
  apellido: string;
  rol: RolUsuario;
  no_leidos: number;
  ultimo_mensaje?: string;
  ultimo_fecha?: string;
}

export interface Mensaje {
  id: number;
  remitente_guid: string;
  destinatario_guid: string;
  asunto: string;
  contenido: string;
  leido: boolean;
  created_at: string;
}

// ── User Session (stored in localStorage) ──

export interface SessionUser {
  guid: string;
  nombre: string;
  apellido: string;
  email: string;
  role: string; // Backend returns 'ADMINISTRADOR' | 'PROFESOR' | 'ESTUDIANTE'
  rol?: string;
}

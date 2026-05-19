/**
 * Typed WebSocket event payloads for the LMS real-time system.
 * Shared contract between API (emitter) and client (consumer).
 */

// ── Event names ──

export type LmsWsEvent =
  | 'session:revoked'
  | 'user:deleted'
  | 'user:created'
  | 'user:updated'
  | 'request:new'
  | 'request:resolved'
  | 'course:updated'
  | 'course:created'
  | 'course:deleted'
  | 'course:editing'
  | 'course:editing-released'
  | 'course:editing-sync'
  | 'course:maintenance'
  | 'enrollment:changed'
  | 'submission:new'
  | 'submission:graded'
  | 'config:updated'
  | 'presence:update'
  | 'presence:sync'
  | 'dashboard:refresh'
  | 'notification:new'
  | 'notification:read'
  | 'message:new'
  | 'certificate:new'
  | 'pesv-bridge:sync'
  | 'pesv-bridge:subsanacion';

// ── Event payloads ──

export interface SessionRevokedPayload {
  reason: 'new_session' | 'account_deleted' | 'session_expired';
  message?: string;
}

export interface DashboardRefreshPayload {
  reason:
    | 'submission_new'
    | 'submission_graded'
    | 'enrollment_changed'
    | 'course_created'
    | 'course_updated'
    | 'course_deleted'
    | 'course_assigned'
    | 'course_unassigned'
    | 'user_created'
    | 'user_updated'
    | 'user_deleted'
    | 'user_connected'
    | 'user_disconnected'
    | 'user_password_setup'
    | 'request_resolved'
    | 'course_completed'
    | 'pesv_bridge_sync'
    | 'pesv_bridge_subsanacion'
    | 'pesv_bridge_retry'
    | 'pesv_user_created'
    | 'certificate_generated';
}

export interface SubmissionNewPayload {
  tarea_guid: string;
  usuario_guid: string;
  estado: string;
}

export interface SubmissionGradedPayload {
  guid: string;
  tarea_guid: string | null;
  calificacion: number;
  usuario_guid: string;
}

export interface EnrollmentChangedPayload {
  action: 'enrolled' | 'unenrolled';
  curso_guid: string;
  usuario_guid: string;
}

export interface PresenceUpdatePayload {
  guid: string;
  status: 'online' | 'offline';
}

export interface CourseEditingPayload {
  curso_guid: string;
  editor: {
    guid: string;
    role: string;
    nombre: string;
  };
}

export interface ConfigUpdatedPayload {
  [key: string]: unknown;
}

// ── Envelope ──

export interface WsMessage<T = Record<string, unknown>> {
  event: LmsWsEvent;
  data: T;
  timestamp: number;
}

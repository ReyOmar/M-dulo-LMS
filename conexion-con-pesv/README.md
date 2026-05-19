# Conexión con PESV — Módulo de Integración

## Descripción

Esta carpeta contiene la documentación y archivos de referencia para la integración entre el **Módulo LMS** y el sistema PESV. La integración permite que al registrarse una infracción en el PESV, el conductor sea automáticamente inscrito en el curso correctivo correspondiente del LMS.

> **IMPORTANTE**: Esta integración es completamente opcional. El LMS funciona al 100% sin ella. Para desactivarla: `PESV_BRIDGE_ENABLED=false` en el `.env`.

## Contenido de esta carpeta

| Archivo | Descripción |
|---------|-------------|
| `README.md` | Esta documentación |
| `pesv-schema.prisma` | Copia de referencia del schema Prisma readonly que mapea las tablas del PESV |
| `pesv-prisma.config.ts` | Copia de referencia de la configuración Prisma para generar el cliente PESV |

> Los archivos `.prisma` y `.config.ts` aquí son copias de referencia. Los originales que usa el sistema están en `apps/api/prisma/` y `apps/api/`.

## Ubicación del código ejecutable

```
apps/api/src/pesv-bridge/
├── pesv-prisma.service.ts     # Cliente Prisma readonly hacia la BD del PESV
├── pesv-bridge.service.ts     # Sincronización, matrícula automática, detección de certificados
├── pesv-bridge.controller.ts  # Endpoints REST (solo rol ADMINISTRADOR)
└── pesv-bridge.module.ts      # Módulo NestJS autocontenido
```

Tabla de tracking en el schema principal del LMS:
- `apps/api/prisma/schema.prisma` → modelo `lms_pesv_bridge_registros`

## Variables de entorno requeridas

Agregar al `.env` raíz del proyecto LMS:
```env
PESV_DATABASE_URL="mysql://usuario_readonly:contraseña@host:puerto/nombre_bd_pesv"
PESV_BRIDGE_ENABLED=true
PESV_BRIDGE_SYNC_INTERVAL_MINUTES=5
```

## Flujo de la integración

1. **Cron cada 5 min** → Escanea nuevas infracciones en la BD del PESV (solo lectura)
2. **Obtiene datos del conductor** → email, nombre, tipo de infracción
3. **Busca o crea usuario en el LMS** como ESTUDIANTE (token de invitación seguro)
4. **Match de curso** por nombre exacto: `tipo_infraccion.termino` = `curso.titulo`
5. **Si curso existe** → Matrícula automática → Estado: `MATRICULADO`
6. **Si curso NO existe** → Estado: `CURSO_NO_ENCONTRADO` → Alerta al admin
7. **Retry cada 10 min** para cursos pendientes (el admin puede crearlo después)
8. **Al completar el curso** → Se genera certificado → Estado: `SUBSANADO`

## Interfaz de administración

La sección **"Solicitudes y Registro"** del panel de administración tiene dos pestañas:

- **Solicitudes** — Gestión de solicitudes de acceso (funcionalidad original)
- **Registro PESV** — Panel de monitoreo de la integración con:
  - Tarjetas de estadísticas (total, matriculados, subsanados, pendientes, errores)
  - Indicador de conexión a la BD del PESV (en tiempo real)
  - Búsqueda y filtro por estado
  - Botón de sincronización manual
  - Tabla responsive con badges de estado

## Seguridad

- Solo se ejecutan consultas `SELECT` contra la BD del PESV (nunca escribe)
- Todos los endpoints protegidos por JWT + rol `ADMINISTRADOR`
- Rate limiting global aplicado (200 req/min)
- Usuarios creados sin contraseña, con token de invitación hasheado (SHA-256)
- Se puede deshabilitar completamente sin afectar ninguna funcionalidad del LMS

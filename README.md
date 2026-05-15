# 🎓 LMS PESV Education

Sistema de Gestion de Aprendizaje (LMS) profesional para capacitacion empresarial en Seguridad Vial (PESV).

## Arquitectura

```
M-dulo-LMS/
├── apps/
│   ├── api/          # Backend — NestJS + Fastify + Prisma + WebSockets
│   └── client/       # Frontend — Next.js 15 + React 19 + TailwindCSS v4
├── .env              # Variables de entorno (NO versionar)
├── docker-compose.yml
└── package.json      # Scripts del monorepo
```

### Tech Stack

| Capa | Tecnologia |
|------|-----------|
| **Backend** | NestJS 11, Fastify, Prisma ORM 7, WebSockets (ws) |
| **Frontend** | Next.js 15, React 19, TailwindCSS v4, Recharts |
| **Base de Datos** | MySQL / MariaDB |
| **Autenticacion** | JWT (HS256), bcryptjs, Guards + Roles |
| **Archivos** | Cloudflare R2 / Almacenamiento local |
| **Correo** | Nodemailer (SMTP) con plantillas dinamicas |
| **Certificados** | PDFKit (generacion dinamica de PDFs) |

### Roles del Sistema

| Rol | Descripcion |
|-----|------------|
| **Administrador** | Gestion completa: usuarios, cursos, configuracion, certificados |
| **Profesor/Supervisor** | Calificacion de tareas, monitoreo de estudiantes, firma digital |
| **Estudiante/Capacitado** | Cursos, tareas, quizzes, certificados, mensajeria |

---

## Inicio Rapido

### Prerrequisitos

- Node.js >= 18
- Docker & Docker Compose (para la base de datos)

### 1. Instalar dependencias

```bash
npm run init
```

### 2. Levantar la base de datos

```bash
docker-compose up -d
```

### 3. Sincronizar schema y seed

```bash
# Desde apps/api:
npx prisma db push
npx prisma db seed
```

> **El seed genera contrasenas aleatorias**. Se mostraran en la consola una sola vez. Guardalas.

### 4. Configurar variables de entorno

Copia `.env.example` a `.env` y completa las variables requeridas:

- `JWT_SECRET` — Secreto para firmar tokens JWT (minimo 16 caracteres)
- `DATABASE_URL` — URL de conexion a la base de datos MySQL
- Variables SMTP opcionales para correo electronico
- Variables R2 opcionales para almacenamiento en la nube

### 5. Iniciar en modo desarrollo

```bash
npm run dev
```

- **API**: http://localhost:3200/api
- **Frontend**: http://localhost:3100
- **Swagger** (solo dev): http://localhost:3200/docs

---

## Scripts Disponibles

| Script | Descripcion |
|--------|------------|
| `npm run dev` | Inicia API + Client en modo desarrollo |
| `npm run typecheck` | Verificacion TypeScript de ambos |
| `npm run db:push` | Sincroniza schema con la DB |
| `npm run db:seed` | Ejecuta el seed (solo desarrollo) |
| `npm run db:generate` | Regenera el cliente Prisma |

---

## Seguridad

- **JWT** con secreto mínimo de 16 caracteres, validado al arranque
- **Guards globales**: `JwtAuthGuard` → `RolesGuard` → `ThrottlerGuard`
- **Helmet** para headers de seguridad (X-Frame-Options, HSTS, etc.)
- **Rate Limiting** global con `@nestjs/throttler`
- **Validación de DTOs** con `class-validator` + `whitelist: true`
- **Token Revocation** en logout y eliminación de usuarios
- **bcrypt** para hashing de contraseñas (salt rounds: 10)
- **CORS** configurable por entorno
- **Storage Zero Trust**: archivos privados con `Cache-Control: private, no-store` y sin redirección a CDN
- **Validación de rutas de archivo** en DTOs con `@IsSafeStorageKey()` — previene path traversal
- **Tokens de invitación** para setup de primera contraseña (previene account takeover)
- **WebSocket authorization**: tokens efímeros de uso único (no JWT en query string)
- **Exception filter global**: errores consistentes en JSON, sin stack traces, URLs sanitizadas

---

## Escala de Calificación

El sistema usa escala **0.0 a 5.0** por defecto:
- **Nota mínima de aprobación**: 3.0 (configurable por curso)
- Los quizzes se auto-califican
- Las tareas se califican manualmente por el supervisor

---

## Comunicación en Tiempo Real

WebSocket events principales (segmentados por rol/usuario):

| Evento | Destinatario | Descripción |
|--------|-------------|-------------|
| `dashboard:refresh` | Segmentado | Refrescar datos (por usuario afectado o por rol) |
| `submission:graded` | Estudiante | Entrega calificada |
| `submission:new` | Profesor + Admin | Nueva entrega recibida |
| `notification:new` | Usuario | Nueva notificación |
| `course:lock` / `course:unlock` | Admin/Profesor | Bloqueo de edición de curso |
| `config:updated` | Todos | Configuración de plataforma actualizada |
| `certificate:generated` | Estudiante | Certificado generado |

---

## Estructura de Carpetas

```
apps/api/src/
├── auth/            # Autenticación, usuarios, tokens
├── certificados/    # Generación y gestión de certificados PDF
├── common/          # Filters, guards, decorators, validators, utils
├── configuracion/   # Configuración de plataforma
├── cursos/          # CRUD de cursos, módulos, bloques, quizzes
├── dashboards/      # Estadísticas y monitoreo
├── estudiantes/     # Progreso, métricas, heartbeats
├── evaluaciones/    # Entregas y calificaciones
├── health/          # Health check endpoint
├── mail/            # Plantillas y envío de correo
├── matriculas/      # Inscripciones
├── notificaciones/  # Chat y notificaciones push
├── prisma/          # Servicio Prisma (DB)
├── scheduler/       # Tareas programadas
├── storage/         # Almacenamiento R2/local con validación
└── ws/              # WebSocket gateway y tokens efímeros
```

---

## Licencia

Proyecto privado — Todos los derechos reservados.


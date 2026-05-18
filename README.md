# 🎓 LMS PESV Education

Sistema de Gestión de Aprendizaje (LMS) profesional para capacitación empresarial en Seguridad Vial (PESV).

## Arquitectura

```
M-dulo-LMS/
├── apps/
│   ├── api/          # Backend — NestJS + Fastify + Prisma + WebSockets
│   └── client/       # Frontend — Next.js 15 + React 19 + TailwindCSS v4
├── .env              # Variables de entorno (NO versionar)
├── pnpm-workspace.yaml
└── package.json      # Scripts del monorepo
```

### Tech Stack

| Capa | Tecnología |
|------|-----------|
| **Backend** | NestJS 11, Fastify, Prisma ORM 7, WebSockets (ws) |
| **Frontend** | Next.js 15, React 19, TailwindCSS v4, Recharts |
| **Base de Datos** | MySQL / MariaDB |
| **Autenticación** | JWT (HS256), bcryptjs, Guards + Roles |
| **Archivos** | Cloudflare R2 / Almacenamiento local |
| **Correo** | Nodemailer (SMTP) con plantillas dinámicas |
| **Certificados** | PDFKit (generación dinámica de PDFs) |
| **Gestor de paquetes** | pnpm (workspace monorepo) |

### Roles del Sistema

| Rol | Descripción |
|-----|------------|
| **Administrador** | Gestión completa: usuarios, cursos, configuración, certificados |
| **Profesor/Supervisor** | Calificación de tareas, monitoreo de estudiantes, firma digital |
| **Estudiante/Capacitado** | Cursos, tareas, quizzes, certificados, mensajería |

---

## Inicio Rápido

### Prerrequisitos

- Node.js >= 18
- [pnpm](https://pnpm.io/installation) (se instala automáticamente vía `corepack enable`)
- Docker & Docker Compose (para la base de datos)

> **Windows**: Si `pnpm` falla en PowerShell por política de ejecución, usa `pnpm.cmd` o habilita Developer Mode.

### 1. Instalar dependencias

```bash
pnpm run init
```

### 2. Levantar la base de datos

```bash
docker-compose up -d
```

### 3. Sincronizar schema y seed

```bash
pnpm --filter api exec prisma db push
pnpm --filter api exec prisma db seed
```

> **El seed genera contraseñas aleatorias**. Se mostrarán en la consola una sola vez. Guárdalas.

### 4. Configurar variables de entorno

Copia `.env.example` a `.env` y completa las variables requeridas:

- `JWT_SECRET` — Secreto para firmar tokens JWT (mínimo 16 caracteres)
- `DATABASE_URL` — URL de conexión a la base de datos MySQL
- Variables SMTP opcionales para correo electrónico
- Variables R2 opcionales para almacenamiento en la nube

> **No** definas `NODE_ENV` en `.env` — los frameworks lo detectan automáticamente.

### 5. Iniciar en modo desarrollo

```bash
pnpm dev
```

- **API**: http://localhost:3200/api
- **Frontend**: http://localhost:3100
- **Swagger** (solo dev): http://localhost:3200/docs

---

## Scripts Disponibles

| Script | Descripción |
|--------|------------|
| `pnpm dev` | Inicia API + Client en modo desarrollo |
| `pnpm run build` | Build completo de API + Client |
| `pnpm run typecheck` | Verificación TypeScript de ambos |
| `pnpm test` | Ejecuta tests de la API |
| `pnpm run db:push` | Sincroniza schema con la DB |
| `pnpm run db:seed` | Ejecuta el seed (solo desarrollo) |
| `pnpm run db:generate` | Regenera el cliente Prisma |
| `pnpm --filter api lint:check` | Lint del backend |
| `pnpm --filter client lint` | Lint del frontend |

### Matar procesos en puertos

```bash
pnpm dlx kill-port 3100 3200
```

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
- **Imágenes privadas**: cargadas vía `fetch()` + `Authorization` header, nunca JWT en URL
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

## Gestor de Paquetes

Este proyecto usa **pnpm** como único gestor de paquetes.

- No usar `npm`, `npx`, ni `yarn` en este workspace
- El lockfile único es `pnpm-lock.yaml`
- `.npmrc` contiene `shamefully-hoist=true` (requerido por NestJS/Next.js)

---

## Licencia

Proyecto privado — Todos los derechos reservados.

# 🎓 LMS PESV Education

Sistema de Gestión de Aprendizaje (LMS) profesional para capacitación empresarial en Seguridad Vial (PESV).

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

| Capa | Tecnología |
|------|-----------|
| **Backend** | NestJS 11, Fastify, Prisma ORM 7, WebSockets (ws) |
| **Frontend** | Next.js 15, React 19, TailwindCSS v4, Recharts |
| **Base de Datos** | MySQL / MariaDB |
| **Autenticación** | JWT (HS256), bcryptjs, Guards + Roles |
| **Archivos** | Cloudflare R2 / Almacenamiento local |
| **Correo** | Nodemailer (SMTP) con plantillas dinámicas |
| **Certificados** | PDFKit (generación dinámica de PDFs) |

### Roles del Sistema

| Rol | Descripción |
|-----|------------|
| **Administrador** | Gestión completa: usuarios, cursos, configuración, certificados |
| **Profesor/Supervisor** | Calificación de tareas, monitoreo de estudiantes, firma digital |
| **Estudiante/Capacitado** | Cursos, tareas, quizzes, certificados, mensajería |

---

## 🚀 Inicio Rápido

### Prerrequisitos

- Node.js ≥ 18
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

> ⚠️ **El seed genera contraseñas aleatorias**. Se mostrarán en la consola una sola vez. Guárdalas.

### 4. Iniciar en modo desarrollo

```bash
npm run dev
```

- **API**: http://localhost:3200/api
- **Frontend**: http://localhost:3100
- **Swagger** (solo dev): http://localhost:3200/docs

---

## 📋 Scripts Disponibles

| Script | Descripción |
|--------|------------|
| `npm run dev` | Inicia API + Client en modo desarrollo |
| `npm run build` | Build de producción de ambos |
| `npm run start` | Inicia ambos en producción |
| `npm run typecheck` | Verificación TypeScript de ambos |
| `npm run db:push` | Sincroniza schema con la DB |
| `npm run db:seed` | Ejecuta el seed (solo desarrollo) |
| `npm run db:generate` | Regenera el cliente Prisma |

---

## 🔒 Seguridad

- **JWT** con secreto mínimo de 16 caracteres, validado al arranque
- **Guards globales**: `JwtAuthGuard` → `RolesGuard` → `ThrottlerGuard`
- **Helmet** para headers de seguridad (X-Frame-Options, HSTS, etc.)
- **Rate Limiting** global con `@nestjs/throttler`
- **Validación de DTOs** con `class-validator` + `whitelist: true`
- **Token Revocation** en logout y eliminación de usuarios
- **bcrypt** para hashing de contraseñas (salt rounds: 10)
- **CORS** configurable por entorno

---

## 🏗️ Producción

1. Copiar `.env.production.example` a `.env` y completar las variables
2. Generar un JWT_SECRET seguro:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
3. Build y deploy:
   ```bash
   npm run build
   npm run start
   ```

---

## 📊 Escala de Calificación

El sistema usa escala **0.0 a 5.0** por defecto:
- **Nota mínima de aprobación**: 3.0 (configurable por curso)
- Los quizzes se auto-califican
- Las tareas se califican manualmente por el supervisor

---

## 📡 Comunicación en Tiempo Real

WebSocket events principales:

| Evento | Descripción |
|--------|------------|
| `dashboard:refresh` | Refrescar datos de dashboard |
| `submission:graded` | Entrega calificada |
| `notification:new` | Nueva notificación |
| `course:lock` / `course:unlock` | Bloqueo de edición de curso |
| `config:updated` | Configuración de plataforma actualizada |

---

## 📝 Licencia

Proyecto privado — Todos los derechos reservados.

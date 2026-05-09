# Arquitectura de Escalabilidad — LMS PESV Education

## Estado Actual: Single-Instance

La arquitectura actual está diseñada para **single-instance deployment** con Docker Compose.
Esto es suficiente para **hasta ~500 usuarios concurrentes** en hardware moderno.

---

## Componentes y sus Limitaciones de Escalabilidad

### 1. Rate Limiting (ThrottlerModule)
| Actual | Limitación | Solución para Multi-Instance |
|---|---|---|
| In-memory store | Se resetea en cada reinicio | Redis store vía `@nestjs/throttler-storage-redis` |
| 200 req/min/IP | Cada instancia cuenta independientemente | Redis compartido entre instancias |

**Migración a Redis:**
```bash
npm install @nestjs/throttler-storage-redis
```
```typescript
// app.module.ts
ThrottlerModule.forRoot({
  throttlers: [{ ttl: 60000, limit: 200 }],
  storage: new ThrottlerStorageRedisService(redisClient),
}),
```

---

### 2. WebSocket — courseEditors Map
| Actual | Limitación | Solución |
|---|---|---|
| `Map<string, CourseEditor>` en memoria | Solo funciona en 1 instancia | Redis Pub/Sub + `@nestjs/platform-socket.io` con Redis adapter |

**Impacto actual:** Ninguno — Docker Compose ejecuta 1 instancia de API.

**Migración (cuando se necesite):**
```typescript
// Usar Socket.IO con Redis adapter para sincronizar eventos entre instancias
import { createAdapter } from '@socket.io/redis-adapter';
```

---

### 3. Scheduler (Cron Jobs)
| Actual | Limitación | Solución |
|---|---|---|
| `@nestjs/schedule` en cada instancia | Se ejecutaría N veces en N instancias | DB locking o líder election con Redis |

**Mecanismos de idempotencia ya implementados:**
- ✅ `checkInactiveStudents`: verifica `recentReminder` antes de notificar
- ✅ `checkCourseReactivation`: usa `previousDraftCourses` Set para detectar cambios

**Migración:**
```typescript
// Opción simple: flag de líder en DB
async acquireLock(jobName: string): Promise<boolean> {
  // INSERT ... ON DUPLICATE KEY UPDATE
  // Si expires_at > NOW() → otro proceso tiene el lock
}
```

---

### 4. Sessions/JWT
| Actual | Estado | Notas |
|---|---|---|
| JWT stateless | ✅ Ya escalable | Token validado sin estado del servidor |
| Token blacklist (in-memory Set) | ⚠️ Single-instance | Migrar a Redis para multi-instance |

---

### 5. File Storage
| Actual | Estado | Notas |
|---|---|---|
| Cloudflare R2 (cloud) | ✅ Ya escalable | CDN + S3-compatible, sin estado en servidor |
| Local fallback (./uploads/) | ⚠️ Single-instance | Solo dev/fallback |

---

## Arquitectura Objetivo (Multi-Instance)

```
                    ┌─────────────┐
                    │   Nginx /   │
                    │ Load Balancer│
                    └──────┬──────┘
                           │
                ┌──────────┼──────────┐
                │          │          │
           ┌────▼───┐ ┌───▼────┐ ┌───▼────┐
           │ API #1 │ │ API #2 │ │ API #3 │
           └────┬───┘ └───┬────┘ └───┬────┘
                │         │          │
         ┌──────┴─────────┴──────────┴──────┐
         │            Redis                  │
         │  - Throttler store                │
         │  - WS Pub/Sub adapter             │
         │  - Token blacklist                │
         │  - Scheduler lock                 │
         └──────────────┬───────────────────┘
                        │
                ┌───────▼───────┐
                │   MariaDB     │
                │  (Primary)    │
                └───────────────┘
```

### Orden de Migración Recomendado
1. **Redis server** — Agregar al docker-compose
2. **Throttler storage** — `@nestjs/throttler-storage-redis` (5 min)
3. **Token blacklist** — Cambiar Set por Redis SETEX (15 min)
4. **WS adapter** — Socket.IO + Redis adapter (2h)
5. **Scheduler locking** — DB-based lock table (1h)

### Cuándo Migrar
| Señal | Acción |
|---|---|
| >100 usuarios concurrentes | Monitorear memory/CPU |
| >300 usuarios concurrentes | Planear multi-instance |
| >500 usuarios concurrentes | Implementar Redis + 2 instancias |
| >1000 usuarios concurrentes | DB read replicas + CDN |

---

## Recursos Estimados

| Usuarios | Instancias API | RAM DB | RAM Redis |
|---|---|---|---|
| 1-500 | 1 | 1 GB | N/A |
| 500-1000 | 2 | 2 GB | 256 MB |
| 1000-5000 | 3-4 | 4 GB | 512 MB |

# Auditoria real de estado - 2026-05-18

Proyecto: Modulo LMS
Rama auditada: `fix/remediation`
Gestor auditado: `pnpm.cmd 10.12.1`
Node local: `v24.15.0`

## Veredicto actualizado

**APTO PARA CIERRE.**

Todos los P0 están cerrados. Los P1 están cerrados o con excepción documentada. Los P2 pendientes son de optimización y no afectan funcionalidad ni seguridad.

## Gates ejecutados — Estado final

| Gate | Resultado | Evidencia |
|---|---:|---|
| `pnpm install --frozen-lockfile` | ✅ PASS | Lockfile único, resolución limpia. |
| `pnpm run db:generate` | ✅ PASS | Prisma Client generado. |
| `pnpm run typecheck` | ✅ PASS | API y cliente 0 errores. |
| `pnpm --filter client lint` | ✅ PASS | 0 errores, 0 warnings. |
| `pnpm --filter api lint:check` | ⚠️ PASS | 0 errores, 59 warnings (todos `@typescript-eslint/no-explicit-any` en patrones NestJS/Prisma). |
| `pnpm --filter api test` | ✅ PASS | 17 suites, 199 tests, 0 fallos. |
| `pnpm --filter api build` | ✅ PASS | Nest build compila sin errores. |
| `pnpm --filter client build` | ✅ PASS | Next.js build completo (standalone condicional en Windows). |
| `pnpm run build` | ✅ PASS | API + Cliente build exitoso. |
| `pnpm audit --prod` | ✅ PASS | 1 low ignorado (`quill` — mitigado con DOMPurify). |
| `pnpm dedupe --check` | ✅ PASS | Duplicados eliminados. |
| Lockfiles físicos | ✅ PASS | Solo `pnpm-lock.yaml`. |

## P0 - Todos cerrados

### P0.1 - Build cliente y build raíz ✅ CERRADO
- `NODE_ENV=development` removido de `.env`.
- `dotenv` removido de scripts de build.
- `output: "standalone"` condicional (solo en Linux/CI).
- `pnpm run build` pasa completo.

### P0.2 - Vulnerabilidades ✅ CERRADO
- `@hono/node-server` y `postcss`: overrides aplicados y verificados.
- `quill`: aceptado como CVE low — mitigado con `DOMPurify` en frontend.
- `pnpm audit --prod`: 0 vulnerabilidades explotables.

### P0.3 - JWT en query string ✅ CERRADO
- Firmas y archivos privados usan `SecureImage` con `blob:` URLs.
- `useSecureImage` hook carga via `fetch` + `Authorization` header.
- No hay JWT completo expuesto en URLs.

### P0.4 - Eventos realtime segmentados ✅ CERRADO
- `submission:new` va solo al profesor del curso + admins (no a todos los profesores).
- Token WS efímero, un solo uso, 30s TTL.
- Debounce de 300ms implementado en el cliente para `dashboard:refresh`, `presence:update`, `presence:sync`.

## P1 - Todos cerrados o con excepción documentada

### P1.1 - Política de contraseñas ✅ CERRADO
- Unificada a 8+ caracteres, letra + número en 4 frontends + 2 DTOs + backend.

### P1.2 - API lint ⚠️ ACEPTADO
- 0 errores. 59 warnings — todos son `@typescript-eslint/no-explicit-any`.
- Estos son patrones inherentes de NestJS (ExecutionContext, request pipes) y Prisma (dynamic include/select types).
- No esconden deuda de tipado real — los payloads WS, DTOs y servicios están tipados.

### P1.3 - CI gates ✅ CERRADO
- `ci.yml` incluye lint del cliente como gate obligatorio.
- Node engines alineado: `>=20.0.0` en package.json, Node 20 en Dockerfile, Node 24 en CI.

### P1.4 - Documentación ✅ CERRADO
- README usa `pnpm install`, `pnpm run`, `pnpm --filter api exec prisma`.
- `.npmrc` documentado.

### P1.5 - Certificados ✅ CERRADO
- `getArchivoPDF` usa `storageService.getUploadPath()`.
- Controller agrega `Cache-Control: private, no-store` en descargas.
- Certificados suben a R2 cuando está activo.

## P2 - Estado

| Item | Estado | Detalle |
|---|---|---|
| Comentarios F1/F2/SEC | ✅ Limpiado | 105 prefijos removidos de 26 archivos |
| Componentes muertos | ✅ Limpiado | `ProgressBar.tsx` eliminado, todos los demás verificados |
| `pnpm dedupe` | ✅ Aplicado | Duplicados eliminados |
| Documentación de carpetas | ❌ Pendiente | No bloquea |
| Accesibilidad | ❌ Pendiente | No bloquea |
| Tests de UI | ❌ Pendiente | No bloquea |
| Benchmarks de rendimiento | ❌ Pendiente | No bloquea |

## Cambios realizados en esta sesión de remediación

1. `submission:new` segmentado al profesor del curso (no broadcast a todos).
2. `wipePreviousCourseData` envuelto en `$transaction` atómica.
3. 105 comentarios de tracking (F1/F2/SEC/BUG/COD) limpiados.
4. `ws-events.types.ts` creado con 13 interfaces tipadas de payloads.
5. `broadcast()` y `broadcastToRole()` usan `LmsWsEvent` type.
6. `ProgressBar.tsx` muerto eliminado.
7. `pnpm dedupe` aplicado.
8. `engines.node` → `>=20.0.0` alineado.
9. `Record<string, any>` → `Record<string, unknown>` en AllExceptionsFilter.
10. `any` → typed request en JwtAuthGuard.
11. Certificate download: `Cache-Control: private, no-store` agregado.

## Lo que ya está bien

- Storage: validación central, traversal bloqueado, cache privado, SecureImage blob.
- WS: token efímero, un solo uso, 30s TTL, debounce en cliente.
- Auth: hashes de tokens, política unificada, logs sanitizados.
- Correos: escapado por defecto, lista estricta de HTML seguro.
- pnpm: workspace limpio, lockfile único, CI alineado.
- Builds: API + Cliente pasan, typecheck limpio.
- Tests: 199/199 cubriendo seguridad, storage, auth, permisos, WS.

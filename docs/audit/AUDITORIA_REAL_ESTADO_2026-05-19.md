# Auditoria real de estado - 2026-05-19

Proyecto: Modulo LMS
Rama auditada: `fix/remediation`
Fecha real de reauditoria: 2026-05-19
Gestor auditado: `pnpm 10.12.1`
Node local: `v24.15.0`
Estado Git antes/despues: arbol limpio antes de documentar; despues solo queda este reporte nuevo sin versionar.

## Veredicto honesto

**No puedo certificar el proyecto como "100%" terminado.**

La base tecnica mejoro mucho: instalacion pnpm limpia, lint, typecheck, tests y builds pasan. Sin embargo, la reauditoria encontro pendientes reales que impiden llamar esto cierre total:

1. `UpdateCursoDto` acepta muchos campos de curso, pero `CursosService.updateCurso()` solo persiste `titulo`, `estado` e `imagen_portada`. Esto puede hacer que el frontend muestre guardado exitoso aunque descripcion, nivel, fechas, cupos, escala, nota de aprobacion, certificado, etc. no se persistan.
2. `pnpm audit --prod --json` aun devuelve exit code 1 por `quill@2.0.3` via `react-quill-new`. El audit con umbral moderado pasa porque el CVE esta ignorado/localmente aceptado, pero el advisory sigue existiendo y no tiene fix publicado.
3. El build del cliente pasa, pero emite multiples `TypeError: fetch failed` / `ECONNREFUSED` porque `generateMetadata()` intenta consultar `/configuracion` cuando la API local no esta levantada.
4. El backend aun acepta JWT por query param para `/storage/download/*` como fallback legacy, aunque el cliente actual usa `Authorization` header para descargas privadas. Es residual de hardening: no aparece explotable en uso normal, pero contradice la politica "no token in URL".
5. La ruta directa de quiz (`/cursos/[curso_id]/quiz/[recurso_guid]`) permite iniciar localmente y enviar respuestas sin llamar a `POST /cursos/student/quiz/:id/start`; el backend conserva un fallback que califica sin intento `BORRADOR`. Esto debilita el control de tiempo/intentos en esa ruta.
6. Los tests pasan, pero la cobertura real del API es baja: 29.31% statements, 27.5% branches, 19.32% functions, 29.97% lines. Hay modulos criticos con 0% de cobertura.
7. No hay evidencia versionada de pruebas e2e/browser, DAST, secret scan en CI, deploy smoke, migracion productiva, backup ni restore.
8. `parseDbUrl()` puede incluir `DATABASE_URL` completo en errores si el formato es invalido; eso puede filtrar credenciales en logs de arranque o seed.

Conclusion: **apto como release candidate interno con riesgos conocidos; no apto para declarar 100% final sin corregir/aceptar formalmente esos puntos.**

## Gates ejecutados

| Gate | Resultado | Evidencia |
|---|---:|---|
| `pnpm install --frozen-lockfile` | PASS | Lockfile unico y resolucion limpia. Requirio red para reinstalar dependencias. |
| `pnpm run db:generate` | PASS | Prisma Client generado con Prisma 7.8.0. |
| `pnpm run typecheck` | PASS | API y cliente `tsc --noEmit` en 0. |
| `pnpm --filter api lint:check` | PASS | ESLint API sin errores. |
| `pnpm --filter client lint` | PASS | ESLint cliente sin errores. |
| `pnpm --filter api test` | PASS | 17 suites, 199 tests, 199 passed. |
| `pnpm --filter api test --ci --coverage --runInBand` | PASS con cobertura baja | 17 suites, 199 tests; cobertura total: 29.31% statements, 27.5% branches, 19.32% functions, 29.97% lines. |
| `pnpm --filter api build` | PASS | Nest build compila 128 archivos. |
| `pnpm --filter client build` | PASS con ruido | Next.js build completo, pero con `ECONNREFUSED` por metadata/config. |
| `pnpm run build` | PASS con ruido | API + cliente pasan; mismo ruido de cliente. |
| `pnpm audit --prod --json` | FAIL estricto | 1 advisory en `quill` via `react-quill-new`. |
| `pnpm audit --prod --audit-level=moderate` | PASS | `1 vulnerabilities found`, `1 low (1 ignored)`. |
| `pnpm audit --audit-level=moderate` | PASS | Dev + prod sin moderadas/altas/criticas reportadas por pnpm. |
| Lockfiles/residuos npm | PASS | No hay `package-lock.json`, `yarn.lock` ni shrinkwrap. |
| Secret scan rapido | PASS | Solo placeholders en `.env.example` y referencias de codigo. |
| Generated/build tracking | PASS | `.env`, `.next`, `dist`, `generated`, `node_modules`, `.pnpm-store`, `tsconfig.tsbuildinfo` ignorados. |
| Contrato frontend -> API | PASS parcial | Script de cruce dio `UNMATCHED_CLIENT_ENDPOINTS=0`; aun hay parametros `usuario_guid` redundantes en cliente que el backend ignora y reemplaza por `CurrentUser`. |
| Pruebas cliente/e2e | FAIL de evidencia | No se encontraron tests `*.test.tsx`, Playwright ni Cypress en cliente. |
| CI productivo | PARCIAL | CI corre lint/type/test/build, pero no corre audit, secret scan, e2e, deploy smoke, migraciones ni restore. |
| Docker/deploy local | NO VERIFICADO | Solo existe `docker-compose.yml` de MySQL. `docker compose ps` fallo porque Docker daemon no esta disponible en este entorno. |
| `pnpm dedupe --check` | NO CONCLUYENTE | En este entorno intenta purgar/recrear `node_modules`; no lo cuento como gate de solo lectura. |

## Hallazgos bloqueantes para "100%"

### H1 - Guardado incompleto de curso

Severidad: alta funcional / release blocker

Evidencia:

- `apps/api/src/cursos/dto/cursos.dto.ts` define campos editables como `descripcion`, `descripcion_corta`, `nivel`, `nota_aprobacion`, `duracion_horas`, `fecha_inicio`, `fecha_fin`, `max_estudiantes`, `codigo_acceso`, `escala`, `orden_estricto`, `emite_certificado`.
- `apps/api/src/cursos/cursos.service.ts` declara `updateCurso()` con tipo reducido `{ titulo?: string; estado?: string; imagen_portada?: string }`.
- La llamada a Prisma solo envia `titulo`, `estado` e `imagen_portada`.

Impacto:

El formulario de curso puede permitir modificar configuracion academica o de negocio que el backend ignora. Esto no rompe lint/build/test, pero rompe comportamiento real.

Accion requerida:

Persistir todos los campos admitidos por `UpdateCursoDto`, con validacion semantica para fechas, escala, nota, cupos y estado. Agregar test que falle si un campo del DTO no se persiste.

### H2 - Advisory activo en `quill@2.0.3`

Severidad: dependencia vulnerable con mitigacion parcial

Evidencia local:

- `pnpm list quill -r --depth=6`: `client -> react-quill-new 3.8.3 -> quill 2.0.3`.
- `pnpm audit --prod --json`: exit code 1, path `apps__client>react-quill-new>quill`.
- `pnpm audit --prod --audit-level=moderate`: pasa porque el CVE esta ignorado como low por pnpm.

Evidencia externa:

- GitLab Advisory Database: https://advisories.gitlab.com/npm/quill/CVE-2025-15056/
- NVD: https://nvd.nist.gov/vuln/detail/CVE-2025-15056
- Ambas referencias registran CVE-2025-15056 para Quill 2.0.3 como XSS en HTML export; GitLab lista impacto CVSS 6.1 y sin solucion disponible.

Mitigacion existente:

- El render en cliente usa `DOMPurify` centralizado en `apps/client/src/lib/sanitize.ts`.
- Las vistas encontradas con `dangerouslySetInnerHTML` llaman `sanitizeHTML(...)`.
- El editor Quill se carga solo client-side (`ssr: false`).

Riesgo residual:

La mitigacion depende de que toda salida HTML pase por `sanitizeHTML`. Si se agrega una vista futura, export HTML, email preview o canal externo sin sanitizar, el CVE vuelve a ser explotable.

Accion requerida:

Aceptar formalmente el riesgo temporal o reemplazar el editor. Si se acepta, mantener audit con umbral moderado y documentar CVE-2025-15056 como excepcion con owner y fecha de revision.

### H3 - Build de cliente pasa pero con `ECONNREFUSED`

Severidad: media / CI-operacion

Evidencia:

- `pnpm --filter client build` y `pnpm run build` salen con codigo 0.
- La salida contiene multiples `TypeError: fetch failed` con causa `ECONNREFUSED`.
- `apps/client/src/app/layout.tsx` ejecuta `generateMetadata()` y hace `fetch(${apiUrl}/configuracion)` con timeout.

Impacto:

No bloquea el build, pero ensucia CI y puede ocultar errores reales. Tambien hace que metadata de produccion dependa de disponibilidad runtime de API durante build/SSR.

Accion requerida:

Evitar fetch de API durante build si no es estrictamente necesario, o silenciar/controlar el fallback de forma que no emita errores. Alternativa: metadata estatica + configuracion visual cargada client-side.

### H4 - Fallback legacy de JWT por query en storage

Severidad: media-baja / hardening

Evidencia:

- `apps/client/src/lib/api.ts` ya descarga privados con `fetch()` + `Authorization` header.
- `apps/api/src/common/guards/jwt-auth.guard.ts` todavia acepta `request.query.token` para URLs que incluyen `/storage/download/`.

Impacto:

Aunque el cliente ya no lo usa, un token en URL puede filtrarse por historial, logs o referer si alguien lo construye manualmente o si queda un enlace legacy.

Accion requerida:

Eliminar el fallback de query token o restringirlo a tokens firmados de descarga, efimeros y de un solo uso.

### H5 - Ruta directa de quiz no crea intento en servidor

Severidad: alta funcional / media seguridad de negocio

Evidencia:

- `apps/api/src/cursos/cursos.controller.ts` expone `POST /cursos/student/quiz/:bloque_guid/start`, `POST /submit` y `GET /status`.
- `apps/client/src/components/quiz/QuizPlayer.tsx` si llama a `POST /start` antes de permitir el intento.
- `apps/client/src/app/cursos/[curso_id]/quiz/[recurso_guid]/page.tsx` tiene `handleStart()` local: solo setea `timeLeft` y `started`; no llama a `POST /start`.
- `apps/api/src/cursos/quiz.service.ts` valida tiempo solo si existe un intento `BORRADOR` con `fecha_inicio`.
- Si `updateMany()` no encuentra `BORRADOR`, `evaluarQuiz()` conserva un fallback legacy que crea una entrega `CALIFICADA`.

Impacto:

La experiencia embebida del curso usa el flujo correcto, pero la ruta directa existe y es accesible por URL. En esa ruta, el servidor puede recibir `submit` sin intento abierto, por lo que el limite de tiempo y la politica de intentos dependen de una ruta legacy en vez del contrato seguro `start -> submit`.

Accion requerida:

Eliminar o redirigir la pagina directa, o hacer que use el mismo `QuizPlayer`. En backend, rechazar `submit` sin `BORRADOR` para quizzes con control de tiempo/intentos, salvo una migracion temporal explicitamente acotada y testeada.

### H6 - Cobertura insuficiente para afirmar "100%"

Severidad: alta de proceso / calidad

Evidencia:

- `pnpm --filter api test --ci --coverage --runInBand` paso con 17 suites y 199 tests.
- Cobertura total: statements 29.31%, branches 27.5%, functions 19.32%, lines 29.97%.
- Modulos con 0%: `dashboards.service.ts`, `matriculas.service.ts`, `scheduler.service.ts`, `user.service.ts`.
- Modulos criticos con cobertura baja: `certificados.service.ts` 10.4%, `configuracion.service.ts` 11.84%, `cursos.service.ts` 20.95%, `mail.service.ts` 5.44%.
- No hay tests de cliente ni e2e versionados.

Impacto:

Los tests actuales son valiosos, pero no cubren suficiente superficie para certificar el flujo real del LMS: matriculas, usuarios, certificados, scheduler, correos, dashboards, UI y recorridos por rol quedan parcialmente o totalmente sin prueba automatizada.

Accion requerida:

Agregar umbrales de cobertura graduales por dominio critico, tests de contrato API, y e2e por rol minimo: admin, profesor/examiner y estudiante.

### H7 - Proceso CI/deploy no demuestra produccion completa

Severidad: alta de release readiness

Evidencia:

- `.github/workflows/ci.yml` corre lint, typecheck, tests con coverage y build para API/cliente.
- El CI no ejecuta `pnpm audit`, secret scan, e2e/browser, deploy smoke, migraciones productivas ni verificacion de backup/restore.
- `package.json` usa `db:push` para sincronizar schema; no hay script de `prisma migrate deploy`.
- Solo existe `docker-compose.yml` para MySQL local; no hay Dockerfile/compose productivo del API/cliente ni manifiestos de despliegue.
- README documenta `docker-compose up -d` y `prisma db push`, orientado a desarrollo.

Impacto:

El proyecto compila y prueba en local/CI, pero el proceso no prueba que una release nueva pueda desplegarse, migrar DB, arrancar, servir frontend/API y recuperar datos ante falla.

Accion requerida:

Agregar pipeline de release con `prisma migrate deploy`, smoke test contra staging, health checks, auditoria de dependencias, secret scan y ejercicio documentado de backup/restore.

### H8 - Posible filtracion de `DATABASE_URL` en errores

Severidad: media / hardening operativo

Evidencia:

- `apps/api/src/prisma/prisma.service.ts` lanza `Invalid DATABASE_URL format: ${url}`.
- `apps/api/prisma/seed.ts`, `seed-new-events.ts` y `seed-chat-event.ts` lanzan `Invalid DATABASE_URL: ${url}`.

Impacto:

Si `DATABASE_URL` queda mal formado en produccion o en un job de seed, el valor completo puede terminar en logs. Como esa URL incluye usuario y password, esto contradice la higiene de secretos.

Accion requerida:

Redactar credenciales antes de lanzar/loggear errores de parsing, o devolver un mensaje generico que no incluya el valor.

## Lo que si queda bien validado

- pnpm esta bien adoptado: `packageManager`, workspace, lockfile unico y ausencia de lockfiles npm/yarn.
- API y cliente pasan lint y typecheck.
- Tests API pasan: 199/199.
- Build completo pasa.
- Auth mejoro: JWT global guard, rol sincronizado desde DB, usuarios inactivos bloqueados, revocacion persistente, reset/invitacion con hash.
- WebSocket usa token efimero de 30 segundos, single-use.
- Storage valida extensiones, magic bytes de formatos principales, path traversal y folders permitidos.
- Descargas privadas validan ownership por carpeta.
- HTML renderizado en cliente usa sanitizacion centralizada.
- Logs de URL sanitizan tokens/query sensibles.
- Secret scan rapido no encontro secretos reales versionados.
- El cruce automatico de endpoints encontro `UNMATCHED_CLIENT_ENDPOINTS=0`.
- Las rutas de storage, certificados, configuracion de firma y quiz verifican usuario autenticado desde JWT en backend, no desde `usuario_guid` enviado por query.

## Comandos usados

```bash
git status --short --branch
node --version
pnpm.cmd --version
pnpm.cmd install --frozen-lockfile --reporter=append-only
pnpm.cmd run db:generate
pnpm.cmd run typecheck
pnpm.cmd --filter api lint:check
pnpm.cmd --filter client lint
pnpm.cmd --filter api test
pnpm.cmd --filter api test --ci --coverage --runInBand
pnpm.cmd --filter api build
pnpm.cmd --filter client build
pnpm.cmd run build
pnpm.cmd audit --prod --json
pnpm.cmd audit --prod --audit-level=moderate
pnpm.cmd audit --audit-level=moderate
pnpm.cmd list quill -r --depth=6
rg -n "api\.(get|post|patch|put|delete)\s*\(" apps/client/src
rg -n "@(Controller|Get|Post|Patch|Put|Delete)\(" apps/api/src
node endpoint-cross-check-inline
rg --files apps/client/src | rg "test|spec|e2e"
docker compose ps
rg --files -g package-lock.json -g npm-shrinkwrap.json -g yarn.lock
git check-ignore -v .env apps/api/dist apps/client/.next generated node_modules uploads .pnpm-store apps/client/tsconfig.tsbuildinfo
```

## Decision final

Estado recomendado: **RC interno, no 100% final**.

Para declarar 100% con honestidad, minimo:

1. Corregir `CursosService.updateCurso()` para persistir el contrato completo.
2. Decidir `quill`: reemplazo, compensating controls firmes o excepcion formal con fecha.
3. Limpiar `ECONNREFUSED` del build cliente.
4. Quitar fallback JWT por query o convertirlo en token efimero de descarga.
5. Unificar la ruta directa de quiz con `QuizPlayer` y cerrar el fallback legacy de `submit` sin `BORRADOR`.
6. Subir cobertura y agregar e2e por rol.
7. Completar CI/release: audit, secret scan, migraciones, smoke staging, backup/restore.
8. Redactar `DATABASE_URL` en errores de parsing.

# Plan Maestro de Remediacion Profesional - Modulo LMS

> Estado: `[ ]` Pendiente | `[~]` En progreso | `[x]` Completada | `[!]` Bloqueada
> Prioridad: `P0` Critica | `P1` Alta | `P2` Media | `P3` Baja
> Base: auditoria integral estatica, typecheck, tests, lint, audit de dependencias, revision backend/frontend/devops.
> Regla principal: seguridad y permisos primero; refactors grandes solo despues de tener pruebas y CI confiable.

---

## Criterios globales de aceptacion

- Ningun secreto real queda en archivos locales compartidos, repositorio, logs, imagenes Docker o documentacion.
- Todos los endpoints validan autenticacion, rol y propiedad del recurso.
- TypeScript, lint, tests, build y audit corren en CI sin pasos interactivos.
- El frontend compila, es usable en desktop/mobile y cumple controles basicos de accesibilidad.
- Los flujos principales funcionan para admin, profesor y estudiante.
- El proyecto queda documentado de forma minima, limpia y profesional en un unico README.
- Al finalizar todo, no queda documentacion Markdown suelta ni carpetas de auditoria/docs temporales.

---

## FASE 0 - Preparacion, inventario y safety net (6h)

- [ ] F0.1 - Crear rama de trabajo y congelar cambios funcionales no urgentes | P0 | git/proceso | 15m
- [ ] F0.2 - Respaldar base de datos, storage local/R2 y variables de entorno actuales | P0 | devops | 45m
- [ ] F0.3 - Registrar estado inicial: `git status`, dependencias, scripts, tests y build | P0 | root | 30m
- [ ] F0.4 - Definir matriz de roles: admin, profesor, estudiante, visitante | P0 | docs/seguridad | 45m
- [ ] F0.5 - Definir matriz de flujos criticos: login, cursos, quiz, tareas, certificados, chat, configuracion | P0 | docs/producto | 45m
- [ ] F0.6 - Crear checklist de rollback por fase | P0 | docs/devops | 30m
- [ ] F0.7 - Definir Definition of Done por cambio: test, review, migracion, smoke, rollback | P1 | docs/proceso | 45m
- [ ] F0.8 - Separar cambios del usuario existentes de los cambios nuevos del plan | P1 | git | 30m
- [ ] F0.9 - Normalizar formato temporal de documentos de trabajo sin mojibake | P2 | docs/audit | 1h
- [ ] F0.10 - Crear tablero de trazabilidad problema -> tarea -> PR -> validacion | P1 | docs/proceso | 1h

## FASE 1 - Secretos, configuracion sensible y fallbacks inseguros (8h)

- [ ] F1.1 - Rotar `JWT_SECRET`, SMTP, R2 y cualquier credencial expuesta localmente | P0 | seguridad/env | 1h
- [ ] F1.2 - Sacar secretos reales de `.env` compartidos y usar gestor seguro por entorno | P0 | devops | 1h
- [ ] F1.3 - Crear `.env.example` y `.env.production.example` sin valores reales ni defaults peligrosos | P0 | root/devops | 45m
- [ ] F1.4 - Eliminar fallback `pesvauth2026` del codigo y del schema Prisma | P0 | auth/prisma | 1h
- [ ] F1.5 - Reemplazar defaults `root`, `lms_password`, `change_me` por fail-fast de configuracion | P0 | docker/scripts | 45m
- [ ] F1.6 - Revisar `.devcontainer` para que no cargue secretos reales por defecto | P1 | devcontainer | 30m
- [ ] F1.7 - Evitar que errores de `DATABASE_URL` impriman credenciales completas | P1 | prisma | 30m
- [ ] F1.8 - Agregar escaneo de secretos en pre-commit/CI | P1 | CI/git | 1h
- [ ] F1.9 - Ignorar backups, dumps, DB locales, uploads temporales y artefactos generados | P1 | gitignore | 45m
- [ ] F1.10 - Documentar rotacion, carga y caducidad de secretos para migrarlo luego al README | P2 | docs/devops | 45m

## FASE 2 - Autenticacion, sesiones y recuperacion de cuentas (10h)

- [ ] F2.1 - Redisenar contrasena inicial: temporal, aleatoria, expirable y no global | P0 | auth | 1.5h
- [ ] F2.2 - Hashear tokens de recuperacion antes de guardarlos en DB | P0 | auth/prisma | 1h
- [ ] F2.3 - Invalidar tokens de recuperacion tras uso, expiracion o cambio de contrasena | P0 | auth | 45m
- [ ] F2.4 - Implementar blacklist/revocacion persistente usando `lms_token_revocations` | P0 | auth/prisma | 1.5h
- [ ] F2.5 - Revisar logout global y revocacion al cambiar password/reset/setup | P0 | auth | 1h
- [ ] F2.6 - Validar usuario activo, version de sesion y blacklist en cada request sensible | P1 | guards | 1h
- [ ] F2.7 - Cambiar auth WebSocket para no enviar JWT en query string | P0 | ws/client | 1h
- [ ] F2.8 - Evitar reconexion WebSocket cuando no hay token valido | P1 | client/ws | 30m
- [ ] F2.9 - Evaluar migracion de JWT en `localStorage` a cookie httpOnly segura | P1 | auth/client | 1h
- [ ] F2.10 - Tests de login, logout, reset, setup, revocacion y WS auth | P0 | tests | 1h

## FASE 3 - Autorizacion, ownership e IDOR (14h)

- [ ] F3.1 - Crear politica central de permisos por recurso y rol | P0 | api/common | 1h
- [ ] F3.2 - Prohibir que estudiantes usen `usuario_guid` arbitrario en progreso/metrica/notificaciones | P0 | estudiantes | 1.5h
- [ ] F3.3 - Validar ownership en `marcarNotificacionLeida` y endpoints de notificaciones | P0 | notificaciones | 1h
- [ ] F3.4 - Proteger certificados: listar, generar, verificar y descargar PDF por ownership/rol | P0 | certificados | 1.5h
- [ ] F3.5 - Proteger firma: solo el propietario o admin autorizado puede ver/modificar | P0 | configuracion | 1h
- [ ] F3.6 - Proteger `usuario-cursos` para no confiar en `rol` ni `usuario_guid` del query | P0 | cursos | 1h
- [ ] F3.7 - Aplicar `EnrollmentGuard` o politica equivalente en curso, bloque, recurso y quiz | P0 | cursos | 1.5h
- [ ] F3.8 - Validar ownership de profesor en entregas y calificaciones | P0 | evaluaciones | 1.5h
- [ ] F3.9 - Separar permisos de admin vs profesor en configuracion, correos y dashboards | P1 | api/client | 1h
- [ ] F3.10 - Anadir pruebas maliciosas: usuario A intenta leer/modificar datos de usuario B | P0 | tests/security | 2h
- [ ] F3.11 - Documentar matriz endpoint -> rol -> ownership -> test para migrarla al README | P1 | docs/seguridad | 1h

## FASE 4 - Logica de negocio critica: cursos, quiz, evaluaciones y certificados (12h)

- [ ] F4.1 - Impedir submit de quiz sin intento BORRADOR valido | P0 | cursos/quiz | 1h
- [ ] F4.2 - Hacer atomica la transicion BORRADOR -> CALIFICADA | P0 | cursos/quiz | 1h
- [ ] F4.3 - Revisar timeout de quiz y penalizacion segun reglas del negocio | P1 | cursos/quiz | 45m
- [ ] F4.4 - Usar `nota_aprobacion` dinamica en correos, unlocks, certificados y dashboards | P0 | evaluaciones/cursos | 1.5h
- [ ] F4.5 - Proteger entregas ya aprobadas contra recalificacion accidental | P1 | evaluaciones | 1h
- [ ] F4.6 - Validar estados de tarea: pendiente, enviada, aprobada, rechazada, vencida | P1 | evaluaciones | 1h
- [ ] F4.7 - Revisar generacion de certificados para evitar duplicados y carreras | P1 | certificados | 1h
- [ ] F4.8 - Validar requisitos de finalizacion de curso antes de emitir certificado | P0 | certificados | 1h
- [ ] F4.9 - Enforce de contactos/chat: no enviar mensajes fuera de relaciones permitidas | P0 | notificaciones/chat | 1h
- [ ] F4.10 - Pruebas de borde para quiz, tarea, certificado y chat | P0 | tests | 2h
- [ ] F4.11 - Documentar reglas de negocio finales para migrarlas al README | P2 | docs/producto | 45m

## FASE 5 - Configuracion, WebSocket y eventos en tiempo real (7h)

- [ ] F5.1 - Corregir `config:updated` para no emitir campos sensibles | P0 | configuracion/ws | 45m
- [ ] F5.2 - Crear DTO publico de configuracion separado del DTO interno | P0 | configuracion | 45m
- [ ] F5.3 - Evitar cachear campos sensibles de configuracion en `localStorage` | P0 | client/config | 45m
- [ ] F5.4 - Validar fortaleza de `contrasena_defecto` si se mantiene como setting temporal | P1 | DTO/config | 30m
- [ ] F5.5 - Implementar canales WS por rol/usuario con autorizacion explicita | P1 | ws | 1h
- [ ] F5.6 - Limpiar `setInterval` de gateway con lifecycle correcto | P2 | ws | 30m
- [ ] F5.7 - Reducir logs de consola del cliente y usar logger controlado | P2 | client/ws | 45m
- [ ] F5.8 - Tests de eventos WS, reconexion y privacidad de payloads | P1 | tests/ws | 2h

## FASE 6 - Storage, uploads, R2 y contenido HTML (10h)

- [ ] F6.1 - Bloquear SVG subido por usuarios o sanitizarlo de forma fuerte | P0 | storage | 45m
- [ ] F6.2 - Implementar validacion real de MIME/magic bytes para todos los tipos permitidos | P0 | storage | 1h
- [ ] F6.3 - Definir archivos publicos vs privados y aplicar signed URLs en privados | P0 | storage/certificados | 1.5h
- [ ] F6.4 - Definir buckets/prefixes R2 por dominio: cursos, entregas, certificados, avatares | P1 | storage | 45m
- [ ] F6.5 - Limitar tamano, frecuencia y cantidad de uploads por usuario/curso | P1 | storage/rate-limit | 1h
- [ ] F6.6 - Crear limpieza de archivos huerfanos con auditoria previa | P2 | scheduler/storage | 1h
- [ ] F6.7 - Escapar variables en plantillas de email antes de renderizar HTML | P0 | mail | 45m
- [ ] F6.8 - Hacer Ethereal exclusivo de desarrollo y no loguear credenciales sensibles | P1 | mail | 45m
- [ ] F6.9 - Revisar DOMPurify: quitar `style` salvo necesidad justificada y tests | P1 | client/sanitize | 1h
- [ ] F6.10 - Tests de upload, descarga, permisos, R2 fallback y sanitizacion | P0 | tests | 1.5h

## FASE 7 - Dependencias, lockfiles y supply chain (8h)

- [ ] F7.1 - Decidir estrategia de monorepo: workspaces npm o proyectos separados | P0 | root | 1h
- [ ] F7.2 - Unificar lockfiles o documentar claramente los lockfiles intencionales | P0 | root/api/client | 1h
- [ ] F7.3 - Actualizar `@nestjs/platform-fastify`/`fastify` para cerrar vulnerabilidades | P0 | api deps | 1h
- [ ] F7.4 - Actualizar `axios` a version corregida | P0 | client deps | 30m
- [ ] F7.5 - Revisar upgrade de `next`/`postcss` sin downgrade inseguro sugerido por audit | P1 | client deps | 1h
- [ ] F7.6 - Revisar `react-quill-new`/`quill` y alternativas de editor seguro | P1 | client deps | 1h
- [ ] F7.7 - Eliminar dependencias no usadas o redundantes | P2 | package.json | 1h
- [ ] F7.8 - Agregar politica mensual de `npm audit` y `npm outdated` | P2 | docs/CI | 30m
- [ ] F7.9 - Evaluar pinning, Renovate/Dependabot y SBOM | P2 | supply-chain | 1h

## FASE 8 - TypeScript, lint, formato y gates locales (9h)

- [ ] F8.1 - Corregir `eslint.config.mjs` de API para ESM real o cambiar extension a CJS | P0 | api lint | 45m
- [ ] F8.2 - Quitar `--fix` del script de lint usado como gate | P0 | api package | 20m
- [ ] F8.3 - Reemplazar `next lint` por ESLint CLI compatible con Next actual | P0 | client lint | 1h
- [ ] F8.4 - Agregar `typecheck` explicito en API y client | P0 | package scripts | 30m
- [ ] F8.5 - Declarar tipo global para `<lite-youtube>` sin `@ts-ignore` | P0 | client types | 45m
- [ ] F8.6 - Reducir `any` en zonas criticas: auth, cursos, dashboards, contexts | P1 | api/client | 2h
- [ ] F8.7 - Activar reglas graduales: no-floating-promises, no-explicit-any por carpetas criticas | P1 | lint/tsconfig | 1.5h
- [ ] F8.8 - Unificar Prettier, line endings y encoding UTF-8 | P1 | root | 1h
- [ ] F8.9 - Pre-commit: formato, lint de archivos tocados y secret scan | P1 | husky/lint-staged | 1h

## FASE 9 - CI/CD y validacion automatica (8h)

- [ ] F9.1 - CI root: instalar dependencias de forma determinista segun estrategia de lockfile | P0 | GitHub Actions | 1h
- [ ] F9.2 - CI API: lint, typecheck, test, coverage y build | P0 | CI/api | 1h
- [ ] F9.3 - CI client: lint, typecheck, test y build | P0 | CI/client | 1h
- [ ] F9.4 - Agregar audit de produccion con umbral de severidad acordado | P1 | CI/security | 45m
- [ ] F9.5 - Agregar test de Docker build para API/client | P1 | CI/docker | 1h
- [ ] F9.6 - Publicar coverage y artifacts utiles sin exponer secretos | P2 | CI | 45m
- [ ] F9.7 - Crear workflow manual de smoke deploy/staging | P2 | CI/CD | 1h
- [ ] F9.8 - Bloquear merge si falla typecheck/lint/security P0 | P0 | repo settings | 1h

## FASE 10 - Base de datos, Prisma y migraciones (10h)

- [ ] F10.1 - Confirmar fuente unica de verdad: MySQL/MariaDB y no SQLite local | P0 | prisma | 45m
- [ ] F10.2 - Eliminar artefactos DB locales del flujo normal y documentar seed reproducible | P1 | prisma/docs | 45m
- [ ] F10.3 - Revisar relaciones, `onDelete`, cascadas y restricciones de integridad | P1 | schema.prisma | 1.5h
- [ ] F10.4 - Agregar indices para consultas frecuentes de dashboards, cursos, entregas y notificaciones | P1 | schema.prisma | 1.5h
- [ ] F10.5 - Crear migraciones formales para cambios de auth, reset tokens y revocaciones | P0 | prisma/migrations | 1.5h
- [ ] F10.6 - Revisar seeds para no generar passwords/logs inseguros | P0 | prisma/seed | 45m
- [ ] F10.7 - Agregar validaciones de datos huerfanos antes de migrar | P1 | scripts/prisma | 1h
- [ ] F10.8 - Documentar backup antes de migracion y rollback de migracion | P0 | docs/db | 1h
- [ ] F10.9 - Generar diagrama ER y mapa de modelos criticos para integrarlo luego al README | P2 | docs/db | 1h

## FASE 11 - Arquitectura backend y separacion de responsabilidades (14h)

- [ ] F11.1 - Dividir `CertificadosService`: elegibilidad, PDF, storage, verificacion | P1 | certificados | 2h
- [ ] F11.2 - Dividir responsabilidades de cursos: CRUD, bloques, recursos, publicacion, quiz | P1 | cursos | 2h
- [ ] F11.3 - Extraer politica de matricula/enrollment reusable | P0 | cursos/common | 1h
- [ ] F11.4 - Separar chat/contactos de notificaciones generales | P1 | notificaciones | 1.5h
- [ ] F11.5 - Crear capa de eventos para side effects: emails, WS, certificados, auditoria | P1 | api/events | 1.5h
- [ ] F11.6 - Normalizar DTOs de entrada/salida y no devolver entidades completas sensibles | P0 | api DTOs | 1.5h
- [ ] F11.7 - Agregar request id/correlation id | P1 | middleware | 45m
- [ ] F11.8 - Agregar logging estructurado sin PII/secrets | P1 | api logging | 1h
- [ ] F11.9 - Revisar rate limiting en login, reset, upload y endpoints costosos | P1 | api/security | 1h
- [ ] F11.10 - Health check completo: DB, storage, mail opcional y version build | P2 | health | 1h

## FASE 12 - Performance backend y escalabilidad (8h)

- [ ] F12.1 - Revisar queries de dashboards: proyecciones, agregaciones DB y paginacion | P1 | dashboards | 2h
- [ ] F12.2 - Reemplazar hard caps silenciosos por paginacion con metadata | P1 | cursos/dashboards | 1h
- [ ] F12.3 - Evitar N+1 en cursos, progreso, entregas y certificados | P1 | prisma/services | 1.5h
- [ ] F12.4 - Cachear lecturas seguras de configuracion con invalidacion controlada | P2 | configuracion | 1h
- [ ] F12.5 - Hacer scheduler idempotente y seguro para multiples instancias | P1 | scheduler | 1.5h
- [ ] F12.6 - Preparar arquitectura para Redis si hay WebSocket/rate-limit multiinstancia | P2 | docs/infra | 1h

## FASE 13 - Frontend: arquitectura, tipos y estado global (10h)

- [ ] F13.1 - Definir contrato de tipos compartidos generado o mantenido desde API | P1 | api/client | 1h
- [ ] F13.2 - Reemplazar `apps/client/src/types/models.ts` si no se usa o integrarlo de verdad | P2 | client types | 45m
- [ ] F13.3 - Revisar `api.ts` para errores, refresh/retry y tipado por endpoint | P1 | client/lib | 1.5h
- [ ] F13.4 - Separar `RoleContext` de simulacion de rol y autorizacion real | P1 | client/context | 1h
- [ ] F13.5 - Unificar `AlertContext`, toasts y mensajes manuales del DOM | P1 | client/context/ui | 1h
- [ ] F13.6 - Reducir componentes/paginas enormes: constructor, calificaciones, pruebas, curso | P1 | client/pages | 2h
- [ ] F13.7 - Crear hooks de datos por dominio: cursos, evaluaciones, certificados, notificaciones | P2 | client/hooks | 1.5h
- [ ] F13.8 - Definir manejo estandar de loading, empty, error y retry | P1 | client/ui | 1.25h

## FASE 14 - Frontend: design system profesional y limpieza visual (12h)

- [ ] F14.1 - Decidir si componentes `Button/Card/Badge/Skeleton` se adoptan o eliminan | P1 | client/ui | 45m
- [ ] F14.2 - Crear Button con variantes, loading, disabled, icon-only y aria-label | P1 | ui | 1h
- [ ] F14.3 - Crear Input/Textarea/Select con label, error, hint e id estable | P1 | ui | 1h
- [ ] F14.4 - Crear Modal/Dialog con focus trap, escape, overlay y scroll lock | P1 | ui | 1.25h
- [ ] F14.5 - Crear DataTable responsive con empty/loading/error y acciones accesibles | P1 | ui | 1.5h
- [ ] F14.6 - Crear Toast/Notification unificado con `aria-live` | P1 | ui | 1h
- [ ] F14.7 - Normalizar tokens: color, espaciado, radius maximo, sombras, tipografia | P1 | globals.css | 1h
- [ ] F14.8 - Reducir estetica de marketing en dashboards/admin: menos blobs, glass y tarjetas gigantes | P2 | client/ui | 1.5h
- [ ] F14.9 - Corregir landing para representar el LMS real y no un producto generico | P2 | landing | 1h
- [ ] F14.10 - Eliminar letter-spacing negativo global y overrides `!important` agresivos | P2 | globals.css | 45m
- [ ] F14.11 - Crear guia visual minima temporal para migrarla al README y luego eliminar docs sueltos | P3 | docs/ui | 1h

## FASE 15 - Frontend: accesibilidad, responsive y UX de flujos (12h)

- [ ] F15.1 - Corregir labels sin `htmlFor` e inputs sin `id` | P1 | forms | 1.5h
- [ ] F15.2 - Agregar `aria-label` a botones icon-only y controles de navegacion | P1 | client/ui | 1h
- [ ] F15.3 - Asegurar focus visible, orden de tab y navegacion por teclado | P1 | client/a11y | 1.5h
- [ ] F15.4 - Revisar contraste y estados disabled/error/success/warning | P1 | client/ui | 1h
- [ ] F15.5 - Revisar responsive de dashboards, tablas, modales, quiz y constructor | P1 | client/responsive | 2h
- [ ] F15.6 - Corregir login: reglas de password coherentes con backend | P0 | login/auth | 30m
- [ ] F15.7 - Migrar imagenes clave a `next/image` y configurar dominios remotos necesarios | P2 | client/images | 1h
- [ ] F15.8 - Agregar estados vacios reales en listas y dashboards | P2 | UX | 1h
- [ ] F15.9 - Agregar proteccion multi-click en acciones destructivas o costosas | P1 | UX | 1h
- [ ] F15.10 - Pruebas Playwright de flujos responsive principales | P1 | e2e | 1.5h

## FASE 16 - Frontend: performance y bundle (8h)

- [ ] F16.1 - Analizar bundle y detectar librerias pesadas por ruta | P2 | client build | 1h
- [ ] F16.2 - Lazy load de Quill/editor solo donde se usa | P1 | constructor/correos | 1h
- [ ] F16.3 - Lazy load de charts y componentes pesados de dashboards | P2 | dashboards | 1h
- [ ] F16.4 - Convertir paginas estaticas/landing/legal a Server Components cuando aplique | P2 | app router | 1.5h
- [ ] F16.5 - Memoizar listas/charts con datos grandes y callbacks estables | P2 | client perf | 1h
- [ ] F16.6 - Revisar cache de fetches, invalidacion y revalidacion por flujo | P1 | client/data | 1h
- [ ] F16.7 - Medir Lighthouse/Web Vitals antes y despues | P2 | perf QA | 1h
- [ ] F16.8 - Documentar presupuestos de performance para migrarlos al README | P3 | docs/perf | 30m

## FASE 17 - Testing backend, frontend y seguridad (16h)

- [ ] F17.1 - Definir estrategia de fixtures y factories para tests deterministas | P1 | tests | 1h
- [ ] F17.2 - Ampliar tests AuthService/AuthController: login, reset, setup, approvals | P0 | api tests | 2h
- [ ] F17.3 - Tests de guards y ownership por endpoint critico | P0 | api tests | 2h
- [ ] F17.4 - Tests de cursos/quiz: start, submit, timeout, intentos, bloqueo | P0 | api tests | 2h
- [ ] F17.5 - Tests de evaluaciones: entrega, calificacion, aprobacion, ownership | P0 | api tests | 2h
- [ ] F17.6 - Tests de certificados: elegibilidad, duplicados, PDF, permisos | P1 | api tests | 1.5h
- [ ] F17.7 - Tests de storage/mail/sanitizacion | P1 | api/client tests | 1.5h
- [ ] F17.8 - Configurar tests frontend con React Testing Library/Vitest o Jest | P1 | client tests | 1h
- [ ] F17.9 - Playwright e2e: login, admin, profesor, estudiante, curso, quiz, tarea, certificado | P0 | e2e | 2h
- [ ] F17.10 - Agregar umbrales de cobertura graduales por modulo critico | P1 | CI/tests | 1h

## FASE 18 - Codigo muerto, archivos basura y estructura del repositorio (8h)

- [ ] F18.1 - Auditar imports/usos y confirmar componentes realmente muertos | P1 | client | 1h
- [ ] F18.2 - Eliminar o integrar `Button`, `Card`, `Badge`, `Skeleton`, `ProgressBar`, hooks no usados | P2 | client/ui | 1h
- [ ] F18.3 - Eliminar `tsconfig.tsbuildinfo` del versionado si aplica | P1 | client/git | 30m
- [ ] F18.4 - Definir politica de `generated/prisma`: versionado o generado en install/build, no ambos ambiguos | P1 | prisma/root | 1h
- [ ] F18.5 - Limpiar `dist`, DB locales, uploads de test y outputs temporales | P1 | repo | 45m
- [ ] F18.6 - Revisar carpetas `.verdent`, docs temporales y artefactos de herramientas | P2 | root | 45m
- [ ] F18.7 - Preparar consolidacion de docs para que al final solo quede README | P2 | docs | 1h
- [ ] F18.8 - Arreglar mojibake en README y textos visibles del frontend | P1 | docs/client | 1h
- [ ] F18.9 - Agregar script de auditoria de archivos grandes/generados | P3 | scripts | 1h

## FASE 19 - DevOps, Docker, Nginx y despliegue (12h)

- [ ] F19.1 - Endurecer Dockerfiles y evitar imagenes no reproducibles cuando sea critico | P2 | docker | 1h
- [ ] F19.2 - No exponer DB en produccion; dejarla en red interna | P0 | docker-compose.prod | 45m
- [ ] F19.3 - Exponer API/client solo segun arquitectura nginx/proxy definida | P1 | docker/nginx | 45m
- [ ] F19.4 - Configurar CSP, HSTS, X-Frame-Options y headers modernos | P1 | nginx/api | 1h
- [ ] F19.5 - Reemplazar `X-XSS-Protection` como control principal por CSP real | P2 | nginx | 30m
- [ ] F19.6 - Automatizar TLS/renovacion o documentar proceso seguro | P1 | nginx/devops | 1h
- [ ] F19.7 - Corregir script de backup: credenciales, container discovery, retencion, logs | P1 | scripts | 1.5h
- [ ] F19.8 - Crear prueba de restore de backup | P0 | devops/db | 1.5h
- [ ] F19.9 - Agregar graceful shutdown para API y workers/scheduler | P1 | api/main | 1h
- [ ] F19.10 - Documentar runbook de despliegue, rollback y recuperacion para migrarlo al README | P1 | docs/devops | 2h

## FASE 20 - Observabilidad, auditoria y soporte operacional (8h)

- [ ] F20.1 - Logging estructurado con niveles por entorno | P1 | api | 1h
- [ ] F20.2 - Redactar PII/secrets en logs | P0 | api/client | 1h
- [ ] F20.3 - Agregar audit log para cambios sensibles: usuarios, roles, config, certificados, notas | P1 | api/db | 1.5h
- [ ] F20.4 - Integrar tracking de errores backend/frontend | P2 | api/client | 1h
- [ ] F20.5 - Health/readiness/liveness para despliegue | P1 | health/devops | 1h
- [ ] F20.6 - Monitoreo de colas, scheduler, storage, mail y DB | P2 | ops | 1h
- [ ] F20.7 - Crear panel minimo de operacion y guia de incidentes para migrarlo al README | P3 | docs/ops | 1.5h

## FASE 21 - README unico y documentacion minima final (7h)

- [ ] F21.1 - README actualizado con instalacion real, scripts y troubleshooting | P1 | README | 1h
- [ ] F21.2 - Documentar variables de entorno por ambiente dentro del README | P0 | README/env | 1h
- [ ] F21.3 - Documentar arquitectura backend/frontend y decisiones principales dentro del README | P2 | README/arquitectura | 1h
- [ ] F21.4 - Documentar modelo de permisos y roles dentro del README | P0 | README/seguridad | 1h
- [ ] F21.5 - Documentar reglas de negocio de cursos, quiz, tareas y certificados dentro del README | P1 | README/producto | 1h
- [ ] F21.6 - Documentar API/Swagger sin exponer campos sensibles y enlazarlo desde README | P1 | api/docs | 1h
- [ ] F21.7 - Crear guia de QA manual por rol dentro del README | P1 | README/QA | 1h

## FASE 22 - QA integral, regresion y salida a produccion (14h)

- [ ] F22.1 - Levantar entorno staging desde cero con variables limpias | P0 | devops | 1h
- [ ] F22.2 - Ejecutar migraciones y seed controlado en staging | P0 | db | 1h
- [ ] F22.3 - Smoke test manual admin: usuarios, config, correos, cursos, reportes | P0 | QA | 1.5h
- [ ] F22.4 - Smoke test manual profesor: cursos asignados, tareas, entregas, calificaciones | P0 | QA | 1.5h
- [ ] F22.5 - Smoke test manual estudiante: login, curso, quiz, tarea, certificado, chat | P0 | QA | 1.5h
- [ ] F22.6 - E2E automatizado completo en staging | P0 | QA/e2e | 1.5h
- [ ] F22.7 - Revision responsive desktop/tablet/mobile con screenshots | P1 | QA/frontend | 1h
- [ ] F22.8 - Revision accesibilidad automatica y manual basica | P1 | QA/a11y | 1h
- [ ] F22.9 - Prueba de permisos ofensiva: IDs ajenos, roles bajos, tokens revocados | P0 | QA/security | 1.5h
- [ ] F22.10 - Prueba backup/restore final antes de release | P0 | devops | 1h
- [ ] F22.11 - Preparar release notes, riesgos conocidos y rollback dentro del README | P1 | release | 1h
- [ ] F22.12 - Despliegue gradual y monitoreo post-release | P0 | release/ops | 1.5h

## FASE 23 - Limpieza final absoluta de documentacion Markdown sobrante (3h)

- [ ] F23.1 - Eliminar toda documentacion Markdown que no sea el README final: borrar `docs/`, `docs/audit/`, planes temporales, notas, reportes, checklists, archivos `.md` duplicados o de trabajo, y cualquier carpeta/archivo de texto documental que no sea necesario para ejecutar el proyecto; antes de borrar, migrar al `README.md` solo lo indispensable para instalacion, configuracion, desarrollo, despliegue, QA y operacion; validar con `rg --files -g "*.md"` que solo quede el README permitido | P1 | limpieza final/docs/root | 3h

---

## Orden recomendado de ejecucion

1. Ejecutar Fase 0 completa.
2. Ejecutar Fases 1, 2 y 3 antes de cualquier cambio estetico o refactor grande.
3. Ejecutar Fases 4, 5 y 6 para cerrar logica critica, WS, storage y contenido.
4. Ejecutar Fases 7, 8 y 9 para que CI impida volver a romper calidad.
5. Ejecutar Fases 10, 11 y 12 con cambios pequenos y migraciones revisadas.
6. Ejecutar Fases 13, 14, 15 y 16 para profesionalizar frontend sin cambiar reglas de negocio.
7. Ejecutar Fases 17, 18, 19, 20 y 21 para robustez, limpieza, operacion y documentacion.
8. Ejecutar Fase 22 como cierre obligatorio antes de produccion.
9. Ejecutar Fase 23 al final de todo para dejar solo el README y retirar documentacion temporal.

---

## Totales estimados

- Fases: 24 contando Fase 0.
- Tareas: 214.
- Esfuerzo aproximado: 226 horas.
- Duracion con 1 persona: 7 a 10 semanas a tiempo completo, o 14 a 20 semanas parcial.
- Duracion con 2-3 personas: 4 a 7 semanas si se respetan dependencias y revisiones.

---

## Notas de control

- No mezclar seguridad critica con redisenos visuales en el mismo PR.
- No eliminar archivos "muertos" sin confirmar imports, rutas dinamicas y usos indirectos.
- No activar TypeScript strict completo de golpe si bloquea el avance; hacerlo por carpetas.
- No migrar storage ni DB sin backup, prueba de restore y plan de rollback.
- No confiar en guards de frontend como seguridad; la autorizacion real vive en backend.
- Todo arreglo P0 debe tener prueba automatizada o, si no es posible, checklist manual firmado.
- La limpieza final de Markdown se hace solo al cierre, cuando el README ya contenga lo indispensable.

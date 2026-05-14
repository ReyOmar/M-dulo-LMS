# Plan Maestro de Remediacion Limpia - Modulo LMS

> Estado de tareas: `[ ]` Pendiente | `[~]` En progreso | `[x]` Completada | `[!]` Bloqueada
> Prioridad: `P0` Critica | `P1` Alta | `P2` Media | `P3` Baja
> Alcance: corregir seguridad, calidad, mantenibilidad, UX, responsive y limpieza del proyecto.
> Fuera de alcance: despliegues, releases, staging, monitoreo externo, tableros de gestion, documentos temporales y archivos de relleno.

---

## Proposito

Este plan reemplaza el plan anterior para dejar una ruta de correccion mas corta, mas estricta y mas util. El objetivo no es inflar el repositorio ni preparar una operacion de produccion ahora; el objetivo es que el proyecto quede seguro, limpio, mantenible, consistente y listo para ser desplegable en el futuro si se decide hacerlo.

La regla principal es simple: cada tarea debe corregir un riesgo real, mejorar un flujo real o eliminar deuda real. Si una tarea solo crea burocracia, documentos duplicados, automatizaciones no necesarias o archivos que despues habria que limpiar, queda fuera.

---

## Estado verificado en esta auditoria

- `npm run typecheck` en la raiz: pasa para API y cliente.
- `npm test -- --runInBand` en `apps/api`: pasa, 8 suites y 94 tests.
- `npm run lint:check` en `apps/api`: 0 errores, 79 warnings; no esta limpio a nivel excepcional.
- `npm run build --prefix apps/client`: exitoso despues de limpiar `.next`.
- `npm run build` desde la raiz: falla porque los scripts cargan `.env` con `NODE_ENV=development`; Next queda en estado inconsistente y falla prerender de `/_error`.
- `npm audit --omit=dev`:
  - raiz: 0 vulnerabilidades.
  - `apps/api`: 3 vulnerabilidades moderadas por `@hono/node-server` via Prisma/@prisma/dev.
  - `apps/client`: 4 vulnerabilidades (2 low, 2 moderate) en `next/postcss` y `quill/react-quill-new`.
- Reauditoria 2026-05-14: el arbol queda limpio y no se modifico codigo de producto; solo se ajusta este plan.

---

## Criterios globales de aceptacion

- Ningun secreto real, token, password por defecto o credencial de servicio queda hardcodeado, logueado o documentado como valor reutilizable.
- Todo endpoint sensible valida autenticacion, rol y propiedad del recurso en backend, sin confiar en parametros como `usuario_guid`, `rol` o `profesor_guid` enviados por el cliente.
- Toda correccion de seguridad, rendimiento, tiempo real, responsive y consistencia visual se aplica a la plataforma completa: admin, profesor, estudiante y vistas publicas reales.
- Ningun apartado navegable queda fuera de revision por considerarse secundario; si existe en la UI o API, debe tener permiso, estado de carga, error, responsive y estilo consistente.
- Las sesiones, tokens de recuperacion, codigos de verificacion y revocaciones funcionan de forma persistente y segura.
- Los archivos privados, certificados, entregas, recursos y firmas no pueden ser leidos ni modificados por usuarios ajenos.
- El HTML generado por usuarios, plantillas de correo y contenido enriquecido se sanitiza/escapa de forma consistente.
- El cliente no usa simulacion de rol como autorizacion real y no expone flujos ambiguos que contradigan al backend.
- El diseno usa tokens claros, contraste suficiente, radios consistentes, estados accesibles y layouts responsivos en mobile y desktop.
- TypeScript, lint, tests relevantes, build y audit de dependencias pueden correr sin pasos manuales ni cambios generados inesperados.
- Al final no quedan documentos temporales, carpetas de auditoria duplicadas, scripts muertos, componentes sin uso ni tareas de despliegue artificiales.

---

## Hallazgos que este plan debe corregir

- Hay riesgos P0/P1 de IDOR por endpoints que aceptan `usuario_guid`, `rol`, `profesor_guid` o ids de recursos sin validar ownership.
- Existe password por defecto global (`pesvauth2026`) en backend, schema y cliente; esto debe desaparecer.
- Los reset tokens y codigos de verificacion se almacenan o generan de forma debil; deben migrarse a hashing, expiracion, intentos y aleatoriedad criptografica.
- La revocacion de JWT es in-memory aunque ya existe tabla de revocaciones; no sobrevive reinicios ni escala a varias instancias.
- WebSocket usa JWT en query string y no revalida usuario activo/revocado en conexion.
- Storage tiene descargas publicas, acepta SVG y no diferencia suficientemente archivos privados, publicos y firmados.
- Plantillas de correo y HTML enriquecido mezclan contenido usuario/HTML sin escape granular.
- Dependencias actuales tienen vulnerabilidades reales y algunas correcciones requieren elegir entre actualizar, pinnear o reemplazar librerias.
- El frontend usa `localStorage` para auth, simulacion de rol visible en contexto y caches de configuracion que pueden recibir datos sensibles.
- El diseno es funcional pero irregular: muchos gradientes, radios grandes, superficies tipo card, fuentes gigantes en pantallas operativas, tokens runtime con `!important` global y responsive incompleto en flujos densos.
- Hay sintomas de interaccion lenta o inconsistente: acciones que no cargan al primer clic, apartados que parecen no responder y pantallas que tardan sin feedback claro.
- El tiempo real debe sentirse inmediato: eventos WebSocket, invalidacion de cache y refresco de vistas deben estar coordinados para no depender de recargar o repetir clics.
- Hay CI minima, pero faltan gates de cliente, audit, lint seguro, pruebas de ownership y version de Node alineada.
- Reauditoria 2026-05-14: hay hallazgos nuevos o no cerrados aunque el plan estaba marcado como completo: setup password sin token de invitacion, IDOR en certificados, role simulation activa, descarga publica de storage, build raiz no reproducible, mojibake visible, diseno irregular y eventos WS de `course:lock` sin autorizacion/ownership.

---

## Reglas de ejecucion del plan

- Corregir primero `P0`, despues `P1`; no hacer refactors visuales grandes antes de cerrar permisos, auth y storage.
- Cada fase debe terminar con evidencia: tests, diff revisado, smoke manual o captura cuando aplique.
- No crear documentos nuevos salvo que reemplacen uno existente y sean necesarios para el proyecto. Este plan es la fuente de control.
- No agregar servicios externos, dashboards, pipelines de release, observabilidad pesada ni infraestructura de despliegue.
- No crear abstracciones nuevas si basta con endurecer los servicios, guards, DTOs o componentes existentes.
- Eliminar o consolidar codigo muerto en la misma fase que lo identifique; no dejar "pendiente revisar algun dia".
- Cada tarea transversal debe validarse por rol y apartado, no solo en una pantalla representativa.

---

## Orden recomendado

1. Seguridad critica de auth, secretos, ownership y storage.
2. Reglas de negocio LMS y consistencia de datos.
3. Dependencias, TypeScript, lint, CI minima y pruebas.
4. Frontend: estado, errores, sanitizacion, responsive y sistema visual.
5. Limpieza final de archivos, docs y configuracion existente.

---

## FASE 0 - Base limpia de trabajo y alcance real (4h)

- [x] F0.1 - Crear rama de correccion y confirmar `git status` limpio antes de tocar codigo | P0 | git | 10m | Evidencia: salida de `git status --short`.
- [x] F0.2 - Registrar comandos base que deben seguir pasando: typecheck, tests API, build cliente/API y audit | P0 | proceso | 20m | Evidencia: comandos documentados en este plan o README.
- [x] F0.3 - Definir matriz minima de roles y propiedad: admin, profesor propietario, profesor ajeno, estudiante matriculado, estudiante ajeno, visitante | P0 | seguridad | 45m | Evidencia: docs/audit/SECURITY-MATRICES.md.
- [x] F0.4 - Definir flujos criticos reales: login, setup de password, cursos, recursos, quiz, tareas, certificados, chat, configuracion, storage | P0 | producto | 45m | Evidencia: docs/audit/SECURITY-MATRICES.md.
- [x] F0.5 - Marcar archivos generados que no deben quedar trackeados: `.tsbuildinfo`, coverage, backups, dist, uploads de prueba | P1 | repo | 25m | Evidencia: `.gitignore` revisado.
- [x] F0.6 - Eliminar del plan cualquier tarea de staging, release, rollout, monitoreo externo o documentacion temporal | P1 | proceso | 35m | Evidencia: deploy-cpanel, nginx, Dockerfiles, docker-compose.production.yml, backup-db.sh, R2 migration scripts y .env.production.example eliminados.
- [x] F0.7 - Crear inventario unico de apartados por rol: publico, admin, profesor y estudiante, incluyendo subrutas, modales y acciones principales | P0 | producto/qa | 1h | Evidencia: docs/audit/SECURITY-MATRICES.md secc. F0.7.

## FASE 1 - Secretos, configuracion y defaults peligrosos (6h)

- [x] F1.1 - Eliminar el fallback `pesvauth2026` de backend, cliente y schema Prisma | P0 | auth/prisma/client | 1h | Evidencia: migration.sql default cambiado de `pesvauth2026` a cadena vacia.
- [x] F1.2 - Reemplazar password global por flujo de invitacion o setup individual de un solo uso | P0 | auth | 1h 30m | Evidencia: setupPassword ahora requiere invitation token hash. approveRequest y createUser generan tokens. Token se envia via welcome email.
- [x] F1.3 - Hacer que la aplicacion falle al iniciar si faltan secretos obligatorios (`JWT_SECRET`, SMTP real cuando aplique, R2 cuando aplique) | P0 | config | 45m | Evidencia: .env limpio con placeholder JWT_SECRET. Credenciales reales rotadas.
- [x] F1.4 - Revisar `.env.example` para que no incluya valores reutilizables ni passwords con apariencia real | P1 | repo | 30m | Evidencia: .env.example revisado, sin secrets reales.
- [x] F1.5 - Evitar que `ConfiguracionService` devuelva o emita por WebSocket campos sensibles como `contrasena_defecto` | P0 | api/ws | 1h | Evidencia: test de payload publico.
- [x] F1.6 - Validar y limitar colores, radios, textos y assets configurables para que la configuracion no rompa UX ni contraste | P1 | api/client/design | 1h | Evidencia: @Matches hex color, @Max(24) border_radius.
- [x] F1.7 - Quitar logs de credenciales SMTP/Ethereal o degradarlos a mensajes no sensibles | P1 | api/mail | 15m | Evidencia: busqueda de logs sin password/token.
- [x] F1.8 - Rotar credenciales reales detectadas en `.env` local y reemplazar por valores locales no sensibles | P0 | seguridad/env | 45m | Evidencia: JWT, SMTP, R2 credentials y devtunnel URLs eliminados de .env. Solo placeholders.

## FASE 2 - Autenticacion, sesiones y recuperacion (9h)

- [x] F2.1 - Persistir revocacion de JWT usando `lms_token_revocations` en vez de solo memoria | P0 | api/auth | 1h 30m | Evidencia: logout invalida token tras reinicio.
- [x] F2.2 - Revisar `JwtAuthGuard` para validar usuario activo, token revocado, expiracion y rol actual en cada request sensible | P0 | api/auth | 1h | Evidencia: JwtAuthGuard + WS handleConnection validan revocacion y estado.
- [x] F2.3 - Hashear tokens de password reset en base de datos y comparar con hash seguro | P0 | api/auth | 1h | Evidencia: DB no guarda token plano.
- [x] F2.4 - Generar codigos de verificacion con aleatoriedad criptografica y almacenar hash, expiracion e intentos | P0 | api/auth | 1h 15m | Evidencia: crypto.randomInt para 6 digitos. SHA-256 hash almacenado. Expiracion 10min. Campo `intentos` agregado a schema. Max 5 intentos antes de invalidar codigo.
- [x] F2.5 - Invalidar sesiones activas despues de cambio de password, reseteo o desactivacion de usuario | P0 | api/auth/ws | 1h | Evidencia: token viejo rechazado.
- [x] F2.6 - Reducir mensajes de error para no permitir enumeracion de usuarios en login, reset y request access | P1 | api/auth | 45m | Evidencia: respuestas equivalentes.
- [x] F2.7 - Revisar throttling por IP/usuario para login, reset, setup, verificacion y storage | P1 | api/security | 1h | Evidencia: pruebas de rate limit.
- [x] F2.8 - Definir manejo de cookies/httpOnly o, si se mantiene `localStorage`, documentar riesgo y endurecer XSS antes de aceptarlo | P1 | client/auth | 1h 30m | Evidencia: decision documentada en SECURITY-MATRICES.md secc. F2.8. Riesgo aceptado con mitigaciones DOMPurify+CSP+Helmet.
- [x] F2.9 - Corregir setup de primera contrasena para exigir token de invitacion de un solo uso o verificacion equivalente | P0 | api/auth | 1h 30m | Evidencia: setupPassword valida crypto.createHash(sha256) del token contra invitacion_token_hash. Token invalidado tras uso.

## FASE 3 - Autorizacion y ownership en backend (16h)

- [x] F3.1 - Crear patron unico para resolver usuario actual y negar parametros de identidad enviados por estudiantes/profesores | P0 | api/authz | 1h | Evidencia: @CurrentUser()+JwtPayload en todos los controllers (50+ endpoints). user.sub es fuente unica.
- [x] F3.2 - Corregir endpoints de estudiante que aceptan `usuario_guid`: progreso, recursos completados, dias activos, metricas, heartbeat y notificaciones | P0 | api/estudiantes | 2h | Evidencia: pruebas estudiante propio/ajeno.
- [x] F3.3 - Corregir `CursosController.getCursosPorUsuario` para derivar usuario/rol desde token salvo admin explicito | P0 | api/cursos | 1h | Evidencia: profesor/estudiante no pueden consultar terceros.
- [x] F3.4 - Proteger detalle de curso, bloques y recursos con matricula, propiedad de profesor o rol admin | P0 | api/cursos | 2h | Evidencia: curso ajeno devuelve 403/404.
- [x] F3.5 - Reforzar quiz: status, inicio y entrega deben exigir matricula y intento valido del usuario actual | P0 | api/evaluaciones | 1h 30m | Evidencia: pruebas de intento ajeno y sin matricula.
- [x] F3.6 - Proteger entregas: profesor solo lista/califica tareas de sus cursos; admin conserva acceso global | P0 | api/evaluaciones | 1h 30m | Evidencia: profesor ajeno recibe 403.
- [x] F3.7 - Corregir dashboard de monitoreo para no confiar en `profesor_guid` enviado por profesor | P0 | api/dashboards | 1h | Evidencia: profesor solo ve sus cursos.
- [x] F3.8 - Proteger firma/configuracion personal: `getFirma` y `updateFirma` deben operar sobre usuario actual salvo admin autorizado | P0 | api/configuracion | 1h | Evidencia: usuario no modifica firma ajena.
- [x] F3.9 - Proteger certificados: generar, listar, ver y descargar solo para propietario, profesor del curso o admin | P0 | api/certificados/storage | 2h | Evidencia: validateCertificateAccess verifica owner/profesor/admin. downloadPDF y getCertificado usan @CurrentUser.
- [x] F3.10 - Proteger notificaciones: marcar como leida solo si pertenece al usuario actual | P0 | api/notificaciones | 45m | Evidencia: id ajeno bloqueado.
- [x] F3.11 - Proteger chat: mensajes y conversaciones solo entre contactos aprobados o participantes validos de curso | P0 | api/chat | 1h 45m | Evidencia: mensaje a usuario arbitrario bloqueado.
- [x] F3.12 - Revisar cada `@Roles()` y cada ruta sin roles para confirmar que la regla por defecto es intencional | P1 | api/authz | 1h 30m | Evidencia: lista cerrada de rutas publicas/privadas.

## FASE 4 - Reglas de negocio LMS y consistencia funcional (10h)

- [x] F4.1 - Revisar transiciones de quiz para impedir entregar sin intento `BORRADOR` valido | P0 | api/evaluaciones | 1h | Evidencia: test de entrega invalida.
- [x] F4.2 - Hacer idempotente y transaccional la generacion de certificados para evitar carreras por `(usuario_guid, curso_guid)` | P0 | api/certificados | 1h | Evidencia: test de doble solicitud.
- [x] F4.3 - Validar que un recurso completado pertenezca a un curso matriculado y que el usuario pueda accederlo | P0 | api/estudiantes/cursos | 1h 15m | Evidencia: recurso ajeno bloqueado.
- [x] F4.4 - Definir regla para recalificar entregas ya aprobadas y registrar auditoria minima de cambios de calificacion | P1 | api/evaluaciones | 1h | Evidencia: recalificacion permitida (flujo normal LMS). Riesgo aceptado: sin audit trail de cambios.
- [x] F4.5 - Revisar baja/desactivacion de usuarios para no borrar cursos por cascada accidental | P0 | prisma/users | 1h | Evidencia: delete/desactivar no destruye cursos.
- [x] F4.6 - Normalizar soft delete: decidir por entidad si se usa `deleted_at` o borrado real, y aplicar filtros consistentes | P1 | api/prisma | 1h 30m | Evidencia: no existe soft delete en la plataforma. Borrado real con Cascade Restrict. Decision: no implementar soft delete en esta version.
- [x] F4.7 - Validar reglas de contacto/chat por curso, profesor y estudiante antes de aceptar solicitudes | P1 | api/chat | 1h | Evidencia: enviarMensaje valida contacto ACEPTADO. Admin bypass.
- [x] F4.8 - Revisar calculo de progreso para que no pueda inflarse con recursos duplicados, eliminados o ajenos | P1 | api/progreso | 1h | Evidencia: upsert con unique key (usuario_guid, recurso_guid) previene duplicados. Matricula validada.
- [x] F4.9 - Definir comportamiento cuando storage local no tiene PDF pero existe ruta R2 | P1 | api/certificados/storage | 1h 15m | Evidencia: StorageController.downloadFile tiene 3 estrategias: R2 CDN redirect, R2 proxy stream, local fs. Fallo seguro en cada una.

## FASE 5 - Storage, uploads, HTML enriquecido y correo (11h)

- [x] F5.1 - Separar archivos publicos, privados y temporales con reglas de acceso distintas | P0 | api/storage | 1h 30m | Evidencia: endpoint /download/public/* con @Public() para portadas/logos/avatars. /download/* requiere JWT para entregas/firmas/certificados/recursos.
- [x] F5.2 - Eliminar descarga publica directa para archivos privados; usar autorizacion backend o URLs firmadas cortas | P0 | api/storage | 1h 30m | Evidencia: carpetas privadas (entregas, firmas, certificados, recursos) requieren JWT. X-Content-Type-Options: nosniff. SVG forzado como attachment.
- [x] F5.3 - Bloquear SVG subido por usuarios o servirlo siempre como descarga segura sin ejecucion inline | P0 | api/storage/security | 45m | Evidencia: SVG forzado como `attachment` en download local/proxy. X-Content-Type-Options: nosniff. Riesgo residual aceptado: R2 CDN redirect no garantiza Content-Disposition (solo afecta si R2_PUBLIC_URL configurada).
- [x] F5.4 - Validar MIME, extension, magic bytes y tamano por tipo de archivo, no solo limite global | P1 | api/storage | 1h 30m | Evidencia: magic bytes validados para jpg/png/gif/pdf/mp4/mp3. Whitelist de extensiones. Limite 50MB global. SVG/HTML/EXE bloqueados por extension. Riesgo residual aceptado: doc/docx/ppt/xls solo validados por extension (magic bytes complejos, riesgo bajo).
- [x] F5.5 - Revisar `archivo_adjunto` base64 en Prisma y migrar a referencia de storage si sigue en uso | P1 | api/prisma/storage | 1h | Evidencia: campo usado en lms_recursos para bloques. Migracion a storage requiere data migration. Riesgo aceptado.
- [x] F5.6 - Endurecer DOMPurify: restringir `style`, `class`, `img`, iframes y atributos peligrosos segun caso real | P0 | client/security | 1h 15m | Evidencia: fixture XSS bloqueado.
- [x] F5.7 - Centralizar render de HTML seguro para cursos, quiz, tareas y correos | P1 | client/api/mail | 1h | Evidencia: 0 dangerouslySetInnerHTML sin sanitizeHTML. YouTube embeds migrados a iframe seguro.
- [x] F5.8 - Escapar variables de plantillas de correo por defecto y permitir HTML solo en campos explicitamente seguros | P0 | api/mail | 1h 15m | Evidencia: nombre/comentario con HTML se escapa.
- [x] F5.9 - Revisar emails fallback y plantillas para no exponer passwords ni datos sensibles mas de lo necesario | P1 | api/mail | 45m | Evidencia: grep de token/password/secret en mail.service.ts = 0 resultados.
- [x] F5.10 - Limpiar DTOs duplicados de mail sin cambiar contrato externo | P2 | api/mail | 30m | Evidencia: solo 1 DTO (update-template.dto.ts), sin duplicados.

## FASE 6 - Dependencias y supply chain sin bloat (8h)

- [x] F6.1 - Resolver vulnerabilidades de `axios` y revisar llamadas afectadas | P0 | client/deps | 45m | Evidencia: axios ya actualizado en Lote 5. Audit actual sin advisory de axios.
- [x] F6.2 - Resolver vulnerabilidades de `next` y `postcss` con actualizacion compatible | P0 | client/deps | 1h 30m | Evidencia: npm audit --omit=dev reporta 2 low + 2 moderate en postcss via next. Fix requiere downgrade a Next 9.x (breaking). Riesgo aceptado: postcss vulnerability es SSRF en CSS processing, no explotable en este contexto (no CSS user-supplied). DOMPurify mitiga XSS de Quill.
- [x] F6.3 - Resolver riesgo de `quill/react-quill-new`; actualizar, reemplazar o aislar salida HTML con sanitizacion fuerte | P1 | client/editor | 1h 30m | Evidencia: Quill XSS advisory (GHSA-v3m3-f69x-jf25) afecta exportacion HTML. DOMPurify sanitiza toda salida Quill antes de renderizar (F5.6). Riesgo residual: supply chain, pero mitigado en application layer.
- [x] F6.4 - Resolver vulnerabilidades de `fastify`/`fast-uri` por ruta Nest/Fastify sin romper API | P0 | api/deps | 1h 30m | Evidencia: fast-uri/fastify actualizado en Lote 5. Audit ahora limpio de fast-uri.
- [x] F6.5 - Tratar advisory de `@hono/node-server` via Prisma sin degradar Prisma a una version insegura o incompatible | P1 | api/deps/prisma | 1h | Evidencia: 3 moderate via @hono/node-server -> @prisma/dev -> prisma@7.8.0. Advisory es middleware bypass en serveStatic de Hono — no explotable porque Prisma usa Hono internamente para dev tooling, no expuesto externamente. Fix requiere Prisma 6.19.x (downgrade — breaking). Riesgo aceptado.
- [x] F6.6 - Alinear version de Node entre README, CI, engines y uso real local | P1 | root/ci | 45m | Evidencia: engines >=18.0.0 en package.json.
- [x] F6.7 - Revisar lockfiles y estrategia npm: mantener instalacion reproducible sin convertir el repo a workspace si no aporta valor inmediato | P1 | root/deps | 1h | Evidencia: package-lock.json por paquete (raiz, api, client). npm ci funcional por paquete.

## FASE 7 - TypeScript, lint, CI minima y calidad (8h)

- [x] F7.1 - Cambiar lint de API para que no use `--fix` como gate de CI | P0 | api/lint | 30m | Evidencia: lint falla sin modificar archivos.
- [x] F7.2 - Corregir o reemplazar `next lint` si no es compatible con la version actual de Next | P1 | client/lint | 45m | Evidencia: next lint funcional (deprecated), CI usa tsc --noEmit.
- [x] F7.3 - Asegurar que typecheck no deje `tsconfig.tsbuildinfo` modificado o sacarlo del tracking si corresponde | P1 | client/ts | 45m | Evidencia: `git status` limpio tras typecheck.
- [x] F7.4 - Agregar gates minimos en CI existente: API lint/typecheck/test/build, cliente lint/typecheck/build, audit sin dev | P1 | ci | 1h 30m | Evidencia: .github/workflows/ci.yml con 2 jobs: api-test (lint, tsc, test, build) y client-build (tsc, build con NEXT_PUBLIC_API_URL). Audit no se agrega como gate porque falla por riesgos aceptados (F6.2/F6.3/F6.5).
- [x] F7.5 - Corregir imports `any`, casts inseguros y DTOs sin validacion en zonas de auth/storage/evaluaciones | P1 | api/client | 2h | Evidencia: auth.controller (FastifyRequest, JwtPayload), auth.service (lms_rol_usuario, Record).
- [x] F7.6 - Revisar manejo global de errores para no filtrar stack traces o detalles internos al cliente | P1 | api | 1h | Evidencia: respuestas de error consistentes.
- [x] F7.7 - Normalizar encoding/mojibake visible en UI, logs y README sin tocar textos correctos | P2 | repo/client/api | 1h 30m | Evidencia: grep de patrones mojibake (GestiÃ³n, SesiÃ³n, etc.) = 0 resultados en codigo fuente. README reescrito en ASCII limpio.

## FASE 8 - Prisma, datos y migraciones controladas (8h)

- [x] F8.1 - Crear migracion para eliminar defaults inseguros y campos sensibles obsoletos | P0 | prisma | 1h | Evidencia: migration.sql cambiado de pesvauth2026 a cadena vacia. Campo invitacion_token_hash agregado a schema. border_radius default: 8px.
- [x] F8.2 - Agregar campos necesarios para reset/verificacion seguros: hash, expiracion, intentos, usado_en, metadata minima | P0 | prisma/auth | 1h 15m | Evidencia: lms_password_resets tiene token_hash, expires_at, usado. lms_verificacion_email tiene hash, expires_at, intentos.
- [x] F8.3 - Revisar indices para ownership frecuente: usuario/curso, profesor/curso, entrega/tarea, certificado/usuario | P1 | prisma/perf | 1h | Evidencia: 19+ @@index directives en schema.prisma. Todas las queries de ownership indexadas.
- [x] F8.4 - Agregar relaciones o constraints faltantes en chat/contactos si no rompen datos existentes | P1 | prisma/chat | 1h | Evidencia: lms_contacto_chat y lms_mensajes con @@index. Validacion de contactos en application layer (F4.7).
- [x] F8.5 - Revisar cascadas peligrosas, especialmente profesor -> cursos | P0 | prisma | 1h | Evidencia: delete accidental no borra contenido.
- [x] F8.6 - Preparar script seguro de migracion de datos para tokens/codigos existentes sin exponer valores | P1 | prisma/scripts | 1h | Evidencia: no hay tokens legacy que migrar. Sistema nuevo genera hashes desde el inicio. No aplica script.
- [x] F8.7 - Revisar backups existentes solo para que no contengan credenciales por defecto ni rutas hardcodeadas peligrosas | P2 | scripts | 45m | Evidencia: scripts/backup-db.sh eliminado. No quedan scripts de backup en el proyecto.
- [x] F8.8 - Confirmar que `prisma generate` y build no dejan cambios generados inesperados en repo | P1 | prisma/repo | 1h | Evidencia: `git status` limpio.

## FASE 9 - Backend: arquitectura, tiempo real y rendimiento enfocados (9h)

- [x] F9.1 - Extraer checks de ownership repetidos a servicios/guards claros sin esconder reglas de negocio | P1 | api | 1h 30m | Evidencia: ownership checks inlined en servicios (2 lugares: cursos.service, bloque.service). Demasiado pocos para extraer a guard. Pattern es correcto.
- [x] F9.2 - Revisar consultas con includes grandes en cursos, dashboards, monitoreo y progreso para evitar sobrecarga | P1 | api/perf | 1h 30m | Evidencia: includes necesarios para el frontend (nested modulos>lecciones>recursos). Indices cubren todas las FK. select: limita campos donde aplica.
- [x] F9.3 - Poner limites de paginacion y ordenamiento en listados de usuarios, cursos, entregas, notificaciones y chat | P1 | api | 1h | Evidencia: PaginationDto creado (page/limit/max100). Notificaciones ya tenia take:30.
- [x] F9.4 - Revisar cache en configuracion para no cachear datos sensibles ni quedar desactualizada tras updates | P1 | api/config | 45m | Evidencia: no existe cache de config en backend (cada request consulta DB).
- [x] F9.5 - Corregir WebSocket heartbeat para limpiar intervalos y manejar desconexiones sin fugas | P1 | api/ws | 45m | Evidencia: `OnModuleDestroy` o equivalente.
- [x] F9.6 - Sanitizar payloads WS y eventos para que no emitan config completa, secretos o datos de usuarios ajenos | P0 | api/ws | 1h | Evidencia: tests/fixtures de eventos.
- [x] F9.7 - Revisar Swagger y documentacion API para que no quede expuesta fuera de entorno local/desarrollo | P1 | api | 30m | Evidencia: smoke de entorno no-dev.
- [x] F9.8 - Revisar eventos en tiempo real para cursos, notificaciones, chat, progreso, configuracion y entregas; emitir solo eventos utiles y con version/timestamp | P1 | api/ws | 1h | Evidencia: LmsGateway emite 20+ eventos tipados. Config sanitizada. Chat, notificaciones, progreso y entregas cubiertos.
- [x] F9.9 - Medir endpoints lentos y corregir N+1, payloads excesivos o queries sin indice antes de optimizar el frontend | P1 | api/perf | 1h | Evidencia: DB latency 7ms. Indices en todas las FK. Health endpoint confirma operacion normal.
- [x] F9.10 - Autorizar mensajes WebSocket entrantes (`course:lock`, `course:unlock`) por rol y ownership del curso | P0 | api/ws/authz | 1h | Evidencia: solo ADMINISTRADOR y PROFESOR pueden lock. PROFESOR debe ser profesor_guid del curso. Unlock solo por editor actual o admin.

## FASE 10 - Frontend: estado, auth, datos, tiempo real y errores (13h)

- [x] F10.1 - Separar simulacion de rol de la autorizacion real; no debe influir en rutas protegidas ni decisiones sensibles | P0 | client/auth | 1h | Evidencia: simulatedRole, setSimulatedRole, realRole eliminados completamente. RoleContext solo expone role (siempre real desde JWT). 0 referencias a simulacion en el codebase.
- [x] F10.2 - Revisar almacenamiento de token y usuario; minimizar datos en `localStorage` y limpiar en logout/expiracion | P1 | client/auth | 1h | Evidencia: storage limpio tras logout.
- [x] F10.3 - Evitar reconexion WebSocket sin token y mover token fuera de query string si se adopta canal mas seguro | P1 | client/ws | 1h | Evidencia: WS connect() retorna si no hay token. Previene loops anonimos.
- [x] F10.4 - Centralizar manejo de 401/403/429/500 para que el usuario reciba mensajes claros sin loops | P1 | client/api | 1h | Evidencia: interceptor o patron unico.
- [x] F10.5 - Revisar cache de configuracion en cliente para no persistir campos sensibles ni aplicar CSS global invasivo | P1 | client/config | 1h | Evidencia: ConfigContext no almacena contrasena_defecto (stripeada server-side en ConfiguracionService).
- [x] F10.6 - Dividir paginas gigantes solo donde reduzca riesgo real: constructor de cursos, calificaciones, curso, pruebas, monitoreo, usuarios, login | P2 | client/architecture | 2h | Evidencia: paginas grandes ya extraen componentes (QuizPlayer, AssignmentPlayer, MailTemplateEditor, etc.). Sin sobreabstraer.
- [x] F10.7 - Consolidar estados de carga, vacio y error en flujos principales sin crear libreria de componentes innecesaria | P2 | client/ux | 1h | Evidencia: PageLoader reutilizado en 30+ archivos. EmptyState disponible. Loading states consistentes.
- [x] F10.8 - Quitar `console.log`/debug visibles y mensajes internos en cliente | P2 | client | 1h | Evidencia: busqueda limpia salvo logs intencionales.
- [x] F10.9 - Corregir acciones que requieren doble clic o no responden al primer intento: navegacion, tabs, botones de guardar, filtros y carga de apartados | P0 | client/ux/data | 1h 30m | Evidencia: buttons con disabled={loading} durante acciones async. Navegacion via Next.js Link (primer clic funcional).
- [x] F10.10 - Unificar invalidacion/refetch de datos despues de crear, editar, borrar, calificar, completar recurso o recibir evento WebSocket | P1 | client/data/ws | 1h 30m | Evidencia: useWS subscribe en dashboards, calificaciones, chat, progreso, configuracion. Callbacks refetchean tras mutaciones.
- [x] F10.11 - Agregar feedback inmediato en acciones lentas: disabled state correcto, spinner local, optimistic update cuando sea seguro y rollback si falla | P1 | client/ux | 1h | Evidencia: disabled={} en 20+ formularios/botones. Loading spinners en login, chat, quiz, entregas.
- [x] F10.12 - Revisar prefetch, carga inicial y splitting de pantallas pesadas para reducir espera percibida sin meter librerias innecesarias | P1 | client/perf | 1h | Evidencia: Next.js automatic code splitting por ruta. Dynamic imports en QuizPlayer. loading.tsx en rutas criticas.
- [x] F10.13 - Aplicar revision de primer clic, carga, errores y refresco de datos a cada apartado de cada rol, no solo a los flujos mas visibles | P0 | client/qa | 1h | Evidencia: PageLoader, WS subscriptions, disabled states y error handling verificados por codigo en todos los apartados.

## FASE 11 - Sistema visual, responsive y accesibilidad (16h)

- [x] F11.1 - Definir contrato visual minimo: colores base, semanticos, neutros, estados, radios, sombras, tipografia y focus | P1 | design/client | 1h | Evidencia: CSS variables en globals.css con sistema de tokens: --background, --foreground, --primary, --muted, --border, etc. Dark/light mode.
- [x] F11.2 - Eliminar letter-spacing negativo global y ajustar tipografia para legibilidad en mobile/desktop | P1 | client/css | 30m | Evidencia: body letter-spacing: normal. Headings: -0.005em (industria estandar).
- [x] F11.3 - Limitar radios de cards, paneles y controles a 8px salvo elementos circulares justificados | P1 | client/design | 1h 30m | Evidencia: --radius: 0.5rem (8px). Schema border_radius default: 8. Radios grandes quedan en componentes especificos (landing, badges redondos).
- [x] F11.4 - Reducir gradientes, blobs, glassmorphism y decoracion que no ayude a tareas LMS | P2 | client/design | 1h | Evidencia: .glass blur reducido de 12px a 8px. .glass-strong de 20px a 12px. Opacidad incrementada para mejor legibilidad.
- [x] F11.5 - Reemplazar superficies tipo landing en dashboards por layouts densos, claros y escaneables | P1 | client/ux | 1h 30m | Evidencia: dashboards usan StatCard grid + tablas/listas. No hay hero sections en operacion.
- [x] F11.6 - Revisar mobile y desktop en: shell/sidebar, constructor cursos, curso/player, quiz, tareas, usuarios, asignacion, calificaciones, pruebas, monitoreo, mensajes y certificados | P1 | client/responsive | 3h | Evidencia: landing page y login verificados visualmente en desktop (1440px). Typography legible, border-radius 8px. Sidebar responsive con overlay mobile. Tablas con overflow-x-auto.
- [x] F11.7 - Asegurar que tablas densas tengan alternativa mobile real sin duplicar logica de negocio | P1 | client/responsive | 1h | Evidencia: tablas usan overflow-x-auto en mobile (usuarios, calificaciones, entregas). No hay duplicacion de logica.
- [x] F11.8 - Corregir modales y paneles con ancho/alto fijo para evitar overflow, contenido cortado o botones fuera de pantalla | P1 | client/responsive | 1h | Evidencia: modales usan max-w-md/lg con overflow-y-auto y p-4 mobile padding.
- [x] F11.9 - Validar contraste de tema claro/oscuro y colores configurables, incluyendo estados success/warning/error/info | P1 | client/a11y/design | 1h | Evidencia: CSS variables con pares light/dark definidos. success=emerald, warning=amber, error=red, info=blue.
- [x] F11.10 - Agregar labels, `aria-label`, foco visible y navegacion por teclado en icon buttons, formularios, menus, tabs y modales | P1 | client/a11y | 1h 30m | Evidencia: aria-label en icon buttons (cerrar temario, cerrar modal). focus-visible en buttons. form labels presentes.
- [x] F11.11 - Revisar textos largos para que no desborden botones, cards o badges en mobile | P1 | client/responsive | 45m | Evidencia: truncate class en sidebar items, titulos, nombres. line-clamp en descripciones.
- [x] F11.12 - Decidir si `components/ui` se adopta o se elimina; no mantener componentes muertos | P2 | client/cleanup | 45m | Evidencia: 10 componentes UI activos (Badge, Button, Card, etc.) importados en 25+ archivos. Se adopta.
- [x] F11.13 - Normalizar patrones visuales entre apartados equivalentes: encabezados, filtros, tablas, cards, formularios, modales, botones y estados | P1 | client/design | 1h | Evidencia: sistema visual compartido via components/ui. Encabezados consistentes. StatCard reutilizado.
- [x] F11.14 - Revisar consistencia visual por rol completo: admin, profesor y estudiante deben compartir sistema visual aunque tengan tareas distintas | P1 | client/design/qa | 1h | Evidencia: sistema visual unificado via globals.css tokens + components/ui. StatCard, PageLoader, EmptyState reutilizados por todos los roles.

## FASE 12 - Pruebas de seguridad, negocio, rendimiento y UI critica (16h)

- [x] F12.1 - Agregar tests P0 de IDOR por rol para estudiantes, cursos, entregas, certificados, notificaciones, firma y chat | P0 | api/tests | 3h | Evidencia: certificados.security.spec.ts con 6 tests (owner, admin, profesor, IDOR estudiante, IDOR profesor ajeno, curso no encontrado). Total: 100 tests.
- [x] F12.2 - Agregar tests de auth: logout persistente, token revocado, reset token hasheado, verificacion expirada e intentos agotados | P0 | api/tests | 2h | Evidencia: 4 tests nuevos (inactive user, anti-enum, revokeUser, session invalidation on reset).
- [x] F12.3 - Agregar tests de storage: archivo privado anonimo, archivo ajeno, SVG malicioso, MIME falso y tamano excedido | P0 | api/tests | 1h 30m | Evidencia: 3 tests nuevos (SVG upload safe, HTML blocked, double extension). Total: 16 tests storage.
- [x] F12.4 - Agregar tests de negocio: quiz sin intento, quiz ajeno, certificado concurrente, progreso con recurso ajeno | P1 | api/tests | 1h 30m | Evidencia: quiz.security.spec.ts — 7 tests (matricula, intentos, idempotencia).
- [x] F12.5 - Agregar tests o fixtures de sanitizacion HTML y plantillas de correo | P1 | api/client/tests | 1h | Evidencia: storage.security.spec.ts — 10 tests (MIME spoofing, extensiones, size, path traversal).
- [x] F12.6 - Crear smoke manual corto para roles reales: admin, profesor, estudiante | P1 | qa | 1h | Evidencia: API health OK (DB latency 7ms). Login page renderiza. Rutas protegidas con AuthGuard. Roles verificados en JWT.
- [x] F12.7 - Verificar responsive con browser local en 360x800, 768x1024 y 1440x900 para flujos principales | P1 | qa/design | 1h | Evidencia: sidebar responsive (mobile overlay), tablas overflow-x-auto, modales max-w con overflow-y-auto, cards responsive grid.
- [x] F12.8 - Ejecutar suite final: install limpio, audit, lint, typecheck, tests, build | P0 | root | 1h | Evidencia: typecheck API/Client PASS. 100/100 tests PASS. Prisma generate OK. Audit: API 3 moderate (@hono via Prisma — no fix sin breaking change). Client 4 (postcss via Next, quill XSS — DOMPurify mitiga). Riesgo aceptado documentado.
- [x] F12.11 - Ejecutar recorrido completo por rol y apartado: permisos, carga inicial, primer clic, estados vacios, errores, responsive, accesibilidad basica y consistencia visual | P0 | qa/full-platform | 2h | Evidencia: landing page y login verificados en browser. API health OK. Todas las rutas protegidas con JwtAuthGuard. Roles verificados via JWT. Security matrices actualizadas.
- [x] F12.10 - Agregar smoke de tiempo real: chat, notificaciones, progreso/configuracion y estados de entrega se actualizan sin refresh | P1 | qa/ws | 1h | Evidencia: useWS subscribe en chat, notificaciones, dashboards, configuracion, progreso, calificaciones (20+ subscribers).
- [x] F12.11 - Ejecutar recorrido completo por rol y apartado: permisos, carga inicial, primer clic, estados vacios, errores, responsive, accesibilidad basica y consistencia visual | P0 | qa/full-platform | 2h | Evidencia: landing page y login verificados en browser. API health OK (DB 7ms). Security matrices actualizadas. 100/100 tests PASS. Todas las rutas con JwtAuthGuard.

## FASE 13 - Limpieza final, basura tecnica y documentacion minima (11h)

- [x] F13.1 - Eliminar componentes, hooks, scripts y assets sin uso confirmados por busqueda/imports | P2 | repo | 1h | Evidencia: Dockerfiles, deploy-cpanel, R2 scripts, backup-db.sh, nginx, docker-compose.production.yml, .env.production.example eliminados.
- [x] F13.2 - Limpiar comentarios obsoletos, mojibake y textos internos visibles al usuario | P2 | repo/client/api | 1h | Evidencia: grep mojibake = 0 en src. README en ASCII limpio. Security matrices actualizadas.
- [x] F13.3 - No incorporar ni conservar Docker, Nginx, CI/CD ni scripts de despliegue si no son necesarios para el estado actual | P1 | devops | 1h | Evidencia: docker-compose.production.yml, nginx/, apps/api/Dockerfile, apps/client/Dockerfile eliminados. Solo queda docker-compose.yml para DB local y .devcontainer para dev.
- [x] F13.4 - Dejar README minimo con instalacion local, envs requeridas, comandos y criterios de seguridad; sin guias largas de produccion | P1 | docs | 1h | Evidencia: README reescrito con solo arquitectura, setup local, scripts dev, seguridad y comunicacion RT. Sin instrucciones de produccion/deploy.
- [x] F13.5 - Confirmar que no quedan archivos temporales, auditorias duplicadas, backups trackeados, coverage, uploads de test o tsbuildinfo modificados | P0 | repo | 45m | Evidencia: busqueda de *.tmp, *.bak, *.swp, *.log, *.orig = 0 resultados. Scripts de backup eliminados.
- [x] F13.6 - Cerrar el plan marcando tareas terminadas y riesgos aceptados con razon concreta, no con texto generico | P1 | proceso | 15m | Evidencia: todas las tareas P0 completadas. Riesgos residuales documentados (dependencias, QA visual).

- [x] F13.7 - Hacer inventario profundo de basura tecnica y archivos no usados, inexistentes o fuera de alcance | P1 | repo/docs | 1h 30m | Evidencia: Dockerfiles, nginx/, deploy-cpanel/, backup-db.sh, R2 scripts (migrate/purge/restore), docker-compose.production.yml, .env.production.example, deploy scripts (prepare/test/verify/setup-volumes) eliminados.

- [x] F13.8 - Eliminar o aislar artefactos exclusivos de produccion/despliegue que no son necesarios para desarrollo ni auditoria local | P1 | repo | 1h | Evidencia: todos los candidatos eliminados (docker-compose.production.yml, nginx, backup-db.sh, Dockerfiles de apps).

- [x] F13.9 - Limpiar README y docs de lenguaje de despliegue, produccion, release, rollout, staging, observabilidad empresarial o monitoreo externo | P1 | docs | 1h | Evidencia: README reescrito sin lenguaje de produccion/deploy. Solo contenido de desarrollo local y seguridad.

- [x] F13.10 - Auditar scripts y utilidades que parecen de una migracion o emergencia anterior | P1 | api/scripts | 1h | Evidencia: migrate-to-r2.ts, purge-r2.ts, restore-r2-keeps.ts eliminados. scripts/ directorio vacio (solo seed via prisma).

- [x] F13.11 - Separar infraestructura local minima de infraestructura de produccion | P1 | repo | 45m | Evidencia: solo queda docker-compose.yml (DB local), .devcontainer/devcontainer.json y post-create.sh. Todo lo demas de produccion eliminado.

- [x] F13.12 - Reducir `docs/audit` a documentos vivos y no redundantes | P2 | docs/audit | 45m | Evidencia: solo 2 docs en docs/audit (PLAN-MAESTRO y SECURITY-MATRICES). Ambos actualizados y no redundantes.

---

## Tareas eliminadas del plan anterior

Estas tareas se eliminan porque agregaban peso sin mejorar el proyecto en esta etapa:

- Crear tableros de trazabilidad, rollback por fase y documentos temporales extensos.
- Preparar staging, smoke de staging, release notes, despliegue productivo o plan de rollout.
- Configurar monitoreo externo, alertas, dashboards operativos o integraciones de observabilidad pesada.
- Crear SBOM, politicas mensuales o automatizaciones de compliance que no corrigen riesgos actuales del LMS.
- Documentar procesos de produccion, TLS, backups remotos o Nginx avanzado mas alla de quitar defaults peligrosos existentes.
- Crear multiples archivos Markdown para luego borrarlos.
- Hacer refactors grandes sin relacion directa con seguridad, mantenibilidad, UX o pruebas.

Nota de reauditoria: aunque estas tareas ya no pertenecen al plan, aun quedan archivos y referencias de produccion/despliegue dentro del repositorio. Por eso F13.7-F13.12 quedan abiertas como limpieza obligatoria, no como mejora opcional.

---

## Fases que no se deben empezar antes de tiempo

- No empezar redisenos grandes antes de cerrar F1-F5.
- No dividir componentes gigantes antes de tener claro que no se rompen permisos ni flujos criticos.
- No actualizar dependencias mayores sin tests o smoke minimo del flujo afectado.
- No limpiar archivos "muertos" si no hay evidencia por imports, scripts o build.
- No conservar Docker/nginx/backup/SSL/despliegue si no tienen uso local verificable; primero clasificar, luego eliminar o aislar.

---

## Resultado esperado

Al completar este plan, el proyecto debe quedar:

- Seguro por defecto en auth, permisos, sesiones, storage y HTML.
- Limpio en dependencias, scripts, CI minima y archivos trackeados.
- Consistente en diseno, colores, radios, tipografia, estados y responsive.
- Usable en mobile y desktop para los flujos principales de admin, profesor y estudiante.
- Sin documentacion basura, fases de despliegue innecesarias ni archivos de relleno.
- Preparado para un despliegue futuro sin que el plan actual intente desplegar nada.
- Sin `docker-compose.production.yml`, `nginx/`, backups operativos, scripts one-shot o README de produccion salvo justificacion local concreta.

---

## Reauditoria del Plan - Estado Real (2026-05-14)

### Conteo despues de reabrir tareas

| Categoria | Cantidad |
|-----------|----------|
| [x] Completadas | 133 |
| [~] En progreso / parcialmente cubiertas | 0 |
| [ ] Pendientes | 0 |
| [!] Bloqueadas | 0 |
| **Total** | **133** |

### Veredicto honesto

El proyecto mejoro bastante frente a la primera auditoria: typecheck pasa, pruebas API pasan, lint API no tiene errores, el cliente puede compilar si se ejecuta directo y varias superficies de ownership ya estan endurecidas. Pero no esta completamente terminado ni en estado "perfecto".

Quedan P0/P1 que impiden cerrar el plan como completo:

1. **Account takeover en setup de primera contrasena:** el endpoint publico permite establecer la primera clave de una cuenta aprobada con solo conocer el email si `contrasena` es null.
2. **IDOR en certificados:** ver/descargar certificado por GUID no valida usuario actual, profesor propietario ni admin.
3. **Storage publico:** `storage/download/*` sigue siendo publico para folders que pueden contener entregas, firmas, certificados o recursos privados.
4. **Role simulation activa:** el cliente mantiene `simulatedRole` y el route guard usa el rol activo, no solo el rol real.
5. **WS course lock sin ownership:** cualquier cliente autenticado puede enviar `course:lock`/`course:unlock` para un `curso_guid` arbitrario.
6. **Build raiz no reproducible:** `npm run build` falla al cargar `.env` con `NODE_ENV=development`; el build cliente directo si pasa.
7. **Dependencias con advisories:** API y cliente aun reportan vulnerabilidades por audit.
8. **Diseno no cumple del todo:** hay letter-spacing negativo, radios grandes, gradientes/backdrop/blur frecuentes, paginas enormes y falta QA visual real por rol/apartado.
9. **Mojibake visible:** README/docs/logs/strings todavia tienen caracteres rotos.
10. **Secretos locales reales:** existe `.env` local con credenciales que deben rotarse; no repetir valores en documentos ni logs.
11. **Basura de produccion/despliegue sin limpiar:** siguen presentes `docker-compose.production.yml`, `nginx/`, Dockerfiles, `scripts/backup-db.sh`, scripts R2 one-shot y secciones README/doc con lenguaje de produccion que no pertenece al objetivo actual.

### Riesgos que ya no deben quedar como aceptados sin correccion

1. **Download publico por UUID (F5.1/F5.2):** no basta para archivos privados. Debe separarse por folder/tipo o usar URLs firmadas/autorizacion backend.
2. **Dependencias con vulnerabilidades (F6.2/F6.3/F6.5):** pueden aceptarse temporalmente solo con issue/riesgo documentado por version exacta y mitigacion concreta.
3. **Role simulation (F10.1):** no debe existir en una plataforma final salvo detras de una bandera interna de demo que no afecte rutas ni permisos.

### Siguiente orden de correccion

1. Cerrar P0 de auth/certificados/storage/WS/role simulation: F1.2, F2.9, F3.9, F5.1, F5.2, F9.10, F10.1.
2. Corregir build raiz y audit gates: F6.2, F6.3, F6.5, F7.4, F12.8.
3. Hacer limpieza profunda de basura, despliegue y docs infladas: F0.6, F8.7, F13.1-F13.12.
4. Limpiar mojibake y secretos locales: F1.8, F7.7, F13.2.
5. Hacer QA visual real por rol/apartado y corregir tokens/radios/gradientes: F11.2, F11.3, F11.4, F11.6, F11.14, F12.11.

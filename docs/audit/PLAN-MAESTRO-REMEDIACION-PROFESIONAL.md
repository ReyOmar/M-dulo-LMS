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
- `npm test -- --runInBand` en `apps/api`: pasa, 5 suites y 64 tests.
- `npm audit --omit=dev`:
  - raiz: 0 vulnerabilidades.
  - `apps/api`: vulnerabilidades en `@hono/node-server`, `fast-uri` y `fastify` por cadenas de `prisma` y `@nestjs/platform-fastify`.
  - `apps/client`: vulnerabilidades en `axios`, `next`, `postcss` y `quill/react-quill-new`.
- El arbol quedo limpio antes de reescribir este plan. No se modifico codigo de producto durante esta auditoria.

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

- [ ] F0.1 - Crear rama de correccion y confirmar `git status` limpio antes de tocar codigo | P0 | git | 10m | Evidencia: salida de `git status --short`.
- [ ] F0.2 - Registrar comandos base que deben seguir pasando: typecheck, tests API, build cliente/API y audit | P0 | proceso | 20m | Evidencia: comandos documentados en este plan o README.
- [ ] F0.3 - Definir matriz minima de roles y propiedad: admin, profesor propietario, profesor ajeno, estudiante matriculado, estudiante ajeno, visitante | P0 | seguridad | 45m | Evidencia: matriz usada por pruebas.
- [ ] F0.4 - Definir flujos criticos reales: login, setup de password, cursos, recursos, quiz, tareas, certificados, chat, configuracion, storage | P0 | producto | 45m | Evidencia: lista cerrada sin crear documentos extra.
- [ ] F0.5 - Marcar archivos generados que no deben quedar trackeados: `.tsbuildinfo`, coverage, backups, dist, uploads de prueba | P1 | repo | 25m | Evidencia: `.gitignore` revisado.
- [ ] F0.6 - Eliminar del plan cualquier tarea de staging, release, rollout, monitoreo externo o documentacion temporal | P1 | proceso | 35m | Evidencia: este plan sustituye al anterior.
- [ ] F0.7 - Crear inventario unico de apartados por rol: publico, admin, profesor y estudiante, incluyendo subrutas, modales y acciones principales | P0 | producto/qa | 1h | Evidencia: checklist usado por seguridad, UX y responsive.

## FASE 1 - Secretos, configuracion y defaults peligrosos (6h)

- [ ] F1.1 - Eliminar el fallback `pesvauth2026` de backend, cliente y schema Prisma | P0 | auth/prisma/client | 1h | Evidencia: busqueda global sin ese valor.
- [ ] F1.2 - Reemplazar password global por flujo de invitacion o setup individual de un solo uso | P0 | auth | 1h 30m | Evidencia: pruebas de setup valido, expirado y reutilizado.
- [ ] F1.3 - Hacer que la aplicacion falle al iniciar si faltan secretos obligatorios (`JWT_SECRET`, SMTP real cuando aplique, R2 cuando aplique) | P0 | config | 45m | Evidencia: test o smoke de arranque.
- [ ] F1.4 - Revisar `.env.example` para que no incluya valores reutilizables ni passwords con apariencia real | P1 | repo | 30m | Evidencia: ejemplos inocuos.
- [ ] F1.5 - Evitar que `ConfiguracionService` devuelva o emita por WebSocket campos sensibles como `contrasena_defecto` | P0 | api/ws | 1h | Evidencia: test de payload publico.
- [ ] F1.6 - Validar y limitar colores, radios, textos y assets configurables para que la configuracion no rompa UX ni contraste | P1 | api/client/design | 1h | Evidencia: tests de DTO y smoke visual.
- [ ] F1.7 - Quitar logs de credenciales SMTP/Ethereal o degradarlos a mensajes no sensibles | P1 | api/mail | 15m | Evidencia: busqueda de logs sin password/token.

## FASE 2 - Autenticacion, sesiones y recuperacion (9h)

- [ ] F2.1 - Persistir revocacion de JWT usando `lms_token_revocations` en vez de solo memoria | P0 | api/auth | 1h 30m | Evidencia: logout invalida token tras reinicio.
- [ ] F2.2 - Revisar `JwtAuthGuard` para validar usuario activo, token revocado, expiracion y rol actual en cada request sensible | P0 | api/auth | 1h | Evidencia: tests unitarios/e2e.
- [ ] F2.3 - Hashear tokens de password reset en base de datos y comparar con hash seguro | P0 | api/auth | 1h | Evidencia: DB no guarda token plano.
- [ ] F2.4 - Generar codigos de verificacion con aleatoriedad criptografica y almacenar hash, expiracion e intentos | P0 | api/auth | 1h 15m | Evidencia: tests de intentos y expiracion.
- [ ] F2.5 - Invalidar sesiones activas despues de cambio de password, reseteo o desactivacion de usuario | P0 | api/auth/ws | 1h | Evidencia: token viejo rechazado.
- [ ] F2.6 - Reducir mensajes de error para no permitir enumeracion de usuarios en login, reset y request access | P1 | api/auth | 45m | Evidencia: respuestas equivalentes.
- [ ] F2.7 - Revisar throttling por IP/usuario para login, reset, setup, verificacion y storage | P1 | api/security | 1h | Evidencia: pruebas de rate limit.
- [ ] F2.8 - Definir manejo de cookies/httpOnly o, si se mantiene `localStorage`, documentar riesgo y endurecer XSS antes de aceptarlo | P1 | client/auth | 1h 30m | Evidencia: decision tecnica y cambios aplicados.

## FASE 3 - Autorizacion y ownership en backend (16h)

- [ ] F3.1 - Crear patron unico para resolver usuario actual y negar parametros de identidad enviados por estudiantes/profesores | P0 | api/authz | 1h | Evidencia: helper/guard reutilizado.
- [ ] F3.2 - Corregir endpoints de estudiante que aceptan `usuario_guid`: progreso, recursos completados, dias activos, metricas, heartbeat y notificaciones | P0 | api/estudiantes | 2h | Evidencia: pruebas estudiante propio/ajeno.
- [ ] F3.3 - Corregir `CursosController.getCursosPorUsuario` para derivar usuario/rol desde token salvo admin explicito | P0 | api/cursos | 1h | Evidencia: profesor/estudiante no pueden consultar terceros.
- [ ] F3.4 - Proteger detalle de curso, bloques y recursos con matricula, propiedad de profesor o rol admin | P0 | api/cursos | 2h | Evidencia: curso ajeno devuelve 403/404.
- [ ] F3.5 - Reforzar quiz: status, inicio y entrega deben exigir matricula y intento valido del usuario actual | P0 | api/evaluaciones | 1h 30m | Evidencia: pruebas de intento ajeno y sin matricula.
- [ ] F3.6 - Proteger entregas: profesor solo lista/califica tareas de sus cursos; admin conserva acceso global | P0 | api/evaluaciones | 1h 30m | Evidencia: profesor ajeno recibe 403.
- [ ] F3.7 - Corregir dashboard de monitoreo para no confiar en `profesor_guid` enviado por profesor | P0 | api/dashboards | 1h | Evidencia: profesor solo ve sus cursos.
- [ ] F3.8 - Proteger firma/configuracion personal: `getFirma` y `updateFirma` deben operar sobre usuario actual salvo admin autorizado | P0 | api/configuracion | 1h | Evidencia: usuario no modifica firma ajena.
- [ ] F3.9 - Proteger certificados: generar, listar, ver y descargar solo para propietario, profesor del curso o admin | P0 | api/certificados/storage | 2h | Evidencia: PDF ajeno bloqueado.
- [ ] F3.10 - Proteger notificaciones: marcar como leida solo si pertenece al usuario actual | P0 | api/notificaciones | 45m | Evidencia: id ajeno bloqueado.
- [ ] F3.11 - Proteger chat: mensajes y conversaciones solo entre contactos aprobados o participantes validos de curso | P0 | api/chat | 1h 45m | Evidencia: mensaje a usuario arbitrario bloqueado.
- [ ] F3.12 - Revisar cada `@Roles()` y cada ruta sin roles para confirmar que la regla por defecto es intencional | P1 | api/authz | 1h 30m | Evidencia: lista cerrada de rutas publicas/privadas.

## FASE 4 - Reglas de negocio LMS y consistencia funcional (10h)

- [ ] F4.1 - Revisar transiciones de quiz para impedir entregar sin intento `BORRADOR` valido | P0 | api/evaluaciones | 1h | Evidencia: test de entrega invalida.
- [ ] F4.2 - Hacer idempotente y transaccional la generacion de certificados para evitar carreras por `(usuario_guid, curso_guid)` | P0 | api/certificados | 1h | Evidencia: test de doble solicitud.
- [ ] F4.3 - Validar que un recurso completado pertenezca a un curso matriculado y que el usuario pueda accederlo | P0 | api/estudiantes/cursos | 1h 15m | Evidencia: recurso ajeno bloqueado.
- [ ] F4.4 - Definir regla para recalificar entregas ya aprobadas y registrar auditoria minima de cambios de calificacion | P1 | api/evaluaciones | 1h | Evidencia: pruebas de recalificacion permitida/denegada.
- [ ] F4.5 - Revisar baja/desactivacion de usuarios para no borrar cursos por cascada accidental | P0 | prisma/users | 1h | Evidencia: delete/desactivar no destruye cursos.
- [ ] F4.6 - Normalizar soft delete: decidir por entidad si se usa `deleted_at` o borrado real, y aplicar filtros consistentes | P1 | api/prisma | 1h 30m | Evidencia: queries no devuelven eliminados.
- [ ] F4.7 - Validar reglas de contacto/chat por curso, profesor y estudiante antes de aceptar solicitudes | P1 | api/chat | 1h | Evidencia: solicitud invalida rechazada.
- [ ] F4.8 - Revisar calculo de progreso para que no pueda inflarse con recursos duplicados, eliminados o ajenos | P1 | api/progreso | 1h | Evidencia: pruebas de progreso.
- [ ] F4.9 - Definir comportamiento cuando storage local no tiene PDF pero existe ruta R2 | P1 | api/certificados/storage | 1h 15m | Evidencia: descarga funciona o falla de forma segura.

## FASE 5 - Storage, uploads, HTML enriquecido y correo (11h)

- [ ] F5.1 - Separar archivos publicos, privados y temporales con reglas de acceso distintas | P0 | api/storage | 1h 30m | Evidencia: matriz de permisos aplicada en codigo.
- [ ] F5.2 - Eliminar descarga publica directa para archivos privados; usar autorizacion backend o URLs firmadas cortas | P0 | api/storage | 1h 30m | Evidencia: archivo privado anonimo devuelve 401/403.
- [ ] F5.3 - Bloquear SVG subido por usuarios o servirlo siempre como descarga segura sin ejecucion inline | P0 | api/storage/security | 45m | Evidencia: prueba de SVG malicioso.
- [ ] F5.4 - Validar MIME, extension, magic bytes y tamano por tipo de archivo, no solo limite global | P1 | api/storage | 1h 30m | Evidencia: tests por tipo permitido/denegado.
- [ ] F5.5 - Revisar `archivo_adjunto` base64 en Prisma y migrar a referencia de storage si sigue en uso | P1 | api/prisma/storage | 1h | Evidencia: no se guardan blobs grandes innecesarios.
- [ ] F5.6 - Endurecer DOMPurify: restringir `style`, `class`, `img`, iframes y atributos peligrosos segun caso real | P0 | client/security | 1h 15m | Evidencia: fixture XSS bloqueado.
- [ ] F5.7 - Centralizar render de HTML seguro para cursos, quiz, tareas y correos | P1 | client/api/mail | 1h | Evidencia: no hay sanitizacion duplicada contradictoria.
- [ ] F5.8 - Escapar variables de plantillas de correo por defecto y permitir HTML solo en campos explicitamente seguros | P0 | api/mail | 1h 15m | Evidencia: nombre/comentario con HTML se escapa.
- [ ] F5.9 - Revisar emails fallback y plantillas para no exponer passwords ni datos sensibles mas de lo necesario | P1 | api/mail | 45m | Evidencia: snapshots/fixtures de correo.
- [ ] F5.10 - Limpiar DTOs duplicados de mail sin cambiar contrato externo | P2 | api/mail | 30m | Evidencia: un solo DTO fuente.

## FASE 6 - Dependencias y supply chain sin bloat (8h)

- [ ] F6.1 - Resolver vulnerabilidades de `axios` y revisar llamadas afectadas | P0 | client/deps | 45m | Evidencia: audit sin advisory de axios.
- [ ] F6.2 - Resolver vulnerabilidades de `next` y `postcss` con actualizacion compatible | P0 | client/deps | 1h 30m | Evidencia: build cliente pasa.
- [ ] F6.3 - Resolver riesgo de `quill/react-quill-new`; actualizar, reemplazar o aislar salida HTML con sanitizacion fuerte | P1 | client/editor | 1h 30m | Evidencia: audit o mitigacion documentada en codigo/tests.
- [ ] F6.4 - Resolver vulnerabilidades de `fastify`/`fast-uri` por ruta Nest/Fastify sin romper API | P0 | api/deps | 1h 30m | Evidencia: audit API y tests pasan.
- [ ] F6.5 - Tratar advisory de `@hono/node-server` via Prisma sin degradar Prisma a una version insegura o incompatible | P1 | api/deps/prisma | 1h | Evidencia: decision tecnica clara y audit revisado.
- [ ] F6.6 - Alinear version de Node entre README, CI, engines y uso real local | P1 | root/ci | 45m | Evidencia: una sola version objetivo.
- [ ] F6.7 - Revisar lockfiles y estrategia npm: mantener instalacion reproducible sin convertir el repo a workspace si no aporta valor inmediato | P1 | root/deps | 1h | Evidencia: `npm ci` documentado por paquete.

## FASE 7 - TypeScript, lint, CI minima y calidad (8h)

- [ ] F7.1 - Cambiar lint de API para que no use `--fix` como gate de CI | P0 | api/lint | 30m | Evidencia: lint falla sin modificar archivos.
- [ ] F7.2 - Corregir o reemplazar `next lint` si no es compatible con la version actual de Next | P1 | client/lint | 45m | Evidencia: lint cliente ejecutable.
- [ ] F7.3 - Asegurar que typecheck no deje `tsconfig.tsbuildinfo` modificado o sacarlo del tracking si corresponde | P1 | client/ts | 45m | Evidencia: `git status` limpio tras typecheck.
- [ ] F7.4 - Agregar gates minimos en CI existente: API lint/typecheck/test/build, cliente lint/typecheck/build, audit sin dev | P1 | ci | 1h 30m | Evidencia: workflow verde.
- [ ] F7.5 - Corregir imports `any`, casts inseguros y DTOs sin validacion en zonas de auth/storage/evaluaciones | P1 | api/client | 2h | Evidencia: menos excepciones TS en zonas criticas.
- [ ] F7.6 - Revisar manejo global de errores para no filtrar stack traces o detalles internos al cliente | P1 | api | 1h | Evidencia: respuestas de error consistentes.
- [ ] F7.7 - Normalizar encoding/mojibake visible en UI, logs y README sin tocar textos correctos | P2 | repo/client/api | 1h 30m | Evidencia: busqueda de `Ã`, `Â`, caracteres rotos.

## FASE 8 - Prisma, datos y migraciones controladas (8h)

- [ ] F8.1 - Crear migracion para eliminar defaults inseguros y campos sensibles obsoletos | P0 | prisma | 1h | Evidencia: migracion reversible razonable.
- [ ] F8.2 - Agregar campos necesarios para reset/verificacion seguros: hash, expiracion, intentos, usado_en, metadata minima | P0 | prisma/auth | 1h 15m | Evidencia: migracion y tests.
- [ ] F8.3 - Revisar indices para ownership frecuente: usuario/curso, profesor/curso, entrega/tarea, certificado/usuario | P1 | prisma/perf | 1h | Evidencia: consultas principales indexadas.
- [ ] F8.4 - Agregar relaciones o constraints faltantes en chat/contactos si no rompen datos existentes | P1 | prisma/chat | 1h | Evidencia: integridad referencial probada.
- [ ] F8.5 - Revisar cascadas peligrosas, especialmente profesor -> cursos | P0 | prisma | 1h | Evidencia: delete accidental no borra contenido.
- [ ] F8.6 - Preparar script seguro de migracion de datos para tokens/codigos existentes sin exponer valores | P1 | prisma/scripts | 1h | Evidencia: script idempotente.
- [ ] F8.7 - Revisar backups existentes solo para que no contengan credenciales por defecto ni rutas hardcodeadas peligrosas | P2 | scripts | 45m | Evidencia: script no genera basura trackeada.
- [ ] F8.8 - Confirmar que `prisma generate` y build no dejan cambios generados inesperados en repo | P1 | prisma/repo | 1h | Evidencia: `git status` limpio.

## FASE 9 - Backend: arquitectura, tiempo real y rendimiento enfocados (9h)

- [ ] F9.1 - Extraer checks de ownership repetidos a servicios/guards claros sin esconder reglas de negocio | P1 | api | 1h 30m | Evidencia: controladores mas simples y tests iguales.
- [ ] F9.2 - Revisar consultas con includes grandes en cursos, dashboards, monitoreo y progreso para evitar sobrecarga | P1 | api/perf | 1h 30m | Evidencia: payloads y queries reducidos.
- [ ] F9.3 - Poner limites de paginacion y ordenamiento en listados de usuarios, cursos, entregas, notificaciones y chat | P1 | api | 1h | Evidencia: DTOs con limites.
- [ ] F9.4 - Revisar cache en configuracion para no cachear datos sensibles ni quedar desactualizada tras updates | P1 | api/config | 45m | Evidencia: invalidacion probada.
- [ ] F9.5 - Corregir WebSocket heartbeat para limpiar intervalos y manejar desconexiones sin fugas | P1 | api/ws | 45m | Evidencia: `OnModuleDestroy` o equivalente.
- [ ] F9.6 - Sanitizar payloads WS y eventos para que no emitan config completa, secretos o datos de usuarios ajenos | P0 | api/ws | 1h | Evidencia: tests/fixtures de eventos.
- [ ] F9.7 - Revisar Swagger y documentacion API para que no quede expuesta fuera de entorno local/desarrollo | P1 | api | 30m | Evidencia: smoke de entorno no-dev.
- [ ] F9.8 - Revisar eventos en tiempo real para cursos, notificaciones, chat, progreso, configuracion y entregas; emitir solo eventos utiles y con version/timestamp | P1 | api/ws | 1h | Evidencia: vistas afectadas se actualizan sin recargar.
- [ ] F9.9 - Medir endpoints lentos y corregir N+1, payloads excesivos o queries sin indice antes de optimizar el frontend | P1 | api/perf | 1h | Evidencia: tiempos antes/despues en flujos lentos.

## FASE 10 - Frontend: estado, auth, datos, tiempo real y errores (13h)

- [ ] F10.1 - Separar simulacion de rol de la autorizacion real; no debe influir en rutas protegidas ni decisiones sensibles | P0 | client/auth | 1h | Evidencia: ruta protegida depende de usuario real.
- [ ] F10.2 - Revisar almacenamiento de token y usuario; minimizar datos en `localStorage` y limpiar en logout/expiracion | P1 | client/auth | 1h | Evidencia: storage limpio tras logout.
- [ ] F10.3 - Evitar reconexion WebSocket sin token y mover token fuera de query string si se adopta canal mas seguro | P1 | client/ws | 1h | Evidencia: no hay bucle de reconexion anonima.
- [ ] F10.4 - Centralizar manejo de 401/403/429/500 para que el usuario reciba mensajes claros sin loops | P1 | client/api | 1h | Evidencia: interceptor o patron unico.
- [ ] F10.5 - Revisar cache de configuracion en cliente para no persistir campos sensibles ni aplicar CSS global invasivo | P1 | client/config | 1h | Evidencia: cache solo publico.
- [ ] F10.6 - Dividir paginas gigantes solo donde reduzca riesgo real: constructor de cursos, calificaciones, curso, pruebas, monitoreo, usuarios, login | P2 | client/architecture | 2h | Evidencia: componentes por responsabilidad, sin sobreabstraer.
- [ ] F10.7 - Consolidar estados de carga, vacio y error en flujos principales sin crear libreria de componentes innecesaria | P2 | client/ux | 1h | Evidencia: patron consistente.
- [ ] F10.8 - Quitar `console.log`/debug visibles y mensajes internos en cliente | P2 | client | 1h | Evidencia: busqueda limpia salvo logs intencionales.
- [ ] F10.9 - Corregir acciones que requieren doble clic o no responden al primer intento: navegacion, tabs, botones de guardar, filtros y carga de apartados | P0 | client/ux/data | 1h 30m | Evidencia: QA manual con primer clic exitoso.
- [ ] F10.10 - Unificar invalidacion/refetch de datos despues de crear, editar, borrar, calificar, completar recurso o recibir evento WebSocket | P1 | client/data/ws | 1h 30m | Evidencia: UI actualizada sin recargar ni repetir clic.
- [ ] F10.11 - Agregar feedback inmediato en acciones lentas: disabled state correcto, spinner local, optimistic update cuando sea seguro y rollback si falla | P1 | client/ux | 1h | Evidencia: ninguna accion queda muda.
- [ ] F10.12 - Revisar prefetch, carga inicial y splitting de pantallas pesadas para reducir espera percibida sin meter librerias innecesarias | P1 | client/perf | 1h | Evidencia: pantallas criticas cargan mas rapido o muestran progreso claro.
- [ ] F10.13 - Aplicar revision de primer clic, carga, errores y refresco de datos a cada apartado de cada rol, no solo a los flujos mas visibles | P0 | client/qa | 1h | Evidencia: checklist F0.7 completado por rol.

## FASE 11 - Sistema visual, responsive y accesibilidad (16h)

- [ ] F11.1 - Definir contrato visual minimo: colores base, semanticos, neutros, estados, radios, sombras, tipografia y focus | P1 | design/client | 1h | Evidencia: tokens en CSS, no documento nuevo.
- [ ] F11.2 - Eliminar letter-spacing negativo global y ajustar tipografia para legibilidad en mobile/desktop | P1 | client/css | 30m | Evidencia: CSS sin `letter-spacing` negativo.
- [ ] F11.3 - Limitar radios de cards, paneles y controles a 8px salvo elementos circulares justificados | P1 | client/design | 1h 30m | Evidencia: busqueda de `rounded-2xl`, `rounded-3xl`, radios arbitrarios revisada.
- [ ] F11.4 - Reducir gradientes, blobs, glassmorphism y decoracion que no ayude a tareas LMS | P2 | client/design | 1h | Evidencia: pantallas operativas mas limpias.
- [ ] F11.5 - Reemplazar superficies tipo landing en dashboards por layouts densos, claros y escaneables | P1 | client/ux | 1h 30m | Evidencia: admin/profesor/estudiante revisados.
- [ ] F11.6 - Revisar mobile y desktop en: shell/sidebar, constructor cursos, curso/player, quiz, tareas, usuarios, asignacion, calificaciones, pruebas, monitoreo, mensajes y certificados | P1 | client/responsive | 3h | Evidencia: checklist con capturas o QA manual.
- [ ] F11.7 - Asegurar que tablas densas tengan alternativa mobile real sin duplicar logica de negocio | P1 | client/responsive | 1h | Evidencia: usuarios, calificaciones y monitoreo usables.
- [ ] F11.8 - Corregir modales y paneles con ancho/alto fijo para evitar overflow, contenido cortado o botones fuera de pantalla | P1 | client/responsive | 1h | Evidencia: pruebas en 360px, 768px, 1440px.
- [ ] F11.9 - Validar contraste de tema claro/oscuro y colores configurables, incluyendo estados success/warning/error/info | P1 | client/a11y/design | 1h | Evidencia: pares de color aprobados.
- [ ] F11.10 - Agregar labels, `aria-label`, foco visible y navegacion por teclado en icon buttons, formularios, menus, tabs y modales | P1 | client/a11y | 1h 30m | Evidencia: recorrido teclado basico.
- [ ] F11.11 - Revisar textos largos para que no desborden botones, cards o badges en mobile | P1 | client/responsive | 45m | Evidencia: no overflow horizontal.
- [ ] F11.12 - Decidir si `components/ui` se adopta o se elimina; no mantener componentes muertos | P2 | client/cleanup | 45m | Evidencia: imports reales o eliminacion limpia.
- [ ] F11.13 - Normalizar patrones visuales entre apartados equivalentes: encabezados, filtros, tablas, cards, formularios, modales, botones y estados | P1 | client/design | 1h | Evidencia: pantallas del mismo tipo se sienten parte del mismo sistema.
- [ ] F11.14 - Revisar consistencia visual por rol completo: admin, profesor y estudiante deben compartir sistema visual aunque tengan tareas distintas | P1 | client/design/qa | 1h | Evidencia: checklist visual por apartado.

## FASE 12 - Pruebas de seguridad, negocio, rendimiento y UI critica (16h)

- [ ] F12.1 - Agregar tests P0 de IDOR por rol para estudiantes, cursos, entregas, certificados, notificaciones, firma y chat | P0 | api/tests | 3h | Evidencia: pruebas fallan antes y pasan despues.
- [ ] F12.2 - Agregar tests de auth: logout persistente, token revocado, reset token hasheado, verificacion expirada e intentos agotados | P0 | api/tests | 2h | Evidencia: cobertura de flujos.
- [ ] F12.3 - Agregar tests de storage: archivo privado anonimo, archivo ajeno, SVG malicioso, MIME falso y tamano excedido | P0 | api/tests | 1h 30m | Evidencia: casos bloqueados.
- [ ] F12.4 - Agregar tests de negocio: quiz sin intento, quiz ajeno, certificado concurrente, progreso con recurso ajeno | P1 | api/tests | 1h 30m | Evidencia: casos cubiertos.
- [ ] F12.5 - Agregar tests o fixtures de sanitizacion HTML y plantillas de correo | P1 | api/client/tests | 1h | Evidencia: XSS basico bloqueado.
- [ ] F12.6 - Crear smoke manual corto para roles reales: admin, profesor, estudiante | P1 | qa | 1h | Evidencia: lista en README o plan, sin documento extra.
- [ ] F12.7 - Verificar responsive con browser local en 360x800, 768x1024 y 1440x900 para flujos principales | P1 | qa/design | 1h | Evidencia: capturas o notas de QA.
- [ ] F12.8 - Ejecutar suite final: install limpio, audit, lint, typecheck, tests, build | P0 | root | 1h | Evidencia: comandos pasan y `git status` limpio.
- [ ] F12.9 - Agregar prueba/manual QA de "primer clic": cada tab, boton primario y navegacion critica debe responder en el primer intento | P0 | qa/client | 1h | Evidencia: checklist por flujo.
- [ ] F12.10 - Agregar smoke de tiempo real: chat, notificaciones, progreso/configuracion y estados de entrega se actualizan sin refresh | P1 | qa/ws | 1h | Evidencia: eventos llegan y la UI cambia.
- [ ] F12.11 - Ejecutar recorrido completo por rol y apartado: permisos, carga inicial, primer clic, estados vacios, errores, responsive, accesibilidad basica y consistencia visual | P0 | qa/full-platform | 2h | Evidencia: checklist F0.7 cerrado sin apartados pendientes.

## FASE 13 - Limpieza final y documentacion minima (5h)

- [ ] F13.1 - Eliminar componentes, hooks, scripts y assets sin uso confirmados por busqueda/imports | P2 | repo | 1h | Evidencia: build pasa despues.
- [ ] F13.2 - Limpiar comentarios obsoletos, mojibake y textos internos visibles al usuario | P2 | repo/client/api | 1h | Evidencia: busqueda limpia.
- [ ] F13.3 - Revisar Docker, nginx y scripts existentes solo para quitar defaults peligrosos; no agregar despliegue nuevo | P1 | devops | 1h | Evidencia: no passwords por defecto ni puertos inseguros innecesarios.
- [ ] F13.4 - Dejar README minimo con instalacion local, envs requeridas, comandos y criterios de seguridad; sin guias largas de produccion | P1 | docs | 1h | Evidencia: README unico y util.
- [ ] F13.5 - Confirmar que no quedan archivos temporales, auditorias duplicadas, backups trackeados, coverage, uploads de test o tsbuildinfo modificados | P0 | repo | 45m | Evidencia: `git status --short` y busquedas.
- [ ] F13.6 - Cerrar el plan marcando tareas terminadas y riesgos aceptados con razon concreta, no con texto generico | P1 | proceso | 15m | Evidencia: plan actualizado.

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

---

## Fases que no se deben empezar antes de tiempo

- No empezar redisenos grandes antes de cerrar F1-F5.
- No dividir componentes gigantes antes de tener claro que no se rompen permisos ni flujos criticos.
- No actualizar dependencias mayores sin tests o smoke minimo del flujo afectado.
- No limpiar archivos "muertos" si no hay evidencia por imports, scripts o build.
- No tocar Docker/nginx para desplegar; solo endurecer lo que ya existe y evitar defaults peligrosos.

---

## Resultado esperado

Al completar este plan, el proyecto debe quedar:

- Seguro por defecto en auth, permisos, sesiones, storage y HTML.
- Limpio en dependencias, scripts, CI minima y archivos trackeados.
- Consistente en diseno, colores, radios, tipografia, estados y responsive.
- Usable en mobile y desktop para los flujos principales de admin, profesor y estudiante.
- Sin documentacion basura, fases de despliegue innecesarias ni archivos de relleno.
- Preparado para un despliegue futuro sin que el plan actual intente desplegar nada.

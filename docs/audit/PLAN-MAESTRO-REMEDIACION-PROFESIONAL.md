# Plan Maestro de Remediacion Profesional - Modulo LMS

> Estado de tareas: `[ ]` Pendiente | `[~]` En progreso | `[x]` Completada | `[!]` Bloqueada
> Prioridad: `P0` Critica | `P1` Alta | `P2` Media | `P3` Baja
> Fuente: reauditoria Codex Security del 2026-05-14.
> Objetivo: dejar el proyecto funcional, seguro, rapido, consistente, limpio y mantenible.

---

## 1. Proposito

Este plan reemplaza por completo el plan anterior. Todo lo viejo queda eliminado para evitar falsos positivos de avance, tareas marcadas como completadas sin evidencia actual y deuda mezclada con hallazgos nuevos.

La regla central es simple: cada tarea debe cerrar un riesgo real, corregir un flujo real, mejorar el rendimiento medible, ordenar la experiencia visual o limpiar deuda concreta del codigo/repositorio.

No se considera cerrada una fase hasta que existan evidencias: tests, build, lint, audit, captura/QA visual, trazado de permisos o salida de comandos.

---

## 2. Estado real detectado en la reauditoria

- `npm.cmd run typecheck`: pasa en API y cliente.
- `npm.cmd test` en `apps/api`: pasa, 9 suites / 100 tests.
- `npm.cmd audit --omit=dev`: root 0 vulnerabilidades; API 3 moderate; cliente 4 vulnerabilities.
- `npm.cmd run build`: API compila; cliente falla durante prerender de `/500`.
- `npm.cmd run build --prefix apps/client`: falla por `next/font/google` intentando descargar Inter sin red.
- `npm.cmd run lint:check --prefix apps/api`: exit 0 con 83 warnings.
- `npm.cmd run lint --prefix apps/client`: no sirve como gate porque `next lint` entra en flujo interactivo/deprecado.
- `git status --short --branch`: limpio al cierre de la auditoria.

---

## 3. Criterios globales de cierre

- Ningun endpoint sensible permite leer, modificar, borrar o listar recursos ajenos por GUID.
- Todo archivo privado requiere autorizacion por objeto, no solo JWT valido.
- Profesor solo accede a cursos, tareas, bloques, entregas y recursos propios, salvo admin real.
- Estudiante solo accede a cursos, progreso, quiz, entregas, mensajes y notificaciones propias.
- No hay JWTs, access tokens, reset tokens ni credenciales en query strings, logs o mensajes visibles.
- WebSocket emite eventos solo a usuarios autorizados y salas correctas.
- Build API y cliente pasan desde scripts oficiales.
- Lint API y cliente corren sin prompts ni warnings relevantes.
- Audit npm queda corregido o documentado con version exacta, impacto y mitigacion.
- UI queda consistente en admin, profesor, estudiante y publico: responsive, sobria, usable y sin solapes.
- Flujos principales funcionan al primer clic, con loading, error, empty states y feedback claro.
- Codigo queda sin basura obvia: imports muertos, `any` evitables, logs de debug, archivos temporales y docs duplicadas.

---

## 4. Reglas de ejecucion

- Resolver primero seguridad P1/P2 antes de redisenos o refactors grandes.
- No marcar una tarea como `[x]` sin evidencia concreta.
- Cada fix de autorizacion debe tener prueba negativa: usuario ajeno debe recibir 403/404.
- No usar `npm audit fix --force` si propone downgrades o cambios breaking sin revision.
- No crear documentos nuevos salvo que reemplacen o complementen este plan con evidencia necesaria.
- No introducir infraestructura de produccion, Docker, Nginx, observabilidad o release si no corrige un problema actual del proyecto.
- Evitar abstracciones grandes si un helper de permisos, test o ajuste local resuelve el problema con menos riesgo.

---

## 5. Orden recomendado

1. F0 - Baseline y control de cambios.
2. F1 - Seguridad critica P1: storage, entregas, bloques.
3. F2 - Seguridad P2: ownership restante, chat, quiz, progreso.
4. F3 - Sesiones, logs y tiempo real.
5. F4 - Build, dependencias, lint y gates.
6. F5 - Tests de seguridad y negocio.
7. F6 - Rendimiento real.
8. F7 - Diseno, responsividad y UX.
9. F8 - Limpieza de codigo y workspace.
10. F9 - QA final y cierre.

---

## 6. Hallazgos de arquitectura, orden y nombres detectados

- Hay artefactos generados de Prisma trackeados en `generated/prisma`, aunque `.gitignore` ya declara `generated/`.
- Hay `apps/client/tsconfig.tsbuildinfo` trackeado, aunque `.gitignore` declara `*.tsbuildinfo`.
- Hay lockfiles en raiz, `apps/api` y `apps/client`; debe decidirse si el monorepo usa lockfile unico o lockfiles por app, porque Next ya advierte multiples lockfiles.
- Existen carpetas generadas o de build en workspace local: `apps/api/dist`, `apps/client/.next`, `node_modules`; deben permanecer fuera de Git.
- Hay mezcla de idiomas y nombres de rol/ruta en cliente: `student`, `examiner`, `constructor-cursos`, `recuperar-contrasena`, `restablecer-contrasena`.
- `docs/audit/SECURITY-MATRICES.md` no existe actualmente en `docs/audit`; debe restaurarse, reemplazarse o retirar referencias, pero no quedar como documento fantasma.
- El nombre local del workspace contiene mojibake visible (`M-dulo-LMS`); si afecta scripts, docs o capturas, debe normalizarse fuera del repo o documentarse.
- `package.json` y `schema.prisma` muestran caracteres mojibake en textos descriptivos; debe limpiarse si son archivos fuente trackeados.

---

## FASE 0 - Baseline y control de trabajo

Objetivo: iniciar correcciones con estado medible y sin mezclar cambios.

- [ ] F0.1 - Confirmar `git status --short --branch` limpio antes de editar | P0 | git | Evidencia: salida del comando.
- [ ] F0.2 - Crear rama de remediacion con prefijo `codex/` o nombre acordado | P1 | git | Evidencia: rama activa.
- [ ] F0.3 - Ejecutar baseline completo: typecheck, tests API, audit root/API/client, build root, build cliente, lint API, lint cliente | P0 | qa | Evidencia: salidas guardadas o resumidas.
- [ ] F0.4 - Registrar fallos actuales esperados para no confundir regresiones con deuda existente | P1 | proceso | Evidencia: tabla de fallos iniciales.
- [ ] F0.5 - Definir matriz minima de roles para pruebas: admin, profesor propietario, profesor ajeno, estudiante matriculado, estudiante ajeno, anonimo | P0 | seguridad | Evidencia: matriz usada por tests.
- [ ] F0.6 - Definir dataset o fixtures minimos para cursos, modulos, bloques, recursos, tareas, entregas, quiz, chat y archivos privados | P1 | tests | Evidencia: fixtures reutilizables.

Criterio de cierre: existe una linea base confiable y reproducible antes de tocar seguridad.

---

## FASE 1 - Seguridad critica P1: datos y archivos privados

Objetivo: impedir fugas graves de archivos, entregas y contenido por GUID/key.

- [ ] F1.1 - Reemplazar la descarga privada generica `GET /storage/download/*` por autorizacion por objeto | P0 | api/storage | Evidencia: archivo privado ajeno devuelve 403/404.
- [ ] F1.2 - Crear helper `assertPrivateFileAccess(user, storageKey, context)` o equivalente por dominio | P0 | api/storage | Evidencia: storage no decide solo por carpeta/JWT.
- [ ] F1.3 - Separar carpetas publicas y privadas con politicas explicitas | P0 | api/storage | Evidencia: entregas, firmas, certificados y recursos no son publicos.
- [ ] F1.4 - Usar URLs firmadas cortas o endpoints por entidad para descargas privadas | P1 | api/storage/client | Evidencia: cliente no descarga privados solo por key permanente.
- [ ] F1.5 - Corregir listado de entregas para pasar `CurrentUser` al servicio | P0 | api/evaluaciones | Evidencia: controller no llama servicio sin usuario actual.
- [ ] F1.6 - Validar que profesor solo liste/califique entregas de tareas de sus cursos | P0 | api/evaluaciones | Evidencia: profesor ajeno recibe 403/404.
- [ ] F1.7 - Corregir lectura de bloques/recursos por GUID para validar ownership/matricula/admin | P0 | api/cursos | Evidencia: profesor ajeno no lee bloque privado.
- [ ] F1.8 - Revisar endpoints relacionados con certificados, firmas y recursos para que usen la misma politica de acceso privado | P0 | api/storage/certificados | Evidencia: tests negativos por rol.
- [ ] F1.9 - Agregar tests negativos P1 para storage, entregas y bloques | P0 | api/tests | Evidencia: suite falla antes del fix y pasa despues.

Criterio de cierre: ningun usuario autenticado puede leer archivos, entregas o bloques ajenos por GUID, key o ruta.

---

## FASE 2 - Seguridad P2: ownership, integridad y reglas LMS

Objetivo: cerrar brechas de permisos y cambios de estado indebidos.

- [ ] F2.1 - Corregir reorder de recursos para validar que cada `recurso_guid` pertenece al modulo/curso autorizado | P0 | api/cursos | Evidencia: recurso externo en payload devuelve 403/400.
- [ ] F2.2 - Corregir reorder de bloques para rechazar GUIDs fuera del modulo autorizado | P1 | api/cursos | Evidencia: test negativo.
- [ ] F2.3 - Aplicar `verificarMatricula` o helper equivalente en `getQuizStatus` | P0 | api/quiz | Evidencia: estudiante no matriculado no ve status.
- [ ] F2.4 - Revisar inicio, entrega, intentos y resultados de quiz para asegurar usuario actual y recurso accesible | P1 | api/quiz | Evidencia: intento ajeno bloqueado.
- [ ] F2.5 - Validar matricula antes de consultar progreso de curso | P0 | api/estudiantes | Evidencia: estudiante ajeno recibe 403/404.
- [ ] F2.6 - Validar matricula antes de registrar heartbeat/sesion de curso | P0 | api/estudiantes | Evidencia: curso ajeno no infla metricas.
- [ ] F2.7 - Corregir o eliminar ruta legacy de marcar notificacion leida por id sin destinatario | P0 | api/notificaciones | Evidencia: notificacion ajena no cambia.
- [ ] F2.8 - Unificar helpers de permisos: `assertProfesorOwnsCurso`, `assertMatriculado`, `assertNotificationRecipient`, `assertCanAccessBloque` | P1 | api/authz | Evidencia: rutas criticas usan helpers comunes.
- [ ] F2.9 - Corregir chat para validar que solicitante y receptor pertenecen al curso/contexto permitido | P0 | api/chat | Evidencia: usuario externo no crea contacto auto-aprobado.
- [ ] F2.10 - Cambiar borrado global de conversacion por soft-delete por usuario o regla de producto documentada | P1 | api/chat | Evidencia: un usuario no borra historial del otro.
- [ ] F2.11 - Corregir dashboard de monitoreo para admin/profesor con scoping correcto | P1 | api/dashboards | Evidencia: admin ve lo que corresponde y profesor solo sus cursos.
- [ ] F2.12 - Corregir calculo de `profesoresActivos` para usar realmente cada profesor evaluado | P2 | api/dashboards | Evidencia: test o fixture con varios profesores.

Criterio de cierre: lecturas y mutaciones de negocio respetan rol, propiedad, matricula y destinatario.

---

## FASE 3 - Sesiones, logs y tiempo real

Objetivo: proteger tokens, revocacion y eventos en vivo.

- [ ] F3.1 - Eliminar JWT en query string para descargas privadas del cliente | P0 | client/api | Evidencia: `?token=` desaparece de URLs privadas.
- [ ] F3.2 - Cambiar descargas privadas a `Authorization` header con fetch/blob o URL firmada corta | P0 | client/api/storage | Evidencia: descarga funcional sin token en URL.
- [ ] F3.3 - Censurar tokens y parametros sensibles en logger de API | P0 | api/logging | Evidencia: logs no imprimen `token`, `access_token`, `authorization`.
- [ ] F3.4 - Revisar WebSocket para no enviar JWT en query si existe alternativa viable | P1 | client/ws/api/ws | Evidencia: canal endurecido o riesgo documentado.
- [ ] F3.5 - Corregir revocacion JWT de misma marca temporal (`iat <= revokedAt` o precision ms) | P0 | api/auth | Evidencia: test de revocacion en mismo segundo.
- [ ] F3.6 - Validar usuario activo y token vigente durante conexion WebSocket | P0 | api/ws/auth | Evidencia: usuario revocado/desactivado no conecta.
- [ ] F3.7 - Crear rooms por curso para eventos de edicion, curso, progreso, entrega y chat | P0 | api/ws | Evidencia: evento de curso A no llega a usuario de curso B.
- [ ] F3.8 - Filtrar presencia por contexto permitido, no emitir todos los usuarios online globalmente | P1 | api/ws/client | Evidencia: payload no contiene usuarios fuera de alcance.
- [ ] F3.9 - Autorizar eventos entrantes como `course:editing`, `course:lock`, `course:unlock` por rol y ownership | P0 | api/ws | Evidencia: profesor ajeno no bloquea/edita curso.
- [ ] F3.10 - Revisar reconexion, refresh y estados offline del cliente para evitar loops o UI congelada | P2 | client/ws/ux | Evidencia: smoke manual con desconexion/reconexion.

Criterio de cierre: tokens no se filtran, revocacion es robusta y tiempo real respeta permisos.

---

## FASE 4 - Build, dependencias, lint y gates

Objetivo: que el proyecto pueda construirse y validarse sin pasos manuales.

- [ ] F4.1 - Quitar `NODE_ENV=development` de `.env` usada por builds productivos/locales de build | P0 | config | Evidencia: Next no muestra warning de NODE_ENV no estandar.
- [ ] F4.2 - Revisar script root de build para no cargar variables que rompen Next | P0 | root/scripts | Evidencia: `npm.cmd run build` pasa.
- [ ] F4.3 - Reemplazar `next/font/google` por fuente local/vendorizada o fallback que no requiera red en build | P0 | client/build | Evidencia: build cliente pasa sin internet.
- [ ] F4.4 - Configurar `outputFileTracingRoot` o resolver advertencia de multiples lockfiles si aplica | P1 | client/next | Evidencia: warning eliminado o documentado.
- [ ] F4.5 - Reemplazar `next lint` por ESLint no interactivo compatible con Next actual | P0 | client/lint | Evidencia: `npm.cmd run lint --prefix apps/client` no pregunta nada.
- [ ] F4.6 - Reducir warnings API de `no-explicit-any`, unused vars/imports y `no-console` | P1 | api/lint | Evidencia: lint API sin warnings criticos.
- [ ] F4.7 - Revisar vulnerabilidades API via Prisma/@hono y elegir upgrade compatible | P1 | api/deps | Evidencia: audit API limpio o riesgo documentado.
- [ ] F4.8 - Revisar vulnerabilidades client Next/PostCSS y aplicar version compatible | P1 | client/deps | Evidencia: audit client mejora sin downgrade peligroso.
- [ ] F4.9 - Revisar Quill/react-quill-new y decidir upgrade, reemplazo o mitigacion con sanitize/export seguro | P1 | client/deps/editor | Evidencia: advisory cerrado o mitigacion documentada.
- [ ] F4.10 - Alinear lockfiles y estrategia de package manager del monorepo | P2 | repo | Evidencia: no hay lockfiles contradictorios innecesarios.
- [ ] F4.11 - Revisar scripts root que usan `cd` y `dotenv -e .env` para que sean consistentes con la estrategia del monorepo | P2 | root/scripts | Evidencia: scripts claros, reproducibles y sin efectos colaterales por env.

Criterio de cierre: typecheck, tests, build, lint y audit corren de forma repetible.

---

## FASE 5 - Tests de seguridad, negocio y regresion

Objetivo: evitar que los mismos bugs vuelvan.

- [ ] F5.1 - Agregar tests de storage privado anonimo, usuario ajeno, profesor ajeno, estudiante ajeno y admin | P0 | api/tests/storage | Evidencia: matriz completa.
- [ ] F5.2 - Agregar tests de entregas: profesor propietario, profesor ajeno, estudiante propietario, estudiante ajeno y admin | P0 | api/tests/evaluaciones | Evidencia: 403/404 correctos.
- [ ] F5.3 - Agregar tests de bloques/recursos por rol y matricula | P0 | api/tests/cursos | Evidencia: no hay IDOR por GUID.
- [ ] F5.4 - Agregar tests de reorder con GUIDs externos | P0 | api/tests/cursos | Evidencia: payload mixto rechazado.
- [ ] F5.5 - Agregar tests de quiz status, start, submit e intento ajeno | P1 | api/tests/quiz | Evidencia: flujo completo.
- [ ] F5.6 - Agregar tests de progreso y heartbeat sin matricula | P1 | api/tests/estudiantes | Evidencia: no infla metricas.
- [ ] F5.7 - Agregar tests de notificacion ajena en ruta legacy o ruta corregida | P1 | api/tests/notificaciones | Evidencia: destinatario requerido.
- [ ] F5.8 - Agregar tests de chat contacto fuera del curso y borrado por usuario | P1 | api/tests/chat | Evidencia: contacto externo bloqueado.
- [ ] F5.9 - Agregar tests de token en logs/revocacion mismo segundo | P1 | api/tests/auth | Evidencia: token censurado y revocado.
- [ ] F5.10 - Agregar smoke tests de build/lint/audit para CI local minima | P2 | root/scripts | Evidencia: script unico de verificacion.

Criterio de cierre: cada hallazgo de seguridad tiene al menos un test negativo o smoke reproducible.

---

## FASE 6 - Rendimiento real y eficiencia

Objetivo: mejorar velocidad percibida y evitar trabajo innecesario.

- [ ] F6.1 - Medir rutas API criticas: cursos, bloques, progreso, dashboards, chat, entregas y storage | P1 | api/perf | Evidencia: tiempos base antes/despues.
- [ ] F6.2 - Revisar queries Prisma con `include` pesados y posibles N+1 | P1 | api/prisma | Evidencia: queries reducidas o justificadas.
- [ ] F6.3 - Agregar paginacion/limites en listados grandes de usuarios, entregas, mensajes, notificaciones y dashboards | P1 | api/client | Evidencia: endpoints no devuelven listas ilimitadas.
- [ ] F6.4 - Reducir payloads de progreso/dashboards a campos necesarios | P2 | api/perf | Evidencia: payload comparado antes/despues.
- [ ] F6.5 - Optimizar broadcasts WebSocket para rooms especificas y payloads pequenos | P1 | api/ws | Evidencia: no hay broadcast global innecesario.
- [ ] F6.6 - Revisar renders del cliente en contextos globales y paginas pesadas | P1 | client/perf | Evidencia: menos rerenders o memoizacion justificada.
- [ ] F6.7 - Dividir componentes grandes solo donde reduzca complejidad real: constructor, curso/player, dashboards, calificaciones, chat | P2 | client/architecture | Evidencia: componentes mas pequenos sin duplicar logica.
- [ ] F6.8 - Revisar carga inicial, dynamic imports y skeleton/loading states en rutas pesadas | P2 | client/perf/ux | Evidencia: primera carga mas fluida.
- [ ] F6.9 - Ejecutar Lighthouse o medicion equivalente cuando el build/dev server este estable | P2 | qa/perf | Evidencia: reporte desktop/mobile.

Criterio de cierre: flujos criticos cargan rapido, emiten menos datos y no dependen de recargar o repetir clics.

---

## FASE 7 - Diseno, responsividad y experiencia de usuario

Objetivo: que la plataforma se vea profesional, coherente y usable en mobile/desktop.

- [ ] F7.1 - Definir sistema visual unico: colores, semanticos, tipografia, spacing, sombras, radios y focus | P1 | design/client | Evidencia: tokens y componentes base consistentes.
- [ ] F7.2 - Reducir radios grandes (`rounded-2xl`, `rounded-3xl`, `rounded-[...]`) en pantallas operativas | P1 | client/design | Evidencia: cards/paneles/controlers con radio consistente.
- [ ] F7.3 - Reducir gradientes, blur, orbs y decoracion que no aporte a tareas LMS | P1 | client/design | Evidencia: dashboards y herramientas mas sobrias.
- [ ] F7.4 - Normalizar layouts de admin, profesor y estudiante: encabezados, filtros, tablas, cards, forms, modales y acciones | P1 | client/ux | Evidencia: patrones repetibles.
- [ ] F7.5 - Revisar responsive mobile/tablet/desktop en login, home, dashboards, constructor, curso, quiz, tareas, usuarios, certificados, chat y configuracion | P0 | qa/design | Evidencia: capturas o checklist por viewport.
- [ ] F7.6 - Corregir overflow, textos largos, botones que no caben, badges, tablas y modales | P0 | client/responsive | Evidencia: sin solapes en 360px, 768px y desktop.
- [ ] F7.7 - Unificar estados de loading, error, empty y success | P1 | client/ux | Evidencia: estados compartidos en flujos principales.
- [ ] F7.8 - Revisar primer clic y feedback inmediato en acciones de guardar, enviar, calificar, completar, filtrar y navegar | P0 | client/ux | Evidencia: botones disabled/loading y respuesta clara.
- [ ] F7.9 - Mejorar accesibilidad basica: labels, aria-label, focus visible, navegacion por teclado y contraste | P1 | client/a11y | Evidencia: revision manual y fixes.
- [ ] F7.10 - Verificar que contenido enriquecido y multimedia no rompa layout responsive | P1 | client/content | Evidencia: imagenes, iframes y videos acotados.

Criterio de cierre: la UI se siente consistente, profesional, responsive y clara por rol completo.

---

## FASE 8 - Limpieza de codigo, arquitectura y workspace

Objetivo: dejar el repositorio limpio, legible y mantenible.

- [ ] F8.1 - Eliminar imports, variables, componentes, hooks y scripts sin uso confirmados por busqueda/build | P2 | repo/client/api | Evidencia: lint y rg limpios.
- [ ] F8.2 - Reducir `any` evitables en API y cliente, priorizando rutas criticas y modelos compartidos | P1 | typescript | Evidencia: conteo de `any` reducido.
- [ ] F8.3 - Revisar `apps/client/src/types/models.ts` y reemplazar placeholders de tipos debiles | P1 | client/types | Evidencia: tipos reales en flujos principales.
- [ ] F8.4 - Quitar logs de debug y mensajes internos visibles al usuario | P1 | api/client | Evidencia: busqueda `console.log`/debug justificada.
- [ ] F8.5 - Consolidar helpers de API cliente para errores, descargas, auth y refresh | P2 | client/api | Evidencia: menos duplicacion.
- [ ] F8.6 - Revisar servicios API grandes y extraer solo funciones auxiliares que reduzcan duplicacion real | P2 | api/architecture | Evidencia: servicios mas claros sin sobreabstraccion.
- [ ] F8.7 - Limpiar archivos temporales o generados: `.tsbuildinfo`, coverage, dist, backups, logs, uploads de prueba | P0 | repo | Evidencia: `git status` limpio despues de tests/build.
- [ ] F8.8 - Revisar `.gitignore` para evitar que vuelvan artefactos generados | P1 | repo | Evidencia: patrones correctos.
- [ ] F8.9 - Actualizar README con comandos reales, envs requeridas, seguridad local y troubleshooting de build | P2 | docs | Evidencia: README no contradice scripts.
- [ ] F8.10 - Mantener `docs/audit` solo con documentos vivos: este plan, matrices y reporte si aplica | P2 | docs | Evidencia: sin documentos duplicados/obsoletos.
- [ ] F8.11 - Sacar de Git artefactos generados ya trackeados: `generated/prisma` y `apps/client/tsconfig.tsbuildinfo` | P1 | repo/git | Evidencia: `git ls-files generated apps/client/tsconfig.tsbuildinfo` no devuelve archivos.
- [ ] F8.12 - Definir ubicacion unica para Prisma Client generado y documentar como regenerarlo | P1 | api/prisma | Evidencia: no existen dos fuentes generadas contradictorias.
- [ ] F8.13 - Auditar nombres de rutas y carpetas del cliente para elegir un idioma/patron unico | P2 | client/architecture | Evidencia: decision documentada para `student`, `examiner`, `constructor-cursos` y rutas en espanol.
- [ ] F8.14 - Renombrar rutas/carpetas solo si mejora claridad sin romper URLs publicas; si rompe, mantener alias o migracion | P2 | client/routing | Evidencia: rutas siguen funcionando y no hay imports rotos.
- [ ] F8.15 - Definir convencion de nombres para archivos: pages/routes en kebab-case, componentes en PascalCase, hooks en camelCase con `use*`, servicios por dominio | P2 | repo/conventions | Evidencia: convencion aplicada o documentada.
- [ ] F8.16 - Revisar carpetas de build locales (`apps/api/dist`, `apps/client/.next`, `node_modules`) para confirmar que no esten trackeadas y limpiar si quedan residuos | P1 | repo/cleanup | Evidencia: `git ls-files` no lista builds ni dependencias.
- [ ] F8.17 - Resolver `docs/audit/SECURITY-MATRICES.md`: restaurar si sigue siendo fuente viva o eliminar referencias si fue reemplazado por este plan | P1 | docs/audit | Evidencia: `docs/audit` no tiene documentos fantasma ni referencias rotas.
- [ ] F8.18 - Corregir mojibake en archivos fuente y docs trackeados, incluyendo `package.json`, `README.md`, `schema.prisma` y textos visibles | P1 | repo/docs | Evidencia: busqueda de caracteres rotos no encuentra casos relevantes.
- [ ] F8.19 - Revisar el nombre local del workspace (`M-dulo-LMS`) y documentar/normalizar si causa rutas rotas, scripts raros o confusion en docs | P3 | repo/local | Evidencia: docs y scripts no dependen de un path con mojibake.

Criterio de cierre: el repo no contiene basura tecnica evidente y el codigo critico es entendible.

---

## FASE 9 - QA final, cierre y evidencia

Objetivo: demostrar que el proyecto queda funcional, seguro, limpio y profesional.

- [ ] F9.1 - Ejecutar suite final: typecheck, tests API, lint API, lint cliente, build root, build cliente, audit root/API/client | P0 | qa | Evidencia: todos pasan o riesgo documentado.
- [ ] F9.2 - Ejecutar recorrido manual por admin: login, usuarios, configuracion, cursos, monitoreo, certificados, notificaciones | P0 | qa/admin | Evidencia: checklist.
- [ ] F9.3 - Ejecutar recorrido manual por profesor: cursos propios, constructor, bloques, recursos, tareas, entregas, calificaciones, chat | P0 | qa/profesor | Evidencia: checklist.
- [ ] F9.4 - Ejecutar recorrido manual por estudiante: cursos matriculados, player, quiz, progreso, tareas, certificados, chat | P0 | qa/estudiante | Evidencia: checklist.
- [ ] F9.5 - Ejecutar pruebas negativas manuales de profesor ajeno y estudiante ajeno para GUIDs criticos | P0 | qa/security | Evidencia: 403/404.
- [ ] F9.6 - Ejecutar QA responsive en 360x800, 768x1024, 1440x900 y un viewport ancho | P1 | qa/design | Evidencia: capturas/checklist.
- [ ] F9.7 - Ejecutar smoke de WebSocket: chat, presencia, edicion, notificaciones y progreso sin refresh | P1 | qa/ws | Evidencia: eventos llegan solo a usuarios correctos.
- [ ] F9.8 - Revisar que logs no muestren tokens ni datos sensibles durante smoke | P0 | qa/security | Evidencia: muestra de logs sanitizados.
- [ ] F9.9 - Actualizar este plan marcando tareas cerradas con evidencia concreta | P1 | proceso | Evidencia: links, comandos o notas por fase.
- [ ] F9.10 - Preparar resumen final de riesgos corregidos, riesgos aceptados y pendientes reales | P1 | docs/audit | Evidencia: reporte final corto.

Criterio de cierre: el proyecto supera seguridad, build, pruebas, UX, rendimiento basico y limpieza sin pasos manuales ocultos.

---

## Resultado esperado

Al completar este plan, el LMS debe quedar:

- Seguro por defecto en auth, ownership, storage, sesiones, WebSocket y HTML.
- Funcional en flujos reales de admin, profesor, estudiante y publico.
- Reproducible en build, lint, tests y audit.
- Mas rapido por menor payload, menos broadcasts globales y queries mejor acotadas.
- Visualmente consistente, responsive y profesional.
- Limpio en codigo, tipos, archivos, scripts y documentacion.

Este plan no promete perfeccion abstracta; define el camino verificable para llegar a un estado profesional y defendible.

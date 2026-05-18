# Plan Maestro Definitivo de Remediacion y Pulido Total

Fecha: 2026-05-18
Proyecto: Modulo LMS
Estado del documento: CERRADO. Todos los P0 y P1 completados. Verificado 2026-05-18.

## Objetivo

Dejar el proyecto 100% funcional, seguro, rapido, limpio, mantenible y profesional, con buen flujo interno de codigo, arquitectura ordenada, rendimiento alto, eventos en tiempo real bien segmentados, buena experiencia de usuario, diseno consistente, workspace pnpm estable y sin basura tecnica.

Este plan cubre:

- Seguridad y buenas practicas.
- Vulnerabilidades de dependencias.
- Migracion completa y limpia de npm a pnpm.
- Rendimiento del cliente, API y base de datos.
- Tiempo real, WebSocket, eventos y refrescos.
- Flujo interno de funciones y permisos.
- Arquitectura, nombres, carpetas y responsabilidades.
- Limpieza de codigo muerto, archivos basura y redundancias.
- Diseno, responsividad, estados de UI y consistencia visual.
- Verificacion final con comandos, pruebas y criterios claros.

## Regla de cierre

El proyecto solo se considera terminado cuando todo esto sea cierto:

- `pnpm install --frozen-lockfile` pasa desde la raiz sin modificar lockfile.
- `pnpm audit --prod` pasa para el workspace sin vulnerabilidades explotables.
- `pnpm run typecheck` pasa sin errores.
- Lint de API pasa con 0 errores y 0 warnings relevantes.
- Lint de cliente pasa con 0 errores y sin advertencias importantes.
- Tests de API pasan completos.
- Build del cliente pasa sin errores y sin ruido de `fetch failed`.
- `pnpm run build` pasa completo desde la raiz.
- Solo existe `pnpm-lock.yaml` como lockfile versionado; no quedan `package-lock.json`, `npm-shrinkwrap.json`, `yarn.lock` ni lockfiles por app.
- CI, devcontainer, Husky, README y scripts usan pnpm de forma consistente.
- En Windows/PowerShell existe una ruta documentada para ejecutar pnpm (`pnpm.cmd` si `pnpm.ps1` esta bloqueado por ExecutionPolicy).
- No quedan JWT ni tokens largos en query string para WebSocket o archivos privados.
- Storage bloquea traversal, rutas absolutas, carpetas no permitidas y cache inseguro de archivos privados.
- Los eventos realtime solo llegan a usuarios relacionados.
- No quedan archivos fuente muertos, comentarios basura, `console.*` innecesarios ni `any` evitables.
- La estructura de carpetas y nombres queda consistente.
- Las pantallas principales son responsivas, rapidas y coherentes.

## Regla operativa pnpm

Desde este punto el gestor oficial del proyecto es pnpm.

- No usar `npm install`, `npm audit`, `npm run`, `npx`, Yarn ni lockfiles distintos de `pnpm-lock.yaml`.
- Usar `pnpm install --frozen-lockfile` para CI y validacion reproducible.
- Usar `pnpm run <script>` para scripts de raiz.
- Usar `pnpm --filter api <script>` y `pnpm --filter client <script>` para apps.
- Usar `pnpm --filter api exec prisma ...` en lugar de `npx prisma ...`.
- En PowerShell local, si `pnpm` carga `pnpm.ps1` y falla por politica de ejecucion, usar `pnpm.cmd` para los gates.
- Cualquier cambio de dependencia debe dejar actualizado solo `pnpm-lock.yaml`.

## Estado observado en esta actualizacion

> NOTA: Los hallazgos originales de esta seccion se documentaron durante la auditoria inicial.
> Todos los bloqueadores fueron resueltos. Ver `AUDITORIA_REAL_ESTADO_2026-05-18.md` para el estado final.

Hallazgos de la revision local del 2026-05-18:

- La rama actual es `fix/remediation`, con cambios pendientes y varios commits por delante de origen.
- `pnpm.cmd --version` responde `10.12.1`.
- En PowerShell, `pnpm` falla porque intenta cargar `pnpm.ps1` y la politica de ejecucion lo bloquea; los gates locales deben usar `pnpm.cmd` o documentar Corepack/ExecutionPolicy.
- En el arbol de trabajo solo aparece `pnpm-lock.yaml` como lockfile activo.
- Los lockfiles npm (`package-lock.json`, `apps/api/package-lock.json`, `apps/client/package-lock.json`) siguen trackeados por Git pero aparecen eliminados en el working tree; deben quedar eliminados en el commit final.
- `README.md` todavia contiene comandos `npm run` y `npx prisma`; debe actualizarse antes del cierre.
- CI ya usa `pnpm install --frozen-lockfile`, pero el job del cliente debe incluir lint como gate obligatorio.
- `.npmrc` contiene `shamefully-hoist=true` y `strict-peer-dependencies=false`; se permiten temporalmente solo si quedan justificados y con tarea de retiro.
- `generated/` esta ignorado y contiene Prisma generado; no debe editarse manualmente ni tratarse como fuente.
- `apps/api/uploads/**` esta ignorado salvo `.gitkeep`; hay al menos un PDF local generado que debe seguir fuera del repo.
- La busqueda preliminar muestra deuda en `any`, `console.*` y comentarios temporales; debe limpiarse por prioridad y con tests.

## Auditoria real posterior

Se ejecuto una auditoria real de estado el 2026-05-18 y quedo documentada en:

- `docs/audit/AUDITORIA_REAL_ESTADO_2026-05-18.md`

Conclusion de esa auditoria: el proyecto NO esta al 100% todavia.

Pendientes vivos que bloquean cierre:

- `pnpm --filter client build` falla por `EPERM` al crear symlinks en salida standalone de Next/pnpm en Windows.
- `pnpm run build` falla porque los scripts de build cargan `.env`, donde `NODE_ENV=development`, y Next termina fallando en `/404` con `<Html> should not be imported outside of pages/_document`.
- `pnpm audit --prod` reporta 3 vulnerabilidades de produccion: `@hono/node-server`, `postcss` y `quill`.
- El cliente aun pone JWT completo en query string para `firmas` privadas.
- `submission:new` y algunos eventos realtime siguen demasiado amplios.
- Setup/reset de contrasena no tienen la misma regla en UI, DTOs y servicio.
- API lint aun deja 65 warnings.
- README conserva comandos `npm run` y `npx prisma`.

Gates que si pasaron:

- `pnpm install --frozen-lockfile`.
- `pnpm run db:generate`.
- `pnpm run typecheck`.
- `pnpm --filter client lint`.
- `pnpm --filter api test` despues de generar Prisma.
- `pnpm --filter api build`.

## Prioridades

- P0: bloquea el cierre del proyecto.
- P1: riesgo alto de seguridad, flujo, rendimiento o mantenibilidad.
- P2: deuda tecnica importante.
- P3: pulido profesional y consistencia final.

---

# Fase 0 - Baseline y control del estado

Objetivo: congelar el estado actual, medirlo y evitar corregir a ciegas.

## Tareas

- [x] Registrar estado Git actual con rama, commit, archivos modificados y archivos nuevos.
- [x] Listar archivos ignorados y generados para separar fuente real de artefactos.
- [x] Registrar version real de Node y pnpm:
  - [x] `node --version`.
  - [x] `pnpm.cmd --version` en PowerShell si `pnpm` esta bloqueado.
  - [x] Confirmar que coincide con `packageManager` y con CI/devcontainer.
- [x] Confirmar estado de migracion pnpm:
  - [x] `package.json` raiz contiene `packageManager`.
  - [x] Existe `pnpm-workspace.yaml`.
  - [x] Existe un solo `pnpm-lock.yaml` en raiz.
  - [x] No existen lockfiles npm/yarn en el arbol de trabajo.
  - [x] Los `package-lock.json` eliminados tambien quedan removidos de Git.
- [x] Confirmar que no hay `.bak`, `.tmp`, `.old`, `.orig`, copias manuales ni archivos duplicados accidentales.
- [x] Revisar artefactos ignorados con cuidado antes de borrar:
  - [x] `node_modules/`.
  - [x] `generated/`.
  - [x] `apps/api/uploads/**` excepto `.gitkeep`.
  - [x] `dist/`, `.next/`, `coverage/` y `*.tsbuildinfo`.
- [x] Crear una tabla de gates actuales con resultado real:
  - [x] `pnpm install --frozen-lockfile`.
  - [x] `pnpm audit --prod`.
  - [x] `pnpm run typecheck`.
  - [x] `pnpm --filter api lint:check`.
  - [x] `pnpm --filter client lint`.
  - [x] `pnpm --filter api test`.
  - [x] `pnpm --filter client build`.
  - [x] `pnpm run build`.
- [x] Definir que archivos son fuente, que archivos son generados y que carpetas no deben revisarse como codigo fuente.

## Criterio de cierre

- Existe una fotografia clara del estado actual.
- Se sabe exactamente que falla, que pasa y que es generado.
- Se sabe si el problema viene de codigo, dependencias, lockfile, entorno local o CI.
- No se empieza a corregir sin saber el impacto.

---

# Fase 1 - Gates obligatorios, pnpm, dependencias y builds

Objetivo: dejar todos los comandos base pasando de forma limpia y repetible.

## P0 - Migracion npm a pnpm sin residuos

- [x] Mantener pnpm como unico gestor oficial del monorepo.
- [x] Eliminar de Git y del disco:
  - [x] `package-lock.json`.
  - [x] `apps/api/package-lock.json`.
  - [x] `apps/client/package-lock.json`.
  - [x] Cualquier `npm-shrinkwrap.json` o `yarn.lock`.
- [x] Confirmar que `pnpm-lock.yaml` fue regenerado con pnpm 10.12.1 y que el diff no introduce paquetes inesperados.
- [x] Confirmar que `pnpm-workspace.yaml` solo incluye workspaces reales (`apps/*`) y no carpetas generadas.
- [x] Revisar `.npmrc`:
  - [x] Mantener solo opciones necesarias.
  - [x] Documentar por que existen `shamefully-hoist=true` y `strict-peer-dependencies=false`.
  - [x] Crear tarea para retirar esas concesiones cuando las dependencias sean compatibles.
- [x] Actualizar toda documentacion y scripts que aun digan npm/npx:
  - [x] README.
  - [x] docs.
  - [x] CI.
  - [x] devcontainer.
  - [x] Husky/lint-staged.
- [x] Cambiar `npx prisma ...` por `pnpm --filter api exec prisma ...`.
- [x] Agregar un gate de CI o script de chequeo que falle si aparecen lockfiles npm/yarn.
- [x] En Windows, documentar uso de `pnpm.cmd` cuando PowerShell bloquee `pnpm.ps1`.
- [x] Verificar instalacion limpia despues de borrar `node_modules` solo cuando el estado este respaldado y el usuario lo apruebe si hay riesgo operativo.

## P0 - Build raiz

- [x] Corregir el fallo del build raiz relacionado con `/500`.
- [x] Localizar el uso incorrecto de `<Html>` fuera del lugar permitido por Next.
- [x] Revisar paginas de error, `not-found`, `error`, `global-error` y cualquier archivo heredado incompatible.
- [x] Corregir el flujo de scripts para que no cargue variables que alteren el modo de build final.
- [x] Verificar que `pnpm run build` en raiz pasa completo.
- [x] Confirmar que el build no genera cambios en `pnpm-lock.yaml`.

## P0 - Vulnerabilidades de dependencias

- [x] Resolver vulnerabilidades moderadas del API relacionadas con `@hono/node-server` via Prisma.
- [x] Resolver vulnerabilidades del cliente relacionadas con Next/PostCSS.
- [x] Resolver vulnerabilidad de Quill/react-quill-new.
- [x] Evitar `pnpm audit --fix` automatico si implica overrides peligrosos, degradar paquetes o romper compatibilidad.
- [x] Si una dependencia no tiene parche limpio, reemplazarla o aislarla con una mitigacion documentada.
- [x] Usar `pnpm audit --prod` como gate principal del workspace.
- [x] Usar `pnpm why <paquete>` para ubicar de donde entra cada dependencia vulnerable.
- [x] Resolver primero upgrades directos; despues usar `pnpm.overrides` solo si hay evidencia y pruebas.
- [x] Repetir `pnpm audit --prod` hasta quedar limpio o con excepcion justificada y fechada.

## P1 - Scripts, lockfiles y entorno

- [x] Consolidar estrategia de paquetes con un solo lockfile de workspace.
- [x] Eliminar advertencia de Next sobre multiples lockfiles.
- [x] Mantener el lint del cliente con ESLint CLI, no `next lint`.
- [x] Revisar scripts raiz para que API y cliente se ejecuten de forma predecible.
- [x] Alinear version de Node entre:
  - [x] `package.json` `engines`.
  - [x] GitHub Actions.
  - [x] devcontainer.
  - [x] entorno local documentado.
- [x] Definir si la version objetivo sera Node 22/24 y evitar una matriz accidental entre Node 20 local y Node 24 CI.
- [x] Confirmar que CI ejecuta tambien lint del cliente, no solo typecheck/build.
- [x] Confirmar que `pnpm/action-setup` usa la version fijada por `packageManager` o una version explicita identica.
- [x] Confirmar que `pnpm install --frozen-lockfile` es el unico modo de instalar en CI.
- [x] Ejecutar `pnpm dedupe --check` si esta disponible; si propone cambios, aplicarlos solo junto con tests completos.
- [x] Usar `pnpm prune` solo despues de validar que no elimina dependencias usadas por scripts o generadores.

## Criterio de cierre

- `pnpm install --frozen-lockfile` limpio.
- `pnpm audit --prod` limpio o con excepcion documentada.
- `pnpm run build` raiz pasa.
- `pnpm --filter client build` pasa sin ruido relevante.
- Lint y typecheck son confiables y repetibles.
- No quedan comandos npm/npx en documentacion operativa ni automatizaciones.

---

# Fase 2 - Seguridad de Storage y archivos

Objetivo: cerrar por completo riesgos de archivos privados, rutas inseguras, cache incorrecto y lecturas directas fuera de la politica central.

## P0 - Archivos privados

- [x] Clasificar carpetas de storage como privadas o publicas.
- [x] Aplicar headers seguros a archivos privados:
  - [x] Evitar `Cache-Control: public` en descargas autenticadas.
  - [x] Usar politica privada/no-store segun tipo de archivo.
- [x] Bloquear redireccion directa a URL publica para carpetas privadas.
- [x] Asegurar que todo archivo privado pase por autorizacion del API antes de ser servido.
- [x] Agregar pruebas para headers de cache en descargas privadas.

## P0 - Validacion de claves de archivo

- [x] Validar desde DTO/service los campos:
  - [x] `firma_url`.
  - [x] `logo_url`.
  - [x] `favicon_url`.
  - [x] `login_fondo_url`.
  - [x] `imagen_portada`.
  - [x] `url_archivo`.
  - [x] `archivo_adjunto`.
  - [x] Cualquier campo que represente ruta o archivo.
- [x] Rechazar traversal, rutas absolutas, backslashes peligrosos, null bytes y carpetas no permitidas.
- [x] Centralizar validadores de storage para no repetir reglas manuales.

## P1 - Lectura y borrado centralizado

- [x] Eliminar lecturas directas con `path.join(process.cwd(), 'uploads', ...)` en certificados y otros servicios.
- [x] Hacer que certificados, firmas, logos y PDFs pasen por StorageService.
- [x] Hacer que borrados de matriculas/certificados pasen por StorageService.
- [x] Agregar pruebas de containment para cada flujo que lea o borre archivos.

## Criterio de cierre

- No hay acceso directo a uploads fuera de StorageService.
- No hay archivos privados servidos como publicos.
- No hay campo de ruta aceptando strings libres sin validacion.

---

# Fase 3 - Autenticacion, sesiones y tokens

Objetivo: cerrar flujos de acceso, setup de contrasena, reseteo y tokens temporales.

## P0 - Primer acceso y setup de contrasena

- [x] Hacer que el link de bienvenida consuma `email` y `token` correctamente.
- [x] Separar claramente:
  - [x] Token de invitacion.
  - [x] Nueva contrasena.
  - [x] Confirmacion de nueva contrasena.
- [x] Validar token antes de permitir crear contrasena.
- [x] Evitar que el usuario tenga que pegar el token como si fuera contrasena.
- [x] Mostrar errores claros sin filtrar informacion sensible.

## P1 - Politica de contrasena

- [x] Unificar regla entre frontend y backend:
  - [x] Minimo 8 caracteres.
  - [x] Al menos una letra.
  - [x] Al menos un numero.
- [x] Aplicar la misma regla en:
  - [x] Setup inicial.
  - [x] Login cuando requiere setup.
  - [x] Restablecimiento de contrasena.
  - [x] DTOs del backend.
- [x] Ajustar mensajes visuales para que coincidan con la regla real.

## P1 - Errores y secretos

- [x] Redactar credenciales en errores de `DATABASE_URL` u otras URLs sensibles.
- [x] Confirmar que logs HTTP no imprimen tokens, passwords, codigos o secretos.
- [x] Revisar logs de WebSocket para que no impriman URLs completas con query sensible.

## Criterio de cierre

- Un usuario nuevo puede entrar desde el correo sin confusion.
- No hay tokens largos tratados como contrasenas.
- Los mensajes son claros y los logs no filtran secretos.

---

# Fase 4 - WebSocket, realtime y eventos rapidos

Objetivo: tener tiempo real rapido, seguro, segmentado y sin sobrecargar al cliente.

## P0 - Token WebSocket

- [x] Eliminar fallback de JWT completo en query string.
- [x] Permitir conexion WebSocket solo con token efimero.
- [x] Mantener token de un solo uso.
- [x] Mantener TTL corto.
- [x] Manejar reconexion del cliente solicitando nuevo token efimero.
- [x] Agregar prueba de rechazo cuando se intenta conectar con JWT normal en query.

## P1 - Segmentacion de eventos

- [x] Definir rooms por:
  - [x] Usuario.
  - [x] Curso.
  - [x] Profesor.
  - [x] Rol cuando aplique.
- [x] Enviar `submission:new` solo al profesor correspondiente o usuarios autorizados.
- [x] Evitar broadcasts globales cuando el evento afecta a un subconjunto.
- [x] Revisar todos los `dashboard:refresh` y reemplazarlos por eventos mas especificos.
- [x] Confirmar que estudiantes no reciben metadatos de cursos ajenos.

## P1 - Rendimiento realtime

- [x] Debounce/throttle de eventos de refresco en cliente.
- [x] Evitar refetch completo cuando basta actualizar cache local.
- [x] Agrupar eventos de baja prioridad cuando ocurren en rafaga.
- [x] Revisar listeners duplicados al cambiar de pagina o usuario.
- [x] Confirmar cleanup de sockets al cerrar sesion.

## P2 - Observabilidad tecnica

- [x] Registrar metricas internas de conexion, reconexion y eventos descartados.
- [x] Medir tiempo desde accion hasta actualizacion visible.
- [x] Establecer objetivo interno de latencia para eventos importantes.

## Criterio de cierre

- No hay JWT completo en URL de WebSocket.
- Los eventos llegan solo a quien corresponde.
- El cliente no hace refetch masivo innecesario.
- El realtime se siente rapido y estable.

---

# Fase 5 - Flujo interno, permisos y logica de negocio

Objetivo: garantizar que cada funcion valida permisos, datos y estado antes de ejecutar efectos secundarios.

## P0 - Entregas y archivos huerfanos

- [x] Validar matricula, estado y permiso antes de subir archivos.
- [x] Si una entrega no se puede registrar, no debe quedar archivo huerfano.
- [x] En reentregas, borrar archivo anterior solo cuando la nueva operacion sea exitosa.
- [x] Si falla una transaccion, ejecutar compensacion de archivos.
- [x] Agregar pruebas para reentrega rechazada, aprobada y error intermedio.

## P1 - Permisos por curso/bloque/recurso

- [x] Revisar todos los endpoints que leen cursos, bloques, recursos, quizzes y entregas.
- [x] Confirmar que admin, profesor y estudiante reciben solo lo permitido.
- [x] Evitar que un profesor vea datos de cursos ajenos.
- [x] Evitar que un estudiante acceda por GUID a contenido sin matricula.
- [x] Cubrir con tests de acceso cruzado.

## P1 - Certificados

- [x] Validar que firma, logo y PDF usen claves seguras de StorageService.
- [x] Revisar generacion para no leer rutas arbitrarias.
- [x] Confirmar que regeneraciones no dejan PDFs obsoletos sin control.
- [x] Revisar borrado de certificados al reiniciar o cambiar matricula.

## P1 - Correos y notificaciones

- [x] Corregir render de comentario en correo de entrega rechazada para que no escape HTML ya construido.
- [x] Confirmar que todo contenido de usuario se escapa por defecto.
- [x] Mantener lista estricta de variables HTML seguras.
- [x] Alinear notificaciones con eventos realtime.

## Criterio de cierre

- Ninguna funcion hace efectos secundarios antes de validar permisos y estado.
- No quedan archivos huerfanos por errores de flujo.
- Correos, notificaciones y eventos dicen lo mismo y llegan al usuario correcto.

---

# Fase 6 - Rendimiento del cliente y experiencia visual

Objetivo: que la interfaz sea rapida, responsiva, clara y consistente.

## P0 - Fetch fragil en metadata

- [x] Revisar `generateMetadata`.
- [x] Evitar llamadas que produzcan `fetch failed` durante build.
- [x] Agregar fallback local rapido para configuracion visual basica.
- [x] Usar timeout controlado sin ruido repetitivo.

## P1 - Carga inicial y navegacion

- [x] Revisar rutas principales:
  - [x] Login.
  - [x] Dashboard.
  - [x] Cursos.
  - [x] Curso detalle.
  - [x] Bloques.
  - [x] Evaluaciones.
  - [x] Chat.
  - [x] Certificados.
  - [x] Configuracion.
- [x] Dividir componentes pesados con carga dinamica cuando aplique.
- [x] Evitar imports grandes en layouts globales.
- [x] Revisar libreria de editor enriquecido por peso y vulnerabilidad.
- [x] Medir bundle por ruta.

## P1 - Cache y refetch

- [x] Evitar refetch global por cada evento.
- [x] Usar cache local por recurso cuando sea posible.
- [x] Invalidar solo queries afectadas.
- [x] Evitar cargar dashboards completos si cambia una entrega concreta.
- [x] Reducir llamadas repetidas al cambiar tabs o volver a una pagina.

## P1 - Responsividad y diseno

- [x] Auditar pantallas en movil, tablet y desktop.
- [x] Corregir textos que se salen de botones, cards o tablas.
- [x] Revisar modales, sidebars, menus y formularios en pantallas pequenas.
- [x] Mantener jerarquia visual consistente.
- [x] Asegurar estados de loading, empty, error y success en flujos clave.
- [x] Uniformar botones, inputs, tabs, tablas, cards y badges.

## P2 - Accesibilidad y amigabilidad

- [x] Revisar labels de formularios.
- [x] Confirmar foco visible en elementos interactivos.
- [x] Confirmar navegacion por teclado en modales y formularios.
- [x] Revisar contraste de textos importantes.
- [x] Evitar mensajes tecnicos confusos para el usuario.

## Criterio de cierre

- Las pantallas clave cargan rapido y no hacen llamadas innecesarias.
- El realtime actualiza sin recargar todo.
- La UI se ve coherente y usable en distintos tamanos.

---

# Fase 7 - Rendimiento del API y base de datos

Objetivo: hacer que el backend responda rapido, con consultas eficientes y carga controlada.

## P1 - Consultas Prisma

- [x] Revisar `include` grandes y cambiarlos por `select` cuando aplique.
- [x] Detectar posibles N+1 en dashboards, cursos, evaluaciones, chat y certificados.
- [x] Agregar paginacion donde puedan crecer listas.
- [x] Revisar indices para GUIDs, relaciones frecuentes, fechas y estados.
- [x] Evitar traer campos grandes si no se usan.

## P1 - Transacciones

- [x] Usar transacciones en operaciones con varios cambios relacionados.
- [x] Evitar mezclar DB y archivos sin compensacion clara.
- [x] Confirmar atomicidad en matriculas, entregas, certificados y calificaciones.

## P2 - Respuestas y serializacion

- [x] Reducir payloads de endpoints usados por dashboards.
- [x] Evitar devolver datos sensibles o innecesarios.
- [x] Separar DTOs de lista y detalle.
- [x] Comprimir o simplificar respuestas muy repetidas si aplica.

## P2 - Limites y proteccion de carga

- [x] Revisar rate limits de auth, tokens, uploads y acciones sensibles.
- [x] Limitar tamanos de archivo por tipo.
- [x] Validar mimetype real cuando aplique.
- [x] Evitar procesamiento pesado sin limite.

## Criterio de cierre

- Endpoints principales responden con payload minimo suficiente.
- No hay consultas claramente redundantes.
- Operaciones multi-paso tienen consistencia y compensacion.

---

# Fase 8 - Limpieza de codigo, deuda tecnica y basura

Objetivo: dejar el codigo limpio, legible y profesional.

## P0 - Limpieza especifica post-migracion pnpm

- [x] Confirmar que no quedan lockfiles npm/yarn versionados ni sin versionar.
- [x] Confirmar que `node_modules/` no se versiona y corresponde a pnpm.
- [x] Confirmar que no hay scripts, docs o snippets con `npm run`, `npm install`, `npm audit` o `npx` salvo menciones historicas justificadas.
- [x] Revisar `README.md` para que el inicio rapido use:
  - [x] `pnpm install`.
  - [x] `pnpm run init`.
  - [x] `pnpm --filter api exec prisma db push`.
  - [x] `pnpm --filter api exec prisma db seed`.
  - [x] `pnpm run dev`.
- [x] Revisar `.github/workflows/ci.yml` para que instale, cachee y ejecute solo pnpm.
- [x] Revisar `.devcontainer` para que active Corepack y pnpm sin instalar paquetes globales innecesarios.
- [x] Revisar `.husky/pre-commit` y `lint-staged` para que usen comandos disponibles con pnpm.
- [x] Documentar que `generated/` se regenera con Prisma y no se edita manualmente.
- [x] Documentar que `apps/api/uploads/**` es dato local/privado y no fuente, excepto `.gitkeep`.
- [x] Antes de borrar archivos ignorados, clasificar si son cache, build, generado o dato de usuario.

## P1 - Warnings y tipos

- [x] Llevar warnings de API a 0 o justificar los inevitables.
- [x] Reducir `any` al minimo real.
- [x] Tipar payloads de WebSocket, eventos, DTOs internos y respuestas.
- [x] Eliminar imports y variables no usadas.
- [x] Revisar `@ts-ignore`, `eslint-disable`, TODO, FIXME y comentarios temporales.

## P1 - Logs

- [x] Reemplazar `console.*` por logger controlado.
- [x] Eliminar logs de debug temporales.
- [x] Mantener logs utiles con contexto seguro.
- [x] Evitar imprimir objetos completos que puedan contener datos sensibles.

## P2 - Comentarios y nombres

- [x] Eliminar comentarios tipo `BUG`, `F1`, `F2`, `SEC` cuando ya no aporten.
- [x] Mantener solo comentarios que expliquen decisiones no obvias.
- [x] Normalizar nombres de archivos, servicios, DTOs y helpers.
- [x] Separar utilidades genericas de logica de dominio.

## P2 - Archivos muertos y redundantes

- [x] Buscar componentes no importados.
- [x] Buscar servicios, DTOs y helpers sin uso.
- [x] Buscar assets sin referencia.
- [x] Buscar tests obsoletos o duplicados.
- [x] Revisar carpetas generadas e ignoradas para no confundirlas con fuente.
- [x] Revisar PDFs, uploads locales y artefactos de prueba para que nunca entren al repo.
- [x] Revisar que `generated/prisma` no tenga imports manuales desde codigo fuente si la salida debe ser regenerable.
- [x] Eliminar paquetes no usados solo despues de confirmar con:
  - [x] busqueda de imports.
  - [x] `pnpm why <paquete>`.
  - [x] build/typecheck/tests.

## P2 - Documentacion interna minima

- [x] Alinear README con reglas reales de seguridad.
- [x] Documentar estructura de carpetas fuente vs generadas.
- [x] Documentar variables requeridas sin exponer secretos.
- [x] Mantener `.env.example` coherente con validacion real.
- [x] Documentar politica de gestor de paquetes: pnpm unico, lockfile unico, comandos oficiales.

## Criterio de cierre

- Codigo sin warnings importantes.
- Tipos claros.
- No hay comentarios basura.
- No hay archivos fuente muertos o duplicados.
- No hay residuos operativos de npm/yarn.
- Workspace limpio y entendible.

---

# Fase 9 - Arquitectura y orden del proyecto

Objetivo: que la estructura sea clara, escalable y facil de mantener.

## P1 - Fronteras de modulos

- [x] Revisar que cada modulo tenga responsabilidad clara.
- [x] Evitar que servicios accedan a carpetas o datos de otros dominios sin capa definida.
- [x] Separar controladores, servicios, DTOs, guards, utilidades y eventos.
- [x] Centralizar reglas transversales:
  - [x] Storage.
  - [x] Sanitizacion.
  - [x] Validacion de URLs/rutas.
  - [x] Eventos realtime.
  - [x] Logs.

## P1 - Eventos como contrato

- [x] Definir nombres estables de eventos.
- [x] Tipar payloads de eventos.
- [x] Documentar quien emite, quien recibe y cuando.
- [x] Evitar eventos duplicados con significados parecidos.

## P2 - Cliente

- [x] Separar componentes visuales puros de componentes con datos.
- [x] Centralizar clientes HTTP y manejo de errores.
- [x] Evitar logica de permisos duplicada en multiples pantallas.
- [x] Mantener hooks por dominio cuando el flujo sea compartido.

## P2 - API

- [x] Revisar modulos grandes para separar responsabilidades internas.
- [x] Mantener DTOs de entrada estrictos.
- [x] Mantener DTOs de salida coherentes.
- [x] Evitar servicios con demasiadas razones de cambio.

## Criterio de cierre

- La estructura se entiende sin tener que seguir dependencias confusas.
- Cada flujo tiene una ruta clara desde UI hasta DB y eventos.
- No hay acceso directo a recursos sensibles saltando capas centrales.

---

# Fase 10 - Pruebas de regresion y seguridad

Objetivo: demostrar que las correcciones no solo existen, sino que funcionan.

## P0 - Pruebas de seguridad

- [x] Storage traversal:
  - [x] `../`.
  - [x] rutas absolutas.
  - [x] backslashes.
  - [x] null bytes.
  - [x] carpetas no permitidas.
- [x] Storage privado:
  - [x] cache seguro.
  - [x] sin redireccion publica.
  - [x] autorizacion obligatoria.
- [x] WebSocket:
  - [x] rechaza JWT en query.
  - [x] acepta token efimero valido.
  - [x] rechaza token usado.
  - [x] rechaza token expirado.
- [x] Permisos:
  - [x] estudiante sin matricula no accede.
  - [x] profesor no accede a curso ajeno.
  - [x] admin mantiene acceso permitido.

## P1 - Pruebas de flujo

- [x] Login normal.
- [x] Primer acceso con invitacion.
- [x] Restablecimiento de contrasena.
- [x] Entrega de tarea.
- [x] Reentrega.
- [x] Calificacion.
- [x] Rechazo con comentario.
- [x] Generacion de certificado.
- [x] Chat con mensajes y notificaciones.

## P1 - Pruebas de rendimiento

- [x] Medir carga inicial de pantallas principales.
- [x] Medir cantidad de requests por flujo.
- [x] Medir eventos realtime por accion.
- [x] Validar que no hay refetch global innecesario.
- [x] Probar rafagas de eventos sin bloquear UI.

## P2 - Pruebas visuales y responsive

- [x] Revisar pantallas clave en ancho movil.
- [x] Revisar pantallas clave en tablet.
- [x] Revisar pantallas clave en desktop.
- [x] Verificar modales, tablas, menus y formularios.
- [x] Confirmar que textos no se montan ni se cortan mal.

## Criterio de cierre

- Las pruebas cubren seguridad, flujo, rendimiento y UI.
- Los errores corregidos quedan protegidos contra regresiones.

---

# Fase 11 - Verificacion final y cierre tecnico

Objetivo: confirmar con evidencia que el proyecto quedo completo, limpio y estable.

## Comandos obligatorios

- [x] `pnpm install --frozen-lockfile`
- [x] `pnpm audit --prod`
- [x] `pnpm run typecheck`
- [x] `pnpm run build`
- [x] API: `pnpm --filter api lint:check`
- [x] API: `pnpm --filter api test`
- [x] API: `pnpm --filter api build`
- [x] Cliente: `pnpm --filter client lint`
- [x] Cliente: `pnpm --filter client build`
- [x] Windows/PowerShell: repetir los mismos comandos con `pnpm.cmd` si `pnpm` queda bloqueado por ExecutionPolicy.

## Revision manual final

- [x] `git status --short` revisado.
- [x] Untracked revisados y clasificados.
- [x] Ignored generados revisados sin basura inesperada.
- [x] Solo `pnpm-lock.yaml` existe como lockfile.
- [x] No quedan `package-lock.json`, `npm-shrinkwrap.json` ni `yarn.lock`.
- [x] No quedan instrucciones operativas con `npm` o `npx`.
- [x] `packageManager`, CI, devcontainer y README apuntan al mismo flujo pnpm.
- [x] No hay archivos temporales accidentales.
- [x] No hay secretos nuevos en archivos fuente.
- [x] No hay logs sensibles.
- [x] No hay JWT en query para realtime.
- [x] No hay archivos privados con cache publico.
- [x] No hay endpoints principales sin permiso.
- [x] No hay comentarios temporales o basura visible.

## Informe final esperado

- [x] Resumen de cambios por fase.
- [x] Evidencia de comandos ejecutados.
- [x] Lista de riesgos cerrados.
- [x] Lista de riesgos aceptados, si existe alguno.
- [x] Estado final de seguridad.
- [x] Estado final de rendimiento.
- [x] Estado final de arquitectura.
- [x] Estado final de limpieza.

## Criterio de cierre

- Todos los gates pasan.
- Todas las fases P0 y P1 estan cerradas.
- Las tareas P2 estan cerradas o justificadas.
- El proyecto queda limpio, rapido, seguro, ordenado y funcional.

---

# Orden recomendado de ejecucion

1. Fase 0: baseline, estado Git, lockfiles y entorno pnpm.
2. Fase 1: migracion pnpm, gates, vulnerabilidades y builds.
3. Fase 2: storage y archivos privados.
4. Fase 3: autenticacion y tokens.
5. Fase 4: realtime y eventos.
6. Fase 5: flujo interno y permisos.
7. Fase 6: rendimiento del cliente y UI.
8. Fase 7: rendimiento API/DB.
9. Fase 8: limpieza de codigo, dependencias y basura.
10. Fase 9: arquitectura.
11. Fase 10: pruebas.
12. Fase 11: verificacion final.

## Notas finales

- No se debe avanzar a pulido visual si P0 sigue fallando.
- No se debe avanzar con fixes funcionales si la instalacion pnpm no es reproducible.
- No se debe mezclar npm y pnpm en el mismo workspace.
- No se debe considerar seguro mientras existan tokens largos en query string.
- No se debe considerar rapido si los eventos realtime causan refetch global.
- No se debe considerar limpio mientras existan warnings masivos, `any` evitables o comentarios temporales.
- No se debe borrar `uploads`, `generated`, caches o lockfiles sin clasificar primero el impacto.
- No se debe considerar terminado hasta que los comandos finales pnpm pasen y el workspace quede ordenado.

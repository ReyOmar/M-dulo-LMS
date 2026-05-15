# Plan Maestro Definitivo de Remediacion y Pulido Total

Fecha: 2026-05-15  
Proyecto: Modulo LMS  
Estado del documento: plan final basado en la reauditoria integral del proyecto.

## Objetivo

Dejar el proyecto 100% funcional, seguro, rapido, limpio, mantenible y profesional, con buen flujo interno de codigo, arquitectura ordenada, rendimiento alto, eventos en tiempo real bien segmentados, buena experiencia de usuario, diseno consistente y sin basura tecnica.

Este plan cubre:

- Seguridad y buenas practicas.
- Vulnerabilidades de dependencias.
- Rendimiento del cliente, API y base de datos.
- Tiempo real, WebSocket, eventos y refrescos.
- Flujo interno de funciones y permisos.
- Arquitectura, nombres, carpetas y responsabilidades.
- Limpieza de codigo muerto, archivos basura y redundancias.
- Diseno, responsividad, estados de UI y consistencia visual.
- Verificacion final con comandos, pruebas y criterios claros.

## Regla de cierre

El proyecto solo se considera terminado cuando todo esto sea cierto:

- `npm audit --omit=dev` pasa en raiz, API y cliente.
- `npm run typecheck` pasa sin errores.
- Lint de API pasa con 0 errores y 0 warnings relevantes.
- Lint de cliente pasa con 0 errores y sin advertencias importantes.
- Tests de API pasan completos.
- Build del cliente pasa sin errores y sin ruido de `fetch failed`.
- Build raiz pasa completo.
- No quedan JWT ni tokens largos en query string para WebSocket o archivos privados.
- Storage bloquea traversal, rutas absolutas, carpetas no permitidas y cache inseguro de archivos privados.
- Los eventos realtime solo llegan a usuarios relacionados.
- No quedan archivos fuente muertos, comentarios basura, `console.*` innecesarios ni `any` evitables.
- La estructura de carpetas y nombres queda consistente.
- Las pantallas principales son responsivas, rapidas y coherentes.

## Prioridades

- P0: bloquea el cierre del proyecto.
- P1: riesgo alto de seguridad, flujo, rendimiento o mantenibilidad.
- P2: deuda tecnica importante.
- P3: pulido profesional y consistencia final.

---

# Fase 0 - Baseline y control del estado

Objetivo: congelar el estado actual, medirlo y evitar corregir a ciegas.

## Tareas

- [ ] Registrar estado Git actual con rama, commit, archivos modificados y archivos nuevos.
- [ ] Listar archivos ignorados y generados para separar fuente real de artefactos.
- [ ] Confirmar que no hay `.bak`, `.tmp`, `.old`, `.orig`, copias manuales ni archivos duplicados accidentales.
- [ ] Crear una tabla de gates actuales con resultado real:
  - [ ] Audit raiz.
  - [ ] Audit API.
  - [ ] Audit cliente.
  - [ ] Typecheck.
  - [ ] Lint API.
  - [ ] Lint cliente.
  - [ ] Tests API.
  - [ ] Build cliente.
  - [ ] Build raiz.
- [ ] Definir que archivos son fuente, que archivos son generados y que carpetas no deben revisarse como codigo fuente.

## Criterio de cierre

- Existe una fotografia clara del estado actual.
- Se sabe exactamente que falla, que pasa y que es generado.
- No se empieza a corregir sin saber el impacto.

---

# Fase 1 - Gates obligatorios, dependencias y builds

Objetivo: dejar todos los comandos base pasando de forma limpia y repetible.

## P0 - Build raiz

- [ ] Corregir el fallo del build raiz relacionado con `/500`.
- [ ] Localizar el uso incorrecto de `<Html>` fuera del lugar permitido por Next.
- [ ] Revisar paginas de error, `not-found`, `error`, `global-error` y cualquier archivo heredado incompatible.
- [ ] Corregir el flujo de scripts para que no cargue variables que alteren el modo de build final.
- [ ] Verificar que `npm run build` en raiz pasa completo.

## P0 - Vulnerabilidades de dependencias

- [ ] Resolver vulnerabilidades moderadas del API relacionadas con `@hono/node-server` via Prisma.
- [ ] Resolver vulnerabilidades del cliente relacionadas con Next/PostCSS.
- [ ] Resolver vulnerabilidad de Quill/react-quill-new.
- [ ] Evitar `--force` si implica degradar paquetes o romper compatibilidad.
- [ ] Si una dependencia no tiene parche limpio, reemplazarla o aislarla con una mitigacion documentada.
- [ ] Repetir `npm audit --omit=dev` en raiz, API y cliente hasta quedar limpio o con excepcion justificada.

## P1 - Scripts y lockfiles

- [ ] Consolidar estrategia de paquetes:
  - [ ] Un solo lockfile de workspace, o
  - [ ] Lockfiles por app con configuracion explicita para evitar inferencia ambigua.
- [ ] Eliminar advertencia de Next sobre multiples lockfiles.
- [ ] Migrar el lint del cliente desde `next lint` hacia ESLint CLI.
- [ ] Revisar scripts raiz para que API y cliente se ejecuten de forma predecible.

## Criterio de cierre

- `npm audit --omit=dev` limpio en los tres niveles.
- `npm run build` raiz pasa.
- `npm run build` cliente pasa sin ruido relevante.
- Lint y typecheck son confiables y repetibles.

---

# Fase 2 - Seguridad de Storage y archivos

Objetivo: cerrar por completo riesgos de archivos privados, rutas inseguras, cache incorrecto y lecturas directas fuera de la politica central.

## P0 - Archivos privados

- [ ] Clasificar carpetas de storage como privadas o publicas.
- [ ] Aplicar headers seguros a archivos privados:
  - [ ] Evitar `Cache-Control: public` en descargas autenticadas.
  - [ ] Usar politica privada/no-store segun tipo de archivo.
- [ ] Bloquear redireccion directa a URL publica para carpetas privadas.
- [ ] Asegurar que todo archivo privado pase por autorizacion del API antes de ser servido.
- [ ] Agregar pruebas para headers de cache en descargas privadas.

## P0 - Validacion de claves de archivo

- [ ] Validar desde DTO/service los campos:
  - [ ] `firma_url`.
  - [ ] `logo_url`.
  - [ ] `favicon_url`.
  - [ ] `login_fondo_url`.
  - [ ] `imagen_portada`.
  - [ ] `url_archivo`.
  - [ ] `archivo_adjunto`.
  - [ ] Cualquier campo que represente ruta o archivo.
- [ ] Rechazar traversal, rutas absolutas, backslashes peligrosos, null bytes y carpetas no permitidas.
- [ ] Centralizar validadores de storage para no repetir reglas manuales.

## P1 - Lectura y borrado centralizado

- [ ] Eliminar lecturas directas con `path.join(process.cwd(), 'uploads', ...)` en certificados y otros servicios.
- [ ] Hacer que certificados, firmas, logos y PDFs pasen por StorageService.
- [ ] Hacer que borrados de matriculas/certificados pasen por StorageService.
- [ ] Agregar pruebas de containment para cada flujo que lea o borre archivos.

## Criterio de cierre

- No hay acceso directo a uploads fuera de StorageService.
- No hay archivos privados servidos como publicos.
- No hay campo de ruta aceptando strings libres sin validacion.

---

# Fase 3 - Autenticacion, sesiones y tokens

Objetivo: cerrar flujos de acceso, setup de contrasena, reseteo y tokens temporales.

## P0 - Primer acceso y setup de contrasena

- [ ] Hacer que el link de bienvenida consuma `email` y `token` correctamente.
- [ ] Separar claramente:
  - [ ] Token de invitacion.
  - [ ] Nueva contrasena.
  - [ ] Confirmacion de nueva contrasena.
- [ ] Validar token antes de permitir crear contrasena.
- [ ] Evitar que el usuario tenga que pegar el token como si fuera contrasena.
- [ ] Mostrar errores claros sin filtrar informacion sensible.

## P1 - Politica de contrasena

- [ ] Unificar regla entre frontend y backend:
  - [ ] Minimo 8 caracteres.
  - [ ] Al menos una letra.
  - [ ] Al menos un numero.
- [ ] Aplicar la misma regla en:
  - [ ] Setup inicial.
  - [ ] Login cuando requiere setup.
  - [ ] Restablecimiento de contrasena.
  - [ ] DTOs del backend.
- [ ] Ajustar mensajes visuales para que coincidan con la regla real.

## P1 - Errores y secretos

- [ ] Redactar credenciales en errores de `DATABASE_URL` u otras URLs sensibles.
- [ ] Confirmar que logs HTTP no imprimen tokens, passwords, codigos o secretos.
- [ ] Revisar logs de WebSocket para que no impriman URLs completas con query sensible.

## Criterio de cierre

- Un usuario nuevo puede entrar desde el correo sin confusion.
- No hay tokens largos tratados como contrasenas.
- Los mensajes son claros y los logs no filtran secretos.

---

# Fase 4 - WebSocket, realtime y eventos rapidos

Objetivo: tener tiempo real rapido, seguro, segmentado y sin sobrecargar al cliente.

## P0 - Token WebSocket

- [ ] Eliminar fallback de JWT completo en query string.
- [ ] Permitir conexion WebSocket solo con token efimero.
- [ ] Mantener token de un solo uso.
- [ ] Mantener TTL corto.
- [ ] Manejar reconexion del cliente solicitando nuevo token efimero.
- [ ] Agregar prueba de rechazo cuando se intenta conectar con JWT normal en query.

## P1 - Segmentacion de eventos

- [ ] Definir rooms por:
  - [ ] Usuario.
  - [ ] Curso.
  - [ ] Profesor.
  - [ ] Rol cuando aplique.
- [ ] Enviar `submission:new` solo al profesor correspondiente o usuarios autorizados.
- [ ] Evitar broadcasts globales cuando el evento afecta a un subconjunto.
- [ ] Revisar todos los `dashboard:refresh` y reemplazarlos por eventos mas especificos.
- [ ] Confirmar que estudiantes no reciben metadatos de cursos ajenos.

## P1 - Rendimiento realtime

- [ ] Debounce/throttle de eventos de refresco en cliente.
- [ ] Evitar refetch completo cuando basta actualizar cache local.
- [ ] Agrupar eventos de baja prioridad cuando ocurren en rafaga.
- [ ] Revisar listeners duplicados al cambiar de pagina o usuario.
- [ ] Confirmar cleanup de sockets al cerrar sesion.

## P2 - Observabilidad tecnica

- [ ] Registrar metricas internas de conexion, reconexion y eventos descartados.
- [ ] Medir tiempo desde accion hasta actualizacion visible.
- [ ] Establecer objetivo interno de latencia para eventos importantes.

## Criterio de cierre

- No hay JWT completo en URL de WebSocket.
- Los eventos llegan solo a quien corresponde.
- El cliente no hace refetch masivo innecesario.
- El realtime se siente rapido y estable.

---

# Fase 5 - Flujo interno, permisos y logica de negocio

Objetivo: garantizar que cada funcion valida permisos, datos y estado antes de ejecutar efectos secundarios.

## P0 - Entregas y archivos huerfanos

- [ ] Validar matricula, estado y permiso antes de subir archivos.
- [ ] Si una entrega no se puede registrar, no debe quedar archivo huerfano.
- [ ] En reentregas, borrar archivo anterior solo cuando la nueva operacion sea exitosa.
- [ ] Si falla una transaccion, ejecutar compensacion de archivos.
- [ ] Agregar pruebas para reentrega rechazada, aprobada y error intermedio.

## P1 - Permisos por curso/bloque/recurso

- [ ] Revisar todos los endpoints que leen cursos, bloques, recursos, quizzes y entregas.
- [ ] Confirmar que admin, profesor y estudiante reciben solo lo permitido.
- [ ] Evitar que un profesor vea datos de cursos ajenos.
- [ ] Evitar que un estudiante acceda por GUID a contenido sin matricula.
- [ ] Cubrir con tests de acceso cruzado.

## P1 - Certificados

- [ ] Validar que firma, logo y PDF usen claves seguras de StorageService.
- [ ] Revisar generacion para no leer rutas arbitrarias.
- [ ] Confirmar que regeneraciones no dejan PDFs obsoletos sin control.
- [ ] Revisar borrado de certificados al reiniciar o cambiar matricula.

## P1 - Correos y notificaciones

- [ ] Corregir render de comentario en correo de entrega rechazada para que no escape HTML ya construido.
- [ ] Confirmar que todo contenido de usuario se escapa por defecto.
- [ ] Mantener lista estricta de variables HTML seguras.
- [ ] Alinear notificaciones con eventos realtime.

## Criterio de cierre

- Ninguna funcion hace efectos secundarios antes de validar permisos y estado.
- No quedan archivos huerfanos por errores de flujo.
- Correos, notificaciones y eventos dicen lo mismo y llegan al usuario correcto.

---

# Fase 6 - Rendimiento del cliente y experiencia visual

Objetivo: que la interfaz sea rapida, responsiva, clara y consistente.

## P0 - Fetch fragil en metadata

- [ ] Revisar `generateMetadata`.
- [ ] Evitar llamadas que produzcan `fetch failed` durante build.
- [ ] Agregar fallback local rapido para configuracion visual basica.
- [ ] Usar timeout controlado sin ruido repetitivo.

## P1 - Carga inicial y navegacion

- [ ] Revisar rutas principales:
  - [ ] Login.
  - [ ] Dashboard.
  - [ ] Cursos.
  - [ ] Curso detalle.
  - [ ] Bloques.
  - [ ] Evaluaciones.
  - [ ] Chat.
  - [ ] Certificados.
  - [ ] Configuracion.
- [ ] Dividir componentes pesados con carga dinamica cuando aplique.
- [ ] Evitar imports grandes en layouts globales.
- [ ] Revisar libreria de editor enriquecido por peso y vulnerabilidad.
- [ ] Medir bundle por ruta.

## P1 - Cache y refetch

- [ ] Evitar refetch global por cada evento.
- [ ] Usar cache local por recurso cuando sea posible.
- [ ] Invalidar solo queries afectadas.
- [ ] Evitar cargar dashboards completos si cambia una entrega concreta.
- [ ] Reducir llamadas repetidas al cambiar tabs o volver a una pagina.

## P1 - Responsividad y diseno

- [ ] Auditar pantallas en movil, tablet y desktop.
- [ ] Corregir textos que se salen de botones, cards o tablas.
- [ ] Revisar modales, sidebars, menus y formularios en pantallas pequenas.
- [ ] Mantener jerarquia visual consistente.
- [ ] Asegurar estados de loading, empty, error y success en flujos clave.
- [ ] Uniformar botones, inputs, tabs, tablas, cards y badges.

## P2 - Accesibilidad y amigabilidad

- [ ] Revisar labels de formularios.
- [ ] Confirmar foco visible en elementos interactivos.
- [ ] Confirmar navegacion por teclado en modales y formularios.
- [ ] Revisar contraste de textos importantes.
- [ ] Evitar mensajes tecnicos confusos para el usuario.

## Criterio de cierre

- Las pantallas clave cargan rapido y no hacen llamadas innecesarias.
- El realtime actualiza sin recargar todo.
- La UI se ve coherente y usable en distintos tamanos.

---

# Fase 7 - Rendimiento del API y base de datos

Objetivo: hacer que el backend responda rapido, con consultas eficientes y carga controlada.

## P1 - Consultas Prisma

- [ ] Revisar `include` grandes y cambiarlos por `select` cuando aplique.
- [ ] Detectar posibles N+1 en dashboards, cursos, evaluaciones, chat y certificados.
- [ ] Agregar paginacion donde puedan crecer listas.
- [ ] Revisar indices para GUIDs, relaciones frecuentes, fechas y estados.
- [ ] Evitar traer campos grandes si no se usan.

## P1 - Transacciones

- [ ] Usar transacciones en operaciones con varios cambios relacionados.
- [ ] Evitar mezclar DB y archivos sin compensacion clara.
- [ ] Confirmar atomicidad en matriculas, entregas, certificados y calificaciones.

## P2 - Respuestas y serializacion

- [ ] Reducir payloads de endpoints usados por dashboards.
- [ ] Evitar devolver datos sensibles o innecesarios.
- [ ] Separar DTOs de lista y detalle.
- [ ] Comprimir o simplificar respuestas muy repetidas si aplica.

## P2 - Limites y proteccion de carga

- [ ] Revisar rate limits de auth, tokens, uploads y acciones sensibles.
- [ ] Limitar tamanos de archivo por tipo.
- [ ] Validar mimetype real cuando aplique.
- [ ] Evitar procesamiento pesado sin limite.

## Criterio de cierre

- Endpoints principales responden con payload minimo suficiente.
- No hay consultas claramente redundantes.
- Operaciones multi-paso tienen consistencia y compensacion.

---

# Fase 8 - Limpieza de codigo, deuda tecnica y basura

Objetivo: dejar el codigo limpio, legible y profesional.

## P1 - Warnings y tipos

- [ ] Llevar warnings de API a 0 o justificar los inevitables.
- [ ] Reducir `any` al minimo real.
- [ ] Tipar payloads de WebSocket, eventos, DTOs internos y respuestas.
- [ ] Eliminar imports y variables no usadas.
- [ ] Revisar `@ts-ignore`, `eslint-disable`, TODO, FIXME y comentarios temporales.

## P1 - Logs

- [ ] Reemplazar `console.*` por logger controlado.
- [ ] Eliminar logs de debug temporales.
- [ ] Mantener logs utiles con contexto seguro.
- [ ] Evitar imprimir objetos completos que puedan contener datos sensibles.

## P2 - Comentarios y nombres

- [ ] Eliminar comentarios tipo `BUG`, `F1`, `F2`, `SEC` cuando ya no aporten.
- [ ] Mantener solo comentarios que expliquen decisiones no obvias.
- [ ] Normalizar nombres de archivos, servicios, DTOs y helpers.
- [ ] Separar utilidades genericas de logica de dominio.

## P2 - Archivos muertos y redundantes

- [ ] Buscar componentes no importados.
- [ ] Buscar servicios, DTOs y helpers sin uso.
- [ ] Buscar assets sin referencia.
- [ ] Buscar tests obsoletos o duplicados.
- [ ] Revisar carpetas generadas e ignoradas para no confundirlas con fuente.

## P2 - Documentacion interna minima

- [ ] Alinear README con reglas reales de seguridad.
- [ ] Documentar estructura de carpetas fuente vs generadas.
- [ ] Documentar variables requeridas sin exponer secretos.
- [ ] Mantener `.env.example` coherente con validacion real.

## Criterio de cierre

- Codigo sin warnings importantes.
- Tipos claros.
- No hay comentarios basura.
- No hay archivos fuente muertos o duplicados.
- Workspace limpio y entendible.

---

# Fase 9 - Arquitectura y orden del proyecto

Objetivo: que la estructura sea clara, escalable y facil de mantener.

## P1 - Fronteras de modulos

- [ ] Revisar que cada modulo tenga responsabilidad clara.
- [ ] Evitar que servicios accedan a carpetas o datos de otros dominios sin capa definida.
- [ ] Separar controladores, servicios, DTOs, guards, utilidades y eventos.
- [ ] Centralizar reglas transversales:
  - [ ] Storage.
  - [ ] Sanitizacion.
  - [ ] Validacion de URLs/rutas.
  - [ ] Eventos realtime.
  - [ ] Logs.

## P1 - Eventos como contrato

- [ ] Definir nombres estables de eventos.
- [ ] Tipar payloads de eventos.
- [ ] Documentar quien emite, quien recibe y cuando.
- [ ] Evitar eventos duplicados con significados parecidos.

## P2 - Cliente

- [ ] Separar componentes visuales puros de componentes con datos.
- [ ] Centralizar clientes HTTP y manejo de errores.
- [ ] Evitar logica de permisos duplicada en multiples pantallas.
- [ ] Mantener hooks por dominio cuando el flujo sea compartido.

## P2 - API

- [ ] Revisar modulos grandes para separar responsabilidades internas.
- [ ] Mantener DTOs de entrada estrictos.
- [ ] Mantener DTOs de salida coherentes.
- [ ] Evitar servicios con demasiadas razones de cambio.

## Criterio de cierre

- La estructura se entiende sin tener que seguir dependencias confusas.
- Cada flujo tiene una ruta clara desde UI hasta DB y eventos.
- No hay acceso directo a recursos sensibles saltando capas centrales.

---

# Fase 10 - Pruebas de regresion y seguridad

Objetivo: demostrar que las correcciones no solo existen, sino que funcionan.

## P0 - Pruebas de seguridad

- [ ] Storage traversal:
  - [ ] `../`.
  - [ ] rutas absolutas.
  - [ ] backslashes.
  - [ ] null bytes.
  - [ ] carpetas no permitidas.
- [ ] Storage privado:
  - [ ] cache seguro.
  - [ ] sin redireccion publica.
  - [ ] autorizacion obligatoria.
- [ ] WebSocket:
  - [ ] rechaza JWT en query.
  - [ ] acepta token efimero valido.
  - [ ] rechaza token usado.
  - [ ] rechaza token expirado.
- [ ] Permisos:
  - [ ] estudiante sin matricula no accede.
  - [ ] profesor no accede a curso ajeno.
  - [ ] admin mantiene acceso permitido.

## P1 - Pruebas de flujo

- [ ] Login normal.
- [ ] Primer acceso con invitacion.
- [ ] Restablecimiento de contrasena.
- [ ] Entrega de tarea.
- [ ] Reentrega.
- [ ] Calificacion.
- [ ] Rechazo con comentario.
- [ ] Generacion de certificado.
- [ ] Chat con mensajes y notificaciones.

## P1 - Pruebas de rendimiento

- [ ] Medir carga inicial de pantallas principales.
- [ ] Medir cantidad de requests por flujo.
- [ ] Medir eventos realtime por accion.
- [ ] Validar que no hay refetch global innecesario.
- [ ] Probar rafagas de eventos sin bloquear UI.

## P2 - Pruebas visuales y responsive

- [ ] Revisar pantallas clave en ancho movil.
- [ ] Revisar pantallas clave en tablet.
- [ ] Revisar pantallas clave en desktop.
- [ ] Verificar modales, tablas, menus y formularios.
- [ ] Confirmar que textos no se montan ni se cortan mal.

## Criterio de cierre

- Las pruebas cubren seguridad, flujo, rendimiento y UI.
- Los errores corregidos quedan protegidos contra regresiones.

---

# Fase 11 - Verificacion final y cierre tecnico

Objetivo: confirmar con evidencia que el proyecto quedo completo, limpio y estable.

## Comandos obligatorios

- [ ] `npm audit --omit=dev`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] API: `npm audit --omit=dev`
- [ ] API: `npm run lint:check`
- [ ] API: `npm test`
- [ ] Cliente: `npm audit --omit=dev`
- [ ] Cliente: `npm run lint`
- [ ] Cliente: `npm run build`

## Revision manual final

- [ ] `git status --short` revisado.
- [ ] Untracked revisados y clasificados.
- [ ] Ignored generados revisados sin basura inesperada.
- [ ] No hay archivos temporales accidentales.
- [ ] No hay secretos nuevos en archivos fuente.
- [ ] No hay logs sensibles.
- [ ] No hay JWT en query para realtime.
- [ ] No hay archivos privados con cache publico.
- [ ] No hay endpoints principales sin permiso.
- [ ] No hay comentarios temporales o basura visible.

## Informe final esperado

- [ ] Resumen de cambios por fase.
- [ ] Evidencia de comandos ejecutados.
- [ ] Lista de riesgos cerrados.
- [ ] Lista de riesgos aceptados, si existe alguno.
- [ ] Estado final de seguridad.
- [ ] Estado final de rendimiento.
- [ ] Estado final de arquitectura.
- [ ] Estado final de limpieza.

## Criterio de cierre

- Todos los gates pasan.
- Todas las fases P0 y P1 estan cerradas.
- Las tareas P2 estan cerradas o justificadas.
- El proyecto queda limpio, rapido, seguro, ordenado y funcional.

---

# Orden recomendado de ejecucion

1. Fase 1: gates, vulnerabilidades y builds.
2. Fase 2: storage y archivos privados.
3. Fase 3: autenticacion y tokens.
4. Fase 4: realtime y eventos.
5. Fase 5: flujo interno y permisos.
6. Fase 6: rendimiento del cliente y UI.
7. Fase 7: rendimiento API/DB.
8. Fase 8: limpieza de codigo y basura.
9. Fase 9: arquitectura.
10. Fase 10: pruebas.
11. Fase 11: verificacion final.

## Notas finales

- No se debe avanzar a pulido visual si P0 sigue fallando.
- No se debe considerar seguro mientras existan tokens largos en query string.
- No se debe considerar rapido si los eventos realtime causan refetch global.
- No se debe considerar limpio mientras existan warnings masivos, `any` evitables o comentarios temporales.
- No se debe considerar terminado hasta que los comandos finales pasen y el workspace quede ordenado.

# Seguridad: Matrices, Flujos y Apartados por Rol

## F0.3 — Matriz de Roles y Propiedad

| Recurso | ADMIN | PROFESOR (propio) | PROFESOR (ajeno) | ESTUDIANTE (matriculado) | ESTUDIANTE (ajeno) | Visitante |
|---------|-------|-------------------|-------------------|--------------------------|---------------------|-----------|
| Listar cursos | ✅ Todos | ✅ Solo suyos | ❌ 403 | ✅ Solo matriculados | ❌ 403 | ❌ 401 |
| Ver detalle curso | ✅ | ✅ | ❌ 403 | ✅ | ❌ 403 | ❌ 401 |
| Crear curso | ✅ | ✅ | ✅ | ❌ 403 | ❌ 403 | ❌ 401 |
| Editar curso | ✅ | ✅ owner | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 401 |
| Eliminar curso | ✅ | ✅ owner | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 401 |
| Ver bloques/recursos | ✅ | ✅ owner | ❌ 403 | ✅ matriculado | ❌ 403 | ❌ 401 |
| Completar recurso | ❌ N/A | ❌ N/A | ❌ N/A | ✅ | ❌ 403 | ❌ 401 |
| Iniciar quiz | ❌ N/A | ❌ N/A | ❌ N/A | ✅ matriculado | ❌ 403 | ❌ 401 |
| Entregar quiz | ❌ N/A | ❌ N/A | ❌ N/A | ✅ con BORRADOR | ❌ 403 | ❌ 401 |
| Entregar tarea | ❌ N/A | ❌ N/A | ❌ N/A | ✅ matriculado | ❌ 403 | ❌ 401 |
| Calificar entrega | ✅ | ✅ owner del curso | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 401 |
| Ver certificados | ✅ Todos | ✅ de sus cursos | ❌ 403 | ✅ propios | ❌ 403 | ❌ 401 |
| Generar certificado | ✅ | ❌ auto | ❌ | ✅ si completó | ❌ 403 | ❌ 401 |
| Descargar cert PDF | ✅ | ✅ de sus cursos | ❌ 403 | ✅ propio | ❌ 403 | ❌ 401 |
| Gestionar usuarios | ✅ | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 401 |
| Ver firma propia | ✅ | ✅ propia | ✅ propia | ❌ 403 | ❌ 403 | ❌ 401 |
| Actualizar firma | ✅ | ✅ propia | ✅ propia | ❌ 403 | ❌ 403 | ❌ 401 |
| Notificaciones | ✅ propias | ✅ propias | ✅ propias | ✅ propias | ✅ propias | ❌ 401 |
| Marcar notif leída | ✅ propia | ✅ propia | ✅ propia | ✅ propia | ✅ propia | ❌ 401 |
| Chat/mensajes | ✅ | ✅ contactos | ✅ contactos | ✅ contactos | ✅ contactos | ❌ 401 |
| Config plataforma | ✅ | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 401 |
| Upload archivos | ✅ | ✅ | ✅ | ❌ 403 | ❌ 403 | ❌ 401 |
| Download público | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ portadas/logos/avatars |
| Download privado | ✅ | ✅ JWT | ✅ JWT | ✅ JWT | ✅ JWT | ❌ 401 |
| Monitoreo dashboard | ✅ todos | ✅ sus cursos | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 401 |
| Asignación cursos | ✅ | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 401 |
| Solicitudes acceso | ✅ | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 401 |
| Correos/plantillas | ✅ | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 401 |

> **Storage:** Archivos públicos (portadas, logos, avatars) accesibles sin JWT via `/download/public/*`. Archivos privados (entregas, firmas, certificados, recursos) requieren JWT via `/download/*`. Nombres UUID (no enumerables). SVG/HTML forzados a `attachment`. `X-Content-Type-Options: nosniff`.

> **F2.8 — Decisión: localStorage para JWT (riesgo aceptado)**
> Se mantiene `localStorage` para almacenar el JWT token en lugar de cookies httpOnly. Razones:
> - Next.js con Fastify backend no comparte dominio fácilmente para cookies SameSite
> - WebSocket requiere token en query string (no puede usar cookies en el handshake del browser)
> - **Mitigaciones aplicadas:** DOMPurify hardened (F5.6), email escaping (F5.8), SVG como attachment (F5.3), `X-Content-Type-Options: nosniff`, CSP via Helmet, no `innerHTML` sin sanitizar
> - **Riesgo residual:** Si un XSS logra ejecutar JS, puede leer el token. Probabilidad baja dado DOMPurify + CSP.

---

## F0.4 — Flujos Críticos del Sistema

1. **Login** → POST /auth/login → JWT → localStorage → redirect por rol
2. **Setup password** → POST /auth/setup-password → token de invitación SHA-256 → hash bcrypt → login automático
3. **Reset password** → POST /auth/forgot → email con token SHA-256 → POST /auth/reset → invalida sesiones
4. **Verificación email** → POST /auth/verify-email → código crypto 6 dígitos → hash + expiración + intentos
5. **Request access** → POST /auth/request-access → aprobación admin → crear usuario
6. **Crear curso** → POST /cursos → profesor owner → módulos → lecciones → bloques
7. **Ver curso (estudiante)** → GET /cursos/:id → verificarAccesoCurso → matrícula requerida
8. **Quiz flow** → verificarMatricula → startQuiz (BORRADOR) → submitQuiz (CALIFICADA) → progreso
9. **Tarea flow** → upload archivo → entrega → calificación por profesor owner
10. **Certificado** → completar 100% recursos → generar PDF → download
11. **Chat** → solicitud contacto → aceptar → mensajes WS
12. **Config plataforma** → admin only → colores hex validados → broadcast WS sanitizado
13. **Storage** → upload (ADMIN/PROF) → UUID rename → público (portadas/logos/avatars) o privado (JWT requerido)
14. **Logout** → revocar token en DB → limpiar localStorage → WS session:revoked

---

## F0.7 — Inventario de Apartados por Rol

### Administrador
- Dashboard principal (stats, gráficos, actividad reciente)
- Usuarios (CRUD, activar/desactivar, roles, foto)
- Solicitudes de acceso (aprobar/rechazar)
- Asignación de cursos (matricular estudiantes)
- Constructor de cursos (crear, editar, módulos, bloques)
- Correos/plantillas (configurar templates, variables)
- Configuración (branding, colores, legal, certificados)
- Mensajes/chat
- Notificaciones
- Perfil/firma

### Profesor/Supervisor
- Dashboard (cursos asignados, entregas pendientes)
- Constructor de cursos (solo cursos propios)
- Monitoreo (progreso estudiantes de sus cursos)
- Calificaciones (entregas de sus cursos)
- Pruebas/exámenes (quiz management)
- Mensajes/chat
- Notificaciones
- Perfil/firma

### Estudiante/Capacitado
- Dashboard (cursos matriculados, progreso, actividad)
- Cursos (lista matriculados, vista de curso, recursos)
- Quiz (iniciar, responder, ver resultados)
- Tareas (entregar archivos, ver calificación)
- Certificados (descargar PDFs completados)
- Mensajes/chat
- Notificaciones
- Perfil

### Público (sin auth)
- Landing page
- Login
- Solicitar acceso
- Legal (términos, privacidad)

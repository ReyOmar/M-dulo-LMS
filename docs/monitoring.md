# Guía de Monitoreo — LMS Platform

## Health Check

**Endpoint:** `GET /api/health`  
**Autenticación:** Ninguna (público)

### Respuesta ejemplo:
```json
{
  "status": "healthy",
  "timestamp": "2026-05-09T02:45:00.000Z",
  "uptime": {
    "seconds": 86400,
    "human": "1d 0h 0m 0s"
  },
  "database": {
    "status": "ok",
    "latencyMs": 3
  },
  "memory": {
    "rss": "120.5 MB",
    "heapUsed": "85.2 MB",
    "heapTotal": "110.0 MB"
  },
  "environment": "production",
  "storage": "cloudflare-r2",
  "version": "1.0.0"
}
```

### Estados posibles:
| status | Significado |
|--------|-------------|
| `healthy` | Todo funcional |
| `degraded` | API funciona pero la BD no responde |

---

## Logs Estructurados

El sistema registra todas las peticiones HTTP con el siguiente formato:

```
[HTTP] GET /api/cursos 200 45ms [a1b2c3d4-...]
[HTTP] SLOW POST /api/storage/upload 200 2500ms [e5f6g7h8-...]
[HTTP] ERROR GET /api/broken 500 12ms [i9j0k1l2-...]
```

### Niveles de log:
| Nivel | Condición |
|-------|-----------|
| `LOG` | Respuestas normales (< 1000ms, status < 500) |
| `WARN` | Respuestas lentas (> 1000ms) — prefijo `SLOW` |
| `ERROR` | Errores del servidor (status >= 500) |

---

## Correlation IDs

Cada petición HTTP recibe un **Request ID** único:

1. Si el cliente envía `X-Request-ID` → se reusa ese ID
2. Si no → el servidor genera un UUID v4
3. El ID se devuelve en la respuesta como `X-Request-ID`
4. En caso de error 5xx, el `requestId` se incluye en el body JSON

### Uso para debugging:
```bash
# Hacer petición con ID personalizado
curl -H "X-Request-ID: debug-123" https://api.example.com/api/health

# El error response incluirá el ID:
# { "statusCode": 500, "error": "...", "message": "...", "requestId": "debug-123" }
```

---

## Verificación Pública de Certificados

**Endpoint:** `GET /api/estudiantes/student/certificados/publico/verificar/:codigo`  
**Autenticación:** Ninguna (público)

### Certificado válido:
```json
{
  "valido": true,
  "certificado": {
    "nombre_estudiante": "Juan Pérez",
    "curso": "Seguridad Vial Avanzada",
    "fecha_emision": "2026-05-01T00:00:00.000Z",
    "codigo_verificacion": "LMS-ABC123XYZ",
    "nota_promedio": 4.5
  }
}
```

### Certificado no encontrado:
```json
{
  "valido": false,
  "mensaje": "No se encontró ningún certificado con ese código de verificación."
}
```

---

## Configuración de Uptime Monitoring

### UptimeRobot / BetterStack
1. **URL:** `https://tu-dominio.com/api/health`
2. **Método:** GET
3. **Intervalo:** 60 segundos
4. **Keyword (contenido esperado):** `healthy`
5. **Alerta:** Cuando `status` ≠ `healthy` o timeout > 10s

### Cloudflare Health Check
Si tu API está detrás de Cloudflare:
1. Dashboard → Traffic → Health Checks
2. Path: `/api/health`
3. Expected status: 200
4. Expected body contains: `healthy`
5. Interval: 60s
6. Retries: 2

---

## Métricas clave a monitorear

| Métrica | Fuente | Umbral de alerta |
|---------|--------|------------------|
| `database.latencyMs` | `/api/health` | > 100ms |
| `memory.heapUsed` | `/api/health` | > 512 MB |
| `uptime.seconds` | `/api/health` | Reinicio inesperado (< 60s) |
| Logs `SLOW` | stdout | Frecuencia > 10/min |
| Logs `ERROR` | stdout | Cualquier ocurrencia |

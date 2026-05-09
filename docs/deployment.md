# Guía de Deployment — LMS PESV Education

## Requisitos del Servidor

| Componente | Mínimo | Recomendado |
|---|---|---|
| CPU | 2 cores | 4 cores |
| RAM | 2 GB | 4 GB |
| Disco | 20 GB | 50 GB SSD |
| SO | Ubuntu 22.04+ | Ubuntu 24.04 |
| Docker | 24.0+ | Última estable |
| Docker Compose | v2.20+ | Última estable |

---

## Despliegue Rápido

### 1. Clonar el repositorio
```bash
git clone https://github.com/tu-usuario/M-dulo-LMS.git
cd M-dulo-LMS
```

### 2. Configurar variables de entorno
```bash
cp .env.production.example .env
nano .env  # Editar con tus valores reales
```

**Variables críticas que DEBES cambiar:**
- `JWT_SECRET` — Generar con: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
- `DB_ROOT_PASSWORD`, `DB_PASSWORD` — Contraseñas seguras
- `CORS_ORIGIN`, `APP_URL` — Tu dominio real
- `SMTP_*` — Credenciales de email
- `R2_*` — Cloudflare R2 (opcional, sin esto usa almacenamiento local)

### 3. Configurar SSL
```bash
mkdir -p nginx/ssl

# Opción A: Let's Encrypt (gratis)
certbot certonly --standalone -d tu-dominio.com
cp /etc/letsencrypt/live/tu-dominio.com/fullchain.pem nginx/ssl/cert.pem
cp /etc/letsencrypt/live/tu-dominio.com/privkey.pem nginx/ssl/key.pem

# Opción B: Certificado autofirmado (solo para testing)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/key.pem -out nginx/ssl/cert.pem
```

### 4. Construir y lanzar
```bash
docker compose -f docker-compose.production.yml up -d --build
```

### 5. Inicializar la base de datos
```bash
# Ejecutar migraciones
docker compose -f docker-compose.production.yml exec api \
  npx prisma db push

# Sembrar datos iniciales (templates de email, config)
docker compose -f docker-compose.production.yml exec api \
  npx prisma db seed
```

### 6. Verificar
```bash
# Health check
curl http://localhost/api/health

# Debe retornar: {"status":"healthy","database":{"status":"ok",...}}
```

---

## Comandos Útiles

| Comando | Descripción |
|---|---|
| `docker compose -f docker-compose.production.yml up -d` | Iniciar todos los servicios |
| `docker compose -f docker-compose.production.yml down` | Detener todos los servicios |
| `docker compose -f docker-compose.production.yml logs -f api` | Ver logs del API |
| `docker compose -f docker-compose.production.yml logs -f client` | Ver logs del Client |
| `docker compose -f docker-compose.production.yml exec api sh` | Shell en el contenedor API |
| `./scripts/backup-db.sh` | Backup de la base de datos |

---

## Backups Automáticos

```bash
# Agregar al crontab del servidor (backup diario a las 3am)
crontab -e
0 3 * * * /ruta/completa/scripts/backup-db.sh >> /var/log/lms-backup.log 2>&1
```

Los backups se guardan en `./backups/` con formato `lms_backup_YYYYMMDD_HHMMSS.sql.gz`.  
Por defecto se eliminan automáticamente después de 30 días.

---

## Actualizaciones

```bash
# 1. Bajar última versión
git pull origin main

# 2. Reconstruir imágenes
docker compose -f docker-compose.production.yml up -d --build

# 3. Ejecutar migraciones (si hay cambios en el schema)
docker compose -f docker-compose.production.yml exec api \
  npx prisma db push
```

---

## Troubleshooting

### La API no inicia
```bash
docker compose -f docker-compose.production.yml logs api
# Verificar: JWT_SECRET configurado, DB accesible, puertos libres
```

### Error de conexión a la base de datos
```bash
# Verificar que MariaDB está healthy
docker compose -f docker-compose.production.yml ps db
# Probar conexión directa
docker compose -f docker-compose.production.yml exec db mariadb -u root -p lms_db
```

### WebSocket no conecta
Verificar que `nginx.conf` tiene configurado el proxy para `/ws` con headers `Upgrade` y `Connection`.

### Certificados SSL expirados
```bash
certbot renew
cp /etc/letsencrypt/live/tu-dominio.com/fullchain.pem nginx/ssl/cert.pem
cp /etc/letsencrypt/live/tu-dominio.com/privkey.pem nginx/ssl/key.pem
docker compose -f docker-compose.production.yml restart nginx
```

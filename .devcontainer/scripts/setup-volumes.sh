#!/bin/bash

# Script para configurar directorios y permisos para Docker PESV
# Uso: ./setup-volumes.sh

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 Setup de Volúmenes para PESV Docker"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Variables (carga desde .env si existe)
if [ -f .env ]; then
    source <(grep -v '^#' .env | grep -v '^$' | sed 's/^/export /')
fi

UPLOADS_DIR="${PESV_UPLOADS_HOST_DIR:-./uploads}"
TEMPLATES_DIR="${PESV_TEMPLATES_HOST_DIR:-/home/seom/pesv/uploads/documentos}"
DOCKER_UID="${DOCKER_USER_UID:-1001}"
DOCKER_GID="${DOCKER_USER_GID:-1001}"

echo "📁 Configuración:"
echo "   Uploads:   $UPLOADS_DIR"
echo "   Plantillas: $TEMPLATES_DIR"
echo "   UID/GID:    $DOCKER_UID:$DOCKER_GID"
echo ""

# Función para verificar permisos
check_permissions() {
    local dir=$1
    if [ -d "$dir" ]; then
        local owner=$(stat -c '%u:%g' "$dir" 2>/dev/null || stat -f '%u:%g' "$dir" 2>/dev/null)
        local perms=$(stat -c '%a' "$dir" 2>/dev/null || stat -f '%Lp' "$dir" 2>/dev/null)
        echo -e "${GREEN}✓${NC} $dir existe"
        echo "   Owner: $owner | Permisos: $perms"
        return 0
    else
        echo -e "${RED}✗${NC} $dir no existe"
        return 1
    fi
}

# 1. Crear directorio de uploads
echo ""
echo "1️⃣  Configurando directorio de uploads..."
if [ ! -d "$UPLOADS_DIR" ]; then
    echo "   Creando $UPLOADS_DIR..."
    mkdir -p "$UPLOADS_DIR"
    echo -e "   ${GREEN}✓${NC} Directorio creado"
fi

# 2. Crear directorio de plantillas
echo ""
echo "2️⃣  Configurando directorio de plantillas..."
if [ ! -d "$TEMPLATES_DIR" ]; then
    echo "   Creando $TEMPLATES_DIR..."
    mkdir -p "$TEMPLATES_DIR"
    echo -e "   ${GREEN}✓${NC} Directorio creado"
fi

# 3. Verificar plantillas
echo ""
echo "3️⃣  Verificando plantillas..."
DOCX_COUNT=$(find "$TEMPLATES_DIR" -maxdepth 1 -name "*.docx" 2>/dev/null | wc -l)
if [ "$DOCX_COUNT" -eq 0 ]; then
    echo -e "   ${YELLOW}⚠${NC}  No se encontraron archivos .docx en $TEMPLATES_DIR"
    echo "   Asegúrate de copiar las plantillas (1.docx, 2.docx, etc.) a este directorio"
else
    echo -e "   ${GREEN}✓${NC} Encontradas $DOCX_COUNT plantillas .docx"
    echo "   Archivos:"
    find "$TEMPLATES_DIR" -maxdepth 1 -name "*.docx" -exec basename {} \; | sort -V | head -10 | sed 's/^/      - /'
fi

# 4. Configurar permisos
echo ""
echo "4️⃣  Configurando permisos..."
echo ""
echo "   Selecciona una opción:"
echo "   1) chown a $DOCKER_UID:$DOCKER_GID (Recomendado - seguro)"
echo "   2) chmod 777 (Rápido - menos seguro)"
echo "   3) chmod 755 para plantillas + chown para uploads (Balanceado)"
echo "   4) Saltar (configurar manualmente)"
echo ""

read -p "   Opción [1-4]: " option

case $option in
    1)
        echo ""
        echo "   Aplicando chown $DOCKER_UID:$DOCKER_GID..."
        if [ "$(id -u)" -ne 0 ]; then
            echo "   Se requiere sudo..."
            sudo chown -R "$DOCKER_UID:$DOCKER_GID" "$UPLOADS_DIR"
            sudo chown -R "$DOCKER_UID:$DOCKER_GID" "$TEMPLATES_DIR"
        else
            chown -R "$DOCKER_UID:$DOCKER_GID" "$UPLOADS_DIR"
            chown -R "$DOCKER_UID:$DOCKER_GID" "$TEMPLATES_DIR"
        fi
        echo -e "   ${GREEN}✓${NC} Permisos aplicados"
        ;;
    2)
        echo ""
        echo "   Aplicando chmod 777..."
        if [ "$(id -u)" -ne 0 ]; then
            sudo chmod -R 777 "$UPLOADS_DIR"
            sudo chmod -R 777 "$TEMPLATES_DIR"
        else
            chmod -R 777 "$UPLOADS_DIR"
            chmod -R 777 "$TEMPLATES_DIR"
        fi
        echo -e "   ${GREEN}✓${NC} Permisos aplicados"
        echo -e "   ${YELLOW}⚠${NC}  Advertencia: 777 es menos seguro"
        ;;
    3)
        echo ""
        echo "   Aplicando chmod 755 (plantillas) + chown (uploads)..."
        if [ "$(id -u)" -ne 0 ]; then
            sudo chmod -R 755 "$TEMPLATES_DIR"
            sudo chown -R "$DOCKER_UID:$DOCKER_GID" "$UPLOADS_DIR"
        else
            chmod -R 755 "$TEMPLATES_DIR"
            chown -R "$DOCKER_UID:$DOCKER_GID" "$UPLOADS_DIR"
        fi
        echo -e "   ${GREEN}✓${NC} Permisos aplicados"
        ;;
    4)
        echo ""
        echo -e "   ${YELLOW}⚠${NC}  Saltado. Configura permisos manualmente:"
        echo "      sudo chown -R $DOCKER_UID:$DOCKER_GID $UPLOADS_DIR"
        echo "      sudo chown -R $DOCKER_UID:$DOCKER_GID $TEMPLATES_DIR"
        ;;
    *)
        echo ""
        echo -e "   ${RED}✗${NC} Opción inválida"
        exit 1
        ;;
esac

# 5. Verificación final
echo ""
echo "5️⃣  Verificación final..."
echo ""
check_permissions "$UPLOADS_DIR"
check_permissions "$TEMPLATES_DIR"

# 6. SELinux (solo en Fedora/RHEL)
if command -v getenforce &> /dev/null; then
    SELINUX_STATUS=$(getenforce 2>/dev/null || echo "Disabled")
    if [ "$SELINUX_STATUS" != "Disabled" ]; then
        echo ""
        echo "6️⃣  SELinux detectado ($SELINUX_STATUS)..."
        echo "   El flag :Z en docker-compose.yaml debería manejarlo automáticamente"
        echo "   Si hay problemas, ejecuta:"
        echo "      sudo chcon -Rt container_file_t $UPLOADS_DIR"
        echo "      sudo chcon -Rt container_file_t $TEMPLATES_DIR"
    fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Setup completado${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Próximos pasos:"
echo ""
echo "   1. Verificar que .env está configurado:"
echo "      cat .env | grep PESV_"
echo ""
echo "   2. Construir las imágenes:"
echo "      docker-compose build"
echo ""
echo "   3. Iniciar los servicios:"
echo "      docker-compose up -d"
echo ""
echo "   4. Verificar los mounts:"
echo "      docker-compose exec api ls -la /app/uploads/"
echo "      docker-compose exec api ls -la /app/uploads/Pasos_pesv_templates/"
echo ""
echo "   5. Ver logs:"
echo "      docker-compose logs -f api"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

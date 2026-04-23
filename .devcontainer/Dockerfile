# --- Configuración de Devcontainer ---
FROM node:20-bookworm AS development

# Actualizar sistema e instalar dependencias base
RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y --no-install-recommends \
    openssl \
    procps \
    git \
    sudo \
    bash \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Crear usuario node con permisos
RUN mkdir -p /home/node/.config /home/node/.ssh /home/node/.vscode-server && \
    chown -R node:node /home/node

# Cambiar a usuario node
USER node

# Establecer directorio de trabajo
WORKDIR /workspace

# Mantener el contenedor ejecutándose para devcontainer
CMD ["sleep", "infinity"]

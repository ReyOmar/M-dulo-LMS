#!/bin/bash

# Poner en marcha el proyecto en el devcontainer unificado
set -euo pipefail

ROOT=/workspace

sudo chown -R node:node /workspace/node_modules /app/uploads

# Asegurar .env base dentro del repo raíz y apps
cp "$ROOT/.env" "$ROOT/apps/api/.env"

cd "$ROOT"

# Instalar dependencias y generar Prisma client
pnpm install
pnpm --filter api exec prisma generate

echo "Post-create completed"

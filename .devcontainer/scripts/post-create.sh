#!/bin/bash

# Poner en marcha el proyecto en el devcontainer unificado
set -euo pipefail

ROOT=/workspace

sudo chmod +x "$ROOT/.devcontainer/scripts/prepare_deployment.sh"
sudo chown -R node:node /workspace/apps/api/node_modules /workspace/apps/api/generated /workspace/apps/client/node_modules /app/uploads

# Asegurar .env base dentro del repo raíz y apps
cp "$ROOT/.env" "$ROOT/apps/api/.env"

cd "$ROOT"

# Instalar dependencias raíz (concurrently, etc.) si procede
npm run init
npm run prisma:migrate:deploy --prefix apps/api
npm run prisma:seed --prefix apps/api

echo "Post-create completed"

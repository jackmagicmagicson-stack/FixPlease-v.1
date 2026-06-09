#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [[ ! -f nginx/certs/cert.pem ]]; then
  echo "Generating self-signed TLS certificates..."
  bash scripts/gen-certs.sh
fi

if [[ ! -f .env ]]; then
  echo "Creating .env from .env.example..."
  cp .env.example .env
fi

echo "Starting FixPlease stack (API + PostgreSQL + nginx)..."
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build

echo ""
echo "Waiting for API..."
for i in {1..30}; do
  if curl -sf http://127.0.0.1:8080/health >/dev/null 2>&1; then
    echo "API is ready: http://127.0.0.1:8080"
    echo "HTTPS (nginx): https://127.0.0.1 (accept self-signed cert in browser)"
  echo ""
  echo "In the desktop app Settings, set server URL to:"
  echo "  http://127.0.0.1:8080"
  echo ""
  echo "Admin password (cabinet): see BOOTSTRAP_ADMIN_PASSWORD in deploy/.env"
    exit 0
  fi
  sleep 2
done

echo "API did not become ready in time. Check logs:"
echo "  docker compose -f docker-compose.yml -f docker-compose.dev.yml logs api"
exit 1

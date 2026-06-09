#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)/nginx/certs"
mkdir -p "$DIR"
openssl req -x509 -newkey rsa:4096 -keyout "$DIR/key.pem" -out "$DIR/cert.pem" -days 3650 -nodes -subj "/CN=fixplease-local"

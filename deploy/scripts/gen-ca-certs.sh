#!/usr/bin/env bash
set -euo pipefail

LAN_IP="${LAN_IP:-192.168.0.173}"
DNS_NAMES="${DNS_NAMES:-fixplease.lan,localhost}"
FORCE="${FORCE:-0}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$DEPLOY_DIR/.." && pwd)"
CERT_DIR="$DEPLOY_DIR/nginx/certs"
DESKTOP_CA="$REPO_ROOT/apps/desktop/src-tauri/certs/fixplease-ca.cer"

mkdir -p "$CERT_DIR" "$(dirname "$DESKTOP_CA")"

ca_key="$CERT_DIR/ca.key.pem"
ca_crt="$CERT_DIR/ca.crt.pem"
server_key="$CERT_DIR/key.pem"
server_crt="$CERT_DIR/cert.pem"

have_ca=0
have_server=0
[[ -f "$ca_key" && -f "$ca_crt" ]] && have_ca=1
[[ -f "$server_key" && -f "$server_crt" ]] && have_server=1

if [[ "$have_ca" == 1 && "$have_server" == 1 && "$FORCE" != 1 ]]; then
  echo "Сертификаты CA + сервер уже есть: $CERT_DIR"
else
  if [[ "$have_ca" != 1 || "$FORCE" == 1 ]]; then
    echo "Создание корневого CA FixPlease LAN..."
    openssl genrsa -out "$ca_key" 4096
    openssl req -x509 -new -nodes -key "$ca_key" -sha256 -days 3650 \
      -out "$ca_crt" -subj "/CN=FixPlease LAN CA/O=MITA/C=RU"
  fi

  ext_file="$(mktemp)"
  {
    echo "authorityKeyIdentifier=keyid,issuer"
    echo "basicConstraints=CA:FALSE"
    echo "keyUsage = digitalSignature, keyEncipherment"
    echo "extendedKeyUsage = serverAuth"
    echo "subjectAltName = @alt_names"
    echo ""
    echo "[alt_names]"
    i=1
    IFS=',' read -ra DNS_ARR <<< "$DNS_NAMES"
    for dns in "${DNS_ARR[@]}"; do
      echo "DNS.$i = $dns"
      i=$((i + 1))
    done
    echo "IP.1 = $LAN_IP"
    echo "IP.2 = 127.0.0.1"
  } > "$ext_file"

  echo "Создание серверного сертификата (SAN: $LAN_IP, $DNS_NAMES)..."
  openssl genrsa -out "$server_key" 4096
  openssl req -new -key "$server_key" -out "$CERT_DIR/server.csr.pem" \
    -subj "/CN=fixplease.lan/O=MITA/C=RU"
  openssl x509 -req -in "$CERT_DIR/server.csr.pem" -CA "$ca_crt" -CAkey "$ca_key" \
    -CAcreateserial -out "$server_crt" -days 3650 -sha256 -extfile "$ext_file"
  rm -f "$ext_file" "$CERT_DIR/server.csr.pem" "$CERT_DIR/ca.srl"
  echo "Созданы: ca.crt.pem, ca.key.pem, cert.pem, key.pem"
fi

echo "Экспорт CA для клиентов (DER)..."
openssl x509 -in "$ca_crt" -outform DER -out "$DESKTOP_CA"
echo "CA для установщика: $DESKTOP_CA"

# FixPlease server stack (Windows Server / Docker)
$ErrorActionPreference = "Stop"
$DeployDir = Split-Path -Parent $PSScriptRoot
Set-Location $DeployDir

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Warning "Создан deploy/.env из примера — задайте JWT_SECRET и BOOTSTRAP_ADMIN_PASSWORD."
}

$certDir = Join-Path $DeployDir "nginx\certs"
$certPem = Join-Path $certDir "cert.pem"
$keyPem = Join-Path $certDir "key.pem"
if (-not ((Test-Path $certPem) -and (Test-Path $keyPem))) {
    Write-Host "Генерация TLS: CA + серверный сертификат для LAN..."
    & (Join-Path $PSScriptRoot "gen-ca-certs.ps1")
}

Write-Host "Сборка и запуск контейнеров..."
docker compose -f docker-compose.yml -f docker-compose.server.yml up -d --build

$port = (Get-Content ".env" | Where-Object { $_ -match '^HTTPS_PORT=' }) -replace 'HTTPS_PORT=', ''
if (-not $port) { $port = "8443" }

Write-Host "Ожидание готовности API..."
$deadline = (Get-Date).AddMinutes(5)
do {
    try {
        $r = Invoke-WebRequest -Uri "https://localhost:$port/health" -SkipCertificateCheck -UseBasicParsing -TimeoutSec 5
        if ($r.Content -eq "ok") {
            Write-Host "OK: https://localhost:$port/health -> ok"
            Write-Host "Для клиентов в LAN: https://192.168.0.173:$port"
            exit 0
        }
    } catch {
        Start-Sleep -Seconds 3
    }
} while ((Get-Date) -lt $deadline)

Write-Error "Health-check не прошёл. Логи: docker compose logs api"
exit 1

param(
    [string]$LanIp = "192.168.0.173",
    [string[]]$DnsNames = @("fixplease.lan", "localhost"),
    [switch]$Force
)

$ErrorActionPreference = "Stop"

function To-WslPath([string]$Path) {
    $resolved = (Resolve-Path $Path).Path
    $drive = $resolved.Substring(0, 1).ToLower()
    $rest = $resolved.Substring(2).Replace('\', '/')
    return "/mnt/$drive$rest"
}

$DeployDir = Split-Path -Parent $PSScriptRoot
$CertDir = Join-Path $DeployDir "nginx\certs"
$RepoRoot = Split-Path -Parent $DeployDir
$DesktopCa = Join-Path $RepoRoot "apps\desktop\src-tauri\certs\fixplease-ca.cer"

New-Item -ItemType Directory -Force -Path $CertDir | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path $DesktopCa) | Out-Null

$caKey = Join-Path $CertDir "ca.key.pem"
$caCrt = Join-Path $CertDir "ca.crt.pem"
$serverKey = Join-Path $CertDir "key.pem"
$serverCrt = Join-Path $CertDir "cert.pem"
$serverCsr = Join-Path $CertDir "server.csr.pem"
$serverExt = Join-Path $CertDir "server.ext"
$caSerial = Join-Path $CertDir "ca.srl"

$haveCa = (Test-Path $caKey) -and (Test-Path $caCrt)
$haveServer = (Test-Path $serverKey) -and (Test-Path $serverCrt)

if ($haveCa -and $haveServer -and -not $Force) {
    Write-Host "CA and server certs already exist: $CertDir"
}
else {
    $wslCert = To-WslPath $CertDir

    if (-not $haveCa -or $Force) {
        Write-Host "Creating FixPlease LAN root CA..."
        wsl openssl genrsa -out "$wslCert/ca.key.pem" 4096
        wsl openssl req -x509 -new -nodes -key "$wslCert/ca.key.pem" -sha256 -days 3650 `
            -out "$wslCert/ca.crt.pem" -subj "/CN=FixPlease LAN CA/O=MITA/C=RU"
    }

    $extLines = @(
        "authorityKeyIdentifier=keyid,issuer",
        "basicConstraints=CA:FALSE",
        "keyUsage = digitalSignature, keyEncipherment",
        "extendedKeyUsage = serverAuth",
        "subjectAltName = @alt_names",
        "",
        "[alt_names]"
    )
    $dnsIdx = 1
    foreach ($dns in $DnsNames) {
        $extLines += "DNS.$dnsIdx = $dns"
        $dnsIdx++
    }
    $extLines += "IP.1 = $LanIp"
    $extLines += "IP.2 = 127.0.0.1"
    Set-Content -Path $serverExt -Value $extLines -Encoding ascii

    Write-Host "Creating server cert (SAN: $LanIp, $($DnsNames -join ', '))..."
    wsl openssl genrsa -out "$wslCert/key.pem" 4096
    wsl openssl req -new -key "$wslCert/key.pem" -out "$wslCert/server.csr.pem" `
        -subj "/CN=fixplease.lan/O=MITA/C=RU"
    wsl openssl x509 -req -in "$wslCert/server.csr.pem" -CA "$wslCert/ca.crt.pem" `
        -CAkey "$wslCert/ca.key.pem" -CAcreateserial -out "$wslCert/cert.pem" `
        -days 3650 -sha256 -extfile "$wslCert/server.ext"

    Remove-Item -Force -ErrorAction SilentlyContinue $serverCsr, $serverExt, $caSerial
    Write-Host "Created: ca.crt.pem, ca.key.pem, cert.pem, key.pem"
}

Write-Host "Exporting CA for client installer (DER)..."
$wslCert = To-WslPath $CertDir
$wslDesktop = To-WslPath (Split-Path $DesktopCa)
$wslDesktopFile = "$wslDesktop/fixplease-ca.cer"
wsl openssl x509 -in "$wslCert/ca.crt.pem" -outform DER -out $wslDesktopFile

Write-Host "Client CA bundle: $DesktopCa"
Write-Host "Restart nginx after cert change: docker compose restart nginx"

# Обратная совместимость: делегируем в gen-ca-certs.ps1
& (Join-Path $PSScriptRoot "gen-ca-certs.ps1") @args

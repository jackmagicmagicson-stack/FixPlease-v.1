!macro NSIS_HOOK_POSTINSTALL
  DetailPrint "Установка корневого сертификата FixPlease LAN..."
  ${If} ${FileExists} "$INSTDIR\resources\certs\fixplease-ca.cer"
    nsExec::ExecToLog 'certutil -addstore -f "Root" "$INSTDIR\resources\certs\fixplease-ca.cer"'
    Pop $0
    ${If} $0 == 0
      DetailPrint "Сертификат FixPlease LAN CA установлен."
    ${Else}
      DetailPrint "certutil вернул код $0 (возможно, сертификат уже установлен)."
    ${EndIf}
  ${Else}
    DetailPrint "Файл CA не найден в resources\certs\fixplease-ca.cer"
  ${EndIf}
!macroend

# Деплой FixPlease на Windows Server

## Требования

- Windows Server с Docker (WSL2 backend)
- Статический LAN IP, проброс порта 443 на хост
- Firewall: доступ только из VLAN офиса

## Установка

1. Скопируйте репозиторий на сервер.
2. Сгенерируйте TLS-сертификаты (или замените на корпоративные):

```bash
cd deploy/scripts
bash gen-certs.sh
```

3. Создайте `.env` из примера:

```bash
cp deploy/.env.example deploy/.env
# Обязательно задайте JWT_SECRET и BOOTSTRAP_ADMIN_PASSWORD
```

4. Запуск:

```bash
cd deploy
docker compose up -d --build
```

5. Проверка: `curl -k https://localhost/health`

## Безопасность

Production `docker-compose.yml` задаёт `FIXPLEASE_STRICT_CONFIG=1`. API **не запустится**, если:

- `JWT_SECRET` не задан или равен дефолтному значению
- `BOOTSTRAP_ADMIN_PASSWORD` не задан

Для локальной разработки используйте `./up.sh` (без strict) или `docker-compose.dev.yml`.

## Порты

| Сервис | Порт |
|--------|------|
| nginx (HTTPS) | 443 |
| API (внутренний) | 8080 |
| PostgreSQL | 5432 (только docker network) |

## Данные

- PostgreSQL volume: `pgdata`
- Вложения: volume `attachments` → `/data/attachments` в контейнере API

## Резервное копирование (ежемесячно)

```bash
./deploy/scripts/backup.sh /path/to/backups/2025-06
```

Скопируйте также docker volume вложений в ту же папку.

## Обновление сервера

```bash
cd deploy
docker compose pull
docker compose up -d --build
```

## Обновление клиентов

1. Соберите и подпишите MSI в GitHub Actions (секрет `TAURI_SIGNING_PRIVATE_KEY`).
2. Разместите установщик по HTTPS (корпоративный файловый сервер или GitHub Releases).
3. В кабинете админа: **Настройки → Манифест обновления** — укажите:
   - `client_update_version` — версия релиза (например `0.2.0`)
   - `client_update_url` — прямой HTTPS URL на `.msi` или `.nsis.zip`
   - `client_update_signature` — полное содержимое `.sig` файла из сборки
4. При необходимости увеличьте **Минимальная версия клиента**, чтобы заблокировать старые установки.

## Smoke-тест

После деплоя (с пробросом 8080 или через nginx):

```bash
TEST_API_URL=https://<LAN-IP> ./scripts/smoke_test.sh 50
```

## Клиенты

Раздайте MSI/EXE из GitHub Actions artifacts. В первом запуске укажите `https://<ваш-LAN-IP>`.

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
# Отредактируйте JWT_SECRET и BOOTSTRAP_ADMIN_PASSWORD
```

4. Запуск:

```bash
cd deploy
docker compose up -d --build
```

5. Проверка: `curl -k https://localhost/health`

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

## Обновление

```bash
cd deploy
docker compose pull
docker compose up -d --build
```

Увеличьте `min_client_version` в `app_settings` после раскатки новых клиентов.

## Клиенты

Раздайте MSI/EXE из GitHub Actions artifacts. В первом запуске укажите `https://<ваш-LAN-IP>`.

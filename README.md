# FixPlease

Desktop-приложение тикетов для локальной сети: Tauri + React (клиент), Rust/Axum + PostgreSQL (сервер в Docker).

## Структура

- `apps/desktop` — клиент Tauri 2 + React
- `services/api` — REST API и WebSocket
- `migrations` — SQL-миграции
- `deploy` — Docker Compose, nginx, скрипты

## Быстрый старт (разработка)

### Сервер (Docker)

```bash
cd deploy
./up.sh          # сертификаты, .env, build, запуск
./down.sh        # остановить
```

API: `http://127.0.0.1:8080` (dev) или `https://<IP-сервера>` через nginx.

В приложении: **Настройки → URL сервера →** `http://127.0.0.1:8080` → **Сохранить**, затем на вкладке **Создать** появятся категории.

Пароль админа задаётся в `deploy/.env` (`BOOTSTRAP_ADMIN_PASSWORD`, сейчас `admin3`).

### API локально без Docker

```bash
export DATABASE_URL=postgres://fixplease:fixplease@localhost:5432/fixplease
cargo run -p fixplease-api
```

### Клиент

```bash
cd apps/desktop
npm install
npm run tauri dev
```

В настройках укажите URL сервера (например `https://<LAN-IP>`).

## Сборка Windows (CI)

См. `.github/workflows/build.yml` — артефакты MSI/EXE на push.

## Документация

- [deploy/README.md](deploy/README.md) — деплой на Windows Server
- [docs/admin-guide.md](docs/admin-guide.md) — руководство администратора

## MVP

- Сотрудник: заявка, черновик, статус по номеру, чат, вложения (до 3)
- Админ: очередь realtime, взять в работу, статусы, отклонение/закрытие, категории/шаблоны, статистика
- Эскалация, retention 45 дней, HTTPS, уведомления (без звука)

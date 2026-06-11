# FixPlease

Система заявок в IT для локальной сети офиса: сотрудники создают тикеты, администраторы обрабатывают их в реальном времени.

**Стек:** Tauri 2 + React (десктоп-клиент), Rust/Axum + PostgreSQL (сервер в Docker), nginx с HTTPS.

---

## Возможности

| Роль | Функции |
|------|---------|
| **Сотрудник** | Создание заявки, черновик, отслеживание по номеру, чат с админом, до 3 вложений |
| **Администратор** | Очередь в реальном времени, взять в работу, статусы, отклонение/закрытие, категории и шаблоны, отчёты |
| **Система** | Эскалация просроченных заявок, хранение 45 дней, HTTPS, push-уведомления |

---

## Структура репозитория

```
FixPlease-v.1/
├── apps/desktop/     # Клиент Tauri 2 + React
├── services/api/     # REST API и WebSocket
├── migrations/       # SQL-миграции PostgreSQL
├── deploy/           # Docker Compose, nginx, скрипты деплоя
├── docs/             # Руководство администратора, чеклист приёмки
└── scripts/          # Smoke-тесты
```

Чеклист приёмки MVP: [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md).

---

## Требования

### Сервер (один компьютер в сети)

- Docker и Docker Compose
- Статический IP в LAN (для клиентов)
- Порт **443** (HTTPS) открыт для рабочих мест офиса

Подходит **Windows Server** (Docker через WSL2), **Linux** или **macOS** (для разработки и тестов).

### Рабочие места (клиент)

- **Windows 10/11** — готовый установщик из [Releases](https://github.com/jackmagicmagicson-stack/FixPlease-v.1/releases) (MSI/EXE)
- Для сборки из исходников: Node.js 20+, Rust stable, зависимости Tauri ([документация Tauri](https://v2.tauri.app/start/prerequisites/))

---

## Установка сервера (продакшен)

Один раз на сервере в офисе.

### 1. Клонировать репозиторий

```bash
git clone https://github.com/jackmagicmagicson-stack/FixPlease-v.1.git
cd FixPlease-v.1/deploy
```

### 2. Настроить переменные окружения

```bash
cp .env.example .env
```

Откройте `.env` и **обязательно** измените:

| Переменная | Описание |
|------------|----------|
| `JWT_SECRET` | Длинная случайная строка (секрет для сессий) — **обязательно** |
| `BOOTSTRAP_ADMIN_PASSWORD` | Пароль входа в кабинет администратора — **обязательно** |
| `HTTPS_PORT` | Порт HTTPS (по умолчанию `443`) |

В production Docker Compose включён `FIXPLEASE_STRICT_CONFIG=1`: API не стартует с дефолтными секретами.

### 3. TLS-сертификаты

Для LAN с самоподписанным сертификатом:

```bash
bash scripts/gen-certs.sh
```

Для продакшена можно положить корпоративные сертификаты в `deploy/nginx/certs/` (`cert.pem`, `key.pem`).

### 4. Запуск

```bash
docker compose up -d --build
```

Проверка:

```bash
curl -k https://localhost/health
# ответ: ok
```

### 5. Firewall

Разрешите входящие подключения на порт **443** только из VLAN офиса.

### 6. Адрес для клиентов

Клиенты подключаются по **HTTPS**, не по порту 8080:

```
https://<IP-сервера-в-LAN>
```

Пример: `https://192.168.1.50`

> Порт 8080 используется **только внутри Docker** и в режиме локальной разработки.

Подробнее: [deploy/README.md](deploy/README.md).

---

## Установка для разработки (macOS / Linux)

### 1. Запустить сервер с пробросом порта 8080

```bash
cd deploy
./up.sh
```

Скрипт создаст `.env` и сертификаты при первом запуске, соберёт контейнеры и дождётся готовности API.

| Режим | URL для клиента |
|-------|-----------------|
| Локальная разработка | `http://127.0.0.1:8080` |
| HTTPS через nginx | `https://127.0.0.1` |

Остановка:

```bash
./down.sh
```

### 2. Запустить клиент

```bash
cd apps/desktop
npm install
npm run tauri dev
```

### 3. Настроить подключение в приложении

1. Откройте **Настройки**
2. **Адрес сервера:** `http://127.0.0.1:8080`
3. Нажмите **Сохранить**
4. Индикатор в шапке должен стать зелёным: **«Сервер»**

Пароль администратора — значение `BOOTSTRAP_ADMIN_PASSWORD` из `deploy/.env` (по умолчанию в примере: `admin3`).

### API без Docker (опционально)

```bash
# PostgreSQL должен быть доступен локально
export DATABASE_URL=postgres://fixplease:fixplease@localhost:5432/fixplease
cargo run -p fixplease-api
```

---

## Установка клиента на рабочие места

### Вариант A — готовый установщик (рекомендуется)

1. Откройте [Releases](https://github.com/jackmagicmagicson-stack/FixPlease-v.1/releases)
2. Скачайте `.msi` или `.exe` для Windows
3. Установите на каждый компьютер офиса
4. При первом запуске: **Настройки → Адрес сервера** → `https://<IP-сервера>` → **Сохранить**

> Обычно адрес сервера настраивает IT один раз; при необходимости его можно изменить в **Настройки → Адрес сервера**.

### Вариант B — сборка из исходников

```bash
cd apps/desktop
npm install
npm run tauri build
```

Артефакты: `apps/desktop/src-tauri/target/release/bundle/` (MSI, NSIS).

На push в `main` Windows-сборка также запускается в GitHub Actions (см. `.github/workflows/build.yml`).

### Автообновление клиента

1. Сгенерируйте ключ подписи (один раз): `npx tauri signer generate --ci -p "" -w deploy/fixplease.key`
2. Публичный ключ уже прописан в `apps/desktop/src-tauri/tauri.conf.json`.
3. В CI добавьте GitHub Secret `TAURI_SIGNING_PRIVATE_KEY` (содержимое `deploy/fixplease.key`).
4. После сборки релиза в **Настройки → Манифест обновления** укажите версию, HTTPS URL установщика и содержимое `.sig` файла.

Клиент проверяет обновления через `https://<сервер>/v1/updater/...` (кнопка «Проверить обновления»).

---

## Первый запуск

1. **Сервер** — убедитесь, что `curl -k https://<IP>/health` возвращает `ok`
2. **Клиент** — укажите URL сервера в настройках
3. **Сотрудник** — вкладка **Создать**: выберите категорию, опишите проблему
4. **Администратор** — **Кабинет админа** → пароль из `BOOTSTRAP_ADMIN_PASSWORD` → **Очередь**

Руководство администратора: [docs/admin-guide.md](docs/admin-guide.md).

---

## Решение проблем

### «Нет связи» / не удалось подключиться к серверу

| Симптом | Причина | Решение |
|---------|---------|---------|
| Адрес `http://127.0.0.1:8080`, сервер в Docker **без** dev-оверлея | Порт 8080 не проброшен на хост | Запустите `./up.sh` или `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d` |
| Адрес `http://127.0.0.1:8080` на рабочем месте, сервер на другом ПК | Неверный протокол/порт | Используйте `https://<IP-сервера>` |
| Сервер запущен, но health не отвечает | Контейнеры не поднялись | `docker compose logs api` в каталоге `deploy/` |

Проверка с компьютера клиента:

```bash
curl -k https://<IP-сервера>/health
```

### «internal error» на вкладке «Отчёты»

Обновите сервер до актуальной версии из репозитория и пересоберите API:

```bash
cd deploy
docker compose up -d --build api
```

### Сессия администратора истекла

Войдите в кабинет снова — пароль из `BOOTSTRAP_ADMIN_PASSWORD`.

---

## Тестирование

```bash
# API unit + DB тесты (нужен PostgreSQL)
DATABASE_URL=postgres://fixplease:fixplease@localhost:5432/fixplease cargo test -p fixplease-api

# Smoke (API должен быть запущен)
./scripts/smoke_test.sh 50
```

В CI job `api` smoke и WebSocket-тест запускаются автоматически.

---

## Резервное копирование

Ежемесячно (см. [deploy/README.md](deploy/README.md)):

- дамп PostgreSQL (`pgdata` volume)
- каталог вложений (`attachments` volume)

---

## Лицензия и поддержка

Проект MITA / внутреннее использование офиса. Вопросы и доработки — через Issues в репозитории.

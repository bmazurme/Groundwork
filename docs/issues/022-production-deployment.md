# Issue 022: Нет рабочего production-развёртывания: образ фронтенда не умеет проксировать `/api`, нет stack-файла и секретов

**Метки:** devops, frontend, backend, security

## Проблема
- `apps/frontend/Dockerfile`, стадия `production`: `nginx:alpine` отдаёт статические файлы без собственной конфигурации. Фронтенд обращается к относительным путям `/api/...` (`api/client.ts`); в dev их проксирует Vite (`vite.config.ts`, `API_PROXY_TARGET`), а в production такого прокси нет. Образ, собранный из стадии `production`, откроет страницу, но каждый запрос к API вернёт 404 от nginx. Нет и SPA-фоллбэка (`try_files`), сжатия, заголовков кеширования для хешированных ассетов.
- README обещает «eventual Docker Swarm deployment (stack file)», а в разделе «Current state» пункт про stack-файл числится нереализованным. В `docker-compose.yml` пароли (`groundwork-secret`, `groundwork`) и `latest`-образ MinIO записаны открытым текстом, у `backend` и `frontend` нет `healthcheck`, у стадии `production` бэкенда нет `HEALTHCHECK`.
- Бэкенд в production при старте скачивает ONNX-модель в каталог внутри контейнера (если `TRANSFORMERS_CACHE_DIR` не смонтирован), что удлиняет старт и ломается без исходящего интернета.
- `FRONTEND_ORIGIN` задаёт единственный origin для CORS; при размещении за одним reverse proxy (одинаковый origin) CORS не нужен вовсе, но это нигде не описано.

## Предложение
- `apps/frontend/nginx.conf`: `location /api/ { proxy_pass http://$API_UPSTREAM; }` (через шаблон `/etc/nginx/templates/default.conf.template` и переменную `API_UPSTREAM`, которую `nginx:alpine` подставляет сам), `location / { try_files $uri /index.html; }`, `gzip on`, `Cache-Control: immutable` для `/assets/`, `no-cache` для `index.html`. Для SSE-стрима (будущий LLM-синтез, п. 5 `IMPROVEMENTS.md`) сразу задать `proxy_buffering off` на отдельном `location`.
- `docker-stack.yml` для Swarm: сервисы `backend` (реплики 2, `update_config: order: start-first`), `frontend`, `postgres`, `redis`, `minio`; пароли через `secrets:` и чтение из `*_FILE`-переменных (небольшая функция `readSecret(name)` в бэкенде: если задан `${NAME}_FILE`, читать файл), именованные тома, `healthcheck` для всех сервисов, ограничения ресурсов, фиксированные теги образов (согласуется с Issue 010).
- `HEALTHCHECK` в стадии `production` бэкенда (запрос к `/api/health`; `node:22-slim` не содержит `curl`, поэтому использовать `node -e "fetch(...)"`).
- Модель ONNX: либо печь в образ на стадии `build` (больше образ, но офлайн и быстрый старт), либо смонтированный том (как в compose); выбор описать в README. Рекомендация: том, образ остаётся компактным.
- Раздел README «Deployment»: порядок выкатки (миграции из `IMPROVEMENTS.md` п. 4 — отдельной задачей до старта новых реплик), список обязательных переменных, пример `docker stack deploy`.

## Критерии приёмки
- `docker build --target production` для обоих приложений, затем запуск через `docker compose -f docker-compose.prod.yml` (или stack-файл на одиночном узле Swarm): `curl localhost/api/health` через nginx возвращает `status: ok`, страница открывается, загрузка файла и поиск работают без Vite.
- Прямое открытие `/some/spa/route` отдаёт `index.html`, а `/api/unknown` — 404 от бэкенда, не от SPA-фоллбэка.
- В репозитории нет паролей в `docker-stack.yml`; `docker stack config` не показывает их в открытом виде.
- Проверка в CI: сборка production-образов (без запуска стека) как отдельный job; изменения `.github/workflows/` в этом Issue описываются, а вносит их владелец.

## Контракт
`/api` не меняется. Добавляются файлы развёртывания и необязательные переменные `*_FILE`; значения по умолчанию сохраняют текущее dev-поведение.

## Связь
Issue 003 (readiness для `start-first`), 010 (закрепление тегов, CI), 012 (метрики/логи для стека), `IMPROVEMENTS.md` п. 4.

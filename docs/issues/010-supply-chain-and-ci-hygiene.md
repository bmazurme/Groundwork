# Issue 010: Гигиена зависимостей и CI: образ `latest`, нет `npm audit`/Dependabot, медленный e2e без кеша модели

**Метки:** ci, security, devex

## Проблема
Найдено чтением `docker-compose.yml`, `.github/workflows/ci.yml`, `package.json`:
- `minio` запущен с образом `cgr.dev/chainguard/minio:latest` — неповторяемая сборка, обновление образа может сломать CI без изменений в коде. Остальные образы закреплены только мажорным тегом (`redis:7-alpine`, `pgvector/pgvector:pg16`).
- В CI нет `npm audit`, нет Dependabot/Renovate. Правило проекта «проверять npm audit для новых пакетов» нигде не проверяется автоматически.
- Job `e2e` каждый раз делает `docker compose up --build` и на холодном старте скачивает ONNX-модель (сотни МБ) заново, поэтому ожидание готовности бэкенда (до 5 минут) нестабильно. Том `onnx-model-cache` в `docker compose down -v` удаляется.
- В CI-job `build` Cypress-бинарник ставится `npm ci` без кеша (`~/.cache/Cypress`).
- Учётные данные БД/MinIO прописаны в `docker-compose.yml` (допустимо для dev), но то же самое compose-файл — единственный способ запуска, а production-пути (target `prod` Dockerfile, внешние секреты) в README не описан.

## Предложение
- Закрепить образы по версии (и при желании по digest): `minio` — конкретный тег; в README объяснить обновление.
- Добавить `.github/dependabot.yml` (npm, docker, github-actions; раз в неделю, группировка minor/patch).
- Добавить в CI шаг `npm audit --omit=dev --audit-level=high` (сначала как non-blocking, затем blocking после очистки текущих находок).
- Кешировать модель ONNX в CI через `actions/cache` (каталог, смонтированный как `TRANSFORMERS_CACHE_DIR`) и Cypress-бинарник; не использовать `down -v` до сохранения кеша.
- Добавить в README короткий раздел «Production deployment»: какой Docker target, какие env обязательны, как подставить секреты.

Примечание: изменения в `.github/workflows/` публикуются владельцем вручную (автоматическая публикация эти файлы не включает), поэтому в PR предлагается только текст изменений.

## Критерии приёмки
- Образы в compose зафиксированы, холодный `docker compose up` на чистой машине воспроизводим.
- Dependabot открывает PR по зависимостям; `npm audit` отражён в CI.
- Время `e2e` с тёплым кешем модели заметно меньше (замерить до/после и записать числа в PR).

## Риски
Низкие. Dependabot может создать много PR на старте, поэтому нужна группировка и лимит `open-pull-requests-limit`.

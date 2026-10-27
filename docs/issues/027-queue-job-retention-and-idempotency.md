# Issue 027: Очередь BullMQ: хранение завершённых заданий, таймауты блокировки, идемпотентность

**Метки:** reliability, backend, ops

## Проблема
`queue/queue.module.ts` вызывает `BullModule.forRoot` только с параметрами подключения, а `documents.service.ts` делает `queue.add('process', { documentId })` без опций. Из этого следует (по документации BullMQ; не замерялось):
- **Redis растёт без границ.** По умолчанию BullMQ хранит все завершённые и упавшие задания (`removeOnComplete` и `removeOnFail` выключены). Каждая загрузка и каждая повторная индексация оставляет запись в Redis навсегда. В `docker-compose.yml` Redis без `maxmemory` и персистентность не настроена явно, поэтому на длинной дистанции возможна нехватка памяти, а при потере тома Redis пропадают и невыполненные задания (см. Issue 003, зависшие документы).
- **Блокировка задания и долгая индексация.** Воркер держит блокировку на 30 с по умолчанию и продлевает её, пока event loop не заблокирован. Эмбеддинги из `onnxruntime` (синхронные вызовы в одном потоке) и парсинг больших PDF могут надолго занять event loop. Тогда блокировка не продлевается, задание считается «stalled» и запускается повторно, а исходное продолжает работу: два воркера на один документ (усугубляет Issue 026).
- **Ограничение параллелизма не задано явно.** Поведение зависит от умолчаний библиотеки; значение должно быть в env и в README.
- **Нет единого места для опций заданий.** Опции `attempts`/`backoff` из `IMPROVEMENTS.md` (п. 3) нужно будет добавлять в каждый вызов `add`; повторная индексация из Issue 016 и CLI из Issue 014 будут копировать их.

## Предложение
1. Константа `DEFAULT_JOB_OPTIONS` в `queue/queue.constants.ts`, передаваемая в `BullModule.forRoot({ defaultJobOptions })` (или `registerQueue`): `removeOnComplete: { age: 86400, count: 1000 }`, `removeOnFail: { age: 604800, count: 5000 }`, а также `attempts` и `backoff` из п. 3 `IMPROVEMENTS.md`. Значения из env: `QUEUE_KEEP_COMPLETED_SECONDS`, `QUEUE_KEEP_FAILED_SECONDS`.
2. В `@Processor(..., { concurrency, lockDuration })` взять значения из env (`INDEXING_CONCURRENCY=1`, `INDEXING_LOCK_DURATION_MS=120000`). Если стоит `onnx`, пояснить в README, что синхронный инференс блокирует event loop и почему `lockDuration` больше. Для долгих этапов вызывать `job.updateProgress` между чанками (это же даёт прогресс для UI, Issue 016).
3. В `docker-compose.yml`: `redis-server --appendonly yes --maxmemory-policy noeviction` (политика eviction для BullMQ должна быть именно `noeviction`, иначе Redis может выкинуть ключи очереди), том для `/data`.
4. Идемпотентность через `jobId` — в Issue 026, п. 4. Здесь только общая точка: фабрика `enqueueIndexing(documentId, version)` в одном месте.
5. Новых зависимостей нет.

## Критерии приёмки
- После 100 загрузок число ключей `bull:document-processing:*` в Redis не превышает заданные лимиты (проверка вручную через `redis-cli --scan | wc -l` и описание в PR).
- Юнит-тест фабрики опций: значения берутся из env, некорректные значения (`NaN`, отрицательные) дают понятную ошибку при старте.
- Ручная проверка: перезапуск Redis (`docker compose restart redis`) не теряет ожидающие задания.
- Контракт `/api` не меняется.

## Связь
`IMPROVEMENTS.md` п. 3, Issue 003, 011, 014, 016, 026.

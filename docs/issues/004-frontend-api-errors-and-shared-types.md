# Issue 004: Понятные ошибки API во фронтенде и единые типы контракта

**Метки:** frontend, dx

## Проблема
- `frontend/src/api/client.ts` бросает `Error("Request to /x failed with status 500")` и отбрасывает тело ответа Nest (`{message, statusCode}`). Пользователь не видит причину: «Unsupported file type: x.txt» или «Document not found» превращается в «status 400».
- Типы `DocumentRecord`, `SearchResult` и другие описаны дважды: в `frontend/src/api/types.ts` и в бэкенде (`document.entity.ts`, `search.types.ts`). Они расходятся без предупреждения. Следующие изменения контракта (`citations`, стрим ответа, feedback) увеличат риск.
- `fetch` без таймаута и без отмены: при зависшем бэкенде кнопка «Search» крутится бесконечно.

## Предложение
- В клиенте ввести `ApiError` (`status`, `message`, разбор JSON-тела Nest, запасной вариант по тексту статуса). Использовать его в `Alert` и тостах.
- `AbortSignal.timeout` (значение настраиваемое) и отмена предыдущего поиска при новом запросе (`signal` из TanStack Query).
- Вынести общие типы контракта в workspace-пакет `packages/contract` (только `export type`, без рантайма и без новых внешних зависимостей), подключить из `apps/backend` и `apps/frontend`. Альтернатива с меньшим объёмом: тест-«якорь», который падает при расхождении форм. Выбор оставляю владельцу, по умолчанию — пакет.

## Критерии приёмки
- Загрузка `.txt` показывает «Unsupported file type…» из ответа API.
- Юнит-тест клиента (мок `fetch`): тело ошибки Nest, не-JSON ответ, таймаут.
- `npm run build` в обоих workspace проходит с общими типами.

## Контракт
`/api` не меняется. Это изменение фронтенда и структуры монорепо.

# Фаза 0 — Архитектурные решения

> Зафиксированы на основе аудита CortexIDE (2026-05-02, коммит 079043b).

---

## Модель снапшотов

**Решение:** Файловая система через `IFileService`, папка `.vibe/snapshots/`.

**Обоснование:** CortexIDE хранит снапшоты в памяти (`Map<string, Snapshot>`) — теряются при перезапуске. Git refs (`refs/vibe/checkpoint-*`) — более сложны, конфликтуют с submodules и detached HEAD. Файловая персистенция через `IFileService` — проще, надёжнее, кросс-платформенна.

**Формат снапшота:**
```
.vibe/snapshots/
  snapshot-{timestamp}-{id}.json   ← файлы + метаданные
  named/
    {name}.json                    ← именованные чекпоинты
```

**Checkpoint pruning:** дефолт последние 50 + все именованные. Автопрунинг включён. `vibe doctor --full` предупреждает при >500MB.

**Граничные случаи:**
- Лимит 5MB на снапшот (унаследован от CortexIDE) — увеличить до 50MB
- Detached HEAD — снапшот не зависит от git состояния (файловая система)
- `rollbackSnapshotService.ts` — каноничный механизм; `gitAutoStashService.ts` — только для upstream sync

- [x] Решение принято

---

## Vector Store

**Решение:** sqlite-vec как встроенный дефолт. Qdrant/Chroma — опциональные внешние backend-ы.

**Обоснование:** CortexIDE дефолт `none` означает RAG не работает из коробки. sqlite-vec — встроенный, без внешних зависимостей, работает офлайн.

**В privacy-режиме:** embedding-запросы принудительно через локальную Ollama-модель (`nomic-embed-text` или `all-minilm`). Облачный embedding блокируется `offlinePrivacyGate`.

**Настройка:**
```json
{
  "cortexide.vectorStore.provider": "sqlite-vec",   // дефолт
  "cortexide.vectorStore.embeddingModel": "local",  // local | openai | ...
  "cortexide.vectorStore.url": ""                   // только для Qdrant/Chroma
}
```

- [x] Решение принято

> ⚠️ sqlite-vss deprecated с 2024 года — использовать только sqlite-vec.

---

## API Key Encryption

**Решение:** Оставить как есть — `IEncryptionService` использует Electron `safeStorage`.

**Подтверждено аудитом:** `encryptionMainService.ts` вызывает `safeStorage.encryptString()` — macOS Keychain, Windows DPAPI, Linux libsecret. Безопасно.

**Примечание:** `ISecretStorageService` закомментирован в `cortexideSettingsService.ts` — не трогать, текущее решение правильное.

- [x] Решение принято

---

## Audit Log

**Решение:** Оставить как есть — уже асинхронный.

**Подтверждено аудитом:** `RunOnceScheduler` с 100ms debounce, `_pendingWrites` очередь. Не блокирует UI.

**Добавить в Фазе 1:**
- Retention rotation UI (дефолт 30 дней)
- GDPR export + delete
- Поиск и фильтрация

- [x] Решение принято

---

## Secret Detection — порядок операций

**Решение:** `secretDetectionService` запускается в трёх местах:

```
1. FIM autocomplete pipeline (autocompleteService.ts)  ← ДОБАВИТЬ
   prefixAndSuffix → secretDetectionService → LLM provider

2. Smart context picker / contextGatheringService     ← ДОБАВИТЬ
   file content → secretDetectionService → context assembly

3. MCP tool results (уже есть в toolsService.ts:1127)  ← OK
   tool result → secretDetectionService → agent context
```

**Обоснование аудита:** FIM autocomplete отправляет `prefixAndSuffix` без secret detection. Если файл содержит API-ключ — он попадёт в FIM-запрос к провайдеру.

- [x] Решение принято

---

## Privacy Gate / RAG Indexing

**Решение:** Расширить `offlinePrivacyGate` на embedding pipeline.

**Текущее состояние:** Gate проверяет только `navigator.onLine`. Privacy mode обрабатывается на уровне model router. Embedding pipeline не покрыт.

**Добавить в Фазе 1:**
```typescript
// В repoIndexerService.ts и vectorStore.ts:
if (privacyGate.isPrivacyMode() && embeddingProvider !== 'local') {
  throw new Error('Privacy mode: only local embedding models allowed');
}
```

- [x] Решение принято

---

## Constraints Enforcement Layer

**Решение:** Детерминированная sandbox-прослойка **до агента** в IDE.

Агент физически не может записать файл нарушающий constraint — IDE блокирует вызов независимо от промпта.

**Реализация (Фаза 1):**
```typescript
// Перехватчик в fileService.ts или toolsService.ts:
async writeFile(path, content) {
  const violation = constraintsService.check('deny_write', path);
  if (violation) throw new ConstraintViolationError(violation.message);
  return originalWriteFile(path, content);
}
```

- [x] Решение принято

---

## Dead Man's Switch Reset Semantics

**Решение:** DMS таймер сбрасывается ТОЛЬКО при явном Approve action.

**НЕ сбрасывается при:**
- Движении мыши
- Rate limit 429 + retry backoff (отдельный UI-индикатор)
- Режиме ожидания pre-flight plan approval

**Минимальное N:** 1 минута. N=0 = отключение функции.

- [x] Решение принято

---

## Loop Detector Semantics

**Решение:** Цикл = `(тип действия + target)` × 3 подряд ИЛИ повторяющаяся последовательность A→B→A.

**Исключения (не считаются циклом):**
- Auto-repair loop шаги (явно одобрены через Approve / Trust Score = Auto)
- Task decomposition паттерны (шаг N из M)
- CI-режим: цикл только если одинаковый **результат** (те же тесты с той же ошибкой)

- [x] Решение принято

---

## Hot-reload `.vibe/` Policy

**Решение:** Изменения `.vibe/` файлов вступают в силу только при следующем tool-call или явном Reload.

При редактировании `.vibe/` во время активного агента → banner.  
Переключение профиля mid-task → блокирующий диалог.

- [x] Решение принято

---

## `.vibe/` Format Versioning

**Решение:** Поле `"vibeVersion": "1.0.0"` в каждом `.vibe/` файле.

JSON Schema публикуется на GitHub Pages при Фазе 1 релизе.  
`vibe doctor` валидирует все `.vibe/` файлы при старте (≤30мс, non-blocking).  
При несовместимой смене схемы → migration script + блокирующее предупреждение.

- [x] Решение принято

---

## Agent Context Limit Policy

**Решение:** При достижении 90% context limit mid-task агент предлагает:
1. Compact context (суммаризация)
2. Продолжить с риском + предупреждение
3. Отменить + снапшот

Порог настраивается (дефолт 90%). Live-индикатор во время выполнения.

Auto-repair loop → отдельный «repair context budget» чтобы не конкурировать с основным контекстом.

- [x] Решение принято

---

## Provider List Update Strategy

**Решение:** `models.json` хостится на CDN `registry.vibeide.io/models.json`.

- IDE делает GET с ETag кешированием при старте
- Offline fallback — локальный кэш последней успешной загрузки
- Community PRs → отдельный manifest-репо, не в IDE-репо
- Обновление manifest не требует релиза IDE

- [x] Решение принято

---

## AgentToolExecutor Abstraction Layer

**Решение:** Три режима выполнения инструментов:

| Режим | Провайдер | Механизм |
|---|---|---|
| `ptc` | Claude API | Programmatic Tool Calling (`code_execution_20250825`) |
| `parallel` | OpenAI / Gemini | Parallel tool calls |
| `sequential` | Ollama / локальные | Sequential fallback |

Автовыбор через capability probe при первом подключении провайдера.  
Результат кэшируется в `models.json`.

- [x] Решение принято

---

## `vibe doctor` Split

**Решение:**

| Режим | Время | Содержание |
|---|---|---|
| `vibe doctor` (без флагов) | ≤3с | Только блокирующие проблемы |
| `vibe doctor --full` | ≤30с | Полный аудит, предупреждение пользователю |
| `vibe doctor --ci` | — | GUI/Electron-проверки пропускаются с `[skipped: no GUI]` |
| `vibe doctor --repair` | интерактивный | Восстановление `.vibe/` |
| `vibe doctor --json` | — | Machine-readable вывод |

- [x] Решение принято

---

## Checkpoint Pruning Strategy

**Решение:** Дефолт — последние 50 + все именованные. Автопрунинг включён.

CLI: `vibe checkpoint prune --keep-last 50` / `--older-than 30d`  
`vibe doctor --full` предупреждает при >500MB snapshots.

- [x] Решение принято

---

## Multi-root Workspace

**Решение:**
- Каждый корень workspace = независимая `.vibe/` конфигурация
- Global constraints применяются ко всем корням как единое пространство
- Workspace isolation распространяется на все корни
- Smart context picker индексирует все корни, уважает per-root `.vibe/ignore`

- [x] Решение принято

---

## i18n Foundation

**Решение:** Externalize все UI strings в locale files с первого изменения кода.

Русский + Английский как стартовые локали. Никаких hardcoded strings в компонентах.  
Реализовать через стандартный механизм `nls.localize()` который уже есть в VS Code.

- [x] Решение принято

---

## treeSitterService.ts Performance

**Решение:**
- Инкрементальный индекс (обновляет только изменённые файлы)
- Лимит: не индексировать файлы >200KB, не уходить глубже 10 уровней вложенности
- Прогресс-бар индексирования в UI
- Явный fallback «индекс не готов, используется базовый поиск» — видимый пользователю

- [x] Решение принято

---

## Лицензия VibeIDE

**Решение:** MIT лицензия.

**Обоснование:**
- CortexIDE: Apache-2.0 (Glass Devtools) — совместима с MIT
- VS Code: MIT — совместима
- Project Manager: GPL-3.0 — бандлинг как `.vsix`, не вендоринг исходников → VibeIDE сохраняет MIT

- [x] Решение принято

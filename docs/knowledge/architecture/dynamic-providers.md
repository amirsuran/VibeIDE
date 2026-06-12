# Динамические провайдеры — `.vibe/providers.json`

← [Knowledge Index](../README.md)

---

## [архитектура] User-defined LLM-провайдеры без пересборки (WIP)

**Контекст:** 2026-06-12. Цель — пользователь добавляет/переопределяет/выключает LLM-провайдеров и модели через `.vibe/providers.json` (JSONC), без правки кода и пересборки. Препятствие: `ProviderName = keyof typeof defaultProviderSettings` — **compile-time union**, пронизывающий выбор моделей, capabilities, транспорт, каталог, UI.

**Формат (утверждён, см. `common/vibeProvidersFile.ts` — типы = канон схемы):**
- JSONC; секреты вне файла (`apiKeyEnv` / `apiKeyRef`).
- `active:true|false` на провайдере и модели.
- Совпадение `id` со встроенным → **патч** built-in; новый `id` → новый провайдер; `extends:"<id>"` → клон.
- Слияние моделей по `id`. Подробные рецепты — в корневом `README.md` («Свои провайдеры»).

### Готово (Фаза 1, закоммичено)
- `common/vibeProvidersFile.ts` — типы + JSONC-парсер + `mergeProviderEntry` (override-wins + models-by-id) + тест.
- `browser/vibeProvidersSchemaContribution.ts` — JSON Schema (IntelliSense) + `files.associations`→`jsonc` + `json.schemas` (как defaults).
- `browser/vibeDynamicProvidersService.ts` — чтение/резолв файла, watch, классификация `definition`/`override`/`extends-builtin`, логи `vibeLog 'DynProviders'`. **Eager**-singleton.
- `browser/vibeProvidersDiagnosticContribution.ts` — команда «Показать распознанные провайдеры» (дамп: что распарсилось/во что резолвнулось/warnings).
- `.vibe-defaults/providers.example.jsonc` — самодокументирующийся пример (засевается).
- **2b-1:** `vibeideSettingsService.applyProviderActiveOverrides` + фильтр в `_validatedModelState` → `active:false` у built-in **прячет** провайдера/модель из выбора. Чисто (без файла — поведение не меняется).

### Не сделано (2b-2 — динамические провайдеры РЕАЛЬНО работают)
План (overlay-схема, реализовать свежим заходом):
- **A. Список:** инжектить динамических провайдеров в `settingsOfProvider` как **НЕперсистентный overlay** (рендерер резолвит → `{apiKey(env/ref), baseURL, headers, models}` под ключом-id); `_validatedModelState` итерирует static `providerNames` + динамические id → их модели в `_modelOptions` (`providerName` как `as any`, по образцу 'auto').
- **B. Capabilities:** `getModelCapabilities` для динамического id → caps из overlay (contextWindow/toolFormat→specialToolFormat/vision/reasoning).
- **C. Транспорт** (`electron-main/llmMessage/sendLLMMessage.impl.ts`, функция-фабрика OpenAI-SDK): fallthrough `else { cfg = settingsOfProvider[id]; new OpenAI({ baseURL: cfg.baseURL, apiKey: cfg.apiKey||'noop', defaultHeaders: cfg.headers, ...commonPayloadOpts }) }`. **Новый IPC-канал не нужен** — конфиг едет в `settingsOfProvider` по существующему пути.

**⚠ Риск 2b-2:** `settingsOfProvider` **персистится** (`_storeState`). Динамику персистить нельзя (источник — файл) → overlay должен исключаться из сохранёнки, иначе утечёт в настройки пользователя. Это и есть причина делать 2b-2 аккуратным отдельным заходом.

**Связано:** [[vibe-defaults]] (пример засевается тем же механизмом), [[commands-palette-modal]], [[settings-namespaces]].

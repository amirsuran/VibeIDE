# Model Quirks Catalog

← [Knowledge Index](../README.md)

Каталог поведенческих квирков LLM-моделей: temperature/topP/topK пресеты, reasoning-content normalization, переключатель формата tool-call'ов. Реализация заменяет хардкод-таблицу из v0.13.5 на JSON-каталог с CDN-загрузкой.

---

## [архитектура] Зачем нужен и почему хардкод не годится

**Контекст:** каждая LLM-модель через aggregator (opencode.ai/zen, openrouter и подобные) имеет специфические требования для стабильного стриминга, не публикуемые в API. Без правильных пресетов:
- `qwen3.6-plus` через openCode галлюцинирует имена параметров native FC (`path_pattern` вместо `pattern`) + эмитит XML tool-call'ы в текст.
- `deepseek-v4-pro` падает с HTTP 400 или silent empty stream, если assistant message не содержит `reasoning` slot.
- `minimax-m2.7` без `topK=40` возвращает `Empty response (reason: unknown)`.
- `kimi-k2.5+` без `temperature=1.0 / topP=0.95` уходит в зацикленные reasoning loops.

**Суть:** в v0.13.5 эти квирки жили в `aiSdkAdapter.ts` как три хардкод-хелпера (`getModelParamPresets`, `isDeepseekFamily`, `hasInterleavedReasoning`, ~90 строк). Каждая новая проблемная модель требовала PR в код + новый релиз VibeIDE. В v0.13.6 это вынесено в JSON-каталог `resources/model-quirks.json` + CDN-fetch с `main`-ветки.

**Применение:** для добавления квирка новой модели — PR на правку `resources/model-quirks.json`, без TS-кода и без релиза. Пользователи получат новые квирки на следующем CDN-refresh (default 24 часа после старта или вручную через команду).

---

## [реализация] Fallback chain и lifecycle

**Контекст:** сервис должен работать сразу при старте (до `getQuirks()` из `aiSdkAdapter`), переживать отсутствие сети, и быть устойчивым к плохому JSON.

**Суть — 4 уровня fallback** (каждый выше затеняет нижний):
1. **CDN fetch result** — после успешного `fetchFromCDN()` сохраняется в `${userData}/model-quirks-cache.json` с ETag и timestamp. Используется first-priority при следующем старте.
2. **userData cache** — последний успешный CDN-результат от предыдущего запуска IDE.
3. **Bundled** — `resources/model-quirks.json`, шиппится с IDE на момент билда.
4. **Empty** — пустой каталог. Все модели получают provider defaults.

User override (`vibeide.modelQuirks` setting) merge'ится поверх resolved-каталога **per-field** — undefined поля наследуют каталог, заполненные перекрывают.

**Lifecycle:**
- `initModelQuirksService(userDataPath)` вызывается из `src/main.ts` после `app.setPath('userData', ...)` (тот же паттерн, что у `vibeIdleWatchdogService`).
- Init синхронно загружает highest-tier available (cache → bundled → empty), затем kicks off background CDN fetch.
- `getModelQuirks(modelId)` — синхронный lookup, безопасен до завершения init (вернёт `EMPTY_QUIRKS`).
- `refreshModelQuirksCatalog(userDataPath)` — force-refresh через команду `VibeIDE: Refresh model quirks catalog`.

**Применение:** работа сервиса полностью изолирована от main-bundle init (нет throw из module-init level). Любой failure → fallback вниз по цепочке без UI ошибок.

---

## [контракт] Schema каталога

**Контекст:** контрибьюторы будут править JSON, нужно зафиксировать поля и валидаторы.

**Суть — `ModelQuirksRule` (из [`modelQuirksTypes.ts`](../../../src/vs/workbench/contrib/vibeide/common/modelQuirks/modelQuirksTypes.ts)):**

```ts
interface ModelQuirksRule {
  match: string                              // case-insensitive substring
  temperature?: number                       // 0..2
  topP?: number                              // 0..1
  topK?: number                              // positive int
  forceEmptyReasoning?: boolean              // DeepSeek family
  mirrorReasoningContent?: boolean           // interleaved families
  forceToolCallFormat?: 'native'|'xml'|'auto'
  note?: string                              // freeform, ignored at runtime
}
```

**Валидация (`validateCatalog`):**
- Throws на структурную поломку (root не object, missing `version`, `rules` не array).
- НЕ throws на per-rule ошибки — невалидные правила силент-скипаются. Это **forward-compat policy**: новый каталог с неизвестными полями работает на старых IDE (просто игнорирует), broken rule не валит весь каталог.
- Out-of-range числа dropped (например `temperature: -1` → undefined).
- Boolean с не-boolean значением dropped.
- Enum (`forceToolCallFormat`) с unknown value dropped.

**Применение:** при добавлении нового поля — append к Rule + add validator branch в `validateCatalog`. Старые IDE будут игнорировать новое поле (forward compat) до своего апгрейда.

---

## [квирки] Что покрыто в каталоге на старте

**Контекст:** v0.13.6 initial catalog покрывает все 15 моделей openCode Go провайдера + family fallbacks для будущих версий.

**Суть:**
- `kimi-k2.6 / k2.5 / k2-thinking / k2 / kimi*` — temperature presets (старый k2 → 0.6, новые → 1.0+topP 0.95).
- `minimax-m2.7 / m2.5 / m2.x → topK=40`, `minimax-m2 → topK=20`, family fallback → topK=40.
- `deepseek*` — `forceEmptyReasoning + mirrorReasoningContent`. Любая DeepSeek модель.
- `qwen*` — `temperature=0.55 + topP=1.0 + forceToolCallFormat='xml'`. Native FC не используется из-за галлюцинации param names.
- `glm*` — `temperature=1.0` (z.ai upstream, 4.6 / 4.7 / 5 / 5.1).
- `gemini*` — temperature=1.0 / topP=0.95 / topK=64 (через aggregator; не для native @ai-sdk/google пути).

**Без квирков (получают provider defaults):** `mimo-v2-pro / v2-omni / v2.5-pro / v2.5`, `hy3-preview` — данных пока нет. Появится отчёт о проблемах → PR в каталог.

**Применение:** для подтверждения квирков смотреть upstream `opencode/src/provider/transform.ts:478-510` (опытные значения от их LLM-team), либо empirical observation в чате через `Empty response (reason: unknown)` toast.

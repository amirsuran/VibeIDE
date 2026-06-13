# TECH — Динамические провайдеры как полноценные built-in

Парная к [PRODUCT.md](./PRODUCT.md). Поведение — там; здесь реализация, заземлённая в коде.

## Context

**Что уже есть (фундамент, в `main`):**
- Транспорт: динамик идёт через AI-SDK (`sendViaAISdk`); резолв baseURL/apiKey/headers — default-ветка `aiSdkAdapter.resolveEndpoint`; диспатч-фолбэк в `sendLLMMessage.ts`. Reasoning/`extraBody` инжектятся (`modelEntryToCaps` → caps; `sendViaAISdk:770-780`). Ключ: `apiKeyRef → .vibe/.env → process.env`.
- Текущий показ моделей: `vibeDynamicProvidersService._applyOverridesToSettings` строит `dynamicModelOptions` из `models.static` файла и кладёт overlay'ем в `_modelOptions` (`_validatedModelState`). **Это и есть то, что переделываем** — модели из файла, без ключа, без включения.

**Built-in машинерия (Explore-карта, file:line):**
- Каталог: `common/remoteCatalogService.ts` — `fetchCatalog(providerName, force)` (:185), реализация `fetchFromProvider` (:280-419) — **hardcoded switch**, неизвестный id → `default: []` (:406). baseURL/apiKey берутся из `settingsService.state.settingsOfProvider[providerName]` (:287) — generic. Есть общий OpenAI-compatible хендлер (~:247-278). `remoteCatalogCapableProviderNames` (:82-104) — hardcoded список.
- Рефреш в UI: `RefreshRemoteCatalogButton`/`RefreshableRemoteCatalogs` (Settings.tsx :155-216), гейт `remoteCatalogCapableProviderNames.includes(providerName) && _didFillInProviderSettings` (:1094). Результат → `setAutodetectedModels` → `settingsOfProvider[provider].models` (generic, loose-index работает для динамиков).
- Карточка провайдера: `SettingsForProvider` (Settings.tsx :1039) рендерит поля из `customSettingNamesOfProvider(providerName)` (:1048); `VibeProviderSettings(providerNames)` (:1116) — список карточек. Сейчас кормится `nonlocalProviderNames` (только built-in).
- Вкладка «Модели»: `ModelDump` (:574) фильтрует `providerNames` по `_didFillInProviderSettings` (:598-600); тумблеры — `toggleModelHidden/addModel/deleteModel` (vibeideSettingsService :797-840, читают/пишут `settingsOfProvider[providerName].models`).
- Пикер: `_validatedModelState` (vibeideSettingsService :264-345) — цикл по `providerNames`, гейт `_didFillInProviderSettings && !isHidden` (:304-308).
- Гейт: `computeDidFillInProviderSettings` (:115-124) — для динамика падает/пусто, т.к. `defaultProviderSettings[dynId]` undefined.
- Тип `SettingsOfProvider` keyed по union `ProviderName` (vibeideSettingsTypes :69-71); рантайм loose-index по динамику работает; `_storeState` (:568) персистит весь стейт (включая loose-ключи).

## Proposed changes

**Архитектурное решение:** перестать показывать модели динамиков overlay'ем; вместо этого **сделать id динамика first-class в модели настроек** — завести `settingsOfProvider[dynId]` (apiKey/models/...) и прогнать его через те же циклы/гейты, что built-in. Тогда каталог-fetch, `_didFillInProviderSettings`, isHidden-тумблеры, инжект в пикер — переиспользуются, а не дублируются.

Нужен **источник списка динамик-id** в `common`-слое (где живут циклы). Ввести в `vibeideSettingsService` derived-набор `dynamicProviderIds` (+ map id→displayName/baseURL), который `vibeDynamicProvidersService` наполняет (через тот же overlay-механизм, что уже есть), без персиста в `settingsOfProvider`-union.

### Фаза 1 — динамики как записи настроек (заменяет overlay)

1. `vibeDynamicProvidersService`: для активных definition/extends-builtin — **seed `settingsOfProvider[id]`** записью `{ apiKey, models: [...static с isHidden], baseURL, _didFillInProviderSettings }` (через расширенный `applyProviderActiveOverrides`-overlay; НЕ персистим в union). Экспонировать `dynamicProviderIds` + display-имя/baseURL.
2. `_validatedModelState`: цикл по провайдерам — итерировать `[...dynamicIds (по order), ...providerNames]`. Для динамика — те же гейты `_didFillInProviderSettings && !isHidden`. **Убрать** старый блок `dynamicModelOptions`. Так пикер получает только включённые модели подключённых динамиков, по `order`, выше built-in (инв. 8).
3. `computeDidFillInProviderSettings` (:115): ветка для не-union id → «filled in» = есть резолвимый ключ (apiKey в записи). Это гейт «модели только с ключом» (инв. 4, 10).

### Фаза 2 — каталог из `/v1/models`

4. `remoteCatalogService.fetchFromProvider` (:280): **до switch** — если id не built-in, но в `settingsOfProvider[id]` есть baseURL и ключ → вызвать общий OpenAI-compatible хендлер (`<baseURL>/v1/models`, ключ из записи). Иначе прежний switch.
5. `remoteCatalogCapableProviderNames`: сделать **runtime-инклюзивным** для динамиков с baseURL (helper `isRemoteCatalogCapable(id, state)` вместо статической проверки в Settings.tsx :1094/:222).
6. `models.static` из файла — **мёржится поверх каталога** по id (пиннинг/caps), не заменяет (инв. 6). Caps (`reasoning`/`extraBody`/contextWindow) уже идут через `setDynamicProviderModelCaps`.

### Фаза 3 — Settings-UI

7. Рендерить динамики в «Облачных провайдерах»: подать `dynamicProviderIds` в `VibeProviderSettings` (отдельной секцией «Свои провайдеры» или в общий список по `order`). `customSettingNamesOfProvider(dynId)` → `['apiKey']`; `displayInfoOfProviderName` уже не падает (fallback готов) — отдать file `name` как title через map.
8. `ModelDump` (:574): включить `dynamicProviderIds` в `configuredProviders` → группа моделей динамика + тумблеры (toggleModelHidden generic — работает).
9. Кнопка «Обновить каталог моделей <dyn>» — через п.5.

### Фаза 4 — ключ + гейтинг

10. Поле ключа в карточке → пишет `settingsOfProvider[dynId].apiKey`. Для UI-видимости/гейтинга это и есть «подключение». `.vibe/.env`/`apiKeyRef` остаются альтернативными источниками (браузеро-видимыми). OS-env — только транспорт, для UI считается «без ключа» (инв. 12).
11. Персист ключа динамика: либо loose-index в `settingsOfProvider` (Explore: работает + `_storeState` персистит), либо отдельный `dynamicProviderSecrets` стор — **решить здесь** (см. Risks: union-тип + миграция).

## Testing and validation

- **PRODUCT 1, 6:** unit — файл без `models` валиден; `static` мёржится поверх каталога по id.
- **PRODUCT 3, 7:** manual — динамик-карточка в «Облачных» по `order`; группа в «Моделях».
- **PRODUCT 4, 8, 10:** e2e Kimi — без ключа моделей в дропдропе НЕТ; ввёл ключ (поле/`.vibe/.env`) → каталог подтянулся; включил модель → появилась в дропдропе, по `order` выше built-in. unit на `computeDidFillInProviderSettings` (динамик с/без ключа) и на гейт в `_validatedModelState`.
- **PRODUCT 5, 11:** manual — «Обновить каталог» тянет `/v1/models`; оффлайн/нет endpoint → диагностика, fallback на static, не падение.
- **PRODUCT 9:** e2e — выбранная модель отвечает/думает (регресс фундамента).
- **PRODUCT 15 (НЕ-регрессия) — главный риск:** прогон встроенных (Anthropic/OpenRouter/openAICompatible) — карточки, каталоги, дропдроп, форма запроса без изменений; `compile-check-ts-native` exit=0; `scripts\test.bat` без новых падений. Проверить, что итерация `[...dynamicIds, ...providerNames]` не задевает built-in ветки.

## Risks and mitigations

- **Регрессия встроенных** (трогаем `_validatedModelState`, `computeDidFillInProviderSettings`, `remoteCatalogService`, Settings-UI): узкие ветки «если id не built-in» + обязательный прогон встроенных.
- **Тип `SettingsOfProvider`** keyed по union — для динамик-id loose-index работает рантайм, но типобезопасность теряется. Митигация: явный helper-доступ (`getProviderSettings(id)`), не размазывать `as any`; рассмотреть `& Record<string, SettingsAtProvider<'openAICompatible'>>` (Explore-вариант) — но осторожно, чтобы не ослабить типизацию built-in.
- **Персист секретов динамиков**: убедиться, что ключ шифруется (`_storeState` уже encrypt) и не утекает в `.vibe/providers.json`/логи.
- **Overlay → settings-записи**: переход с `dynamicModelOptions` на seeded-записи не должен оставить двойной показ; удалить старый путь в той же фазе.

## Follow-ups

- FIM для динамиков (`sendFIM`).
- Merge baseURL встроенного для `extends` без своего baseURL.
- Реордер встроенных относительно динамиков, если попросят.

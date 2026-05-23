# `.vibe/` шаблон и правила агента

← [Knowledge Index](../README.md)

`vibeConfigInitService`, README, GUIDELINES + `VIBE_DOTVIBE_AGENT_PLAYBOOK`.

---

## [vscode] Шаблон `.vibe/` при первом открытии воркспейса

**Контекст:** пользователь тестирует VibeIDE и ожидает русские подсказки в `.vibe/`.

**Суть:** **`vibeConfigInitService`** создаёт каталог при первом открытии workspace: JSON с **`_comment`**, **`rules.md`**, **`ignore`**, **`README.md`**, **`goals.md`**, **`prompts/example.md`** и папки **`snapshots`**, **`prompts`**, **`workflows`**, **`plans`**. Уже существующие файлы не перезаписываются — **`README.md`** в старых проектах нужно добавить вручную или удалить `.vibe` для пересоздания (осторожно с данными). Текст карты для людей — **`getDefaultVibeReadmeMarkdown()`** (**`vibeDefaultWorkspaceReadme.ts`**). Полный разбор блока **GUIDELINES**, встроенного playbook и записи **`goals.md`** — см. секцию ниже.

**Применение:** правки дефолтов локальной конфигурации проекта — **`vibeConfigInitService.ts`**; текст **README.md** — **`vibeDefaultWorkspaceReadme.ts`**.

---

## [vscode] GUIDELINES и playbook для `.vibe/`

**Контекст:** нужно чтобы любая выбранная модель понимала намерения вида «перенеси правила из Cursor в один файл», «зафиксируй цели в goals», «создай план/workflow».

**Суть:** блок **GUIDELINES** собирается в **`convertToLLMMessageService._getCombinedAIInstructions()`**:
1. глобальные **AI Instructions** из настроек;
2. содержимое из буферов **`.vibe/rules.md`** и **`AGENTS.md`** в корне папки (**`_getVibeRulesFileContents()`**); документы открываются в модель через **`IVibeideModelService.initializeModel`** при старте (**`convertToLLMMessageWorkbenchContrib`** + после создания **`rules.md`** в **`vibeConfigInitService`**);
3. если в воркспейсе есть хотя бы одна папка — константа **`VIBE_DOTVIBE_AGENT_PLAYBOOK`** (**`src/vs/workbench/contrib/vibeide/common/vibeDotVibeAgentPlaybook.ts`**) с маршрутизацией:
   - импорт правил Cursor (**`.cursor/rules`**, **`.cursorrules`**, профиль пользователя **`.cursor/rules`**) → слияние без дублей и без секретов → **`.vibe/rules.md`**;
   - цели из чата → структура и запись в **`.vibe/goals.md`**;
   - планы → **`.vibe/plans/<slug>.plan.md`**;
   - workflow → **`.vibe/workflows/<name>.json`**;
   - при нехватке данных — уточняющие вопросы.

**`goals.md`:** жёсткий **deny_write** в коде **снят** — по умолчанию агент может писать файл; запрет — **`deny_write`** на **`.vibe/goals.md`** в **`constraints.json`**.

Для UI/кэша правил с санитизацией используется **`IVibeProjectRulesService`** (**`vibeProjectRulesService.ts`**), не путать с потоком чата выше. Полуавтоматический импорт из Cursor: **`node scripts/vibe-init-from.js --from cursor`**.

**Применение:** менять «что модель обязана делать с `.vibe` из естественного языка» — **`vibeDotVibeAgentPlaybook.ts`**; политика только-человек для целей — **`constraints.json`**.

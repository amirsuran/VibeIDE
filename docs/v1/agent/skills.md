# Agent Skills (VibeIDE)

Контракт навыков под **`.vibe/skills/<id>/SKILL.md`**: YAML frontmatter + тело Markdown. Машинная схема frontmatter: `src/vs/workbench/contrib/vibeide/common/schemas/skill-package.schema.json`.

## Отличия от prompts / workflows / custom modes

| Механизм | Где лежит | Вызов | Роль |
|----------|-----------|-------|------|
| **Prompts** | `.vibe/prompts/*.md` | `/my:name` | Шаблон текста с `$PLACEHOLDERS`. |
| **Workflows** | `.vibe/workflows/` | `/workflow:name` | Именованный сценарий шагов (описание в конфиге workflow). |
| **Agent Skills** | `.vibe/skills/**/SKILL.md` | `/skill:name` | Переносимый «рецепт» для модели: когда применять (`description`), полное тело в контекст по явному или discovery-блоку. |
| **Custom modes** | `.vibe/` + сервис режимов | UI / настройки | Пресеты поведения агента (Architect/Coder/…), не файл SKILL. |

## Обязательный frontmatter

- `name` — стабильный id для `/skill:name`.
- `description` — когда навык уместен (discovery + keyword retrieval).
- `vibeVersion` — версия пакета навыка для миграций (`vibe doctor --repair` может дописать).

Опционально: `disable-model-invocation`, `version`, `license`, `tags`, `requires-tools`, `min-vibeide`, `locale`.

## Discovery и фильтр сессии

- Блок **Project Agent Skills** в системных инструкциях строится из `getDiscoveryText(chatMode)` (Plan / Gather / Agent отличаются).
- Workspace-настройка **`vibeide.skills.sessionActiveIds`** ограничивает список в GUIDELINES; `/skill:` по-прежнему резолвит любой загруженный skill.
- Неявный retrieval (keyword overlap) не использует облачные эмбеддинги.

## Санитайзер

Результат **`/skill:`**, **`/my:`**, **`/workflow:`** проходит **`VibePromptGuardService.sanitizeFileContent`** (инъекции, zero-width, bidi; HTML/CSS эвристики для путей с расширением html/svg/xml).

## CLI

- `npm run vibe:skills:validate` — frontmatter, дубликаты id, размер, `reference.md` вне `.vibe/skills`, предупреждение о `scripts/`.
- `npm run vibe:skills:list:json` — машинный список.

## Вложения `reference.md`

Файл рядом с `SKILL.md` допускается; `validate` проверяет, что канонический путь не выходит из дерева `.vibe/skills`.

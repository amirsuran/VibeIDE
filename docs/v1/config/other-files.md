# Остальные `.vibe/` файлы

## `.vibe/ignore`

Явный blacklist: агент не читает, не индексирует, не включает в контекст.

```
.env
*.key
secrets/
vendor/
node_modules/
```

- Интеграция с VSCodeSyncFiles: файлы из `.vibe/ignore` не попадают в sync
- `vibe doctor` рекомендует добавить крупные файлы сюда

---

## `.vibe/allowed-models.json`

Whitelist разрешённых моделей для проекта.

```json
{
  "vibeVersion": "1.0.0",
  "models": ["claude-3-5-sonnet", "claude-3-haiku", "gpt-4o"],
  "reasoning": "Только GDPR-compliant провайдеры"
}
```

`vibe doctor` проверяет текущую модель против whitelist при старте.

При попытке переключиться на неразрешённую модель → предупреждение с показом whitelist.

> Риск: #42

---

## `.vibe/goals.md`

Декларативный файл с **целью сессии**.

```markdown
# Цель: порт с Express на Fastify

Требования:
- Сохранить все endpoint-ы
- Не трогать auth модуль
- Оставить существующие тесты без изменений
```

**Ключевые свойства:**
- **Read-only для агента** — агент не может изменить
- Агент читает как неизменяемый контекст
- При обновлении `context.md` — автоматическая валидация против `goals.md`
- Конфликт = предупреждение пользователю

Branching conversations: каждая ветка наследует прогресс goals, но прогресс ветки не влияет на основную до явного merge.

> Риски: #76, #67

---

## `.vibe/pinned.json`

Файлы/символы которые **всегда** в контексте.

```json
{
  "vibeVersion": "1.0.0",
  "files": ["src/types/index.ts", "src/api/client.ts"],
  "symbols": ["UserService", "AuthMiddleware"]
}
```

Отличие от `@file` mention: pinned — постоянный, `@file` — одноразовый.

Pinned файл >200KB → отдельное предупреждение (Large file policy).

---

## `.vibe/persona.json`

Стиль общения агента. Команды определяют tone.

```json
{
  "vibeVersion": "1.0.0",
  "verbosity": "concise",
  "formality": "technical",
  "language": "ru",
  "ask_before_assume": false,
  "proactive_suggestions": false
}
```

- `ask_before_assume: false` = assumption-first (меньше вопросов)
- `proactive_suggestions: true` = «agent hot take» после завершения задачи
- Привязывается к профилю

---

## `.vibe/prompts/` и `.vibe/workflows/`

### Граница между ними (важно!)

| | Промпт | Workflow |
|---|---|---|
| Формат | Markdown с `$PLACEHOLDER` | YAML со структурированными шагами |
| Доступ | `/my:имя` | `/workflow:имя` |
| Одобрение | Нет | Между шагами (если нужно) |
| Применение | Разовый вызов | Повторяемый процесс команды |

**Критерий:** «нужно одобрение между шагами — workflow, нет — промпт».

Workflow не переопределяет constraints — при конфликте явная пауза.

> Риск: #86

---

## `.vibe/context.md`

Автообновляемый агентом контекст проекта. «Рабочая тетрадь» агента.

- В Фазе 1: создаётся статически
- В Фазе 2: синхронизируется через VSCodeSyncFiles
- В Фазе 3a: агент начинает обновлять автоматически (Memory decay)

**Read-write для агента** (в отличие от `goals.md`).  
Атомарный write с `sessionId`-меткой для conflict resolution.

> Риск: #64 (race condition с VSCodeSyncFiles)

---

## Фазы реализации

| Файл | Фаза |
|---|---|
| `.vibe/ignore` | 1 |
| `.vibe/allowed-models.json` | 1 |
| `.vibe/pinned.json` | 1 |
| `.vibe/goals.md` (read-only для агента) | 1 |
| `.vibe/prompts/` + Prompt Library | 1 |
| `.vibe/workflows/` | 2 |
| `.vibe/persona.json` | 2 |
| `.vibe/context.md` автообновление | 3a |

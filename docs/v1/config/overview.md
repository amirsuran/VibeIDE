# `.vibe/` — конфигурационная система

## Структура директории

```
.vibe/
├── constraints.json     ← машиночитаемые ограничения (детерминированный enforcement)
├── rules.md             ← AI-инструкции с наследованием по директориям
├── permissions.json     ← whitelist файлов для агента
├── ignore               ← blacklist: агент не читает, не индексирует
├── allowed-models.json  ← whitelist разрешённых моделей
├── goals.md             ← декларативные цели сессии (read-only для агента)
├── pinned.json          ← файлы/символы всегда в контексте
├── persona.json         ← стиль общения агента
├── profiles/            ← именованные профили настроек
│   ├── work.json
│   ├── personal.json
│   └── ci.json
├── prompts/             ← пользовательские промпт-шаблоны
│   └── my-template.md
└── workflows/           ← структурированные agent workflows
    └── add-endpoint.yaml
```

## Format Versioning

Каждый `.vibe/` файл содержит поле `"vibeVersion"`:

```json
{
  "vibeVersion": "1.0.0",
  ...
}
```

При несовместимой смене схемы:
1. Migration script (автоматический или интерактивный)
2. Блокирующее предупреждение с точным сообщением
3. `vibe doctor` проверяет версию схемы при старте

JSON Schema публикуется на GitHub Pages — открытый стандарт.

> Риск: #51

## Приоритетный стек настроек

От высшего к низшему:

```
1. Enterprise locked constraints   ← не переопределяется локально
2. Global constraints              ← .vibe/constraints.json
3. Profile constraints             ← .vibe/profiles/<name>.json
4. Directory rules                 ← .vibe/rules.md (ближайший побеждает)
5. Mode constraints                ← custom mode rules
```

Mode может переопределять directory-level rules, но не может снять ограничения уровней 1-3.

> Риск: #32

## `.vibe/` как открытый стандарт

`.vibe/` — потенциальный `.editorconfig` для AI-агентов.

- Публикация JSON Schema в Фазе 1
- Призыв к Kilo Code / Continue / Aider поддержать формат
- `.vibe/schema/` community templates marketplace (Фаза 3a)

## Gitignore стратегия

`vibe init` спрашивает: публичное или приватное репо?

Дефолт в `.gitignore`:
```
.vibe/permissions.json   ← может содержать внутренние паттерны
```

`vibe doctor` предупреждает если `.vibe/` не в `.gitignore` перед первым коммитом.

> Риск: #35

## Hot-reload политика

Изменения `.vibe/` файлов вступают в силу только при:
- Следующем tool-call
- Явном Reload

При редактировании `.vibe/` **во время активного агента** — banner предупреждение.

Переключение профиля при активном агенте — **блокирующий диалог**.

> Риски: #53, #95

## Corrupted `.vibe/` recovery

При битом файле:
1. Banner с объяснением ошибки
2. Загрузить дефолтные значения
3. **Не блокировать запуск IDE**

`vibe doctor --repair` — интерактивный режим восстановления.

## Файлы по разделам

| Файл | Документ |
|---|---|
| `constraints.json` | [config/constraints.md](constraints.md) |
| `rules.md` | [config/rules.md](rules.md) |
| `profiles/` | [config/profiles.md](profiles.md) |
| остальные файлы | [config/other-files.md](other-files.md) |

# `.vibe/profiles/` — именованные профили настроек

## Концепция

Именованные наборы настроек. Переключение в один клик.

```
.vibe/profiles/
├── work.json         ← рабочий профиль
├── personal.json     ← личные проекты
├── client-x.json     ← NDA-проект со строгими constraints
└── ci.json           ← CI/CD окружение
```

## Структура профиля

```json
{
  "vibeVersion": "1.0.0",
  "name": "client-x",
  "constraints": {
    "deny_write": ["auth/**", "billing/**"]
  },
  "allowed-models": ["claude-3-5-sonnet", "claude-3-haiku"],
  "rules_override": ".vibe/profiles/client-x-rules.md",
  "trust_score": "supervised"
}
```

## Приоритетный стек

```
Enterprise locked → Global constraints → Profile constraints → Directory rules → Mode
```

Profile constraints имеют приоритет над global `.vibe/constraints.json`.  
`allowed-models` в профиле имеет приоритет над глобальным `.vibe/allowed-models.json`.

> Риски: #32, #57

## Переключение профиля

**При неактивном агенте:** мгновенное применение.

**При активном агенте:**  
→ Блокирующий диалог: «агент активен — применить после завершения или прервать задачу?»  
При «применить сейчас»: checkpoint + rollback к состоянию до задачи + применение профиля.

> Риск: #95

## CI профиль

`.vibe/profiles/ci.json` — специфичные настройки для GitHub Actions.  
`--no-local-constraints` флаг для CLI.  
`vibe doctor --ci` явно сообщает какие constraints применены/проигнорированы.

## Синхронизация между устройствами

Через VSCodeSyncFiles (pre-installed).  
Данные в облаке **пользователя** — никаких серверов VibeIDE.

→ [integrations/vscodesyncfiles.md](../integrations/vscodesyncfiles.md)

## Фазы реализации

| Фича | Фаза |
|---|---|
| `.vibe/profiles/` базовая поддержка | 2 |
| Sync профилей через VSCodeSyncFiles | 2 |
| CI-профиль + `--no-local-constraints` | 3a |
| Enterprise policy import (locked constraints) | 2 |

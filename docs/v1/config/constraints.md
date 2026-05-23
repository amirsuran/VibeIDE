# `.vibe/constraints.json` — детерминированный enforcement

## Концепция

**Не промпт-инструкция** — детерминированная sandbox-прослойка **до агента**.

Агент физически **не может** записать файл нарушающий constraint — не потому что «ему сказали», а потому что IDE блокирует вызов.

```
Запрос агента на запись → Constraints enforcement layer → Агент
                                     ↓ блокировка
                              IDE не выполняет операцию
```

> Риск: #43

## Формат

```json
{
  "vibeVersion": "1.0.0",
  "rules": [
    {
      "type": "deny_write",
      "pattern": "auth/**",
      "message": "auth/ защищена — требуется ревью"
    },
    {
      "type": "max_lines_per_function",
      "value": 50
    },
    {
      "type": "deny_age",
      "older_than_months": 6,
      "message": "файл не менялся 6+ месяцев — нужно ли?"
    }
  ]
}
```

## JSON Schema

Публикуется на GitHub Pages. `vibe doctor` валидирует при старте.

Ошибки схемы — **блокирующее предупреждение** с точным сообщением, не молчаливое игнорирование.

## Constraints live editor (Фаза 2)

Встроенный редактор:
- Подсветка JSON Schema в реальном времени
- Валидация: «этот constraint никогда не сработает — пустой whitelist»
- Preview: «если применить сейчас — заблокирует X файлов»

## «Freeze this code» quick action

ПКМ на выделение/файл → «Заморозить для агента»  
→ Добавляет constraint в `.vibe/constraints.json` одним кликом.

Обратное: «Разморозить» удаляет constraint.

Прямое выражение нарратива «ты управляешь всем» без знания формата файла.

## Enterprise locked constraints (Фаза 2)

IT-администратор публикует корпоративный `.vibe/constraints.json` по URL.  
IDE подтягивает при старте.  
**Locked-constraints нельзя переопределить** локально или через профили.

### Конфликт с `.vibe/goals.md`
При старте агента с pre-flight plan — валидация goals против enterprise locked-constraints **до начала выполнения**.  
При конфликте → диалог с объяснением, не молчаливый провал.

> Риски: #81, #77

## `.vibe/constraints.json` в CI/CD

Флаг `--no-local-constraints` для CLI — игнорирует локальный файл.  
CI-профиль: `.vibe/profiles/ci.json` — специфичные для CI настройки.  
`vibe doctor --ci` явно сообщает какие constraints проигнорированы.

> Риск: #36

## Фазы реализации

| Фича | Фаза |
|---|---|
| Constraints enforcement layer (детерминированная блокировка) | 1 |
| JSON Schema публикация | 1 |
| `vibe doctor` валидация constraints | 1 |
| «Freeze this code» quick action | 1 |
| Constraints live editor | 2 |
| Enterprise policy import | 2 |

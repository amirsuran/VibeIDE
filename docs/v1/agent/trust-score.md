# Trust Score — виджет уровня автономии агента

## Концепция

**Не настройка в меню — постоянный виджет в статус-баре.**  
Меняется одним кликом или keyboard shortcut. Полностью keyboard-accessible.

| Уровень | Цвет | Поведение |
|---|---|---|
| **Manual** | 🟢 | Каждое действие требует подтверждения |
| **Supervised** | 🟡 | Уведомления, автоприменение после таймаута N сек |
| **Auto** | 🔴 | Агент работает автономно с budget-лимитами |

## Взаимодействие с другими фичами

### Trust Score × Dead man's switch
- **Manual**: DMS не актуален — каждое действие и так требует одобрения
- **Supervised**: DMS запускается при отсутствии ответа N минут
- **Auto**: DMS активен, паузирует агента при длительном отсутствии пользователя

### Trust Score × Explicit tool approval
- **Manual**: каждый tool-use (запись файла, shell, HTTP) требует одного клика
- **Supervised**: tool-use выполняется автоматически с уведомлением
- **Auto**: tool-use выполняется без прерываний

### Trust Score × Diff confidence score
- **Auto режим + 🔴 confidence chunk**: требует ручного одобрения несмотря на Auto
- Confidence score не зависит от Trust Score — независимый эвристический индикатор

### Trust Score × Auto-repair loop
- **Manual**: каждая repair-итерация требует одобрения
- **Auto**: repair-loop работает без прерываний; итерации для 🔴-confidence файлов записываются как `agent:repair-override`

### Trust Score × Supervised mode timeout
- Таймаут Supervised mode (авто-применение после N сек) — отдельная настройка от DMS
- DMS таймаут > Supervised таймаут — иначе DMS паузирует агент до применения действия

## Реализация

### Статус-бар
```
[🟢 Manual]  ←→  [🟡 Supervised]  ←→  [🔴 Auto]
```
Клик → переключение по кругу.  
Keyboard shortcut — настраивается (дефолт: `Ctrl+Shift+T`).

### Хранение
Уровень хранится в workspace settings (`.vscode/settings.json`), не в глобальных.  
При открытии нового workspace — запрашивает выбор (или использует дефолт из first-run wizard).

### First-run wizard
Wizard задаёт начальный уровень Trust Score на основе выбранного профиля безопасности.

## Фаза реализации

**Фаза 1** — Trust Score виджет входит в North Star MVP.

→ Checklist: [phases/phase-1/ux.md](../phases/phase-1/ux.md)

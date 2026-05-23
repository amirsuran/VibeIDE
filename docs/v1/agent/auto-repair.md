# Auto-repair Loop

## Концепция

После Apply агент автоматически запускает цикл качества:

```
Apply → lint → types → tests → fix → Apply → ... → зелёный
```

Задача считается «готовой» только когда весь quality bar пройден.

## Режимы

| Trust Score | Поведение |
|---|---|
| Manual 🟢 | Одобрение каждой repair-итерации |
| Supervised 🟡 | Одобрение + авто-применение после таймаута |
| Auto 🔴 | Без прерываний |

## Критичные взаимодействия

### Auto-repair × Loop detector
Repair loop шаги **явно исключены** из loop detector.  
Repair — уже одобрен пользователем через Approve или Trust Score = Auto.

Репетиция `run tests` внутри repair = **не цикл** если результаты меняются.  
Цикл = те же тесты с той же ошибкой.

### Auto-repair × Diff confidence score
В Auto режиме: repair-итерации для 🔴-confidence файлов записываются как `agent:repair-override` в аудит-логе.  
**Не блокируют** repair loop — пользователь одобрил repair когда принял Apply.  
В Manual — каждая итерация требует одобрения как обычно.

### Auto-repair × Context limit
Каждая итерация добавляет test output в контекст.  
За 5-7 итераций контекст может достичь 90% лимита.

**Repair context budget:** отдельный пул токенов для test output.  
При переполнении repair budget — суммаризация старых test results (не полный compact).

### Rollback внутри repair-chain
Шаги repair loop помечаются `repair-chain-id: <uuid>` в аудит-логе.

При откате шага N внутри цепочки → диалог:
- «Откатить **всю цепочку** до состояния до repair» (рекомендуется)
- «Откатить только этот шаг» (с предупреждением о потере консистентности)

> Риски: #80, #96

## Task Decomposition UI

Live-прогресс во время repair:  
«шаг 3 из 7: исправляю TypeScript ошибки»

**Разграничение с Agent pre-flight plan:**
- Pre-flight plan = статический план **до старта** (модальный диалог)
- Task decomposition UI = live прогресс **во время** выполнения (постоянный progress sidebar)

## Фазы реализации

| Фича | Фаза |
|---|---|
| Task decomposition UI | 2 |
| Auto-repair loop | 2 |
| Run tests after apply (без repair loop) | 2 |

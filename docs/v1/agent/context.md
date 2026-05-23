# Context Management

## Context Window Visualizer

Постоянная панель — потребление токенов + реальная стоимость с учётом prompt caching.

Показывает:
- Потребление токенов по источникам (файлы, системный промпт, история чата)
- Реальная стоимость с учётом кэша и без
- **Live-индикатор** заполнения во время выполнения агента (не только при ручном добавлении)
- «Pinned» файлы как отдельный раздел

→ Фаза 2

---

## Smart Context Picker

Автовыбор файлов в контекст на основе AST-анализа зависимостей через `treeSitterService.ts`.

### Порядок операций (критически важен!)
```
1. secretDetectionService    ← ДО формирования контекста
2. Smart context picker      ← формирует список файлов
3. Large file policy check   ← проверка размеров
4. Context assembly          ← финальный контекст
```

> ⚠️ Риск #16: Smart context picker может затянуть `.env` или `secrets.yml` до срабатывания `secretDetectionService`. Порядок фиксирован и покрыт тестом.

### `@file` / `@symbol` mention
Явное упоминание файла/символа в чате (`@src/utils.ts`) — дополняет автовыбор.  
Отличие от Pinned context: одноразовый (для текущего запроса).

### Pinned context
Файл «закреплён» → всегда в контексте вне зависимости от Smart context picker.  
Хранится в `.vibe/pinned.json`.  
Pinned файл >200KB → отдельное предупреждение.

---

## Large File Policy

Дефолтный лимит: **200KB на файл** в контексте.

При превышении — варианты:
- Добавить только первые N строк
- Исключить файл
- Добавить целиком (явное подтверждение с предупреждением о стоимости)

`vibe doctor` рекомендует добавить крупные файлы в `.vibe/ignore`.

> Риск: #49

---

## Context Eviction Control

- Кнопка «убрать из контекста» рядом с каждым файлом в Context window visualizer
- Auto-compression (summarize) при приближении к лимиту
- Настраиваемый порог (дефолт: 90%)

---

## Graceful Degradation (Context Limit Mid-Task)

При достижении **90% context limit во время выполнения** агент останавливается:

1. **Compact context** — суммаризовать старые части
2. **Продолжить с риском** — предупреждение о потере контекста
3. **Отменить + снапшот** — сохранить прогресс

### Auto-repair loop + Context limit
Каждая repair-итерация добавляет test output в контекст.  
За 5-7 итераций repair loop может довести контекст до 90% лимита.

**Решение:** repair loop получает отдельный «repair context budget»;  
при переполнении — суммаризует старые test results вместо полного compact.

> Риски: #72, #80

---

## Context Diff между запросами

Показывает что изменилось в контексте между двумя запросами:
- Какой файл добавился
- Что выпало из окна
- Какие токены «стоят» дорого

→ Фаза 2, в составе Transparency Suite

---

## Cost Attribution per File

В конце сессии: сколько токенов «стоил» каждый файл в контексте.  
Помогает найти раздутый контекст.

→ Фаза 2

---

## Dependency Graph Visualization

Граф зависимостей поверх `treeSitterService.ts`:  
«вот почему `auth.ts` в контексте — он импортируется из 3 изменённых файлов».

«Why this context?» inline tooltip — более быстрый вариант для повседневного использования.

→ Фаза 2

---

## treeSitterService.ts — производительность

Монорепо с 500k+ файлов без ограничений зависнет на минуты.

**Решение:**
- Инкрементальный индекс (обновляет только изменённые файлы)
- Явное ограничение глубины/размера (настраивается)
- Прогресс-бар индексирования в UI
- Явный fallback «индекс не готов, используется базовый поиск» — **видимый пользователю**

> Риск: #21

---

## Slot-based Context Management (Фаза 2+)

Именованные контекстные слоты (`@auth-context`, `@api-context`).  
Пользователь сохраняет набор файлов как именованный контекст и переключается.  
Переключение через `/context:имя` в чате.

---

## Фазы реализации

| Фича | Фаза |
|---|---|
| Smart context picker + secret detection pipeline | 1 |
| `@file` / `@symbol` mention | 1 |
| Pinned context (`.vibe/pinned.json`) | 1 |
| Large file policy | 1 |
| Agent graceful failure (context limit) + live indicator | 1 |
| Context window visualizer | 2 |
| Context diff между запросами | 2 |
| Context eviction control | 2 |
| Cost attribution per file | 2 |
| Dependency graph visualization | 2 |
| Slot-based context management | 2+ |

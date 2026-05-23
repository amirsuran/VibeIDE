# «Управляешь всем» — Control фичи

> Все фичи выходят **единым релизом в Фазе 2** с единым нарративом и landing page.

## Explicit Tool Approval Mode

Каждый tool-use (запись файла, shell, HTTP) требует **одного клика**.

UX по образцу Claude.ai:
- Keyboard shortcut для одобрения
- Одно предложение-обоснование от агента «почему это нужно прямо сейчас» (Per-tool-call rationale)

**Разграничение с Diff annotations:**
- Tool approval rationale — **до** одобрения action
- Diff annotations — **после** в diff view

---

## Diff Preview перед применением

Unified diff с тремя действиями:
- **Apply** — применить всё
- **Reject** — отклонить
- **Edit before applying** — редактировать перед применением

### Diff annotations
Агент пишет одно предложение-обоснование рядом с каждым chunk.

### Diff confidence score
Эвристический индикатор риска для каждого chunk:
- 🟢 — безопасно
- 🟡 — внимание
- 🔴 — критическая зона (auth, db migrations, config)

**Ключевые правила:**
- 🔴 confidence блокирует Auto режим до ручного одобрения
- LLM-as-judge — **отдельный advisory** (не повышает confidence)
- Два независимых бейджа в UI: «Confidence: 🔴» и «Judge: ⚠️»

### Diff complexity indicator
До Apply — оценка риска:
- Сколько файлов затронуто
- Есть ли критические зоны
- Бинарные файлы = 🔴 по умолчанию

> Риск: #69

---

## Inline Diff Review

Принять/отклонить каждый chunk прямо в файле.  
**Гарантия атомарности:** либо всё, либо ничего, либо явный промпт.

Бинарные файлы — только Apply/Reject целиком.

> Риск: #15

---

## Agent Pre-flight Plan

Перед выполнением агент показывает план:  
«изменю N файлов, выполню M команд, стоимость ~$X»

Действия: **Approve / Edit plan / Cancel**

**Разграничение с Task decomposition UI:**
- Pre-flight plan = статический план **до старта** (модальный диалог)
- Task decomposition UI = live прогресс **во время** выполнения (progress sidebar)

### Plan drift
При выходе скопа за порог (дефолт 2×):
- **Manual**: пауза с обновлённым планом
- **Auto**: логируется как `agent:plan-drift` без прерывания

### Cost estimate в pre-flight plan
Рядом с Approve: «~$0.08–0.12 (worst case) / ~$0.03 с кэшем»

### Pre-flight × DMS
Режим ожидания pre-flight plan approval **явно исключён** из DMS таймера.  
DMS запускается только после первого tool-call после Approve.

> Риски: #60, #83, #92

---

## Agent Action History Sidebar

Постоянная боковая панель с хронологией всех действий агента.

- Можно откатить любой шаг
- Персистируется через `auditLogService.ts` (не только в памяти)
- При перезапуске IDE — история предыдущей сессии в отдельной вкладке

**Rollback внутри repair-chain:**  
Шаги repair loop помечаются `repair-chain-id`.  
При откате → диалог с предупреждением о зависимых шагах.

> Риск: #45, #46, #96

---

## Git Worktree Isolation

Агент работает в изолированном git worktree.  
Merge в основную ветку — только после явного Approve.

**Rollback в sidebar:** всегда работает на активном worktree, никогда не трогает основную ветку.

**Branching conversations:** каждый форк чата создаёт новый git worktree.

> Риски: #46, #82

---

## Workspace Isolation

→ [agent/safety.md](../agent/safety.md)

---

## Per-file Agent Permissions

Whitelist файлов в `.vibe/permissions.json`.

```json
{
  "vibeVersion": "1.0.0",
  "allow_write": ["src/**", "tests/**"],
  "deny_write": ["auth/**", "*.env"]
}
```

---

## Agent Git Identity

Коммиты агента помечаются:
```
Co-authored-by: VibeIDE Agent <agent@vibeide.local>
```

Compliance-аудитория различает человека и машину в git-истории.

---

## «Pause and Explain»

Пользователь прерывает агента: «что ты делаешь прямо сейчас и зачем?»  
Агент отвечает — **не отменяя задачу**, затем продолжает.

**Нет у конкурентов.** Прямое выражение нарратива «ты управляешь всем».

---

## Stealth Mode

Режим без кеширования у провайдера, минимальный лог, автоочистка clipboard.  
Для fintech / legal / NDA-проектов.

В Stealth mode:
- Context window visualizer показывает только worst case
- `Reproducible sessions` — предупреждение о недетерминизме
- `Agent shadow mode` принудительно отключён

---

## Privacy Audit Log Export

Пользователь может экспортировать и **полностью удалить** свои аудит-логи.  
GDPR right to erasure — не только ротация по времени.

**Export modal** — единая точка входа:
1. История чата (текст)
2. Полная сессия (для передачи коллеге)
3. Compliance report

> Риск: #47, #75

---

## Фазы реализации

| Фича | Фаза |
|---|---|
| Agent git identity | 1 |
| «Pause and explain» | 1 |
| Diff preview (без annotations/confidence) | 1 (базовый) → 2 (полный) |
| Workspace isolation | 1 |
| Per-file permissions | 1 |
| Explicit tool approval mode | 2 |
| Inline diff review | 2 |
| Agent pre-flight plan | 2 |
| Agent action history sidebar | 2 |
| Diff annotations | 2 |
| Diff confidence score | 2 |
| Diff complexity indicator | 2 |
| LLM-as-judge diff review | 2 |
| Git worktree isolation | 2 |
| Stealth mode | 2 |
| Privacy audit log export | 1 |
| Export modal | 2 |
| Compliance report export | 2 |

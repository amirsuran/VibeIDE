# «Видишь всё» — Transparency фичи

> Все фичи выходят **единым релизом в Фазе 2** с единым нарративом и landing page.

## Debug my prompt

Показывает **точный системный промпт** + параметры запроса:
- Temperature, модель, версия промпта
- Что именно отправлено провайдеру (дословно)

**Нет ни у кого из конкурентов.**

---

## Prompt Versioning

- Фиксация версии промпта `v1.2.3`
- Unified diff между версиями IDE
- История для compliance
- `vibe prompt-history` CLI-команда

**Prompt diff при обновлении IDE** — unified diff при каждом обновлении.  
Compliance-команда знает как изменилось поведение агента.

---

## Context Window Visualizer

Потребление токенов + реальная стоимость с учётом prompt caching.

Показывает:
- Breakdown по файлам, системному промпту, истории
- Стоимость с кэшем и без (диапазон)
- Live-индикатор во время выполнения агента
- «Pinned» файлы отдельным разделом
- Почему файл в контексте (inline tooltip)

→ [agent/context.md](../agent/context.md)

---

## Context Diff между запросами

Что изменилось в контексте между двумя запросами:
- Какой файл добавился
- Что выпало из окна
- Какие токены «дорогие»

---

## Model Fingerprinting

Аудит логирует для каждого чекпоинта:
- Модель
- Temperature
- Seed
- Версия промпта

UI показывает: «этот чекпоинт сделан с claude-3-5-sonnet, temp=0.3».

---

## Reproducible Sessions

Кнопка «Reproduce» — тот же промпт, та же модель, тот же seed.  
Для debugging странного поведения агента.

При переключении модели mid-task → диалог: воспроизводить с оригинальными или текущими моделями?

**В Stealth mode:** предупреждение — кэш отключён, результат может отличаться.

> Риск: #34, #71

---

## Replay сессии агента

Воспроизведение сессии пошагово по аудит-логу:
- Что сделал агент
- Какой файл изменил
- Какой промпт получил

---

## Explain this decision

Реконструкция reasoning агента из аудит-лога для каждого чекпоинта.  
«Почему агент сделал именно это действие?»

---

## Diff Annotations

Агент пишет одно предложение-обоснование рядом с каждым chunk прямо в diff view.

Отличие от Per-tool-call rationale:
- **Diff annotations** — обоснование *после* применения (в diff view)
- **Per-tool-call rationale** — обоснование *до* одобрения action

---

## Token Cost Forecast

До отправки — диапазон стоимости (не точка):
- Worst case: `$X`
- С кэшем: `$Y`

Post-response: индикатор сработал ли кэш (из `usage` поля API-ответа).

При extended thinking: отдельная строка «thinking overhead: +50–300%».

В Stealth mode: только worst case, тултип «кеширование отключено».

**Интеграция с Pre-flight plan:** cost estimate отображается рядом с кнопкой Approve.

> Риски: #33, #56, #83, #94

---

## Cost Attribution per File

В конце сессии: сколько токенов «стоил» каждый файл в контексте.  
Показывает где раздувается контекст.

---

## Agent «Thinking Out Loud» Mode

Стриминг внутреннего рассуждения в отдельную панель.  
Extended thinking — Claude 3.7+, OpenAI o-series.

Настройка: всегда / по запросу / скрыть.

Capability probe определяет поддержку у провайдера.

---

## MCP Inspector

Встроенный визуальный отладчик MCP-запросов:
- Какой сервер вызван
- С какими аргументами
- Какой ответ
- Режим выполнения: ptc / parallel / sequential

---

## Audit Log

Аудит всех AI-действий. Поверх `auditLogService.ts` из CortexIDE.

Retention: 30 дней (настраивается).  
Экспорт и **полное удаление** (GDPR right to erasure) — Фаза 1.  
Поиск и фильтрация — Фаза 1.  
Шифрование (age/libsodium, opt-in) — Фаза 2.

При включении шифрования:
- Диалог «зашифровать существующие логи?»
- **Обязательное сохранение recovery phrase** (24 слова)
- Любая фича читающая лог → временный decrypt-in-memory

> Риски: #22, #39, #55, #63

---

## Sharable Debug-link

Анонимизированный снапшот промпта по ссылке — для issues и поддержки.  
Недоступен в privacy-режиме (UI-индикатор).

---

## Transparency Dashboard (публичная)

Страница на сайте: что IDE отправляет наружу в каждом режиме.  
Обновляется автоматически при релизах из `vibe doctor` output.

→ Фаза 3a

---

## Фазы реализации

| Фича | Фаза |
|---|---|
| Audit log (retention + GDPR export + поиск) | 1 |
| Context window visualizer | 2 |
| Debug my prompt | 2 |
| Prompt versioning | 2 |
| Context diff между запросами | 2 |
| Model fingerprinting | 2 |
| Reproducible sessions | 2 |
| Replay сессии | 2 |
| Explain this decision | 2 |
| Diff annotations | 2 |
| Token cost forecast | 1 |
| Cost attribution per file | 2 |
| Agent thinking out loud | 2 |
| MCP Inspector | 2 |
| Sharable debug-link | 2 |
| Audit log шифрование | 2 |
| Transparency Dashboard | 3a |

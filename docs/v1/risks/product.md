# Риски — продукт и UX

## #14 — Конфликт rules.md в монорепо

**Противоречивые инструкции в `packages/api/.vibe/rules.md` и корневом `rules.md` → агент непредсказуем.**

**Решение:** Явная модель приоритетов (ближайший побеждает / merge / explicit override).  
Задокументировать и реализовать до Фазы 1.

---

## #27 — Workspace isolation — WSL2

**Агент может читать `~/.ssh`, `~/.aws` в соседних директориях через WSL2 симлинки.**

**Решение:** Тест на `\\wsl$\Ubuntu\...` и `/mnt/c/...` пути. Документировать в Threat model.

---

## #30 — Концептуальный конфликт: privacy vs gateway

**Gateway = «мы видим твои запросы к моделям» — прямое противоречие privacy-нарративу.**

**Решение:** Явная архитектурная сегментация. Пользователь видит в UI что уходит через gateway.  
Не смешивать в маркетинге.

---

## #32 — Конфликт `.vibe/profiles/` и `.vibe/constraints.json`

**Неоднозначность: какие настройки глобальные, какие per-profile, что побеждает при конфликте?**

**Решение:** Явный приоритетный стек (зафиксировать в Фазе 0):
```
Enterprise locked → Global → Profile → Directory → Mode
```

---

## #33 — Token cost forecast vs prompt caching

**Forecast не знает заранее сработает ли кэш → пользователь видит одну цифру, платит другую.**

**Решение:** Forecast показывает диапазон: «worst case / с кэшем».  
Явный индикатор «кэш активен / не активен» после ответа.

---

## #34 — Model switching mid-task

**Переключение модели в середине сессии ломает `model fingerprinting` и `reproducible sessions`.**

**Решение:** Фиксировать switch как явный checkpoint в аудит-логе с пометкой «модель изменена».  
Reproduce → диалог: воспроизводить с оригинальными или текущими моделями?

---

## #36 — `.vibe/constraints.json` в CI/CD

**Constraints из локального `.vibe/` могут противоречить CI-окружению.**

**Решение:** `--no-local-constraints` для CLI. CI-профиль в `.vibe/profiles/ci.json`.  
`vibe doctor` в CI-режиме явно сообщает какие constraints проигнорированы.

---

## #39 — Encrypted audit logs + фичи чтения лога

**Шифрование конфликтует с Replay, Explain this decision, AI diff summarizer.**

**Решение:** Единый механизм: при активном шифровании → временный decrypt-in-memory.  
Ключ в памяти не сохраняется после операции.

---

## #42 — `.vibe/allowed-models.json` vs Model switching

**Попытка переключиться на модель вне whitelist — поведение не определено.**

**Решение:** Явное предупреждение + кнопка «override для этой сессии» с фиксацией в аудит-логе.

---

## #44 — Data residency для EU-пользователей в gateway

**GDPR требует data residency — без EU-региона gateway закроет EU-enterprise рынок.**

**Решение:** До М-Фазы 0 зафиксировать позицию: EU-регион обязателен или явно исключён из EU-маркетинга.

---

## #46 — Git worktree isolation + rollback — конфликт уровней

**Rollback в sidebar + агент в worktree — откатывается worktree или основная ветка?**

**Решение:** Rollback всегда работает на активном worktree, никогда не трогает основную ветку.  
При откате шага N → диалог о зависимых шагах.

---

## #52 — Rate limit (429) триггерит Dead man's switch

**Агент ждёт retry после 429. DMS видит «нет активности» и паузирует агента.**

**Решение:** 429 + retry backoff явно исключены из DMS таймера.  
Отдельный UI-индикатор «агент ждёт rate limit (~Xs)».

---

## #60 — Dead man's switch + Agent pre-flight plan

**Пользователь думает над pre-flight планом N минут → DMS паузирует агента который ещё ничего не делал.**

**Решение:** Режим «ожидание pre-flight plan approval» явно исключён из DMS таймера.

---

## #66 — Бинарные файлы в diff preview

**Diff preview, inline diff review, confidence score — описаны только для текстовых файлов.**

**Решение:**
- Diff: «binary file changed (old: N bytes → new: M bytes)»
- Confidence score = 🔴 по умолчанию
- Inline diff review — только Apply/Reject целиком

---

## #68 — Loop detector ложные срабатывания в CI

**`run tests → fix → run tests → fix` — легитимный паттерн, но loop detector паузирует агента в CI.**

**Решение:** В CLI-режиме цикл = одинаковое действие + **идентичный результат**.  
`--loop-threshold N` для CLI.

---

## #69 — Diff confidence score + LLM-as-judge

**Два инструмента оценивают diff. Конфликт: judge «одобряет» то что confidence помечает 🔴.**

**Решение:**
- Два **независимых** бейджа в UI: «Confidence: 🔴» и «Judge: ✅»
- Judge не повышает confidence score
- 🔴 confidence блокирует Auto режим **независимо** от judge

---

## #73 — `vibe doctor` scope creep

**Без приоритизации 40+ проверок → команда висит 30+ секунд или проверки формальны.**

**Решение:** Fast mode (≤3с) / Full (≤30с) / CI-mode / Repair — явные режимы с задокументированной границей.

---

## #76 — `.vibe/context.md` vs `.vibe/goals.md`

**Агент обновляет `context.md` в противоречие с `goals.md` → косвенно «решает» невыполненную цель.**

**Решение:** `goals.md` — read-only для агента (физически).  
При обновлении `context.md` → автоматическая валидация против `goals.md`.

---

## #80 — Auto-repair loop + Loop detector

**Repair loop делает `run tests → fix → run tests` → loop detector паузирует repair.**

**Решение:** Auto-repair loop шаги явно исключены из loop detector.

---

## #83 — Agent pre-flight plan не включает cost estimate

**Пользователь одобряет план без понимания стоимости «порефакторь весь монорепо».**

**Решение:** Pre-flight plan показывает cost estimate рядом с Approve.  
Композиция существующих фич — не новая инфраструктура.

---

## #86 — `.vibe/prompts/` vs `.vibe/workflows/` — размытая граница

**«Workflow с одним шагом» = промпт. «Промпт с переменными» = workflow. Граница размыта.**

**Решение:** Явная граница:
- **Промпт** = шаблон + placeholders → быстрый одноразовый вызов
- **Workflow** = структурированные шаги с зависимостями → повторяемый процесс

**Критерий:** «нужно одобрение между шагами — workflow, нет — промпт».

---

## #92 — Pre-flight plan drift

**Пользователь одобрил план на 5 файлов → агент обнаружил что нужно 12 → молчаливое расширение.**

**Решение:** При выходе за порог (дефолт 2×) — пауза с обновлённым планом в Manual.  
В Auto — `agent:plan-drift` в аудит-логе без прерывания.

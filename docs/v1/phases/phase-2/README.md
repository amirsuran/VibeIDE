# Фаза 2 — Transparency & Control Suite + агентный UX

> «Ты видишь всё — и управляешь всем.»

Все фичи прозрачности и контроля выходят **единым релизом** с единым нарративом и landing page.  
По отдельности каждая — мелкая утилита. Вместе — дифференциатор.

---

## Содержание Фазы 2

### Transparency Suite (единый релиз)
- Debug my prompt
- Prompt versioning
- Context window visualizer
- Context diff между запросами
- Model fingerprinting
- Reproducible sessions
- Replay сессии агента
- Explain this decision
- Diff annotations
- Sharable debug-link
- Cost attribution per file
- MCP Inspector
- Agent «thinking out loud» mode
- Prompt diff при обновлении IDE

→ [transparency/visibility.md](../../transparency/visibility.md)

### Control Suite (единый релиз)
- Explicit tool approval mode
- Diff preview перед применением (полный — с annotations, confidence, complexity indicator)
- Inline diff review
- Per-file agent permissions
- Git blame в контексте агента
- Agent action history sidebar
- AI diff summarizer
- Agent pre-flight plan
- Context eviction control
- Run tests after apply
- Webhook integration
- LLM-as-judge diff review
- Git worktree isolation
- Stealth mode
- Branching conversations
- Session handoff
- Diff confidence score
- Compliance report export
- Enterprise policy import

→ [transparency/control.md](../../transparency/control.md)

### Агентный UX
- Smart context picker
- Task decomposition UI
- Auto-repair loop
- Agent budget control
- Memory decay
- Custom modes (Architect / Coder / Debugger)
- Community modes marketplace
- Провайдерский dashboard
- Checkpoint UI + Diffoscope
- `.vibe/profiles/`
- Sync через VSCodeSyncFiles
- Model switching mid-task
- Next-edit prediction
- Unified `.vibe/` Config Panel

---

## ✓ Критерии готовности Фазы 2

### Transparency Suite
- [ ] T&C Suite выпущен единым релизом с landing page
- [ ] Debug my prompt показывает полный промпт с параметрами
- [ ] Reproducible sessions воспроизводят последний запрос детерминированно
- [ ] Replay воспроизводит последние 10 сессий
- [ ] Explain this decision работает для последних 10 чекпоинтов
- [ ] Diff annotations отображаются корректно для всех типов изменений
- [ ] Sharable debug-link недоступен в privacy-режиме (UI-индикатор)
- [ ] Thinking out loud mode работает для Claude 3.7+ и OpenAI o-series
- [ ] Prompt diff отображается при каждом обновлении IDE

### Control Suite
- [ ] Custom modes работают; community marketplace показывает 10+ modes
- [ ] MCP marketplace показывает 10+ серверов
- [ ] Inline diff не ломает Extension API
- [ ] Community modes sandbox: shell-tools недоступны без одобрения
- [ ] Agent action history sidebar: откат любого шага работает
- [ ] Diff complexity indicator корректно определяет критические зоны
- [ ] Agent pre-flight plan отображается до начала выполнения; Edit plan работает
- [ ] Context eviction: auto-compression срабатывает при >90% лимита
- [ ] Run tests after apply настраивается и запускает тесты
- [ ] Webhook доставляет уведомление (тест на Slack и generic)
- [ ] LLM-as-judge работает для всех подключённых провайдеров
- [ ] Git worktree isolation: агент не трогает рабочую ветку до Approve
- [ ] Stealth mode: провайдер не кеширует (verified через API response headers)
- [ ] Diff confidence score: 🔴 блокирует Auto режим
- [ ] Export modal: три типа экспорта разграничены в UI
- [ ] Enterprise policy import: locked-constraints не переопределяются (тест)

### Агентный UX
- [ ] Model switching сохраняет checkpoint в аудит-логе
- [ ] `.vibe/profiles/`: переключение применяет нужные constraints и rules
- [ ] Cost attribution per file корректна при prompt caching
- [ ] Auto-repair loop завершает задачу без manual intervention в Auto режиме
- [ ] Next-edit prediction работает в контексте задачи (тест на рефакторинге)
- [ ] Unified Config Panel: изменения сохраняются в нужные `.vibe/` файлы

---

## Следующий шаг

После выполнения всех критериев → **[Фаза 3a](../phase-3a/README.md)**

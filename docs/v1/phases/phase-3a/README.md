# Фаза 3a — CLI, документация, экосистема

> CLI, документация, threat model. Без экспериментальных фич.

---

## CLI инструменты

### Основные
- [ ] `vibe run --auto "..."` — работает в GitHub Actions; `--no-local-constraints`; CI-профиль
- [ ] `vibe explain <file>:<line>` — объяснение строки в контексте всего проекта из терминала
- [ ] `vibe review <branch>` — агент как code reviewer; результаты в IDE и CLI; документация data handling
- [ ] `vibe doctor --ci` — CI-режим; GUI-проверки пропускаются с `[skipped: no GUI]`

### Анализ и история
- [ ] `vibe diff --explain` — объяснить diff между ветками/коммитами простым языком
- [ ] `vibe audit <commit-hash>` — восстановить полный аудит-контекст по hash коммита
- [ ] `vibe changelog` — генерация CHANGELOG из аудит-лога + git history; разделение AI/manual
- [ ] `vibe bisect` — бинарный поиск по checkpoint-ам агента (`vibe bisect good <hash> bad <hash>`)

### Генерация
- [ ] `vibe explain --as-pr-description` — PR description из diff + аудит-лога
- [ ] `vibe explain --for-review` — review notes для каждой изменённой функции
- [ ] `vibe explain --non-technical` — объяснение для PM/stakeholder без кода
- [ ] `vibe explain --to-test` — генерация тест-кейсов из объяснения
- [ ] `vibe diff --split-commits` — разбивка diff на логические атомарные коммиты через AST
- [ ] `vibe run --dry-run` — полная агентная сессия без записи файлов (CLI-вариант)

### Интеграции
- [ ] `vibe review --output sarif` — загружается в GitHub Security tab; стандарт для security tooling
- [ ] `vibe run --otel-endpoint <url>` — экспорт агентных действий как OTel spans
- [ ] `vibe init --for-new-member` — guided tour кодовой базы → `.vibe/onboarding.md`
- [ ] `vibe init --template fastapi|django|nextjs|rust-cli` — workspace templates
- [ ] `vibe init --from jetbrains` — конвертация IntelliJ keymaps, live templates, code style XML
- [ ] `AI code provenance watermark` — `// @vibe-generated: claude-3-5-sonnet, 2025-01-15`; opt-in

---

## Контекст и память

- [ ] **Session memory / Project Brain** — агент начинает автоматически обновлять `.vibe/context.md`
- [ ] **Встроенный бенчмарк моделей** — latency/cost/quality по стандартным задачам
- [ ] **Offline LLM benchmark** — micro-benchmark при первом подключении Ollama-модели; показывает tok/s

---

## Экосистема

- [ ] **`.vibe/schema/` community templates marketplace** — каталог community-шаблонов; импорт по URL с diff
- [ ] **GitHub Issues / Linear context** — агент забирает acceptance criteria из тикета через MCP
- [ ] **VibeIDE как MCP server** — VibeIDE выступает MCP-сервером; другие клиенты запрашивают codebase knowledge
- [ ] **Per-model cost routing** — оптимизация стоимости задачи: «шаги 1-3 через Haiku, финальный через Sonnet»
- [ ] **Loop detector CI mode** — расширенная логика: цикл = одинаковое действие + идентичный результат
- [ ] **Git blame injection protection** — санитизация commit messages и старых строк (риск #58)

---

## Обязательные документы (до Фазы 3a завершения)

- [ ] **Threat model** — workspace isolation, prompt injection, MCP permissions, vision pipeline; покрывает все задокументированные риски
- [ ] **Security FAQ** — отдельная публичная страница: «что уходит наружу»; маркетинговый артефакт
- [ ] **CI/CD integration guide** — как запускать в GitHub Actions / GitLab CI; примеры `.github/workflows/`
- [ ] **Migration guide** — для пользователей обновляющихся с предыдущих версий
- [ ] **Cursor → VibeIDE migration** — не только настройки но и данные
- [ ] **Публичная Transparency Dashboard** — страница на сайте; автообновляется при релизах
- [ ] **Документация расширений** — что расширения могут и не могут делать
- [ ] **Public model leaderboard** — агрегированные anonymous stats из community telemetry

---

## ✓ Критерии готовности Фазы 3a

- [ ] CLI работает в GitHub Actions без ручной настройки; `--no-local-constraints` корректен
- [ ] `vibe explain` выдаёт осмысленный ответ на реальной кодовой базе
- [ ] `vibe review` выдаёт осмысленные комментарии; data handling задокументирован
- [ ] `vibe diff --explain` выдаёт осмысленное объяснение на реальном PR
- [ ] Threat model опубликован и покрывает все задокументированные риски
- [ ] Migration guide опубликован для Cursor → VibeIDE
- [ ] Security FAQ опубликован отдельной страницей
- [ ] CI/CD integration guide опубликован с рабочими примерами
- [ ] Transparency Dashboard обновляется автоматически при каждом релизе
- [ ] `vibe changelog` генерирует CHANGELOG с разделением AI/manual
- [ ] SARIF output: `vibe review --output sarif` загружается в GitHub Actions без ошибок
- [ ] OpenTelemetry: агентные spans видны в локальном Jaeger (тест в CI)

---

## Следующий шаг

После выполнения всех критериев → **[Фаза 3b](../phase-3b/README.md)**

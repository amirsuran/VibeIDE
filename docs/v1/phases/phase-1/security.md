# Фаза 1 — Безопасность агента

## Workspace Isolation

- [ ] Sandbox: агент работает только в рабочей директории
- [ ] Выход за пределы = явный prompt с указанием пути
- [ ] Тест на symlinks за пределами директории (Windows и Linux)
- [ ] WSL2: тест на пути `\\wsl$\...` и `/mnt/c/...`

---

## Agent Safety

- [ ] **Жёсткий дефолтный лимит токенов** — $20 / 500k токенов, включён по умолчанию, настраивается в first-run wizard
- [ ] **Time-based budget** — лимит по wall clock времени; настраивается; включён по умолчанию
- [ ] **Dead man's switch** — пауза при отсутствии подтверждения N минут; DMS не триггерится rate limit 429 и pre-flight plan mode
- [ ] **Loop detector** — автопауза при 3+ одинаковых действиях подряд; показывает последние 5 действий
- [ ] **Rate limit visibility** — визуализация 429; отдельный UI-индикатор «ждём rate limit (~Xs)» (не пауза)

---

## Конфигурация безопасности

- [ ] **Workspace isolation** + `.vibe/ignore` + `.vibe/constraints.json`
- [ ] **Constraints enforcement layer** — детерминированная блокировка, не только промпт
  - Тест: агент физически не может нарушить constraint (тест на bypass)
- [ ] **`.vibe/allowed-models.json`** — whitelist; `vibe doctor` проверяет при старте
- [ ] **`.vibe/` format versioning** — поле `vibeVersion`; блокирующее предупреждение при несовместимой схеме
- [ ] **Startup health check** — валидация `.vibe/` при старте ≤30мс, non-blocking; banner при ошибке

---

## MCP Безопасность

- [ ] **MCP port conflict check** — явная проверка при запуске, понятная ошибка
- [ ] Allowlist доменов для MCP серверов
- [ ] Sandbox-модель для MCP серверов (ограничения shell-tools)

---

## Privacy и Permissions

- [ ] **Agent git identity** — коммиты помечаются `Co-authored-by: VibeIDE Agent`; настраивается; включено по умолчанию
- [ ] **Extension permissions UI** — декларации capability при установке и в настройках
- [ ] **Extension security scanner** — проверка через socket.dev API при установке из Open VSX
- [ ] **Training data opt-out UI** — иконка-индикатор рядом с провайдером (из `models.json` поля `trainingPolicy`)

---

## Prompt Security

- [ ] **Prompt injection guard** — базовая санитизация файлов перед контекстом; warning при работе с внешними репо
- [ ] **Context poisoning detector** — zero-width chars, Unicode bidi overrides, invisible CSS
- [ ] **Privacy-by-default fingerprint stripping** — auto-strip путей, usernames, machine names из промпта; настраивается в `.vibe/privacy.json`

---

## Audit Log

- [ ] Retention ротация (дефолт 30 дней)
- [ ] **GDPR audit log export** — экспорт и полное удаление логов
- [ ] **Audit log search** — полнотекстовый поиск и фильтрация (по типу, файлу, промпту, времени); ≤200мс на 30-дневном логе
- [ ] `auditLogService.ts` — запись асинхронная и буферизованная (не фризит UI)

---

## Large File Policy

- [ ] Предупреждение при добавлении файла >200KB в контекст
- [ ] Варианты: truncate / исключить / добавить целиком (явное подтверждение)
- [ ] `vibe doctor` рекомендует добавить крупные файлы в `.vibe/ignore`

---

## Secret Detection Pipeline

- [ ] Порядок: `secretDetectionService` → Smart context picker → MCP
- [ ] FIM-контекст `autocompleteService.ts` проходит через `secretDetectionService`
- [ ] Тест: файл с `API_KEY=` → autocomplete запрос не содержит значение ключа
- [ ] Тест: `vibe init --from cursor` конвертирует файлы без утечки секретов

---

## Безопасность `.vibe/` миграции

- [ ] **`.vibe/` gitignore wizard** — при `vibe init` вопрос про публичность репо; предложение добавить `permissions.json` в `.gitignore`
- [ ] `vibe doctor` предупреждает если чувствительные файлы не в `.gitignore`

---

## Context Limit Graceful Degradation

- [ ] Live-индикатор заполнения context window во время выполнения агента
- [ ] При 90% лимита — диалог compact / continue / cancel + snapshot
- [ ] Порог настраивается (дефолт 90%)

---

## Agent Resilience

- [ ] **«Pause and explain»** — shortcut паузы агента без отмены задачи
- [ ] **Agent «apology mode»** — при откате после ошибки: явное объяснение root cause + исправленный план
- [ ] **Retry/fallback при outage** — при 5xx диалог с предложением резервного провайдера
- [ ] **Budget alert via email/webhook** — alert при 80% бюджета

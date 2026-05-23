# Фаза 0 — Аудит CortexIDE

## Аудит безопасности

### Телеметрия (два слоя)
- [ ] Microsoft `vscode-telemetry` и `@vscode/extension-telemetry` — что и куда отправляется
- [ ] CortexIDE собственная телеметрия (поверх Microsoft)
- [ ] Задокументировать оба слоя до Фазы 1

> Незадокументированная телеметрия уничтожит репутацию с privacy-аудиторией.

### Crash Reporting
- [ ] Найти Sentry DSN донора (Sentry может быть включён с DSN проекта-донора)
- [ ] Все крэши твоих пользователей могут идти к ним — проверить
- [ ] Отключить/заменить на собственный с opt-in

### Electron Debug-порты
- [ ] Проверить открыты ли порты 9229 и 9230 в сборке CortexIDE
- [ ] В production build — явный флаг `--no-remote-debugging`
- [ ] `vibe doctor` проверяет закрытость портов

> Риск: #38

### Credential Storage
- [ ] API-ключи хранятся через `safeStorage` (macOS Keychain, Windows DPAPI, libsecret)?
- [ ] Или в localStorage / plaintext config?
- [ ] Если нет — реализовать `safeStorage` в Фазе 1

> Риск: #5

### MCP Channel Audit
- [ ] `mcpChannel.ts` / `mcpService.ts` — что именно MCP-серверы могут делать по умолчанию
- [ ] Allowlist доменов для MCP серверов?
- [ ] Sandbox-модель для MCP-серверов?
- [ ] Реализовать allowlist и sandbox в Фазе 1

> Риск: #11

### Vision Pipeline
- [ ] `imageQARegistryContribution.ts` — куда уходят изображения
- [ ] Поведение в privacy-режиме задокументировано?
- [ ] Явное предупреждение при первой отправке изображения — в Фазе 1

> Риск: #12

### Autocomplete Pipeline  
- [ ] Какие файлы `autocompleteService.ts` передаёт в FIM-контекст
- [ ] Проходят ли они через `secretDetectionService`?
- [ ] Если нет — добавить в Фазе 1

> Риск: #65

---

## npm / Electron Аудит

- [ ] `npm audit` на lockfile зависимости CortexIDE
- [ ] Зафиксировать известные CVE
- [ ] CI-джоб: отслеживание версии Electron + алерт при критических CVE

> Риск: #9

---

## auditLogService.ts

- [ ] Запись асинхронная и буферизованная? (синхронная запись фризит UI)
- [ ] Ротация логов реализована?
- [ ] Если нет — реализовать в Фазе 1

> Риск: #22

---

## vectorStore.ts

- [ ] Использует Qdrant/Chroma? (внешние сервисы — противоречат «работает из коробки»)
- [ ] Заменить на sqlite-vec или LanceDB в Фазе 1 (Qdrant/Chroma — опциональный backend)

> Риск: #20

---

## treeSitterService.ts

- [ ] Инкрементальный индекс или full re-index?
- [ ] Есть лимиты глубины/размера?
- [ ] Что происходит если индекс не готов — fallback?
- [ ] Измерить производительность на монорепо 50k+ файлов

> Риск: #21

---

## rollbackSnapshotService.ts + gitAutoStashService.ts

- [ ] Конфигурация взаимодействия между сервисами
- [ ] Поведение в detached HEAD — есть fallback?
- [ ] Совместимость с git submodules?
- [ ] Зафиксировать: `rollbackSnapshotService.ts` — каноничный, `gitAutoStashService.ts` — вспомогательный

> Риски: #19, Фаза 0 решение

---

## offlinePrivacyGate.ts

- [ ] Граница online/offline явная и задокументированная?
- [ ] В privacy режиме — никаких сетевых запросов при RAG-индексировании?
- [ ] Автообновление через GitHub API в privacy-режиме — как разрешается?

> Риски: #25, анализ коллеги #4

---

## Performance Baseline

Измерить на CortexIDE **до начала разработки**:

| Метрика | Цель | Текущий baseline |
|---|---|---|
| Cold start | ≤5с | ? |
| Memory footprint (пустой проект) | ≤600MB | ? |
| Tree-sitter indexing (не блокирует UI) | ≤200мс | ? |
| Audit log write latency | ≤10мс | ? |

Без baseline деградация незаметна.

---

## Системные требования

Измерить реальное потребление и задокументировать в README и на сайте:
- Рекомендуемый минимум: предварительно 8GB RAM, SSD
- Electron + Tree-sitter + sqlite-vec + audit log + MCP = значительная RAM-нагрузка

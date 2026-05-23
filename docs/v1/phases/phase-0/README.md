# Фаза 0 — Подготовка

> До форка. Все пункты обязательны.

## Содержание

| Файл | Содержание |
|---|---|
| [audit.md](audit.md) | Аудит CortexIDE (безопасность, телеметрия, зависимости) |
| [decisions.md](decisions.md) | Архитектурные решения (зафиксировать до форка) |

---

## Цель фазы

Выявить все скрытые проблемы CortexIDE **до того как написана первая строка кода** VibeIDE.  
Зафиксировать архитектурные решения, которые нельзя менять потом без боли.

---

## ✓ Критерии готовности Фазы 0

### Обязательные артефакты
- [ ] `FORK_CHANGES.md` заполнен (каждый изменённый upstream-файл с причиной)
- [ ] Оба слоя телеметрии задокументированы (Microsoft + CortexIDE)
- [ ] Crash reporting найден и план замены готов
- [ ] MCP-канал аудирован, allowlist определён
- [ ] Credential storage проверен (safeStorage — не localStorage)
- [ ] npm lockfile аудит завершён
- [ ] `imageQARegistryContribution.ts` — поведение в privacy-режиме задокументировано
- [ ] Electron debug-порты 9229/9230 аудированы; план отключения в production зафиксирован
- [ ] Лицензия выбрана (MIT / Apache-2.0 совместимость с CortexIDE)
- [ ] GPL-3.0 (Project Manager) совместимость при бандлинге как pre-installed extension — зафиксировано
- [ ] Open VSX работает в dev-сборке; список «что не работает» подготовлен

### Архитектурные решения (см. [decisions.md](decisions.md))
- [ ] Модель снапшотов зафиксирована
- [ ] Vector store выбран (sqlite-vec / LanceDB)
- [ ] `auditLogService.ts` — асинхронность подтверждена
- [ ] Порядок `secretDetectionService → контекст` задокументирован и покрыт тестом
- [ ] `treeSitterService.ts` — лимиты и fallback определены
- [ ] Модель приоритетов `rules.md` задокументирована
- [ ] Agent git identity — формат зафиксирован
- [ ] Атомарность inline diff + rollback зафиксирована
- [ ] Migration path шаблон готов
- [ ] Приоритетный стек настроек (global → profile → directory) задокументирован
- [ ] Token cost forecast — формат диапазона зафиксирован
- [ ] `.vibe/` gitignore strategy определена
- [ ] CI/CD profile strategy задокументирована
- [ ] Constraints enforcement layer спроектирован (детерминированная блокировка)
- [ ] Dead man's switch reset semantics зафиксированы
- [ ] Loop detector semantics зафиксированы
- [ ] Hot-reload `.vibe/` policy задокументирована
- [ ] `.vibe/` format versioning strategy определена
- [ ] Multi-root workspace behaviour задокументировано
- [ ] Provider list update strategy зафиксирована (CDN endpoint + ETag + offline fallback)
- [ ] Agent context limit graceful degradation policy зафиксирована
- [ ] `vibe doctor` split задокументирован (fast / full / ci / repair)
- [ ] Auto-repair loop + Loop detector semantics зафиксированы
- [ ] Gateway threat model создан (до М-Фазы 0)
- [ ] Performance SLA зафиксирован (cold start ≤5с, memory ≤600MB, baseline измерен)
- [ ] i18n foundation: решение о externalize strings принято

---

## Следующий шаг

После выполнения всех критериев → **[Фаза 1](../phase-1/README.md)**

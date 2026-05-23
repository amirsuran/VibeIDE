# Project Manager — pre-installed extension

> Источник: [alefragnani/vscode-project-manager](https://github.com/alefragnani/vscode-project-manager) — GPL-3.0 лицензия, 2.4k⭐, опубликован в Open VSX

## Почему pre-installed

- Быстрое переключение между проектами без «File → Open Recent»
- Автодетект Git/SVN/Mercurial репозиториев — работает из коробки
- Нативная поддержка Remote (SSH/WSL/Containers) — закрывает сценарий WSL2
- Profile support (v13.1) — дополняет `.vibe/profiles/`
- Статус-бар с именем проекта — рядом с Trust Score виджетом

## Архитектура: бандлинг как .vsix (не вендоринг)

**Причина:** GPL-3.0. Вендоринг исходников = наследование GPL-3.0 на весь VibeIDE.

| Подход | Лицензионная чистота |
|---|---|
| ✅ Бандлинг как pre-installed `.vsix` | VibeIDE сохраняет собственную лицензию |
| ❌ Мёрдж исходников в `src/` | Нарушение лицензионной чистоты |

```
extensions/
  project-manager/
    package.json               ← зеркало upstream (для version tracking)
    project-manager-<ver>.vsix ← официальный релиз с Open VSX, НЕ пересобранный
    UPSTREAM.md                ← версия апстрима, дата, причина выбора версии
    vibeide-integration/
      projectManagerBridge.ts  ← интеграция через VS Code Extension API
```

## VibeIDE-специфичные интеграции

Строятся поверх PM через Extension API — не внутри него.

| Интеграция | Приоритет |
|---|---|
| **Sync `projects.json` → `.vibe/profiles/`** — переключение профиля = переключение PM-проекта | 🔴 |
| **`vibe init` регистрирует проект** — автодобавление в PM с тегом `vibe` | 🔴 |
| **`projects.json` через VSCodeSyncFiles** — список проектов одинаков на всех устройствах | 🔴 |
| Тег `.vibe/ ready` — PM помечает проекты с `.vibe/` структурой | 🟡 |
| Агентный контекст — агент знает имя PM-проекта; добавляет в audit-лог | 🟡 |
| Quick-switch в статус-баре — рядом с Trust Score, не дублировать | 🟡 |

## Стратегия обновлений

1. **`UPSTREAM.md`** — версия `.vsix`, дата, причина выбора версии; поле `pinnedReason` если не latest
2. **`sync-project-manager.yml`** — еженедельно проверяет новые релизы на Open VSX → автоматический PR с changelog
3. `.vsix` хранится в директории как бинарный артефакт — никакого submodule

## SBOM

Project Manager должен быть в SBOM с явной пометкой:  
`GPL-3.0 | bundled extension, independent license`

## Remote Development (Риск #27)

PM поддерживает Remote через `remote.extensionKind`.  
WSL2: проекты сохранённые в WSL-сессии видны в локальной только если PM настроен как `workspace`-extension.

## Чеклист

- [ ] **Фаза 0** — проверить GPL-3.0 совместимость; зафиксировать «бандлинг как .vsix, не вендоринг»
- [ ] **Фаза 1** — включить `.vsix` в релизную сборку; `product.json`; `UPSTREAM.md`; `sync-project-manager.yml`; базовый `projectManagerBridge.ts`
- [ ] **Фаза 2** — sync `.vibe/profiles/` ↔ PM-проекты; тег `vibe-ready`; имя проекта → агентный контекст + audit-лог
- [ ] **Будущее** — при необходимости deep integration → запросить у автора dual-license

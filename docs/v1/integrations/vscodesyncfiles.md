# VSCodeSyncFiles — интеграция синхронизации

> Разрабатывается отдельно: [github.com/borodatych/VSCodeSyncFiles](https://github.com/borodatych/VSCodeSyncFiles)

## Стратегия

VSCodeSyncFiles — **канонический источник**, VibeIDE — **downstream**.

```
VSCodeSyncFiles (standalone repo, Open VSX)
        ↓ version pin / submodule
    VibeIDE (pre-installed, глубокая интеграция)
```

**Почему не встроить:**
- Плагин в Open VSX → отдельный канал привлечения пользователей из обычного VS Code
- Разные контрибьюторы, меньший барьер входа
- Нет форк-дивергенции — плагин не отстаёт от IDE

## Что уже работает из коробки

- Данные в облаке **пользователя** (OneDrive/Drive/Dropbox/YaDisk) — никаких серверов VibeIDE
- AES-256-GCM шифрование на клиенте; ключи у пользователя
- Conflict resolution с трёхсторонним сравнением
- Watch-режим с адаптивными интервалами
- Offline-режим с очередью изменений
- Снимки и история версий файлов

## Что нужно добавить для VibeIDE

Все изменения идут как PR в репозиторий плагина.  
Активируются только в VibeIDE через `vscode.env.appName`.

| Интеграция | Приоритет |
|---|---|
| **`.vibe/` workspace type** — нативная поддержка как отдельного именованного workspace | 🔴 |
| **`.vibe/ignore` integration** — файлы из `.vibe/ignore` не попадают в sync | 🔴 |
| **Profile ↔ branch sync hook** — смена git-ветки → автопереключение sync-workspace | 🔴 |
| **Stealth mode hook** — в Stealth mode watch и авто-sync отключаются | 🔴 |
| **Conflict resolution в контексте агента** — при конфликте `.vibe/context.md` учитывать аудит-лог | 🟡 |
| **`vibe doctor` интеграция** — статус sync в health check | 🟡 |

## Race condition с агентом (Риск #64)

Агент обновляет `.vibe/context.md` + VSCodeSyncFiles синхронизирует = конфликт.

**Решение:**
- Агент пишет через атомарный write с `sessionId`-меткой
- При конфликте: побеждает запись с более новым `agentTimestamp`
- Project Manager `projects.json`: указывать `projectManager.projectsLocation` в папку VSCodeSyncFiles

## Фазы интеграции

| Фаза | Когда | Что |
|---|---|---|
| S-0 | После Фазы 1 IDE | Бандлинг как pre-installed extension; базовая документация |
| S-1 | После Фазы 2 IDE | PR в плагин: `.vibe/` workspace type, `.vibe/ignore` integration, Stealth mode hook |
| S-2 | После Фазы 3 IDE | PR в плагин: profile ↔ branch sync, `vibe doctor` интеграция, conflict resolution с аудит-логом |

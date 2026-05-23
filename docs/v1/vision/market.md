# Анализ рынка

## Конкуренты

| Проект | Тип | Stars | Статус | Лицензия |
|---|---|---|---|---|
| [Void](https://github.com/voideditor/void) | Standalone IDE (VS Code fork) | 28.7k | ⚠️ Заморожен | Apache-2.0 |
| [CortexIDE](https://github.com/OpenCortexIDE/cortexide) | Standalone IDE (Void fork) | 87 | ✅ Активен | MIT |
| [Kilo Code](https://github.com/Kilo-Org/kilocode) | VS Code extension + CLI + JetBrains | 18.8k | ✅ Активен | MIT |
| [Continue.dev](https://github.com/continuedev/continue) | VS Code + JetBrains extension | 25k+ | ✅ Активен | Apache-2.0 |
| [Claude Code](https://claude.ai/code) | CLI agentic tool (standalone) | Закрытый | ✅ Активен | Закрытый |

**Вывод:** CortexIDE — лучшая база для standalone IDE. Kilo Code — лучший UX/фичесет для AI-агента.

> ⚠️ JetBrains-поддержка Kilo Code находится в beta — не представлять как завершённую.

---

## Стратегия: Fork CortexIDE + фичи Kilo Code

### Почему CortexIDE как база

CortexIDE уже добавил ~70 новых файлов поверх Void/VS Code:

| Файл | Функция |
|---|---|
| `modelRouter.ts` | Task-aware routing по моделям |
| `repoIndexerService.ts` + `treeSitterService.ts` | RAG с Tree-sitter AST |
| `rollbackSnapshotService.ts` + `gitAutoStashService.ts` | Снапшоты и откат |
| `auditLogService.ts` | Аудит всех AI-действий |
| `offlinePrivacyGate.ts` | Полный offline/privacy режим |
| `vectorStore.ts` | Qdrant/Chroma vector store |
| `secretDetectionService.ts` | Детекция секретов в коде |
| `mcpChannel.ts` + `mcpService.ts` | Нативный MCP |
| `autocompleteService.ts` | FIM autocomplete |
| `imageQARegistryContribution.ts` | Vision/multimodal |

> ⚠️ **Риск #50:** CortexIDE — 87 stars, один активный автор. При его уходе нужен план перехода на прямой форк `microsoft/vscode`. Мониторинг: если нет коммитов 60+ дней — алерт в CI.

### Что взять из Kilo Code

| Фича | Приоритет | Сложность |
|---|---|---|
| Custom modes (Architect / Coder / Debugger + кастомные) | 🔴 Высокий | Средняя |
| MCP Server Marketplace | 🔴 Высокий | Средняя |
| 500+ провайдеров/моделей | 🔴 Высокий | Низкая |
| Импорт настроек из Cursor/Windsurf | 🔴 Высокий | Низкая |
| CLI (`vibe run --auto "..."`) для CI/CD | 🟡 Средний | Средняя |
| Browser automation (Playwright) | 🟡 Средний | Высокая |
| JetBrains плагин | 🟢 Низкий | Высокая |

---

## Claude Code — паттерны эффективности (применимые в VibeIDE)

Claude Code решает задачи с минимальным количеством промптов за счёт конкретных технических паттернов.

| Паттерн | Механизм | Эффект |
|---|---|---|
| **PTC (Programmatic Tool Calling)** | Агент пишет Python для оркестрации инструментов в sandbox; только финальный `stdout` в контексте | 37% меньше токенов, 10x latency для multi-tool workflows |
| **MCP tool deferral** | Описания MCP-инструментов откладываются до востребования | ~85% снижение токенов на tool definitions |
| **Dynamic context filtering** | Результаты инструментов фильтруются в sandbox до попадания в контекст | ~24% fewer input tokens |
| **Exploration phase** | До изменения — авто `grep`/`git log`/`cat`; понимает кодовую базу изнутри | Меньше back-and-forth |
| **Auto-repair loop** | После Apply — lint → types → tests → fix до зелёного | Завершает задачу за один промпт |
| **Assumption-first** | Делает обоснованные допущения вместо вопросов; показывает в pre-flight plan | Минус 2–3 back-and-forth |

> **Вывод:** все паттерны совместимы с нарративом «ты управляешь всем».  
> ⚠️ PTC — Claude API-специфичная фича. Для других провайдеров — parallel tool calls fallback. Для Ollama — sequential fallback.

→ Подробно о реализации: [agent/tool-executor.md](../agent/tool-executor.md)

---

## Upstream sync — главный риск существования

Главный риск — отставание от VS Code upstream (именно это убило Void).

1. `git remote upstream` → `microsoft/vscode`
2. CI-проверка: отставание > 2 недель → блокирующий алерт в PR
3. Ветка `upstream-sync` для мёрджей
4. `FORK_CHANGES.md` — каждый изменённый upstream-файл с причиной
5. Upstream conflict UI — интерфейс для разрешения конфликтов
6. SBOM с каждым релизом

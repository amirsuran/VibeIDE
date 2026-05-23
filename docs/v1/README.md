# VibeIDE v1 — Навигация

> **📄 Public docs** — эта папка содержит публичные архитектурные документы (будущий сайт VibeIDE.io). Нормативные contracts для разработчиков → [`references/v1/`](../../references/v1/README.md).

> Cursor-like standalone IDE, open-source, без подписки.  
> **Нарратив: «Ты видишь всё — и управляешь всем»**

---

## Как читать эти документы

Документация разбита на независимые модули. Стартовая точка — **Фаза 0**.  
Каждая фаза имеет чёткие критерии готовности — пока они не выполнены, следующая не начинается.

```
Фаза 0 → Фаза 1 → Фаза 2 → Фаза 3a → Фаза 3b
(подготовка) (форк) (T&C Suite) (CLI) (эксперименты)
```

---

## Структура

### Стратегия и видение
| Файл | Содержание |
|---|---|
| [vision/narrative.md](vision/narrative.md) | Нарратив, позиционирование, конкуренты |
| [vision/market.md](vision/market.md) | Анализ рынка, паттерны Claude Code |
| [vision/north-star.md](vision/north-star.md) | 10 MVP-фич без которых не запускаться |

### Агентный runtime
| Файл | Содержание |
|---|---|
| [agent/trust-score.md](agent/trust-score.md) | Trust Score: Manual / Supervised / Auto |
| [agent/safety.md](agent/safety.md) | Dead man's switch, loop detector, workspace isolation, token limits |
| [agent/context.md](agent/context.md) | Context management, large file policy, smart context picker |
| [agent/tool-executor.md](agent/tool-executor.md) | AgentToolExecutor: PTC / parallel / sequential |
| [agent/auto-repair.md](agent/auto-repair.md) | Auto-repair loop: lint → types → tests → fix |

### `.vibe/` конфигурационная система
| Файл | Содержание |
|---|---|
| [config/overview.md](config/overview.md) | Обзор `.vibe/` директории, format versioning |
| [config/constraints.md](config/constraints.md) | `.vibe/constraints.json` — детерминированный enforcement |
| [config/rules.md](config/rules.md) | `.vibe/rules.md` — AI-инструкции с наследованием |
| [config/profiles.md](config/profiles.md) | `.vibe/profiles/` — именованные профили настроек |
| [config/other-files.md](config/other-files.md) | pinned.json, ignore, goals.md, allowed-models.json, persona.json |

### Transparency & Control Suite
| Файл | Содержание |
|---|---|
| [transparency/visibility.md](transparency/visibility.md) | «Видишь всё» — debug prompt, context viz, fingerprint, audit log |
| [transparency/control.md](transparency/control.md) | «Управляешь всем» — tool approval, diff preview, git identity |

### Интеграции
| Файл | Содержание |
|---|---|
| [integrations/vscodesyncfiles.md](integrations/vscodesyncfiles.md) | VSCodeSyncFiles — синхронизация `.vibe/` между устройствами |
| [integrations/synthwave84.md](integrations/synthwave84.md) | SynthWave '84 — встроенная тема по умолчанию |
| [integrations/project-manager.md](integrations/project-manager.md) | Project Manager — pre-installed extension |

### Риски
| Файл | Содержание |
|---|---|
| [risks/security.md](risks/security.md) | Безопасность: телеметрия, credentials, MCP, injection |
| [risks/architecture.md](risks/architecture.md) | Архитектура: снапшоты, vector store, race conditions |
| [risks/product.md](risks/product.md) | Продукт: конфликты фич, UX, edge cases |

### Монетизация
| Файл | Содержание |
|---|---|
| [monetization.md](monetization.md) | Три трека: донаты, gateway, экосистема |

---

## Фазы разработки

| Фаза | Папка | Суть |
|---|---|---|
| **Фаза 0** | [phases/phase-0/](phases/phase-0/README.md) | Аудит CortexIDE, архитектурные решения |
| **Фаза 1** | [phases/phase-1/](phases/phase-1/README.md) | Форк, безопасность, первый публичный релиз |
| **Фаза 2** | [phases/phase-2/](phases/phase-2/README.md) | Transparency & Control Suite (единый релиз) |
| **Фаза 3a** | [phases/phase-3a/](phases/phase-3a/README.md) | CLI, документация, threat model |
| **Фаза 3b** | [phases/phase-3b/](phases/phase-3b/README.md) | Экспериментальные фичи (multi-agent, sandbox) |

---

## Монетизация (параллельный трек)

| М-Фаза | Когда |
|---|---|
| М-0 | До Фазы 1: GitHub Sponsors + Open Collective открыты |
| М-1 | После Фазы 2: Gateway в beta |
| М-2 | После Фазы 3: Корпоративное спонсорство |

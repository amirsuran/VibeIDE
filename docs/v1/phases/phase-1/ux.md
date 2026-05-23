# Фаза 1 — UX и дистрибуция

## Trust Score виджет (North Star MVP)

- [ ] Постоянный виджет в статус-баре (Manual 🟢 / Supervised 🟡 / Auto 🔴)
- [ ] Keyboard shortcut для переключения (дефолт: `Ctrl+Shift+T`)
- [ ] Полностью управляется с клавиатуры — без мыши

→ [agent/trust-score.md](../../agent/trust-score.md)

---

## First-run Security Wizard

Выбор модели доверия конфигурирует:
- Tool approval mode
- Workspace isolation
- Token limits
- Trust Score уровень
- Тема (vibe = SynthWave '84, compliance = стандартная тёмная)
- Update channel (stable / beta / nightly)
- Embedding-провайдер (отдельно от completion)
- Agent verbosity (ask_before_assume / assumption_first / silent)

- [ ] Wizard проходится без ошибок
- [ ] Все настройки применяются корректно

---

## SynthWave '84 — встроенная тема

- [ ] Вендорить в `extensions/vibeide-synthwave84/`; стандартная структура extension
- [ ] Реализовать Neon Glow нативно (без хака Custom CSS — форк позволяет)
- [ ] Задать как дефолтную тему в `product.json`
- [ ] Создать `UPSTREAM.md` с версией апстрима
- [ ] Настроить `sync-synthwave84.yml` CI-workflow (автоматические PR при обновлениях апстрима)

→ [integrations/synthwave84.md](../../integrations/synthwave84.md)

---

## Project Manager — pre-installed extension

- [ ] Включить официальный `.vsix` из Open VSX в релизную сборку
- [ ] Прописать в `product.json` как pre-installed
- [ ] Создать `UPSTREAM.md`
- [ ] Настроить `sync-project-manager.yml` (еженедельная проверка новых релизов)
- [ ] Базовый `projectManagerBridge.ts`: `vibe init` → автодобавление; `projectsLocation` → папка VSCodeSyncFiles

→ [integrations/project-manager.md](../../integrations/project-manager.md)

---

## Provider UX

- [ ] **Ollama из коробки** — автодетект; onboarding wizard
- [ ] **LM Studio** — автодетект
- [ ] **Provider status widget** — статус провайдеров в реальном времени
- [ ] **Credential rotation UI** — real-time 401 уведомления; кнопка «протестировать ключ»
- [ ] **Provider capability probe** — при первом подключении: probe на function calling, vision, streaming, extended thinking; UI скрывает несупортируемые фичи
- [ ] **Training data opt-out UI** — иконка рядом с провайдером
- [ ] **`AgentToolExecutor`** — базовая реализация (ptc / parallel / sequential); UI-индикатор активного режима

---

## Миграция

- [ ] **Импорт из Cursor/Windsurf** — конвертер rules, keybindings
- [ ] **`vibe init --from continue`** — конвертация `config.json` из Continue.dev
- [ ] **`vibe init --from cursor|windsurf|aider|jetbrains`** — с secretDetectionService до конвертации
- [ ] **`vibe init` — полная команда инициализации** — структура `.vibe/` с валидными дефолтами; шаблоны solo/team/compliance

---

## Chat UX

- [ ] **`@file` / `@symbol` mention** — явное добавление в контекст
- [ ] **`@web` / `@docs` контекст** — поиск как контекст; opt-in в privacy-режиме
- [ ] **Slash commands** — `/fix`, `/tests`, `/explain`, `/refactor`
- [ ] **Prompt Library** — поддержка `.vibe/prompts/*.md`; доступ через `/my:имя`
- [ ] **«Explain this line» shortcut** — `Ctrl+.` на строке → inline объяснение за ≤2с
- [ ] **«Explain before ask» pre-send preview** — inline подсказка под полем ввода
- [ ] **«Why this context?» inline tooltip** — hover на файл в контексте

---

## Токены и стоимость

- [ ] **Token cost forecast** — диапазон (worst case / с кэшем) до отправки; post-response индикатор кэша
- [ ] **Pinned context** — поддержка `.vibe/pinned.json`; отображается в контексте отдельным разделом
- [ ] **MCP tool deferral** — откладывание при превышении 10% контекста

---

## AI инструменты

- [ ] **Semantic codebase search** — natural language поиск через `vectorStore.ts` + RAG
- [ ] **`vibe commit`** — AI-генерация conventional commit message из diff + аудит-лога
- [ ] **Gutter indicators** — строки написанные агентом в текущей сессии (отдельный цвет)
- [ ] **«Freeze this code»** — ПКМ → Заморозить → constraint одним кликом
- [ ] **Codebase exploration phase** — перед первым изменением агент автоматически изучает кодовую базу; показывается в pre-flight plan

---

## Keyboard-first UX (обязательно)

- [ ] Trust Score виджет — keyboard accessible
- [ ] Tool approval — keyboard accessible
- [ ] Diff review — keyboard accessible
- [ ] **Keybinding conflict resolver** — при установке расширения с конфликтующими shortcuts; UI для разрешения
- [ ] Документировать все keyboard shortcuts

---

## Агент

- [ ] **Terminal output awareness** — агент видит вывод терминала в реальном времени (opt-in)
- [ ] **LSP diagnostics awareness** — агент видит ошибки типизации, unresolved imports, предупреждения линтера
- [ ] **`vibe run --dry-run`** — агент выполняет всё без записи файлов; показывает pre-flight plan + полный diff
- [ ] **Per-tool-call rationale** — в Explicit approval mode: одно предложение «почему» к каждому tool-use
- [ ] **Agent verbosity control** — настройка `ask_before_assume` / `assumption_first` / `silent`
- [ ] **Progressive disclosure UI** — beginner (Trust Score + чат + diff) / power user (весь T&C Suite)
- [ ] **Offline-first UX** — кнопка «работать без сети», индикатор режима
- [ ] **Local embedding model** — в first-run wizard; в privacy режиме принудительно Ollama

---

## Keyboard Shortcuts (зафиксировать)

| Действие | Дефолтный shortcut |
|---|---|
| Переключить Trust Score | `Ctrl+Shift+T` |
| Approve tool use | `Enter` / `Y` |
| Reject tool use | `Escape` / `N` |
| Apply diff | `Ctrl+Enter` |
| Reject diff | `Ctrl+Backspace` |
| «Explain this line» | `Ctrl+.` |
| «Pause and explain» | `Ctrl+Shift+P` |

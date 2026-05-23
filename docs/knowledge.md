# Knowledge Base — VibeIDE

> Файл декомпозирован 2026-05-09. Полная база знаний разложена по доменам в папке [knowledge/](knowledge/).

## Точка входа

→ **[knowledge/README.md](knowledge/README.md)** — индекс с базовыми принципами и навигацией по разделам.

## Структура

- [knowledge/architecture/](knowledge/architecture/) — архитектурные решения (chat pane, plans/agents, LLM, orphan services)
- [knowledge/ui/](knowledge/ui/) — CSS, scope-tailwind, темы, view-инфраструктура
- [knowledge/chat-ux/](knowledge/chat-ux/) — режимы чата, attachments, шорткаты, repair loop
- [knowledge/vibe-dotfolder/](knowledge/vibe-dotfolder/) — `.vibe/` config: шаблон, GUIDELINES playbook, формы, стек настроек
- [knowledge/i18n/](knowledge/i18n/) — language pack, NLS-индексы, перевод React/настроек
- [knowledge/build/](knowledge/build/) — Windows toolchain, native modules, portable, sync upstream
- [knowledge/git-and-tools/](knowledge/git-and-tools/) — git flow, AI co-author hook, vibe doctor, ночной прогон, `bin/`
- [knowledge/runtime-quirks/](knowledge/runtime-quirks/) — `IEditorService`, `ServicesAccessor`, BOM, ESM language servers
- [knowledge/assets/](knowledge/assets/) — лого, welcome онбординг
- [knowledge/patterns/](knowledge/patterns/) — кросс-доменные паттерны и footguns (lessons из roadmap-max прогонов)
- [knowledge/agent-collaboration/](knowledge/agent-collaboration/) — правила работы агента: workflow / релизный протокол / permissions

## Куда добавлять новые записи

Подходящий тематический файл в одной из папок выше. Не плодить новые верхнеуровневые директории без необходимости.

Если категория действительно новая — создать файл и добавить ссылку в [knowledge/README.md](knowledge/README.md).

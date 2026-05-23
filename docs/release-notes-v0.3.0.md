> **Breaking:** удалена встроенная копия расширения **GitHub Copilot** и весь связанный CI/build pipeline. Если использовали — установите Copilot из marketplace вручную. Внутренний агентский стек VibeIDE (chat, persona, MCP, plan/roadmap-agent) работает независимо — пользователю обычно ничего не нужно делать.

## ✨ Новое

- **Project Commands** — система проектных команд через `.vibe/commands/*.spec.md`: form-based редактор, валидатор полей, registry и keybinding label, terminal-mode launch policy, status-bar formatter, top-bar pinned filter, community catalog import + visual diff, doctor audit/repair, first-run init template, onboarding pin-hint, stealth/privacy redactor, workspace-wins merge для globalPaths, chord allocator, toolbar position decoder.
- **Vibe Projects → Favorites pane** — переработанный UI: переключение list/tags, новые команды (`saveProject`, `listProjects`, `viewAsList`, `viewAsTags`, `filterByTag`, `collapseAll`), активити-иконка на FA6 Regular, контекст-кеи для меню.
- **Chat composer fullscreen modes** — два режима в самой панели чата: **Maximize** (скрыть sidebar/auxbar/panel + развернуть редактор) и **Zen** (то же + спрятать табы). Кнопки внутри композера, исходный toggle из заголовка auxbar убран.
- **Drag-and-drop в чат** — перетаскивание файлов из explorer в auxbar-чат теперь стейджит их в композер (а не открывает в редакторе). Внутренние перетаскивания вкладок не затрагиваются; image/PDF blob-дропы — по старому пути.
- **i18n pipeline** — qps-ploc псевдо-локаль с e2e leak detector, NLS live-reload (FNV-1a hash diff + group), Crowdin webhook (HMAC verifier + PR composer), bundle ↔ vibeVersion drift classifier, fallback chain resolver (locale→base→english→key), placeholder round-trip validator, LLM-assisted draft helpers, language-pack VSIX shape skeleton, README freshness shields, grace-period CI gate.
- **CLI: единая точка `vibe`** — `--version`, `vibe doctor`, `vibe leak-check`, `vibe i18n-migrate`, `vibe agent-reset-leases`, `vibe release-lint`, `vibe roadmap-sync`, `vibe docs-dedup`, `vibe services-inventory`. CLI ↔ IDE version mismatch detector; `npm scripts` ↔ CLI alignment static check.
- **Background agent + roadmap-agent infra** — IPC envelope decoder + lifecycle FSM (idle→done), execution loop FSM + item ranker, subagent isolation policy (worker/child/inline), MCP sampling/createMessage envelope + consent decision, persona marketplace catalog + import orchestrator.
- **Next-edit + completion** — LLM prompt builder (chat+fim) + completion parser, completion LRU cache + cursor-position keying, partial-response retry cache + resume-from helper, streaming gap watchdog FSM (typing/waiting/retry/cancel).
- **Updater** — silent-installer args decoder + per-OS spec + lifecycle FSM.
- **Spec-driven** — parser-diff heuristic + sentinels для swagger-parser/graphql-js.

## 🚀 Производительность

- **Streaming gap watchdog FSM** — корректная отработка пауз в потоковом ответе модели (typing/waiting/retry/cancel) без артефактов в UI.
- **Completion LRU cache + cursor-position keying** — снижение повторных вызовов модели при частых правках в одной строке.
- **Retry cache** — переиспользование частичного ответа при таймаутах; resume-from вместо полного перезапроса.
- **Chat tabs LRU eviction** — pure-helper для предсказуемого вытеснения старых вкладок.

## 🔒 Безопасность

- **Strict-mode outbound URL allowlist** — явный список разрешённых исходящих хостов; всё остальное блокируется.
- **NL → shell safety analyzer** — классификатор "опасно/безопасно" перед выполнением сгенерированной shell-команды.
- **Prompt sanitizer (`sanitizePromptText`)** — pure-helper защиты от prompt injection в пользовательских строках.
- **A2UI label-required guard** — CI-чек на изменения allowlist'а A2UI: positive allowlist вместо prefix-фильтра.
- **Provider-proxy auth-headers redaction** — явный список заголовков под redact (Authorization, X-API-Key и т.п.) + тесты.
- **AI debugging context formatter** — markdown-формат debug-контекста для модели с secret-redact + breakpoint ranker.
- **Project Commands stealth/privacy audit redactor** — двойной формат (logged vs displayed) для audit-событий.
- **SECURITY.md** — расширена политика раскрытия (90-day disclosure window).

## ♻️ Внутреннее

- **Удалено `extensions/copilot/`** (3937 файлов) и весь связанный pipeline: build/azure-pipelines/copilot/*, product-copilot*.yml, downloadCopilotVsix.ts, copilot-migrate-pr.ts, build/lib/copilot.ts, copilot-setup-steps/chat-lib-package/chat-perf workflows, copilot-{check-test-cache,compile} steps. Это **breaking** для тех, кто пользовался встроенной копией; replacement — поставить Copilot extension с marketplace.
- **Settings UI** — открытие через `IEditorService.openEditor` вместо `IEditorGroupsService.activeGroup.openEditor` (по гайдлайну).
- **MCP sampling/createMessage** — envelope decoder + consent decision FSM.
- **Subagent isolation policy** — выбор worker/child/inline + handoff per kind.
- **Persona system** — marketplace catalog URL + import orchestrator с `touchesSensitiveFields` инвариантом.
- **Plan lifecycle FSM** — refused transitions без advance from-state; canonical scenarios для unit + integration.
- **Permissions, agent-lock, EH crash recovery** — adoption + window-lock guard, GDPR manifest, release smoke acceptance gate.
- **CI workflow audit** — кросс-ссылки на 8 рабочих процессов в roadmap.
- **Husky + lint-staged config skeleton** — pre-commit hook фундамент.

## 📦 Сборка

- **Cross-platform release scripts** — `release-macos.sh`, `release-linux.sh` (skeleton) в дополнение к `release-windows.ps1`.
- **Unified release manifest composer + lookup** — единое описание артефактов для всех платформ.
- **Release smoke acceptance gate** — обязательный быстрый прогон перед `gh release create`.
- **`vibe release-lint`** — линтер release notes перед публикацией.
- **`vibe roadmap-sync`** — pre-commit warner для дрейфа `docs/roadmap.md`.
- **`vibe docs-dedup`** — поиск дубликатов basenames между `docs/v1` и `references/v1`.
- **`vibe services-inventory`** — services vs roadmap audit.
- **`vibe-leak-check`** — disposable hygiene linter + baseline.
- **`vibe-plan-merge-driver`** — git custom merge driver для plans.
- **CLI ↔ IDE version mismatch detector** — runtime проверка.

---

### Поддержать проект

Если VibeIDE оказалось полезным — буду рад благодарности.
Лицензия MIT, подписки нет, бэкдоров не завезли. Если хочется отблагодарить — кнопка ниже.

<a href="https://raw.githubusercontent.com/borodatych/VSCodeSyncFiles/main/media/QR-Code.jpg" target="_blank">
  <img src="https://raw.githubusercontent.com/borodatych/VSCodeSyncFiles/main/media/QR-Code.jpg" width="120" alt="QR-код для поддержки проекта">
</a>

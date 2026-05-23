# Риски — безопасность

## #1 — Лицензионный конфликт с VS Code Marketplace

**VS Code Marketplace запрещает использование в форках.**

**Решение:** Open VSX Registry (~60-70% популярных расширений).  
**Критерий:** список «что не работает» опубликован **до первого анонса**.

---

## #3 — Телеметрия — два слоя

**Microsoft `vscode-telemetry` + CortexIDE собственная телеметрия** — оба слоя нужно аудировать отдельно.

**Решение:** До Фазы 1 — аудит обоих слоёв, полная документация.  
**Альтернатива:** Differential privacy агрегация вместо opt-out телеметрии.

---

## #4 — Crash reporting донора

**Sentry может быть включён с DSN проекта-донора** — все крэши идут к ним.

**Решение:** Найти и заменить в рамках аудита телеметрии.

---

## #5 — Credential storage

**Форки часто хранят API-ключи в localStorage или plaintext.**

**Решение:** Все credentials через `safeStorage` (macOS Keychain, Windows DPAPI, libsecret).  
**Аудит в Фазе 0.**

---

## #6 — Code signing и дистрибуция

**macOS без notarization = «App is damaged» для 100% пользователей.**  
**Windows без EV-сертификата = SmartScreen на каждом запуске.**

**Решение:** Заложить в бюджет и план Фазы 1.

---

## #11 — MCP security audit

**`mcpChannel.ts` / `mcpService.ts` — потенциально shell-доступ для внешнего сервера.**

**Решение (Фаза 0):** Аудит MCP-канала; allowlist доменов; sandbox-модель для MCP-серверов.

---

## #12 — Vision pipeline и утечка изображений

**Скриншот с паролем уходит в vision-модель через облако — для privacy-аудитории неочевидно.**

**Решение:** Явное предупреждение при первой отправке изображения.  
**В privacy-режиме — только локальные vision-модели.**

---

## #16 — Secret detection в авто-контексте

**Smart context picker может затянуть `.env` до срабатывания `secretDetectionService`.**

**Решение:** Явный порядок: `secretDetectionService` запускается **до** формирования авто-контекста.  
Тест на этот порядок.

---

## #18 — Community modes + prompt injection

**Импорт mode по URL — прямой вектор вредоносного системного промпта.**

**Решение:** Sandbox для импортированных modes. Diff промпта перед активацией.  
SHA-256 хеш до активации. Ed25519 подпись — опционально.

---

## #23 — secretDetectionService vs mcpChannel

**MCP серверы получают контекст файлов, включая секреты — до детекции.**

**Решение:** `secretDetectionService` запускается до формирования контекста для MCP.  
Тест на этот порядок.

---

## #26 — Prompt injection через кодовую базу

**`<!-- IGNORE PREVIOUS INSTRUCTIONS -->` в файлах — реальный вектор.**

**Решение:** Базовая санитизация контента файлов. Warning при работе с внешними репо.

---

## #29 — Extension permissions — молчаливый доступ

**Расширения имеют доступ к `vscode.workspace.fs`, сети, shell без уведомления.**

**Решение:** Extension permissions UI — декларации capability при установке (Фаза 1).

---

## #35 — `.vibe/` файлы в публичных репозиториях

**`constraints.json` и `permissions.json` могут содержать внутренние паттерны.**

**Решение:** `vibe doctor` проверяет `.gitignore` перед первым коммитом.  
Wizard при `vibe init` предлагает добавить в `.gitignore`.

---

## #38 — Открытые debug-порты Electron

**Порты 9229/9230 открыты в production — любой процесс может подключиться к Electron.**

**Решение:** `vibe doctor` проверяет порты. В release build — флаг `--no-remote-debugging`.  
**Аудит в Фазе 0.**

---

## #58 — Git blame как вектор prompt injection

**Commit messages и старые строки из git истории — отдельный вектор инъекции.**

**Решение:** Prompt injection guard распространяется на git blame контекст (Фаза 3a).  
Документировать в Threat model.

---

## #63 — Key recovery при потере ключа шифрования

**Потеря ключа шифрования аудит-логов = безвозвратная потеря истории.**

**Решение:** При включении шифрования — **обязательное сохранение recovery phrase** (BIP39, 24 слова).  
Опциональный key escrow через VSCodeSyncFiles.

---

## #65 — Autocomplete обходит secret detection

**`autocompleteService.ts` делает FIM-запросы при каждом нажатии клавиши — отдельный вектор утечки.**

**Решение:** Аудит FIM-контекста в Фазе 0. FIM-контекст проходит через `secretDetectionService`.  
Тест: файл с `API_KEY=` → autocomplete payload не содержит значение ключа.

---

## #70 — `vibe init --from cursor` — утечка секретов

**`.cursor/rules` может содержать API-ключи** — конвертация без санитизации = утечка.

**Решение:** `secretDetectionService` запускается до начала конвертации.  
Интерактивный редактор для redact/replace при обнаружении потенциальных секретов.

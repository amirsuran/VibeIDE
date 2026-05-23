# Windows toolchain и нативные модули

← [Knowledge Index](../README.md)

VS C++ Build Tools, MSB8040 Spectre, native modules, ripgrep, `@vscode/vsce-sign`.

---

## [баг] npm install — требует Visual Studio C++ toolchain на Windows

**Контекст:** первая попытка `npm install` в VibeIDE repo на Windows.

**Суть:** `preinstall.js` проверяет наличие VS2022/VS2019 с C++ workload. Ошибка: `missing any VC++ toolset`. Нужно установить **Visual Studio Build Tools 2022** с workload **"Desktop development with C++"** (не просто "core features"). Команда: `winget install Microsoft.VisualStudio.2022.BuildTools --override "--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended --quiet"`. После установки `npm install` работает нормально.

**Применение:** при настройке dev окружения на Windows.

---

## [vscode] Windows: `node-gyp` / MSB8040 Spectre-mitigated libraries

**Контекст:** локальный **`npm ci`** на Windows, сборка **`@vscode/deviceid`** (и др. нативные модули) падает с **MSB8040** (2026-05).

**Суть:** в **Visual Studio Installer → Modify → Individual components** нужно установить **MSVC v143 (или используемый toolset) — Spectre-mitigated libs** для нужной архитектуры. Без этого MSBuild отклоняет проект. Отдельно: **`EBUSY`** при очистке **`node_modules`** — закрыть процессы, держащие `.node` (запущенный Electron из репо, антивирус), затем повторить установку.

**Применение:** onboarding Windows dev и диагностика «сломался `npm ci` после обновления VS Build Tools».

---

## [vscode] Windows: нет .node / rg.exe после install (Electron native + ripgrep)

**Контекст:** `./run-dev.bat` с **`Could not locate the bindings file`** (`policy-watcher`, **`spdlog`**, **`windows-mutex`**, …), **`Cannot find ../build/Release/vscode-sqlite3.node`**, **`native-keymap`**, **`deviceid`/windows.node**, **`native-is-elevated`/iselevated**, **`@vscode/windows-registry`/winregistry**; **`spawn ... ripgrep\\bin\\rg.exe ENOENT`**. Частый корень — **`npm install --ignore-scripts`**, оборванный postinstall или ошибка node-gyp.

**Суть:** сборка должна быть для **Electron** (корневой `.npmrc`: `disturl=https://electronjs.org/headers`, `runtime=electron`, `target=…`). **MSB8040** — в нескольких `binding.gyp` / `deps/sqlite3.gyp` задано `SpectreMitigation`; без Spectre-библиотек в VS Build Tools сборка падает. В VibeIDE **`patch-package`** снимает это требование для: `@vscode/policy-watcher`, **`native-keymap`**, **`native-is-elevated`**, **`@vscode/windows-registry`**, **`@vscode/spdlog`**, **`@vscode/sqlite3`** (в т.ч. **`deps/sqlite3.gyp`**), **`@vscode/windows-mutex`**, **`@vscode/deviceid`** — см. **`patches/*.patch`**.

**Ручное:** из корня `npm rebuild` перечисленных пакетов; **`rg.exe`**: `node node_modules/@vscode/ripgrep/lib/postinstall.js --force` (ранний выход, если есть пустая `bin/`). Postinstall **`scripts/postinstall-windows-native-modules.mjs`**: проверка артефактов → **`npm.cmd rebuild`** недостающих → починка ripgrep.

**Применение:** первый локальный OSS на Windows, CI/клон без lifecycle scripts.

**Устарело:** узкая запись только про policy-watcher + `postinstall-rebuild-policy-watcher-win.mjs` — заменена набором патчей Spectre (см. **`patches/`**) и **`postinstall-windows-native-modules.mjs`**.

---

## [vscode] Проверка подписи расширений и `@vscode/vsce-sign`

**Контекст:** диалог «не удаётся проверить подпись» / «Проверка подписи не выполнена» при установке из Marketplace (2026-05).

**Суть:** `ExtensionSignatureVerificationService` делает `import('@vscode/vsce-sign')` и запускает бинарник `node_modules/@vscode/vsce-sign/bin/vsce-sign(.exe)` (распаковка из ASAR учтена в пакете). Если модуль не установлен или postinstall не скопировал exe — `verify` возвращает `undefined` → ошибка «Проверка подписи не выполнена». В корневом `package.json` нужна зависимость **`@vscode/vsce-sign`**; установка — **`npm install` без `--no-optional`** (нужен optional `@vscode/vsce-sign-win32-x64` и т.д.). Проверка: есть ли **`node_modules/@vscode/vsce-sign/bin/vsce-sign.exe`** (Windows). На Windows постинсталл **`scripts/postinstall-windows-native-modules.mjs`** при отсутствии exe запускает **`npm rebuild @vscode/vsce-sign`**.

**Применение:** после клона/CI без optional или с `--ignore-scripts` — переставить зависимости; релизная сборка должна включать тот же пакет в production `node_modules`.

# Фаза 1 — Инфраструктура

## Fork и CI

- [ ] Fork CortexIDE
- [ ] Настроить `git remote upstream → microsoft/vscode`
- [ ] CI-алерт: отставание от upstream > 2 недель → блокирующий алерт в PR
- [ ] Ветка `upstream-sync` для мёрджей
- [ ] CI-джоб мониторинга Electron CVE
- [ ] CI-джоб `npm audit` на lockfile при каждом PR
- [ ] E2E тесты (Playwright/Spectron): открыть → Apply → проверить файл; в CI

---

## Телеметрия и Crash Reporting

- [ ] Вычистить или задокументировать телеметрию VS Code + CortexIDE
- [ ] Отключить/заменить crash reporting донора на собственный (с явным opt-in)
- [ ] Реализовать хранение credentials через `safeStorage` (API-ключи, OAuth-токены)

---

## Автообновление

- [ ] Отключить стандартный updater (пингует microsoft.com)
- [ ] Реализовать «check for updates» через GitHub Releases API
- [ ] Migration path инфраструктура — шаблон migration script, тест upgrade с реальными данными
- [ ] Явные каналы: stable / beta / nightly; выбор в first-run wizard

---

## Сборка и дистрибуция

- [ ] Ребрендинг (имя, иконки, `product.json`)
- [ ] Code signing — macOS notarization + Windows EV-сертификат
- [ ] macOS Universal Binary — ARM + Intel fat binary с первого релиза
- [ ] ARM Linux — сборка для ARM64 Linux
- [ ] Установщики Win/Mac/Linux (x64 + ARM64) через GitHub Releases

---

## SBOM

- [ ] Настроить публикацию SBOM с каждым релизом
- [ ] Список npm зависимостей с лицензиями
- [ ] Список рекомендуемых LLM-моделей с лицензиями и commercial use restrictions
- [ ] Project Manager — пометка GPL-3.0, «bundled extension, independent license»

---

## Electron Debug-порты

- [ ] Закрыть порты 9229/9230 в production build — флаг `--no-remote-debugging`
- [ ] `vibe doctor` проверяет закрытость портов

---

## Качество кода (до ребрендинга)

- [ ] Починить известные баги CortexIDE
- [ ] Smoke-тест совместимости расширений (ESLint, Prettier, GitLens)
- [ ] Заменить vector store на встроенный (sqlite-vec/LanceDB)

---

## `vibe doctor` — базовая реализация

Fast mode (≤3с, только блокирующие проблемы):
- [ ] Electron debug-порты открыты?
- [ ] API-ключи настроены?
- [ ] `.vibe/` схема валидна?
- [ ] Критические CVE Electron?
- [ ] Windows long path (`longPathsEnabled`) включён?

Дополнительные режимы:
- [ ] `--full` — полный аудит (до 30с)
- [ ] `--ci` — CI-режим (GUI-проверки пропускаются с `[skipped: no GUI]`)
- [ ] `--repair` — интерактивный режим восстановления `.vibe/`
- [ ] `--json` — машиночитаемый вывод `{check, status, message, severity}`

---

## Provider List

- [ ] `models.json` хостится на CDN (`registry.vibeide.io/models.json`)
- [ ] IDE делает GET с ETag кешированием при старте
- [ ] Offline fallback — локальный кэш последней загрузки
- [ ] UI уведомление о новых моделях

---

## Checkpoint Pruning

- [ ] `vibe checkpoint prune --keep-last 50` / `--older-than 30d`
- [ ] Автопрунинг включён по умолчанию
- [ ] `vibe doctor --full` предупреждает при >1GB `refs/vibe/`

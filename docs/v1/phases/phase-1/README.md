# Фаза 1 — Базовый форк + безопасность

> Первый публичный релиз.

## Содержание

| Файл | Содержание |
|---|---|
| [infrastructure.md](infrastructure.md) | Форк, CI, автообновление, SBOM |
| [security.md](security.md) | Безопасность агента, workspace isolation, MCP |
| [ux.md](ux.md) | Брендинг, Trust Score, First-run wizard, провайдеры |

---

## ✓ Критерии готовности Фазы 1

### Дистрибуция
- [ ] Работает на чистой Windows 11 / macOS (ARM + Intel) / Linux без SmartScreen / «App is damaged»
- [ ] Расширения из Open VSX устанавливаются, smoke-тест пройден
- [ ] Upstream lag < 2 недель, CI-алерт настроен
- [ ] Electron debug-порты 9229/9230 закрыты; `vibe doctor` это проверяет

### Безопасность
- [ ] Workspace isolation работает; тест на выход за границу директории пройден
- [ ] Дефолтный лимит токенов активен ($20/500k)
- [ ] Dead man's switch активен
- [ ] Loop detector активен
- [ ] Телеметрия задокументирована; credentials в keychain
- [ ] Crash reporting заменён на собственный с opt-in
- [ ] Agent git identity работает корректно

### Trust Score & First-run
- [ ] Trust Score виджет виден в статус-баре, переключается keyboard shortcut
- [ ] First-run security wizard проходится без ошибок
- [ ] Keyboard shortcuts для Trust Score / tool approval / diff review задокументированы

### Агент
- [ ] Token cost forecast отображается корректно для всех провайдеров
- [ ] Constraints enforcement layer: агент физически не может нарушить `constraints.json` (тест на bypass)
- [ ] Large file policy срабатывает при добавлении файла >200KB
- [ ] Terminal output awareness работает как opt-in
- [ ] `@file` mention добавляет файл в контекст
- [ ] Slash commands работают: `/fix`, `/tests`, `/explain`
- [ ] Rate limit (429) визуализируется; не триггерит DMS

### Конфигурация
- [ ] `.vibe/` gitignore wizard при `vibe init`
- [ ] `.vibe/allowed-models.json` валидируется `vibe doctor` при старте
- [ ] `.vibe/` format versioning: поле `vibeVersion` присутствует в сгенерированных файлах
- [ ] Startup health check `.vibe/` не блокирует запуск

### Качество
- [ ] E2E тест (открыть → Apply → проверить файл) проходит в CI на Windows/Mac/Linux
- [ ] Context poisoning detector срабатывает на тестовых файлах с zero-width chars
- [ ] Multi-root workspace: isolation корректна для нескольких корней

### Инфраструктура
- [ ] Migration path инфраструктура готова; тест upgrade пройден
- [ ] SBOM публикуется с релизом
- [ ] i18n foundation: все UI strings в locale files, нет hardcoded strings

### Дополнительно (до первого анонса)
- [ ] Open VSX gap list опубликован в README и на сайте
- [ ] CONTRIBUTING.md опубликован
- [ ] Discord открыт
- [ ] Marketing site опубликован
- [ ] `vibe commit` генерирует осмысленный commit message

---

## Следующий шаг

После выполнения всех критериев → **[Фаза 2](../phase-2/README.md)**

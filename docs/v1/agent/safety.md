# Безопасность агента

## Workspace Isolation

Агент работает **только внутри рабочей директории**. Любой выход — явный prompt с указанием пути.

### Граничные случаи
- **Symlinks** — тест на symlink за пределами рабочей директории (Windows и Linux)
- **WSL2** — пути `\\wsl$\Ubuntu\...` и `/mnt/c/Users/...` как отдельный вектор обхода
- **Пробелы в пути** — `C:\Users\My User\project` — типовой баг VS Code форков
- **Multi-root workspace** — каждый корень имеет независимую `.vibe/` конфигурацию; global constraints применяются ко всем корням

> Риски: #27 (WSL2), #54 (multi-root)

---

## Dead Man's Switch (DMS)

Пауза агента при отсутствии подтверждения N минут. Защита от зацикленного агента.

### Reset semantics (важно!)
Что считается «подтверждением»:
- ✅ Явный Approve action от пользователя
- ❌ Движение мыши — не считается
- ❌ Rate limit 429 + retry backoff — агент не бездействует, ждёт rate limit
- ❌ Режим ожидания pre-flight plan approval — агент ещё не начал выполнение

### Настройка
- Минимальное значение N: **не менее 1 минуты**
- N=0 = явное отключение функции
- Настраивается в first-run wizard и settings

### Конфликт с Supervised mode
- Supervised auto-apply таймаут < DMS таймаут — иначе DMS паузирует до авто-применения
- Явная документация граничных значений в UI

> Риски: #52 (rate limit → DMS), #60 (pre-flight → DMS), #98

---

## Loop Detector

Автопауза при 3+ одинаковых действиях подряд. Показывает последние 5 действий.

### Определение «одинаковых»
Действие определяется как `(тип действия + target)`.  
Цикл = одно и то же action × 3 подряд ИЛИ повторяющаяся последовательность A→B→A.

### Исключения из loop detector
- **Auto-repair loop шаги** — уже одобрены пользователем через Approve/Auto
- **Task decomposition паттерны** — шаги A→B→C в рамках одной задачи
- **CI-режим** — цикл = одинаковое действие + **идентичный результат** (те же тесты с той же ошибкой)

### Настройка
- Порог (дефолт: 3) — настраивается
- Определение «одинаковых» — настраивается
- `--loop-threshold N` для CLI

> Риски: #68 (CI false positive), #80 (auto-repair)

---

## Жёсткий лимит токенов

- Дефолт: **$20 / 500k токенов** на сессию
- Включён по умолчанию
- Настраивается в first-run wizard
- При достижении 80% — alert via email/webhook

### Budget alerts
- In-IDE уведомление при достижении 80%
- Email/webhook alert (для ночных/CI запусков — нет некому читать IDE)
- Лимит по wall clock времени — дополняет token/money budget

### Token cost forecast
- До отправки: диапазон «worst case / с кэшем» (не точка)
- Post-response: индикатор сработал ли кэш (из usage-поля API-ответа)
- При extended thinking: отдельная строка «thinking overhead: +50–300%»
- В Stealth mode: только worst case (кэш отключён)

> Риски: #33 (forecast vs caching), #56 (stealth mode), #94 (thinking tokens)

---

## Prompt Injection Guard

### Векторы атаки
1. **Содержимое файлов** — `<!-- IGNORE PREVIOUS INSTRUCTIONS -->` в кодовой базе
2. **Git blame** — commit messages и старые строки из git истории
3. **Context poisoning** — zero-width chars, Unicode bidi overrides, invisible CSS

### Защита
- Базовая санитизация контента файлов перед передачей в контекст
- Warning при работе с внешними репозиториями
- Санитизация git blame контекста (Фаза 3a)
- Context poisoning detector: zero-width chars, Unicode bidi overrides (Фаза 1)

> Риски: #26, #58

---

## Credential Storage

Все credentials хранятся через `safeStorage`:
- macOS: Keychain
- Windows: DPAPI
- Linux: libsecret

**Никаких:** localStorage, plaintext config, `.env` в рабочей директории.

---

## Extension Permissions UI

Декларации capability расширений при установке и в настройках — аналог permission model мобильных ОС.  
Extension security scanner при установке из Open VSX (malicious patterns, typosquatting).

> Риск: #29

---

## Фазы реализации

| Фича | Фаза |
|---|---|
| Workspace isolation | 1 |
| Dead man's switch | 1 |
| Loop detector | 1 |
| Жёсткий лимит токенов | 1 |
| Token cost forecast | 1 |
| Extension permissions UI | 1 |
| Prompt injection guard (базовый) | 1 |
| Git blame injection protection | 3a |

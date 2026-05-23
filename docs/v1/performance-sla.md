# VibeIDE — Performance SLA

> **Цели (зафиксированы в Фазе 0):**  
> Cold start ≤ 5 с · Memory idle ≤ 600 MB · Memory после открытия проекта ≤ 600 MB

---

## 1. Целевые показатели

| Метрика | Цель | Критично |
|---|---|---|
| Cold start (до первого окна) | ≤ 5 с | > 8 с |
| Memory idle (пустое окно) | ≤ 600 MB RSS | > 900 MB |
| Memory после открытия проекта | ≤ 600 MB RSS | > 1 GB |
| Time-to-interactive (редактор открыт, файл загружен) | ≤ 8 с | > 15 с |
| npm run compile (cold, без кэша) | ≤ 5 мин | > 10 мин |
| npm run compile (hot, incremental) | ≤ 30 с | > 60 с |

---

## 2. Методика измерений

### 2.1 Cold start

**Инструмент:** `scripts/vibe-perf-measure.js` (см. раздел 4)

```bash
# Запуск с замером времени до появления окна
node scripts/vibe-perf-measure.js --cold-start --runs 5
```

**Вручную (Windows):**

```powershell
$sw = [Diagnostics.Stopwatch]::StartNew()
& ".\scripts\code.bat" --wait-for-window
$sw.Stop()
Write-Host "Cold start: $($sw.ElapsedMilliseconds) ms"
```

**Вручную (Linux/macOS):**

```bash
time ./scripts/code.sh --wait-for-window
```

**Условия замера:**
- Профиль: `vibeide-dev` (чистый, без расширений пользователя)
- Рабочая папка: не открыта (`--folder-uri` не передаётся)
- CPU throttling: 4× slowdown в DevTools → Performance (для воспроизводимости)
- Прогрев: 1 холостой запуск перед измерением (JIT, антивирус)
- N запусков: ≥ 5; результат — медиана

### 2.2 Memory

**Инструмент:** Process Explorer / Task Manager / `ps`

```bash
# Linux/macOS — RSS процесса vibeide
sleep 10 && ps -o pid,rss,comm -p $(pgrep -f "vibeide.*renderer") | awk '{print $1, int($2/1024)"MB", $3}'
```

**Windows PowerShell:**

```powershell
Start-Sleep 15
Get-Process -Name "vibeide*" | Select-Object Name, Id, @{N="RSS_MB";E={[math]::Round($_.WorkingSet64/1MB,1)}}
```

**Точки измерения:**
1. **Idle** — через 10 с после появления пустого окна (Welcome screen закрыт)
2. **После открытия проекта** — через 15 с после `File → Open Folder` на репо VibeIDE (~196 MB out/)

### 2.3 Time-to-interactive

Измеряется как время от запуска до момента, когда:
- Статус-бар отображает провайдера (VibeProviderStatusService)
- Tree-sitter индекс не блокирует UI
- Первая клавиша в редакторе обрабатывается без задержки

---

## 3. Фактические результаты (baseline 2026-05-03)

> Замеры необходимо провести на реальном железе разработчика после первого успешного `npm run compile`.  
> Ниже — шаблон для заполнения.

### Окружение

| Поле | Значение |
|---|---|
| Дата | 2026-05-03 |
| ОС | *(заполнить: Windows 11 / macOS 15 / Ubuntu 24.04)* |
| CPU | *(заполнить: e.g. AMD Ryzen 9 5900X)* |
| RAM | *(заполнить: e.g. 32 GB DDR4)* |
| Диск | *(заполнить: e.g. NVMe SSD 1TB)* |
| Node.js | *(node --version)* |
| Electron | *(cat node_modules/electron/package.json \| jq .version)* |
| VibeIDE build | v1.118.1 (VS Code 1.118.1 base) |

### Результаты cold start (медиана 5 запусков)

| Запуск | Время (мс) |
|---|---|
| 1 | *(измерить)* |
| 2 | *(измерить)* |
| 3 | *(измерить)* |
| 4 | *(измерить)* |
| 5 | *(измерить)* |
| **Медиана** | ***(вычислить)**** |
| **Статус** | *(✅ ≤ 5000 мс / ⚠️ / ❌)* |

### Результаты memory

| Точка | RSS (MB) | Статус |
|---|---|---|
| Idle (пустое окно) | *(измерить)* | *(✅ / ⚠️ / ❌)* |
| После открытия VibeIDE repo | *(измерить)* | *(✅ / ⚠️ / ❌)* |

### Compile time

| Режим | Время |
|---|---|
| Cold (`npm run compile`) | *(измерить; для справки: ~3 мин зафиксировано при первом compile в Фазе 0)* |
| Hot (incremental) | *(измерить)* |

---

## 4. Скрипт `scripts/vibe-perf-measure.js`

Скрипт создан в репо: [`scripts/vibe-perf-measure.js`](../../scripts/vibe-perf-measure.js)

```bash
# Запуск
node scripts/vibe-perf-measure.js --help

# Только cold-start (5 прогонов)
node scripts/vibe-perf-measure.js --cold-start --runs 5

# Только memory snapshot
node scripts/vibe-perf-measure.js --memory --wait 15

# Полный прогон + вывод в JSON
node scripts/vibe-perf-measure.js --all --output docs/v1/perf-results.json
```

---

## 5. CI-интеграция

Workflow: [`.github/workflows/perf-sla.yml`](../../.github/workflows/perf-sla.yml)

- Запускается: `workflow_dispatch` + при push в `main` (раз в неделю по cron)
- Публикует результат как GitHub Actions Job Summary
- Падает при превышении **критичных** порогов из таблицы раздела 1

---

## 6. Регрессии и реакция

| Отклонение | Действие |
|---|---|
| Метрика между целью и критичным порогом | ⚠️ Warning в CI; issue с меткой `perf` |
| Метрика превышает критичный порог | ❌ CI fail; block merge; назначить `P0 perf` |
| Постепенный рост (5% в неделю) | 📊 Автоматический trend alert (через job summary) |

---

## 7. Инструменты профилировки

| Инструмент | Использование |
|---|---|
| Chrome DevTools Timeline | `--inspect-brk` + `chrome://inspect` |
| VS Code `--prof` | `scripts/code.bat --prof` → isolate-*.log |
| `node --cpu-prof` | bootstrap-esm.js для startup trace |
| Electron Sandbox Profiling | DevTools → Memory → Allocation timeline |
| `perf` (Linux) | `perf stat -e cache-misses,instructions` |

---

## 8. История результатов

| Дата | Cold start (мс) | Idle RSS (MB) | Project RSS (MB) | Примечание |
|---|---|---|---|---|
| 2026-05-03 | *(baseline — замерить)* | *(baseline)* | *(baseline)* | Первый официальный baseline |

> Результаты добавлять в эту таблицу при каждом значимом изменении (Electron bump, крупный рефакторинг startup path, merge upstream VS Code).

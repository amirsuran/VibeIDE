# AgentToolExecutor

## Концепция

Abstraction layer поверх различных механизмов выполнения инструментов провайдерами.

## Три режима

| Режим | Провайдер | Механизм |
|---|---|---|
| **`ptc`** | Claude API | Programmatic Tool Calling — агент пишет Python для оркестрации; только `stdout` в контекст; 37% меньше токенов |
| **`parallel`** | OpenAI / Gemini / Mistral | Parallel tool calls — промежуточные результаты могут попасть в контекст |
| **`sequential`** | Ollama, локальные модели | Sequential fallback — самый медленный |

> ⚠️ PTC — Claude API-специфичная фича (`code_execution_20250825`). Для других провайдеров эквивалентного механизма нет.

## Автовыбор режима

Режим выбирается автоматически через **provider capability probe** при первом подключении.  
Результат кэшируется в `models.json`.  
При downgrade с `ptc` → `sequential` — уведомление пользователю.

## UI

Активный режим отображается в **Provider status widget** с иконкой эффективности.

Иконки:
- `ptc` — `⚡ PTC`
- `parallel` — `⇉ Parallel`
- `sequential` — `→ Sequential`

## Provider Capability Probe

При первом подключении провайдера/модели — автоматическая проверка поддерживаемых capabilities:

| Capability | Почему важна |
|---|---|
| Function calling | Основа tool use |
| Vision | Screenshot → code workflow |
| Streaming | Реальный вывод без задержки |
| Extended thinking | «Thinking out loud» mode |
| Structured output | Enterprise SIEM/Splunk интеграция |
| Next-edit prediction | Tab completion mode |

UI скрывает несупортируемые фичи вместо молчаливого падения.

## MCP Tool Deferral

При превышении 10% контекста MCP-инструменты **откладываются**.  
Открываются по запросу через встроенный MCPSearch.  
Эффект: ~85% снижение токенов на tool definitions.

Совместимо с MCP Server Marketplace.

> Аналог Claude Code v2.1.7+ поведения по умолчанию.

## Dynamic Context Filtering

Результаты tool calls фильтруются/агрегируются **до попадания в контекст агента**.

Особенно важно для:
- `@web` / `@docs` поиска (большие результаты)
- Больших файловых читов
- LSP diagnostics

Нативно через PTC для Claude API.  
Для других провайдеров — эмуляция в AgentToolExecutor.

## Фазы реализации

| Фича | Фаза |
|---|---|
| AgentToolExecutor (базовая реализация, три режима) | 1 |
| Provider capability probe | 1 |
| MCP tool deferral | 1 |
| Dynamic context filtering | 2 |
| PTC режим в MCP Inspector | 2 |
| Per-model cost routing | 3a |

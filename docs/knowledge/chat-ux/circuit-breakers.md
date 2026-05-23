# Circuit Breakers for repetitive LLM failures (v0.12.4)

Контекст: aggregator-проксированные модели (Nemotron/qwen/minimax через openCode-zen) имеют два класса repetitive failure mode'ов которые VibeIDE раньше не ловил:
1. **Tool-name × params-shape mismatch** → invalid_params bounce → model retries → loop → OOM.
2. **Empty response in multi-turn** → user retries → empty again → forever.

Оба паттерна теперь имеют circuit breakers с одинаковой философией: «дай N попыток, потом дай user'у явное actionable указание, не молча страдай».

## Breaker 1 — Tool Invalid Params (Stage C)

`chatThreadService.ts:3375-3430` (`_runToolCall`).

**Trigger:** последние N tool-сообщений в thread.messages — все:
- `role: 'tool'`
- `type: 'invalid_params'`
- `name === toolName` (текущий)
- `Object.keys(rawParams).sort().join(',')` === current signature

**N:** `vibeide.chat.toolInvalidParamsCircuitBreakerThreshold` (default 3, range 1..20).

**Action на trip:**
- `_addMessageToThread` tool_error с понятным RU-сообщением «Прервано: модель N раз подряд вызвала "X" с одной и той же неверной формой...».
- `_setStreamState({ isRunning: undefined, error: { message } })`.
- `_metricsService.capture('Circuit Breaker Tripped — Tool Invalid Params', {...})`.
- `return { interrupted: true }` → `_runChatAgent` exits cleanly.

**Reset:** не сбрасывается явно, потому что breaker смотрит на хвост thread.messages — после `interrupted: true` цикл выходит, следующий send начинает с нового user-message и история invalid_params уезжает.

## Breaker 2 — Empty Response (Stage K)

`chatThreadService.ts:4980-5018` (onError handler in `_runChatAgent`).

**Trigger:** regex match `^VibeIDE: Empty response from ([^/\s]+)\/([^/\s]+) \(` на `error.message` (это OUR error template, emitted by `_sendOpenAICompatibleChat` / `aiSdkAdapter`). Provider+model parsed из message, NO HARDCODED NAMES.

Per-thread per-(provider, model) streak в `_emptyResponseStreak: Map<string, number>`. Key: `${threadId}:${provider}:${model}`.

**N:** `vibeide.chat.emptyResponseCircuitBreakerThreshold` (default 3, range 1..20).

**Action на trip:**
- Replace error message с localized explainer ("...вернула пустой ответ N раз подряд...откройте настройки").
- `recoverable: 'switchModel'` → UI permanent button "Открыть настройки и выбрать другую модель".
- **Toast suppressed** — иначе пользователь видит и toast, и inline error. Один durable сигнал лучше двух.
- `_metricsService.capture('Circuit Breaker Tripped — Empty Response', {...})`.

**Reset:** в `onFinalMessage` любой успешный ответ от той же `(threadId, provider, model)` combo → `_emptyResponseStreak.delete(key)`. Switching model = new key = clean state.

## Что общее в обоих

| Принцип | Реализация |
|---|---|
| No hardcoded names | Provider/model parsed runtime из error message / tool params |
| Configurable threshold | Per-breaker setting, range 1..20 |
| Counter resets on success | Не нужен manual cleanup, естественный flow |
| Persistent inline UI | Через `streamState.error.recoverable` variant |
| Metrics signal | `_metricsService.capture()` на каждый trip — aggregated сигнал без invasive logging |

## Anti-patterns которые НЕ делаем

- **Auto-switching model.** Никогда. User явно решает что делать. Auto-pick «similar model» — magic, footgun.
- **Adaptive thresholds.** Не lower-им threshold после повторных trips. Это создаёт ускоряющийся отказ — модель плохая → breaker тригер'ит чаще → user раздражается ещё сильнее.
- **Suppress error if user knows.** Не tracking «user dismissed toast N times». Каждый trip — independent сигнал.

## Future ideas (не сейчас)

- Adaptive UI suggestion: «вот последняя working модель в этом thread — переключиться?». Требует «last working» tracking.
- Per-provider trip history dashboard в Settings: «openCode-zen × minimax-m2.7 трипал empty-response 47 раз в этой неделе» → user видит pain points.

# Stuck Chat Recovery — design notes (v0.12.4)

Контекст: после v0.12.3 пользователи иногда попадали в состояние, где send-в-чат тихо ничего не делал, toast не появлялся, и помогал только рестарт IDE. Root cause — `await this.streamState[threadId]?.interrupt` в `abortRunning` блокировался на Promise, который никогда не резолвится (баг где-то в pipeline). Submit watchdog был, но его условие `if (isRunning !== undefined) return` бэйлило молча.

## Что сделано (v0.12.4, commits `ffb79e9c`, `3a2aabaf`, `6de1ce94`)

Три слоя защиты, все таргетят симптом «send hangs without surfacing anything»:

### Слой 1 — Hard timeout на `await interrupt` в `abortRunning`

`chatThreadService.ts:2740-2756`. `Promise.race([interruptPromise, timeoutAfter(2_000)])`. Если interrupt не резолвится за 2с — логируем `console.warn`, продолжаем к `_setStreamState(undefined)`.

Trade-off: теряем шанс вызвать `interrupt()` на честно-медленных interruptors. Acceptable — send-unblocking важнее.

### Слой 2 — Stuck-state detection на новом send

`chatThreadService.ts:6535-6560`. При новом `_addUserMessageAndStreamResponse`:
- Считаем age stream-state через `_streamStateSetAt: Map<threadId, timestamp>` (set'ится в `_setStreamState` когда isRunning переходит в running-state).
- Если age > `vibeide.chat.streamHardStallSeconds` (default 120с) — `forceResetChatState` напрямую, без попытки `abortRunning`.
- Иначе обычный `await this.abortRunning(threadId)`.

Threshold REUSES существующего watchdog setting — никаких новых knob'ов, никакого drift'а.

### Слой 3 — Submit-watchdog улучшение

`chatThreadService.ts:6430-6470`. Когда таймер срабатывает:
- Старое поведение: bail silently если `isRunning !== undefined`.
- Новое: если isRunning всё ещё в running-state — set `error: { ..., recoverable: 'forceReset' }`. UI рендерит permanent inline "Сбросить состояние чата" button.

## API

```typescript
// Public method on IChatThreadService
forceResetChatState(threadId: string): void;
```

Эффект:
- Drops pending RAF batch updates.
- Clears submit-watchdog timer.
- Deletes `_streamStateSetAt[threadId]`.
- Sets `streamState[threadId]` → `undefined` через `_setStreamState`.
- Fires `_metricsService.capture('Chat Force Reset', { priorState, priorAgeSec })`.

## Recoverable error variants (ThreadStreamState type)

```typescript
error?: { 
    message: string;
    fullError: Error | null;
    recoverable?: 'dismissPlan' | 'forceReset' | 'switchModel';
};
```

UI рендеринг (`SidebarChat.tsx` ~4912-4955): каждая `recoverable` ветка показывает persistent action button:

| Variant | Button text | Action |
|---|---|---|
| `'dismissPlan'` | «Сбросить план и продолжить» | `vibeide.chat.dismissPendingPlan` command |
| `'forceReset'` | «Сбросить состояние чата» | `chatThreadsService.forceResetChatState(threadId)` direct |
| `'switchModel'` | «Открыть настройки и выбрать другую модель» | open settings command |
| `undefined` (default) | «Open settings» | open settings command |

## Command Palette twins

| Command id | When inline UI doesn't help |
|---|---|
| `vibeide.chat.dismissPendingPlan` | Plan-pending where inline button isn't visible (collapsed UI, lost render) |
| `vibeide.chat.forceResetChatState` | Stuck state where submit watchdog didn't trip yet (e.g. UI confused render) |

## Что НЕ делаем (по дизайну)

- Не пытаемся auto-recover «зависший» thread без явного user-action. Всегда показываем permanent inline error.
- Не сохраняем state «recoverable error» через restart — streamState volatile, после restart всё свежее.
- Не делаем «just retry the request». User должен явно reset и решить нажать send ещё раз.

# `ServicesAccessor` и async handlers

← [Knowledge Index](../README.md)

---

## [vscode] `ServicesAccessor` и async handlers команд

**Контекст:** в DevTools / логе — **`Illegal state: service accessor is only valid during the invocation of its target method`** при выполнении команд VibeIDE (2026-05).

**Суть:** `CommandService` вызывает `instantiationService.invokeFunction(handler, …)`. У async-функции после **первого `await`** синхронная часть уже завершилась → `invokeFunction` в `finally` помечает accessor как недействительный; любой последующий **`accessor.get()`** бросает эту ошибку.

**Применение:** во всех **`async`** `CommandsRegistry.registerCommand` / `Action2.run` снимать нужные сервисы **`accessor.get` в начале**, до первого `await`; либо передавать в хелперы уже разрешённые сервисы, а не `ServicesAccessor`.

См. также конкретный кейс с multi-chat tabs: [architecture/chat-pane.md](../architecture/chat-pane.md) → трап #1.

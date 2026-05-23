# SynthWave '84 — встроенная тема

> Источник: [robb0wen/synthwave-vscode](https://github.com/robb0wen/synthwave-vscode) — MIT лицензия, 5.3k⭐

## Почему встроенная, а не плагин

- Neon Glow в VS Code-форках работает **нативно** без хака Custom CSS — это единственная причина вендорить
- Визуально выделяет VibeIDE на скриншотах и демо — мгновенно узнаваема
- MIT лицензия — совместима с форком
- Устанавливается как расширение → нет зависимости от Open VSX Marketplace
- Задаёт визуальную идентичность с первого запуска

## Архитектура

```
extensions/
  vibeide-synthwave84/        ← стандартная структура VS Code extension
    package.json              ← extensionKind: ["ui"], id: vibeide.synthwave84
    themes/
      synthwave84.json
      synthwave84-noglow.json
    src/
      neonDreams.ts           ← нативная реализация Glow (не модификация core VS Code)
    UPSTREAM.md               ← версия апстрима, дата последней синхронизации
```

Стандартный формат extension — никаких VibeIDE-специфичных API.  
«Выдернуть» в отдельный плагин = скопировать директорию.

## Neon Glow — нативная реализация

Оригинальный плагин: Glow через модификацию internal CSS → предупреждение «Your installation appears to be corrupt».

В форке: Glow через **workbench CSS injection API** — форки имеют к нему доступ.  
Это единственное место где тема использует возможности форка.

## Профили и тема

> ⚠️ SynthWave '84 — не для compliance/fintech профиля.

| Профиль | Тема |
|---|---|
| `vibe` (дефолт) | SynthWave '84 с Neon Glow |
| `team` | SynthWave '84 без Glow |
| `compliance/fintech` | Стандартная тёмная тема VS Code |

Тема задаётся через профиль, не глобально.

## Стратегия обновлений

1. **`UPSTREAM.md`** — фиксирует версию апстрима, дату синхронизации, список локальных патчей
2. **`sync-synthwave84.yml`** — еженедельно проверяет новые теги в `robb0wen/synthwave-vscode`; при обнаружении → автоматический PR с diff
3. Никакого submodule — исходники копируются (vendor), патчи документированы в `UPSTREAM.md`

## Чеклист

- [ ] **Фаза 0** — выбрать папку `extensions/vibeide-synthwave84/`, создать `UPSTREAM.md`
- [ ] **Фаза 1** — вендорить тему; реализовать Neon Glow нативно; задать как дефолт в `product.json`; настроить `sync-synthwave84.yml`
- [ ] **Фаза 2** — UI-переключатель «Glow: вкл/выкл» + настройка яркости в `settings.json`
- [ ] **Будущее** — выделить в отдельный Open VSX плагин если нужно развивать независимо

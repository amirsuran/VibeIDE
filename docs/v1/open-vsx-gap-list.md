# Open VSX Gap List

> Публикуется в README и на сайте **до первого публичного анонса**.  
> Честное документирование ограничений — часть нарратива прозрачности.

---

## Статус

**Текущее состояние (Фаза 0):** `product.json` указывает на VS Code Marketplace — это нужно исправить в Фазе 1 на Open VSX URLs.

```json
// Нужно заменить в Фазе 1:
"extensionsGallery": {
  "serviceUrl": "https://open-vsx.org/vscode/gallery",
  "itemUrl": "https://open-vsx.org/vscode/item"
}
```

---

## Расширения которые НЕ работают (не опубликованы в Open VSX)

| Расширение | Причина | Альтернатива |
|---|---|---|
| GitHub Copilot | Только VS Marketplace | — (конкурент) |
| Pylance (Microsoft) | Проприетарный | Pylsp, Pyright |
| Live Share (Microsoft) | Проприетарный | — |
| Remote - SSH (Microsoft) | Только VS Marketplace | Open Remote SSH (уже в CortexIDE) |
| C# Dev Kit (Microsoft) | Проприетарный | C# (OmniSharp) |
| Azure расширения | Только VS Marketplace | — |

---

## Расширения которые РАБОТАЮТ (есть в Open VSX)

| Расширение | Open VSX статус |
|---|---|
| ESLint | ✅ |
| Prettier | ✅ |
| GitLens | ✅ |
| Python (ms-python) | ✅ |
| Vim | ✅ |
| Docker | ✅ |
| Tailwind CSS IntelliSense | ✅ |
| Rust Analyzer | ✅ |
| Go | ✅ |
| Project Manager | ✅ (pre-installed) |

> Open VSX покрывает ~60-70% популярных расширений VS Marketplace.

---

## Pre-installed расширения в VibeIDE

Компенсируют часть gap:

| Расширение | Источник |
|---|---|
| SynthWave '84 | Встроен (vendored) |
| Project Manager | Bundled `.vsix` из Open VSX |
| VSCodeSyncFiles | Pre-installed из Open VSX |

---

## Обновление этого документа

Обновлять при каждом релизе. Добавлять расширения которые появились в Open VSX.  
Источник актуального списка: [open-vsx.org](https://open-vsx.org)

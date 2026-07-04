# Брендинг VibeIDE — мастера иконок

Единый источник правды для иконок приложения. Старый ореол-тень из исходного
арта срезан (2026-07-04); при регенерации использовать ТОЛЬКО эти мастера.

| Файл | Что это |
|---|---|
| `vibeide-logo-1024.png` | Чистый логотип-мозг (прозрачный фон, без теней) — исходник для всех платформ |
| `vibeide-macos-icon-1024.png` | Готовая маковская иконка: логотип на графитовом сквиркле 824/1024 по шаблону Apple |

## Регенерация

- **macOS `resources/darwin/code.icns`**: iconset из `vibeide-macos-icon-1024.png`
  (sips resample 16–512 + @2x → `iconutil -c icns`).
- **Windows `resources/win32/code.ico`**: круглая маска из `vibeide-logo-1024.png`,
  размеры 16/24/32/48/64/128/256 — `node scripts/create-ico.js resources/branding/vibeide-logo-1024.png`
  (нужен `sharp`; на macOS без sharp — Swift-маска + python-сборка ICO, см. историю коммита).

Windows подхватывает новый `code.ico` автоматически при следующей сборке
(`release-windows.ps1` / gulp `vscode-win32-x64` — rcedit вшивает его в exe).

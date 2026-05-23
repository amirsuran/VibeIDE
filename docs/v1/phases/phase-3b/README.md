# Фаза 3b — Экспериментальные фичи

> Высокая сложность, высокий риск.  
> **Начинать только после полной стабилизации Фазы 3a.**

---

## Экспериментальные фичи

### Sandboxed Preview Runner
- [ ] Docker/devcontainer: кнопка «Run in sandbox» рядом с diff preview
- [ ] Docker монтирует **активный worktree агента** (не основную ветку)
- [ ] Полная изоляция: агент написал → просмотрел → запустил → применил

> Риск: #48

---

### Voice Input
- [ ] Whisper.cpp локально или Web Speech API
- [ ] **В privacy-режиме — только локальная модель** (аудио не уходит наружу)

---

### Multi-agent Режим
- [ ] Architect планирует, Coder имплементирует параллельно
- [ ] Checkpoint mutex из Фазы 0 (риск #37) — обязателен перед реализацией
- [ ] Token cost forecast показывает breakdown по каждому агенту (риск #41)
- [ ] Тест на параллельный rollback без race condition

---

### Ambient Agent
- [ ] Фоновый мониторинг проекта: «ты добавил функцию без теста», «высокий complexity»
- [ ] Ненавязчивые предложения (в конце сессии, не real-time прерывание)
- [ ] Настраивается или отключается
- [ ] **Явный opt-in; в privacy-режиме принудительно отключается**

---

### Autocomplete Explainability
- [ ] Hover на autocomplete suggestion → краткое объяснение почему предложено
- [ ] Opt-in (производительность)
- [ ] **Нет у Cursor и Copilot** — прямое выражение нарратива «ты видишь всё»

---

### AI Debugging Integration
- [ ] Агент видит debugger state в реальном времени: стек вызовов, значения переменных, watch expressions
- [ ] Замыкает цикл отладки без ручного copy-paste
- [ ] **Нет у Cursor** — значимое конкурентное преимущество

---

### Speculative Parallel Exploration
- [ ] Агент пробует два подхода параллельно в двух изолированных git worktrees
- [ ] Side-by-side diff результатов — пользователь выбирает лучший
- [ ] Требует git worktree isolation (Фаза 2) + checkpoint mutex (Фаза 0)

---

## ✓ Критерии готовности Фазы 3b

- [ ] Sandboxed preview runner работает на Docker и devcontainer; изоляция верифицирована
- [ ] Sandboxed preview runner: Docker монтирует worktree агента (тест)
- [ ] Voice input работает локально (Whisper.cpp) без отправки аудио наружу
- [ ] Multi-agent: тест на параллельный rollback без race condition пройден
- [ ] Multi-agent: forecast показывает breakdown по агентам
- [ ] Ambient agent: предложение срабатывает при добавлении функции без теста
- [ ] AI debugging: агент видит stack trace и variable values в breakpoint (тест на реальном проекте)
- [ ] Speculative parallel: два worktree созданы параллельно; side-by-side diff отображается

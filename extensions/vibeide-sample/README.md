# VibeIDE Sample Extension

Smallest possible extension that uses the VibeIDE proposed-API surface. Acceptance
proof for `references/v1/extension-api-readonly-draft.md` and the docs in
`docs/v1/extension-development.md`.

## What it does

A single command — `VibeIDE Sample: Show status` — calls one accessor from each
VibeIDE namespace and shows the result as a notification:

- `vscode.vibeide.agent.status()` — Trust Score mode + running flag.
- `vscode.vibeide.skills.list()` — number of skills discovered.
- `vscode.vibeide.constraints.queryAllowed(...)` — whether an `edit_file` action
  on the workspace root is allowed under current `.vibe/constraints.json`.
- `vscode.vibeide.plans.subscribeToEvents(...)` — logs plan-lifecycle events
  to the dev tools console.

Until the proposed typings ship in `src/vscode-dts/`, the calls go through `any`
casts. The cast disappears when the typings land — at that point this file becomes
a five-line tutorial referenced from `docs/v1/extension-development.md`.

## Run

1. Build VibeIDE locally (`scripts/vibe-dev.bat` on Windows).
2. Open this folder in VibeIDE.
3. Press F5 to launch the Extension Development Host.
4. In the host window, run `VibeIDE Sample: Show status` from the command palette.

If you see a warning about the proposed API being absent, the build does not yet
ship `vibeideReadonly` — that means the typings + extHost wiring still live in the
backlog. See `references/v1/extension-api-readonly-draft.md` § "Wiring backlog" for
the next steps.

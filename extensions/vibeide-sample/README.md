# VibeIDE Sample Extension

Smallest possible extension that uses the VibeIDE proposed-API surface. Acceptance
proof for the `vibeideReadonly` proposal in
`src/vscode-dts/vscode.proposed.vibeideReadonly.d.ts`.

## What it does

A single command — `VibeIDE Sample: Show status` — calls one accessor from each
VibeIDE namespace and shows the result as a notification:

- `vscode.vibeide.agent.status()` — Trust Score mode + running flag.
- `vscode.vibeide.skills.list()` — number of skills discovered.
- `vscode.vibeide.constraints.queryAllowed(...)` — whether `write` on the
  workspace root is allowed under current `.vibe/constraints.json`.
- `vscode.vibeide.plans.subscribeToEvents(...)` — logs plan-lifecycle events
  to the dev tools console.

The accessors are wired through `MainThreadVibeIDE` to the corresponding
workbench services (`IChatThreadService`, `IVibeSkillsLibraryService`,
`IVibePlanEventJournalService.onEvent`, `IVibeConstraintsService`).

This sample is JavaScript-only and uses `any` casts so it can be loaded without
a typings shim. TypeScript consumers should declare `enabledApiProposals` in
`package.json` and import `vscode.vibeide` directly.

## Run

1. Build VibeIDE locally (`scripts/vibe-dev.bat` on Windows).
2. Open this folder in VibeIDE.
3. Press F5 to launch the Extension Development Host.
4. In the host window, run `VibeIDE Sample: Show status` from the command palette.

If you see a warning about the proposed API being absent, the build does not yet
ship `vibeideReadonly` — make sure `enabledApiProposals: ["vibeideReadonly"]` is
present in `package.json`.

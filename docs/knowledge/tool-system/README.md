# Tool System — hardening notes

Knowledge artefacts about VibeIDE's built-in tool layer (the surface the LLM sees as `read_file`, `run_command`, `glob`, `grep`, etc.). Code lives in:

- `src/vs/workbench/contrib/vibeide/common/toolsServiceTypes.ts` — typed params/results for every built-in tool.
- `src/vs/workbench/contrib/vibeide/common/prompt/prompts.ts` — descriptions shown to the LLM.
- `src/vs/workbench/contrib/vibeide/browser/toolsService.ts` — validators (`validateParams`), implementations (`callTool`), and result→string formatters (`stringOfResult`).
- `src/vs/workbench/contrib/vibeide/browser/terminalToolService.ts` — shell/terminal invocation, timeouts, output truncation.
- `src/vs/workbench/contrib/vibeide/common/toolHardening.ts` — shared utilities: `detectShellMisuse`, `truncateHeadTail`, `ToolValidationError`, `countLines`.

## Why we hardened the tool layer

Other agent frontends (Cursor's minimax, generic LLM-shells) routinely hang on long file reads because they only expose one knob — `run_command` — and the model defaults to `Get-Content` / `cat` / `findstr`. Shell stdout has no pagination and no timeout, so the IDE host blocks on the IPC channel until the model is killed.

VibeIDE avoids this by exposing dedicated, paginated tools and **actively bouncing** shell forms that duplicate them.

## Topics

- [anti-shell-contract.md](anti-shell-contract.md) — what `run_command` rejects and why.
- [read-file-v2.md](read-file-v2.md) — line-based slicing, line-numbered output, paging contract.
- [background-commands.md](background-commands.md) — `run_in_background`, `read_background_output`, `kill_background_command`.
- [glob-and-grep.md](glob-and-grep.md) — ripgrep-backed content search and pattern matching.
- [edit-safety.md](edit-safety.md) — pre-flight checks before mutating files.

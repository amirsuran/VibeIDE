# Edit safety pre-flights

`edit_file`, `rewrite_file`, and `create_file_or_folder` run a small set of pre-flight checks before any disk mutation. All checks throw `ToolValidationError` with a stable `code` and a `hint` for the model.

## edit_file — "must read first"

Refuses to run on a pre-existing file that has not been read in this session.

- **Code:** `edit_without_read`
- **Hint:** *"Call read_file first, then issue edit_file using the exact text you observed."*
- **Bypass:** newly-created files (via `create_file_or_folder`) and just-rewritten files (via `rewrite_file`) are auto-marked as read, so the natural chain `create → edit` and `rewrite → edit` works without an extra `read_file`.

This catches the most common edit-mode failure: the model guesses content based on filename + context, generates a SEARCH/REPLACE block, and the SEARCH side never matches because the real file looks different.

## create_file_or_folder — "parent must exist"

Refuses to create a file whose parent directory is missing or is itself a file.

- **Codes:** `parent_dir_missing`, `parent_not_directory`
- **Suggested fix:** create the parent first via `create_file_or_folder` with a trailing `/` on the path.

Without this guard, `IFileService.createFile` fails with an obscure `Unable to write file (NoPermissions)`-flavoured error that the model has no obvious recovery path for.

## What we did NOT yet add

- **Strict uniqueness of `old_string` in SEARCH/REPLACE.** Currently the underlying `editCodeService.instantlyApplySearchReplaceBlocks` finds the first match. A stricter mode that refuses ambiguous matches and asks for more context belongs in that service, not in `toolsService`.
- **Diff preview before write.** Already exists via `editCodeService` for human-supervised edits; not exposed as a separate built-in tool yet.

These are tracked as follow-ups in the roadmap, not blockers for the current tool-hardening pass.

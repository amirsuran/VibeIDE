/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


/**
 * Text-level editing of a `.gitignore` for the "add/remove from .gitignore" context-menu
 * actions. Operates on literal path entries only (the kind these actions write); wildcard
 * patterns are never touched. Pure functions — testable from `test/common/`.
 */

/** Glob metacharacters that would turn a literal path into a pattern; escaped on write. */
const GITIGNORE_GLOB_CHARS_RE = /[\\*?[\]]/g;

/**
 * Builds the `.gitignore` line for a workspace-relative path: anchored with a leading `/` so it
 * cannot match same-named nested paths, trailing `/` for directories, glob characters escaped.
 * The leading anchor also neutralizes `#`/`!` at the start of a file name.
 */
export function buildGitignoreEntry(relPath: string, isDirectory: boolean): string {
	const escaped = relPath.replace(GITIGNORE_GLOB_CHARS_RE, char => `\\${char}`);
	return `/${escaped}${isDirectory ? '/' : ''}`;
}

/** Equivalent literal spellings of a relative path as a `.gitignore` line (trimmed). */
function entryVariants(relPath: string): Set<string> {
	const escaped = relPath.replace(GITIGNORE_GLOB_CHARS_RE, char => `\\${char}`);
	const variants = new Set<string>();
	for (const spelling of new Set([relPath, escaped])) {
		variants.add(spelling);
		variants.add(`/${spelling}`);
		variants.add(`${spelling}/`);
		variants.add(`/${spelling}/`);
	}
	return variants;
}

/** Detects the dominant end-of-line sequence so edits keep the file's existing style. */
function eolOf(content: string): string {
	return content.includes('\r\n') ? '\r\n' : '\n';
}

/**
 * Appends `entry` (built by {@link buildGitignoreEntry}) for `relPath` unless an equivalent
 * literal line is already present. Preserves EOL style and guarantees a trailing newline.
 */
export function addGitignoreEntry(content: string, relPath: string, entry: string): { content: string; added: boolean } {
	const variants = entryVariants(relPath);
	const eol = eolOf(content);
	const lines = content.length === 0 ? [] : content.split(/\r?\n/);
	if (lines.some(line => variants.has(line.trim()))) {
		return { content, added: false };
	}
	while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
		lines.pop();
	}
	lines.push(entry);
	return { content: lines.join(eol) + eol, added: true };
}

/**
 * Removes every literal line matching `relPath` (anchored/unanchored, with/without trailing
 * slash). `removed: false` means no exact entry existed — the path may still be ignored by a
 * wildcard pattern, which is the user's to edit.
 */
export function removeGitignoreEntry(content: string, relPath: string): { content: string; removed: boolean } {
	const variants = entryVariants(relPath);
	const eol = eolOf(content);
	const lines = content.split(/\r?\n/);
	const kept = lines.filter(line => !variants.has(line.trim()));
	if (kept.length === lines.length) {
		return { content, removed: false };
	}
	return { content: kept.join(eol), removed: true };
}

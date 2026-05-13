/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Tool-hardening utilities — anti-shell contract, truncation, structured errors.
 *
 * Goal: prevent the LLM from collapsing into shell pipes (Get-Content / cat / findstr)
 * when a dedicated built-in tool exists. Long shell stdout is the primary cause of
 * IDE/host hangs we observed in other agent frontends.
 */

export type ShellMisuseKind =
	| 'read_file'
	| 'list_dir'
	| 'search_pathnames'
	| 'search_content'
	| 'edit_file'
	| 'tree';

export interface ShellMisuse {
	kind: ShellMisuseKind;
	suggestedTool: string;
	hint: string;
}

/**
 * Returns a misuse descriptor if the given shell command duplicates a built-in tool.
 * Returns null for legitimate shell usage (git, npm, build scripts, tests, etc).
 *
 * Conservative on purpose: only flags head-of-command invocations of well-known
 * file-reading / grep / ls binaries. Commands that *contain* these as substrings
 * inside a larger pipeline are not blocked.
 */
export function detectShellMisuse(rawCommand: string): ShellMisuse | null {
	const cmd = rawCommand.trim();
	if (!cmd) return null;

	// Strip leading env-var assignments (POSIX) and PowerShell `& ` call-operator prefixes.
	const stripped = cmd
		.replace(/^(?:[A-Z_][A-Z0-9_]*=\S+\s+)+/i, '')
		.replace(/^&\s+/, '')
		.replace(/^['"]?/, '')
		.trim();

	const head = stripped.split(/[\s|&;]/, 1)[0]?.toLowerCase() ?? '';
	const bareName = head.split(/[\\/]/).pop()?.replace(/\.(exe|cmd|bat|ps1)$/i, '') ?? '';

	// 1. Read file
	if (/^(get-content|gc|type|cat|bat|nl|more|less)$/i.test(bareName)) {
		return {
			kind: 'read_file',
			suggestedTool: 'read_file',
			hint: `Use the read_file tool for reading file contents. Shell readers like ${bareName} stream through stdout and can block the IDE on large files. read_file paginates and accepts startLine/endLine.`,
		};
	}

	// head/tail with a file argument (not piped). If piped, leave it alone — common shell hygiene.
	if (/^(head|tail)$/i.test(bareName) && !/\|/.test(stripped)) {
		return {
			kind: 'read_file',
			suggestedTool: 'read_file',
			hint: `Use read_file with start_line/end_line/line_limit instead of ${bareName}. read_file returns numbered lines suitable for subsequent edit_file calls.`,
		};
	}

	// 2. List dir / tree
	if (/^(dir|ls|tree)$/i.test(bareName)) {
		// Allow `dir <file>` (no flags, single arg) — harmless. Block recursive forms.
		const tailFlags = stripped.slice(bareName.length).trim();
		const isRecursive = /-r|\/s|\/b|--recursive|-R\b|-la\b|-al\b/i.test(tailFlags);
		const isPlainName = !tailFlags || /^[\w.\-/\\:]+$/.test(tailFlags);
		if (isRecursive || !isPlainName) {
			return {
				kind: bareName === 'tree' ? 'tree' : 'list_dir',
				suggestedTool: bareName === 'tree' ? 'get_dir_tree' : 'ls_dir',
				hint: bareName === 'tree'
					? `Use the get_dir_tree tool for recursive directory views — it respects workspace boundaries and pagination.`
					: `Use the ls_dir tool (or glob for patterns) instead of "${bareName}". Recursive shell listings can produce huge stdout and stall the chat.`,
			};
		}
	}

	// 3. Find files by name
	if (/^(find|fd|where)$/i.test(bareName) && /-name\b|--name\b|-iname\b/i.test(stripped)) {
		return {
			kind: 'search_pathnames',
			suggestedTool: 'glob',
			hint: `Use the glob tool with a pattern like "**/*.ts" instead of "${bareName} -name". glob uses VS Code's indexed search and returns URIs directly.`,
		};
	}

	// 4. Content search
	if (/^(grep|egrep|fgrep|rg|ag|ack|findstr|select-string|sls)$/i.test(bareName)) {
		return {
			kind: 'search_content',
			suggestedTool: 'grep',
			hint: `Use the grep tool for content search. It is built on ripgrep and supports glob/type/output_mode/multiline. Shell ${bareName} blows up stdout on large repos.`,
		};
	}

	// 5. In-place editors
	if (/^(sed|awk|perl)$/i.test(bareName) && /-i\b/i.test(stripped)) {
		return {
			kind: 'edit_file',
			suggestedTool: 'edit_file',
			hint: `Use the edit_file tool with SEARCH/REPLACE blocks instead of "${bareName} -i". edit_file integrates with the IDE diff view and respects per-file permissions.`,
		};
	}

	return null;
}

/**
 * Structured tool-validation error. Surfaces a stable error_code + hint
 * pair that the LLM can parse without scraping the message string.
 */
export class ToolValidationError extends Error {
	readonly code: string;
	readonly hint?: string;
	readonly suggestedTool?: string;

	constructor(opts: { code: string; message: string; hint?: string; suggestedTool?: string }) {
		super(opts.message);
		this.name = 'ToolValidationError';
		this.code = opts.code;
		this.hint = opts.hint;
		this.suggestedTool = opts.suggestedTool;
	}
}

/**
 * Truncate a string to at most `cap` characters by keeping the head and tail,
 * joining them with a separator that announces the elision. Stable shape for
 * model consumption: model can recognise the marker and request a re-read.
 */
export function truncateHeadTail(s: string, cap: number, marker = '\n...\n[truncated]\n...\n'): string {
	if (s.length <= cap) return s;
	const slack = Math.max(0, cap - marker.length);
	const half = Math.floor(slack / 2);
	return s.slice(0, half) + marker + s.slice(s.length - (slack - half));
}

/**
 * Heuristic line-counter for cap-decisions without materialising arrays.
 */
export function countLines(s: string): number {
	if (!s) return 0;
	let n = 1;
	for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 10) n++;
	return n;
}

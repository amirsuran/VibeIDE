/*--------------------------------------------------------------------------------------
 *  Copyright 2026 VibeIDE Team. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt in the project root for license information.
 *--------------------------------------------------------------------------------------*/

/**
 * Cursor-style rule file (`.mdc`) frontmatter parsing for `.vibe/rules/` and `.cursor/rules/`
 * (roadmap R.1). `.mdc` files carry a leading YAML-ish frontmatter block:
 *
 *   ---
 *   description: When to apply this rule
 *   globs: src/**\/*.ts, *.tsx
 *   alwaysApply: true
 *   ---
 *   <rule body…>
 *
 * We strip the frontmatter from the body (the body is the instruction the model reads) and
 * expose the parsed keys so callers can later gate by `alwaysApply` / `globs`. Pure & dependency-free
 * so it unit-tests without the workspace services.
 */

export interface ParsedRuleFile {
	readonly frontmatter: Readonly<Record<string, string>>;
	readonly body: string;
}

// Frontmatter must be the very first content: `---` on line 1 (optional BOM/trailing spaces),
// a block, then a closing `---` line. CRLF and LF both tolerated. Non-greedy block match.
const FRONTMATTER_RE = /^﻿?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;
const KEY_VALUE_RE = /^([A-Za-z0-9_-]+)[ \t]*:[ \t]*(.*)$/;

export function parseRuleFrontmatter(content: string): ParsedRuleFile {
	const match = FRONTMATTER_RE.exec(content);
	if (!match) {
		return { frontmatter: {}, body: content };
	}
	const frontmatter: Record<string, string> = {};
	for (const line of match[1].split(/\r?\n/)) {
		const kv = KEY_VALUE_RE.exec(line);
		if (kv) {
			frontmatter[kv[1].toLowerCase()] = kv[2].trim();
		}
	}
	return { frontmatter, body: content.slice(match[0].length) };
}

/** Recognise rule files by extension: Markdown (`.md`) and Cursor rules (`.mdc`). */
export function isRuleFileName(name: string): boolean {
	return /\.(md|mdc)$/i.test(name);
}

/** Parse `alwaysApply: true` (case-insensitive). Absent / non-true → false. */
export function isAlwaysApply(frontmatter: Readonly<Record<string, string>>): boolean {
	return (frontmatter['alwaysapply'] ?? '').trim().toLowerCase() === 'true';
}

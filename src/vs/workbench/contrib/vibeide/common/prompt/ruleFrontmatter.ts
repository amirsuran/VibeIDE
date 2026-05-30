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

/**
 * Tri-state `alwaysApply`: `true` / `false` when present, `undefined` when the key is absent.
 * The distinction matters for activation: an explicit `alwaysApply: false` means
 * "conditional/agent-requested", while ABSENT means "plain rule → always inject" (back-compat).
 */
export function parseAlwaysApply(frontmatter: Readonly<Record<string, string>>): boolean | undefined {
	if (!('alwaysapply' in frontmatter)) { return undefined; }
	return frontmatter['alwaysapply'].trim().toLowerCase() === 'true';
}

/** Split a comma-separated frontmatter list, stripping surrounding quotes/whitespace and empties. */
function splitList(value: string | undefined): string[] {
	if (!value) { return []; }
	return value
		.split(',')
		.map(s => s.trim().replace(/^["']|["']$/g, '').trim())
		.filter(s => s.length > 0);
}

/** `triggers: "deploy", "ci"` → `['deploy','ci']` (lowercased for case-insensitive matching). R.7. */
export function parseTriggers(frontmatter: Readonly<Record<string, string>>): string[] {
	return splitList(frontmatter['triggers']).map(s => s.toLowerCase());
}

/** `globs: src/**\/*.ts, *.tsx` → `['src/**\/*.ts','*.tsx']` (case preserved for path matching). R.2. */
export function parseGlobs(frontmatter: Readonly<Record<string, string>>): string[] {
	return splitList(frontmatter['globs']);
}

function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Whole-word, case-insensitive match of any trigger inside `text`. Uses Unicode letter/number
 * boundaries so Cyrillic / mixed-language triggers work (`\b` is ASCII-only).
 */
export function matchesAnyTrigger(triggers: readonly string[], text: string): boolean {
	if (!text) { return false; }
	for (const t of triggers) {
		if (!t) { continue; }
		// eslint-disable-next-line local/code-no-unexternalized-strings
		const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(t)}(?![\\p{L}\\p{N}])`, 'iu');
		if (re.test(text)) { return true; }
	}
	return false;
}

export interface RuleMeta {
	/** `true` / `false` when the key is present; `undefined` when absent (plain rule). */
	readonly alwaysApply: boolean | undefined;
	readonly triggers: readonly string[];
	readonly globs: readonly string[];
}

export type RuleActivation = 'inject' | 'index';

/**
 * Decide whether a rule's body goes into the prompt (`inject`) or is merely listed as available
 * (`index`, R.3 agent-requested) given the current user message.
 *
 *  - `alwaysApply: true`                         → inject
 *  - has `triggers` matching the user message    → inject (R.7)
 *  - conditional (alwaysApply:false / has triggers / has globs) but unmatched → index
 *  - plain rule (no frontmatter conditions)      → inject (back-compat: flat .md / AGENTS.md)
 *
 * `globs` are treated as "conditional, currently unmatched → index" until R.2 wires open-file
 * matching; this keeps glob-scoped rules out of every prompt rather than always-on.
 */
export function decideRuleActivation(meta: RuleMeta, userText: string | undefined): RuleActivation {
	if (meta.alwaysApply === true) { return 'inject'; }
	if (meta.triggers.length > 0 && userText && matchesAnyTrigger(meta.triggers, userText)) { return 'inject'; }
	if (meta.alwaysApply === false || meta.triggers.length > 0 || meta.globs.length > 0) { return 'index'; }
	return 'inject';
}

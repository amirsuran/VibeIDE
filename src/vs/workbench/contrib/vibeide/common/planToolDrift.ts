/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { approvalTypeOfBuiltinToolName } from './prompt/tools/index.js';
import { isABuiltinToolName } from './prompt/prompts.js';

/**
 * Plan tool-drift matching (persisted plans, `.vibe/plans/*.plan.md`).
 *
 * Planner LLMs write step tool hints free-form (`edit_file`, `write_file`,
 * `run_terminal_command`, …) while the executor calls canonical builtin names
 * (`rewrite_file`, `run_command`, …). Exact/substring matching alone pauses the plan
 * on every such synonym — the «инструмент не совпадает с запланированными» loop.
 * The fix: tools are equivalent when they belong to the same CLASS (edits/terminal),
 * derived from `approvalTypeOfBuiltinToolName` for builtins and from name heuristics
 * for free-form hints.
 */

export type PlanToolClass = 'read' | 'edits' | 'terminal' | 'unknown';

// Heuristic order matters for free-form names: terminal verbs first (`run_terminal_command`
// carries both `command` and `terminal`), then write verbs, then read verbs.
const TERMINAL_HINT_RE = /(run|terminal|bash|shell|exec|command|kill)/;
const EDITS_HINT_RE = /(edit|write|rewrit|patch|creat|delet|remov|replace)/;
const READ_HINT_RE = /(read|list|^ls|_ls|search|grep|glob|find|browse|fetch|get)/;

/** Classify a tool name: builtins via the authoritative approval map, free-form via heuristics. */
export function resolveToolClass(name: string): PlanToolClass {
	const n = name.toLowerCase().trim();
	if (!n) { return 'unknown'; }
	if (isABuiltinToolName(n)) {
		const approval = approvalTypeOfBuiltinToolName[n];
		if (approval === 'edits') { return 'edits'; }
		if (approval === 'terminal') { return 'terminal'; }
		return approval === undefined ? 'read' : 'unknown';
	}
	if (TERMINAL_HINT_RE.test(n)) { return 'terminal'; }
	if (EDITS_HINT_RE.test(n)) { return 'edits'; }
	if (READ_HINT_RE.test(n)) { return 'read'; }
	return 'unknown';
}

/**
 * Does a tool call satisfy a plan step's tool hints?
 *  1. No hints → anything goes (planners rarely enumerate read tools).
 *  2. Builtin read-only tools are always allowed (orientation before the write).
 *  3. Exact / substring match (pre-existing behavior).
 *  4. Class equivalence — ONLY for builtin tools: `rewrite_file` satisfies an `edit_file`
 *     hint (both `edits`). MCP/non-builtin tools never class-match: their side effects
 *     are external by definition, the planner must name them explicitly.
 */
export function toolMatchesPlanHints(toolName: string, hints: readonly (string | null | undefined)[] | undefined): boolean {
	if (!hints?.length) { return true; }

	const tn = toolName.toLowerCase().trim();
	const isBuiltin = isABuiltinToolName(tn);
	const toolClass = resolveToolClass(tn);
	if (isBuiltin && toolClass === 'read') { return true; }

	const cleanHints = hints
		.map(h => (h ?? '').toLowerCase().trim())
		.filter(h => h.length > 0);

	// Pre-existing exact/substring pass.
	if (cleanHints.some(raw => tn === raw || tn.includes(raw) || raw.includes(tn))) { return true; }

	// Class-equivalence pass (builtins only).
	if (isBuiltin && (toolClass === 'edits' || toolClass === 'terminal')) {
		return cleanHints.some(raw => resolveToolClass(raw) === toolClass);
	}
	return false;
}

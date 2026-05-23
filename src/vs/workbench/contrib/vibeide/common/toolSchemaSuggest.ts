/*--------------------------------------------------------------------------------------
 *  Copyright 2026 VibeIDE Team. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt in the project root for license information.
 *--------------------------------------------------------------------------------------*/

/**
 * Pure helper for cross-tool argument suggestion (X.11.4 / X.13.7 / X.14).
 *
 * Extracted to common-layer so it can be unit-tested without pulling in the
 * full chatThreadService / builtinTools surface. The browser-side wrapper in
 * `chatThreadService.ts` adapts the project's tool catalog through
 * `classifyParams` and feeds candidates into these pure functions.
 *
 * Algorithm: score each candidate by `|rawKeys ∩ candidateRequired| /
 * |candidateRequired|`. A perfect match → 1.0. Best candidate wins if its
 * score >= `minScore` (default 0.6) AND strictly better than the called
 * tool's self-score (so we don't suggest the same tool back when one
 * required param is wrong).
 */

export interface ToolParamSpec {
	readonly required: readonly string[];
}

export interface ToolCandidate {
	readonly name: string;
	readonly params: ToolParamSpec;
}

/**
 * Fraction of `requiredParams` present (case-insensitive) in `rawKeys`.
 * Returns 0 when `requiredParams` is empty (no required → no signal).
 */
export const scoreToolMatch = (
	requiredParams: readonly string[],
	rawKeys: readonly string[],
): number => {
	if (requiredParams.length === 0) return 0;
	const rawSet = new Set(rawKeys.map(k => k.toLowerCase()));
	let hits = 0;
	for (const required of requiredParams) {
		if (rawSet.has(required.toLowerCase())) hits += 1;
	}
	return hits / requiredParams.length;
};

/**
 * Returns name of the candidate whose required-param shape best matches
 * `rawParamKeys`, OR null if no candidate clears the bar.
 *
 * - `minScore` (default 0.6): floor for considering a candidate at all.
 * - The called tool's self-score acts as a second floor — candidates must
 *   beat it strictly. Prevents «one-required-param-typo» from being
 *   misclassified as cross-tool confusion.
 */
export const suggestAlternateTool = (
	calledTool: ToolCandidate,
	candidates: readonly ToolCandidate[],
	rawParamKeys: readonly string[],
	minScore: number = 0.6,
): string | null => {
	if (rawParamKeys.length === 0) return null;
	const calledScore = scoreToolMatch(calledTool.params.required, rawParamKeys);
	let best: { name: string; score: number } | null = null;
	for (const candidate of candidates) {
		if (candidate.name === calledTool.name) continue;
		if (candidate.params.required.length === 0) continue;
		const score = scoreToolMatch(candidate.params.required, rawParamKeys);
		if (score < minScore) continue;
		if (score <= calledScore) continue;
		if (!best || score > best.score) best = { name: candidate.name, score };
	}
	return best?.name ?? null;
};

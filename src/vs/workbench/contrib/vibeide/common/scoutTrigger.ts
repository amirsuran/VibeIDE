/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


/**
 * Auto-scout trigger (Vibe Agents) — pure, side-effect-free classification of a chat request as a
 * "continuation" (продолжи / дальше / доделай …), plus the scout goal builder. A continuation
 * request is the high-signal case where the model reliably lacks context (it references prior work
 * that may have scrolled out of the thread), so a read-only `explore` scout is spawned to surface
 * the relevant leads before the main turn. Lives in `common` → unit-testable from `test/common/`.
 *
 * Trigger policy (agreed): auto on continuation (this module) + a manual one-shot override (input
 * toggle) — NOT a length/vagueness heuristic (too many false positives). See the pre-hook in
 * chatThreadService for the full decision (config gate + thin-context skip + loop guard).
 */

/**
 * Continuation markers. Cyrillic tokens are matched as bare substrings — JS `\b` is ASCII-only and
 * fails next to Cyrillic — so only ASCII tokens get `\b…\b`. Conservative on purpose: only phrases
 * that clearly mean "keep going on the previous work", to avoid scouting plain short requests.
 */
const RE_CONTINUATION = /(продолж|дальше|доделай|дострой|допиши|доведи\s+до\s+конца|заверши\s+начат|доработай|\bcontinue\b|\bgo on\b|keep going|carry on|\bfinish it\b|\bnext step\b)/i;

/** True when the request asks to continue prior work rather than describing a fresh, self-contained task. */
export function isContinuationRequest(text: string): boolean {
	return RE_CONTINUATION.test(text);
}

/**
 * Builds the read-only scout's goal. Structured so the explore agent returns actionable leads:
 * it is told the continuation phrasing, the recently-changed files, and the unfinished plan (both
 * optional), then asked for per-file leads + a one-line task hypothesis.
 */
export function buildScoutGoal(userRequest: string, changedPaths: readonly string[], planSummary?: string): string {
	const lines: string[] = [
		`Пользователь прислал continuation-запрос: "${userRequest.trim()}".`,
		'Определи (ТОЛЬКО ЧТЕНИЕ), что осталось недоделанным и что значит "продолжить" здесь.',
	];
	if (changedPaths.length) {
		lines.push(`Недавно изменённые файлы: ${changedPaths.join(', ')}.`);
	}
	if (planSummary && planSummary.trim()) {
		lines.push(`Незакрытый план:\n${planSummary.trim()}`);
	}
	if (!changedPaths.length && !planSummary?.trim()) {
		lines.push('Явного контекста правок/плана нет — разведай по кодовой базе и истории, что могло остаться недоделанным.');
	}
	lines.push('Верни: список зацепок (файл — что там недоделано) и краткую гипотезу задачи одним предложением.');
	return lines.join('\n');
}

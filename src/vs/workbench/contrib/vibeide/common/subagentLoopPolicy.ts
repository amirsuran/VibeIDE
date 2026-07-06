/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { approvalTypeOfBuiltinToolName } from './prompt/tools/index.js';
import type { ExploreSubagentReport } from './vibeSubagentService.js';

/**
 * Pure decision logic for the headless subagent tool-loop (Phase 3b).
 * The runner (`browser/vibeSubagentRunnerService.ts`) drives LLM/tool services;
 * everything decidable without I/O lives here so it is unit-testable.
 */

/** Denied actions (whitelist rejection / validation failure / user rejection) before giving up. */
export const SUBAGENT_MAX_DENIED_ACTIONS = 5;

/** Rough chars→tokens estimate (≈4 chars/token) — used for the subagent quota, flagged as estimate. */
export function estimateTokensFromChars(chars: number): number {
	return Math.ceil(Math.max(0, chars) / 4);
}

export interface SubagentLoopLimits {
	readonly maxSteps: number;
	/** Estimated-token ceiling for this subagent (0 = unlimited). */
	readonly maxTokensEst: number;
	/** Absolute deadline (unix ms); 0 = no wall-clock limit. */
	readonly deadlineAtMs: number;
	readonly maxDeniedActions: number;
}

export interface SubagentLoopState {
	readonly stepsDone: number;
	readonly tokensUsedEst: number;
	readonly deniedActions: number;
	readonly nowMs: number;
	/** Cooperative cancellation (audit A): parent disposed the subagent — highest-priority stop. */
	readonly cancelled: boolean;
}

export type SubagentStopReason = 'cancelled' | 'max-steps' | 'deadline' | 'token-budget' | 'denied-actions';

/** Decide whether the loop must stop BEFORE the next LLM hop. `undefined` = keep going. */
export function decideStop(state: SubagentLoopState, limits: SubagentLoopLimits): SubagentStopReason | undefined {
	if (state.cancelled) { return 'cancelled'; }
	if (state.stepsDone >= limits.maxSteps) { return 'max-steps'; }
	if (limits.deadlineAtMs > 0 && state.nowMs >= limits.deadlineAtMs) { return 'deadline'; }
	if (limits.maxTokensEst > 0 && state.tokensUsedEst >= limits.maxTokensEst) { return 'token-budget'; }
	if (state.deniedActions >= limits.maxDeniedActions) { return 'denied-actions'; }
	return undefined;
}

export function stopReasonToRussian(reason: SubagentStopReason): string {
	switch (reason) {
		case 'cancelled': return 'отменён родителем';
		case 'max-steps': return 'исчерпан лимит шагов';
		case 'deadline': return 'исчерпан лимит времени';
		case 'token-budget': return 'исчерпана токен-квота';
		case 'denied-actions': return 'слишком много отклонённых действий';
	}
}

/** Enforce the compact-handoff contract (≤500 chars per field). */
export function truncateSummary(s: string, max: number): string {
	const trimmed = s.trim();
	return trimmed.length > max ? trimmed.slice(0, max - 1) + '…' : trimmed;
}

/**
 * Map a role's tool whitelist onto a ChatMode for prompt-side tool exposure:
 * a role allowed ANY approval-requiring tool (write/terminal) runs as 'agent',
 * a purely read-only role runs as 'gather' — that mode's prompt already excludes
 * every approval-requiring tool, so the model never even sees write tools.
 */
export function chatModeForAllowedTools(allowedTools: readonly string[]): 'agent' | 'gather' {
	return allowedTools.some(t => Object.hasOwn(approvalTypeOfBuiltinToolName, t)) ? 'agent' : 'gather';
}

/** Path-ish values from raw tool params — feeds artifacts / explore-report paths. */
export function collectPathsFromRawParams(rawParams: Record<string, unknown>): string[] {
	const out: string[] = [];
	for (const key of ['uri', 'path', 'file', 'filePath', 'fileName']) {
		const v = rawParams[key];
		if (typeof v === 'string' && v.trim()) { out.push(v.trim()); }
	}
	return out;
}

/** Compact explore report from loop facts. Citations are a later refinement — paths carry the signal. */
export function buildExploreReport(touchedPaths: readonly string[], truncated: boolean): ExploreSubagentReport {
	const paths = [...new Set(touchedPaths)].slice(0, 50);
	return {
		paths,
		citations: [],
		confidence: truncated ? 0.35 : (paths.length > 0 ? 0.7 : 0.4),
		truncated,
		...(truncated ? { truncationSuggestion: 'retry' as const } : {}),
	};
}

/** First user message of the isolated transcript: role framing + goal + optional context. */
export function buildSubagentTaskMessage(opts: { displayName: string; systemAppendix: string; goal: string; acceptanceCriteria?: string; contextItems?: readonly string[] }): string {
	const parts: string[] = [];
	parts.push(`Ты выполняешь роль: ${opts.displayName}.`);
	if (opts.systemAppendix.trim()) { parts.push(opts.systemAppendix.trim()); }
	parts.push(`Задача: ${opts.goal.trim()}`);
	if (opts.acceptanceCriteria?.trim()) { parts.push(`Критерии приёмки: ${opts.acceptanceCriteria.trim()}`); }
	if (opts.contextItems?.length) { parts.push(`Контекст (файлы/ссылки): ${opts.contextItems.join(', ')}`); }
	parts.push('Работай автономно. Когда задача выполнена — заверши ход инструментом vibe_complete с кратким итогом (если vibe_complete недоступен — просто закончи ответ кратким итогом без вызова инструментов).');
	return parts.join('\n\n');
}

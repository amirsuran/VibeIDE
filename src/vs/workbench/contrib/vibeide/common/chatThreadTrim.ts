/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 VibeIDE Team. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ChatMessage } from './chatThreadServiceTypes.js';

export interface ThreadTrimResult {
	/** New messages array, bounded to ~target, with a trim marker (and pinned anchor) at the head. */
	readonly trimmed: ChatMessage[];
	/** How many oldest messages were dropped (what the trim marker reports). */
	readonly dropCount: number;
	/** The post-trim length target (cap - headroom). */
	readonly target: number;
	/** Whether the original task (first user message) was re-pinned at the head. */
	readonly pinnedAnchor: boolean;
}

/**
 * Pure thread-message trim. Bounds the in-memory/persisted message JSON so long
 * agent sessions don't OOM the renderer, WITHOUT losing the original task.
 *
 * Dropping the oldest messages naively scrolls the first user request out of the
 * thread, so after enough trims the model "forgets" what it was asked to do and
 * greets the user fresh as if the session were empty (model-stalls #012). To
 * prevent that, the FIRST user message (the task/goal) is re-pinned at the head
 * whenever it would otherwise fall inside the dropped range — never duplicated
 * (skipped when it already survives in the tail).
 *
 * Returns `null` when no trim is needed (length <= cap). `cap`/`headroom` are
 * clamped here so callers can pass raw config values.
 */
export function trimThreadMessages(messages: ChatMessage[], cap: number, headroom: number): ThreadTrimResult | null {
	const safeCap = Math.max(100, Math.min(5000, Math.floor(cap)));
	const safeHeadroom = Math.max(1, Math.min(safeCap - 1, Math.floor(headroom)));
	const target = Math.max(100, safeCap - safeHeadroom);
	if (messages.length <= safeCap) { return null; }

	const dropCount = messages.length - target;
	const firstUserIdx = messages.findIndex(m => m.role === 'user');
	const anchorMsg = (firstUserIdx >= 0 && firstUserIdx < dropCount) ? messages[firstUserIdx] : undefined;

	const trimMarker: ChatMessage = {
		role: 'assistant',
		displayContent: `_(${dropCount} earlier message${dropCount === 1 ? '' : 's'} trimmed from thread to keep memory bounded. Convert pipeline still summarises older context into each LLM request.)_`,
		reasoning: '',
		anthropicReasoning: null,
		createdAt: Date.now(),
	};

	const tail = messages.slice(dropCount);
	// Honor pin-context: keep any user-pinned message from the dropped head verbatim
	// (same treatment as the task anchor) so an explicit pin survives the hard thread
	// cap, not just budget-fill truncation. Exclude the anchor index to avoid a dup.
	const pinnedFromHead = messages
		.slice(0, dropCount)
		.filter((m, i) => (m as { pinned?: boolean }).pinned && i !== firstUserIdx);
	const head: ChatMessage[] = [];
	if (anchorMsg) { head.push(anchorMsg); }
	head.push(...pinnedFromHead, trimMarker);
	const trimmed = [...head, ...tail];
	return { trimmed, dropCount, target, pinnedAnchor: !!anchorMsg };
}

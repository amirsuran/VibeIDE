/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Auto-feed of the model-quirks catalog from runtime evidence (roadmap O.13).
 *
 * The runtime already self-heals a model that emits broken native tool-calls: an
 * `_autoDetected` override switches it to XML-fallback with a TTL and a re-probe
 * (see chatThreadService, roadmap O.2/O.9). What that dance cannot fix is the model
 * that goes through it EVERY session — each new session burns failing turns before
 * the downgrade kicks in again. That cross-session repetition is the signature that
 * justifies a DURABLE per-model fix, and it is the only signal this module acts on.
 * One-off downgrades within a single session are the runtime's business — never ours.
 *
 * Pure state machinery only (persistable via JSON round-trip, testable); storage,
 * notifications and the actual override write live in `vibeQuirkAutoFeedService.ts`.
 */

export interface QuirkAutoFeedModelStat {
	/** Total auto-downgrade events observed for this model (all sessions). */
	readonly downgradeCount: number;
	/** Distinct sessions in which at least one auto-downgrade fired. */
	readonly sessionCount: number;
	/** Session that last contributed to `sessionCount` (dedup within a session). */
	readonly lastSessionId: string;
	readonly lastAtMs: number;
	/** A durable-quirk suggestion was already shown — never nag about this model again. */
	readonly suggested: boolean;
}

/** Keyed by `${providerName}:${modelName}` — same key format chatThreadService uses. */
export type QuirkAutoFeedState = Record<string, QuirkAutoFeedModelStat>;

/** Suggest a durable quirk after auto-downgrade fired in this many DISTINCT sessions. */
export const QUIRK_AUTOSUGGEST_DEFAULT_SESSIONS = 2;

/** Tolerant parse of the persisted state — a corrupt blob resets to empty, never throws. */
export function parseQuirkAutoFeedState(raw: string | null | undefined): QuirkAutoFeedState {
	if (!raw) { return {}; }
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) { return {}; }
		const out: QuirkAutoFeedState = {};
		for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
			if (!value || typeof value !== 'object') { continue; }
			const v = value as Record<string, unknown>;
			if (typeof v.downgradeCount !== 'number' || typeof v.sessionCount !== 'number') { continue; }
			out[key] = {
				downgradeCount: v.downgradeCount,
				sessionCount: v.sessionCount,
				lastSessionId: typeof v.lastSessionId === 'string' ? v.lastSessionId : '',
				lastAtMs: typeof v.lastAtMs === 'number' ? v.lastAtMs : 0,
				suggested: v.suggested === true,
			};
		}
		return out;
	} catch {
		return {};
	}
}

/** Record one auto-downgrade event; `sessionCount` grows once per distinct session. Returns a new state. */
export function recordAutoDowngrade(state: QuirkAutoFeedState, modelKey: string, sessionId: string, atMs: number): QuirkAutoFeedState {
	const prev = state[modelKey];
	const isNewSession = !prev || prev.lastSessionId !== sessionId;
	const next: QuirkAutoFeedModelStat = {
		downgradeCount: (prev?.downgradeCount ?? 0) + 1,
		sessionCount: (prev?.sessionCount ?? 0) + (isNewSession ? 1 : 0),
		lastSessionId: sessionId,
		lastAtMs: atMs,
		suggested: prev?.suggested ?? false,
	};
	return { ...state, [modelKey]: next };
}

/** The cross-session signature: enough distinct sessions with a downgrade, not yet suggested. */
export function shouldSuggestDurableXml(stat: QuirkAutoFeedModelStat | undefined, minSessions: number): boolean {
	if (!stat || stat.suggested) { return false; }
	return stat.sessionCount >= Math.max(1, minSessions);
}

export function markSuggested(state: QuirkAutoFeedState, modelKey: string): QuirkAutoFeedState {
	const prev = state[modelKey];
	if (!prev) { return state; }
	return { ...state, [modelKey]: { ...prev, suggested: true } };
}

/**
 * Ready-to-PR rule snippet for `resources/model-quirks.json` (the data-driven catalog
 * path: one-file PR instead of an IDE release). Note text is English — it ships upstream.
 */
export function buildCatalogRuleSnippet(providerName: string, modelName: string, stat: QuirkAutoFeedModelStat): string {
	return JSON.stringify({
		match: modelName.toLowerCase(),
		provider: providerName,
		forceToolCallFormat: 'xml',
		note: `auto-suggested by VibeIDE: native-FC auto-downgrade (numeric-tool-name) fired in ${stat.sessionCount} distinct sessions (${stat.downgradeCount} events)`,
	}, null, '\t');
}

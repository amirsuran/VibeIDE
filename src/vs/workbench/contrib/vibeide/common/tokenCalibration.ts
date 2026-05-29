/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 VibeIDE Team. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Token-budget calibration (roadmap: aggregator-failures backlog "provider-reported usage").
 *
 * Our prompt-size accounting uses a crude `text.length / 4` heuristic. The real prompt token
 * count a provider reports (`usage.promptTokens`) is systematically different: it includes
 * tool-schema JSON, role/formatting overhead we don't model, and uses the model's actual
 * tokenizer (CJK / code can be far denser than 4 chars/token). Left uncorrected, the heuristic
 * under-counts → we believe a prompt fits the budget when the provider sees an overflow.
 *
 * These pure helpers maintain a per-(provider×model) EWMA factor that maps our raw estimate to
 * real tokens. Callers keep estimating raw and divide their budget/cap thresholds by the factor,
 * so the reserved headroom tracks reality without changing the estimator everywhere.
 *
 * No I/O, no services — unit-testable in isolation.
 */

/** Identity factor used before any real usage sample has been observed (or when disabled). */
export const TOKEN_CALIBRATION_DEFAULT = 1;
/** EWMA weight on the newest sample (0..1). Higher = adapts faster, noisier. */
export const TOKEN_CALIBRATION_ALPHA = 0.3;
/** Clamp band for the factor — guards against a pathological single sample skewing the budget. */
export const TOKEN_CALIBRATION_MIN = 0.5;
export const TOKEN_CALIBRATION_MAX = 3;

/**
 * EWMA update of the estimate→real calibration factor. `ratio = realTokens / estimatedTokens`,
 * clamped to [MIN, MAX]. Returns the previous factor unchanged on non-positive / non-finite
 * inputs (a failed/empty turn must not corrupt the running average).
 */
export const updateTokenCalibration = (prev: number | undefined, realTokens: number, estimatedTokens: number): number => {
	if (!Number.isFinite(realTokens) || !Number.isFinite(estimatedTokens) || realTokens <= 0 || estimatedTokens <= 0) {
		return prev ?? TOKEN_CALIBRATION_DEFAULT;
	}
	const ratio = Math.min(TOKEN_CALIBRATION_MAX, Math.max(TOKEN_CALIBRATION_MIN, realTokens / estimatedTokens));
	if (prev === undefined || !Number.isFinite(prev)) { return ratio; }
	return prev * (1 - TOKEN_CALIBRATION_ALPHA) + ratio * TOKEN_CALIBRATION_ALPHA;
};

/**
 * Defensive read of a stored factor: substitutes the identity factor for undefined / non-finite
 * values and clamps anything out of band. Use at the point where the factor is applied.
 */
export const clampTokenCalibration = (factor: number | undefined): number => {
	if (factor === undefined || !Number.isFinite(factor)) { return TOKEN_CALIBRATION_DEFAULT; }
	return Math.min(TOKEN_CALIBRATION_MAX, Math.max(TOKEN_CALIBRATION_MIN, factor));
};

/**
 * Serialize a per-(provider×model) calibration map to a compact JSON string for persistence.
 * The factor is a stable property of the model's tokenizer vs our length/4 heuristic, so it is
 * worth surviving window reloads (otherwise it re-learns over the first ~2 turns each session).
 */
export const serializeCalibration = (factors: ReadonlyMap<string, number>): string => {
	const obj: Record<string, number> = {};
	for (const [k, v] of factors) {
		if (Number.isFinite(v)) { obj[k] = v; }
	}
	return JSON.stringify(obj);
};

/**
 * Parse a persisted calibration blob back into a Map, dropping any malformed / out-of-band
 * entries (defensive against corrupted or hand-edited storage). Never throws — returns an empty
 * Map on any parse failure.
 */
export const deserializeCalibration = (raw: string | undefined): Map<string, number> => {
	const out = new Map<string, number>();
	if (!raw) { return out; }
	try {
		const obj = JSON.parse(raw) as unknown;
		if (!obj || typeof obj !== 'object') { return out; }
		for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
			if (typeof k === 'string' && k.length > 0 && typeof v === 'number' && Number.isFinite(v)) {
				out.set(k, clampTokenCalibration(v));
			}
		}
	} catch {
		// corrupted blob — start fresh
	}
	return out;
};

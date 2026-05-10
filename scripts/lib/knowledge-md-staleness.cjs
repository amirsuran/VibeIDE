/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 VibeIDE Team. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Pure helper for `vibe doctor --knowledge` (roadmap §M.0 L1092).
//
// Local-only `docs/knowledge.md` captures non-trivial architectural findings.
// Without a periodic prod, it ages: code lands, knowledge.md doesn't, and a
// year later the file is misleading. This module decides — given the file's
// mtime and the set of newer service files in `common/` — whether to emit a
// warning, an info nudge, or stay silent.
//
// Pure: no fs / no process calls; the doctor wrapper feeds the timestamps in.
// All tests live in knowledge-md-staleness.test.cjs.

'use strict';

const DEFAULT_STALENESS_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * @typedef {Object} KnowledgeStalenessInput
 * @property {boolean} fileExists                 — true if docs/knowledge.md is on disk
 * @property {number | null} fileMtimeMs          — mtime of docs/knowledge.md (ms since epoch) or null when fileExists=false
 * @property {ReadonlyArray<{path: string, mtimeMs: number}>} commonServiceFiles
 *           — every `.ts` under contrib/vibeide/common/ with its mtime
 * @property {number} nowMs                       — clock for the comparison
 * @property {number} [stalenessThresholdMs]      — override the 30-day default
 */

/**
 * @typedef {Object} KnowledgeStalenessDecision
 * @property {'silent' | 'info' | 'warn'} verdict
 * @property {string | null} reason             — one-line human description
 * @property {number} fileAgeMs                 — 0 when fileExists=false
 * @property {ReadonlyArray<string>} newerServiceFiles
 *           — paths of services edited after the knowledge file
 */

/**
 * Pure decision:
 *  - file absent                         → silent (no nudge — knowledge.md is opt-in)
 *  - file < threshold AND 0 newer files  → silent (knowledge is fresh)
 *  - file < threshold AND ≥1 newer file  → info (subtle nudge — services moved)
 *  - file ≥ threshold AND ≥1 newer file  → warn (file aged + drift detected)
 *  - file ≥ threshold AND 0 newer files  → info (drift not yet detected, but old)
 *
 * @param {KnowledgeStalenessInput} input
 * @returns {KnowledgeStalenessDecision}
 */
function decideKnowledgeStaleness(input) {
	const threshold = typeof input.stalenessThresholdMs === 'number' && input.stalenessThresholdMs > 0
		? input.stalenessThresholdMs
		: DEFAULT_STALENESS_THRESHOLD_MS;

	if (!input.fileExists || input.fileMtimeMs === null || input.fileMtimeMs === undefined) {
		return { verdict: 'silent', reason: null, fileAgeMs: 0, newerServiceFiles: [] };
	}

	const fileAgeMs = Math.max(0, input.nowMs - input.fileMtimeMs);
	const newerServiceFiles = (input.commonServiceFiles || [])
		.filter(s => s && typeof s.mtimeMs === 'number' && s.mtimeMs > input.fileMtimeMs)
		.map(s => s.path)
		.sort();

	const fileIsStale = fileAgeMs >= threshold;
	const hasDrift = newerServiceFiles.length > 0;

	if (!fileIsStale && !hasDrift) {
		return { verdict: 'silent', reason: 'knowledge.md is fresh and tracks all services', fileAgeMs, newerServiceFiles };
	}
	if (!fileIsStale && hasDrift) {
		return {
			verdict: 'info',
			reason: `${newerServiceFiles.length} service file(s) edited after last knowledge.md update; consider documenting`,
			fileAgeMs,
			newerServiceFiles,
		};
	}
	if (fileIsStale && !hasDrift) {
		return {
			verdict: 'info',
			reason: `knowledge.md is ${formatAge(fileAgeMs)} old; no service drift detected`,
			fileAgeMs,
			newerServiceFiles,
		};
	}
	// fileIsStale && hasDrift
	return {
		verdict: 'warn',
		reason: `knowledge.md is ${formatAge(fileAgeMs)} old AND ${newerServiceFiles.length} service file(s) have been edited since`,
		fileAgeMs,
		newerServiceFiles,
	};
}

/** @param {number} ageMs */
function formatAge(ageMs) {
	const days = Math.floor(ageMs / (24 * 60 * 60 * 1000));
	if (days < 1) return 'less than 1 day';
	if (days < 30) return `${days} day${days === 1 ? '' : 's'}`;
	const months = Math.floor(days / 30);
	return `${months} month${months === 1 ? '' : 's'}`;
}

/**
 * @param {KnowledgeStalenessDecision} decision
 * @returns {string}
 */
function renderKnowledgeStaleness(decision) {
	if (decision.verdict === 'silent') {
		return decision.reason ? `(silent) ${decision.reason}` : '(silent) docs/knowledge.md not present — opt-in.';
	}
	const head = decision.verdict === 'warn' ? '⚠️  knowledge.md may be stale' : 'ℹ️  knowledge.md status';
	const lines = [head, '', decision.reason || ''];
	if (decision.newerServiceFiles.length > 0) {
		lines.push('');
		lines.push('Service files edited after last knowledge.md update:');
		for (const p of decision.newerServiceFiles.slice(0, 20)) {
			lines.push(`  - ${p}`);
		}
		if (decision.newerServiceFiles.length > 20) {
			lines.push(`  …и ещё ${decision.newerServiceFiles.length - 20}`);
		}
	}
	return lines.join('\n');
}

module.exports = {
	DEFAULT_STALENESS_THRESHOLD_MS,
	decideKnowledgeStaleness,
	renderKnowledgeStaleness,
};

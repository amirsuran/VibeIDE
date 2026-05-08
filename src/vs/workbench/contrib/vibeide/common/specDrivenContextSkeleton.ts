/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 VibeIDE Team. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * `VibeSpecDrivenContextService` — parser-diff shapes + sentinel skeleton
 * (roadmap §"Real-impl tail / Phase 3b — `VibeSpecDrivenContextService`
 * реальный parser diff (`swagger-parser`, `graphql-js`); breaking change
 * heuristic ловит только обвал синтаксиса, не семантику").
 *
 * This skeleton lands the **typed shapes and the sentinel error class**
 * so the runtime adopter has a stable contract; the actual `swagger-parser`
 * + `graphql-js` integrations are install-and-finish work that the
 * roadmap-max skill keeps out of scope when the package set is not already
 * in `package.json`. When the runtime side adopts these libraries, the
 * sentinel stubs here get replaced with real parsing.
 */

export type SpecKind = 'openapi' | 'graphql';

export type BreakingChangeSeverity = 'major' | 'minor' | 'patch' | 'unknown';

export interface SpecDriftEntry {
	readonly kind: SpecKind;
	readonly path: string;
	readonly summary: string;
	readonly severity: BreakingChangeSeverity;
}

export interface SpecDiffInput {
	readonly kind: SpecKind;
	readonly oldText: string;
	readonly newText: string;
}

export interface SpecDiffResult {
	readonly entries: ReadonlyArray<SpecDriftEntry>;
	readonly hasBreaking: boolean;
}

export class SpecDrivenContextNotImplementedError extends Error {
	constructor(operation: string) {
		super(
			`SpecDrivenContextService is not yet implemented (operation: ${operation}). ` +
			`Skeleton landed in src/vs/workbench/contrib/vibeide/common/specDrivenContextSkeleton.ts; ` +
			`real-impl requires \`swagger-parser\` + \`graphql-js\` install + diff walkers. ` +
			`See roadmap §"Real-impl tail / VibeSpecDrivenContextService".`,
		);
		this.name = 'SpecDrivenContextNotImplementedError';
	}
}

/**
 * Pure: classify a syntax-only diff as breaking-or-not. This is the
 * fail-loud heuristic the existing service uses — kept here so a switch
 * to the real parser-aware diff is a one-line replacement at the call
 * site (the diff entry shape is stable).
 *
 * Heuristic rules (collect-all-failures style):
 *   - non-trivial size shrink (>20% bytes) → 'major'
 *   - non-trivial size growth (>200% bytes) → 'minor'
 *   - 0-byte input → 'unknown' (caller decides what to do)
 *   - identical inputs → empty `entries`, hasBreaking = false
 *
 * The real parser-aware `diffOpenApi` / `diffGraphql` will replace this
 * helper but keep the same return shape.
 */
export function diffSpecHeuristic(input: SpecDiffInput): SpecDiffResult {
	const oldLen = input.oldText.length;
	const newLen = input.newText.length;

	if (oldLen === 0 || newLen === 0) {
		return {
			entries: [{
				kind: input.kind,
				path: '<root>',
				summary: oldLen === 0 ? 'spec text was empty before; cannot diff semantics' : 'spec text became empty; full removal',
				severity: 'unknown',
			}],
			hasBreaking: oldLen > 0 && newLen === 0,
		};
	}

	if (input.oldText === input.newText) {
		return { entries: [], hasBreaking: false };
	}

	const ratio = newLen / oldLen;
	const entries: SpecDriftEntry[] = [];
	if (ratio < 0.8) {
		entries.push({
			kind: input.kind,
			path: '<root>',
			summary: `spec shrank ${(100 - ratio * 100).toFixed(1)}% (heuristic — likely removed endpoints/types)`,
			severity: 'major',
		});
	} else if (ratio > 3) {
		entries.push({
			kind: input.kind,
			path: '<root>',
			summary: `spec grew ${(ratio * 100 - 100).toFixed(1)}% (heuristic — likely added endpoints/types)`,
			severity: 'minor',
		});
	} else {
		entries.push({
			kind: input.kind,
			path: '<root>',
			summary: 'spec changed within size bounds; semantic diff not yet implemented',
			severity: 'patch',
		});
	}
	return { entries, hasBreaking: entries.some(e => e.severity === 'major') };
}

/**
 * Sentinel for the real parser-aware OpenAPI diff. Throws — the runtime
 * adopter (after `npm install swagger-parser`) replaces with real impl.
 */
export function diffOpenApi(_input: { oldSpec: string; newSpec: string }): SpecDiffResult {
	throw new SpecDrivenContextNotImplementedError('diffOpenApi');
}

/**
 * Sentinel for the real parser-aware GraphQL diff. Throws — the runtime
 * adopter (after `npm install graphql`) replaces with real impl.
 */
export function diffGraphql(_input: { oldSpec: string; newSpec: string }): SpecDiffResult {
	throw new SpecDrivenContextNotImplementedError('diffGraphql');
}

/**
 * Map heuristic verdict to a UI-friendly RU label.
 */
export function describeSeverity(severity: BreakingChangeSeverity): string {
	switch (severity) {
		case 'major': return 'Критичные изменения';
		case 'minor': return 'Совместимые добавления';
		case 'patch': return 'Несущественные правки';
		case 'unknown': return 'Не удалось определить';
	}
}

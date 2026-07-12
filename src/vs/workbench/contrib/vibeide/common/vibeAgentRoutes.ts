/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


/**
 * Vibe Agents — orchestration routes (VA.3) + security-by-default (VA.4).
 * Pure, side-effect-free classification of a task into an ordered role workflow, so it is
 * unit-testable from `test/common/`. Consumed by `vibeSubagentOrchestratorService`.
 */

import type { SubagentType } from './vibeSubagentService.js';

/** Coarse task class that selects a role workflow. */
export type VibeTaskKind = 'full-feature' | 'backend' | 'frontend' | 'bug' | 'review';

export interface VibeAgentRoute {
	readonly kind: VibeTaskKind;
	/**
	 * Ordered execution stages. Stages run sequentially; roles WITHIN a stage run in parallel
	 * (e.g. backend-dev ∥ frontend-dev). The handoff context flows stage → stage.
	 */
	readonly stages: readonly (readonly SubagentType[])[];
	/** Flattened role order (stages concatenated) — convenience for display/tests. */
	readonly roles: readonly SubagentType[];
	/** True when the security role was appended by the security-by-default rule (VA.4). */
	readonly securityAdded: boolean;
	/**
	 * Role that should receive attached image(s) (vision routing, звено 1) — the leading vision
	 * analyst. Undefined when no image is attached. The orchestrator hands the image ONLY to this
	 * role; downstream coder roles get its TEXT analysis via the normal stage handoff.
	 */
	readonly imageSink?: SubagentType;
}

// NOTE: `\b` (word boundary) is ASCII-only in JS and does NOT work next to Cyrillic letters,
// so Cyrillic tokens are matched as bare substrings; only ambiguous ASCII tokens get `\b…\b`.
const RE_REVIEW = /(ревью|аудит|проверь\s+код|\breview\b|code\s*review)/i;
const RE_BUG = /(баг|почини|сломал|регресс|\bbug|\bfix|broken)/i;
const RE_BACKEND = /(сервер|бэкенд|база\s*данных|миграц|сервис|backend|endpoint|migration|\bapi\b|\bserver\b|\bdb\b|\bsql\b)/i;
const RE_FRONTEND = /(интерфейс|компонент|фронт|стил|кнопк|верстк|страниц|роутинг|frontend|component|routing|\bui\b|\bcss\b|\bpage\b)/i;

/** Security-by-default trigger (VA.4): sensitive surfaces that warrant an automatic security pass.
 *  Errs toward MORE security (false positives are safe), so matching is intentionally loose. */
const RE_SECURITY = /(oauth|авторизац|аутентификац|парол|секрет|токен|платеж|оплат|карт[аы]|api[_-]?key|api\s*ключ|ключ\s*api|credential|учётн|password|secret|token|payment|\bauth\b|\bjwt\b|\bpii\b)/i;

// Stages run sequentially; roles inside one stage run in parallel.
const ROUTE_STAGES: Record<VibeTaskKind, readonly (readonly SubagentType[])[]> = {
	'full-feature': [['planner'], ['designer'], ['backend-dev', 'frontend-dev'], ['code-reviewer'], ['qa']],
	'backend': [['planner'], ['backend-dev'], ['code-reviewer'], ['qa']],
	'frontend': [['planner'], ['designer'], ['frontend-dev'], ['code-reviewer'], ['qa']],
	'bug': [['backend-dev'], ['code-reviewer'], ['qa']],
	'review': [['code-reviewer']],
};

/** Classifies a task description into a {@link VibeTaskKind}. */
export function classifyTask(text: string): VibeTaskKind {
	if (RE_REVIEW.test(text)) {
		return 'review';
	}
	if (RE_BUG.test(text)) {
		return 'bug';
	}
	const backend = RE_BACKEND.test(text);
	const frontend = RE_FRONTEND.test(text);
	if (backend && frontend) {
		return 'full-feature';
	}
	if (backend) {
		return 'backend';
	}
	if (frontend) {
		return 'frontend';
	}
	return 'full-feature';
}

/** True when the task touches a sensitive surface and security review should auto-attach. */
export function needsSecurity(text: string): boolean {
	return RE_SECURITY.test(text);
}

/** Role that analyzes attached images and hands a text description to the coder roles. */
const VISION_SINK_ROLE: SubagentType = 'designer';

/**
 * Builds the role workflow for a task: classify → route → (vision-lead when an image is attached)
 * → append `security` when the security-by-default rule fires (and it is not already in the route).
 *
 * @param opts.hasImages When true, a leading vision stage ({@link VISION_SINK_ROLE}) is promoted to
 * the front so a vision-capable role reads the image first and hands a text analysis downstream.
 */
export function buildRoute(text: string, opts?: { readonly hasImages?: boolean }): VibeAgentRoute {
	const kind = classifyTask(text);
	let stages = ROUTE_STAGES[kind].map(stage => [...stage]);
	let imageSink: SubagentType | undefined;

	// Vision routing (звено 1): an attached image needs a vision-capable analyst BEFORE the coder
	// roles (which may run blind models). Promote the vision sink to a solo leading stage — dedup it
	// from wherever the base route already placed it so it runs exactly once, first.
	if (opts?.hasImages) {
		stages = stages
			.map(stage => stage.filter(role => role !== VISION_SINK_ROLE))
			.filter(stage => stage.length > 0);
		stages.unshift([VISION_SINK_ROLE]);
		imageSink = VISION_SINK_ROLE;
	}

	const flat = stages.flat();
	let securityAdded = false;
	if (needsSecurity(text) && !flat.includes('security')) {
		stages.push(['security']); // security runs as a final dedicated stage
		flat.push('security');
		securityAdded = true;
	}
	return { kind, stages, roles: flat, securityAdded, imageSink };
}

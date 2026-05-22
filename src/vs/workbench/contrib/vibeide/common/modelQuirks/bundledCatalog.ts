/*--------------------------------------------------------------------------------------
 *  Copyright 2026 VibeIDE Team. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt in the project root for license information.
 *--------------------------------------------------------------------------------------*/

/**
 * In-tree fallback for the model-quirks catalog. **Must stay in sync with
 * `resources/model-quirks.json`** — that JSON file is the source of truth for
 * the CDN endpoint (https://raw.githubusercontent.com/VibeIDETeam/VibeIDE/main/resources/model-quirks.json),
 * this TS constant is what's bundled into the IDE and used when CDN is unreachable
 * (no network, corp gateway, GitHub outage) and the userData cache is empty
 * (fresh install).
 *
 * **Why a TS constant and not just reading the JSON file at runtime:** the gulp
 * build doesn't currently copy repo-level `resources/` into the packaged app's
 * `resources/app/resources/` tree, so `fs.readFileSync` would fail in packaged
 * builds. Inlining as TS guarantees the fallback is available without any extra
 * gulp config. The CDN fetch then catches up to the latest catalog on first
 * successful network call (next run uses the userData cache).
 *
 * **Sync workflow:** when updating `resources/model-quirks.json`, copy the same
 * rules array here verbatim. Consider a CI check that diffs the two and fails on
 * drift (future task in roadmap).
 */

import type { ModelQuirksCatalog } from './modelQuirksTypes.js'

export const BUNDLED_CATALOG: ModelQuirksCatalog = {
	version: 1,
	description: 'In-tree fallback for resources/model-quirks.json. Keep in sync.',
	rules: [
		// kimi family — old k2 (legacy preset) vs newer k2.x variants (different presets).
		{ match: 'kimi-k2.6', temperature: 1.0, topP: 0.95, mirrorReasoningContent: true },
		{ match: 'kimi-k2.5', temperature: 1.0, topP: 0.95, mirrorReasoningContent: true },
		{ match: 'kimi-k2-thinking', temperature: 1.0, topP: 0.95, mirrorReasoningContent: true },
		{ match: 'kimi-k2', temperature: 0.6 },
		{ match: 'kimi', temperature: 1.0, topP: 0.95 },

		// minimax-m2 family — m2.x prefers higher topK, base m2 uses lower.
		{ match: 'minimax-m2.7', temperature: 1.0, topP: 0.95, topK: 40 },
		{ match: 'minimax-m2.5', temperature: 1.0, topP: 0.95, topK: 40 },
		{ match: 'minimax-m2', temperature: 1.0, topP: 0.95, topK: 20 },
		{ match: 'minimax', temperature: 1.0, topP: 0.95, topK: 40 },

		// DeepSeek family — must carry reasoning slot on every assistant turn.
		{ match: 'deepseek', forceEmptyReasoning: true, mirrorReasoningContent: true },

		// Qwen family — native FC unreliable, force XML; existing parser handles naked-tag grammar.
		{ match: 'qwen', temperature: 0.55, topP: 1.0, forceToolCallFormat: 'xml' },

		// GLM family (z.ai) — single preset across versions.
		{ match: 'glm', temperature: 1.0 },

		// Gemini via aggregator (NOT the native @ai-sdk/google path, which has its own settings).
		{ match: 'gemini', temperature: 1.0, topP: 0.95, topK: 64 },
	],
}

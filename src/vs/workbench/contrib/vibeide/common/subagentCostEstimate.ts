/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getModelCapabilities } from './modelCapabilities.js';
import type { OverridesOfModel } from './vibeideSettingsTypes.js';
import type { SubagentResult } from './vibeSubagentService.js';

/**
 * Approximate USD cost of a subagent run from the provider-reported token sums and the STATIC
 * pricing table (USD per 1M tokens). Returns undefined when the price is unknown ({0,0} in the
 * table means «no price», not «free») or when the run carried no model/usage info.
 *
 * Deliberately does NOT pass catalogInfo to getModelCapabilities: remote-catalog cost fields are
 * per-token (LiteLLM/OpenRouter), i.e. 1e6× off the static per-1M scale — see roadmap debt item.
 */
export function subagentCostUsd(result: Pick<SubagentResult, 'providerName' | 'modelName' | 'promptTokensUsed' | 'completionTokensUsed'>, overrides: OverridesOfModel | undefined): number | undefined {
	if (!result.providerName || !result.modelName) { return undefined; }
	if (!result.promptTokensUsed && !result.completionTokensUsed) { return undefined; }
	const caps = getModelCapabilities(result.providerName, result.modelName, overrides);
	const cost = caps.cost;
	if (!cost || (cost.input === 0 && cost.output === 0)) { return undefined; }
	return ((result.promptTokensUsed ?? 0) / 1_000_000) * cost.input + ((result.completionTokensUsed ?? 0) / 1_000_000) * cost.output;
}

/** Compact money formatting: cents get 2 decimals, sub-cent amounts keep 4. */
export function formatUsd(usd: number): string {
	return usd >= 0.1 ? usd.toFixed(2) : usd.toFixed(4);
}

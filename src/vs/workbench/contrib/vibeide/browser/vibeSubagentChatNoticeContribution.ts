/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


/**
 * Live subagent activity in the CHAT. The status bar shows a running count; this surfaces the
 * per-role lifecycle (started / finished) as compact assistant notices in the parent thread, so
 * the work is visible where the user actually works. Gated by `vibeide.subagent.chatNotices`.
 *
 * Internal roadmap-agent subagents ('explore' / 'implement-step' / 'recover-or-skip') are skipped:
 * they run mid-stream during a normal agent turn and would clutter the thread. Only the curated
 * «команда ролей» (VA) roles post notices.
 */

import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from '../../../common/contributions.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { IVibeSubagentService, SubagentEntry, SubagentType } from '../common/vibeSubagentService.js';
import { IVibeSubagentRegistryService } from '../common/vibeSubagentRegistryService.js';
import { IVibeideSettingsService } from '../common/vibeideSettingsService.js';
import { subagentCostUsd, formatUsd } from '../common/subagentCostEstimate.js';
import { IChatThreadService } from './chatThreadService.js';

const INTERNAL_TYPES = new Set<SubagentType>(['explore', 'implement-step', 'recover-or-skip']);

class VibeSubagentChatNoticeContribution extends Disposable {

	/** Which lifecycle phases we already posted for an entry — dedupes repeated status events. */
	private readonly _notified = new Set<string>();

	constructor(
		@IVibeSubagentService private readonly _subagentSvc: IVibeSubagentService,
		@IChatThreadService private readonly _chat: IChatThreadService,
		@IVibeSubagentRegistryService private readonly _registry: IVibeSubagentRegistryService,
		@IConfigurationService private readonly _config: IConfigurationService,
		@IVibeideSettingsService private readonly _settings: IVibeideSettingsService,
	) {
		super();
		this._register(this._subagentSvc.onSubagentStatusChanged(e => this._onStatus(e)));
	}

	private _onStatus(entry: SubagentEntry): void {
		if (entry.status === 'disposed') {
			this._notified.delete(`${entry.id}:start`);
			this._notified.delete(`${entry.id}:end`);
			return;
		}
		if (INTERNAL_TYPES.has(entry.type)) { return; }
		if (this._config.getValue<boolean>('vibeide.subagent.chatNotices') === false) { return; }

		const name = this._registry.getPreset(entry.type).displayName;

		if (entry.status === 'running' && !this._notified.has(`${entry.id}:start`)) {
			this._notified.add(`${entry.id}:start`);
			this._post(entry.parentThreadId, localize('vibeide.subagent.chatStarted', "🧩 Субагент «{0}» запущен.", name));
			return;
		}

		const terminal = entry.status === 'completed' || entry.status === 'failed' || entry.status === 'stopped' || entry.status === 'skipped';
		if (terminal && !this._notified.has(`${entry.id}:end`)) {
			this._notified.add(`${entry.id}:end`);
			// Subagent ids are never reused after a terminal state — drop the start key right away
			// ('disposed' events don't fire, so this is the only cleanup), and bound the set overall.
			this._notified.delete(`${entry.id}:start`);
			if (this._notified.size > 512) { this._notified.clear(); }
			this._post(entry.parentThreadId, this._finishText(name, entry));
		}
	}

	private _finishText(name: string, entry: SubagentEntry): string {
		const reason = entry.result?.reason ?? '';
		const tokens = entry.result?.tokensUsed ?? 0;
		switch (entry.status) {
			case 'completed': {
				const usd = entry.result ? subagentCostUsd(entry.result, this._settings.state.overridesOfModel) : undefined;
				const costPart = usd !== undefined ? localize('vibeide.subagent.chatCost', ", ≈${0}", formatUsd(usd)) : '';
				return localize('vibeide.subagent.chatDone', "✅ Субагент «{0}» завершил задачу (~{1} токенов{2}).", name, String(tokens), costPart);
			}
			case 'stopped':
				// No «субпин» promise here: while auto-resume is running the ticket is not yet open —
				// the indicator appears only when the human's decision is actually needed.
				return localize('vibeide.subagent.chatStopped', "⏸️ Субагент «{0}» остановлен: {1}. Частичный результат сохранён.", name, reason);
			case 'skipped':
				return localize('vibeide.subagent.chatSkipped', "⏭️ Субагент «{0}» пропущен: {1}", name, reason);
			default:
				return localize('vibeide.subagent.chatFailed', "⚠️ Субагент «{0}»: {1}", name, reason);
		}
	}

	private _post(threadId: string, text: string): void {
		if (!threadId) { return; }
		this._chat.addAssistantNotice(threadId, text);
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(
	VibeSubagentChatNoticeContribution,
	LifecyclePhase.Restored
);

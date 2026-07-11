/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


/**
 * Subagent OUTCOME notices in the CHAT. A role's *running* state is surfaced live and transiently
 * by the sidebar (`useSubagentActivity` spinner) — this contribution only posts the terminal
 * outcome (done / stopped / skipped / failed, with tokens and ≈$) as a permanent record in the
 * parent thread. Gated by `vibeide.subagent.chatNotices`.
 *
 * Internal roadmap-agent subagents ('explore' / 'implement-step' / 'recover-or-skip') are skipped:
 * they run mid-stream during a normal agent turn and would clutter the thread. Only the curated
 * «команда ролей» (VA) roles post notices.
 *
 * Notices are buffered while the parent thread's turn is active. Appending a message mid-turn
 * corrupts the `messages[messages.length-1]` streaming invariant that tool swap/approve/reject
 * rely on — so a notice is held until the thread's streamState goes fully idle, then flushed.
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

	/** Entry ids whose terminal notice we already handled — dedupes repeated status events. */
	private readonly _notified = new Set<string>();

	/** Notices held until their thread's turn goes idle (keyed by threadId). */
	private readonly _pending = new Map<string, string[]>();

	constructor(
		@IVibeSubagentService private readonly _subagentSvc: IVibeSubagentService,
		@IChatThreadService private readonly _chat: IChatThreadService,
		@IVibeSubagentRegistryService private readonly _registry: IVibeSubagentRegistryService,
		@IConfigurationService private readonly _config: IConfigurationService,
		@IVibeideSettingsService private readonly _settings: IVibeideSettingsService,
	) {
		super();
		this._register(this._subagentSvc.onSubagentStatusChanged(e => this._onStatus(e)));
		this._register(this._chat.onDidChangeStreamState(({ threadId }) => this._maybeFlush(threadId)));
	}

	private _onStatus(entry: SubagentEntry): void {
		if (entry.status === 'disposed') {
			this._notified.delete(entry.id);
			return;
		}
		if (INTERNAL_TYPES.has(entry.type)) { return; }
		if (this._config.getValue<boolean>('vibeide.subagent.chatNotices') === false) { return; }

		// Running state is shown live by the sidebar spinner — only the terminal outcome is posted.
		const terminal = entry.status === 'completed' || entry.status === 'failed' || entry.status === 'stopped' || entry.status === 'skipped';
		if (terminal && !this._notified.has(entry.id)) {
			this._notified.add(entry.id);
			// Subagent ids are never reused after a terminal state; bound the set overall.
			if (this._notified.size > 512) { this._notified.clear(); }
			const name = this._registry.getPreset(entry.type).displayName;
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
				// the indicator appears only when the human's decision is actually needed. The metrics
				// suffix shows WHAT bound (steps/tokens vs the limits), so «исчерпан лимит шагов» is legible.
				return localize('vibeide.subagent.chatStopped', "⏸️ Субагент «{0}» остановлен: {1}{2}. Частичный результат сохранён.", name, reason, this._metrics(entry));
			case 'skipped':
				return localize('vibeide.subagent.chatSkipped', "⏭️ Субагент «{0}» пропущен: {1}{2}", name, reason, this._metrics(entry));
			default:
				return localize('vibeide.subagent.chatFailed', "⚠️ Субагент «{0}»: {1}{2}", name, reason, this._metrics(entry));
		}
	}

	/** ` (шаг N/M · ~Xk / Yk)` — final steps and tokens against their limits, so a stopped role shows
	 *  which limit bound it. Uses the entry's live counters (retained after the terminal transition). */
	private _metrics(entry: SubagentEntry): string {
		const fmtK = (n: number) => n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(n);
		const parts: string[] = [];
		if (entry.maxSteps && entry.maxSteps > 0) { parts.push(`шаг ${entry.liveStepsDone ?? 0}/${entry.maxSteps}`); }
		const tok = entry.result?.tokensUsed ?? entry.liveTokensUsed ?? 0;
		if (tok > 0) { parts.push(entry.tokenQuota && entry.tokenQuota > 0 ? `~${fmtK(tok)} / ${fmtK(entry.tokenQuota)}` : `~${fmtK(tok)}`); }
		return parts.length ? ` (${parts.join(' · ')})` : '';
	}

	private _post(threadId: string, text: string): void {
		if (!threadId) { return; }
		// Safe to append only when the thread's turn is fully idle (no streaming/tool/awaiting_user
		// message at the tail). Otherwise hold it and flush on the next idle transition.
		if (this._chat.streamState[threadId]?.isRunning === undefined) {
			this._chat.addAssistantNotice(threadId, text);
			return;
		}
		const queue = this._pending.get(threadId);
		if (queue) { queue.push(text); } else { this._pending.set(threadId, [text]); }
	}

	private _maybeFlush(threadId: string): void {
		if (this._chat.streamState[threadId]?.isRunning !== undefined) { return; }
		const queue = this._pending.get(threadId);
		if (!queue) { return; }
		this._pending.delete(threadId);
		for (const text of queue) { this._chat.addAssistantNotice(threadId, text); }
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(
	VibeSubagentChatNoticeContribution,
	LifecyclePhase.Restored
);

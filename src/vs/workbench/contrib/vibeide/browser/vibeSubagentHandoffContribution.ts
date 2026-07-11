/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


/**
 * «Субпин» — status-bar indicator + command for subagents that STOPPED by a limit and had their
 * partial work parked in a durable handoff ticket (see vibeSubagentHandoffStore). The count shows
 * how many stopped roles await a human decision after auto-resumes ran out; clicking opens a picker
 * to resume one manually. The tooltip explains what it is.
 */

import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize, localize2 } from '../../../../nls.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../editor/browser/editorExtensions.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from '../../../common/contributions.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { IStatusbarService, StatusbarAlignment, IStatusbarEntryAccessor } from '../../../services/statusbar/browser/statusbar.js';
import { IVibeSubagentHandoffStore } from '../common/vibeSubagentHandoffStore.js';
import { IVibeSubagentOrchestratorService } from '../common/vibeSubagentOrchestratorService.js';
import { IVibeSubagentRegistryService } from '../common/vibeSubagentRegistryService.js';

const STATUS_ID = 'vibeide.subagentHandoff';
const RESUME_COMMAND_ID = 'vibeide.subagent.resumeHandoff';

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: RESUME_COMMAND_ID,
			title: localize2('vibeAgents.resumeHandoff', 'Vibe Agents: Продолжить остановленную роль'),
			category: localize2('vibeCategory', 'VibeIDE'),
			f1: true,
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const quickInput = accessor.get(IQuickInputService);
		const orchestrator = accessor.get(IVibeSubagentOrchestratorService);
		const registry = accessor.get(IVibeSubagentRegistryService);
		const notice = accessor.get(INotificationService);

		const open = orchestrator.listOpenHandoffs();
		if (open.length === 0) {
			notice.info(localize('vibeAgents.resumeHandoff.none', "Нет остановленных ролей, ожидающих продолжения."));
			return;
		}

		const picked = await quickInput.pick(
			open.map(t => ({
				label: `$(debug-continue) ${registry.getPreset(t.role).displayName}`,
				description: t.stopReason,
				detail: t.partialSummary.slice(0, 120) || localize('vibeAgents.resumeHandoff.noPartial', "(без частичного результата)"),
				ticketId: t.id,
			})),
			{ title: localize('vibeAgents.resumeHandoff.pick', "Продолжить остановленную роль"), placeHolder: localize('vibeAgents.resumeHandoff.placeholder', "Выберите роль для продолжения с сохранённого места") },
		);
		if (!picked) { return; }

		notice.info(localize('vibeAgents.resumeHandoff.started', "Продолжаю роль с сохранённого места…"));
		const result = await orchestrator.resume(picked.ticketId);
		notice.notify({
			severity: result?.status === 'success' ? Severity.Info : Severity.Warning,
			message: result?.status === 'success'
				? localize('vibeAgents.resumeHandoff.done', "Роль завершена.")
				: localize('vibeAgents.resumeHandoff.stoppedAgain', "Роль снова остановлена: {0}. Осталась в списке продолжения.", result?.reason ?? localize('vibeAgents.resumeHandoff.unknown', "неизвестно")),
		});
	}
});

class VibeSubagentHandoffContribution extends Disposable {

	private _accessor: IStatusbarEntryAccessor | undefined;

	constructor(
		@IStatusbarService private readonly _statusbar: IStatusbarService,
		@IVibeSubagentHandoffStore private readonly _handoffStore: IVibeSubagentHandoffStore,
		@IVibeSubagentRegistryService private readonly _registry: IVibeSubagentRegistryService,
	) {
		super();
		this._register(this._handoffStore.onDidChange(() => this._update()));
		this._update();
	}

	private _update(): void {
		const open = this._handoffStore.listOpen();
		if (open.length === 0) {
			this._accessor?.dispose();
			this._accessor = undefined;
			return;
		}

		const text = `$(debug-continue) ${localize('vibeide.subagent.subpin', 'субпин: {0}', open.length)}`;
		const name = localize('vibeide.subagent.subpinName', 'VibeIDE: остановленные субагенты');
		const header = localize('vibeide.subagent.subpinTooltip', 'Остановленные субагенты — частичная работа сохранена, ждут продолжения (клик — продолжить):');
		const tooltip = header + '\n' + open.map(t => `• ${this._registry.getPreset(t.role).displayName} — ${t.stopReason}`).join('\n');

		const entry = { name, text, tooltip, ariaLabel: text, command: RESUME_COMMAND_ID };
		if (this._accessor) {
			this._accessor.update(entry);
		} else {
			this._accessor = this._register(this._statusbar.addEntry(entry, STATUS_ID, StatusbarAlignment.RIGHT, 499));
		}
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(
	VibeSubagentHandoffContribution,
	LifecyclePhase.Restored
);

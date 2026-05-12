/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 VibeIDE Team. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Project Commands — menubar (title-bar top-level "Команды" submenu).
 *
 * Layout (flat: each command is a single MenuItem; clicking runs it.
 * Inline Edit/Delete icons-per-row are NOT possible inside a stock VS Code
 * MenuRegistry-driven menubar dropdown — title is plain text and items
 * render through `MenuActionViewItem` with no per-row action slots. A
 * previous attempt to use submenu-per-command broke the "click = Run"
 * affordance, so we keep flat + dedicated `editPick` / `deletePick`
 * Quick-Pick entries above the list):
 *
 *   group `1_add`  — `+ Добавить команду…`            → `vibeide.commands.add`
 *                    `↻ Восстановить демо-команду`     → `vibeide.commands.seedDemo`
 *   group `2_ops`  — `✎ Редактировать команду…`        → `vibeide.commands.editPick`
 *                    `🗑 Удалить команду…`             → `vibeide.commands.deletePick`
 *   group `3_list` — dynamic, one MenuItem per project command. Click = Run
 *                    (`vibeide.commands.menubarRun.<id>`).
 *
 * Each synthetic command id is registered in `CommandsRegistry` and disposed
 * alongside the menu item on re-registration.
 */

import { Disposable, DisposableStore, IDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { MenuId, MenuRegistry } from '../../../../platform/actions/common/actions.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IVibeCustomCommandsService } from './vibeCustomCommandsService.js';
import { PROJECT_COMMANDS_PALETTE_IDS } from '../common/projectCommandsServiceContract.js';
import { sortProjectCommandsForDisplay } from '../common/projectCommandsTypes.js';

const DYNAMIC_RUN_PREFIX = 'vibeide.commands.menubarRun.';

/** Static `+ Добавить команду…` entry. Registered once at module load. */
MenuRegistry.appendMenuItem(MenuId.MenubarVibeProjectCommandsMenu, {
	group: '1_add',
	order: 1,
	command: {
		id: PROJECT_COMMANDS_PALETTE_IDS.add,
		title: localize({ key: 'vibeide.menubar.commands.add', comment: ['&& denotes a mnemonic'] }, "&&+ Добавить команду…"),
	},
});

/** Static `↻ Восстановить демо-команду` — seeds `.vibe/commands.json` with the
 *  canonical example. Visible always — handler is no-op + Info when the demo
 *  already exists. Kept under `1_add` because conceptually it's "add the seed
 *  the workspace was supposed to ship with". */
MenuRegistry.appendMenuItem(MenuId.MenubarVibeProjectCommandsMenu, {
	group: '1_add',
	order: 2,
	command: {
		id: 'vibeide.commands.seedDemo',
		title: localize('vibeide.menubar.commands.seedDemo', "↻ Восстановить демо-команду"),
	},
});

// `editPick` / `deletePick` Quick-Pick entries used to live here (`group: '2_ops'`).
// They were redundant once `VibeProjectCommandsPopupContribution` intercepts the
// menubar click and renders per-row inline Edit/Delete icons. The underlying
// CommandsRegistry handlers stay registered (palette-accessible) — only the
// menubar surface for them is dropped.

export class VibeProjectCommandsMenubarContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.vibeProjectCommandsMenubar';

	private readonly _dynamicEntries = this._register(new DisposableStore());

	constructor(
		@IVibeCustomCommandsService private readonly _commands: IVibeCustomCommandsService,
	) {
		super();
		this._refresh();
		this._register(this._commands.onDidChangeCommands(() => this._refresh()));
	}

	private _refresh(): void {
		// Tear down old menu items + synthetic command ids before re-registering.
		this._dynamicEntries.clear();

		const list = sortProjectCommandsForDisplay(this._commands.getCommands());
		for (let i = 0; i < list.length; i++) {
			const cmd = list[i];
			const runId = DYNAMIC_RUN_PREFIX + cmd.id;

			const runCmdDisp: IDisposable = CommandsRegistry.registerCommand({
				id: runId,
				handler: async () => { await this._commands.run(cmd.id); },
			});

			const menuItemDisp: IDisposable = MenuRegistry.appendMenuItem(MenuId.MenubarVibeProjectCommandsMenu, {
				group: '3_list',
				order: i,
				command: {
					id: runId,
					// Pinned commands prefixed with 📌 mirror the status-bar pill style;
					// keeps the dropdown skimmable at a glance.
					title: cmd.pinned ? `📌 ${cmd.name}` : cmd.name,
				},
			});

			this._dynamicEntries.add(runCmdDisp);
			this._dynamicEntries.add(toDisposable(() => menuItemDisp.dispose()));
		}
	}

}

registerWorkbenchContribution2(
	VibeProjectCommandsMenubarContribution.ID,
	VibeProjectCommandsMenubarContribution,
	WorkbenchPhase.AfterRestored,
);

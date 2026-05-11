/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 VibeIDE Team. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Project Commands — palette + status-bar contribution.
 *
 * Registers the canonical palette command (`vibeide.commands.runFromPalette` from
 * `projectCommandsServiceContract.PROJECT_COMMANDS_PALETTE_IDS.run`) that opens a
 * Quick Pick over the merged snapshot from `IVibeCustomCommandsService`.
 *
 * Phase scope (this commit):
 *  - Run-from-palette Quick Pick (filter by name; press Enter to spawn).
 *  - Reload (manual) palette command.
 *  - Open `.vibe/commands.json` palette command (creates a starter file when missing).
 *
 * Deferred:
 *  - Add / Edit / Delete / Pin / Unpin form UIs (Quick Pick is the MVP).
 *  - Trust confirm dialog (currently the service refuses with `unresolved-placeholders`
 *    when secrets are missing; nothing else is gated).
 *  - Status-bar `▶ N` indicator + top-bar pinned-buttons widget.
 */

import { Disposable } from '../../../../base/common/lifecycle.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { joinPath } from '../../../../base/common/resources.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { localize } from '../../../../nls.js';
import { IVibeCustomCommandsService } from './vibeCustomCommandsService.js';
import { PROJECT_COMMANDS_PALETTE_IDS } from '../common/projectCommandsServiceContract.js';
import { serializeProjectCommandsInitTemplate } from '../common/projectCommandsInitTemplate.js';
import { describeUnresolvedPlaceholders } from '../common/projectCommandSecretsResolver.js';

CommandsRegistry.registerCommand({
	id: PROJECT_COMMANDS_PALETTE_IDS.run,
	handler: async (accessor: ServicesAccessor) => {
		const commands = accessor.get(IVibeCustomCommandsService);
		const quickInput = accessor.get(IQuickInputService);
		const notifications = accessor.get(INotificationService);

		const list = commands.getCommands();
		if (list.length === 0) {
			notifications.notify({
				severity: Severity.Info,
				message: localize(
					'vibeide.commands.runFromPalette.empty',
					'Нет проектных команд. Создайте .vibe/commands.json или используйте «VibeIDE: Open .vibe/commands.json».',
				),
			});
			return;
		}

		const items = list.map(c => ({
			label: c.pinned ? `$(pin) ${c.name}` : c.name,
			description: c.id,
			detail: c.description ?? c.command,
			commandId: c.id,
		}));

		const picked = await quickInput.pick(items, {
			placeHolder: localize('vibeide.commands.runFromPalette.placeholder', 'Выберите проектную команду для запуска'),
			matchOnDescription: true,
			matchOnDetail: true,
		});
		if (!picked) {
			return;
		}

		const outcome = await commands.run(picked.commandId);
		if (outcome.outcome === 'refused') {
			if (outcome.reason === 'unresolved-placeholders' && outcome.unresolvedPlaceholders) {
				notifications.notify({
					severity: Severity.Warning,
					message: localize(
						'vibeide.commands.runFromPalette.unresolved',
						'Команда не запущена: отсутствуют значения для плейсхолдеров. {0}',
						describeUnresolvedPlaceholders(outcome.unresolvedPlaceholders.map(u => ({
							kind: u.kind, name: u.name, field: 'command',
						}))),
					),
				});
				return;
			}
			notifications.notify({
				severity: Severity.Warning,
				message: localize('vibeide.commands.runFromPalette.refused', 'Запуск отклонён: {0}', outcome.reason ?? 'unknown'),
			});
		} else if (outcome.outcome === 'failure') {
			notifications.notify({
				severity: Severity.Error,
				message: localize('vibeide.commands.runFromPalette.failed', 'Команда упала: {0}', outcome.reason ?? 'unknown'),
			});
		}
	},
});

CommandsRegistry.registerCommand({
	id: 'vibeide.commands.reload',
	handler: async (accessor: ServicesAccessor) => {
		const commands = accessor.get(IVibeCustomCommandsService);
		const notifications = accessor.get(INotificationService);
		await commands.reload();
		notifications.notify({
			severity: Severity.Info,
			message: localize('vibeide.commands.reload.done', 'Проектные команды перечитаны. Найдено: {0}.', commands.getCommands().length),
		});
	},
});

CommandsRegistry.registerCommand({
	id: PROJECT_COMMANDS_PALETTE_IDS.openJson,
	handler: async (accessor: ServicesAccessor) => {
		const workspace = accessor.get(IWorkspaceContextService);
		const fileService = accessor.get(IFileService);
		const editorService = accessor.get(IEditorService);
		const notifications = accessor.get(INotificationService);

		const folder = workspace.getWorkspace().folders[0];
		if (!folder) {
			notifications.notify({
				severity: Severity.Warning,
				message: localize('vibeide.commands.openJson.noWorkspace', 'Откройте папку, чтобы создать .vibe/commands.json.'),
			});
			return;
		}
		const uri = joinPath(folder.uri, '.vibe', 'commands.json');
		const exists = await fileService.exists(uri);
		if (!exists) {
			const serialized = serializeProjectCommandsInitTemplate({ vibeVersion: '1.0.0' });
			await fileService.writeFile(uri, VSBuffer.fromString(serialized));
		}
		await editorService.openEditor({ resource: uri });
	},
});

/** Contribution exists only to ensure the file is imported and command handlers are registered. */
class VibeCustomCommandsContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.vibeCustomCommands';
	constructor(@IVibeCustomCommandsService _commands: IVibeCustomCommandsService) {
		super();
		// Service materialised here so it starts its FS-watcher on workbench restore.
		void _commands.reload();
	}
}

registerWorkbenchContribution2(VibeCustomCommandsContribution.ID, VibeCustomCommandsContribution, WorkbenchPhase.AfterRestored);

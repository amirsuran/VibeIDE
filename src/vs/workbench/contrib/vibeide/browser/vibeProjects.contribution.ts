/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 VibeIDE Team. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../base/common/codicons.js';
import { KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { basename } from '../../../../base/common/resources.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { localize, localize2 } from '../../../../nls.js';
import { ContextKeyExpr, IContextKeyService, RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import {
	Extensions as ViewContainerExtensions,
	IViewContainersRegistry,
	IViewsRegistry,
	ViewContainerLocation,
	ViewContentGroups,
} from '../../../common/views.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import { registerVibeideFaRegularIcon } from './vibeideFontAwesomeRegular.js';
import {
	VIBE_PROJECTS_VIEW_AS_LIST_CONTEXT_KEY,
	VIBE_PROJECTS_VIEWLET_ID,
	VIBE_PROJECTS_VIEW_ID,
	VibeProjectsCommands,
} from './vibeProjectsConstants.js';
import { VibeProjectsViewPane } from './vibeProjectsViewPane.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../editor/browser/editorExtensions.js';
import { IWorkspaceContextService, WorkbenchState } from '../../../../platform/workspace/common/workspace.js';
import { IQuickInputService, IQuickPickItem } from '../../../../platform/quickinput/common/quickInput.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IVibeProjectsService } from './vibeProjectsService.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { extname } from '../../../../base/common/path.js';
import { IFolderToOpen, IWorkspaceToOpen } from '../../../../platform/window/common/window.js';
import { IPreferencesService } from '../../../services/preferences/common/preferences.js';

import './vibeProjectsService.js';

const whenVibeProjectsViewTitle = ContextKeyExpr.equals('view', VIBE_PROJECTS_VIEW_ID);

const ViewAsListKey = new RawContextKey<boolean>(VIBE_PROJECTS_VIEW_AS_LIST_CONTEXT_KEY, true);
const whenViewIsList = ContextKeyExpr.and(whenVibeProjectsViewTitle, ContextKeyExpr.equals(VIBE_PROJECTS_VIEW_AS_LIST_CONTEXT_KEY, true));
const whenViewIsTags = ContextKeyExpr.and(whenVibeProjectsViewTitle, ContextKeyExpr.equals(VIBE_PROJECTS_VIEW_AS_LIST_CONTEXT_KEY, false));

class VibeProjectsContextKeysContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.vibeProjectsContextKeys';
	constructor(@IContextKeyService contextKeyService: IContextKeyService) {
		super();
		ViewAsListKey.bindTo(contextKeyService);
	}
}
registerWorkbenchContribution2(VibeProjectsContextKeysContribution.ID, VibeProjectsContextKeysContribution, WorkbenchPhase.BlockRestore);

/** FA6 Free Regular folder-open (\uf07c) \u2014 thinner stroke than Solid. */
const vibeProjectsActivityGlyph = registerVibeideFaRegularIcon(
	'vibeide-vibe-projects-activity',
	'\uf07c',
	localize('vibeProjects.activityIcon', 'Vibe Projects activity bar icon'),
);

const vibeProjectsViewTabIcon = registerVibeideFaRegularIcon(
	'vibeide-vibe-projects-view-tab',
	'\uf07c',
	localize('vibeProjects.viewTab', 'Vibe Projects view tab'),
);

const vibeProjectsViewContainerRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
const vibeProjectsViewPaneWrapper = vibeProjectsViewContainerRegistry.registerViewContainer(
	{
		id: VIBE_PROJECTS_VIEWLET_ID,
		title: localize2('vibeProjects.containerTitle', 'Vibe Projects'),
		ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [VIBE_PROJECTS_VIEWLET_ID, { mergeViewWithContainerWhenSingleView: true }]),
		hideIfEmpty: false,
		icon: vibeProjectsActivityGlyph,
		order: 0.5,
	},
	ViewContainerLocation.Sidebar,
	{ doNotRegisterOpenCommand: true },
);

const vibeProjectsViewsRegistry = Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry);
vibeProjectsViewsRegistry.registerViews(
	[
		{
			id: VIBE_PROJECTS_VIEW_ID,
			name: localize2('vibeProjects.viewName', 'Favorites'),
			containerIcon: vibeProjectsViewTabIcon,
			ctorDescriptor: new SyncDescriptor(VibeProjectsViewPane),
			canToggleVisibility: false,
			canMoveView: true,
			weight: 100,
			order: 1,
			openCommandActionDescriptor: {
				id: VIBE_PROJECTS_VIEWLET_ID,
				mnemonicTitle: localize({ key: 'vibeProjects_mnemonic2', comment: ['&& denotes a mnemonic'] }, "Vibe &&Projects"),
				keybindings: {
					primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KeyB,
					when: ContextKeyExpr.regex('neverMatch', /doesNotMatch/),
				},
				order: 4,
			},
		},
	],
	vibeProjectsViewPaneWrapper,
);

vibeProjectsViewsRegistry.registerViewWelcomeContent(VIBE_PROJECTS_VIEW_ID, {
	content: localize(
		'vibeProjects.welcome',
		'No saved projects yet.\n[Save Project](command:{0})\n[Edit Projects](command:{1})',
		VibeProjectsCommands.saveProject,
		VibeProjectsCommands.editProjects,
	),
	when: 'default',
	group: ViewContentGroups.Open,
	order: 1,
});

const vibeCategory = localize2('vibeCategory', 'VibeIDE');

registerAction2(
	class VibeProjectsSaveProject extends Action2 {
		constructor() {
			super({
				id: VibeProjectsCommands.saveProject,
				title: localize2('vibeProjects.saveProject', 'Vibe Projects: Save Project'),
				icon: Codicon.save,
				category: vibeCategory,
				f1: true,
				menu: [
					{ id: MenuId.ViewTitle, group: 'navigation', order: 10, when: whenVibeProjectsViewTitle },
				],
			});
		}

		async run(accessor: ServicesAccessor): Promise<void> {
			const workspace = accessor.get(IWorkspaceContextService);
			const notice = accessor.get(INotificationService);
			const quick = accessor.get(IQuickInputService);
			const ledger = accessor.get(IVibeProjectsService);

			if (workspace.getWorkbenchState() === WorkbenchState.EMPTY) {
				notice.info(localize('vibeProjects.needWorkspace', 'Open a folder or workspace before saving it as a Vibe Project.'));
				return;
			}

			const snapshot = workspace.getWorkspace();
			const target = snapshot.configuration ?? snapshot.folders[0]?.uri;
			if (!target) {
				notice.warn(localize('vibeProjects.nothingToPin', 'No path available to save.'));
				return;
			}

			const guess = basename(target);
			const label = await quick.input({
				title: localize('vibeProjects.inputTitle', 'Project name'),
				value: guess,
				validateInput: async v => (v.trim().length ? undefined : localize('vibeProjects.emptyLabel', 'Name cannot be empty')),
			});
			if (!label?.trim()) {
				return;
			}

			await ledger.enqueuePersist({
				id: generateUuid(),
				label: label.trim(),
				target,
			});
		}
	},
);

registerAction2(
	class VibeProjectsEditProjects extends Action2 {
		constructor() {
			super({
				id: VibeProjectsCommands.editProjects,
				title: localize2('vibeProjects.editProjects', 'Vibe Projects: Edit Projects'),
				icon: Codicon.edit,
				category: vibeCategory,
				f1: true,
				menu: [
					{ id: MenuId.ViewTitle, group: 'navigation', order: 11, when: whenVibeProjectsViewTitle },
				],
			});
		}

		async run(accessor: ServicesAccessor): Promise<void> {
			const ledger = accessor.get(IVibeProjectsService);
			const editor = accessor.get(IEditorService);
			const files = accessor.get(IFileService);

			const uri = await ledger.ensureCatalogOnDisk();
			try {
				await files.resolve(uri);
			} catch {
				await files.writeFile(
					uri,
					VSBuffer.fromString(
						JSON.stringify({ schema: 'vibe-projects.v1', seeds: [] }, undefined, '\t'),
					),
				);
			}
			await editor.openEditor({ resource: uri, options: { pinned: true } });
		}
	},
);

registerAction2(
	class VibeProjectsViewAsTags extends Action2 {
		constructor() {
			super({
				id: VibeProjectsCommands.viewAsTags,
				title: localize2('vibeProjects.viewAsTags', 'Vibe Projects: View as Tags'),
				icon: Codicon.listTree,
				category: vibeCategory,
				f1: true,
				menu: [
					{ id: MenuId.ViewTitle, group: 'navigation', order: 12, when: whenViewIsList },
				],
			});
		}

		async run(accessor: ServicesAccessor): Promise<void> {
			ViewAsListKey.bindTo(accessor.get(IContextKeyService)).set(false);
		}
	},
);

registerAction2(
	class VibeProjectsViewAsList extends Action2 {
		constructor() {
			super({
				id: VibeProjectsCommands.viewAsList,
				title: localize2('vibeProjects.viewAsList', 'Vibe Projects: View as List'),
				icon: Codicon.listFlat,
				category: vibeCategory,
				f1: true,
				menu: [
					{ id: MenuId.ViewTitle, group: 'navigation', order: 13, when: whenViewIsTags },
				],
			});
		}

		async run(accessor: ServicesAccessor): Promise<void> {
			ViewAsListKey.bindTo(accessor.get(IContextKeyService)).set(true);
		}
	},
);

registerAction2(
	class VibeProjectsListProjects extends Action2 {
		constructor() {
			super({
				id: VibeProjectsCommands.listProjects,
				title: localize2('vibeProjects.listProjects', 'Vibe Projects: List Projects to Open'),
				icon: Codicon.search,
				category: vibeCategory,
				f1: true,
				menu: [
					{ id: MenuId.ViewTitle, group: 'navigation', order: 14, when: whenVibeProjectsViewTitle },
				],
			});
		}

		async run(accessor: ServicesAccessor): Promise<void> {
			const quick = accessor.get(IQuickInputService);
			const ledger = accessor.get(IVibeProjectsService);
			const host = accessor.get(IHostService);
			const notice = accessor.get(INotificationService);

			const seeds = await ledger.readEntries();
			if (!seeds.length) {
				notice.info(localize('vibeProjects.emptyRoster', 'No projects yet — use Save Project.'));
				return;
			}

			type SeedPick = IQuickPickItem & { entry: (typeof seeds)[number] };
			const picks: SeedPick[] = seeds.map(s => ({ label: s.label, description: s.target.fsPath, entry: s }));
			const pick = await quick.pick(picks, { placeHolder: localize('vibeProjects.pick.placeholder', 'Select a project to open') });
			const hit = pick?.entry;
			if (!hit) {
				return;
			}
			const openable: IFolderToOpen | IWorkspaceToOpen =
				extname(hit.target.fsPath) === '.code-workspace'
					? { workspaceUri: hit.target }
					: { folderUri: hit.target };
			await host.openWindow([openable], { forceNewWindow: false });
		}
	},
);

registerAction2(
	class VibeProjectsFilterByTag extends Action2 {
		constructor() {
			super({
				id: VibeProjectsCommands.filterByTag,
				title: localize2('vibeProjects.filterByTag', 'Vibe Projects: Filter Projects by Tag'),
				icon: Codicon.tag,
				category: vibeCategory,
				f1: true,
				menu: [
					{ id: MenuId.ViewTitle, group: 'navigation', order: 15, when: whenVibeProjectsViewTitle },
				],
			});
		}

		async run(accessor: ServicesAccessor): Promise<void> {
			const notice = accessor.get(INotificationService);
			notice.info(localize('vibeProjects.noTagsYet', 'No tags yet — tags can be assigned to projects in a future release.'));
		}
	},
);

registerAction2(
	class VibeProjectsCollapseAll extends Action2 {
		constructor() {
			super({
				id: VibeProjectsCommands.collapseAll,
				title: localize2('vibeProjects.collapseAll', 'Vibe Projects: Collapse All'),
				icon: Codicon.collapseAll,
				category: vibeCategory,
				f1: true,
				menu: [
					{ id: MenuId.ViewTitle, group: 'navigation', order: 16, when: whenViewIsTags },
				],
			});
		}

		async run(accessor: ServicesAccessor): Promise<void> {
			const notice = accessor.get(INotificationService);
			notice.info(localize('vibeProjects.collapseAllStub', 'Tag groups collapsing arrives with the tags release.'));
		}
	},
);

registerAction2(
	class VibeProjectsOpenSettings extends Action2 {
		constructor() {
			super({
				id: VibeProjectsCommands.openSettings,
				title: localize2('vibeProjects.openSettings', 'Vibe Projects: Open Settings'),
				category: vibeCategory,
				f1: true,
				menu: [
					{ id: MenuId.ViewTitle, group: '2_settings', order: 0, when: whenVibeProjectsViewTitle },
				],
			});
		}

		async run(accessor: ServicesAccessor): Promise<void> {
			const prefs = accessor.get(IPreferencesService);
			await prefs.openUserSettings({ query: 'vibeProjects' });
		}
	},
);

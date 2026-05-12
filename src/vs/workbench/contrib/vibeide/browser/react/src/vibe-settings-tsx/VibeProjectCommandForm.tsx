/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 VibeIDE Team. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Project Commands — standalone form (Add or Edit a single command).
 *
 * Mounted by `VibeProjectCommandFormPane` as a full editor surface (looks like
 * a modal pane). Self-contained: reads existing commands snapshot from
 * `IVibeCustomCommandsService`, writes through `IFileService`, closes itself
 * via the `close` command passed in `props`.
 *
 * Pure validation and serialisation live in `projectCommandsAddFormPolicy`
 * (`validateAddCommandDraft`, `buildProjectCommandFromDraft`,
 * `appendCommandToFile`, `replaceCommandInFile`). The component is a thin
 * controller around those helpers.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccessor } from '../util/services.js';
import { VibeButtonBgDarken } from '../util/inputs.js';
import { joinPath } from '../../../../../../../base/common/resources.js';
import { VSBuffer } from '../../../../../../../base/common/buffer.js';
import {
	ADD_COMMAND_DRAFT_EMPTY,
	ADD_COMMAND_ERROR,
	AddCommandDraft,
	appendCommandToFile,
	buildProjectCommandFromDraft,
	previewProjectCommandJson,
	replaceCommandInFile,
	validateAddCommandDraft,
} from '../../../../common/projectCommandsAddFormPolicy.js';
import {
	decodeProjectCommandsFile,
	ProjectCommandTerminal,
	ProjectCommandsFile,
} from '../../../../common/projectCommandsTypes.js';
import { safeParseConfigJson } from '../../../../common/vibeConfigJsonParser.js';
import { workspaceS } from './vibeSettingsRu.js';

export type VibeProjectCommandFormMode = 'add' | 'edit';

export interface VibeProjectCommandFormProps {
	readonly mode: VibeProjectCommandFormMode;
	/** For edit: the original id (immutable in the form). For add: empty. */
	readonly commandIdForEdit?: string;
	/** Prefilled draft (edit mode). Undefined for add ⇒ use ADD_COMMAND_DRAFT_EMPTY. */
	readonly initialDraft?: AddCommandDraft;
}

export const VibeProjectCommandForm: React.FC<VibeProjectCommandFormProps> = (props) => {
	const accessor = useAccessor();
	const commands = accessor.get('IVibeCustomCommandsService');
	const fileService = accessor.get('IFileService');
	const workspace = accessor.get('IWorkspaceContextService');
	const notifications = accessor.get('INotificationService');
	const commandService = accessor.get('ICommandService');

	const { mode, commandIdForEdit } = props;
	const isEdit = mode === 'edit';

	const [draft, setDraft] = useState<AddCommandDraft>(props.initialDraft ?? ADD_COMMAND_DRAFT_EMPTY);
	const [saveBusy, setSaveBusy] = useState(false);

	// Snapshot of existing ids — used for duplicate validation in add mode.
	// In edit mode we exclude the current id from the duplicate check so the
	// user can rename a command (changing id ⇒ "new" id is verified against
	// the rest of the set).
	const [snapshot, setSnapshot] = useState(() => commands.getCommands());
	useEffect(() => {
		const d = commands.onDidChangeCommands(e => setSnapshot(e.commands));
		return () => d.dispose();
	}, [commands]);

	const existingIds = useMemo(() => {
		const s = new Set(snapshot.map(c => c.id));
		if (isEdit && commandIdForEdit) s.delete(commandIdForEdit);
		return s;
	}, [snapshot, isEdit, commandIdForEdit]);

	const validation = useMemo(() => validateAddCommandDraft(draft, existingIds), [draft, existingIds]);

	const previewCommand = useMemo(() => {
		if (!draft.id.trim() || !draft.name.trim() || !draft.command.trim()) return null;
		try { return buildProjectCommandFromDraft(draft); } catch { return null; }
	}, [draft]);

	const errLabel = useCallback((code: string | null): string | null => {
		switch (code) {
			case ADD_COMMAND_ERROR.idMissing: return workspaceS.pcErrIdMissing;
			case ADD_COMMAND_ERROR.idPattern: return workspaceS.pcErrIdPattern;
			case ADD_COMMAND_ERROR.idDuplicate: return workspaceS.pcErrIdDuplicate;
			case ADD_COMMAND_ERROR.nameMissing: return workspaceS.pcErrNameMissing;
			case ADD_COMMAND_ERROR.commandMissing: return workspaceS.pcErrCommandMissing;
			case ADD_COMMAND_ERROR.cwdAbsolute: return workspaceS.pcErrCwdAbsolute;
			case ADD_COMMAND_ERROR.cwdTraversal: return workspaceS.pcErrCwdTraversal;
			case ADD_COMMAND_ERROR.orderNotNumber: return workspaceS.pcErrOrderNotNumber;
			default: return null;
		}
	}, []);

	const closeEditor = useCallback(async () => {
		try {
			await commandService.executeCommand('workbench.action.closeActiveEditor');
		} catch { /* ignore */ }
	}, [commandService]);

	const onSave = useCallback(async () => {
		if (!validation.isValid || saveBusy) return;
		const folder = workspace.getWorkspace().folders[0];
		if (!folder) {
			notifications.notify({ severity: 2 /* Warning */, message: workspaceS.pcAddNoWorkspace });
			return;
		}
		setSaveBusy(true);
		try {
			const commandsUri = joinPath(folder.uri, '.vibe', 'commands.json');
			let existing: ProjectCommandsFile = { vibeVersion: '1.0.0', commands: [] };
			try {
				const buf = await fileService.readFile(commandsUri);
				const parsed = safeParseConfigJson(buf.value.toString());
				if (parsed.ok) {
					const decoded = decodeProjectCommandsFile(parsed.value);
					if (decoded.ok) existing = decoded.value;
				}
			} catch {
				// File missing — start fresh below.
			}
			const newCmd = buildProjectCommandFromDraft(draft);
			let serialized: string;
			if (isEdit && commandIdForEdit) {
				const replaced = replaceCommandInFile(existing, commandIdForEdit, newCmd);
				if (!replaced) {
					notifications.notify({ severity: 2 /* Warning */, message: workspaceS.pcEditMissing });
					setSaveBusy(false);
					return;
				}
				serialized = replaced.serialized;
			} else {
				serialized = appendCommandToFile(existing, newCmd).serialized;
			}
			await fileService.writeFile(commandsUri, VSBuffer.fromString(serialized));
			await commands.reload();
			notifications.notify({
				severity: 3 /* Info */,
				message: isEdit ? workspaceS.pcEditDone(newCmd.name) : workspaceS.pcAddDone(newCmd.name),
			});
			await closeEditor();
		} catch (e) {
			notifications.notify({
				severity: 1 /* Error */,
				message: workspaceS.pcSaveFailed(String((e as Error)?.message ?? e)),
			});
		} finally {
			setSaveBusy(false);
		}
	}, [validation.isValid, saveBusy, workspace, notifications, fileService, draft, isEdit, commandIdForEdit, commands, closeEditor]);

	const updateField = <K extends keyof AddCommandDraft>(key: K, value: AddCommandDraft[K]) => {
		setDraft(d => ({ ...d, [key]: value }));
	};

	const labelCls = 'text-xs text-vibe-fg-2 font-medium';
	const hintCls = 'text-[10px] text-vibe-fg-3';
	const errCls = 'text-[10px] text-red-400';
	const inputCls = '@@vibe-chat-like-control w-full text-xs px-2 py-1 text-vibe-fg-2 font-mono';

	return (
		<div className='@@vibe-scope flex flex-col gap-4 max-w-2xl mx-auto p-6'>
			<div className='flex items-center justify-between'>
				<h2 className='text-lg text-vibe-fg-1 font-medium'>
					{isEdit ? workspaceS.pcFormEditTitle(commandIdForEdit ?? '') : workspaceS.pcFormAddTitle}
				</h2>
				<button
					type='button'
					className='text-xs text-vibe-fg-3 hover:brightness-110 px-2 py-1 border border-vibe-border-1 rounded'
					onClick={() => { void closeEditor(); }}
				>{workspaceS.pcFormCancel}</button>
			</div>

			<p className='text-xs text-vibe-fg-3'>{workspaceS.pcFormIntro}</p>

			<div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
				<div className='flex flex-col gap-1'>
					<label className={labelCls}>{workspaceS.pcFieldId} *</label>
					<input
						className={inputCls}
						value={draft.id}
						disabled={isEdit /* id is immutable once committed */}
						placeholder='lint, deploy-dev'
						onChange={e => updateField('id', e.target.value)}
					/>
					{validation.errors.id ? <span className={errCls}>{errLabel(validation.errors.id)}</span> : <span className={hintCls}>{workspaceS.pcFieldIdHint}</span>}
				</div>
				<div className='flex flex-col gap-1'>
					<label className={labelCls}>{workspaceS.pcFieldName} *</label>
					<input
						className={inputCls}
						value={draft.name}
						placeholder='Run lint'
						onChange={e => updateField('name', e.target.value)}
					/>
					{validation.errors.name ? <span className={errCls}>{errLabel(validation.errors.name)}</span> : null}
				</div>
			</div>

			<div className='flex flex-col gap-1'>
				<label className={labelCls}>{workspaceS.pcFieldDescription}</label>
				<input
					className={inputCls}
					value={draft.description}
					placeholder={workspaceS.pcFieldDescriptionPlaceholder}
					onChange={e => updateField('description', e.target.value)}
				/>
			</div>

			<div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
				<div className='flex flex-col gap-1 md:col-span-1'>
					<label className={labelCls}>{workspaceS.pcFieldCommand} *</label>
					<input
						className={inputCls}
						value={draft.command}
						placeholder='npm'
						onChange={e => updateField('command', e.target.value)}
					/>
					{validation.errors.command ? <span className={errCls}>{errLabel(validation.errors.command)}</span> : null}
				</div>
				<div className='flex flex-col gap-1 md:col-span-2'>
					<label className={labelCls}>{workspaceS.pcFieldArgs}</label>
					<textarea
						className={`${inputCls} min-h-[72px]`}
						value={draft.argsText}
						placeholder={'run\nlint'}
						onChange={e => updateField('argsText', e.target.value)}
						spellCheck={false}
					/>
					<span className={hintCls}>{workspaceS.pcFieldArgsHint}</span>
				</div>
			</div>

			<div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
				<div className='flex flex-col gap-1'>
					<label className={labelCls}>{workspaceS.pcFieldCwd}</label>
					<input
						className={inputCls}
						value={draft.cwd}
						placeholder={workspaceS.pcFieldCwdPlaceholder}
						onChange={e => updateField('cwd', e.target.value)}
					/>
					{validation.errors.cwd ? <span className={errCls}>{errLabel(validation.errors.cwd)}</span> : <span className={hintCls}>{workspaceS.pcFieldCwdHint}</span>}
				</div>
				<div className='flex flex-col gap-1'>
					<label className={labelCls}>{workspaceS.pcFieldTerminal}</label>
					<select
						className={inputCls}
						value={draft.terminal ?? ''}
						onChange={e => updateField('terminal', e.target.value as ProjectCommandTerminal | '')}
					>
						<option value=''>{workspaceS.pcTerminalDefault}</option>
						<option value='integrated'>{workspaceS.pcTerminalIntegrated}</option>
						<option value='external'>{workspaceS.pcTerminalExternal}</option>
						<option value='background'>{workspaceS.pcTerminalBackground}</option>
					</select>
				</div>
			</div>

			<div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
				<label className='flex items-center gap-2 cursor-pointer select-none'>
					<input
						type='checkbox'
						checked={draft.pinned}
						onChange={e => updateField('pinned', e.target.checked)}
					/>
					<span className='text-xs text-vibe-fg-2'>{workspaceS.pcFieldPinned}</span>
				</label>
				<div className='flex flex-col gap-1'>
					<label className={labelCls}>{workspaceS.pcFieldOrder}</label>
					<input
						className={inputCls}
						value={draft.orderText}
						placeholder='0'
						onChange={e => updateField('orderText', e.target.value)}
					/>
					{validation.errors.order ? <span className={errCls}>{errLabel(validation.errors.order)}</span> : <span className={hintCls}>{workspaceS.pcFieldOrderHint}</span>}
				</div>
			</div>

			{previewCommand ? (
				<details className='@@vibe-chat-like-shell px-3 py-2 text-xs'>
					<summary className='cursor-pointer text-vibe-fg-2 select-none'>{workspaceS.pcFormPreviewToggle}</summary>
					<pre className='mt-2 max-h-48 overflow-auto font-mono text-[11px] text-vibe-fg-3 whitespace-pre-wrap border-t border-vibe-border-1 pt-2'>{previewProjectCommandJson(previewCommand)}</pre>
				</details>
			) : null}

			<div className='flex items-center gap-2 mt-2 border-t border-vibe-border-1 pt-3'>
				<VibeButtonBgDarken
					className='px-4 py-1.5 text-xs'
					onClick={() => { void onSave(); }}
					disabled={!validation.isValid || saveBusy}
				>
					{saveBusy
						? workspaceS.pcFormSaveBusy
						: (isEdit ? workspaceS.pcFormSaveEdit : workspaceS.pcFormSaveAdd)}
				</VibeButtonBgDarken>
				<button
					type='button'
					className='text-xs text-vibe-fg-3 hover:brightness-110 px-3 py-1.5'
					onClick={() => { void closeEditor(); }}
					disabled={saveBusy}
				>{workspaceS.pcFormCancel}</button>
				{!validation.isValid ? <span className='text-[10px] text-amber-400'>{workspaceS.pcFormHasErrors}</span> : null}
			</div>
		</div>
	);
};

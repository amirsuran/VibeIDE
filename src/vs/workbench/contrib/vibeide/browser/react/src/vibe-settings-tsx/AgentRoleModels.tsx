/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { useAccessor, useSettingsState } from '../util/services.js';
import { VIBE_AGENT_ROLE_PRESETS } from '../../../../common/vibeSubagentRegistryService.js';

/**
 * Per-role model mapping for Vibe Agents (VA.2). Shared between the Settings page and the in-chat
 * «Роли» modal (opened from the route launcher) — a plain select per role over the computed model
 * options + «как в чате» (no mapping). Read-only roles get a badge; caller supplies the header.
 */
export const AgentRoleModels = () => {
	const accessor = useAccessor();
	const vibeideSettingsService = accessor.get('IVibeideSettingsService');
	const settingsState = useSettingsState();

	return (
		<>
			<div className='text-sm text-vibe-fg-3 mt-1'>
				Какая модель исполняет каждую роль Vibe Agents. По умолчанию — модель чата. Read-only роли
				(планировщик, ревьюер, security) выгодно сажать на лёгкую модель: дешевле и быстрее, а
				писать код им всё равно запрещено.
			</div>
			<div className='my-2 flex flex-col gap-y-1'>
				{VIBE_AGENT_ROLE_PRESETS.map(preset => {
					const current = settingsState.modelSelectionOfRole?.[preset.type] ?? null;
					const currentKey = current ? `${current.providerName}:::${current.modelName}` : '';
					const isReadOnly = !preset.allowedTools.some(t => t === 'edit_file' || t === 'rewrite_file' || t === 'run_command');
					return (
						<div key={preset.type} className='flex items-center gap-x-2'>
							<span className='text-xs text-vibe-fg-2 w-32'>{preset.displayName}</span>
							{isReadOnly && <span className='text-[10px] text-vibe-fg-3 border border-vibe-border-2 rounded px-1'>только чтение</span>}
							<select
								className='text-xs text-vibe-fg-3 bg-vibe-bg-1 border border-vibe-border-1 rounded p-0.5 px-1 max-w-64'
								value={currentKey}
								onChange={(e) => {
									const v = e.target.value;
									if (!v) { void vibeideSettingsService.setModelSelectionOfRole(preset.type, null); return; }
									const opt = settingsState._modelOptions.find(o => `${o.selection.providerName}:::${o.selection.modelName}` === v);
									if (opt) { void vibeideSettingsService.setModelSelectionOfRole(preset.type, opt.selection); }
								}}
							>
								<option value=''>как в чате</option>
								{settingsState._modelOptions.map(o => (
									<option key={`${o.selection.providerName}:::${o.selection.modelName}`} value={`${o.selection.providerName}:::${o.selection.modelName}`}>
										{o.name}
									</option>
								))}
							</select>
						</div>
					);
				})}
			</div>
		</>
	);
};

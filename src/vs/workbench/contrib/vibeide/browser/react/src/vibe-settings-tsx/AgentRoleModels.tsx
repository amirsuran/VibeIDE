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
			{/* Inline styles (not Tailwind utilities) for the layout: this card is a shared
			    cross-bundle component (Settings page + in-chat modal), and the modal bundle's
			    Tailwind CSS does not generate every layout/border utility — only text size/color
			    classes are reliably present. Inline styles render identically in any bundle. */}
			<div
				style={{
					display: 'grid',
					gridTemplateColumns: 'max-content minmax(0, 1fr)',
					alignItems: 'center',
					columnGap: '12px',
					rowGap: '6px',
					margin: '8px 0',
				}}
			>
				{VIBE_AGENT_ROLE_PRESETS.map(preset => {
					const current = settingsState.modelSelectionOfRole?.[preset.type] ?? null;
					const currentKey = current ? `${current.providerName}:::${current.modelName}` : '';
					const isReadOnly = !preset.allowedTools.some(t => t === 'edit_file' || t === 'rewrite_file' || t === 'run_command');
					return (
						<React.Fragment key={preset.type}>
							<div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
								<span className='text-xs text-vibe-fg-2'>{preset.displayName}</span>
								{isReadOnly && (
									<span
										className='text-vibe-fg-3'
										style={{
											fontSize: '10px',
											whiteSpace: 'nowrap',
											border: '1px solid var(--vscode-input-border, var(--vscode-widget-border, transparent))',
											borderRadius: '4px',
											padding: '0 4px',
										}}
									>
										только чтение
									</span>
								)}
							</div>
							<select
								className='@@vibe-themed-select text-xs'
								style={{ width: '100%', padding: '4px 8px', cursor: 'pointer' }}
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
						</React.Fragment>
					);
				})}
			</div>
		</>
	);
};

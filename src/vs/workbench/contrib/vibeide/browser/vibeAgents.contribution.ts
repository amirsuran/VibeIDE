/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


/**
 * Vibe Agents — surfaces the role-routing logic (VA.3/VA.4) to the user. Shows which roles
 * (and whether security-by-default) a task would dispatch to. Execution lands with the
 * Phase-3b subagent runner; this command exposes the deterministic plan today.
 */

import { localize, localize2 } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../editor/browser/editorExtensions.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { approvalTypeOfBuiltinToolName } from '../common/prompt/tools/index.js';
import { IVibeSubagentOrchestratorService } from '../common/vibeSubagentOrchestratorService.js';
import { IVibeSubagentRegistryService } from '../common/vibeSubagentRegistryService.js';
import { IChatThreadService } from './chatThreadService.js';

registerAction2(
	class VibeAgentsPlanRoute extends Action2 {
		constructor() {
			super({
				id: 'vibeide.vibeAgents.planRoute',
				title: localize2('vibeAgents.planRoute', 'Vibe Agents: Показать маршрут ролей для задачи'),
				category: localize2('vibeCategory', 'VibeIDE'),
				f1: true,
			});
		}

		async run(accessor: ServicesAccessor): Promise<void> {
			const quickInput = accessor.get(IQuickInputService);
			const orchestrator = accessor.get(IVibeSubagentOrchestratorService);
			const notice = accessor.get(INotificationService);

			const task = await quickInput.input({
				title: localize('vibeAgents.planRoute.title', "Опишите задачу — покажу маршрут ролей"),
				placeHolder: localize('vibeAgents.planRoute.placeholder', "например: добавить страницу входа через OAuth"),
			});
			if (!task?.trim()) {
				return;
			}

			const route = orchestrator.planRoute(task.trim());
			const stages = route.stages
				.map(stage => (stage.length > 1 ? `[${stage.join(' ∥ ')}]` : stage[0]))
				.join(' → ');
			const security = route.securityAdded ? localize('vibeAgents.planRoute.security', " (+security авто)") : '';
			notice.info(localize('vibeAgents.planRoute.result', "Маршрут ({0}): {1}{2}", route.kind, stages, security));
		}
	},
);

registerAction2(
	class VibeAgentsExecuteRoute extends Action2 {
		constructor() {
			super({
				id: 'vibeide.vibeAgents.executeRoute',
				title: localize2('vibeAgents.executeRoute', 'Vibe Agents: Выполнить маршрут ролей для задачи'),
				category: localize2('vibeCategory', 'VibeIDE'),
				f1: true,
			});
		}

		// Audit H: `executeRoute` existed since VA.3 but had NO user-facing entry — roles could
		// be planned, never launched. Progress is visible on the subagent status-bar counter;
		// a running role can be cancelled from its picker (audit F).
		async run(accessor: ServicesAccessor): Promise<void> {
			const quickInput = accessor.get(IQuickInputService);
			const orchestrator = accessor.get(IVibeSubagentOrchestratorService);
			const notice = accessor.get(INotificationService);
			const editorService = accessor.get(IEditorService);
			const chatThreadService = accessor.get(IChatThreadService);

			const task = await quickInput.input({
				title: localize('vibeAgents.executeRoute.title', "Опишите задачу — команда ролей выполнит её"),
				placeHolder: localize('vibeAgents.executeRoute.placeholder', "например: добавить страницу входа через OAuth"),
			});
			if (!task?.trim()) {
				return;
			}

			const route = orchestrator.planRoute(task.trim());
			const stages = route.stages.map(stage => (stage.length > 1 ? `[${stage.join(' ∥ ')}]` : stage[0])).join(' → ');
			notice.info(localize('vibeAgents.executeRoute.started', "Команда ролей запущена: {0}. Прогресс — в статус-баре субагентов; отмена — клик по нему.", stages));

			try {
				const results = await orchestrator.executeRoute({
					parentThreadId: chatThreadService.state.currentThreadId,
					taskText: task.trim(),
				});
				const ok = results.filter(r => r.status === 'success').length;
				const md = [
					localize('vibeAgents.executeRoute.reportTitle', "# Vibe Agents — отчёт команды ролей"),
					'',
					localize('vibeAgents.executeRoute.reportTask', "Задача: {0}", task.trim()),
					localize('vibeAgents.executeRoute.reportRoute', "Маршрут: {0}", stages),
					'',
					...results.map(r => [
						`## ${r.subagentId} — ${r.status}`,
						r.summary,
						r.artifacts?.length ? localize('vibeAgents.executeRoute.reportArtifacts', "Артефакты: {0}", r.artifacts.join(', ')) : undefined,
						r.reason ? localize('vibeAgents.executeRoute.reportReason', "Причина: {0}", r.reason) : undefined,
						localize('vibeAgents.executeRoute.reportTokens', "~{0} токенов (оценка)", String(r.tokensUsed)),
						'',
					].filter((l): l is string => l !== undefined)).flat(),
				].join('\n');
				await editorService.openEditor({ resource: undefined, contents: md, languageId: 'markdown', options: { pinned: true } });
				notice.notify({
					severity: ok === results.length ? Severity.Info : Severity.Warning,
					message: localize('vibeAgents.executeRoute.done', "Команда ролей завершена: {0}/{1} успешно. Отчёт открыт в редакторе.", String(ok), String(results.length)),
				});
			} catch (e) {
				notice.error(localize('vibeAgents.executeRoute.failed', "Команда ролей прервана: {0}", e instanceof Error ? e.message : String(e)));
			}
		}
	},
);

registerAction2(
	class VibeAgentsListRoles extends Action2 {
		constructor() {
			super({
				id: 'vibeide.vibeAgents.listRoles',
				title: localize2('vibeAgents.listRoles', 'Vibe Agents: Показать роли и их права'),
				category: localize2('vibeCategory', 'VibeIDE'),
				f1: true,
			});
		}

		async run(accessor: ServicesAccessor): Promise<void> {
			const registry = accessor.get(IVibeSubagentRegistryService);
			const quickInput = accessor.get(IQuickInputService);
			// Audit J: «full access» is derived from the approval map, not from a hardcoded tool
			// name — the previous `includes('write_file')` check silently broke when the role
			// whitelists were fixed to real builtin ids (write_file never existed).
			const items = registry.listPresets().map(p => ({
				label: p.displayName,
				description: p.allowedTools.some(t => Object.hasOwn(approvalTypeOfBuiltinToolName, t))
					? localize('vibeAgents.roles.full', "полный доступ (запись/терминал)")
					: localize('vibeAgents.roles.readonly', "только чтение"),
				detail: p.allowedTools.join(', '),
			}));
			await quickInput.pick(items, { title: localize('vibeAgents.roles.title', "Роли субагентов и их права"), canPickMany: false });
		}
	},
);

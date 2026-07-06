/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { localize } from '../../../../nls.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { ILLMMessageService } from '../common/sendLLMMessageService.js';
import { RawToolCallObj, LLMChatMessage } from '../common/sendLLMMessageTypes.js';
import { ModelSelection } from '../common/vibeideSettingsTypes.js';
import { IVibeideSettingsService } from '../common/vibeideSettingsService.js';
import { ChatMessage } from '../common/chatThreadServiceTypes.js';
import { BuiltinToolName, ToolName } from '../common/toolsServiceTypes.js';
import { approvalTypeOfBuiltinToolName } from '../common/prompt/tools/index.js';
import { IVibeSubagentRunner, SubagentRunRequest, SubagentRunOutcome } from '../common/vibeSubagentRunner.js';
import { IVibeSubagentRegistryService } from '../common/vibeSubagentRegistryService.js';
import { decideStop, estimateTokensFromChars, truncateSummary, chatModeForAllowedTools, collectPathsFromRawParams, buildExploreReport, buildSubagentTaskMessage, stopReasonToRussian, SUBAGENT_MAX_DENIED_ACTIONS } from '../common/subagentLoopPolicy.js';
import { IConvertToLLMMessageService } from './convertToLLMMessageService.js';
import { IToolsService } from './toolsService.js';
import { IVibeAgentActivityLogService } from './vibeAgentActivityLogService.js';

/** The compact-handoff contract: no result field exceeds this. */
const MAX_SUMMARY_CHARS = 500;
/** Tools whose successful calls count as produced artifacts. */
const WRITE_TOOL_NAMES = new Set(['edit_file', 'rewrite_file', 'create_file_or_folder']);

type HopOutcome =
	| { kind: 'final'; fullText: string; toolCall: RawToolCallObj | undefined }
	| { kind: 'error'; message: string };

/**
 * Headless subagent tool-loop (Phase 3b) — the real executor behind `vibeSubagentService`.
 *
 * Isolation per roadmap § I.0: the loop runs over its OWN in-memory `ChatMessage[]`
 * transcript (never the thread store) with its own step/time/token budgets. Tools are
 * enforced twice: prompt-side via ChatMode ('gather' hides every approval tool from
 * read-only roles) and runtime-side via the role whitelist (a non-whitelisted call is
 * answered with a corrective tool error, not executed). Approval-requiring tools of
 * full roles go through an explicit user confirm — the runner never silently writes.
 */
class VibeSubagentRunnerService extends Disposable implements IVibeSubagentRunner {
	declare readonly _serviceBrand: undefined;

	constructor(
		@ILLMMessageService private readonly _llm: ILLMMessageService,
		@IConvertToLLMMessageService private readonly _convert: IConvertToLLMMessageService,
		@IToolsService private readonly _tools: IToolsService,
		@IVibeideSettingsService private readonly _settings: IVibeideSettingsService,
		@IDialogService private readonly _dialogService: IDialogService,
		@IVibeAgentActivityLogService private readonly _activityLog: IVibeAgentActivityLogService,
		@IVibeSubagentRegistryService private readonly _registry: IVibeSubagentRegistryService,
	) {
		super();
	}

	async run(req: SubagentRunRequest): Promise<SubagentRunOutcome> {
		const preset = this._registry.getPreset(req.type);
		// Model priority (VA.2 «модель на роль»): explicit request → per-role mapping from
		// settings → the session's Chat model. Read-only roles are the cost-routing case:
		// a light model plans/reviews fine while the Chat model does the heavy lifting.
		const modelSelection = req.modelSelection
			?? this._settings.state.modelSelectionOfRole?.[req.type]
			?? this._settings.state.modelSelectionOfFeature?.['Chat'];
		if (!modelSelection || modelSelection.providerName === 'auto') {
			return this._outcome(req, 'failed', 'Не выбрана модель для субагента (настройте модель чата).', [], 0, false, 'нет модели', []);
		}

		const chatMode = chatModeForAllowedTools(req.allowedTools);
		const deadlineAtMs = req.maxWallClockMs > 0 ? Date.now() + req.maxWallClockMs : 0;
		const limits = { maxSteps: req.maxSteps, maxTokensEst: req.maxTokensEst, deadlineAtMs, maxDeniedActions: SUBAGENT_MAX_DENIED_ACTIONS };

		const taskMessage = buildSubagentTaskMessage({ displayName: preset.displayName, systemAppendix: preset.systemAppendix, goal: req.goal, acceptanceCriteria: req.acceptanceCriteria, contextItems: req.contextItems });
		const history: ChatMessage[] = [{
			role: 'user',
			content: taskMessage,
			displayContent: taskMessage,
			selections: null,
			state: { stagingSelections: [], isBeingEdited: false },
		}];

		let stepsDone = 0;
		let deniedActions = 0;
		// Counted per hop below: the dominant cost of an agent loop is INPUT — the whole
		// history is re-sent on every hop (audit E: output-only counting made the quota fictional).
		let tokensUsedEst = 0;
		let lastText = '';
		const artifacts: string[] = [];
		const touchedPaths: string[] = [];

		this._activityLog.logStarted(`Subagent ${req.type} (${req.subagentId}): ${chatMode}-режим, шагов ≤${req.maxSteps}, модель ${modelSelection.providerName}/${modelSelection.modelName}`);

		while (true) {
			const stop = decideStop({ stepsDone, tokensUsedEst, deniedActions, nowMs: Date.now(), cancelled: req.cancellationToken?.isCancellationRequested === true }, limits);
			if (stop) {
				const reason = stopReasonToRussian(stop);
				this._activityLog.logError(`Subagent ${req.subagentId}: остановлен — ${reason}`);
				return this._outcome(req, 'failed', `Роль «${preset.displayName}» не успела завершить задачу: ${reason}. Последний вывод: ${lastText}`, artifacts, tokensUsedEst, true, reason, touchedPaths);
			}
			stepsDone++;

			const { messages, separateSystemMessage } = await this._convert.prepareLLMChatMessages({
				chatMessages: history,
				chatMode,
				modelSelection,
			});
			// Audit E: charge the full re-sent input of THIS hop against the quota (history
			// grows every hop, so later hops cost more — exactly what the estimate must reflect).
			tokensUsedEst += estimateTokensFromChars(JSON.stringify(messages).length + (separateSystemMessage?.length ?? 0));

			const hop = await this._sendOnce({ req, messages, separateSystemMessage, chatMode, modelSelection, deadlineAtMs });
			if (hop.kind === 'error') {
				this._activityLog.logError(`Subagent ${req.subagentId}: ошибка LLM — ${hop.message}`);
				return this._outcome(req, 'failed', `Роль «${preset.displayName}»: ошибка запроса к модели — ${hop.message}`, artifacts, tokensUsedEst, false, 'llm-error', touchedPaths);
			}

			tokensUsedEst += estimateTokensFromChars(hop.fullText.length);
			lastText = hop.fullText || lastText;
			const toolCall = hop.toolCall;

			// Natural completion: prose without a tool call, or an explicit vibe_complete.
			if (!toolCall || toolCall.name.toLowerCase() === 'vibe_complete') {
				const completeSummary = toolCall
					? String(toolCall.rawParams['summary'] ?? toolCall.rawParams['result'] ?? lastText)
					: lastText;
				this._activityLog.logFinished(`Subagent ${req.subagentId}: завершено за ${stepsDone} шаг(ов), ~${tokensUsedEst} ток. (оценка)`);
				return this._outcome(req, 'success', completeSummary || `Роль «${preset.displayName}» завершила задачу.`, artifacts, tokensUsedEst, false, 'completed', touchedPaths);
			}

			// From here on the model asked for a real tool — append its assistant turn first.
			history.push({ role: 'assistant', displayContent: hop.fullText, reasoning: '', anthropicReasoning: null });

			const isBuiltin = Object.hasOwn(this._tools.validateParams, toolCall.name);
			const isAllowed = isBuiltin && req.allowedTools.includes(toolCall.name);
			if (!isAllowed) {
				deniedActions++;
				history.push(this._invalidToolMessage(toolCall, `Инструмент «${toolCall.name}» не разрешён роли «${preset.displayName}». Доступные инструменты: ${req.allowedTools.join(', ')}. Используй только их.`));
				continue;
			}
			// Safe cast: builtin-ness just verified via the validateParams map itself.
			const toolName = toolCall.name as BuiltinToolName;

			let params: unknown;
			try {
				params = this._tools.validateParams[toolName](toolCall.rawParams as never);
			} catch (e) {
				deniedActions++;
				history.push(this._invalidToolMessage(toolCall, `Некорректные параметры «${toolName}»: ${e instanceof Error ? e.message : String(e)}`));
				continue;
			}

			// Approval gate: the runner bypasses the chat-thread approval flow, so
			// approval-requiring tools (writes/terminal) get an explicit user confirm here.
			if (Object.hasOwn(approvalTypeOfBuiltinToolName, toolName)) {
				const { confirmed } = await this._dialogService.confirm({
					message: localize('vibeide.subagentRunner.approve', "Субагент-роль «{0}» запрашивает инструмент «{1}»", preset.displayName, toolName),
					detail: localize('vibeide.subagentRunner.approveDetail', "Параметры: {0}", truncateSummary(JSON.stringify(toolCall.rawParams), 300)),
					primaryButton: localize('vibeide.subagentRunner.approveBtn', "Разрешить"),
				});
				if (!confirmed) {
					deniedActions++;
					history.push({
						role: 'tool', type: 'rejected', result: null,
						name: toolName as ToolName, params: params as never,
						content: 'Пользователь отклонил вызов инструмента. Предложи другой путь или заверши задачу.',
						id: toolCall.id || generateUuid(), rawParams: toolCall.rawParams, mcpServerName: undefined,
					} as ChatMessage);
					continue;
				}
			}

			try {
				const { result } = await this._tools.callTool[toolName](params as never);
				const content = this._tools.stringOfResult[toolName](params as never, result as never);
				const paths = collectPathsFromRawParams(toolCall.rawParams);
				touchedPaths.push(...paths);
				if (WRITE_TOOL_NAMES.has(toolName)) { artifacts.push(...paths); }
				tokensUsedEst += estimateTokensFromChars(content.length);
				history.push({
					role: 'tool', type: 'success', result: result as never,
					name: toolName as ToolName, params: params as never,
					content,
					id: toolCall.id || generateUuid(), rawParams: toolCall.rawParams, mcpServerName: undefined,
				} as ChatMessage);
			} catch (e) {
				const errText = e instanceof Error ? e.message : String(e);
				history.push({
					role: 'tool', type: 'tool_error', result: errText,
					name: toolName as ToolName, params: params as never,
					content: errText,
					id: toolCall.id || generateUuid(), rawParams: toolCall.rawParams, mcpServerName: undefined,
				} as ChatMessage);
			}
		}
	}

	private _sendOnce(opts: {
		req: SubagentRunRequest;
		messages: LLMChatMessage[];
		separateSystemMessage: string | undefined;
		chatMode: 'agent' | 'gather';
		modelSelection: ModelSelection;
		deadlineAtMs: number;
	}): Promise<HopOutcome> {
		return new Promise<HopOutcome>(resolve => {
			let settled = false;
			let timer: ReturnType<typeof setTimeout> | undefined;
			let cancelSub: { dispose(): void } | undefined;
			const finish = (v: HopOutcome) => {
				if (settled) { return; }
				settled = true;
				if (timer !== undefined) { clearTimeout(timer); }
				cancelSub?.dispose();
				resolve(v);
			};
			const requestId = this._llm.sendLLMMessage({
				messagesType: 'chatMessages',
				messages: opts.messages,
				separateSystemMessage: opts.separateSystemMessage,
				chatMode: opts.chatMode,
				modelSelection: opts.modelSelection,
				modelSelectionOptions: undefined,
				overridesOfModel: this._settings.state.overridesOfModel,
				onText: () => { },
				onFinalMessage: p => finish({ kind: 'final', fullText: p.fullText, toolCall: p.toolCall }),
				onError: e => finish({ kind: 'error', message: e.message || String(e) }),
				onAbort: () => finish({ kind: 'error', message: 'запрос прерван (отмена или лимит времени субагента)' }),
				logging: { loggingName: `Subagent/${opts.req.type}` },
			});
			if (requestId === null) { return; } // onError has already fired synchronously
			if (opts.deadlineAtMs > 0) {
				const remainingMs = Math.max(1_000, opts.deadlineAtMs - Date.now());
				timer = setTimeout(() => this._llm.abort(requestId), remainingMs);
			}
			// Audit A: parent cancellation kills the IN-FLIGHT request too, not just the next
			// hop — otherwise a disposed subagent still finishes (and pays for) this hop.
			cancelSub = opts.req.cancellationToken?.onCancellationRequested(() => this._llm.abort(requestId));
		});
	}

	private _invalidToolMessage(toolCall: RawToolCallObj, content: string): ChatMessage {
		return {
			role: 'tool', type: 'invalid_params', result: null,
			name: toolCall.name,
			content,
			id: toolCall.id || generateUuid(), rawParams: toolCall.rawParams, mcpServerName: undefined,
		} as ChatMessage;
	}

	private _outcome(req: SubagentRunRequest, status: 'success' | 'failed', summary: string, artifacts: string[], tokensUsedEst: number, truncated: boolean, stopReason: string, touchedPaths: string[]): SubagentRunOutcome {
		return {
			status,
			summary: truncateSummary(summary, MAX_SUMMARY_CHARS),
			artifacts: [...new Set(artifacts)],
			tokensUsedEst,
			truncated,
			stopReason,
			...(req.type === 'explore' ? { exploreReport: buildExploreReport(touchedPaths, truncated) } : {}),
		};
	}
}

registerSingleton(IVibeSubagentRunner, VibeSubagentRunnerService, InstantiationType.Delayed);

/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

// disable foreign import complaints
/* eslint-disable */
import { streamText, jsonSchema, tool, type ModelMessage, type ToolSet, type TextStreamPart } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { fetch as undiciFetch } from 'undici';
import type { JSONSchema7 } from '@ai-sdk/provider';
/* eslint-enable */

import { generateUuid } from '../../../../../base/common/uuid.js';
import { availableTools, InternalToolInfo } from '../../common/prompt/prompts.js';
import { getModelCapabilities } from '../../common/modelCapabilities.js';
import { LLMChatMessage, RawToolCallObj, RawToolParamsObj } from '../../common/sendLLMMessageTypes.js';
import { SettingsOfProvider } from '../../common/vibeideSettingsTypes.js';
import { ensureSystemCADispatcher } from './systemCAFetch.js';
import { extractReasoningWrapper, extractXMLToolsWrapper } from './extractGrammar.js';
import type { SendChatParams_Internal } from './sendLLMMessage.internalTypes.js';
import { assertHttpHeaderSafe, getGoogleApiKey } from './llmHelpers.js';

// Providers handled by this adapter. The remaining providers (openAI native,
// anthropic, gemini, ollama, vLLM, lmStudio) stay on the legacy path until
// later stages.
export type AiSdkProviderName =
	| 'openCode' | 'openCodeZen' | 'openRouter' | 'openAICompatible' | 'liteLLM' | 'lmRoute' | 'pollinations'
	| 'deepseek' | 'mistral' | 'xAI' | 'groq' | 'awsBedrock' | 'googleVertex' | 'microsoftAzure';

const EMPTY_CONTENT_PLACEHOLDER = '(no content)';

// Module-level singleton: matches the existing impl which also calls
// ensureSystemCADispatcher() lazily once per OpenAI client construction.
const sharedDispatcher = ensureSystemCADispatcher();

// fetch wrapper that pins the corporate-CA-aware undici dispatcher. We cannot
// pass `dispatcher` directly to streamText() — AI SDK only accepts a standard
// fetch — so we wrap undici.fetch and surface it as a global-fetch lookalike.
const customFetch: typeof globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
	return undiciFetch(input as any, { ...(init as any), dispatcher: sharedDispatcher }) as unknown as Promise<Response>;
}) as any;

const parseHeadersJSON = (s: string | undefined): Record<string, string> | undefined => {
	if (!s) return undefined;
	try {
		const obj = JSON.parse(s);
		if (obj && typeof obj === 'object') {
			const out: Record<string, string> = {};
			for (const k of Object.keys(obj)) {
				const v = (obj as any)[k];
				if (typeof v === 'string') out[k] = v;
			}
			return out;
		}
		return undefined;
	} catch (e) {
		throw new Error(`Error parsing OpenAI-Compatible headers: ${s} is not a valid JSON.`);
	}
};

type ResolvedEndpoint = {
	baseURL: string;
	apiKey: string;
	headers?: Record<string, string>;
	queryParams?: Record<string, string>;
};

// Resolve baseURL/apiKey/headers/queryParams per provider. Endpoints mirror the
// legacy getOpenAICompatibleClient branches one-for-one — any change here would
// silently re-route requests.
const resolveEndpoint = async (
	providerName: AiSdkProviderName,
	modelName: string,
	settingsOfProvider: SettingsOfProvider,
): Promise<ResolvedEndpoint> => {
	switch (providerName) {
		// ---------- Aggregators ----------
		case 'openCode': {
			const c = settingsOfProvider.openCode;
			return { baseURL: 'https://opencode.ai/zen/go/v1', apiKey: c?.apiKey ?? '' };
		}
		case 'openCodeZen': {
			const c = settingsOfProvider.openCodeZen;
			return { baseURL: 'https://opencode.ai/zen/v1', apiKey: c?.apiKey ?? '' };
		}
		case 'openRouter': {
			const c = settingsOfProvider.openRouter;
			return {
				baseURL: 'https://openrouter.ai/api/v1',
				apiKey: c?.apiKey ?? '',
				headers: { 'HTTP-Referer': 'https://vibeide.com', 'X-Title': 'VibeIDE' },
			};
		}
		case 'openAICompatible': {
			const c = settingsOfProvider.openAICompatible;
			const headers = parseHeadersJSON(c?.headersJSON);
			if (headers) {
				for (const [hName, hValue] of Object.entries(headers)) {
					assertHttpHeaderSafe(`OpenAI-Compatible custom header name "${hName}"`, hName);
					if (typeof hValue === 'string') {
						assertHttpHeaderSafe(`OpenAI-Compatible custom header "${hName}" value`, hValue);
					}
				}
			}
			return { baseURL: c?.endpoint ?? '', apiKey: c?.apiKey ?? '', headers };
		}
		case 'liteLLM': {
			const c = settingsOfProvider.liteLLM;
			const endpoint = (c?.endpoint ?? '').replace(/\/+$/, '');
			return { baseURL: `${endpoint}/v1`, apiKey: c?.apiKey || 'noop' };
		}
		case 'lmRoute': {
			const c = settingsOfProvider.lmRoute;
			// Endpoint includes the version segment as-is (e.g. .../openai/v1).
			return { baseURL: c?.endpoint ?? '', apiKey: c?.apiKey || 'noop' };
		}
		case 'pollinations': {
			const c = settingsOfProvider.pollinations;
			return { baseURL: 'https://gen.pollinations.ai/v1', apiKey: c?.apiKey ?? '' };
		}
		// ---------- Direct cloud OpenAI-compat ----------
		case 'deepseek': {
			const c = settingsOfProvider.deepseek;
			return { baseURL: 'https://api.deepseek.com/v1', apiKey: c?.apiKey ?? '' };
		}
		case 'mistral': {
			const c = settingsOfProvider.mistral;
			return { baseURL: 'https://api.mistral.ai/v1', apiKey: c?.apiKey ?? '' };
		}
		case 'xAI': {
			const c = settingsOfProvider.xAI;
			return { baseURL: 'https://api.x.ai/v1', apiKey: c?.apiKey ?? '' };
		}
		case 'groq': {
			const c = settingsOfProvider.groq;
			return { baseURL: 'https://api.groq.com/openai/v1', apiKey: c?.apiKey ?? '' };
		}
		case 'awsBedrock': {
			const c = settingsOfProvider.awsBedrock;
			let baseURL = c?.endpoint || 'http://localhost:4000/v1';
			if (!baseURL.endsWith('/v1')) baseURL = baseURL.replace(/\/+$/, '') + '/v1';
			return { baseURL, apiKey: c?.apiKey ?? '' };
		}
		case 'googleVertex': {
			const c = settingsOfProvider.googleVertex;
			const region = c?.region ?? '';
			const project = c?.project ?? '';
			const apiKey = await getGoogleApiKey();
			assertHttpHeaderSafe('Google Vertex access token', apiKey);
			return {
				baseURL: `https://${region}-aiplatform.googleapis.com/v1/projects/${project}/locations/${region}/endpoints/openapi`,
				apiKey,
			};
		}
		case 'microsoftAzure': {
			const c = settingsOfProvider.microsoftAzure;
			const resource = c?.project ?? '';
			const apiVersion = c?.azureApiVersion ?? '2024-04-01-preview';
			const apiKey = typeof c?.apiKey === 'string' ? c.apiKey : '';
			// Azure URL shape: /openai/deployments/<deployment>/chat/completions?api-version=X.
			// AI SDK appends "/chat/completions" itself, so baseURL stops at the deployment.
			return {
				baseURL: `https://${resource}.openai.azure.com/openai/deployments/${modelName}`,
				apiKey,
				queryParams: { 'api-version': apiVersion },
			};
		}
	}
};

// Look up tool name for a tool_call_id by scanning prior assistant tool_calls.
// AI SDK's ToolResultPart requires toolName, which our message format does not carry.
const buildToolNameLookup = (messages: LLMChatMessage[]): Map<string, string> => {
	const map = new Map<string, string>();
	for (const msg of messages as any[]) {
		if (msg?.role === 'assistant' && Array.isArray(msg.tool_calls)) {
			for (const tc of msg.tool_calls) {
				if (tc?.id && tc?.function?.name) map.set(tc.id, tc.function.name);
			}
		}
	}
	return map;
};

const flattenTextContent = (c: any): string => {
	if (typeof c === 'string') return c;
	if (Array.isArray(c)) {
		return c
			.map((p: any) => (p?.type === 'text' && typeof p?.text === 'string') ? p.text : '')
			.join('');
	}
	return '';
};

// LLMChatMessage[] -> AI SDK ModelMessage[]. Reasoning blocks (Anthropic-style)
// are intentionally dropped here: aggregators do not accept them on input.
const convertMessagesToModelMessages = (messages: LLMChatMessage[]): ModelMessage[] => {
	const toolNameLookup = buildToolNameLookup(messages);
	const lastIdx = messages.length - 1;
	const out: ModelMessage[] = [];

	for (let i = 0; i < messages.length; i++) {
		const msg = messages[i] as any;
		const isLastAndAssistant = i === lastIdx && msg.role === 'assistant';
		const role = msg.role;

		if (role === 'system' || role === 'developer') {
			const text = flattenTextContent(msg.content) || EMPTY_CONTENT_PLACEHOLDER;
			out.push({ role: 'system', content: text });
			continue;
		}

		if (role === 'user') {
			const content = msg.content;
			if (typeof content === 'string') {
				out.push({ role: 'user', content: content.trim() ? content : EMPTY_CONTENT_PLACEHOLDER });
			} else if (Array.isArray(content)) {
				const parts: any[] = [];
				for (const p of content) {
					if (p?.type === 'text' && typeof p?.text === 'string') {
						parts.push({ type: 'text', text: p.text });
					} else if (p?.type === 'image_url' && p?.image_url?.url) {
						const url: string = p.image_url.url;
						try { parts.push({ type: 'image', image: new URL(url) }); }
						catch { parts.push({ type: 'image', image: url }); }
					}
				}
				if (parts.length === 0) parts.push({ type: 'text', text: EMPTY_CONTENT_PLACEHOLDER });
				out.push({ role: 'user', content: parts });
			} else {
				out.push({ role: 'user', content: EMPTY_CONTENT_PLACEHOLDER });
			}
			continue;
		}

		if (role === 'assistant') {
			const parts: any[] = [];
			const content = msg.content;
			if (typeof content === 'string' && content.length > 0) {
				parts.push({ type: 'text', text: content });
			} else if (Array.isArray(content)) {
				for (const p of content) {
					if (p?.type === 'text' && typeof p?.text === 'string') {
						parts.push({ type: 'text', text: p.text });
					}
					// AnthropicReasoning parts intentionally skipped.
				}
			}
			if (Array.isArray(msg.tool_calls)) {
				for (const tc of msg.tool_calls) {
					let input: any = {};
					try { input = JSON.parse(tc?.function?.arguments ?? '{}'); }
					catch { input = {}; }
					parts.push({
						type: 'tool-call',
						toolCallId: tc?.id ?? generateUuid(),
						toolName: tc?.function?.name ?? '',
						input,
					});
				}
			}
			if (parts.length === 0) {
				out.push({ role: 'assistant', content: isLastAndAssistant ? '' : EMPTY_CONTENT_PLACEHOLDER });
			} else {
				out.push({ role: 'assistant', content: parts });
			}
			continue;
		}

		if (role === 'tool') {
			const callId: string = msg.tool_call_id ?? '';
			const toolName: string = toolNameLookup.get(callId) ?? 'unknown_tool';
			const text = typeof msg.content === 'string' ? msg.content : flattenTextContent(msg.content);
			out.push({
				role: 'tool',
				content: [{
					type: 'tool-result',
					toolCallId: callId,
					toolName,
					output: { type: 'text', value: text || EMPTY_CONTENT_PLACEHOLDER },
				}],
			});
			continue;
		}
	}

	return out;
};

// InternalToolInfo map -> AI SDK ToolSet. No `execute` is provided: we want the
// model's tool_call surfaced via the stream, not auto-executed by the SDK.
const convertToolsToAiSdkToolSet = (allowed: { [k: string]: InternalToolInfo } | null | undefined): ToolSet | undefined => {
	if (!allowed) return undefined;
	const keys = Object.keys(allowed);
	if (keys.length === 0) return undefined;
	const out: ToolSet = {};
	for (const name of keys) {
		const t = allowed[name];
		const properties: Record<string, { description: string; type: 'string' }> = {};
		for (const k of Object.keys(t.params)) {
			properties[k] = { description: t.params[k].description, type: 'string' };
		}
		out[name] = tool({
			description: t.description,
			inputSchema: jsonSchema({
				type: 'object',
				properties,
			} as JSONSchema7),
		});
	}
	return out;
};

export const sendViaAISdk = async (params: SendChatParams_Internal): Promise<void> => {
	const {
		messages,
		onText: onText_,
		onFinalMessage: onFinalMessage_,
		onError,
		settingsOfProvider,
		modelName: modelName_,
		_setAborter,
		providerName,
		chatMode,
		overridesOfModel,
		mcpTools,
		runtimeOptions,
	} = params;

	const caps = getModelCapabilities(providerName, modelName_, overridesOfModel);
	const { modelName, additionalOpenAIPayload, reasoningCapabilities } = caps;

	// Honor `vibeide.llm.assumeNativeTools` for aggregator-synthesized fallbacks.
	const isAggregatorSynthesized = caps.recognizedModelName === '__aggregator_unknown__';
	const specialToolFormat = (runtimeOptions?.assumeNativeTools === false && isAggregatorSynthesized)
		? undefined
		: caps.specialToolFormat;

	// Open-source think-tag reasoning: wrap callbacks to extract <think>...</think>.
	const openSourceThinkTags = (reasoningCapabilities && (reasoningCapabilities as any).openSourceThinkTags) as [string, string] | undefined;
	let onText = onText_;
	let onFinalMessage = onFinalMessage_;
	if (openSourceThinkTags) {
		const wrapped = extractReasoningWrapper(onText, onFinalMessage, openSourceThinkTags);
		onText = wrapped.newOnText;
		onFinalMessage = wrapped.newOnFinalMessage;
	}
	// XML tool fallback when native tools are disabled for this model.
	if (!specialToolFormat) {
		const wrapped = extractXMLToolsWrapper(onText, onFinalMessage, chatMode, mcpTools);
		onText = wrapped.newOnText;
		onFinalMessage = wrapped.newOnFinalMessage;
	}

	let resolved: ResolvedEndpoint;
	try {
		resolved = await resolveEndpoint(providerName as AiSdkProviderName, modelName, settingsOfProvider);
	} catch (e: any) {
		onError({ message: e?.message ?? String(e), fullError: e instanceof Error ? e : null });
		return;
	}
	const { baseURL, apiKey, headers, queryParams } = resolved;
	if (!baseURL) {
		onError({ message: `${providerName}: missing endpoint configuration.`, fullError: null });
		return;
	}

	const provider = createOpenAICompatible({
		name: providerName,
		baseURL,
		apiKey,
		headers,
		queryParams,
		fetch: customFetch as any,
		includeUsage: true,
		transformRequestBody: additionalOpenAIPayload
			? (body) => ({ ...body, ...(additionalOpenAIPayload as Record<string, unknown>) })
			: undefined,
	});

	const modelMessages = convertMessagesToModelMessages(messages);
	// Always offer tools to the SDK. If the upstream doesn't support native
	// function calling it will simply not emit tool_call events, and the
	// extractXMLToolsWrapper above (active when !specialToolFormat) will pick
	// up the XML fallback from text. Gating tools on specialToolFormat caused
	// aggregator-routed models to never see the native channel at all.
	const tools = convertToolsToAiSdkToolSet(availableTools(chatMode, mcpTools) as any);

	// Aggregators: extra hop adds latency. Default 180s.
	const timeoutMs = runtimeOptions?.timeoutMs?.aggregator ?? 180_000;

	const abortController = new AbortController();
	let timeoutFired = false;
	let timeoutDeliveredPartial = false;
	_setAborter(() => abortController.abort());

	// Accumulators
	let fullTextSoFar = '';
	let fullReasoningSoFar = '';
	let toolName = '';
	let toolId = '';
	let toolParamsStr = '';
	let firstTokenReceived = false;
	let firstTokenTimeoutId: ReturnType<typeof setTimeout> | null = null;
	let overallTimeoutId: ReturnType<typeof setTimeout> | null = null;
	let lastFinishReason: string | null = null;

	const clearAllTimers = () => {
		if (firstTokenTimeoutId) { clearTimeout(firstTokenTimeoutId); firstTokenTimeoutId = null; }
		if (overallTimeoutId) { clearTimeout(overallTimeoutId); overallTimeoutId = null; }
	};

	const markFirstToken = () => {
		if (firstTokenReceived) return;
		firstTokenReceived = true;
		if (firstTokenTimeoutId) { clearTimeout(firstTokenTimeoutId); firstTokenTimeoutId = null; }
	};

	const buildPartialToolCallObj = (): RawToolCallObj | undefined => {
		if (!toolName) return undefined;
		return { name: toolName as any, rawParams: {} as RawToolParamsObj, doneParams: [], id: toolId, isDone: false };
	};

	const finalizeToolCall = (): RawToolCallObj | null => {
		if (!toolName) return null;
		let input: unknown;
		try { input = JSON.parse(toolParamsStr || '{}'); }
		catch { return null; }
		if (input === null || typeof input !== 'object') return null;
		const rawParams = input as RawToolParamsObj;
		return {
			id: toolId || generateUuid(),
			name: toolName as any,
			rawParams,
			doneParams: Object.keys(rawParams) as any,
			isDone: true,
		};
	};

	firstTokenTimeoutId = setTimeout(() => {
		if (!firstTokenReceived) abortController.abort(new Error('First-token timeout'));
	}, 30_000);

	overallTimeoutId = setTimeout(() => {
		timeoutFired = true;
		if (fullTextSoFar || fullReasoningSoFar || toolName) {
			timeoutDeliveredPartial = true;
			const tc = finalizeToolCall();
			onFinalMessage({
				fullText: fullTextSoFar,
				fullReasoning: fullReasoningSoFar,
				anthropicReasoning: null,
				...(tc ? { toolCall: tc } : {}),
			});
		} else {
			onError({ message: 'Request timed out.', fullError: null });
		}
		abortController.abort();
	}, timeoutMs);

	try {
		const result = streamText({
			model: provider.chatModel(modelName),
			messages: modelMessages,
			tools,
			toolChoice: tools ? 'auto' : undefined,
			abortSignal: abortController.signal,
			// Recover from case-mismatched tool names emitted by less-disciplined
			// models (e.g. Read_File / READ_FILE instead of read_file). The SDK
			// already throws NoSuchToolError when the canonical lookup fails;
			// retry once against a lowercased name before bubbling up.
			experimental_repairToolCall: async ({ toolCall, tools: registeredTools }) => {
				if (!registeredTools) return null;
				const raw = (toolCall as { toolName?: string }).toolName;
				if (!raw) return null;
				const lowered = raw.toLowerCase();
				if (lowered === raw) return null;
				if (!Object.prototype.hasOwnProperty.call(registeredTools, lowered)) return null;
				return { ...toolCall, toolName: lowered } as typeof toolCall;
			},
		});

		for await (const part of result.fullStream as AsyncIterable<TextStreamPart<any>>) {
			if (timeoutFired) break;

			switch (part.type) {
				case 'text-delta': {
					markFirstToken();
					fullTextSoFar += (part as any).text ?? '';
					onText({ fullText: fullTextSoFar, fullReasoning: fullReasoningSoFar, toolCall: buildPartialToolCallObj() });
					break;
				}
				case 'reasoning-delta': {
					markFirstToken();
					fullReasoningSoFar += (part as any).text ?? '';
					onText({ fullText: fullTextSoFar, fullReasoning: fullReasoningSoFar, toolCall: buildPartialToolCallObj() });
					break;
				}
				case 'tool-input-start': {
					// Single-slot accumulator (parity with existing _sendOpenAICompatibleChat).
					// Additional tool calls in the same response are intentionally ignored
					// — the consumer pipeline downstream only handles one tool per turn.
					if (toolName) break;
					toolName = (part as any).toolName ?? '';
					toolId = (part as any).id ?? '';
					markFirstToken();
					onText({ fullText: fullTextSoFar, fullReasoning: fullReasoningSoFar, toolCall: buildPartialToolCallObj() });
					break;
				}
				case 'tool-input-delta': {
					if (toolId && (part as any).id !== toolId) break;
					toolParamsStr += (part as any).delta ?? '';
					onText({ fullText: fullTextSoFar, fullReasoning: fullReasoningSoFar, toolCall: buildPartialToolCallObj() });
					break;
				}
				case 'tool-call': {
					// SDK delivers the fully-parsed input. Prefer it for the final call;
					// keeps us correct even when tool-input-delta wasn't emitted at all.
					if (!toolName && (part as any).toolName) {
						toolName = (part as any).toolName;
						toolId = (part as any).toolCallId ?? toolId;
					}
					const input = (part as any).input;
					if (input !== undefined) {
						try { toolParamsStr = JSON.stringify(input); }
						catch { /* keep accumulated */ }
					}
					break;
				}
				case 'finish-step':
				case 'finish': {
					lastFinishReason = (part as any).finishReason ?? lastFinishReason;
					break;
				}
				case 'error': {
					throw (part as any).error;
				}
			}
		}

		if (timeoutFired) return;
		clearAllTimers();

		if (!fullTextSoFar && !fullReasoningSoFar && !toolName) {
			onError({
				message: `VibeIDE: Empty response from ${providerName}/${modelName} (reason: ${lastFinishReason ?? 'unknown'}).`,
				fullError: null,
			});
			return;
		}

		const tc = finalizeToolCall();
		onFinalMessage({
			fullText: fullTextSoFar,
			fullReasoning: fullReasoningSoFar,
			anthropicReasoning: null,
			...(tc ? { toolCall: tc } : {}),
		});
	} catch (error: any) {
		clearAllTimers();
		if (timeoutDeliveredPartial) return;
		if (abortController.signal.aborted && !timeoutFired) {
			// User-initiated abort — propagate nothing, the caller already knows.
			return;
		}
		const status = error?.statusCode ?? error?.status;
		if (status === 401) {
			onError({ message: `Invalid ${providerName} API key.`, fullError: error instanceof Error ? error : null });
		} else if (status === 429) {
			const msg = error?.message ?? 'Rate limit exceeded. Please wait a moment before trying again.';
			onError({ message: `Rate limit exceeded: ${msg}`, fullError: error instanceof Error ? error : null });
		} else {
			const msg = error?.message ?? String(error);
			onError({ message: msg, fullError: error instanceof Error ? error : null });
		}
	}
};

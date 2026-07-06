/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Ring-buffer trace of the LLM send path (provider diagnostics, Phase 2).
 *
 * The buffer lives module-level and is only meaningfully populated in the MAIN process
 * (the send path runs there); the renderer reads a snapshot over IPC (`getSendTrace`) —
 * same pattern as the tool-call normalization counters in `xmlToolNormalize.ts`.
 *
 * Events must NEVER carry secrets: `detail` is built from provider names, counts,
 * dispatcher generations and truncated error messages only. The export path additionally
 * runs the snapshot through secret redaction as a second line of defense.
 */

export type LlmSendTraceKind =
	| 'providers-sync'      // dynamic providers registered into this process's caps registry
	| 'client-cache-hit'    // SDK client reused from cache (local providers)
	| 'client-cache-miss'   // SDK client (re)created (local: cached; cloud: per-request)
	| 'clients-reset'       // caches cleared + dispatcher recreated (the «reset clients» action)
	| 'dispatcher-create'   // shared undici pool lazily created
	| 'dispatcher-reset'    // shared undici pool force-recreated
	| 'ipc-send'            // sendLLMMessage request arrived over IPC from the renderer
	| 'aborter-set'         // provider impl installed its abort handle for the request
	| 'first-chunk'         // first streamed content arrived (time-to-first-token point)
	| 'final'               // stream completed with a final message
	| 'error'               // send failed
	| 'abort';              // renderer aborted the request

export interface LlmSendTraceEvent {
	readonly atMs: number;
	readonly kind: LlmSendTraceKind;
	readonly requestId?: string;
	readonly providerName?: string;
	readonly modelName?: string;
	readonly detail?: string;
}

/** Ring capacity: enough to cover several agent turns without growing unbounded. */
export const LLM_SEND_TRACE_CAPACITY = 200;

/** Error details are truncated to keep the ring light and avoid dragging payloads around. */
export const LLM_SEND_TRACE_DETAIL_MAX_CHARS = 200;

const _events: LlmSendTraceEvent[] = [];

/** Append an event, evicting the oldest once capacity is reached. `atMs` is injectable for tests. */
export function traceSendEvent(event: Omit<LlmSendTraceEvent, 'atMs'>, atMs: number = Date.now()): void {
	const detail = event.detail !== undefined && event.detail.length > LLM_SEND_TRACE_DETAIL_MAX_CHARS
		? event.detail.slice(0, LLM_SEND_TRACE_DETAIL_MAX_CHARS) + '…'
		: event.detail;
	_events.push({ ...event, ...(detail !== undefined ? { detail } : {}), atMs });
	if (_events.length > LLM_SEND_TRACE_CAPACITY) { _events.shift(); }
}

/** Snapshot oldest → newest. */
export function getSendTrace(): readonly LlmSendTraceEvent[] {
	return [..._events];
}

export function clearSendTrace(): void {
	_events.length = 0;
}

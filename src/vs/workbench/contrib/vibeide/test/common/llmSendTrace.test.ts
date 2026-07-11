/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import * as assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { traceSendEvent, getSendTrace, clearSendTrace, LLM_SEND_TRACE_CAPACITY, LLM_SEND_TRACE_DETAIL_MAX_CHARS } from '../../common/llmSendTrace.js';

suite('llmSendTrace — send-path ring buffer (provider diagnostics Phase 2)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	setup(() => clearSendTrace());
	teardown(() => clearSendTrace());

	test('push + snapshot round-trip, oldest → newest, atMs injectable', () => {
		traceSendEvent({ kind: 'ipc-send', requestId: 'r1', providerName: 'openai', modelName: 'gpt-4o' }, 100);
		traceSendEvent({ kind: 'first-chunk', requestId: 'r1' }, 250);
		assert.deepStrictEqual(getSendTrace(), [
			{ kind: 'ipc-send', requestId: 'r1', providerName: 'openai', modelName: 'gpt-4o', atMs: 100 },
			{ kind: 'first-chunk', requestId: 'r1', atMs: 250 },
		]);
	});

	test('ring evicts oldest beyond capacity', () => {
		for (let i = 0; i < LLM_SEND_TRACE_CAPACITY + 5; i++) {
			traceSendEvent({ kind: 'client-cache-hit', detail: `n${i}` }, i);
		}
		const snap = getSendTrace();
		assert.deepStrictEqual(
			[snap.length, snap[0].detail, snap[snap.length - 1].detail],
			[LLM_SEND_TRACE_CAPACITY, 'n5', `n${LLM_SEND_TRACE_CAPACITY + 4}`],
		);
	});

	test('long detail is truncated with ellipsis; snapshot is a copy; clear empties', () => {
		traceSendEvent({ kind: 'error', detail: 'x'.repeat(LLM_SEND_TRACE_DETAIL_MAX_CHARS + 50) }, 1);
		const snap = getSendTrace();
		clearSendTrace();
		assert.deepStrictEqual(
			[snap[0].detail, getSendTrace().length],
			['x'.repeat(LLM_SEND_TRACE_DETAIL_MAX_CHARS) + '…', 0],
		);
	});
});

/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 VibeIDE Team. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { trimThreadMessages } from '../../common/chatThreadTrim.js';
import type { ChatMessage } from '../../common/chatThreadServiceTypes.js';

// Minimal builders — the trim only reads `m.role`; identity is tagged via content.
const user = (tag: string) => ({ role: 'user', content: tag } as unknown as ChatMessage);
const asst = (tag: string) => ({ role: 'assistant', displayContent: tag } as unknown as ChatMessage);
const tool = (tag: string) => ({ role: 'tool', content: tag } as unknown as ChatMessage);
const isMarker = (m: ChatMessage) => m.role === 'assistant' && typeof (m as { displayContent?: string }).displayContent === 'string' && (m as { displayContent: string }).displayContent.includes('trimmed from thread');
const assts = (n: number, prefix = 'a') => Array.from({ length: n }, (_, i) => asst(`${prefix}${i}`));

// `cap`/`target` are floored at 100 (matches the `maxMessagesPerThread` setting minimum),
// so tests use cap=200, headroom=100 -> target=100, with ~210-message threads.
const CAP = 200, HEADROOM = 100;

suite('trimThreadMessages — bound thread memory, pin original task (model-stalls #012)', () => {

	test('returns null when length <= cap', () => {
		assert.strictEqual(trimThreadMessages([user('task'), ...assts(150)], CAP, HEADROOM), null);
	});

	test('trims oldest down to target with a marker at the head', () => {
		const msgs = [user('task'), ...assts(209)]; // 210 -> dropCount = 210 - 100 = 110
		const r = trimThreadMessages(msgs, CAP, HEADROOM)!;
		assert.ok(r, 'should trim');
		assert.strictEqual(r.target, 100);
		assert.strictEqual(r.dropCount, 110);
		assert.strictEqual(r.trimmed.length, 102); // [anchor, marker, ...tail(100)]
		assert.ok(isMarker(r.trimmed[1]), 'marker is second (after the pinned anchor)');
	});

	test('pins the FIRST user message at the head when it would be dropped', () => {
		const anchor = user('THE TASK');
		const r = trimThreadMessages([anchor, ...assts(209)], CAP, HEADROOM)!;
		assert.strictEqual(r.pinnedAnchor, true);
		assert.strictEqual(r.trimmed[0], anchor, 'anchor object re-pinned at head (same reference)');
		assert.strictEqual(r.trimmed.filter(m => m === anchor).length, 1, 'anchor appears exactly once');
	});

	test('does NOT duplicate the first user message when it already survives in the tail', () => {
		const anchor = user('late task'); // index 150 >= dropCount(110) -> already in tail
		const msgs = [...assts(150), anchor, ...assts(59, 'b')]; // 210
		const r = trimThreadMessages(msgs, CAP, HEADROOM)!;
		assert.strictEqual(r.pinnedAnchor, false);
		assert.strictEqual(r.trimmed.filter(m => m === anchor).length, 1, 'anchor present once (in tail)');
		assert.ok(isMarker(r.trimmed[0]), 'marker is the head when nothing pinned');
	});

	test('no user message at all -> just marker + tail, no pin', () => {
		const r = trimThreadMessages(assts(210), CAP, HEADROOM)!;
		assert.strictEqual(r.pinnedAnchor, false);
		assert.ok(isMarker(r.trimmed[0]));
		assert.strictEqual(r.trimmed.length, 101); // marker + tail(100)
	});

	test('orphan tool result in the dropped region is tolerated (pin still works)', () => {
		const anchor = user('task');
		const mixed = assts(209).map((m, i) => (i === 50 ? tool('t50') : m));
		const r = trimThreadMessages([anchor, ...mixed], CAP, HEADROOM)!;
		assert.strictEqual(r.trimmed[0], anchor);
		assert.ok(isMarker(r.trimmed[1]));
	});

	test('repeated trims stay bounded and keep pinning the same anchor', () => {
		const anchor = user('original');
		let msgs: ChatMessage[] = [anchor, ...assts(209)];
		for (let round = 0; round < 5; round++) {
			const r = trimThreadMessages(msgs, CAP, HEADROOM);
			if (r) { msgs = r.trimmed; }
			msgs = [...msgs, ...assts(50, `r${round}_`)]; // session keeps appending
		}
		assert.ok(msgs.length <= CAP + 50, `bounded, got ${msgs.length}`);
		assert.strictEqual(msgs.filter(m => m === anchor).length, 1, 'original task survived all trims, once');
		assert.strictEqual(msgs[0], anchor, 'original task stays at head');
	});

	test('clamps absurd cap/headroom (cap floored at 100)', () => {
		const r = trimThreadMessages(assts(250), 5, 1)!; // cap 5 -> 100, so 250 > 100 trims
		assert.ok(r, 'clamped cap still trims a 250-message thread');
		assert.ok(r.target >= 100);
	});
});

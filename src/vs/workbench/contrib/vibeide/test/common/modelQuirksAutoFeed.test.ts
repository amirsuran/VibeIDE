/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import * as assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { parseQuirkAutoFeedState, recordAutoDowngrade, shouldSuggestDurableXml, markSuggested, buildCatalogRuleSnippet, QuirkAutoFeedState } from '../../common/modelQuirksAutoFeed.js';

const KEY = 'openRouter:minimax-m3';

suite('modelQuirksAutoFeed — cross-session downgrade signature (roadmap O.13)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('record: session dedup — three events in one session count as one session', () => {
		let s: QuirkAutoFeedState = {};
		s = recordAutoDowngrade(s, KEY, 'sess-1', 100);
		s = recordAutoDowngrade(s, KEY, 'sess-1', 200);
		s = recordAutoDowngrade(s, KEY, 'sess-1', 300);
		assert.deepStrictEqual(s[KEY], { downgradeCount: 3, sessionCount: 1, lastSessionId: 'sess-1', lastAtMs: 300, suggested: false });
	});

	test('suggest fires only at minSessions distinct sessions; markSuggested silences forever', () => {
		let s: QuirkAutoFeedState = {};
		s = recordAutoDowngrade(s, KEY, 'sess-1', 100);
		const afterOne = shouldSuggestDurableXml(s[KEY], 2);
		s = recordAutoDowngrade(s, KEY, 'sess-2', 200);
		const afterTwo = shouldSuggestDurableXml(s[KEY], 2);
		s = markSuggested(s, KEY);
		s = recordAutoDowngrade(s, KEY, 'sess-3', 300);
		const afterSuggested = shouldSuggestDurableXml(s[KEY], 2);
		assert.deepStrictEqual([afterOne, afterTwo, afterSuggested], [false, true, false]);
	});

	test('parse: JSON round-trip survives; corrupt or alien blobs reset to empty', () => {
		let s: QuirkAutoFeedState = {};
		s = recordAutoDowngrade(s, KEY, 'sess-1', 100);
		assert.deepStrictEqual(
			[parseQuirkAutoFeedState(JSON.stringify(s)), parseQuirkAutoFeedState('{oops'), parseQuirkAutoFeedState('[1,2]'), parseQuirkAutoFeedState(undefined), parseQuirkAutoFeedState(JSON.stringify({ bad: { downgradeCount: 'x' } }))],
			[s, {}, {}, {}, {}],
		);
	});

	test('catalog snippet: lower-cased match, provider scope, xml format, evidence in note', () => {
		const stat = { downgradeCount: 5, sessionCount: 2, lastSessionId: 's', lastAtMs: 1, suggested: true };
		const rule = JSON.parse(buildCatalogRuleSnippet('openRouter', 'MiniMax-M3', stat));
		assert.deepStrictEqual(
			[rule.match, rule.provider, rule.forceToolCallFormat, /2 distinct sessions \(5 events\)/.test(rule.note)],
			['minimax-m3', 'openRouter', 'xml', true],
		);
	});
});

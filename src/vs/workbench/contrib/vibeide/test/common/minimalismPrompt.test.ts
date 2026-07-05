/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import * as assert from 'assert';
import { minimalismBlock } from '../../common/prompt/prompts.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

suite('minimalismBlock — code-minimalism discipline prompt', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('off → no block', () => {
		assert.strictEqual(minimalismBlock('off'), null);
	});

	test('lite → reuse-first block without the ladder or vibe-later marker', () => {
		const block = minimalismBlock('lite')!;
		assert.deepStrictEqual([
			block.includes('<code_minimalism level="lite">'),
			block.includes('YAGNI'),
			block.includes('vibe-later'),
			block.includes('walk this ladder'),
			block.includes('never trimmed'),
			block.includes('.vibe/rules'),
		], [true, true, false, false, true, true]);
	});

	test('full → ladder + vibe-later marker, no ultra pressure', () => {
		const block = minimalismBlock('full')!;
		assert.deepStrictEqual([
			block.includes('<code_minimalism level="full">'),
			block.includes('walk this ladder'),
			block.includes('vibe-later:'),
			block.includes('Challenge every requirement'),
			block.includes('never trimmed'),
			block.includes('.vibe/rules'),
		], [true, true, true, false, true, true]);
	});

	test('ultra → ladder + smallest-reviewable-diff pressure', () => {
		const block = minimalismBlock('ultra')!;
		assert.deepStrictEqual([
			block.includes('<code_minimalism level="ultra">'),
			block.includes('walk this ladder'),
			block.includes('vibe-later:'),
			block.includes('Challenge every requirement'),
			block.includes('smallest reviewable diff'),
		], [true, true, true, true, true]);
	});
});

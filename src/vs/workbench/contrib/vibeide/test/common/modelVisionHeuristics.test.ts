/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import * as assert from 'assert';
import { isModelVisionCapable, isVisionByNameHeuristic } from '../../common/modelVisionHeuristics.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

suite('modelVisionHeuristics — isModelVisionCapable', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('catalog supportsVision is authoritative (explicit false beats a vision-looking name)', () => {
		assert.deepStrictEqual(
			[
				isModelVisionCapable({ providerName: 'openRouter', modelName: 'some/gpt-4o-clone' }, { supportsVision: false }),
				isModelVisionCapable({ providerName: 'openAICompatible', modelName: 'text-only-x' }, { supportsVision: true }),
			],
			[false, true],
		);
	});

	test('provider knowledge without a catalog flag: Gemini yes, MiniMax M2 no, MiniMax M3 yes', () => {
		assert.deepStrictEqual(
			[
				isModelVisionCapable({ providerName: 'gemini', modelName: 'gemini-2.0-flash' }, undefined),
				isModelVisionCapable({ providerName: 'minimax', modelName: 'MiniMax-M2.7' }, undefined),
				isModelVisionCapable({ providerName: 'minimax', modelName: 'MiniMax-M3' }, undefined),
				isModelVisionCapable({ providerName: 'anthropic', modelName: 'claude-sonnet-5' }, undefined),
			],
			[true, false, true, true],
		);
	});

	test('name heuristic stays the substring whitelist', () => {
		assert.deepStrictEqual(
			[isVisionByNameHeuristic('minimax-m3'), isVisionByNameHeuristic('minimax-m2.7'), isVisionByNameHeuristic('pixtral-12b')],
			[true, false, true],
		);
	});
});

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import * as assert from 'assert';
import { isContinuationRequest, buildScoutGoal } from '../../common/scoutTrigger.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

suite('Vibe Agents — scout trigger', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('continuation markers fire; plain self-contained requests do not', () => {
		assert.deepStrictEqual(
			[
				'продолжи', 'продолжай с того же места', 'дальше', 'доделай форму', 'заверши начатое',
				'continue', 'keep going', 'finish it',
			].map(isContinuationRequest),
			[true, true, true, true, true, true, true, true],
		);
		assert.deepStrictEqual(
			['добавь кнопку логина', 'почини баг в парсере', 'запусти тесты', 'напиши функцию сортировки'].map(isContinuationRequest),
			[false, false, false, false],
		);
	});

	test('scout goal includes changed files, plan, and always asks for leads + hypothesis', () => {
		const withContext = buildScoutGoal('продолжи', ['src/a.ts', 'src/b.ts'], 'Шаг 2 из 3 не завершён');
		const noContext = buildScoutGoal('продолжи', [], undefined);
		assert.deepStrictEqual(
			{
				withHasFiles: withContext.includes('src/a.ts, src/b.ts'),
				withHasPlan: withContext.includes('Шаг 2 из 3'),
				withAsksLeads: withContext.includes('гипотезу'),
				noContextFallback: noContext.includes('Явного контекста'),
				noContextAsksLeads: noContext.includes('гипотезу'),
			},
			{ withHasFiles: true, withHasPlan: true, withAsksLeads: true, noContextFallback: true, noContextAsksLeads: true },
		);
	});
});

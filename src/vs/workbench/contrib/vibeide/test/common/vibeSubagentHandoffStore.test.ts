/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import * as assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { buildResumeGoal } from '../../common/vibeSubagentHandoffStore.js';

suite('vibeSubagentHandoffStore — buildResumeGoal', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('no partial → plain goal; partial → appends «already done» preamble; blank partial ignored', () => {
		assert.deepStrictEqual(
			[
				buildResumeGoal('добавить OAuth', 'Бэкенд', ''),
				buildResumeGoal('добавить OAuth', 'Бэкенд', '   '),
				buildResumeGoal('добавить OAuth', 'Бэкенд', 'создал routes, осталось middleware'),
			],
			[
				'Роль: Бэкенд. Задача: добавить OAuth',
				'Роль: Бэкенд. Задача: добавить OAuth',
				'Роль: Бэкенд. Задача: добавить OAuth\n\nУже сделано ранее (продолжи с этого места, НЕ начинай заново):\nсоздал routes, осталось middleware',
			],
		);
	});
});

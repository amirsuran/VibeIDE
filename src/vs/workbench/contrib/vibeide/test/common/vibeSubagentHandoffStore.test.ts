/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import * as assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { buildResumeGoal, escalateResumeQuota, gcTickets, reconcileStaleResumed, SubagentHandoffTicket } from '../../common/vibeSubagentHandoffStore.js';

function ticket(over: Partial<SubagentHandoffTicket>): SubagentHandoffTicket {
	return {
		id: 'id', createdAt: 0, updatedAt: 0, status: 'open', parentThreadId: 't', role: 'backend-dev',
		taskText: 'x', partialSummary: '', artifacts: [], stopReason: '', tokensUsed: 0, resumeCount: 0,
		...over,
	};
}

suite('vibeSubagentHandoffStore — pure helpers', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('buildResumeGoal: plain / prior context / partial / both; blank partial ignored', () => {
		assert.deepStrictEqual(
			[
				buildResumeGoal('добавить OAuth', 'Бэкенд', ''),
				buildResumeGoal('добавить OAuth', 'Бэкенд', '   '),
				buildResumeGoal('добавить OAuth', 'Бэкенд', 'создал routes'),
				buildResumeGoal('добавить OAuth', 'Бэкенд', 'создал routes', 'дизайн готов'),
			],
			[
				'Роль: Бэкенд. Задача: добавить OAuth',
				'Роль: Бэкенд. Задача: добавить OAuth',
				'Роль: Бэкенд. Задача: добавить OAuth\n\nУже сделано ранее (продолжи с этого места, НЕ начинай заново):\nсоздал routes',
				'Роль: Бэкенд. Задача: добавить OAuth\n\nКонтекст от предыдущего этапа:\nдизайн готов\n\nУже сделано ранее (продолжи с этого места, НЕ начинай заново):\nсоздал routes',
			],
		);
	});

	test('escalateResumeQuota: initial spawn = base; factor^n growth; capped at 4×; factor clamped to [1..3]', () => {
		assert.deepStrictEqual(
			[
				escalateResumeQuota(100_000, 0, 1.5),
				escalateResumeQuota(100_000, 1, 1.5),
				escalateResumeQuota(100_000, 2, 1.5),
				escalateResumeQuota(100_000, 10, 1.5), // 1.5^10 ≈ 57.7 → cap 4×
				escalateResumeQuota(100_000, 5, 0.1),  // factor clamped up to 1 → base
				escalateResumeQuota(100_000, 1, 99),   // factor clamped down to 3
			],
			[100_000, 150_000, 225_000, 400_000, 100_000, 300_000],
		);
	});

	test('gcTickets: TTL prune + cap keeps newest; reconcileStaleResumed flips resumed→open', () => {
		const now = 20 * 24 * 60 * 60 * 1000; // day 20
		const fresh = ticket({ id: 'fresh', updatedAt: now - 1000 });
		const stale = ticket({ id: 'stale', updatedAt: now - 15 * 24 * 60 * 60 * 1000 }); // older than 14d
		const many = Array.from({ length: 60 }, (_, i) => ticket({ id: `m${i}`, updatedAt: now - i }));
		assert.deepStrictEqual(
			[
				gcTickets([fresh, stale], now).map(t => t.id),
				gcTickets(many, now).length,
				reconcileStaleResumed([ticket({ id: 'a', status: 'resumed' }), ticket({ id: 'b', status: 'open' })]).map(t => t.status),
			],
			[['fresh'], 50, ['open', 'open']],
		);
	});
});

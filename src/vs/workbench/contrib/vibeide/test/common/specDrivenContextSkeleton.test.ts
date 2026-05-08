/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 VibeIDE Team. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import {
	diffSpecHeuristic,
	diffOpenApi,
	diffGraphql,
	describeSeverity,
	SpecDrivenContextNotImplementedError,
} from '../../common/specDrivenContextSkeleton.js';

suite('VibeSpecDrivenContextService — heuristic + sentinels', () => {

	suite('diffSpecHeuristic', () => {
		test('identical inputs → no entries', () => {
			const r = diffSpecHeuristic({ kind: 'openapi', oldText: 'paths: {}', newText: 'paths: {}' });
			assert.deepStrictEqual(r.entries, []);
			assert.strictEqual(r.hasBreaking, false);
		});

		test('shrink >20% → major', () => {
			const r = diffSpecHeuristic({
				kind: 'openapi',
				oldText: 'a'.repeat(1000),
				newText: 'a'.repeat(500),
			});
			assert.strictEqual(r.entries.length, 1);
			assert.strictEqual(r.entries[0].severity, 'major');
			assert.strictEqual(r.hasBreaking, true);
		});

		test('grow >3x → minor', () => {
			const r = diffSpecHeuristic({
				kind: 'graphql',
				oldText: 'a'.repeat(100),
				newText: 'a'.repeat(500),
			});
			assert.strictEqual(r.entries[0].severity, 'minor');
			assert.strictEqual(r.hasBreaking, false);
		});

		test('small change → patch', () => {
			const r = diffSpecHeuristic({
				kind: 'openapi',
				oldText: 'a'.repeat(100),
				newText: 'b'.repeat(100),
			});
			assert.strictEqual(r.entries[0].severity, 'patch');
		});

		test('empty old text → unknown, not breaking', () => {
			const r = diffSpecHeuristic({ kind: 'openapi', oldText: '', newText: 'x' });
			assert.strictEqual(r.entries[0].severity, 'unknown');
			assert.strictEqual(r.hasBreaking, false);
		});

		test('empty new text → unknown, breaking (full removal)', () => {
			const r = diffSpecHeuristic({ kind: 'openapi', oldText: 'x', newText: '' });
			assert.strictEqual(r.entries[0].severity, 'unknown');
			assert.strictEqual(r.hasBreaking, true);
		});

		test('kind forwarded to entry', () => {
			const r = diffSpecHeuristic({
				kind: 'graphql',
				oldText: 'a'.repeat(100),
				newText: 'b'.repeat(100),
			});
			assert.strictEqual(r.entries[0].kind, 'graphql');
		});

		test('boundary 20% shrink not yet major', () => {
			const r = diffSpecHeuristic({
				kind: 'openapi',
				oldText: 'a'.repeat(100),
				newText: 'a'.repeat(85),
			});
			assert.strictEqual(r.entries[0].severity, 'patch');
		});

		test('exactly 80% size = boundary → not major', () => {
			const r = diffSpecHeuristic({
				kind: 'openapi',
				oldText: 'a'.repeat(100),
				newText: 'a'.repeat(80),
			});
			assert.notStrictEqual(r.entries[0].severity, 'major');
		});
	});

	suite('sentinel real-impl stubs', () => {
		test('diffOpenApi throws sentinel', () => {
			assert.throws(
				() => diffOpenApi({ oldSpec: 'a', newSpec: 'b' }),
				SpecDrivenContextNotImplementedError,
			);
		});

		test('diffGraphql throws sentinel', () => {
			assert.throws(
				() => diffGraphql({ oldSpec: 'a', newSpec: 'b' }),
				SpecDrivenContextNotImplementedError,
			);
		});

		test('sentinel message references roadmap section + npm packages', () => {
			let captured: unknown;
			try {
				diffOpenApi({ oldSpec: 'a', newSpec: 'b' });
			} catch (e) {
				captured = e;
			}
			assert.ok(captured instanceof SpecDrivenContextNotImplementedError);
			const msg = (captured as Error).message;
			assert.ok(msg.includes('roadmap'));
			assert.ok(msg.includes('swagger-parser'));
			assert.ok(msg.includes('graphql'));
		});
	});

	suite('describeSeverity', () => {
		test('all four severities have RU labels', () => {
			assert.ok(describeSeverity('major').length > 0);
			assert.ok(describeSeverity('minor').length > 0);
			assert.ok(describeSeverity('patch').length > 0);
			assert.ok(describeSeverity('unknown').length > 0);
		});

		test('major label mentions критич', () => {
			assert.ok(describeSeverity('major').toLowerCase().includes('критич'));
		});
	});
});

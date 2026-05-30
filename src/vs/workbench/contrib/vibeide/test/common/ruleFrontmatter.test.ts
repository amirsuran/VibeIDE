/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 VibeIDE Team. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { parseRuleFrontmatter, isRuleFileName, isAlwaysApply, parseAlwaysApply, parseTriggers, parseGlobs, matchesAnyTrigger, decideRuleActivation } from '../../common/prompt/ruleFrontmatter.js';

suite('ruleFrontmatter — .mdc frontmatter parsing (R.1)', () => {

	test('no frontmatter → empty meta, body unchanged', () => {
		const r = parseRuleFrontmatter('# Rule\n\nDo the thing.');
		assert.deepStrictEqual(r.frontmatter, {});
		assert.strictEqual(r.body, '# Rule\n\nDo the thing.');
	});

	test('parses frontmatter and strips it from body', () => {
		const r = parseRuleFrontmatter('---\ndescription: When editing TS\nglobs: src/**/*.ts\nalwaysApply: true\n---\nUse tabs.');
		assert.strictEqual(r.frontmatter['description'], 'When editing TS');
		assert.strictEqual(r.frontmatter['globs'], 'src/**/*.ts');
		assert.strictEqual(r.frontmatter['alwaysapply'], 'true');
		assert.strictEqual(r.body, 'Use tabs.');
	});

	test('CRLF line endings tolerated', () => {
		const r = parseRuleFrontmatter('---\r\ndescription: x\r\n---\r\nbody');
		assert.strictEqual(r.frontmatter['description'], 'x');
		assert.strictEqual(r.body, 'body');
	});

	test('frontmatter NOT at start is not parsed (body kept verbatim)', () => {
		const content = 'intro\n---\ndescription: x\n---\nbody';
		const r = parseRuleFrontmatter(content);
		assert.deepStrictEqual(r.frontmatter, {});
		assert.strictEqual(r.body, content);
	});

	test('empty frontmatter block → empty meta, body after', () => {
		const r = parseRuleFrontmatter('---\n\n---\nbody');
		assert.deepStrictEqual(r.frontmatter, {});
		assert.strictEqual(r.body, 'body');
	});

	test('isAlwaysApply: true / false / absent / mixed-case', () => {
		assert.strictEqual(isAlwaysApply({ alwaysapply: 'true' }), true);
		assert.strictEqual(isAlwaysApply({ alwaysapply: 'TRUE' }), true);
		assert.strictEqual(isAlwaysApply({ alwaysapply: 'false' }), false);
		assert.strictEqual(isAlwaysApply({}), false);
	});

	test('isRuleFileName matches .md/.mdc, rejects others', () => {
		assert.strictEqual(isRuleFileName('dev-engine.mdc'), true);
		assert.strictEqual(isRuleFileName('rules.md'), true);
		assert.strictEqual(isRuleFileName('RULES.MD'), true);
		assert.strictEqual(isRuleFileName('notes.txt'), false);
		assert.strictEqual(isRuleFileName('script.mdc.bak'), false);
	});
});

suite('ruleFrontmatter — activation engine (R.7 / R.3)', () => {

	test('parseAlwaysApply tri-state: true / false / absent', () => {
		assert.strictEqual(parseAlwaysApply({ alwaysapply: 'true' }), true);
		assert.strictEqual(parseAlwaysApply({ alwaysapply: 'false' }), false);
		assert.strictEqual(parseAlwaysApply({}), undefined);
	});

	test('parseTriggers: quoted/unquoted, comma-separated, lowercased', () => {
		assert.deepStrictEqual(parseTriggers({ triggers: '"Deploy", "CI", release' }), ['deploy', 'ci', 'release']);
		assert.deepStrictEqual(parseTriggers({}), []);
		assert.deepStrictEqual(parseTriggers({ triggers: ' , "" , x ' }), ['x']);
	});

	test('parseGlobs: case preserved, quotes stripped', () => {
		assert.deepStrictEqual(parseGlobs({ globs: 'src/**/*.ts, "*.TSX"' }), ['src/**/*.ts', '*.TSX']);
	});

	test('matchesAnyTrigger: whole-word, case-insensitive, no partial match', () => {
		assert.strictEqual(matchesAnyTrigger(['deploy'], 'please deploy now'), true);
		assert.strictEqual(matchesAnyTrigger(['deploy'], 'PLEASE DEPLOY NOW'), true);
		assert.strictEqual(matchesAnyTrigger(['cat'], 'category theory'), false); // not a partial match
		assert.strictEqual(matchesAnyTrigger(['ci'], 'fix the build'), false);
	});

	test('matchesAnyTrigger: Cyrillic word boundary works', () => {
		assert.strictEqual(matchesAnyTrigger(['релиз'], 'готовим релиз сегодня'), true);
		assert.strictEqual(matchesAnyTrigger(['релиз'], 'релизный процесс'), false); // релизный ≠ релиз
	});

	test('decideRuleActivation: alwaysApply true → inject', () => {
		assert.strictEqual(decideRuleActivation({ alwaysApply: true, triggers: [], globs: [] }, undefined), 'inject');
	});

	test('decideRuleActivation: triggers match → inject, miss → index', () => {
		assert.strictEqual(decideRuleActivation({ alwaysApply: false, triggers: ['deploy'], globs: [] }, 'time to deploy'), 'inject');
		assert.strictEqual(decideRuleActivation({ alwaysApply: false, triggers: ['deploy'], globs: [] }, 'hello world'), 'index');
	});

	test('decideRuleActivation: alwaysApply:false without match → index (agent-requested)', () => {
		assert.strictEqual(decideRuleActivation({ alwaysApply: false, triggers: [], globs: [] }, 'anything'), 'index');
	});

	test('decideRuleActivation: globs-only unmatched → index (until R.2)', () => {
		assert.strictEqual(decideRuleActivation({ alwaysApply: undefined, triggers: [], globs: ['*.ts'] }, 'x'), 'index');
	});

	test('decideRuleActivation: plain rule (no frontmatter) → inject (back-compat)', () => {
		assert.strictEqual(decideRuleActivation({ alwaysApply: undefined, triggers: [], globs: [] }, undefined), 'inject');
	});
});

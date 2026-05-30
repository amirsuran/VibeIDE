/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 VibeIDE Team. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { parseRuleFrontmatter, isRuleFileName, isAlwaysApply } from '../../common/prompt/ruleFrontmatter.js';

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

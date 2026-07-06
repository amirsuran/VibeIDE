/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import * as assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { resolveToolClass, toolMatchesPlanHints } from '../../common/planToolDrift.js';

suite('planToolDrift — классовая эквивалентность тулов плана', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('resolveToolClass: builtin по карте approval, свободные имена по эвристике', () => {
		assert.deepStrictEqual(
			[
				resolveToolClass('edit_file'), resolveToolClass('rewrite_file'), resolveToolClass('create_file_or_folder'),
				resolveToolClass('run_command'), resolveToolClass('read_file'), resolveToolClass('grep'),
				// free-form planner spellings
				resolveToolClass('write_file'), resolveToolClass('run_terminal_command'), resolveToolClass('bash'),
				resolveToolClass('list_dir'), resolveToolClass('semantic_search'), resolveToolClass('какой-то-туул'),
			],
			['edits', 'edits', 'edits', 'terminal', 'read', 'read', 'edits', 'terminal', 'terminal', 'read', 'read', 'unknown'],
		);
	});

	test('матчинг: кейс из бага — план ждал edit_file, агент вызвал rewrite_file → совпадение по классу', () => {
		assert.deepStrictEqual(
			[
				toolMatchesPlanHints('rewrite_file', ['edit_file']),               // the reported bug case
				toolMatchesPlanHints('run_command', ['run_terminal_command']),      // substring already covered; class is the safety net
				toolMatchesPlanHints('create_file_or_folder', ['write_file']),      // both are edits
				toolMatchesPlanHints('rewrite_file', ['run_command']),              // cross-class — must NOT match
				toolMatchesPlanHints('read_file', ['edit_file']),                   // builtin read-only is always allowed
				toolMatchesPlanHints('edit_file', undefined),                        // no hints — anything goes
				toolMatchesPlanHints('edit_file', ['edit_file']),                   // exact
			],
			[true, true, true, false, true, true, true],
		);
	});

	test('MCP/не-builtin тулы классом не матчатся — только явное имя (строгость сохранена)', () => {
		assert.deepStrictEqual(
			[
				toolMatchesPlanHints('mcp_create_issue', ['edit_file']),   // class equivalence is not applied to non-builtin
				toolMatchesPlanHints('mcp_create_issue', ['mcp_create_issue']), // explicit name — ok
			],
			[false, true],
		);
	});
});

/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { suite, test } from 'mocha';
import * as assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { detectShellMisuse, truncateHeadTail, countLines, ToolValidationError } from '../../common/toolHardening.js';

suite('ToolHardening', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	suite('detectShellMisuse — file readers', () => {
		test('flags Get-Content', () => {
			const m = detectShellMisuse('Get-Content C:\\foo\\bar.md');
			assert.ok(m);
			assert.strictEqual(m!.suggestedTool, 'read_file');
		});

		test('flags Get-Content alias gc', () => {
			const m = detectShellMisuse('gc somefile.txt');
			assert.ok(m);
			assert.strictEqual(m!.kind, 'read_file');
		});

		test('flags type', () => {
			assert.ok(detectShellMisuse('type README.md'));
		});

		test('flags cat with file', () => {
			assert.ok(detectShellMisuse('cat src/main.ts'));
		});

		test('flags head/tail when not piped', () => {
			assert.ok(detectShellMisuse('head -n 50 src/main.ts'));
			assert.ok(detectShellMisuse('tail -100 logs/app.log'));
		});

		test('does NOT flag head/tail in a pipeline (legit shell hygiene)', () => {
			assert.strictEqual(detectShellMisuse('git log | head -20'), null);
		});
	});

	suite('detectShellMisuse — listing', () => {
		test('flags recursive ls', () => {
			const m = detectShellMisuse('ls -la');
			assert.ok(m);
			assert.strictEqual(m!.suggestedTool, 'ls_dir');
		});

		test('flags dir /s', () => {
			const m = detectShellMisuse('dir /s C:\\proj');
			assert.ok(m);
		});

		test('flags tree', () => {
			const m = detectShellMisuse('tree -L 3');
			assert.ok(m);
			assert.strictEqual(m!.suggestedTool, 'get_dir_tree');
		});

		test('does NOT flag a single-file dir/ls', () => {
			assert.strictEqual(detectShellMisuse('dir package.json'), null);
		});

		// File-existence idiom: `dir /s /b "<path>\file.ext"` is bounded output.
		// Used by aggregator-proxied models (Nemotron/qwen via openCode/zen) as
		// a "does this file exist anywhere under here?" probe. Should be allowed.
		test('does NOT flag dir /s /b with specific file (extension at path end)', () => {
			assert.strictEqual(
				detectShellMisuse('dir /s /b "c:\\Repo\\Promed\\.cursor\\notes\\process.md" 2>nul || echo "File not found"'),
				null,
			);
			assert.strictEqual(detectShellMisuse('dir /s /b file.txt'), null);
		});

		test('still flags dir /s on a directory (no extension on tail token)', () => {
			assert.ok(detectShellMisuse('dir /s C:\\proj'));
			assert.ok(detectShellMisuse('dir /s /b D:\\repo'));
		});

		test('does NOT flag dir /b on a single file (bare format alone is not recursive)', () => {
			assert.strictEqual(detectShellMisuse('dir /b file.md'), null);
		});
	});

	suite('detectShellMisuse — workspace config overrides', () => {
		test('allowedPatterns short-circuits default rules', () => {
			// `grep -r foo .` would normally flag (search_content rule)
			assert.ok(detectShellMisuse('grep -r foo .'));
			// With workspace allowlist entry, it passes through.
			assert.strictEqual(
				detectShellMisuse('grep -r foo .', { allowedPatterns: ['^grep\\s+'] }),
				null,
			);
		});

		test('disableDefaultRules turns off a specific rule by id', () => {
			assert.ok(detectShellMisuse('grep -r foo .'));
			assert.strictEqual(
				detectShellMisuse('grep -r foo .', { disableDefaultRules: ['search_content'] }),
				null,
			);
			// Other rules still active when only one is disabled.
			assert.ok(detectShellMisuse('cat foo.md', { disableDefaultRules: ['search_content'] }));
		});

		test('extraRules adds workspace-specific blocks after defaults', () => {
			const cfg = {
				extraRules: [{
					id: 'block_yarn_install',
					bareName: '^yarn$',
					requires: { tailMatches: '^install\\b' },
					kind: 'edit_file' as const,
					suggestedTool: 'package_manager',
					hint: 'Use the package_manager tool for {bareName}.',
				}],
			};
			assert.ok(detectShellMisuse('yarn install', cfg));
			// Default rules still pass-through when extra rule doesn't match.
			assert.strictEqual(detectShellMisuse('yarn build', cfg), null);
		});

		test('invalid allowedPatterns regex is silently skipped (does not throw)', () => {
			// Unbalanced bracket — should not crash detection.
			const result = detectShellMisuse('grep foo .', { allowedPatterns: ['[invalid('] });
			assert.ok(result); // grep still flagged by default rule
		});
	});

	suite('detectShellMisuse — search', () => {
		test('flags grep', () => {
			const m = detectShellMisuse('grep -r "foo" src/');
			assert.ok(m);
			assert.strictEqual(m!.suggestedTool, 'grep');
		});

		test('flags ripgrep (rg)', () => {
			assert.ok(detectShellMisuse('rg "TODO" --type ts'));
		});

		test('flags findstr', () => {
			assert.ok(detectShellMisuse('findstr /S /I "needle" *.txt'));
		});

		test('flags Select-String / sls', () => {
			assert.ok(detectShellMisuse('Select-String -Pattern "x" -Path *.ts'));
			assert.ok(detectShellMisuse('sls "x" file.txt'));
		});

		test('flags find -name', () => {
			const m = detectShellMisuse('find . -name "*.ts"');
			assert.ok(m);
			assert.strictEqual(m!.suggestedTool, 'glob');
		});
	});

	suite('detectShellMisuse — in-place editors', () => {
		test('flags sed -i', () => {
			const m = detectShellMisuse('sed -i "s/foo/bar/g" file.txt');
			assert.ok(m);
			assert.strictEqual(m!.suggestedTool, 'edit_file');
		});

		test('does NOT flag sed without -i', () => {
			assert.strictEqual(detectShellMisuse('sed "s/x/y/" file.txt | head -5'), null);
		});
	});

	suite('detectShellMisuse — passthrough', () => {
		test('git is allowed', () => {
			assert.strictEqual(detectShellMisuse('git status'), null);
			assert.strictEqual(detectShellMisuse('git log --oneline -20'), null);
		});

		test('npm/pnpm/yarn are allowed', () => {
			assert.strictEqual(detectShellMisuse('npm run build'), null);
			assert.strictEqual(detectShellMisuse('pnpm test --watch'), null);
		});

		test('docker / kubectl are allowed', () => {
			assert.strictEqual(detectShellMisuse('docker compose up'), null);
		});

		test('PowerShell call-operator prefix is stripped before matching', () => {
			assert.ok(detectShellMisuse('& Get-Content foo.md'));
		});

		test('env-var prefix is stripped', () => {
			assert.ok(detectShellMisuse('DEBUG=1 cat config.yaml'));
		});
	});

	suite('truncateHeadTail', () => {
		test('returns unchanged when under cap', () => {
			assert.strictEqual(truncateHeadTail('hello', 100), 'hello');
		});

		test('truncates with marker when over cap', () => {
			const big = 'a'.repeat(1000);
			const out = truncateHeadTail(big, 100);
			assert.ok(out.length <= 100);
			assert.ok(out.includes('[truncated]'));
		});

		test('keeps head and tail content (heuristic)', () => {
			const s = 'HEAD' + 'x'.repeat(500) + 'TAIL';
			const out = truncateHeadTail(s, 80);
			assert.ok(out.startsWith('HEAD'));
			assert.ok(out.endsWith('TAIL'));
		});
	});

	suite('countLines', () => {
		test('zero for empty', () => {
			assert.strictEqual(countLines(''), 0);
		});

		test('1 for single-line no newline', () => {
			assert.strictEqual(countLines('hello'), 1);
		});

		test('counts \\n correctly', () => {
			assert.strictEqual(countLines('a\nb\nc'), 3);
			assert.strictEqual(countLines('a\nb\nc\n'), 4);
		});
	});

	suite('ToolValidationError', () => {
		test('carries code/hint/suggestedTool', () => {
			const e = new ToolValidationError({ code: 'X', message: 'm', hint: 'h', suggestedTool: 't' });
			assert.strictEqual(e.code, 'X');
			assert.strictEqual(e.hint, 'h');
			assert.strictEqual(e.suggestedTool, 't');
			assert.strictEqual(e.name, 'ToolValidationError');
			assert.ok(e instanceof Error);
		});
	});
});

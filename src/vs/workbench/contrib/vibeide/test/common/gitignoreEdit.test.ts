/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import * as assert from 'assert';
import { addGitignoreEntry, buildGitignoreEntry, removeGitignoreEntry } from '../../common/gitignoreEdit.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

suite('VibeIDE — gitignore literal entry editing', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('buildGitignoreEntry anchors, marks directories and escapes glob chars', () => {
		assert.deepStrictEqual(
			[
				buildGitignoreEntry('dist', true),
				buildGitignoreEntry('src/secret.env', false),
				buildGitignoreEntry('weird [1]*.txt', false),
			],
			['/dist/', '/src/secret.env', '/weird \\[1\\]\\*.txt'],
		);
	});

	test('addGitignoreEntry appends, dedupes equivalent spellings and keeps EOL style', () => {
		const add = (content: string, rel: string, dir = false) => addGitignoreEntry(content, rel, buildGitignoreEntry(rel, dir));
		assert.deepStrictEqual(
			[
				add('', 'dist', true),                                  // empty file
				add('node_modules/\n', 'dist', true),                   // append after existing
				add('# comment\ndist/\n', 'dist', true),                // unanchored spelling already present
				add('/dist/\n', 'dist', true),                          // exact entry already present
				add('a\r\nb\r\n', 'dist', true),                        // CRLF preserved
				add('no-trailing-newline', 'dist', true),               // trailing newline guaranteed
			],
			[
				{ content: '/dist/\n', added: true },
				{ content: 'node_modules/\n/dist/\n', added: true },
				{ content: '# comment\ndist/\n', added: false },
				{ content: '/dist/\n', added: false },
				{ content: 'a\r\nb\r\n/dist/\r\n', added: true },
				{ content: 'no-trailing-newline\n/dist/\n', added: true },
			],
		);
	});

	test('removeGitignoreEntry drops all literal spellings, leaves patterns alone', () => {
		assert.deepStrictEqual(
			[
				removeGitignoreEntry('/dist/\n', 'dist'),
				removeGitignoreEntry('# keep\ndist\n/dist/\nother\n', 'dist'),
				removeGitignoreEntry('*.log\nbuild/**\n', 'debug.log'),  // wildcard-ignored → untouched
				removeGitignoreEntry('a\r\n/dist/\r\nb\r\n', 'dist'),    // CRLF preserved
			],
			[
				{ content: '', removed: true },
				{ content: '# keep\nother\n', removed: true },
				{ content: '*.log\nbuild/**\n', removed: false },
				{ content: 'a\r\nb\r\n', removed: true },
			],
		);
	});
});

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import * as assert from 'assert';
import { join } from '../../../../../base/common/path.js';
import { exeAdjacentFilePath, resolveVibeUserDataPath, snapshotCandidatePaths } from '../../common/vibeUserDataPaths.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

suite('VibeIDE — user-data path + snapshot candidates', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('resolveVibeUserDataPath: override, platform defaults, fallbacks', () => {
		assert.deepStrictEqual(
			[
				resolveVibeUserDataPath({ VSCODE_USER_DATA_PATH: '/custom', HOME: '/home/u' }, 'darwin'),  // explicit override wins
				resolveVibeUserDataPath({ HOME: '/Users/u' }, 'darwin'),
				resolveVibeUserDataPath({ APPDATA: 'C:/Users/u/AppData/Roaming' }, 'win32'),
				resolveVibeUserDataPath({ HOME: '/home/u' }, 'linux'),
				resolveVibeUserDataPath({ HOME: '/home/u' }, 'win32'),                                     // win32 without APPDATA → .config branch
				resolveVibeUserDataPath({}, 'darwin'),                                                     // nothing to resolve from
			],
			[
				'/custom',
				join('/Users/u', 'Library', 'Application Support', 'VibeIDE'),
				join('C:/Users/u/AppData/Roaming', 'VibeIDE'),
				join('/home/u', '.config', 'VibeIDE'),
				join('/home/u', '.config', 'VibeIDE'),
				null,
			],
		);
	});

	test('snapshotCandidatePaths: full ordering and per-tier omission', () => {
		const full = snapshotCandidatePaths({ filename: 'x.json', execPath: '/opt/vibe/bin/vibeide', resourcesPath: '/opt/vibe/resources', userDataDir: '/home/u/.config/VibeIDE' });
		assert.deepStrictEqual(full, [
			{ path: join('/opt/vibe/bin', 'x.json'), source: 'exeDir' },
			{ path: join('/opt/vibe/resources', 'app', 'resources', 'vibeide', 'x.json'), source: 'bundled' },
			{ path: join('/opt/vibe/resources', 'vibeide', 'x.json'), source: 'bundled' },
			{ path: join('/home/u/.config/VibeIDE', 'x.json'), source: 'userData' },
		]);
		assert.deepStrictEqual(
			snapshotCandidatePaths({ filename: 'x.json', userDataDir: '/ud' }),
			[{ path: join('/ud', 'x.json'), source: 'userData' }],
		);
		assert.deepStrictEqual(snapshotCandidatePaths({ filename: 'x.json', userDataDir: null }), []);
	});

	test('exeAdjacentFilePath', () => {
		assert.deepStrictEqual(
			[
				exeAdjacentFilePath('/opt/vibe/bin/vibeide', 'model-quirks.json'),
				exeAdjacentFilePath(undefined, 'model-quirks.json'),
			],
			[join('/opt/vibe/bin', 'model-quirks.json'), null],
		);
	});
});

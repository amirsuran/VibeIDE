/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import * as assert from 'assert';
import { detectBusyPort } from '../../common/vibeServer/devServerPortConflict.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

suite('VibeServer — dev-server port conflict detection', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('recognizes framework warnings and EADDRINUSE crashes', () => {
		const cases: Array<[string, number | undefined]> = [
			// Next.js (both phrasings)
			['⚠ Port 3000 is in use, trying 3001 instead.', 3000],
			['Port 3000 is in use, using available port 3001 instead.', 3000],
			// Vite
			['Port 5173 is in use, trying another one...', 5173],
			// Angular CLI
			['Port 4200 is already in use.', 4200],
			// CRA
			['Something is already running on port 3000.', 3000],
			// Bare Node servers
			['Error: listen EADDRINUSE: address already in use 127.0.0.1:3000', 3000],
			['Error: listen EADDRINUSE: address already in use :::8080', 8080],
			// Multi-line chunk: warning buried in other output
			['ready in 300ms\n⚠ Port 3000 is in use, trying 3001 instead.\n', 3000],
			// No conflict
			['▲ Next.js 15.0.0\n- Local: http://localhost:3000', undefined],
			['compiled successfully', undefined],
			// Out-of-range port is ignored
			['Port 99999 is in use, trying another one...', undefined],
		];
		assert.deepStrictEqual(cases.map(([line]) => detectBusyPort(line)), cases.map(([, expected]) => expected));
	});
});

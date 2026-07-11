/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import * as assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { rewriteSetCookieForPreview } from '../../common/vibeServer/setCookieCompat.js';

suite('setCookieCompat — Set-Cookie rewrite for cross-site preview iframe (VS.6)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('rewrites plain, SameSite=Lax/Strict, already-Secure and already-None variants; preserves other attributes', () => {
		assert.deepStrictEqual(
			rewriteSetCookieForPreview([
				'sid=abc123; Path=/; HttpOnly',
				'sid=abc123; Path=/; SameSite=Lax; HttpOnly',
				'sid=abc123; samesite=strict',
				'sid=abc123; Secure; SameSite=None',
				'sid=abc123; Path=/; Max-Age=3600; Domain=localhost; HttpOnly; SameSite=Lax; Secure',
			]),
			[
				'sid=abc123; Path=/; HttpOnly; SameSite=None; Secure',
				'sid=abc123; Path=/; HttpOnly; SameSite=None; Secure',
				'sid=abc123; SameSite=None; Secure',
				'sid=abc123; SameSite=None; Secure',
				'sid=abc123; Path=/; Max-Age=3600; Domain=localhost; HttpOnly; SameSite=None; Secure',
			],
		);
	});

	test('idempotent: rewriting a rewritten header changes nothing', () => {
		const once = rewriteSetCookieForPreview(['token=x; Path=/; SameSite=Lax']);
		assert.deepStrictEqual(rewriteSetCookieForPreview(once), once);
	});

	test('does not mangle values containing the word Secure or SameSite inside cookie value', () => {
		assert.deepStrictEqual(
			rewriteSetCookieForPreview(['note=SameSiteIsFun; Path=/']),
			['note=SameSiteIsFun; Path=/; SameSite=None; Secure'],
		);
	});
});

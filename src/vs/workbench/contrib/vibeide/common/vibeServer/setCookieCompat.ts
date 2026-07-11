/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Set-Cookie rewrite for the Vibe Server preview (roadmap VS.6 «cookie-авторизация»).
 *
 * The preview page lives in a cross-site iframe (top-level is always `vscode-webview://`),
 * so Chromium drops any `Set-Cookie` that is not `SameSite=None; Secure` — dev-site logins
 * silently fail. The electron-main hook (vibeCookieCompatMain.ts) rewrites response
 * cookies of REGISTERED preview origins with this pure helper.
 *
 * Why always the PAIR: `SameSite=None` without `Secure` is rejected outright by Chromium,
 * and a `Secure` cookie IS deliverable over plain http on loopback — 127.0.0.1/localhost
 * are "potentially trustworthy origins" per the Secure Contexts spec.
 */

const SAMESITE_ATTR_RE = /;\s*SameSite\s*=\s*[^;]*/gi;
const SECURE_ATTR_RE = /;\s*Secure\s*(?=;|$)/gi;

/**
 * Rewrite one or more `Set-Cookie` header values to `SameSite=None; Secure`.
 * Idempotent; all other attributes are preserved verbatim.
 */
export function rewriteSetCookieForPreview(values: readonly string[]): string[] {
	return values.map(value => {
		// Strip any existing SameSite/Secure attributes, then append the canonical pair.
		// Stripping-then-appending (vs conditional patching) keeps the result idempotent
		// and immune to attribute-order/casing variations.
		const cleaned = value.replace(SAMESITE_ATTR_RE, '').replace(SECURE_ATTR_RE, '');
		return `${cleaned}; SameSite=None; Secure`;
	});
}

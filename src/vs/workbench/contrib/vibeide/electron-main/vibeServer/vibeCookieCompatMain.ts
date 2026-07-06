/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { vibeLog } from '../../common/vibeLog.js';
import { rewriteSetCookieForPreview } from '../../common/vibeServer/setCookieCompat.js';

/**
 * Cookie compatibility for the Vibe Server preview (roadmap VS.6).
 *
 * The preview iframe is cross-site to its `vscode-webview://` top-level, so Chromium
 * drops dev-site session cookies unless they are `SameSite=None; Secure` — logins on
 * the previewed site silently fail. `maybeRewritePreviewCookies` rewrites `Set-Cookie`
 * response headers via the pure helper, DOUBLE-gated:
 *   1. the request origin must be REGISTERED (a preview tab is actually showing it —
 *      the renderer registers/unregisters over the Vibe Server IPC channel, gated by
 *      the `vibeide.vibeServer.cookieCompat` setting), and
 *   2. the host must be loopback — cookies of anything non-local are never touched.
 * No open preview ⇒ empty registry ⇒ zero-cost pass-through.
 *
 * NOT a standalone `webRequest.onHeadersReceived` registration: Electron allows a single
 * handler per event per session, so a new registration would REPLACE the upstream ones in
 * `app.ts#configureSession()`. Instead this is called from inside the last upstream
 * `onHeadersReceived` handler — safe under both replace and (hypothetical) chain semantics.
 */

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

/** Origins (`http://127.0.0.1:3000`) whose Set-Cookie is being rewritten; value = open-tab refcount. */
const registeredOrigins = new Map<string, number>();
/** One informational log per origin per registration lifetime — proof the mechanism fired, without per-request spam. */
const loggedOrigins = new Set<string>();

function normalizeOrigin(rawUrl: string): string | undefined {
	try {
		const u = new URL(rawUrl);
		if (u.protocol !== 'http:' && u.protocol !== 'https:') { return undefined; }
		if (!LOOPBACK_HOSTS.has(u.hostname)) { return undefined; }
		return u.origin;
	} catch {
		return undefined;
	}
}

/** Renderer-facing: allow Set-Cookie rewriting for a preview URL's origin (loopback-only; refcounted). */
export function registerPreviewOrigin(rawUrl: string): void {
	const origin = normalizeOrigin(rawUrl);
	if (!origin) { return; }
	registeredOrigins.set(origin, (registeredOrigins.get(origin) ?? 0) + 1);
}

/** Renderer-facing: drop a registration when its preview tab closes. */
export function unregisterPreviewOrigin(rawUrl: string): void {
	const origin = normalizeOrigin(rawUrl);
	if (!origin) { return; }
	const count = registeredOrigins.get(origin) ?? 0;
	if (count <= 1) {
		registeredOrigins.delete(origin);
		loggedOrigins.delete(origin);
	} else {
		registeredOrigins.set(origin, count - 1);
	}
}

/** Structural subset of Electron's `OnHeadersReceivedListenerDetails` — keeps this module free of electron imports. */
export interface IHeadersReceivedDetails {
	readonly url: string;
	readonly responseHeaders?: Record<string, string | string[]>;
}

/**
 * Rewrite `Set-Cookie` for a registered loopback preview origin. Returns the patched
 * headers to pass to the webRequest callback, or `undefined` when not applicable.
 */
export function maybeRewritePreviewCookies(details: IHeadersReceivedDetails): Record<string, string | string[]> | undefined {
	if (registeredOrigins.size === 0) { return undefined; }
	const origin = normalizeOrigin(details.url);
	if (!origin || !registeredOrigins.has(origin)) { return undefined; }

	const responseHeaders = details.responseHeaders;
	if (!responseHeaders) { return undefined; }
	// Header casing is not normalized by Electron — match case-insensitively.
	const setCookieKey = Object.keys(responseHeaders).find(k => k.toLowerCase() === 'set-cookie');
	if (!setCookieKey) { return undefined; }
	const raw = responseHeaders[setCookieKey];
	const values = Array.isArray(raw) ? raw : [String(raw)];

	const patched = { ...responseHeaders, [setCookieKey]: rewriteSetCookieForPreview(values) };
	if (!loggedOrigins.has(origin)) {
		loggedOrigins.add(origin);
		vibeLog.info('vibeCookieCompat', `[preview] Set-Cookie rewritten to SameSite=None; Secure for ${origin} (cross-site iframe login fix)`);
	}
	return patched;
}

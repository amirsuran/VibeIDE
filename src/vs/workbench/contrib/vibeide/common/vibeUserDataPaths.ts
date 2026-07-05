/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


/**
 * Single source of truth for "where is the per-user VibeIDE data directory" and the
 * "drop a file next to the exe" snapshot-candidate ordering. Previously copy-pasted
 * across `telemetryStorage.ts`, `modelsDevCatalog.ts` and `modelQuirksService.ts`.
 *
 * Pure functions: the process environment comes in as ARGUMENTS (no `process`, no fs),
 * so the module is common-layer clean and directly unit-testable.
 */

import { dirname, join } from '../../../../base/common/path.js';

/**
 * Slice of `process.env` needed to resolve the per-user VibeIDE data directory.
 * Index-signature shape (not named optional props) so Node's `ProcessEnv` — which
 * declares no named properties — passes the weak-type check directly.
 * Consulted keys: `VSCODE_USER_DATA_PATH`, `HOME`, `APPDATA`.
 */
export type UserDataEnv = Readonly<Record<string, string | undefined>>;

/**
 * Per-user VibeIDE data directory: explicit env override, else the platform default
 * (`~/Library/Application Support/VibeIDE` / `%APPDATA%\VibeIDE` / `~/.config/VibeIDE`).
 * `null` when the needed variable is absent — callers treat that as "no disk storage",
 * same as a browser context. Note: win32 without APPDATA intentionally falls through
 * to the `$HOME/.config` branch (preserves the original modelsDevCatalog behaviour).
 */
export function resolveVibeUserDataPath(env: UserDataEnv, platform: string): string | null {
	if (env.VSCODE_USER_DATA_PATH) {
		return env.VSCODE_USER_DATA_PATH;
	}
	if (platform === 'darwin' && env.HOME) {
		return join(env.HOME, 'Library', 'Application Support', 'VibeIDE');
	}
	if (platform === 'win32' && env.APPDATA) {
		return join(env.APPDATA, 'VibeIDE');
	}
	if (env.HOME) {
		return join(env.HOME, '.config', 'VibeIDE');
	}
	return null;
}

export type SnapshotSource = 'exeDir' | 'bundled' | 'userData';

export interface SnapshotCandidate {
	readonly path: string;
	readonly source: SnapshotSource;
}

/**
 * Ordered locations to look for a locally-provided catalog snapshot. Order is user
 * policy, do not reorder: a file dropped next to the exe overrides everything
 * (corporate-firewall escape hatch), bundled release artifacts come next, and the
 * auto-written userData cache is the last resort. Absent inputs skip their tier.
 */
export function snapshotCandidatePaths(opts: {
	readonly filename: string;
	readonly execPath?: string;
	readonly resourcesPath?: string;
	readonly userDataDir?: string | null;
}): SnapshotCandidate[] {
	const out: SnapshotCandidate[] = [];
	const exeAdjacent = exeAdjacentFilePath(opts.execPath, opts.filename);
	if (exeAdjacent) {
		out.push({ path: exeAdjacent, source: 'exeDir' });
	}
	if (opts.resourcesPath) {
		out.push({ path: join(opts.resourcesPath, 'app', 'resources', 'vibeide', opts.filename), source: 'bundled' });
		out.push({ path: join(opts.resourcesPath, 'vibeide', opts.filename), source: 'bundled' });
	}
	if (opts.userDataDir) {
		out.push({ path: join(opts.userDataDir, opts.filename), source: 'userData' });
	}
	return out;
}

/** `<dir of execPath>/<filename>` — the max-priority user override; `null` when unresolvable. */
export function exeAdjacentFilePath(execPath: string | undefined, filename: string): string | null {
	if (!execPath) {
		return null;
	}
	const dir = dirname(execPath);
	return dir ? join(dir, filename) : null;
}

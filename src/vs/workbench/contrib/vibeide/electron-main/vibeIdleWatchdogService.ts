/*--------------------------------------------------------------------------------------
 *  Copyright 2026 VibeIDE Team. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt in the project root for license information.
 *--------------------------------------------------------------------------------------*/

/**
 * Idle Watchdog — main-process diagnostic service.
 *
 * Periodically writes a line to `${userDataPath}/logs/vibe-idle-watchdog/YYYY-MM-DD.jsonl`
 * with `process.memoryUsage()`, handle counts, and uptime. Used to diagnose slow leaks
 * and overnight OOMs that DevTools can't catch (no one is watching console.warn at 4am).
 *
 * Configuration (read once at startup from `${userDataPath}/User/settings.json`):
 *   - vibeide.diagnostics.idleWatchdog.enabled        — boolean, default true
 *   - vibeide.diagnostics.idleWatchdog.intervalMinutes — 1..60, default 5
 *   - vibeide.diagnostics.idleWatchdog.retentionDays  — 1..90, default 3
 *
 * On each startup, files older than `retentionDays` are deleted. Config changes
 * take effect on next IDE restart — by design, to keep the service main-only with
 * no IPC channel. Restart hint is included in the setting description.
 */

import * as path from 'node:path';
import * as fs from 'original-fs';
import { parse as parseJsonc } from '../../../../base/common/jsonc.js';

interface WatchdogConfig {
	enabled: boolean;
	intervalMinutes: number;
	retentionDays: number;
}

const DEFAULTS: WatchdogConfig = {
	enabled: true,
	intervalMinutes: 5,
	retentionDays: 3,
};

const LOGS_SUBDIR = path.join('logs', 'vibe-idle-watchdog');

let timer: ReturnType<typeof setInterval> | null = null;
let firstTickTimer: ReturnType<typeof setTimeout> | null = null;

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
	const n = typeof v === 'number' ? v : Number(v);
	if (!Number.isFinite(n)) return fallback;
	return Math.max(min, Math.min(max, Math.round(n)));
}

function readConfig(userDataPath: string): WatchdogConfig {
	try {
		const settingsPath = path.join(userDataPath, 'User', 'settings.json');
		const raw = fs.readFileSync(settingsPath, 'utf-8');
		const parsed = parseJsonc(raw) as Record<string, unknown> | null;
		if (!parsed || typeof parsed !== 'object') return { ...DEFAULTS };
		const enabledRaw = parsed['vibeide.diagnostics.idleWatchdog.enabled'];
		const intervalRaw = parsed['vibeide.diagnostics.idleWatchdog.intervalMinutes'];
		const retentionRaw = parsed['vibeide.diagnostics.idleWatchdog.retentionDays'];
		return {
			enabled: typeof enabledRaw === 'boolean' ? enabledRaw : DEFAULTS.enabled,
			intervalMinutes: clampInt(intervalRaw, 1, 60, DEFAULTS.intervalMinutes),
			retentionDays: clampInt(retentionRaw, 1, 90, DEFAULTS.retentionDays),
		};
	} catch {
		// settings.json may not exist on first launch — silent fallback to defaults.
		return { ...DEFAULTS };
	}
}

function cleanupOldLogs(logsDir: string, retentionDays: number): void {
	try {
		if (!fs.existsSync(logsDir)) return;
		const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
		const files = fs.readdirSync(logsDir);
		for (const file of files) {
			const m = file.match(/^(\d{4}-\d{2}-\d{2})\.jsonl$/);
			if (!m) continue;
			const fileDateMs = Date.parse(`${m[1]}T00:00:00.000Z`);
			if (!Number.isFinite(fileDateMs)) continue;
			if (fileDateMs < cutoffMs) {
				try { fs.unlinkSync(path.join(logsDir, file)); }
				catch { /* file may be locked / already gone — ignore */ }
			}
		}
	} catch {
		// Best-effort; never throw out of startup path.
	}
}

function currentLogFile(logsDir: string): string {
	const d = new Date();
	const yyyy = d.getUTCFullYear();
	const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
	const dd = String(d.getUTCDate()).padStart(2, '0');
	return path.join(logsDir, `${yyyy}-${mm}-${dd}.jsonl`);
}

interface SnapshotLine {
	ts: string;
	uptimeSec: number;
	rss: number;
	heapUsed: number;
	heapTotal: number;
	external: number;
	arrayBuffers: number;
	handles: number;
	activeRequests: number;
	note?: string;
}

function buildSnapshot(note?: string): SnapshotLine {
	const mem = process.memoryUsage();
	const proc = process as unknown as {
		_getActiveHandles?: () => unknown[];
		_getActiveRequests?: () => unknown[];
	};
	// `_getActiveHandles` / `_getActiveRequests` are undocumented but stable since Node 12.
	// Guard anyway — Electron renderer might polyfill `process` differently.
	const handles = typeof proc._getActiveHandles === 'function' ? proc._getActiveHandles().length : -1;
	const activeRequests = typeof proc._getActiveRequests === 'function' ? proc._getActiveRequests().length : -1;
	const line: SnapshotLine = {
		ts: new Date().toISOString(),
		uptimeSec: Math.round(process.uptime()),
		rss: mem.rss,
		heapUsed: mem.heapUsed,
		heapTotal: mem.heapTotal,
		external: mem.external,
		arrayBuffers: mem.arrayBuffers,
		handles,
		activeRequests,
	};
	if (note) line.note = note;
	return line;
}

function appendSnapshot(logsDir: string, note?: string): void {
	try {
		if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
		const line = JSON.stringify(buildSnapshot(note)) + '\n';
		fs.appendFile(currentLogFile(logsDir), line, () => { /* best-effort */ });
	} catch {
		// Disk full / EACCES / etc — never disrupt the IDE.
	}
}

/**
 * Start the idle watchdog. Idempotent — second call is a no-op while the first is active.
 *
 * Must be called from the main process AFTER `app.setPath('userData', ...)` so the
 * `userDataPath` argument is authoritative (matches the rest of the runtime).
 */
export function startVibeIdleWatchdog(userDataPath: string): void {
	if (timer !== null) return;
	let cfg: WatchdogConfig;
	try { cfg = readConfig(userDataPath); }
	catch { cfg = { ...DEFAULTS }; }
	if (!cfg.enabled) return;

	const logsDir = path.join(userDataPath, LOGS_SUBDIR);
	cleanupOldLogs(logsDir, cfg.retentionDays);

	// First snapshot 10 seconds after startup — captures baseline before user
	// interaction inflates working set. Marked `first-tick` for easy grep.
	const firstHandle: any = setTimeout(() => appendSnapshot(logsDir, 'first-tick'), 10_000);
	firstTickTimer = firstHandle;
	// `.unref()` exists on Node's Timeout but not in all `setTimeout` typings VS Code
	// ships — cast to any and feature-detect. Don't keep the event loop alive solely
	// for the watchdog: it must not delay `app.quit()` if user closes the IDE.
	if (typeof firstHandle?.unref === 'function') firstHandle.unref();

	const intervalMs = cfg.intervalMinutes * 60 * 1000;
	const intervalHandle: any = setInterval(() => appendSnapshot(logsDir), intervalMs);
	timer = intervalHandle;
	if (typeof intervalHandle?.unref === 'function') intervalHandle.unref();
}

/**
 * Stop the watchdog. Mainly for tests and clean shutdown if the IDE ever needs it.
 * Real-world: timers are `.unref()`-ed, so process exit handles cleanup naturally.
 */
export function stopVibeIdleWatchdog(): void {
	if (firstTickTimer !== null) {
		clearTimeout(firstTickTimer);
		firstTickTimer = null;
	}
	if (timer !== null) {
		clearInterval(timer);
		timer = null;
	}
}

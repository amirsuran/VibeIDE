/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 VibeIDE Team. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Self-test for knowledge-md-staleness.cjs. Pure helper → trivial fixtures.

'use strict';

const assert = require('node:assert');
const { decideKnowledgeStaleness, renderKnowledgeStaleness } = require('./knowledge-md-staleness.cjs');

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;
let passed = 0;
let failed = 0;

function test(name, fn) {
	try {
		fn();
		console.log(`ok - ${name}`);
		passed++;
	} catch (e) {
		console.log(`fail - ${name}`);
		console.log(`  ${e && e.message ? e.message : e}`);
		failed++;
	}
}

test('absent file → silent verdict, no nudge', () => {
	const d = decideKnowledgeStaleness({
		fileExists: false,
		fileMtimeMs: null,
		commonServiceFiles: [],
		nowMs: NOW,
	});
	assert.strictEqual(d.verdict, 'silent');
	assert.strictEqual(d.newerServiceFiles.length, 0);
});

test('fresh file (1 day) + no drift → silent', () => {
	const d = decideKnowledgeStaleness({
		fileExists: true,
		fileMtimeMs: NOW - DAY,
		commonServiceFiles: [{ path: 'a.ts', mtimeMs: NOW - 2 * DAY }],
		nowMs: NOW,
	});
	assert.strictEqual(d.verdict, 'silent');
});

test('fresh file + drift → info', () => {
	const d = decideKnowledgeStaleness({
		fileExists: true,
		fileMtimeMs: NOW - 5 * DAY,
		commonServiceFiles: [
			{ path: 'fresh.ts', mtimeMs: NOW - 1 * DAY },
			{ path: 'old.ts', mtimeMs: NOW - 10 * DAY },
		],
		nowMs: NOW,
	});
	assert.strictEqual(d.verdict, 'info');
	assert.deepStrictEqual(d.newerServiceFiles, ['fresh.ts']);
});

test('stale file (40 days) + no drift → info', () => {
	const d = decideKnowledgeStaleness({
		fileExists: true,
		fileMtimeMs: NOW - 40 * DAY,
		commonServiceFiles: [{ path: 'a.ts', mtimeMs: NOW - 60 * DAY }],
		nowMs: NOW,
	});
	assert.strictEqual(d.verdict, 'info');
	assert.match(d.reason, /no service drift/);
});

test('stale file + drift → warn', () => {
	const d = decideKnowledgeStaleness({
		fileExists: true,
		fileMtimeMs: NOW - 40 * DAY,
		commonServiceFiles: [
			{ path: 'service-a.ts', mtimeMs: NOW - 5 * DAY },
			{ path: 'service-b.ts', mtimeMs: NOW - 2 * DAY },
		],
		nowMs: NOW,
	});
	assert.strictEqual(d.verdict, 'warn');
	assert.strictEqual(d.newerServiceFiles.length, 2);
});

test('paths sorted alphabetically (deterministic for CI)', () => {
	const d = decideKnowledgeStaleness({
		fileExists: true,
		fileMtimeMs: NOW - 40 * DAY,
		commonServiceFiles: [
			{ path: 'zzz.ts', mtimeMs: NOW - 2 * DAY },
			{ path: 'aaa.ts', mtimeMs: NOW - 2 * DAY },
			{ path: 'mmm.ts', mtimeMs: NOW - 2 * DAY },
		],
		nowMs: NOW,
	});
	assert.deepStrictEqual(d.newerServiceFiles, ['aaa.ts', 'mmm.ts', 'zzz.ts']);
});

test('custom threshold respected', () => {
	const d = decideKnowledgeStaleness({
		fileExists: true,
		fileMtimeMs: NOW - 10 * DAY,
		commonServiceFiles: [{ path: 'a.ts', mtimeMs: NOW - 1 * DAY }],
		nowMs: NOW,
		stalenessThresholdMs: 5 * DAY,
	});
	assert.strictEqual(d.verdict, 'warn'); // 10d > 5d threshold + drift
});

test('zero/negative threshold falls back to default 30 days', () => {
	const d = decideKnowledgeStaleness({
		fileExists: true,
		fileMtimeMs: NOW - 10 * DAY,
		commonServiceFiles: [{ path: 'a.ts', mtimeMs: NOW - 1 * DAY }],
		nowMs: NOW,
		stalenessThresholdMs: 0,
	});
	// 10 days < default 30 days, but drift present → info
	assert.strictEqual(d.verdict, 'info');
});

test('fileAgeMs is clamped to ≥0 on clock skew', () => {
	const d = decideKnowledgeStaleness({
		fileExists: true,
		fileMtimeMs: NOW + DAY, // mtime in the future
		commonServiceFiles: [],
		nowMs: NOW,
	});
	assert.strictEqual(d.fileAgeMs, 0);
});

test('renderKnowledgeStaleness: silent returns (silent) prefix', () => {
	const md = renderKnowledgeStaleness({ verdict: 'silent', reason: null, fileAgeMs: 0, newerServiceFiles: [] });
	assert.match(md, /\(silent\)/);
});

test('renderKnowledgeStaleness: warn truncates list at 20', () => {
	const files = Array.from({ length: 25 }, (_, i) => `f${i}.ts`);
	const md = renderKnowledgeStaleness({
		verdict: 'warn',
		reason: '40 days old AND 25 service file(s) updated',
		fileAgeMs: 40 * DAY,
		newerServiceFiles: files,
	});
	assert.match(md, /knowledge\.md may be stale/);
	assert.match(md, /…и ещё 5/);
});

if (failed > 0) {
	console.error(`\n${failed} failed, ${passed} passed`);
	process.exit(1);
}
console.log(`\n${passed} passed`);

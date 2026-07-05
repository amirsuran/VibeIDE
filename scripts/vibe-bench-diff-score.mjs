/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Scores the current git diff for minimalism A/B benchmarking (docs/benchmarks/minimalism-methodology.md).
// Prints one JSON line: { label, filesChanged, insertions, deletions, netLines, newFiles, at }.
// Usage: node scripts/vibe-bench-diff-score.mjs --label "task03-B-full" [--base HEAD] >> bench-results.jsonl

import { execFileSync } from 'child_process';

function arg(name, fallback) {
	const i = process.argv.indexOf(`--${name}`);
	return i !== -1 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
}

const label = arg('label', 'unlabeled');
const base = arg('base', 'HEAD');

function git(args) {
	return execFileSync('git', args, { encoding: 'utf8' });
}

// --shortstat covers tracked changes; untracked new files are counted separately
// (agents create files without staging them, plain `git diff` would miss those).
const shortstat = git(['diff', '--shortstat', base]).trim();
const filesChanged = Number(/(\d+) files? changed/.exec(shortstat)?.[1] ?? 0);
const insertionsTracked = Number(/(\d+) insertions?\(\+\)/.exec(shortstat)?.[1] ?? 0);
const deletions = Number(/(\d+) deletions?\(-\)/.exec(shortstat)?.[1] ?? 0);

const untracked = git(['ls-files', '--others', '--exclude-standard']).split('\n').filter(Boolean);
let untrackedLines = 0;
for (const f of untracked) {
	try {
		untrackedLines += git(['diff', '--no-index', '--numstat', '/dev/null', f])
			.split('\n')
			.reduce((sum, line) => sum + (Number(line.split('\t')[0]) || 0), 0);
	} catch (e) {
		// `git diff --no-index` exits 1 when files differ — the output is still valid.
		const out = typeof e.stdout === 'string' ? e.stdout : '';
		untrackedLines += out.split('\n').reduce((sum, line) => sum + (Number(line.split('\t')[0]) || 0), 0);
	}
}

const insertions = insertionsTracked + untrackedLines;
const result = {
	label,
	filesChanged: filesChanged + untracked.length,
	insertions,
	deletions,
	netLines: insertions - deletions,
	newFiles: untracked.length,
	at: new Date().toISOString(),
};
process.stdout.write(JSON.stringify(result) + '\n');

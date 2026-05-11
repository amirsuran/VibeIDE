#!/usr/bin/env node
/**
 * vibe diff --split-commits — split a large diff into logical atomic commits
 *
 * Uses diffCommitGrouping (common/diffCommitGrouping.ts CJS mirror) for
 * Conventional-Commits-aware bucketing. Ollama-assisted commit-message
 * generation is a separate Phase 2 step; this script handles partitioning.
 *
 * Usage:
 *   node scripts/vibe-diff-split.js [--dry-run] [--json]
 */

'use strict';

const { execSync } = require('child_process');
const path = require('path');
const { groupDiffByCommitType, renderGroupStub } = require('./lib/diff-commit-grouping.cjs');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const JSON_OUTPUT = args.includes('--json');

function getStagedFiles() {
	try {
		const result = execSync('git diff --cached --name-status', { encoding: 'utf-8' });
		return result.trim().split('\n').filter(Boolean).map(line => {
			const parts = line.split('\t');
			const status = (parts[0] || '').trim().toUpperCase();
			const filePath = parts[1] || '';
			return {
				path: filePath,
				isNew: status === 'A',
				isDeleted: status === 'D',
			};
		}).filter(f => f.path.length > 0);
	} catch { return []; }
}

const stagedChanges = getStagedFiles();

if (stagedChanges.length === 0) {
	console.log('No staged files. Run: git add <files>');
	process.exit(0);
}

if (stagedChanges.length <= 5 && !JSON_OUTPUT) {
	console.log(`${stagedChanges.length} files staged — no split needed.`);
	process.exit(0);
}

const groups = groupDiffByCommitType(stagedChanges);

if (JSON_OUTPUT) {
	const out = groups.map(g => ({
		commitMessage: renderGroupStub(g),
		type: g.type,
		scope: g.scope,
		files: g.files.map(f => f.path),
	}));
	console.log(JSON.stringify(out, null, 2));
	process.exit(0);
}

console.log(`\nvibe diff --split-commits\n${'─'.repeat(50)}`);
console.log(`${stagedChanges.length} staged files → ${groups.length} logical commits\n`);

groups.forEach((group, i) => {
	const message = renderGroupStub(group);
	console.log(`Commit ${i + 1}: ${message}`);
	group.files.forEach(f => console.log(`  - ${f.path}`));
	console.log('');
});

if (DRY_RUN) {
	console.log('[dry-run] No commits made.');
	process.exit(0);
}

console.log('Note: unstage all, then stage and commit each group manually.');
console.log('Or use: git add -p (interactive staging)');
console.log('Phase 2: Ollama-assisted commit-message body generation.');

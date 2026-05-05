#!/usr/bin/env node
/**
 * Removes msvs_configuration_attributes SpectreMitigation blocks from binding.gyp
 * in curated native deps. Idempotent (safe to run repeatedly).
 *
 * Replacing patch-package diffs avoids Linux CI failures: npm ships these files
 * with CRLF; unified patches generated as LF often do not apply with GNU patch.
 *
 * Usage: node scripts/strip-spectre-binding-gyp.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const TARGETS = [
	'node_modules/@vscode/deviceid/binding.gyp',
	'node_modules/@vscode/spdlog/binding.gyp',
	'node_modules/@vscode/windows-mutex/binding.gyp',
	'node_modules/native-keymap/binding.gyp',
];

/**
 * @param {string} content
 * @returns {string}
 */
function stripSpectreBlocks(content) {
	let out = content;
	// Double-quoted keys (e.g. @vscode/deviceid)
	const dq =
		/\r?\n[\t ]*"msvs_configuration_attributes"\s*:\s*\{\s*\r?\n[\t ]*"SpectreMitigation"\s*:\s*"Spectre"\s*\r?\n[\t ]*\},?\s*/g;
	// Single-quoted keys (spdlog, windows-mutex, native-keymap)
	const sq =
		/\r?\n[\t ]*'msvs_configuration_attributes'\s*:\s*\{\s*\r?\n[\t ]*'SpectreMitigation'\s*:\s*'Spectre'\s*\r?\n[\t ]*\},?\s*/g;
	out = out.replace(dq, '\n');
	out = out.replace(sq, '\n');
	return out;
}

let changed = 0;
for (const rel of TARGETS) {
	const filePath = path.join(root, rel);
	if (!fs.existsSync(filePath)) {
		continue;
	}
	const before = fs.readFileSync(filePath, 'utf8');
	const after = stripSpectreBlocks(before);
	if (after !== before) {
		fs.writeFileSync(filePath, after, 'utf8');
		changed++;
		console.log('[strip-spectre-binding-gyp]', 'updated', rel);
	}
}

if (changed === 0) {
	console.log('[strip-spectre-binding-gyp]', 'nothing to update (skipped or already stripped)');
}

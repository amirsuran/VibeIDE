/*--------------------------------------------------------------------------------------
 *  Copyright 2026 VibeIDE Team. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt in the project root for license information.
 *--------------------------------------------------------------------------------------*/

/**
 * Pure XML tool-call normalization helpers (extracted from extractGrammar.ts
 * in v0.13.10 hotfix so they can be tested in isolation).
 *
 * Three production callers in `electron-main/llmMessage/extractGrammar.ts`:
 *   - `normalizeAlternativeToolSyntax(text)` — convert vendor-specific tool-call
 *     formats into canonical `<tool><param>v</param></tool>` block form. Called
 *     on every streamed chunk + on final-message.
 *   - `stripUnclaimedToolTags(text)` — last-resort UX safety net for raw XML
 *     that escaped the parser (placeholder substitution).
 *   - `SELF_CLOSING_PARTIAL_RE` — partial-tag detector for streaming buffer.
 *
 * Tested from `test/common/xmlToolNormalize.test.ts` against every known
 * vendor format we've seen models emit (canonical, Anthropic `<invoke>`,
 * self-closing `<tool attr="v" />`, DSML fullwidth-pipe wrapper).
 *
 * **Layer constraint:** this file MUST stay pure (string → string only).
 * No node/electron imports, no IO, no side effects — that's what makes it
 * testable from `test/common/`.
 */

import { builtinToolNames } from './prompt/prompts.js'
import { PARAM_ALIASES_BY_TOOL, TOOL_NAME_ALIASES } from './prompt/toolAliases.js'

/**
 * Resolve an open-tag name to canonical VibeIDE tool. Case-insensitive.
 */
export const resolveInvokeToolName = (rawName: string): string => {
	const lower = rawName.toLowerCase()
	if (TOOL_NAME_ALIASES[lower]) return TOOL_NAME_ALIASES[lower]
	return lower
}

/**
 * Resolve a param name inside `<arg name="Y">` / `<parameter name="Y">` to
 * its canonical form for the given tool.
 */
export const resolveInvokeParamName = (rawParamName: string, canonicalToolName: string): string => {
	const lower = rawParamName.toLowerCase()
	const paramAliasMap = PARAM_ALIASES_BY_TOOL[canonicalToolName] ?? {}
	return paramAliasMap[lower] ?? lower
}

/**
 * Strip wrapper tags that envelope the actual `<invoke>` block in some vendor
 * formats. Includes the bare `<tool_code>` / `<tool_calls>` / `<function_calls>`
 * wraps and the namespaced `<vendor:tool_call>` form.
 */
export const STRIP_WRAPPERS_RE = /<\/?(?:tool_code|function_calls|tool_calls|tool_use|tools|[a-z][\w-]*:(?:tool_call|tool_calls|tool_use|function_call|function_calls|invoke|tools))\s*>/gi

/**
 * DSML-style fullwidth-pipe markers (v0.13.10).
 *
 * Chinese-ecosystem models (Qwen variants, deepseek-v4-pro via certain
 * aggregators) wrap tool calls with fullwidth-pipe DSML markers:
 *   `<｜｜DSML｜｜tool_calls> <｜｜DSML｜｜invoke name="X"> …`
 *
 * `｜` is U+FF5C (FULLWIDTH VERTICAL LINE), NOT ASCII `|`.
 *
 * Strip pattern: pipe(s) + ASCII identifier + pipe(s). Structural, no
 * hardcoded "DSML" literal — works for `｜｜FOO｜｜`, `｜BAR｜`, `|BAZ|`.
 * After stripping, downstream regexes see canonical `<invoke>` / `<parameter>`.
 */
export const DSML_MARKER_STRIP_RE = /[｜|]{1,4}[A-Za-z][A-Za-z0-9_-]*[｜|]{1,4}/g

/**
 * Self-closing tool-call regex (v0.13.10).
 *
 * Matches `<tool_name attr="v1" attr2="v2" />` for any canonical or aliased
 * tool name. Restricted to the known tool-name universe to avoid matching
 * arbitrary HTML self-closing (`<br />`, `<img />`, `<hr />`, `<input />`).
 *
 * Sorted longer-first so `read_file` matches before `read` when both are in
 * the pool (prefix safety).
 */
export const SELF_CLOSING_TOOL_RE = (() => {
	const names = [
		...builtinToolNames,
		...Object.keys(TOOL_NAME_ALIASES),
	]
	names.sort((a, b) => b.length - a.length)
	return new RegExp(`<(${names.join('|')})\\s+([^>]*?)\\s*\\/>`, 'gi')
})()

/**
 * Partial detection for self-closing tool tag mid-stream (v0.13.10).
 *
 * `<read_file path="d:\Project` — no `/>` yet, but clearly a tool call in
 * progress. Without this, raw XML would flicker on screen between chunks.
 * Same name-universe restriction as `SELF_CLOSING_TOOL_RE`.
 */
export const SELF_CLOSING_PARTIAL_RE = (() => {
	const names = [
		...builtinToolNames,
		...Object.keys(TOOL_NAME_ALIASES),
	]
	names.sort((a, b) => b.length - a.length)
	return new RegExp(`<(${names.join('|')})\\s+[^>]*$`, 'i')
})()

/**
 * Convert vendor-specific tool-call syntaxes into canonical
 * `<tool_name><param>value</param></tool_name>` block form so the regular
 * extractor (`extractXMLToolsWrapper`) handles them with one code path.
 *
 * Handles three classes:
 *   1. Anthropic `<invoke name="X"><parameter name="Y">V</parameter></invoke>`
 *      (and the same with extra attributes on `<parameter>`).
 *   2. Self-closing `<tool_name attr="v" attr2="v2" />` (deepseek-v4-pro,
 *      Kilo-trained variants).
 *   3. DSML fullwidth-pipe wrapper `<｜｜DSML｜｜invoke …>` (Qwen et al.).
 *
 * Canonical block form `<read_file><path>v</path></read_file>` is left alone
 * (the regex requires `\s+` after the tag name; canonical has `>` immediately).
 *
 * @param text — accumulated buffer from a streaming response.
 * @returns text with all vendor formats rewritten to canonical block form.
 */
export const normalizeAlternativeToolSyntax = (text: string): string => {
	// Fast path: no alternative-syntax markers present at all. Cheap substring
	// sniffs first — if any plausibly-vendor pattern is present, fall through
	// to the regex pipeline.
	if (
		!text.includes('<invoke')
		&& !text.includes('<tool_code')
		&& !text.includes('<function_calls')
		&& !text.includes('<tool_calls')
		&& !text.includes('<tool_use')
		&& !text.includes(':tool_call')
		&& !text.includes(':tool_use')
		&& !text.includes(':function_call')
		&& !text.includes(':invoke')
		&& !text.includes('/>')
		&& !text.includes('｜')
	) {
		return text
	}
	// Strip DSML fullwidth-pipe markers FIRST so the downstream regexes (which
	// look for literal `<invoke`, `<parameter`, etc.) see canonical tag names.
	let result = text.replace(DSML_MARKER_STRIP_RE, '')
	result = result.replace(STRIP_WRAPPERS_RE, '')
	result = result.replace(
		// `[^>]*` after `name="X"` tolerates additional attributes (some models
		// emit `<parameter name="filePath" string="true">` — pre-fix the trailing
		// attribute made the regex skip the match entirely).
		/<invoke\s+name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/invoke>/gi,
		(_match: string, rawToolName: string, body: string) => {
			const canonical = resolveInvokeToolName(rawToolName)
			const transformedBody = body.replace(
				/<(?:arg|parameter)\s+name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/(?:arg|parameter)>/gi,
				(_m: string, rawParamName: string, value: string) => {
					const canonicalParam = resolveInvokeParamName(rawParamName, canonical)
					return `<${canonicalParam}>${value}</${canonicalParam}>`
				}
			)
			return `<${canonical}>${transformedBody}</${canonical}>`
		}
	)
	if (result.includes('/>')) {
		result = result.replace(SELF_CLOSING_TOOL_RE, (_match: string, rawTool: string, attrsStr: string) => {
			const canonical = resolveInvokeToolName(rawTool)
			const attrRe = /([a-zA-Z_][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
			let attrMatch: RegExpExecArray | null
			const parts: string[] = []
			while ((attrMatch = attrRe.exec(attrsStr)) !== null) {
				const name = attrMatch[1]
				const value = attrMatch[2] ?? attrMatch[3] ?? ''
				const canonicalParam = resolveInvokeParamName(name, canonical)
				parts.push(`<${canonicalParam}>${value}</${canonicalParam}>`)
			}
			return `<${canonical}>${parts.join('')}</${canonical}>`
		})
	}
	return result
}

/** UX safety-net placeholder for raw XML that escaped the canonical parser. */
const UNCLAIMED_TOOL_TAG_PLACEHOLDER = '\n*[tool call — formatted incorrectly by model, hidden]*\n'

/**
 * Last-resort scrub. If a tool tag in canonical form OR self-closing form
 * makes it through `extractXMLToolsWrapper` (e.g. parser only processes the
 * first call per turn, subsequent calls in the same response would leak raw),
 * substitute it with a polite italic placeholder so the user doesn't see raw
 * XML clutter.
 *
 * Restricted to canonical builtin names — aliases like `<read>` (a common
 * English word) are NOT stripped to avoid mangling regular prose.
 */
export const stripUnclaimedToolTags = (text: string): string => {
	if (!text || text.indexOf('<') === -1) return text
	let out = text
	for (const toolName of builtinToolNames) {
		const re = new RegExp(`<${toolName}>[\\s\\S]*?<\\/${toolName}>`, 'g')
		if (re.test(out)) {
			out = out.replace(re, UNCLAIMED_TOOL_TAG_PLACEHOLDER)
		}
		const selfRe = new RegExp(`<${toolName}\\s+[^>]*\\/>`, 'g')
		if (selfRe.test(out)) {
			out = out.replace(selfRe, UNCLAIMED_TOOL_TAG_PLACEHOLDER)
		}
	}
	return out
}

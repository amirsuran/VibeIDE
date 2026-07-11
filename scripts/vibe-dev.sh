#!/usr/bin/env bash
# VibeIDE — one-shot dev launch (macOS/Linux): optional profile wipe (--clear), gulp compile or
# opt-in transpile, React/NLS, Electron. Windows twin: scripts/vibe-dev.bat.
# Run from repo root: scripts/vibe-dev.sh   or   ./run-dev.sh (wrapper, pins fnm Node).
#
# --clear / -clear — delete the dev profile dirs below, then launch (flag not passed to Electron).
# transpile-client is OFF by default: it wipes out/ and replaces the gulp bundle with loose ESM —
# Electron then fails on `import *.css` (MIME text/css) and workbench.desktop.main.js breaks.
# VIBE_USE_TRANSPILE_CLIENT=1 — force transpile-client instead of full compile (at your own risk).
# VIBE_SKIP_REACT=1 — skip `npm run buildreact` when the sidebar bundle is missing.
# VIBE_SKIP_NLS=1   — skip vibe-nls-extract + clp cache clear.

set -o pipefail

# Electron (@electron/get): map VIBE_ELECTRON_MIRROR to ELECTRON_MIRROR for npm run electron / preLaunch.
# Override: VIBE_ELECTRON_MIRROR=https://cdn.npmmirror.com/binaries/electron/
# Opt out of the default mirror (use GitHub only): VIBE_NO_ELECTRON_MIRROR_FALLBACK=1
if [[ -z "${VIBE_ELECTRON_MIRROR:-}" && -z "${ELECTRON_MIRROR:-}" && "${VIBE_NO_ELECTRON_MIRROR_FALLBACK:-}" != '1' ]]; then
	VIBE_ELECTRON_MIRROR='https://cdn.npmmirror.com/binaries/electron/'
fi
if [[ -n "${VIBE_ELECTRON_MIRROR:-}" ]]; then
	export ELECTRON_MIRROR="$VIBE_ELECTRON_MIRROR"
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

CLEAR_PROFILE=0
CODE_FORWARD=()
for arg in "$@"; do
	case "$arg" in
		--clear | -clear)
			CLEAR_PROFILE=1
			;;
		*)
			CODE_FORWARD+=("$arg")
			;;
	esac
done

if [[ "$CLEAR_PROFILE" == '1' ]]; then
	echo '[vibe-dev] --clear: wiping dev profile (welcome / provider onboarding resets) ...'
	# Real dev folder is vibeide-dev-dev: main.ts passes "VibeIDE Dev" → userDataPath slug
	# vibeide-dev + "-dev". Legacy vibeide-dev kept for old broken layouts / manual paths.
	if [[ "$OSTYPE" == darwin* ]]; then
		APP_DATA_ROOT="$HOME/Library/Application Support"
	else
		APP_DATA_ROOT="${XDG_CONFIG_HOME:-$HOME/.config}"
	fi
	for dir in "$APP_DATA_ROOT/vibeide-dev-dev" "$APP_DATA_ROOT/vibeide-dev" "$HOME/.vibeide-shared" "$HOME/.vibeide"; do
		if [[ -e "$dir" ]]; then
			rm -rf "$dir" 2> /dev/null
			if [[ -e "$dir" ]]; then
				echo "[vibe-dev] WARNING: $dir still exists — close VibeIDE if running"
			fi
		fi
	done
fi

NEED_COMPILE=0
[[ -f 'out/main.js' ]] || NEED_COMPILE=1
[[ -f 'out/nls.messages.json' ]] || NEED_COMPILE=1
[[ -f 'out/vs/workbench/contrib/vibeide/electron-main/registerVibeideMainChannels.js' ]] || NEED_COMPILE=1
if ! grep -q 'vibeide/browser/vibeide.contribution' 'out/vs/workbench/workbench.desktop.main.js' 2> /dev/null; then
	NEED_COMPILE=1
fi

if [[ "$NEED_COMPILE" == '1' ]]; then
	echo '[vibe-dev] full build needed (missing gulp/NLS outputs or workbench hook) — npm run compile ...'
	npm run compile || exit 1
elif [[ "${VIBE_USE_TRANSPILE_CLIENT:-}" == '1' ]]; then
	echo '[vibe-dev] VIBE_USE_TRANSPILE_CLIENT=1 — npm run transpile-client (may break Electron workbench bundle/CSS) ...'
	npm run transpile-client || exit 1
else
	echo '[vibe-dev] skipping transpile-client (keeps gulp bundle; set VIBE_USE_TRANSPILE_CLIENT=1 to force)'
fi

if ! grep -q 'vibeide/browser/vibeide.contribution' 'out/vs/workbench/workbench.desktop.main.js' 2> /dev/null; then
	echo '[vibe-dev] workbench hook missing — run from repo root: npm run compile'
	exit 1
fi
if [[ ! -f 'out/vs/workbench/contrib/vibeide/electron-main/registerVibeideMainChannels.js' ]]; then
	echo '[vibe-dev] main-process bridge missing — run from repo root: npm run compile'
	exit 1
fi

if [[ "${VIBE_SKIP_REACT:-}" != '1' ]]; then
	if [[ ! -f 'src/vs/workbench/contrib/vibeide/browser/react/out/sidebar-tsx/index.js' ]]; then
		echo '[vibe-dev] React sidebar bundle missing — npm run buildreact ...'
		npm run buildreact || exit 1
	fi
fi

if [[ "${VIBE_SKIP_NLS:-}" != '1' ]]; then
	# Run the extractor ONLY when the compile didn't produce NLS metadata. Regenerating it
	# unconditionally from CURRENT src against a STALE out/ shifts the baked localize() indices
	# (src edited after the last compile → off-by-N), and every RU string after the drift point
	# shows a WRONG translation (observed: save-dialog rendering a raw «{0}» placeholder).
	# gulp compile emits consistent out/nls.{keys,messages}.json itself (build/lib/nls.ts).
	if [[ -f "$REPO_ROOT/out/nls.messages.json" ]]; then
		echo '[vibe-dev] NLS: out/nls.messages.json present (emitted by compile) — skipping extract to avoid index drift'
	else
		echo '[vibe-dev] NLS: vibe-nls-extract.ts + clear dev clp cache (stale nls.messages in clp blocks RU) ...'
		if ! npx tsx scripts/vibe-nls-extract.ts; then
			echo '[vibe-dev] WARNING: NLS extraction failed — non-English locales (RU etc.) may show errors'
		elif ! VSCODE_DEV=1 node "$REPO_ROOT/scripts/vibe-dev-clear-nls-clp.mjs"; then
			echo '[vibe-dev] WARNING: could not clear clp cache'
		fi
	fi
else
	echo '[vibe-dev] VIBE_SKIP_NLS=1 — skipping NLS extract and clp clear'
fi

exec "$REPO_ROOT/scripts/code.sh" "${CODE_FORWARD[@]}"

#!/usr/bin/env bash
# VibeIDE dev launch from repo root — macOS/Linux twin of run-dev.bat (see scripts/vibe-dev.sh).
#   ./run-dev.sh              - normal launch (dev profile kept).
#   ./run-dev.sh --compile    - `npm run compile` first, then launch (full compile; launch is
#                               aborted if compilation fails). The flag is NOT passed to Electron.
#   ./run-dev.sh --clear      - wipe the dev profile (handled by scripts/vibe-dev.sh).
#   Flags combine: `./run-dev.sh --compile --clear`. Everything else is forwarded to Electron.
#   Electron download: npmmirror by default unless VIBE_ELECTRON_MIRROR/ELECTRON_MIRROR are set
#   (opt out of the fallback: VIBE_NO_ELECTRON_MIRROR_FALLBACK=1).

set -o pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ---- pin the project's Node (.nvmrc) ahead of any system Node ------------------
# The build MUST run under the fnm-pinned version (.nvmrc = 22.22.1): it matches the Electron 39
# runtime and the build toolchain. A newer system Node silently breaks the build (Node 24 stalls
# gulp-electron's zip extraction), so ALWAYS resolve the fnm install dir for the pinned version
# and prepend it — do NOT early-out just because some node is already on PATH.
ensure_npm() {
	local node_ver='22.22.1'
	if [[ -f "$REPO_ROOT/.nvmrc" ]]; then
		node_ver="$(tr -d '[:space:]' < "$REPO_ROOT/.nvmrc")"
	fi

	# Search KNOWN fnm roots for the installed version's bin dir. FNM_DIR may be unset or point
	# somewhere the versions don't actually live, so check all candidates, not just it.
	local node_dir='' root
	for root in "${FNM_DIR:-}" "$HOME/Library/Application Support/fnm" "$HOME/.fnm" "${XDG_DATA_HOME:-$HOME/.local/share}/fnm"; do
		[[ -n "$root" && -x "$root/node-versions/v$node_ver/installation/bin/npm" ]] || continue
		node_dir="$root/node-versions/v$node_ver/installation/bin"
		break
	done

	# Last resort: ask fnm itself where the pinned node lives (honors a non-default FNM_DIR).
	if [[ -z "$node_dir" ]] && command -v fnm > /dev/null 2>&1; then
		node_dir="$(fnm exec --using "$node_ver" node -e "process.stdout.write(require('path').dirname(process.execPath))" 2> /dev/null || true)"
	fi

	if [[ -n "$node_dir" ]]; then
		export PATH="$node_dir:$PATH"
		echo "[run-dev] pinned project Node $node_ver from \"$node_dir\"."
		return 0
	fi

	if command -v node > /dev/null 2>&1; then
		echo "[run-dev] WARNING: pinned Node $node_ver not found via fnm (checked FNM_DIR, ~/Library/Application Support/fnm, ~/.fnm, XDG data dir, \`fnm exec\`); falling back to node $(node -v) on PATH. Run \`fnm install $node_ver\` if the build misbehaves."
		return 0
	fi

	echo "[run-dev] ERROR: no Node available. Install fnm and the pinned version:"
	echo "[run-dev]   brew install fnm && fnm install $node_ver"
	return 1
}

# ---- foreign node_modules guard (repo copied from another OS/arch, e.g. off a USB stick) -------
# npm's platform-specific optional deps (@esbuild/*, @rollup/rollup-*) only exist for the OS that
# ran `npm i`, and a Windows-installed tree additionally carries .bin/*.cmd shims. If either marker
# says the tree is foreign (or node_modules is missing entirely), wipe every nested node_modules
# and reinstall from scratch — otherwise the build dies mid-compile on the first native module.
ensure_native_node_modules() {
	local reason=''
	if [[ ! -d "$REPO_ROOT/node_modules" ]]; then
		reason='node_modules missing'
	elif [[ -n "$(find "$REPO_ROOT/node_modules/.bin" -maxdepth 1 -name '*.cmd' -print -quit 2> /dev/null)" ]]; then
		reason='Windows .cmd shims in node_modules/.bin'
	else
		local plat arch
		plat="$(uname -s | tr '[:upper:]' '[:lower:]')"
		arch="$(uname -m)"
		case "$arch" in
			x86_64) arch='x64' ;;
			aarch64) arch='arm64' ;;
		esac
		if [[ -d "$REPO_ROOT/node_modules/@esbuild" && ! -d "$REPO_ROOT/node_modules/@esbuild/$plat-$arch" ]]; then
			reason="no @esbuild/$plat-$arch native binary"
		fi
	fi
	[[ -n "$reason" ]] || return 0

	echo "[run-dev] node_modules not built for this OS/arch ($reason) — wiping all nested node_modules and reinstalling (takes a while) ..."
	find "$REPO_ROOT" -maxdepth 3 -name node_modules -type d -not -path '*/node_modules/*' -exec rm -rf {} + 2> /dev/null
	if ! (cd "$REPO_ROOT" && npm i); then
		echo '[run-dev] npm i failed — fix the install errors above and re-run.'
		return 1
	fi
}

# Strip --compile out of the args (the rest are forwarded to vibe-dev.sh / Electron verbatim).
DO_COMPILE=0
FWD_ARGS=()
for arg in "$@"; do
	if [[ "$arg" == '--compile' ]]; then
		DO_COMPILE=1
	else
		FWD_ARGS+=("$arg")
	fi
done

ensure_npm || exit 1
ensure_native_node_modules || exit 1

if [[ "$DO_COMPILE" == '1' ]]; then
	echo '[run-dev] --compile: running `npm run compile`...'
	if ! (cd "$REPO_ROOT" && npm run compile); then
		echo '[run-dev] Compile failed — aborting launch.'
		exit 1
	fi
fi

exec "$REPO_ROOT/scripts/vibe-dev.sh" "${FWD_ARGS[@]}"

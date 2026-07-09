#!/usr/bin/env bash
# home-build-linux.sh — build a portable VibeIDE for THIS Linux machine from source.
# Self-contained: bootstraps fnm + Node + dependencies, then compiles and packages a
# runnable app folder + a .tar.gz. No release machinery. Usually invoked via
# scripts/home-build.sh; can be run directly.
#
# Usage: ./scripts/home-build-linux.sh [--arch x64|arm64] [--yes]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# shellcheck source=scripts/lib/home-build-common.sh
source "$SCRIPT_DIR/lib/home-build-common.sh"

ARCH=''
export HB_ASSUME_YES="${HB_ASSUME_YES:-0}"
while [[ $# -gt 0 ]]; do
	case "$1" in
		--arch) ARCH="${2:-}"; shift 2 ;;
		--yes | -y) HB_ASSUME_YES=1; shift ;;
		*) hb_die "unexpected arg: $1 (use: [--arch x64|arm64] [--yes])" ;;
	esac
done
[[ -n "$ARCH" ]] || ARCH="$(hb_host_arch)"
[[ "$ARCH" == 'x64' || "$ARCH" == 'arm64' ]] || hb_die "unsupported --arch '$ARCH' (allowed: x64, arm64)"

NODE_VER="$(tr -d '[:space:]' < "$ROOT/.nvmrc" 2> /dev/null || echo 22.22.1)"
APP_DIR="$(dirname "$ROOT")/VibeIDE-linux-$ARCH"
ARCHIVE_DIR="$ROOT/.build/home"
ARCHIVE="$ARCHIVE_DIR/VibeIDE-linux-$ARCH.tar.gz"

hb_confirm_intentions "Linux $ARCH → папка $APP_DIR + архив $(basename "$ARCHIVE")" "$NODE_VER"

hb_bootstrap "$ROOT"
hb_precompile "$ROOT"

hb_step "Packaging app (gulp vscode-linux-$ARCH)..."
hb_gulp "$ROOT" "vscode-linux-$ARCH"
[[ -d "$APP_DIR" ]] || hb_die "packaged app dir not found: $APP_DIR"
hb_ok "App built: $APP_DIR"

hb_step "Building portable .tar.gz..."
mkdir -p "$ARCHIVE_DIR"
rm -f "$ARCHIVE"
tar -czf "$ARCHIVE" -C "$(dirname "$ROOT")" "VibeIDE-linux-$ARCH"
hb_ok "Archive: $ARCHIVE"

printf '\n\033[32m🎉 Готово!\033[0m\n'
printf '  Запуск:  %s/bin/vibeide\n' "$APP_DIR"
printf '  Архив:   %s\n\n' "$ARCHIVE"

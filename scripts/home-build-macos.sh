#!/usr/bin/env bash
# home-build-macos.sh — build a portable VibeIDE.app for THIS Mac from source.
# Self-contained: bootstraps fnm + Node + dependencies, then compiles and packages the
# .app + a .zip. Ad-hoc codesign is applied because Apple Silicon refuses to launch an
# app with a broken signature (gulp's post-processing breaks Electron's original one).
# No Developer ID / notarization here — that's a release concern. Usually invoked via
# scripts/home-build.sh; can be run directly.
#
# Usage: ./scripts/home-build-macos.sh [--arch x64|arm64] [--yes]
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
APP_DIR="$(dirname "$ROOT")/VibeIDE-darwin-$ARCH"
APP="$APP_DIR/VibeIDE.app"
ARCHIVE_DIR="$ROOT/.build/home"
ARCHIVE="$ARCHIVE_DIR/VibeIDE-darwin-$ARCH.zip"

hb_confirm_intentions "macOS $ARCH → $APP + архив $(basename "$ARCHIVE")" "$NODE_VER"

hb_bootstrap "$ROOT"
hb_precompile "$ROOT"

hb_step "Packaging app (gulp vscode-darwin-$ARCH)..."
hb_gulp "$ROOT" "vscode-darwin-$ARCH"
[[ -d "$APP" ]] || hb_die "app bundle not found after gulp: $APP"
hb_ok "App built: $APP"

# Show the product version in Finder/Get Info (gulp leaves the VS Code codebase version).
# Patch BEFORE codesign, or the signature would be invalidated.
VIBE_VER="$(node -p "require('$ROOT/product.json').vibeVersion")"
hb_step "Patching Info.plist version → $VIBE_VER..."
/usr/libexec/PlistBuddy \
	-c "Set :CFBundleShortVersionString $VIBE_VER" \
	-c "Set :CFBundleVersion $VIBE_VER" \
	"$APP/Contents/Info.plist"

hb_step 'Codesigning ad-hoc (Gatekeeper will require «Open Anyway» on first launch)...'
codesign --force --deep --sign - "$APP"
codesign --verify --deep "$APP" || hb_die 'codesign verification failed'
hb_ok 'Signed (ad-hoc)'

hb_step 'Building portable .zip (ditto, preserves signature)...'
mkdir -p "$ARCHIVE_DIR"
rm -f "$ARCHIVE"
ditto -c -k --sequesterRsrc --keepParent "$APP" "$ARCHIVE"
hb_ok "Archive: $ARCHIVE"

printf '\n\033[32m🎉 Готово!\033[0m\n'
printf '  Приложение: %s  (первый запуск — ПКМ → Открыть → «Открыть»)\n' "$APP"
printf '  Архив:      %s\n\n' "$ARCHIVE"

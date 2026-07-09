#!/usr/bin/env bash
# home-build.sh — one command to build a portable VibeIDE from source for THIS machine.
# Detects the OS via `uname` and delegates to the matching per-OS builder. Each builder is
# a self-contained bootstrap (installs fnm + Node + dependencies, then compiles & packages).
#
# Usage: ./scripts/home-build.sh [--arch x64|arm64] [--yes]
#   --yes  accept the install-and-build plan without the interactive prompt
#
# Windows: bash is not available by default — run scripts\home-build.cmd instead.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

case "$(uname -s)" in
	Linux)  exec "$SCRIPT_DIR/home-build-linux.sh" "$@" ;;
	Darwin) exec "$SCRIPT_DIR/home-build-macos.sh" "$@" ;;
	MINGW* | MSYS* | CYGWIN*)
		printf '\033[31m✗ На Windows запускай scripts\\home-build.cmd (эта обёртка — для Linux/macOS).\033[0m\n' >&2
		exit 1 ;;
	*)
		printf '\033[31m✗ Неподдерживаемая ОС: %s (поддерживаются Linux, macOS, Windows).\033[0m\n' "$(uname -s)" >&2
		exit 1 ;;
esac

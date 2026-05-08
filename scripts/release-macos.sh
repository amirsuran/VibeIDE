#!/usr/bin/env bash
# Release pipeline for macOS — Universal Binary (arm64 + x64) + notarization.
#
# Roadmap N.0 line 1159. SKELETON ONLY. Running this script today produces
# nothing — the pipeline is gated on Apple Developer credentials and a macOS
# runner, neither of which can be exercised from this repo's CI today.
#
# When unblocking, this script must:
#   1) verify env vars: APPLE_ID, APPLE_TEAM_ID, APPLE_APP_PASSWORD, APPLE_CERT_P12_BASE64.
#   2) gulp vscode-darwin-arm64-min + gulp vscode-darwin-x64-min.
#   3) lipo two app bundles into a Universal binary, codesign with hardened runtime.
#   4) ditto-zip + xcrun notarytool submit ... --wait, then xcrun stapler staple.
#   5) emit release-manifest.json + checksums-sha256.txt with the Windows-equivalent
#      shape (see scripts/vibe-release-manifest.mjs and the
#      `common/releaseManifestUnifier.ts` helper).
#   6) gh release upload "$VIBE_VERSION_TAG" ./dist/*.dmg release-manifest.json
#      checksums-sha256.txt.

set -euo pipefail

cat >&2 <<'EOF'
release-macos.sh: NOT IMPLEMENTED YET (skeleton).

Roadmap reference: docs/roadmap.md § N.0 line 1159 (Distribution readiness gate).

Blocked on:
  - Apple Developer membership + certificate (one-time human signup).
  - macOS runner / local mac in CI (GitHub-hosted macos-latest is fine for
    notarization but the credentials must be set as repo secrets first).
  - notarytool credentials (APPLE_ID, APPLE_TEAM_ID, APPLE_APP_PASSWORD).

Until those are provisioned, please use the Windows pipeline:
  ./scripts/release-windows.ps1

If you got here by clicking a release-time hook, fix the hook to skip macOS
until this skeleton is replaced with a real implementation.
EOF
exit 1

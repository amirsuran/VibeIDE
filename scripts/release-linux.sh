#!/usr/bin/env bash
# Release pipeline for Linux — x64 + ARM64 (deb / rpm / AppImage / tar.gz).
#
# Roadmap N.0 line 1160. SKELETON ONLY. Running this script today produces
# nothing — the pipeline depends on a maintainer GPG key and ARM cross-compile
# tooling that isn't yet provisioned.
#
# When unblocking, this script must:
#   1) verify env vars: VIBE_GPG_KEY_ID, VIBE_GPG_PASSPHRASE.
#   2) gulp vscode-linux-x64-min + gulp vscode-linux-arm64-min (arm64 either
#      via QEMU on the runner or a dedicated ARM runner).
#   3) gulp vscode-linux-{x64,arm64}-build-{deb,rpm,appimage} + tar -czf for
#      the portable tarball.
#   4) gpg --detach-sign --armor each artefact; emit a single .asc per file.
#   5) emit release-manifest.json + checksums-sha256.txt with the Windows-equivalent
#      shape (see scripts/vibe-release-manifest.mjs and the
#      `common/releaseManifestUnifier.ts` helper).
#   6) gh release upload "$VIBE_VERSION_TAG" ./dist/*.{deb,rpm,AppImage,tar.gz}
#      ./dist/*.asc release-manifest.json checksums-sha256.txt.

set -euo pipefail

cat >&2 <<'EOF'
release-linux.sh: NOT IMPLEMENTED YET (skeleton).

Roadmap reference: docs/roadmap.md § N.0 line 1160 (Distribution readiness gate).

Blocked on:
  - Maintainer GPG key (one-time human action: gpg --gen-key + upload public
    half to keys.openpgp.org).
  - ARM64 cross-compile path (QEMU on x86_64 runner, OR a dedicated arm64
    runner — pick one; affects step 2).
  - .deb / .rpm / .AppImage acceptance — at least one Debian/Fedora-flavoured
    smoke installer for the resulting artefacts on a clean VM.

Until those are provisioned, please use the Windows pipeline:
  ./scripts/release-windows.ps1

If you got here by clicking a release-time hook, fix the hook to skip Linux
until this skeleton is replaced with a real implementation.
EOF
exit 1

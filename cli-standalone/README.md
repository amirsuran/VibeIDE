# @vibeide/cli-standalone

Standalone, publishable `vibe` CLI. Mirrors the in-repo `scripts/vibe.js`
dispatcher so the same commands (`vibe doctor`, `vibe skills list`, `vibe
release-lint`, …) are available outside a VibeIDE checkout.

## Install

```bash
npm install -g @vibeide/cli-standalone
vibe --help
```

## What gets shipped

The package bundles `scripts/vibe.js` (the dispatcher) and every `vibe-*.{js,mjs,cjs}`
companion plus `scripts/lib/` from the VibeIDE repository. The bundled copy is
populated by `npm run sync` and verified by `prepublishOnly` (`--check`).

## Dispatcher resolution

When invoked, the CLI looks for `scripts/vibe.js` in this order:

1. `$VIBEIDE_SCRIPTS` (absolute path to a `scripts/` directory).
2. The bundled `<package>/scripts/vibe.js` (default for installed users).
3. `<cwd>/scripts/vibe.js`.
4. Walk parent directories from `cwd` (up to 12 levels) looking for `scripts/vibe.js`.

This makes the CLI usable both as a globally installed binary and as a thin
launcher inside a VibeIDE checkout (which always wins via path discovery).

## Dev workflow

```bash
# from a VibeIDE checkout
cd cli-standalone
node ./bin/sync-from-repo.js
node ./bin/vibe.js --help
```

## Publish

```bash
cd cli-standalone
npm run sync          # copy dispatcher + companions into ./scripts
npm version patch
npm publish --access public
```

## Roadmap

L1134 — first published standalone bin. Bundling currently mirrors the file set;
future iterations may switch to a single-file bundle via `esbuild` to avoid the
companion-file sync step entirely.

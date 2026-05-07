# Security

Do **not** report security vulnerabilities through public GitHub issues.

## Reporting a vulnerability

1. **GitHub** — use the repository **Security** tab and **Report a vulnerability**
   (private advisory).
2. **Email** — if you cannot use advisories, contact the maintainer privately at
   **i@borodatych.ru** with a clear subject (e.g. `[VibeIDE security]`). PGP key is
   available on request.

Please include enough detail to reproduce or assess impact: VibeIDE version (`vibeVersion`
from `product.json`), OS, exact reproduction steps, and the impact you have established.
A redacted log from `VibeIDE: Copy diagnostic report for issue` is welcome.

## Disclosure window

We follow a **90-day coordinated disclosure** policy:

- Day 0 — report received, acknowledged within 5 business days.
- Day 0 to 30 — investigation, severity triage (CVSS), patch design.
- Day 30 to 60 — patch implementation and verification, release scheduling.
- Day 60 to 90 — coordinated publication: patched release, advisory, CVE assignment via
  GitHub if applicable.
- Day 90 — public disclosure, regardless of patch status, unless the reporter agrees to
  an extension.

Critical issues with active exploitation are released as soon as a patch is verified,
even if that is well under 90 days.

## Scope

In scope:

- VibeIDE-specific code under `src/vs/workbench/contrib/vibeide/**`.
- VibeIDE-bundled extensions under `extensions/vibeide-*`.
- VibeIDE scripts under `scripts/`, `bin/`.
- VibeIDE CI workflows in `.github/workflows/` that affect releases or signing.
- VibeIDE configuration formats: `.vibe/permissions.json`, `.vibe/constraints.json`,
  `.vibe/commands.json`, `.vibe/skills/**`, `.vibe/plans/**`.

Out of scope (forward upstream):

- Bugs inherited from `microsoft/vscode` upstream — please file with Microsoft. See
  [https://aka.ms/SECURITY.md](https://aka.ms/SECURITY.md).
- Issues in third-party LLM provider APIs.
- Issues in user-installed VS Code extensions.

## Bug bounty

There is no monetary bounty program at this time. We publicly credit reporters in the
release notes (`## 🔒 Безопасность` section) unless they request anonymity.

If we open a public bounty (planned: via Huntr.dev for OSS at Phase 3a), this section
will be updated.

## What you can expect from us

- An acknowledgement within 5 business days.
- Periodic updates at least every 14 days through the disclosure window.
- A draft of the public advisory shared with the reporter before publication.
- Credit in the published advisory unless the reporter declines.

## What we ask of you

- Do not access, modify, or delete data that is not yours.
- Do not perform tests against systems you do not own (the maintainer's repo, demo
  installations, etc).
- Do not publicly disclose details before the coordinated date.
- Do not attempt social engineering against the maintainer or community members.

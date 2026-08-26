# Changelog

All notable ROOK milestones are documented here.

## v0.002-dev — 2026-08-26

### Added

- Exact `@truefoundry/trueforge-sdk` `0.1.3` dependency for reproducible local integration.
- Official SDK transport for real TrueForge session creation and streamed turns.
- Normalized harness evidence contract carrying source event ID, source timestamp when available, ROOK observation time, stream sequence, and thread identity.
- Local browser runtime configuration with explicit non-secret `VITE_TRUEFORGE_URL` and `VITE_TRUEFORGE_MODEL` inputs.
- Citadel Watch TrueForge proof panel exposing observed session and stream provenance.
- Explicit UI truth split between live harness evidence and fixture incident data.
- Reproduction and evidence guide in `docs/TRUEFORGE_V0.002.md`.

### Safety and correctness hardening

- Replaced saved-agent attachment with a fresh inline model-only TrueForge agent so v0.002 cannot inherit MCP, skill, sandbox, or mutation authority from external agent configuration.
- Added text instructions prohibiting unsupported telemetry/tool/production claims.
- Treats any tool, sandbox, subagent, approval, MCP-auth, or required-action event as unexpected v0.002 capability drift and fails closed.
- Requires exactly one terminal `turn.done`; truncated and double-terminal streams fail instead of reporting ready.
- Unknown future event types are truly ignored before current-field provenance validation.
- Known malformed events fail closed, including blank model deltas and partially malformed approval/MCP arrays.
- Session creation is recorded as a TrueForge REST resource observation rather than fabricated into a stream event.
- Credential-bearing, hosted/remote, query-bearing, fragment-bearing, and endpoint-path TrueForge URLs are rejected by the v0.002 browser boundary.
- Preserves `threadId: null` as the documented root-thread provenance marker rather than collapsing it to `undefined`.
- Public harness interface comments now use evidence-state claim vocabulary.

### Tests

- Added TrueForge event normalization, evidence provenance, terminal-state, malformed-event, URL-boundary, transport-failure, capability-drift, and inline-agent authority tests.
- Added browser runtime-configuration tests covering missing, invalid, credential-bearing, hosted, and valid local states.
- Converted Qodo review findings into regression coverage rather than review-only commentary.

### Review history

- PR #5 opened before UI promotion so Qodo could review the actual transport boundary early.
- Initial Qodo review reported eight bugs and one evidence-vocabulary rule violation, including High-severity findings around unknown-event compatibility, fabricated session provenance, and incomplete-stream readiness.
- Valid findings are being resolved on the same branch with dedicated `fix:` and `test:` commits before release promotion.

### Status

Implemented but not yet promoted to `v0.002` release truth. Release requires final CI, Qodo follow-up on the exact head, and an authentic local TrueForge capture following `docs/TRUEFORGE_V0.002.md`.

## v0.001 — 2026-08-26

### Released scope

- Repository governance and Qodo-reviewed development law.
- TrueForge-centered architecture boundary.
- Fail-closed production authorization model.
- Incident lifecycle state contract with replay-resistant authorization and audit provenance safeguards.
- React/TypeScript command-center foundation.
- Canonical Citadel Watch v1.1 design-token and runtime identity pipeline.
- Unit-test, token-drift, TypeScript, and production-build CI verification.
- Evidence-first truth doctrine: `CLAIM → EVIDENCE → PUBLIC TRUTH`.

### Release evidence

- Foundation PR #3 merged after iterative Qodo safety review and final confirmation that no High-severity blocker remained.
- Citadel Watch integration PR #4 merged after Qodo confirmed no High- or Medium-severity blocker remained on the final head.
- Fixture-only operational data remained explicitly labeled; v0.001 made no live TrueForge claim.

### Pre-development verification

- Qodo installation healthy on `Ranger-Jay/ROOK`.
- Automatic Qodo review trigger verified through closed, unmerged smoke-test PR #2.

# Changelog

All notable ROOK milestones are documented here.

## v0.002 — 2026-08-26

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
- Routes browser SDK traffic through the dedicated same-origin `/__rook_trueforge` Vite proxy so the authentic proof does not depend on cross-origin browser access to the local TrueForge server.
- Reuses the strict credential-free loopback validator for the proxy target and refuses unrelated proxy paths.
- Accepts documented finish-only `model.message.delta` events without inventing evidence while rejecting unsupported capability-bearing finish reasons.
- Displays the authentic terminal wire-event name `turn.done` in the proof surface while retaining the normalized internal `turn.completed` lifecycle state and provenance.

### Tests

- Added TrueForge event normalization, evidence provenance, terminal-state, malformed-event, URL-boundary, transport-failure, capability-drift, and inline-agent authority tests.
- Added browser runtime-configuration tests covering missing, invalid, credential-bearing, hosted, and valid local states.
- Added same-origin proxy regression tests covering SDK base selection, proxy target validation, path rewriting, and refusal of broadened proxy routes.
- Added regression coverage for finish-only model deltas and authentic terminal-event labeling.
- Converted Qodo review findings and subsequent integration-audit findings into regression coverage rather than review-only commentary.

### Review and authentic proof

- PR #5 opened before UI promotion so Qodo could review the actual transport boundary early.
- Initial Qodo review reported eight bugs and one evidence-vocabulary rule violation, including High-severity findings around unknown-event compatibility, fabricated session provenance, and incomplete-stream readiness.
- Valid findings were resolved on the same branch with dedicated `fix:` and `test:` commits before release promotion.
- A subsequent Buddy Main audit against the current upstream TrueForge server/SDK identified that direct browser-to-TrueForge requests would rely on a cross-origin contract not established by the server. The transport was moved behind ROOK's strict same-origin local proxy and the failure mode was regression-tested before authentic capture.
- Authentic local execution on Windows proved `ROOK UI → governed Vite proxy → official TrueForge SDK 0.1.3 → local TrueForge 0.1.3 → ollama-local/qwen2-5-1-5b → streamed turn`.
- Capture evidence recorded authentic session `01m10cfv36zfmvh8n61gw0cmmp`, exactly one terminal `turn.done`, terminal source ID `01m10cmypg6k494xst43sz6qwp`, and explicit separation of `FIXTURE INCIDENT DATA` from live harness evidence.
- The capture exposed two narrow runtime-truth corrections: finish-only delta handling (`7598eb67beea115efcf4fdd56f743de66a7cf2a4`) and authentic terminal-event presentation (`d08d7d2b1a29b9c597ec33fb7050fbcfede96109`).
- Substantive-head CI run #40 passed canonical token synchronization, unit tests, TypeScript checks, and production build on `d08d7d2b1a29b9c597ec33fb7050fbcfede96109`.
- Qodo follow-up on that substantive head reported no remaining High/Medium merge blocker and confirmed no v0.002 authority widening.
- The release-only commits then promoted `VERSION` to `v0.002` and recorded the release evidence without modifying production code, tests, runtime configuration, capability boundaries, or authority logic.
- Final release-head CI run #42 passed canonical token synchronization, unit tests, TypeScript checks, and production build on `b3f697911be804a571a823f7f9eed8c3e851cfa1`.
- Qodo re-reviewed that release head, reported no High/Medium blocker from the release-only changes, confirmed all nine original findings implemented, and cleared PR #5 for Jay's human merge decision.
- All nine original Qodo inline review threads are resolved.

### Status

The substantive v0.002 implementation, authentic local proof, release marker promotion, final release-head CI, and Qodo release-head review have passed. PR #5 now awaits Jay's human merge decision before the milestone becomes merged `main` history.

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

# Changelog

All notable ROOK milestones are documented here.

## v0.002-dev — 2026-08-26

### Planned scope

- Real `@truefoundry/trueforge-sdk` session boundary.
- First authenticated-by-environment local TrueForge connection with no browser-bundled secrets.
- Incident-to-session mapping and streamed turn execution.
- Normalized read-only TrueForge event telemetry for the ROOK command surface.
- Explicit live / disconnected / failed truth states.
- No production/demo-production mutation authority in this milestone.

### Development gate

- v0.002 begins only after v0.001 foundation and Citadel Watch visual integration were merged through Qodo-reviewed PRs #3 and #4.
- Qodo reported no remaining High/Medium blocker on the final PR #4 head before merge.

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

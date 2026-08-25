# ROOK Versioning Discipline

ROOK uses deliberate pre-1.0 milestones so the public history stays understandable during the hackathon.

## Milestone sequence

Human-facing milestones use `v0.NNN`:

- `v0.001` — foundation: governance, safety contract, React shell, lifecycle model, CI
- `v0.002` — live TrueForge session boundary and first real harness connection
- `v0.003` — owned MCP demo stack and read-only incident investigation
- `v0.004` — sandbox reproduction and delegated investigators
- `v0.005` — human approval gate and authorized remediation
- `v0.006` — recovery verification and audit trail
- later milestones are defined only when the preceding vertical slice is stable

The sequence is a plan, not a promise to inflate version count. Milestones may be consolidated when doing so improves coherence, but unrelated work must not be bundled merely to reduce PR count.

## Development marker

While a milestone is under active development, `VERSION` uses a `-dev` suffix, for example:

`v0.001-dev`

The suffix is removed only by a dedicated release/version commit after the release gate passes.

## npm mapping

Because npm requires SemVer-compatible numeric identifiers:

- `v0.001` → `0.1.0`
- `v0.002` → `0.2.0`
- `v0.003` → `0.3.0`

## Branches

Use narrowly scoped branches:

- `feat/<scope>` — product capability
- `fix/<scope>` — defect correction
- `test/<scope>` — isolated verification work when useful
- `docs/<scope>` — documentation-only work
- `chore/<scope>` — maintenance/workflow changes

## Qodo gate

Every substantive PR must receive a completed Qodo review before merge.

For each substantive PR:

1. Open the PR before merge.
2. Confirm Qodo reviews the actual head commit.
3. Fix every valid High-severity finding or dismiss it in-thread with a technical reason.
4. Evaluate Medium/Low findings deliberately.
5. After material fixes, obtain a Qodo follow-up review of the final code.
6. Verify CI on the final head commit.
7. Buddy Main checks Qodo + CI before merge.

## Release gate

A milestone is release-ready only when:

1. Scope is coherent and demonstrable.
2. Unit tests for changed domain logic pass.
3. TypeScript compilation and production build pass.
4. No secrets or private data are committed.
5. Simulated/demo data is labeled honestly.
6. Safety invariants remain enforced.
7. README/architecture/reproduction documentation is current.
8. Qodo reviewed the substantive PRs in the milestone.
9. All valid High findings are resolved or explicitly dismissed with reason.
10. Buddy Main has checked final CI and Qodo evidence.

## History rules

- Do not force-push `main`.
- Preserve meaningful PR and Qodo history for judging.
- Prefer reviewable change sets over giant AI-generated dumps.
- Fix discovered defects in dedicated `fix:` commits whenever practical.
